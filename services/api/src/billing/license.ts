import { POLAR_PRODUCTION_URL, POLAR_SANDBOX_URL } from "./polar";

export interface LicenseEnv {
  POLAR_ACCESS_TOKEN?: string;
  POLAR_ORG_ID?: string;
  POLAR_SERVER?: string;
}

export type LicenseCheck =
  | { status: "valid"; licenseId: string }
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

  const base = env.POLAR_SERVER?.trim() === "sandbox" ? POLAR_SANDBOX_URL : POLAR_PRODUCTION_URL;
  const res = await fetchImpl(`${base}/v1/customer-portal/license-keys/validate`, {
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
  } | null;
  if (typeof body?.id !== "string" || body.status !== "granted") return { status: "invalid" };
  if (typeof body.expires_at === "string" && Date.parse(body.expires_at) <= now) {
    return { status: "invalid" };
  }
  return { status: "valid", licenseId: body.id };
}
