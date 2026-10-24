export type EntitlementSource = "apple" | "google" | "polar" | "license";

const SOURCES: readonly EntitlementSource[] = ["apple", "google", "polar", "license"];

/** What `GET /v1/entitlement` returns. `expiresAt` null with `premium` true means lifetime. */
export interface Entitlement {
  premium: boolean;
  source: EntitlementSource | null;
  expiresAt: string | null;
}

/** The last entitlement the server told this phone about, kept so premium works offline. */
export interface CachedEntitlement {
  userId: string;
  entitlement: Entitlement;
  fetchedAt: number;
}

export const ENTITLEMENT_CACHE_KEY = "premium.entitlement";

export function parseEntitlement(value: unknown): Entitlement | null {
  if (typeof value !== "object" || value === null) return null;
  const { premium, source, expiresAt } = value as Record<string, unknown>;
  if (typeof premium !== "boolean") return null;
  if (source !== null && !SOURCES.some((s) => s === source)) return null;
  if (
    expiresAt !== null &&
    (typeof expiresAt !== "string" || Number.isNaN(Date.parse(expiresAt)))
  ) {
    return null;
  }
  return { premium, source: source as EntitlementSource | null, expiresAt };
}

/**
 * Premium for `userId` right now. The cached answer only counts for the account it was fetched for
 * and stops counting once its paid period has ended, so an offline phone never keeps premium past
 * the expiry the server reported. Lifetime (`expiresAt` null) never lapses.
 */
export function isPremium(
  cache: CachedEntitlement | null,
  userId: string | null,
  now: number,
): boolean {
  if (!cache || !userId || cache.userId !== userId || !cache.entitlement.premium) return false;
  const { expiresAt } = cache.entitlement;
  return expiresAt === null || Date.parse(expiresAt) > now;
}

export function serializeCache(cache: CachedEntitlement): string {
  return JSON.stringify(cache);
}

export function parseCache(raw: string | null): CachedEntitlement | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return null;
    const { userId, entitlement, fetchedAt } = value as Record<string, unknown>;
    const parsed = parseEntitlement(entitlement);
    if (typeof userId !== "string" || typeof fetchedAt !== "number" || !parsed) return null;
    return { userId, entitlement: parsed, fetchedAt };
  } catch {
    return null;
  }
}

/**
 * StoreKit `appAccountToken` for a user: the first 16 bytes of SHA-256("waqtu-apple:<userId>") as
 * a UUID, version 5 and RFC 4122 variant bits set. Must match `appleAccountToken` in
 * services/api/src/billing/apple.ts: the server refuses a transaction whose token is another
 * account's. `sha256Hex` is the 64-character hex digest of the same string.
 */
export function accountTokenFromDigest(sha256Hex: string): string {
  const bytes = sha256Hex
    .slice(0, 32)
    .match(/.{2}/g)!
    .map((pair) => Number.parseInt(pair, 16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Product ids; prices live in the stores. Must match the App Store Connect / Play Console setup. */
export const APPLE_PRODUCT_IDS = {
  monthly: "dat.waqtu.premium.monthly",
  yearly: "dat.waqtu.premium.yearly",
} as const;
export const PLAY_PRODUCT_ID = "premium";
export const PLAY_PACKAGE_NAME = "dat.waqtu.app";

export type Plan = "monthly" | "yearly";
