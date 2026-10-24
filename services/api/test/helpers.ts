import { env, exports } from "cloudflare:workers";

const encoder = new TextEncoder();

async function sign(value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(env.BETTER_AUTH_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

export interface TestUser {
  id: string;
  email: string;
  cookie: string;
}

/** Inserts a user + session row and returns the cookie better-auth expects. */
export async function createUser(name: string): Promise<TestUser> {
  const id = `user-${name}-${crypto.randomUUID()}`;
  const email = `${name}@example.test`;
  const token = crypto.randomUUID().replaceAll("-", "");
  const now = new Date().toISOString();
  const expires = new Date(Date.now() + 7 * 86_400_000).toISOString();
  await env.APP_DB.batch([
    env.APP_DB.prepare(
      'INSERT INTO "user" (id, name, email, emailVerified, createdAt, updatedAt) VALUES (?1, ?2, ?3, 1, ?4, ?4)',
    ).bind(id, name, email, now),
    env.APP_DB.prepare(
      'INSERT INTO "session" (id, token, userId, expiresAt, createdAt, updatedAt) VALUES (?1, ?2, ?3, ?4, ?5, ?5)',
    ).bind(`sess-${id}`, token, id, expires, now),
  ]);
  const signed = `${token}.${await sign(token)}`;
  return { id, email, cookie: `better-auth.session_token=${encodeURIComponent(signed)}` };
}

export function api(path: string, init: RequestInit & { user?: TestUser; json?: unknown } = {}) {
  const { user, json, ...rest } = init;
  const headers = new Headers(rest.headers);
  if (user) headers.set("cookie", user.cookie);
  if (json !== undefined) {
    headers.set("content-type", "application/json");
    rest.body = JSON.stringify(json);
    rest.method ??= "POST";
  }
  return exports.default.fetch(`http://localhost${path}`, { ...rest, headers });
}

export const now = () => Date.now();
