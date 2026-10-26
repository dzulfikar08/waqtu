import { hashPassword } from "better-auth/crypto";
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import {
  REVIEW_PREMIUM_EXPIRES_AT,
  reviewAccountStatements,
  reviewEmails,
} from "../src/reviewAccount";
import { api } from "./helpers";

// The same steps as .github/workflows/review-account.yml: better-auth's own hash, then the statements.
async function provision(email: string, password: string) {
  const statements = reviewAccountStatements({
    email,
    passwordHash: await hashPassword(password),
    newUserId: crypto.randomUUID().replaceAll("-", ""),
    newAccountId: crypto.randomUUID().replaceAll("-", ""),
    now: Date.now(),
  });
  await env.APP_DB.batch(statements.map((sql) => env.APP_DB.prepare(sql)));
}

const signIn = (email: string, password: string) =>
  api("/api/auth/sign-in/email", { json: { email, password } });

function sessionCookie(res: Response): string {
  const match = /better-auth\.session_token=[^;]+/.exec(res.headers.get("set-cookie") ?? "");
  if (!match) throw new Error("no session cookie");
  return match[0];
}

describe("reviewEmails", () => {
  it("parses a comma-separated, case-insensitive list", () => {
    expect([...reviewEmails(" A@x.test, b@X.test ,,")]).toEqual(["a@x.test", "b@x.test"]);
    expect(reviewEmails(undefined).size).toBe(0);
    expect(reviewEmails(" ").size).toBe(0);
  });
});

describe("reviewAccountStatements", () => {
  it("refuses anything that is not an email or a better-auth hash", () => {
    const base = { passwordHash: "ab:cd", newUserId: "u", newAccountId: "a", now: 0 };
    expect(() => reviewAccountStatements({ ...base, email: "x' OR 1=1 --" })).toThrow();
    expect(() =>
      reviewAccountStatements({ ...base, email: "review@x.test", passwordHash: "plain" }),
    ).toThrow();
  });
});

describe("reviewer email sign-in", () => {
  it("signs the reviewer in and reports premium from the review entitlement", async () => {
    await provision("review@example.test", "correct horse battery");
    const res = await signIn("Review@Example.test", "correct horse battery");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { token: string; user: { email: string; name: string } };
    expect(body.user).toMatchObject({ email: "review@example.test", name: "Waqtu Review" });
    expect(body.token).toBeTruthy();

    const entitlement = await api("/v1/entitlement", { headers: { cookie: sessionCookie(res) } });
    expect(await entitlement.json()).toEqual({
      premium: true,
      source: "review",
      expiresAt: new Date(REVIEW_PREMIUM_EXPIRES_AT).toISOString(),
    });
  });

  it("refuses a wrong password", async () => {
    await provision("second-reviewer@example.test", "first password here");
    expect((await signIn("second-reviewer@example.test", "not the password")).status).toBe(401);
  });

  it("rotating the password keeps one user and one credential account", async () => {
    await provision("second-reviewer@example.test", "old password value");
    await provision("second-reviewer@example.test", "new password value");
    expect((await signIn("second-reviewer@example.test", "old password value")).status).toBe(401);
    expect((await signIn("second-reviewer@example.test", "new password value")).status).toBe(200);
    const counts = await env.APP_DB.prepare(
      `SELECT (SELECT COUNT(*) FROM "user" WHERE email = ?1) AS users,
              (SELECT COUNT(*) FROM account a JOIN "user" u ON u.id = a.userId
                 WHERE u.email = ?1 AND a.providerId = 'credential') AS accounts,
              (SELECT COUNT(*) FROM entitlement e JOIN "user" u ON u.id = e.user_id
                 WHERE u.email = ?1 AND e.source = 'review') AS entitlements`,
    )
      .bind("second-reviewer@example.test")
      .first<{ users: number; accounts: number; entitlements: number }>();
    expect(counts).toEqual({ users: 1, accounts: 1, entitlements: 1 });
  });

  it("refuses an email outside REVIEW_ACCOUNT_EMAILS even with a valid credential row", async () => {
    await provision("someone@example.test", "a valid password");
    const res = await signIn("someone@example.test", "a valid password");
    expect(res.status).toBe(401);
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("refuses sign-up", async () => {
    const res = await api("/api/auth/sign-up/email", {
      json: { email: "review@example.test", password: "another password", name: "x" },
    });
    expect(res.status).toBe(400);
    const res2 = await api("/api/auth/sign-up/email", {
      json: { email: "new-person@example.test", password: "another password", name: "x" },
    });
    expect(res2.status).toBe(400);
    const row = await env.APP_DB.prepare('SELECT 1 FROM "user" WHERE email = ?1')
      .bind("new-person@example.test")
      .first();
    expect(row).toBeNull();
  });
});
