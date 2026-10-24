import { expoClient } from "@better-auth/expo/client";
import { createAuthClient } from "better-auth/react";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";

import { API_URL } from "./config";

const scheme =
  typeof Constants.expoConfig?.scheme === "string" ? Constants.expoConfig.scheme : "waqtu";

function create(baseURL: string) {
  return createAuthClient({
    baseURL,
    plugins: [expoClient({ scheme, storagePrefix: "waqtu", storage: SecureStore })],
  });
}

export type AuthClient = ReturnType<typeof create>;

/** better-auth client; null when `EXPO_PUBLIC_API_URL` is not set. Cookies live in the Keystore/Keychain. */
export const authClient: AuthClient | null = API_URL ? create(API_URL) : null;
