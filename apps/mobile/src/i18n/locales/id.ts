import { ramadhanId } from "@/ramadhan/strings";

export const id = {
  tabs: { today: "Hari ini", settings: "Pengaturan" },
  today: { hijri: "Hijriah" },
  settings: {
    language: "Bahasa",
    languageAuto: "Otomatis (ikuti ponsel)",
    notifications: "Notifikasi adzan",
    notificationsGranted: "Diizinkan",
    notificationsAsk: "Izinkan notifikasi",
    notificationsOpenSettings: "Buka pengaturan sistem",
    account: "Akun",
    signedInAs: "Masuk sebagai {{name}}",
    signInApple: "Masuk dengan Apple",
    signInGoogle: "Masuk dengan Google",
    signOut: "Keluar",
    signInFailed: "Gagal masuk. Coba lagi.",
  },
  ramadhan: ramadhanId,
} as const;
