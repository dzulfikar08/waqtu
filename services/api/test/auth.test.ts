import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { APPLE_BUNDLE_ID, createAuth } from "../src/auth";

async function providers(overrides: Partial<typeof env> = {}) {
  const context = await createAuth({ ...env, ...overrides }).$context;
  return new Map(context.socialProviders.map((p) => [p.id, p]));
}

describe("social providers", () => {
  it("registers Apple with only APPLE_CLIENT_ID and verifies id tokens against the bundle id", async () => {
    const apple = (await providers()).get("apple");
    expect(apple).toBeDefined();
    expect(apple?.options?.clientSecret).toBeUndefined();
    expect(apple?.idToken).toMatchObject({
      issuer: "https://appleid.apple.com",
      audience: APPLE_BUNDLE_ID,
    });
    expect(APPLE_BUNDLE_ID).toBe("dat.waqtu.ios");
  });

  it("accepts the web, Android and iOS Google client ids as id-token audiences", async () => {
    const google = (await providers()).get("google");
    expect(google?.idToken).toMatchObject({
      audience: [
        "web-client.apps.googleusercontent.com",
        "android-client.apps.googleusercontent.com",
        "ios-client.apps.googleusercontent.com",
      ],
    });
  });

  it("uses only the web client id when GOOGLE_EXTRA_CLIENT_IDS is unset or blank", async () => {
    for (const GOOGLE_EXTRA_CLIENT_IDS of [undefined, " , "]) {
      const google = (await providers({ GOOGLE_EXTRA_CLIENT_IDS })).get("google");
      expect(google?.idToken).toMatchObject({
        audience: ["web-client.apps.googleusercontent.com"],
      });
    }
  });

  it("registers providers only when configured", async () => {
    const none = await providers({
      APPLE_CLIENT_ID: undefined,
      GOOGLE_CLIENT_SECRET: undefined,
    });
    expect(none.has("apple")).toBe(false);
    expect(none.has("google")).toBe(false);
  });
});
