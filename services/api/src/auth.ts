import { expo } from "@better-auth/expo";
import { betterAuth } from "better-auth";
import { bearer } from "better-auth/plugins";
import type { AppEnv } from "./env";

export const APPLE_BUNDLE_ID = "dat.waqtu.ios";

const splitIds = (raw: string | undefined): string[] =>
  (raw ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

export function createAuth(env: AppEnv) {
  const isProduction = env.ENVIRONMENT === "production";

  // Native id-token sign-in only verifies the token against the bundle id, so no client secret is
  // needed; the secret is only used by Apple's web redirect flow, which the app does not use.
  const apple = env.APPLE_CLIENT_ID
    ? { clientId: env.APPLE_CLIENT_ID, appBundleIdentifier: APPLE_BUNDLE_ID }
    : undefined;

  // The first id is the web client (redirect flow, token exchange); every id is an accepted
  // `aud` for native id-token sign-in.
  const google =
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? {
          clientId: [env.GOOGLE_CLIENT_ID, ...splitIds(env.GOOGLE_EXTRA_CLIENT_IDS)],
          clientSecret: env.GOOGLE_CLIENT_SECRET,
        }
      : undefined;

  const trustedOrigins = ["waqtu://", "waqtu://*"];
  if (!isProduction) trustedOrigins.push("exp://", "exp://**");

  return betterAuth({
    database: env.APP_DB,
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    basePath: "/api/auth",
    trustedOrigins,
    socialProviders: {
      ...(apple ? { apple } : {}),
      ...(google ? { google } : {}),
    },
    user: { deleteUser: { enabled: true } },
    plugins: [expo(), bearer()],
  });
}

export type Auth = ReturnType<typeof createAuth>;

const cache = new WeakMap<D1Database, Auth>();

/** better-auth instances are cheap to keep per isolate; the D1 binding identifies the env. */
export function getAuth(env: AppEnv): Auth {
  let auth = cache.get(env.APP_DB);
  if (!auth) {
    auth = createAuth(env);
    cache.set(env.APP_DB, auth);
  }
  return auth;
}
