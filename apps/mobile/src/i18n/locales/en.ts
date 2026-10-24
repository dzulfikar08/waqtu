import type { id } from "./id";

type Widen<T> = { [K in keyof T]: T[K] extends string ? string : Widen<T[K]> };

export const en: Widen<typeof id> = {
  tabs: { today: "Today", settings: "Settings" },
  today: { hijri: "Hijri" },
  settings: {
    language: "Language",
    languageAuto: "Automatic (follow phone)",
    notifications: "Adhan notifications",
    notificationsGranted: "Allowed",
    notificationsAsk: "Allow notifications",
    notificationsOpenSettings: "Open system settings",
    account: "Account",
    signedInAs: "Signed in as {{name}}",
    signInApple: "Sign in with Apple",
    signInGoogle: "Sign in with Google",
    signOut: "Sign out",
    signInFailed: "Sign-in failed. Try again.",
  },
};
