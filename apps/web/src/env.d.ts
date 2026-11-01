/// <reference path="../.astro/types.d.ts" />

interface ImportMetaEnv {
  readonly PUBLIC_DOWNLOAD_URL?: string;
  /** "true" turns on the store badges, see src/config.ts. */
  readonly PUBLIC_STORE_BADGES_LIVE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare namespace Cloudflare {
  interface Env {
    WAITLIST_DB: D1Database;
    /** Secret mixed into the IP hash used for waitlist rate limiting. The endpoint refuses to run without it. */
    WAITLIST_IP_SALT?: string;
  }
}
