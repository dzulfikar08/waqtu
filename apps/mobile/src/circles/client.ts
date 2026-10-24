import { authClient } from "@/auth/client";
import { API_URL } from "@/auth/config";

import { createCirclesApi, type CirclesApi } from "./api";

function create(): CirclesApi | null {
  const client = authClient;
  if (!API_URL || !client) return null;
  return createCirclesApi({ baseUrl: API_URL, getCookie: () => client.getCookie() });
}

/** Circles client; null when there is no auth server, since circles need an account. */
export const circlesApi: CirclesApi | null = create();
