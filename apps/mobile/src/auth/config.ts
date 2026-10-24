/** Base URL of the better-auth server. Sign-in is hidden when it is not set. */
export const API_URL: string | null = process.env.EXPO_PUBLIC_API_URL?.trim() || null;

export const AUTH_CONFIGURED = API_URL !== null;
