import { parseEntitlement, type Entitlement } from "./entitlement";

/** Error codes the premium endpoints answer with (`{ error }`), plus transport failures. */
export type PremiumErrorCode =
  | "unauthorized"
  | "linked_to_other_account"
  | "invalid_receipt"
  | "invalid_license"
  | "license_unreachable"
  | "google_unreachable"
  | "unavailable"
  | "network"
  | "unknown";

export class PremiumApiError extends Error {
  constructor(
    readonly code: PremiumErrorCode,
    readonly status: number,
  ) {
    super(`premium request failed: ${code} (${status})`);
    this.name = "PremiumApiError";
  }
}

const KNOWN_CODES: readonly PremiumErrorCode[] = [
  "unauthorized",
  "linked_to_other_account",
  "invalid_receipt",
  "invalid_license",
  "license_unreachable",
  "google_unreachable",
  "unavailable",
];

/** Talks to `/v1/entitlement` and `/v1/billing/*` of services/api with the better-auth session cookie. */
export interface PremiumApi {
  getEntitlement(): Promise<Entitlement>;
  /** StoreKit 2 signed transaction (JWS) from a purchase or restore. */
  submitApple(signedTransaction: string): Promise<Entitlement>;
  /** Play purchase token; the server re-reads it from Google. `pending` = not charged yet. */
  submitGoogle(purchaseToken: string): Promise<Entitlement & { pending: boolean }>;
  /** Mac lifetime license key. */
  linkLicense(key: string): Promise<Entitlement>;
}

export function createPremiumApi(baseUrl: string, getCookie: () => Promise<string>): PremiumApi {
  const root = baseUrl.replace(/\/+$/, "");

  async function call(path: string, body?: unknown): Promise<unknown> {
    const cookie = await getCookie();
    let res: Response;
    try {
      res = await fetch(`${root}${path}`, {
        method: body === undefined ? "GET" : "POST",
        credentials: "omit",
        headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch {
      throw new PremiumApiError("network", 0);
    }
    const payload: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const code =
        typeof payload === "object" && payload !== null
          ? (payload as { error?: unknown }).error
          : undefined;
      throw new PremiumApiError(KNOWN_CODES.find((c) => c === code) ?? "unknown", res.status);
    }
    return payload;
  }

  const entitlement = async (path: string, body?: unknown): Promise<Entitlement> => {
    const parsed = parseEntitlement(await call(path, body));
    if (!parsed) throw new PremiumApiError("unknown", 200);
    return parsed;
  };

  return {
    getEntitlement: () => entitlement("/v1/entitlement"),
    submitApple: (signedTransaction) => entitlement("/v1/billing/apple", { signedTransaction }),
    submitGoogle: async (purchaseToken) => {
      const payload = await call("/v1/billing/google", { purchaseToken });
      const parsed = parseEntitlement(payload);
      if (!parsed) throw new PremiumApiError("unknown", 200);
      return { ...parsed, pending: (payload as { pending?: unknown }).pending === true };
    },
    linkLicense: (key) => entitlement("/v1/entitlement/link-license", { key }),
  };
}
