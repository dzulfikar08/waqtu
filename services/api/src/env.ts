import type { GooglePlayEnv } from "./billing/google";
import type { PolarEnv } from "./billing/polar";

export interface AppEnv extends GooglePlayEnv, PolarEnv {
  APP_DB: D1Database;
  /** R2 bucket `waqtu-circle-media`: circle voice notes. */
  CIRCLE_MEDIA: R2Bucket;
  /** Comma-separated better-auth user ids allowed to use `/v1/admin/circles/*` and `/v1/admin/errors`. A secret; unset means no admins. */
  ADMIN_USER_IDS?: string;
  /** "true" makes circles premium: `/v1/circles/config` reports `requiresPremium: true` and the API refuses joins/posts without premium (403 premium_required). */
  CIRCLES_REQUIRES_PREMIUM?: string;
  ENVIRONMENT?: string;
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
  /** Comma-separated emails of store reviewer accounts, the only ones allowed to sign in with email + password. Plain var in wrangler.toml. */
  REVIEW_ACCOUNT_EMAILS?: string;
  /** Enables native Sign in with Apple. The id-token audience is APPLE_BUNDLE_ID, not this value. */
  APPLE_CLIENT_ID?: string;
  /** App Store numeric app id of the iPhone app (6826628861); its Production server notifications must carry it. */
  APPLE_APP_ID?: string;
  /** App Store numeric app id of the Mac App Store app (bundle dat.waqtu); same check for its notifications. */
  APPLE_MAC_APP_ID?: string;
  /** Web client id: primary client for the OAuth redirect flow and an accepted id-token audience. */
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  /** Comma-separated extra Google client ids (Android, iOS) accepted as id-token audiences. */
  GOOGLE_EXTRA_CLIENT_IDS?: string;
}
