export interface AppEnv {
  APP_DB: D1Database;
  /** R2 bucket `waqtu-circle-media`: circle voice notes. */
  CIRCLE_MEDIA: R2Bucket;
  /** Comma-separated better-auth user ids allowed to use `/v1/admin/circles/*`. A secret; unset means no admins. */
  ADMIN_USER_IDS?: string;
  /** "true" makes `/v1/circles/config` report `requiresPremium: true`. Entitlement checks belong to DEV-12. */
  CIRCLES_REQUIRES_PREMIUM?: string;
  ENVIRONMENT?: string;
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
  /** Enables native Sign in with Apple. The id-token audience is APPLE_BUNDLE_ID, not this value. */
  APPLE_CLIENT_ID?: string;
  /** Web client id: primary client for the OAuth redirect flow and an accepted id-token audience. */
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  /** Comma-separated extra Google client ids (Android, iOS) accepted as id-token audiences. */
  GOOGLE_EXTRA_CLIENT_IDS?: string;
}
