import path from "node:path";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.toml" },
      miniflare: {
        bindings: {
          ENVIRONMENT: "test",
          ADMIN_USER_IDS: "admin-circles-test, someone-else",
          BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-0123",
          BETTER_AUTH_URL: "http://localhost",
          APPLE_CLIENT_ID: "dat.waqtu.ios",
          GOOGLE_CLIENT_ID: "web-client.apps.googleusercontent.com",
          GOOGLE_CLIENT_SECRET: "test-google-secret",
          GOOGLE_EXTRA_CLIENT_IDS:
            "android-client.apps.googleusercontent.com, ios-client.apps.googleusercontent.com",
          TEST_MIGRATIONS: await readD1Migrations(path.join(import.meta.dirname, "migrations")),
        },
      },
    }),
  ],
  test: { setupFiles: ["./test/setup.ts"] },
});
