import { handleBilling } from "./billing/routes";
import { getAuth } from "./auth";
import { handleCircles, isCirclesPath } from "./circles/router";
import type { AppEnv } from "./env";
import { applyWrites, readChanges } from "./sync";
import { parseLimit, parseSince, parseSyncBody, ValidationError } from "./validate";

const MAX_BODY_BYTES = 1_000_000;

const tooLarge = () => new ValidationError(413, "request body too large");

/**
 * Reads the request body as text, rejecting it once it exceeds MAX_BODY_BYTES. A declared
 * content-length over the limit is refused without reading; otherwise the stream is counted in
 * bytes as it arrives so chunked uploads are cut off too.
 */
async function readLimitedText(request: Request): Promise<string> {
  const declared = request.headers.get("content-length");
  if (declared !== null && Number(declared) > MAX_BODY_BYTES) throw tooLarge();
  if (!request.body) return "";

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > MAX_BODY_BYTES) {
      await reader.cancel();
      throw tooLarge();
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

async function handleV1(request: Request, env: AppEnv, url: URL): Promise<Response> {
  const route = url.pathname;
  if (isCirclesPath(route)) {
    const session = await getAuth(env).api.getSession({ headers: request.headers });
    if (!session) return json({ error: "unauthorized" }, 401);
    return handleCircles(request, env, session.user.id, url);
  }
  const isSync = route === "/v1/sync";
  const isMe = route === "/v1/me";
  if (!isSync && !isMe) return json({ error: "not_found" }, 404);

  const allowed = isSync ? ["GET", "POST"] : ["GET"];
  if (!allowed.includes(request.method)) {
    return Response.json(
      { error: "method_not_allowed" },
      { status: 405, headers: { allow: allowed.join(", "), "cache-control": "no-store" } },
    );
  }

  const session = await getAuth(env).api.getSession({ headers: request.headers });
  if (!session) return json({ error: "unauthorized" }, 401);
  const user = session.user;

  if (isMe) return json({ id: user.id, email: user.email, name: user.name });

  try {
    if (request.method === "GET") {
      const since = parseSince(url.searchParams.get("since"));
      const limit = parseLimit(url.searchParams.get("limit"));
      return json(await readChanges(env.APP_DB, user.id, since, limit));
    }

    const text = await readLimitedText(request);
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      throw new ValidationError(400, "body must be valid JSON");
    }
    const { entries, settings } = parseSyncBody(body, Date.now());
    return json(await applyWrites(env.APP_DB, user.id, entries, settings));
  } catch (e) {
    if (e instanceof ValidationError) {
      return json(
        { error: e.status === 413 ? "payload_too_large" : "invalid_request", detail: e.detail },
        e.status,
      );
    }
    throw e;
  }
}

/** Returns a response for `/api/auth/*` and `/v1/*`, or null when the path belongs to another route. */
export async function handleApp(
  request: Request,
  env: AppEnv,
  _ctx: ExecutionContext,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname === "/api/auth" || url.pathname.startsWith("/api/auth/")) {
    return getAuth(env).handler(request);
  }
  const billing = await handleBilling(request, env);
  if (billing) return billing;
  if (url.pathname === "/v1" || url.pathname.startsWith("/v1/")) {
    return handleV1(request, env, url);
  }
  return null;
}
