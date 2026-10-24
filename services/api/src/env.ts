export interface AppEnv {
  APP_DB: D1Database;
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
