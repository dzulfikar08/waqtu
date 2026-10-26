// Store reviewer accounts (Google Play, App Store). They are the only accounts that sign in with email
// + password: nobody can sign up that way, and the server refuses email sign-in for any address not in
// REVIEW_ACCOUNT_EMAILS. The `review-account` workflow creates the account with the SQL below.
//
// No imports and only erasable TypeScript: the workflow runs this file with plain `node` (type stripping).

/** Premium for a reviewer account ends 2100-01-01 UTC. */
export const REVIEW_PREMIUM_EXPIRES_AT = Date.UTC(2100, 0, 1);

/** The REVIEW_ACCOUNT_EMAILS var as a lowercase set; unset or blank means no reviewer can sign in. */
export function reviewEmails(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

const EMAIL = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]+$/;

const quote = (value: string): string => `'${value.replaceAll("'", "''")}'`;

export interface ReviewAccountInput {
  email: string;
  /** better-auth `hashPassword` output for the credential account. */
  passwordHash: string;
  /** Used only when the user row does not exist yet. */
  newUserId: string;
  newAccountId: string;
  now: number;
}

/**
 * Idempotent statements that create or refresh a reviewer: the `user` row (kept when it exists, so its
 * id and data survive a password rotation), exactly one `credential` account carrying the password
 * hash, and a `review` entitlement that `/v1/entitlement` reports as premium.
 */
export function reviewAccountStatements(input: ReviewAccountInput): string[] {
  const email = input.email.trim().toLowerCase();
  if (!EMAIL.test(email)) throw new Error(`not an email: ${email}`);
  if (!/^[0-9a-f]+:[0-9a-f]+$/.test(input.passwordHash)) throw new Error("unexpected password hash");
  const iso = quote(new Date(input.now).toISOString());
  const userId = `(SELECT id FROM "user" WHERE email = ${quote(email)})`;
  return [
    `INSERT INTO "user" (id, name, email, emailVerified, createdAt, updatedAt) VALUES (${quote(input.newUserId)}, 'Waqtu Review', ${quote(email)}, 1, ${iso}, ${iso}) ON CONFLICT (email) DO UPDATE SET name = excluded.name, emailVerified = 1, updatedAt = excluded.updatedAt;`,
    `DELETE FROM account WHERE providerId = 'credential' AND userId = ${userId};`,
    `INSERT INTO account (id, accountId, providerId, userId, password, createdAt, updatedAt) SELECT ${quote(input.newAccountId)}, id, 'credential', id, ${quote(input.passwordHash)}, ${iso}, ${iso} FROM "user" WHERE email = ${quote(email)};`,
    `INSERT INTO entitlement (source, external_id, user_id, product_id, environment, expires_at, order_id, revoked_at, signed_at, created_at, updated_at) SELECT 'review', id, id, NULL, NULL, ${REVIEW_PREMIUM_EXPIRES_AT}, NULL, NULL, ${input.now}, ${input.now}, ${input.now} FROM "user" WHERE email = ${quote(email)} ON CONFLICT (source, external_id) DO UPDATE SET expires_at = excluded.expires_at, revoked_at = NULL, signed_at = excluded.signed_at, updated_at = excluded.updated_at;`,
  ];
}
