// @ts-check
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import sitemap from "@astrojs/sitemap";
import mdx from "@astrojs/mdx";
import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
  site: "https://getwaqtu.com",
  // Static output: the whole site prerenders at build time, except the two
  // Polar payment endpoints which opt out with `export const prerender = false`.
  output: "static",
  adapter: cloudflare({
    imageService: "passthrough",
    platformProxy: { enabled: true },
    configPath: "./wrangler.jsonc",
  }),
  integrations: [mdx(), sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
});
