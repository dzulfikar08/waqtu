import { SyncHttpError } from "../sync/transport";
import type { MuhasabahTransport, PullPage, WireEntry } from "./cloud";

/** One call to `/v1/muhasabah` of services/api. `getCookie` yields the better-auth session cookie header value. */
async function call<T>(
  baseUrl: string,
  getCookie: () => Promise<string>,
  init: RequestInit,
  query = "",
): Promise<T> {
  const cookie = await getCookie();
  const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/v1/muhasabah${query}`, {
    ...init,
    credentials: "omit",
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
  });
  if (!res.ok) {
    throw new SyncHttpError(res.status, `Muhasabah ${init.method ?? "GET"} failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

export function createMuhasabahTransport(
  baseUrl: string,
  getCookie: () => Promise<string>,
): MuhasabahTransport {
  return {
    pull: (since, limit) =>
      call<PullPage>(
        baseUrl,
        getCookie,
        { method: "GET" },
        `?since=${encodeURIComponent(since)}&limit=${limit}`,
      ),
    push: async (entries: WireEntry[]) => {
      await call(baseUrl, getCookie, { method: "POST", body: JSON.stringify({ entries }) });
    },
  };
}

/** Removes the signed-in account's whole cloud journal (entries and deletion markers). Throws when it fails. */
export async function deleteCloudCopy(
  baseUrl: string,
  getCookie: () => Promise<string>,
): Promise<void> {
  await call(baseUrl, getCookie, { method: "DELETE" });
}
