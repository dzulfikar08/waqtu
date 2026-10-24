import type { PullPage, SyncTransport } from "../mutabaah/syncEngine";

export class SyncHttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "SyncHttpError";
  }
}

/** The signed-in session is no longer valid; the caller should stop syncing until the next sign-in. */
export const isUnauthorized = (e: unknown): boolean =>
  e instanceof SyncHttpError && e.status === 401;

/** `/v1/sync` of services/api. `getCookie` yields the better-auth session cookie header value. */
export function createTransport(baseUrl: string, getCookie: () => Promise<string>): SyncTransport {
  const url = `${baseUrl.replace(/\/+$/, "")}/v1/sync`;

  async function call<T>(init: RequestInit, query = ""): Promise<T> {
    const cookie = await getCookie();
    const res = await fetch(url + query, {
      ...init,
      credentials: "omit",
      headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    });
    if (!res.ok)
      throw new SyncHttpError(res.status, `Sync ${init.method ?? "GET"} failed: ${res.status}`);
    return (await res.json()) as T;
  }

  return {
    pull: (since, limit) =>
      call<PullPage>({ method: "GET" }, `?since=${encodeURIComponent(since)}&limit=${limit}`),
    push: async (entries, settings) => {
      await call({ method: "POST", body: JSON.stringify({ entries, settings }) });
    },
  };
}
