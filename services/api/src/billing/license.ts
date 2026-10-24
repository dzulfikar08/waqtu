import { findEntitlement, writeEntitlement, type StoredEntitlement } from "./entitlement";
import { POLAR_PRODUCTION_URL, POLAR_SANDBOX_URL } from "./polar";

export interface LicenseEnv {
  POLAR_ACCESS_TOKEN?: string;
  POLAR_ORG_ID?: string;
  POLAR_SERVER?: string;
}

/** A linked key is confirmed with Polar again when the last confirmation is older than this. */
export const LICENSE_RECHECK_MS = 7 * 24 * 60 * 60 * 1000;
/** After Polar could not be reached, the next attempt waits this long instead of hitting it on every read. */
export const LICENSE_RETRY_MS = 60 * 60 * 1000;

const baseUrl = (env: LicenseEnv): string =>
  env.POLAR_SERVER?.trim() === "sandbox" ? POLAR_SANDBOX_URL : POLAR_PRODUCTION_URL;

export type LicenseCheck =
  | { status: "valid"; licenseId: string; customerId: string | null }
  | { status: "invalid" }
  | { status: "unavailable" };

/**
 * Asks Polar whether a Mac license key is a live, granted key of the Waqtu organisation. No device
 * activation is involved: linking a key to an account is not a device seat. A revoked or disabled
 * key (refunded order) and an expired one are invalid; an unreachable or misconfigured Polar is
 * "unavailable" so the caller can tell the user to retry instead of rejecting a good key.
 */
export async function checkLicenseKey(
  env: LicenseEnv,
  key: string,
  fetchImpl: typeof fetch,
  now: number,
): Promise<LicenseCheck> {
  const token = env.POLAR_ACCESS_TOKEN?.trim();
  const orgId = env.POLAR_ORG_ID?.trim();
  if (!token || !orgId) return { status: "unavailable" };

  const res = await fetchImpl(`${baseUrl(env)}/v1/customer-portal/license-keys/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ key, organization_id: orgId }),
  });
  if (res.status === 404 || res.status === 422) return { status: "invalid" };
  if (!res.ok) return { status: "unavailable" };

  const body = (await res.json().catch(() => null)) as {
    id?: unknown;
    status?: unknown;
    expires_at?: unknown;
    customer_id?: unknown;
  } | null;
  if (typeof body?.id !== "string" || body.status !== "granted") return { status: "invalid" };
  if (typeof body.expires_at === "string" && Date.parse(body.expires_at) <= now) {
    return { status: "invalid" };
  }
  return {
    status: "valid",
    licenseId: body.id,
    customerId: typeof body.customer_id === "string" ? body.customer_id : null,
  };
}

export type LicenseStatus = "granted" | "revoked" | "unavailable";

/**
 * Current state of a stored key by its Polar id (`GET /v1/license-keys/{id}`, which needs the
 * `license_keys:read` scope on POLAR_ACCESS_TOKEN). The key string itself is never stored, so the
 * public validate call cannot be used for a later check. A key Polar no longer knows is revoked;
 * anything that is not a clear answer (outage, missing scope) is "unavailable" and changes nothing.
 */
export async function fetchLicenseStatus(
  env: LicenseEnv,
  licenseId: string,
  fetchImpl: typeof fetch,
  now: number,
): Promise<LicenseStatus> {
  const token = env.POLAR_ACCESS_TOKEN?.trim();
  if (!token) return "unavailable";
  const res = await fetchImpl(`${baseUrl(env)}/v1/license-keys/${encodeURIComponent(licenseId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 404) return "revoked";
  if (!res.ok) return "unavailable";
  const body = (await res.json().catch(() => null)) as {
    status?: unknown;
    expires_at?: unknown;
  } | null;
  if (body?.status !== "granted") return body?.status ? "revoked" : "unavailable";
  if (typeof body.expires_at === "string" && Date.parse(body.expires_at) <= now) return "revoked";
  return "granted";
}

/** Ends a license's lifetime premium now (refund, revoked key). Re-linking a granted key restores it. */
export function revokeLicense(
  db: D1Database,
  row: Pick<StoredEntitlement, "user_id" | "external_id" | "product_id" | "customer_ref">,
  now: number,
) {
  return writeEntitlement(
    db,
    {
      userId: row.user_id,
      source: "license",
      externalId: row.external_id,
      productId: row.product_id,
      environment: null,
      expiresAt: now,
      revokedAt: now,
      customerRef: row.customer_ref,
      checkedAt: now,
      signedAt: now,
    },
    now,
  );
}

/**
 * Lazily re-confirms the user's lifetime license rows with Polar: rows not confirmed for
 * LICENSE_RECHECK_MS (or flagged by a refund) are looked up again; a key Polar no longer grants
 * loses premium, a granted one is stamped as confirmed. Does nothing without a Polar token, and a
 * Polar outage never takes premium away.
 */
export async function recheckLicenses(
  db: D1Database,
  env: LicenseEnv,
  userId: string,
  fetchImpl: typeof fetch,
  now: number,
): Promise<void> {
  if (!env.POLAR_ACCESS_TOKEN?.trim()) return;
  const { results } = await db
    .prepare(
      `SELECT user_id, external_id, product_id, expires_at, order_id, revoked_at, customer_ref, checked_at
       FROM entitlement
       WHERE source = 'license' AND user_id = ?1 AND revoked_at IS NULL
         AND (checked_at IS NULL OR checked_at <= ?2)`,
    )
    .bind(userId, now - LICENSE_RECHECK_MS)
    .all<StoredEntitlement>();

  for (const row of results) {
    let status: LicenseStatus;
    try {
      status = await fetchLicenseStatus(env, row.external_id, fetchImpl, now);
    } catch {
      status = "unavailable";
    }
    if (status === "revoked") {
      await revokeLicense(db, row, now);
      continue;
    }
    await writeEntitlement(
      db,
      {
        userId: row.user_id,
        source: "license",
        externalId: row.external_id,
        productId: row.product_id,
        environment: null,
        expiresAt: row.expires_at,
        customerRef: row.customer_ref,
        checkedAt: status === "granted" ? now : now - LICENSE_RECHECK_MS + LICENSE_RETRY_MS,
        signedAt: now,
      },
      now,
    );
  }
}

export type LicenseEventResult = "revoked" | "rechecked" | "ignored";

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Polar webhook events that can end a lifetime license; null for any other event type.
 * - `benefit_grant.revoked` of a license-keys benefit: Polar revoked the key (refund, chargeback,
 *   manual revoke); its row loses premium at once.
 * - `order.refunded`: flags that customer's license rows for confirmation at their next read, so
 *   the answer does not depend on whether Polar had already revoked the key when this arrived.
 */
export async function processLicenseEvent(
  db: D1Database,
  payload: unknown,
  now: number,
): Promise<LicenseEventResult | null> {
  if (!isObject(payload) || !isObject(payload.data)) return null;
  const data = payload.data;

  if (payload.type === "benefit_grant.revoked") {
    const benefit = isObject(data.benefit) ? data.benefit : {};
    const properties = isObject(data.properties) ? data.properties : {};
    if (benefit.type !== "license_keys") return "ignored";
    const licenseId = properties.license_key_id;
    if (typeof licenseId !== "string" || !licenseId) return "ignored";
    const row = await findEntitlement(db, "license", licenseId);
    if (!row) return "ignored";
    await revokeLicense(db, row, now);
    return "revoked";
  }

  if (payload.type === "order.refunded") {
    const customerId = data.customer_id;
    if (typeof customerId !== "string" || !customerId) return "ignored";
    const result = await db
      .prepare(
        "UPDATE entitlement SET checked_at = 0 WHERE source = 'license' AND customer_ref = ?1 AND revoked_at IS NULL",
      )
      .bind(customerId)
      .run();
    return result.meta.changes > 0 ? "rechecked" : "ignored";
  }
  return null;
}
