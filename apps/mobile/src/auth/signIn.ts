import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import { Platform } from "react-native";

import type { AuthClient } from "./client";

function isCanceled(e: unknown): boolean {
  const code =
    typeof e === "object" && e !== null && "code" in e ? (e as { code?: unknown }).code : undefined;
  return code === "ERR_REQUEST_CANCELED" || code === "ERR_CANCELED";
}

export const appleSignInAvailable = (): Promise<boolean> =>
  Platform.OS === "ios"
    ? AppleAuthentication.isAvailableAsync().catch(() => false)
    : Promise.resolve(false);

/** Native Sign in with Apple; the server verifies the identity token. False when the sheet was closed. */
export async function signInWithApple(client: AuthClient): Promise<boolean> {
  try {
    const rawNonce = Crypto.randomUUID();
    const hashedNonce = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      rawNonce,
    );
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
    if (!credential.identityToken) throw new Error("Apple returned no identity token");
    const { givenName, familyName } = credential.fullName ?? {};
    const { error } = await client.signIn.social({
      provider: "apple",
      idToken: {
        token: credential.identityToken,
        nonce: rawNonce,
        ...(givenName || familyName
          ? {
              user: {
                name: { firstName: givenName ?? undefined, lastName: familyName ?? undefined },
              },
            }
          : {}),
      },
    });
    if (error) throw new Error(error.message || "Apple sign-in failed");
    return true;
  } catch (e) {
    if (isCanceled(e)) return false;
    throw e;
  }
}

/** Google through the server's OAuth flow in the system browser (the expo client handles the redirect). */
export async function signInWithGoogle(client: AuthClient): Promise<void> {
  const { error } = await client.signIn.social({ provider: "google", callbackURL: "/" });
  if (error) throw new Error(error.message || "Google sign-in failed");
}
