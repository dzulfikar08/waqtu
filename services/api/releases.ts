// Authenticated release publishing, called by apps/apple/scripts/release.sh (locally or from the
// "Release macOS" GitHub workflow), so CI only needs RELEASE_UPLOAD_TOKEN instead of a Cloudflare API token.
//
//   PUT  /releases/files/<name>.dmg   body = DMG bytes        -> stored in R2 (BUCKET)
//   POST /releases                    body = release metadata -> row in D1 `releases` (appcast source)

export interface ReleaseBucket {
  put(
    key: string,
    value: ReadableStream | null,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<unknown>;
}

export interface ReleaseDB {
  prepare(query: string): {
    bind(...values: unknown[]): { run(): Promise<unknown> };
  };
}

export interface ReleaseEnv {
  DB: ReleaseDB;
  BUCKET: ReleaseBucket;
  RELEASE_UPLOAD_TOKEN?: string;
  R2_PUBLIC_BASE_URL?: string;
}

const FILE_NAME = /^Waqtu-\d+\.\d+(\.\d+)?\.dmg$/;
const DEFAULT_PUBLIC_BASE = "https://waqt-r2-release.dzulfikar.com";

async function authorized(request: Request, expected: string | undefined): Promise<boolean> {
  if (!expected) return false;
  const got = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(got)),
    crypto.subtle.digest("SHA-256", enc.encode(expected)),
  ]);
  const x = new Uint8Array(a);
  const y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

interface ReleaseBody {
  version?: unknown;
  short_version_string?: unknown;
  description?: unknown;
  file_name?: unknown;
  ed_signature?: unknown;
  length?: unknown;
}

export async function handleReleases(request: Request, env: ReleaseEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/releases")) return null;

  if (!(await authorized(request, env.RELEASE_UPLOAD_TOKEN))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  if (request.method === "PUT" && url.pathname.startsWith("/releases/files/")) {
    const name = decodeURIComponent(url.pathname.slice("/releases/files/".length));
    if (!FILE_NAME.test(name)) return Response.json({ error: "bad file name" }, { status: 400 });
    if (!request.body) return Response.json({ error: "empty body" }, { status: 400 });
    await env.BUCKET.put(name, request.body, {
      httpMetadata: { contentType: "application/x-apple-diskimage" },
    });
    const base = (env.R2_PUBLIC_BASE_URL ?? DEFAULT_PUBLIC_BASE).replace(/\/$/, "");
    return Response.json({ url: `${base}/${name}` });
  }

  if (request.method === "POST" && url.pathname === "/releases") {
    let body: ReleaseBody;
    try {
      body = (await request.json()) as ReleaseBody;
    } catch {
      return Response.json({ error: "invalid JSON" }, { status: 400 });
    }
    const { version, short_version_string, description, file_name, ed_signature, length } = body;
    if (
      !Number.isInteger(version) ||
      typeof short_version_string !== "string" ||
      typeof file_name !== "string" ||
      !FILE_NAME.test(file_name) ||
      typeof ed_signature !== "string" ||
      !/^[A-Za-z0-9+/=]{40,}$/.test(ed_signature) ||
      !Number.isInteger(length)
    ) {
      return Response.json({ error: "invalid release metadata" }, { status: 400 });
    }
    const base = (env.R2_PUBLIC_BASE_URL ?? DEFAULT_PUBLIC_BASE).replace(/\/$/, "");
    await env.DB.prepare(
      "INSERT OR REPLACE INTO releases (version, short_version_string, title, description, enclosure_url, ed_signature, length, pub_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
      .bind(
        version,
        short_version_string,
        `Waqtu ${short_version_string}`,
        typeof description === "string" && description
          ? description
          : "Bug fixes and improvements.",
        `${base}/${file_name}`,
        ed_signature,
        length,
        new Date().toISOString(),
      )
      .run();
    return Response.json({ ok: true });
  }

  return Response.json({ error: "not found" }, { status: 404 });
}
