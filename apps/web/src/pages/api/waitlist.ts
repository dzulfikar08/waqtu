import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

// Runs on the Cloudflare Worker at request time (the rest of the site is static).
export const prerender = false;

const MAX_BODY_BYTES = 4096;
const WINDOW_SECONDS = 600;
const MAX_HITS_PER_WINDOW = 5;
const PLATFORMS: Record<string, true> = { ios: true, android: true, mac: true };
const LOCALES: Record<string, true> = { id: true, en: true };
// One "@", a dot in the domain, no whitespace. Real validation is the confirmation mail we send at launch.
const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

interface WaitlistInput {
  email?: unknown;
  platform?: unknown;
  city?: unknown;
  locale?: unknown;
  /** Honeypot. Hidden from people, filled in by form-stuffing bots. */
  website?: unknown;
}

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

const text = (value: unknown) => (typeof value === "string" ? value : "");

async function hashIp(ip: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .slice(0, 16)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Counts this request against the caller's window. Returns false once the limit is exceeded. */
async function underRateLimit(db: D1Database, ip: string, salt: string): Promise<boolean> {
  const bucket = Math.floor(Date.now() / 1000 / WINDOW_SECONDS);
  const ipHash = await hashIp(ip, salt);
  const [, , row] = await db.batch<{ hits: number }>([
    db.prepare("DELETE FROM waitlist_rate WHERE bucket < ?").bind(bucket - 1),
    db
      .prepare(
        "INSERT INTO waitlist_rate (ip_hash, bucket, hits) VALUES (?, ?, 1) ON CONFLICT (ip_hash, bucket) DO UPDATE SET hits = hits + 1",
      )
      .bind(ipHash, bucket),
    db
      .prepare("SELECT hits FROM waitlist_rate WHERE ip_hash = ? AND bucket = ?")
      .bind(ipHash, bucket),
  ]);
  return (row.results[0]?.hits ?? 1) <= MAX_HITS_PER_WINDOW;
}

async function readInput(
  request: Request,
): Promise<{ input: WaitlistInput; isForm: boolean } | null> {
  const type = request.headers.get("content-type") ?? "";
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) return null;
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return null;

  if (type.includes("application/json")) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return { input: parsed as WaitlistInput, isForm: false };
      }
    } catch {
      /* falls through to null */
    }
    return null;
  }
  if (type.includes("application/x-www-form-urlencoded")) {
    return { input: Object.fromEntries(new URLSearchParams(raw)), isForm: true };
  }
  return null;
}

export const POST: APIRoute = async ({ request }) => {
  const parsed = await readInput(request);
  if (!parsed) return json(400, { error: "bad_request" });
  const { input, isForm } = parsed;

  const locale = Object.hasOwn(LOCALES, text(input.locale)) ? text(input.locale) : "id";
  // No-JS form posts get a redirect back to the page they came from. The target is
  // picked from a fixed list, never from user input.
  const respond = (status: number, body: Record<string, unknown>) =>
    isForm
      ? new Response(null, {
          status: 303,
          headers: {
            Location: `${locale === "en" ? "/en/" : "/"}?waitlist=${status === 200 ? "ok" : "error"}#waitlist`,
            "Cache-Control": "no-store",
          },
        })
      : json(status, body);

  // Bots that fill the hidden field get the same answer as everyone else and nothing is stored.
  if (text(input.website).trim() !== "") return respond(200, { ok: true });

  const salt = env.WAITLIST_IP_SALT;
  if (!salt) {
    // Refuse to run without the secret rather than store unsalted IP hashes.
    console.error("WAITLIST_IP_SALT is not configured");
    return respond(500, { error: "server_error" });
  }

  const db = env.WAITLIST_DB;
  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";

  try {
    if (!(await underRateLimit(db, ip, salt))) return respond(429, { error: "rate_limited" });

    const email = text(input.email).trim().toLowerCase();
    if (email.length > 254 || !EMAIL_RE.test(email))
      return respond(400, { error: "invalid_email" });

    const platform = text(input.platform).trim().toLowerCase();
    if (platform !== "" && !Object.hasOwn(PLATFORMS, platform))
      return respond(400, { error: "invalid_platform" });

    const city = text(input.city)
      .replace(/\p{Cc}/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (city.length > 80) return respond(400, { error: "invalid_city" });

    // A repeat signup is a no-op and gets the normal success answer, so the form never
    // reveals who is already on the list.
    await db
      .prepare(
        "INSERT INTO waitlist (email, platform, city, locale) VALUES (?, ?, ?, ?) ON CONFLICT (email) DO NOTHING",
      )
      .bind(email, platform || null, city || null, locale)
      .run();

    return respond(200, { ok: true });
  } catch (error) {
    console.error("Waitlist signup failed:", error);
    return respond(500, { error: "server_error" });
  }
};
