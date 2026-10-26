// Email + password sign-in exists only for store reviewer accounts (Google Play, App Store): the server
// has no sign-up and refuses every email outside its REVIEW_ACCOUNT_EMAILS list.

export type EmailSignInProblem = "missing" | "invalid" | "rateLimited" | "failed";

/** Trimmed, lowercased email and the password as typed; null when either is empty or the email has no `@`. */
export function emailCredentials(
  email: string,
  password: string,
): { email: string; password: string } | null {
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes("@") || password.length === 0) return null;
  return { email: normalized, password };
}

/** What a failed `signIn.email` (better-auth client error: HTTP status plus error code) means to the user. */
export function emailSignInProblem(error: {
  status?: number;
  code?: string;
}): Exclude<EmailSignInProblem, "missing"> {
  if (error.status === 429) return "rateLimited";
  if (
    error.status === 401 ||
    error.code === "INVALID_EMAIL_OR_PASSWORD" ||
    error.code === "INVALID_EMAIL"
  ) {
    return "invalid";
  }
  return "failed";
}
