export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly detail?: string,
    readonly headers?: Record<string, string>,
  ) {
    super(detail ?? code);
  }
}

export function json(body: unknown, status = 200, headers?: Record<string, string>): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store", ...headers } });
}

export function errorResponse(e: HttpError): Response {
  return json({ error: e.code, ...(e.detail ? { detail: e.detail } : {}) }, e.status, e.headers);
}

export const badRequest = (detail: string): HttpError =>
  new HttpError(400, "invalid_request", detail);
export const notFound = (): HttpError => new HttpError(404, "not_found");

/**
 * Reads the body, refusing it once it passes `max` bytes. A declared content-length over the limit
 * is rejected without reading; otherwise the stream is counted so chunked uploads are cut off too.
 */
export async function readLimited(request: Request, max: number): Promise<Uint8Array> {
  const tooLarge = () =>
    new HttpError(413, "payload_too_large", `body is larger than ${max} bytes`);
  const declared = request.headers.get("content-length");
  if (declared !== null && Number(declared) > max) throw tooLarge();
  if (!request.body) return new Uint8Array();

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > max) {
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
  return bytes;
}

const MAX_JSON_BYTES = 16 * 1024;

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  const bytes = await readLimited(request, MAX_JSON_BYTES);
  let body: unknown;
  try {
    body = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw badRequest("body must be valid JSON");
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw badRequest("body must be a JSON object");
  }
  return body as Record<string, unknown>;
}

/** Rejects fields outside `allowed` so typos and smuggled data fail loudly. */
export function checkKeys(obj: Record<string, unknown>, allowed: readonly string[]): void {
  for (const k of Object.keys(obj)) {
    if (!allowed.includes(k)) throw badRequest(`unknown field "${k}"`);
  }
}
