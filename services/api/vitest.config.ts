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
          // Production makes circles premium (wrangler.toml); most circle tests exercise the circles
          // themselves with free accounts, and the premium gate tests turn the flag on explicitly.
          CIRCLES_REQUIRES_PREMIUM: "false",
          ADMIN_USER_IDS: "admin-circles-test, someone-else",
          BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-0123",
          BETTER_AUTH_URL: "http://localhost",
          APPLE_CLIENT_ID: "dat.waqtu.ios",
          REVIEW_ACCOUNT_EMAILS: "review@example.test, Second-Reviewer@Example.test",
          GOOGLE_CLIENT_ID: "web-client.apps.googleusercontent.com",
          GOOGLE_CLIENT_SECRET: "test-google-secret",
          GOOGLE_EXTRA_CLIENT_IDS:
            "android-client.apps.googleusercontent.com, ios-client.apps.googleusercontent.com",
          TEST_MIGRATIONS: await readD1Migrations(path.join(import.meta.dirname, "migrations")),
        },
      },
    }),
  ],
  test: {
    setupFiles: ["./test/setup.ts"],
    // better-auth 1.7.3 under workerd: a 4xx APIError thrown inside an endpoint (wrong password, sign-up
    // disabled) is answered with the right response but also surfaces as an unhandled rejection. Those
    // are expected in the reviewer sign-in tests; anything else still fails the run.
    onUnhandledError(error) {
      const { statusCode, errorStack } = error as { statusCode?: unknown; errorStack?: unknown };
      const clientError =
        typeof statusCode === "number" &&
        statusCode >= 400 &&
        statusCode < 500 &&
        typeof errorStack === "string" &&
        errorStack.startsWith("APIError");
      if (clientError) return false;
    },
  },
});
