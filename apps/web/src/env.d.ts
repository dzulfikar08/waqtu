/// <reference path="../.astro/types.d.ts" />

interface ImportMetaEnv {
  readonly PUBLIC_DOWNLOAD_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare namespace Cloudflare {
  interface Env {
    POLAR_ACCESS_TOKEN?: string;
    POLAR_WEBHOOK_SECRET?: string;
    POLAR_PRODUCT_PRO_LIFETIME?: string;
    POLAR_PRODUCT_PRO_MONTHLY?: string;
    PUBLIC_CLIENT_URL?: string;
    NEXT_PUBLIC_CLIENT_URL?: string;
    WAITLIST_DB: D1Database;
    /** Secret mixed into the IP hash used for waitlist rate limiting. The endpoint refuses to run without it. */
    WAITLIST_IP_SALT?: string;
  }
}
