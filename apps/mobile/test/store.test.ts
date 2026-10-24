import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const STORE = join(import.meta.dir, "..", "store");
const LOCALES = ["id", "en"] as const;

const read = (path: string) => readFileSync(join(STORE, path), "utf8").replace(/\n$/, "");
const length = (text: string) => [...text].length;

const LIMITS = {
  "appstore/{l}/name.txt": 30,
  "appstore/{l}/subtitle.txt": 30,
  "appstore/{l}/promotional_text.txt": 170,
  "appstore/{l}/description.txt": 4000,
  "appstore/{l}/keywords.txt": 100,
  "play/{l}/title.txt": 30,
  "play/{l}/short_description.txt": 80,
  "play/{l}/full_description.txt": 4000,
} as const;

describe("store metadata", () => {
  for (const locale of LOCALES) {
    for (const [template, max] of Object.entries(LIMITS)) {
      const path = template.replace("{l}", locale);
      test(`${path} fits ${max} characters`, () => {
        const text = read(path);
        expect(length(text)).toBeGreaterThan(0);
        expect(length(text)).toBeLessThanOrEqual(max);
        expect(text).not.toContain("\u2014");
      });
    }

    test(`${locale} URLs are on getwaqtu.com`, () => {
      for (const file of ["support_url", "marketing_url", "privacy_url"]) {
        const url = new URL(read(`appstore/${locale}/${file}.txt`));
        expect(url.protocol).toBe("https:");
        expect(url.hostname).toBe("getwaqtu.com");
      }
    });

    test(`${locale} keywords are comma separated without spaces and skip the app name`, () => {
      const keywords = read(`appstore/${locale}/keywords.txt`);
      expect(keywords).not.toMatch(/[\s,]{2}|^,|,$| /);
      expect(keywords.toLowerCase()).not.toContain("waqtu");
    });
  }

  test("review notes promise no demo credentials", () => {
    expect(read("appstore/review_notes.txt")).toContain("no demo credentials");
  });
});
