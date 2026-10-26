import { expo } from "@better-auth/expo";
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { bearer } from "better-auth/plugins";
import { deleteUserMedia } from "./circles/cleanup";
import type { AppEnv } from "./env";
import { reviewEmails } from "./reviewAccount";

export const APPLE_BUNDLE_ID = "dat.waqtu.ios";
/** Bundle id of the Mac app (direct download and Mac App Store builds share it). */
export const APPLE_MAC_BUNDLE_ID = "dat.waqtu";

const splitIds = (raw: string | undefined): string[] =>
  (raw ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

export function createAuth(env: AppEnv) {
  const isProduction = env.ENVIRONMENT === "production";

  // Native id-token sign-in only verifies the token against the app bundle ids (iOS and Mac), so
  // no client secret is needed; the secret is only used by Apple's web redirect flow, which the
  // apps do not use.
  const apple = env.APPLE_CLIENT_ID
    ? {
        clientId: env.APPLE_CLIENT_ID,
        appBundleIdentifier: APPLE_BUNDLE_ID,
        audience: [APPLE_BUNDLE_ID, APPLE_MAC_BUNDLE_ID],
      }
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

  // Email + password exists only for store reviewer accounts, which the `review-account` workflow
  // creates: no sign-up, and sign-in is refused for any address outside REVIEW_ACCOUNT_EMAILS (same
  // error as a wrong password), so a credential row for anyone else is useless.
  const reviewers = reviewEmails(env.REVIEW_ACCOUNT_EMAILS);
  const onlyReviewers = createAuthMiddleware(async (ctx) => {
    if (ctx.path !== "/sign-in/email") return;
    const email: unknown = ctx.body?.email;
    if (typeof email !== "string" || !reviewers.has(email.trim().toLowerCase())) {
      throw new APIError("UNAUTHORIZED", {
        code: "INVALID_EMAIL_OR_PASSWORD",
        message: "Invalid email or password",
      });
    }
  });

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
    emailAndPassword: { enabled: true, disableSignUp: true },
    hooks: { before: onlyReviewers },
    user: {
      deleteUser: {
        enabled: true,
        // Voice notes live in R2, outside the foreign-key cascade: remove them while the rows that
        // name them still exist.
        beforeDelete: async (user) => {
          await deleteUserMedia(env, user.id);
        },
      },
    },
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
