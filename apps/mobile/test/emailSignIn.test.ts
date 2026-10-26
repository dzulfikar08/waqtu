import { describe, expect, test } from "bun:test";

import { emailCredentials, emailSignInProblem } from "../src/auth/emailSignIn";
import { parseEntitlement } from "../src/premium/entitlement";

describe("reviewer email sign-in", () => {
  test("normalizes the email and keeps the password as typed", () => {
    expect(emailCredentials("  Review@GetWaqtu.com ", " Pass word ")).toEqual({
      email: "review@getwaqtu.com",
      password: " Pass word ",
    });
  });

  test("needs an email and a password", () => {
    expect(emailCredentials("", "secret")).toBeNull();
    expect(emailCredentials("review", "secret")).toBeNull();
    expect(emailCredentials("review@getwaqtu.com", "")).toBeNull();
  });

  test("maps server errors to what the reviewer sees", () => {
    expect(emailSignInProblem({ status: 401, code: "INVALID_EMAIL_OR_PASSWORD" })).toBe("invalid");
    expect(emailSignInProblem({ status: 400, code: "INVALID_EMAIL" })).toBe("invalid");
    expect(emailSignInProblem({ status: 429 })).toBe("rateLimited");
    expect(emailSignInProblem({ status: 500 })).toBe("failed");
    expect(emailSignInProblem({})).toBe("failed");
  });

  test("the review entitlement counts as premium", () => {
    const value = { premium: true, source: "review", expiresAt: "2100-01-01T00:00:00.000Z" };
    expect(parseEntitlement(value)).toEqual(value);
  });
});
