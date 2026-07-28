/// <reference path="../.astro/types.d.ts" />

interface ImportMetaEnv {
  readonly PUBLIC_POLAR_PRODUCT_PRO_LIFETIME?: string;
  readonly PUBLIC_POLAR_PRODUCT_PRO_MONTHLY?: string;
  readonly PUBLIC_DOWNLOAD_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
