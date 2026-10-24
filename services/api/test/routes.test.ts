import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { api } from "./helpers";

describe("existing release routes", () => {
  it("serves /appcast.xml from the legacy DB binding", async () => {
    await env.DB.prepare(
      "INSERT INTO releases (version, short_version_string, title, description, enclosure_url, ed_signature, length, pub_date) VALUES (1, '1.0.0', 'Waqtu 1.0.0', 'First', 'https://example.test/Waqtu-1.0.0.dmg', 'SIG', 123, '2025-02-16T00:00:00.000Z')",
    ).run();
    const res = await api("/appcast.xml");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/xml");
    const xml = await res.text();
    expect(xml).toContain("<sparkle:shortVersionString>1.0.0</sparkle:shortVersionString>");
    expect(xml).toContain("https://example.test/Waqtu-1.0.0.dmg");
  });

  it("POST /license/activate without config returns the existing 500 JSON", async () => {
    const res = await api("/license/activate", { json: { key: "x", device_id: "y" } });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ valid: false, error: "License server not configured" });
  });

  it("unknown /v1 paths are 404 JSON, other paths fall through", async () => {
    const res = await api("/v1/nope");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_found" });
  });
});
