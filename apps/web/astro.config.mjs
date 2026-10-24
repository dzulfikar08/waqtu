// @ts-check
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import sitemap from "@astrojs/sitemap";
import mdx from "@astrojs/mdx";
import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
  site: "https://getwaqtu.com",
  // Static output: the whole site prerenders at build time, except the Polar payment
  // endpoints and /api/waitlist, which opt out with `export const prerender = false`.
  output: "static",
  adapter: cloudflare({
    imageService: "passthrough",
    configPath: "./wrangler.jsonc",
  }),
  integrations: [
    mdx(),
    // `/` is Indonesian and `/en/` is English; the sitemap pairs them as hreflang alternates.
    sitemap({ i18n: { defaultLocale: "id", locales: { id: "id-ID", en: "en-US" } } }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
