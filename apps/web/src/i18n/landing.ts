/**
 * Copy for the mobile-first landing pages: Indonesian at `/`, English at `/en/`.
 * Both locales share one shape so the template never branches on language.
 * `{date}` in strings is replaced with the estimated 1 Ramadhan 1448 date.
 */

export type Locale = "id" | "en";

export const REPO_URL = "https://github.com/dzulfikar08/waqtu";
export const SUPPORT_EMAIL = "dzulfikar.at@gmail.com";

export interface LandingCopy {
  htmlLang: string;
  path: string;
  meta: { title: string; description: string; keywords: string; ogImageAlt: string };
  nav: {
    features: string;
    ramadhan: string;
    privacy: string;
    faq: string;
    mac: string;
    cta: string;
    switchLabel: string;
    switchHref: string;
    menu: string;
  };
  hero: { status: string; title: string; lede: string; audience: string; target: string };
  form: {
    heading: string;
    emailLabel: string;
    emailPlaceholder: string;
    platformLabel: string;
    platformPlaceholder: string;
    platforms: { ios: string; android: string; mac: string };
    cityLabel: string;
    cityPlaceholder: string;
    submit: string;
    submitting: string;
    fine: string;
    successTitle: string;
    successBody: string;
    errors: {
      invalid_email: string;
      invalid_platform: string;
      invalid_city: string;
      rate_limited: string;
      generic: string;
    };
  };
  halaqah: { title: string; paragraphs: string[]; pull: string };
  features: {
    heading: string;
    prayer: { title: string; body: string; details: string[] };
    mutabaah: { title: string; body: string };
    halaqah: { title: string; body: string };
  };
  ramadhan: {
    eyebrow: string;
    title: string;
    units: { days: string; hours: string; minutes: string; seconds: string };
    countdownLabel: string;
    started: string;
    estimate: string;
    previewTitle: string;
    previewNote: string;
    preview: string[];
    cta: string;
  };
  privacy: {
    title: string;
    paragraphs: string[];
    github: string;
    policy: string;
  };
  mac: { title: string; body: string; cta: string };
  faq: { heading: string; items: { question: string; answer: string }[] };
  closing: { title: string; body: string };
  footer: {
    blog: string;
    resources: string;
    changelog: string;
    privacy: string;
    terms: string;
    support: string;
    github: string;
    note: string;
  };
  schema: { appDescription: string };
}

const id: LandingCopy = {
  htmlLang: "id",
  path: "/",
  meta: {
    title: "Waqtu: halaqah tanpa macet, waktu sholat, dan mutabaah harian",
    description:
      "Waqtu untuk iOS, Android, dan Mac: waktu sholat, mutabaah yaumiyah, dan halaqah asinkron untuk muslim yang sibuk atau lebih nyaman tanpa keramaian. Privasi dulu, kode terbuka. Daftar waitlist sebelum Ramadhan 1448H.",
    keywords:
      "waktu sholat, jadwal sholat, mutabaah yaumiyah, halaqah online, aplikasi ibadah harian, mode ramadhan, aplikasi muslim tanpa iklan, waqtu",
    ogImageAlt: "Waqtu: waktu sholat, mutabaah yaumiyah, dan halaqah asinkron",
  },
  nav: {
    features: "Fitur",
    ramadhan: "Ramadhan",
    privacy: "Privasi",
    faq: "FAQ",
    mac: "Mac",
    cta: "Gabung waitlist",
    switchLabel: "English",
    switchHref: "/en/",
    menu: "Menu",
  },
  hero: {
    status: "Segera di iOS dan Android. Sudah tersedia di Mac.",
    title: "Halaqah tanpa macet.",
    lede: "Waktu sholat, mutabaah yaumiyah, dan halaqah yang kamu ikuti kapan sempat. Tidak ada perjalanan, dan tidak ada rasa bersalah kalau hari ini terlewat.",
    audience:
      "Dibuat untuk muslim yang jadwalnya padat, atau yang lebih tenang beribadah tanpa keramaian.",
    target: "Target rilis: sebelum Ramadhan 1448H.",
  },
  form: {
    heading: "Dapat kabar saat Waqtu rilis",
    emailLabel: "Email",
    emailPlaceholder: "nama@email.com",
    platformLabel: "Perangkat (opsional)",
    platformPlaceholder: "Pilih perangkat",
    platforms: { ios: "iPhone (iOS)", android: "Android", mac: "Mac" },
    cityLabel: "Kota (opsional)",
    cityPlaceholder: "Contoh: Malang",
    submit: "Gabung waitlist",
    submitting: "Mengirim...",
    fine: "Email hanya dipakai untuk kabar rilis Waqtu. Tidak dijual, dan bisa kamu minta hapus kapan saja.",
    successTitle: "Kamu sudah masuk daftar.",
    successBody: "Kami kirim kabar ke emailmu begitu Waqtu siap dicoba.",
    errors: {
      invalid_email: "Email itu belum valid. Cek lagi penulisannya.",
      invalid_platform: "Pilihan perangkat tidak dikenali. Muat ulang halaman lalu coba lagi.",
      invalid_city: "Nama kota terlalu panjang. Maksimal 80 karakter.",
      rate_limited: "Terlalu banyak percobaan dari jaringanmu. Tunggu 10 menit lalu coba lagi.",
      generic: `Pendaftaran gagal. Coba lagi sebentar lagi, atau kirim email ke ${SUPPORT_EMAIL}.`,
    },
  },
  halaqah: {
    title: "Halaqah yang tidak minta kamu berangkat.",
    paragraphs: [
      "Halaqah yang baik butuh jadwal yang cocok, tempat yang terjangkau, dan tenaga untuk bertemu orang. Banyak dari kita kehabisan salah satunya, lalu berhenti datang dan merasa bersalah.",
      "Di Waqtu, halaqah berjalan asinkron. Kamu ikut dari ponsel, di jam yang kamu punya. Tidak ada pertemuan yang harus dikejar, dan tidak ada daftar siapa yang terlambat.",
    ],
    pull: "Tanpa macet. Tanpa rasa bersalah.",
  },
  features: {
    heading: "Tiga hal yang kamu pakai setiap hari",
    prayer: {
      title: "Waktu sholat dari ponselmu sendiri",
      body: "Jadwal dihitung langsung di perangkat dengan metode Kemenag RI sebagai bawaan. Jalan tanpa sinyal, dan lokasimu tidak dikirim ke server.",
      details: ["Notifikasi adzan", "Tanggal Hijriah", "Bahasa Indonesia dan English"],
    },
    mutabaah: {
      title: "Mutabaah yaumiyah",
      body: "Catat ibadah harianmu dengan beberapa ketukan, tanpa formulir panjang. Catatannya tersimpan di ponselmu dan tetap terbuka saat offline.",
    },
    halaqah: {
      title: "Halaqah asinkron",
      body: "Kelompok kecil yang saling menemani tanpa jam pertemuan. Kamu ikut saat sempat, dan tidak ada yang menghitung kamu tertinggal.",
    },
  },
  ramadhan: {
    eyebrow: "Ramadhan 1448H",
    title: "Hitung mundur menuju 1 Ramadhan",
    units: { days: "hari", hours: "jam", minutes: "menit", seconds: "detik" },
    countdownLabel: "Waktu tersisa sampai 1 Ramadhan 1448H",
    started: "Ramadhan 1448H sudah dimulai.",
    estimate:
      "Perkiraan 1 Ramadhan 1448H: {date}, menurut kalender Umm al-Qura. Di Indonesia tanggalnya mengikuti sidang isbat Kemenag, jadi bisa bergeser satu hari.",
    previewTitle: "Mode Ramadhan",
    previewNote: "Sedang kami siapkan. Belum ada yang dirilis.",
    preview: [
      "Hitung mundur imsak dan berbuka, dihitung di perangkatmu",
      "Pengingat sahur",
      "Mutabaah Ramadhan: puasa, tarawih, dan tilawah harian",
    ],
    cta: "Daftar waitlist sebelum Ramadhan",
  },
  privacy: {
    title: "Lokasimu tidak ke mana-mana. Kodenya bisa kamu baca.",
    paragraphs: [
      "Waqtu menghitung waktu sholat di perangkatmu, jadi lokasimu tidak dikirim ke server kami. Aplikasinya tidak menampilkan iklan dan tidak memasang pelacak.",
      "Kode aplikasi terbuka di GitHub dengan lisensi MPL-2.0, dan layanan servernya AGPL-3.0. Nama dan logo Waqtu tetap milik kami, jadi fork memakai merek sendiri.",
    ],
    github: "Lihat kode di GitHub",
    policy: "Kebijakan privasi",
  },
  mac: {
    title: "Pakai Mac? Waqtu sudah ada di sana.",
    body: "Waqtu untuk Mac menaruh hitung mundur sholat di menu bar, memblokir kalender kerjamu saat waktu sholat, dan mengatur status Slack. Bayar sekali, tanpa langganan.",
    cta: "Lihat Waqtu untuk Mac (halaman bahasa Inggris)",
  },
  faq: {
    heading: "Pertanyaan yang sering muncul",
    items: [
      {
        question: "Kapan Waqtu rilis di iOS dan Android?",
        answer:
          "Targetnya sebelum Ramadhan 1448H, perkiraan {date}. Peserta waitlist kami kabari lewat email begitu aplikasinya bisa dicoba.",
      },
      {
        question: "Berapa harganya?",
        answer:
          "Harga untuk iOS dan Android belum diumumkan. Waqtu untuk Mac dijual sekali bayar tanpa langganan.",
      },
      {
        question: "Apa itu halaqah asinkron?",
        answer:
          "Halaqah yang anggotanya tidak perlu hadir bersamaan. Tidak ada jam pertemuan dan tidak ada perjalanan, jadi kamu ikut di waktu yang cocok denganmu.",
      },
      {
        question: "Apakah lokasi dan data ibadahku dikirim ke server?",
        answer:
          "Lokasimu tidak dikirim. Waktu sholat dihitung di ponselmu. Data mutabaah dan halaqah akan kami jelaskan di kebijakan privasi sebelum fitur itu rilis.",
      },
      {
        question: "Perlu internet untuk melihat waktu sholat?",
        answer:
          "Tidak. Jadwal dihitung di perangkat. Halaqah butuh koneksi supaya anggota saling menerima pembaruan.",
      },
      {
        question: "Metode perhitungan apa yang dipakai?",
        answer:
          "Kemenag RI secara bawaan. Hasil hitungannya kami bandingkan dengan jadwal Kemenag di beberapa kota, dari Banda Aceh sampai Merauke.",
      },
      {
        question: "Apa yang terjadi dengan emailku di waitlist?",
        answer: `Kami simpan emailmu, plus perangkat dan kota kalau kamu mengisinya, hanya untuk mengabari rilis. Tidak dijual dan tidak dibagikan. Minta hapus kapan saja lewat ${SUPPORT_EMAIL}.`,
      },
      {
        question: "Apa bedanya dengan Waqtu untuk Mac?",
        answer:
          "Versi Mac sudah tersedia dan berfokus pada menu bar dan kalender kerja. Versi iOS dan Android berfokus pada waktu sholat, mutabaah, dan halaqah.",
      },
    ],
  },
  closing: {
    title: "Masuk daftar sebelum Ramadhan.",
    body: "Satu email kamu, dan kami kabari saat Waqtu siap dicoba.",
  },
  footer: {
    blog: "Blog (bahasa Inggris)",
    resources: "Sumber daya",
    changelog: "Changelog",
    privacy: "Privasi",
    terms: "Ketentuan",
    support: "Kontak",
    github: "GitHub",
    note: "Waktu sholat, mutabaah, dan halaqah. Privasi dulu, kode terbuka.",
  },
  schema: {
    appDescription:
      "Waktu sholat, mutabaah yaumiyah, dan halaqah asinkron untuk muslim yang sibuk. Privasi dulu dan kode terbuka.",
  },
};

const en: LandingCopy = {
  htmlLang: "en",
  path: "/en/",
  meta: {
    title: "Waqtu: halaqah without the commute, prayer times, daily mutabaah",
    description:
      "Waqtu for iOS, Android and Mac: prayer times, mutabaah yaumiyah and asynchronous halaqah for busy Muslims and anyone who prefers worship without the crowd. Privacy first, open source. Join the waitlist before Ramadhan 1448H.",
    keywords:
      "prayer times app, mutabaah yaumiyah, online halaqah, daily worship tracker, ramadan mode, muslim app without ads, open source prayer app, waqtu",
    ogImageAlt: "Waqtu: prayer times, mutabaah yaumiyah and asynchronous halaqah",
  },
  nav: {
    features: "Features",
    ramadhan: "Ramadhan",
    privacy: "Privacy",
    faq: "FAQ",
    mac: "Mac",
    cta: "Join the waitlist",
    switchLabel: "Indonesia",
    switchHref: "/",
    menu: "Menu",
  },
  hero: {
    status: "Coming soon to iOS and Android. Available now on Mac.",
    title: "Halaqah without the commute.",
    lede: "Prayer times, mutabaah yaumiyah, and a halaqah you join whenever you can. No travel, and no guilt when today slips by.",
    audience:
      "Made for Muslims with packed schedules, and for anyone who worships more calmly without a crowd.",
    target: "Target release: before Ramadhan 1448H.",
  },
  form: {
    heading: "Hear when Waqtu launches",
    emailLabel: "Email",
    emailPlaceholder: "name@email.com",
    platformLabel: "Device (optional)",
    platformPlaceholder: "Choose a device",
    platforms: { ios: "iPhone (iOS)", android: "Android", mac: "Mac" },
    cityLabel: "City (optional)",
    cityPlaceholder: "e.g. Malang",
    submit: "Join the waitlist",
    submitting: "Sending...",
    fine: "We use your email only to tell you about the Waqtu release. It is never sold, and you can ask us to delete it any time.",
    successTitle: "You are on the list.",
    successBody: "We will email you as soon as Waqtu is ready to try.",
    errors: {
      invalid_email: "That email does not look valid. Check the spelling.",
      invalid_platform: "That device option is not recognised. Reload the page and try again.",
      invalid_city: "The city name is too long. 80 characters at most.",
      rate_limited: "Too many attempts from your network. Wait 10 minutes and try again.",
      generic: `Sign-up failed. Try again in a moment, or email ${SUPPORT_EMAIL}.`,
    },
  },
  halaqah: {
    title: "A halaqah that does not ask you to travel.",
    paragraphs: [
      "A good halaqah needs a workable schedule, a reachable place, and the energy to meet people. Many of us run out of one of those, stop showing up, and feel guilty about it.",
      "In Waqtu, halaqah is asynchronous. You join from your phone, at the hours you have. There is no meeting to chase and no list of who was late.",
    ],
    pull: "No commute. No guilt.",
  },
  features: {
    heading: "Three things you use every day",
    prayer: {
      title: "Prayer times from your own phone",
      body: "Times are calculated on the device, with the Indonesian Ministry of Religion (Kemenag) method as the default. It works without signal, and your location never goes to a server.",
      details: ["Adhan notifications", "Hijri date", "Bahasa Indonesia and English"],
    },
    mutabaah: {
      title: "Mutabaah yaumiyah",
      body: "Log your daily worship in a few taps, with no long forms. The log stays on your phone and opens offline.",
    },
    halaqah: {
      title: "Asynchronous halaqah",
      body: "A small group that keeps each other company without a meeting time. You join when you can, and nobody counts you as behind.",
    },
  },
  ramadhan: {
    eyebrow: "Ramadhan 1448H",
    title: "Counting down to 1 Ramadhan",
    units: { days: "days", hours: "hours", minutes: "minutes", seconds: "seconds" },
    countdownLabel: "Time left until 1 Ramadhan 1448H",
    started: "Ramadhan 1448H has begun.",
    estimate:
      "Estimated 1 Ramadhan 1448H: {date}, by the Umm al-Qura calendar. In Indonesia the official date follows the Kemenag isbat session, so it can shift by one day.",
    previewTitle: "Ramadhan mode",
    previewNote: "In the works. Nothing has shipped yet.",
    preview: [
      "Imsak and iftar countdowns, calculated on your device",
      "Suhoor reminder",
      "Ramadhan mutabaah: fasting, tarawih and daily tilawah",
    ],
    cta: "Join the waitlist before Ramadhan",
  },
  privacy: {
    title: "Your location goes nowhere. You can read the code.",
    paragraphs: [
      "Waqtu calculates prayer times on your device, so your location is not sent to our servers. The app shows no ads and installs no trackers.",
      "The app code is open on GitHub under MPL-2.0, and the server services are AGPL-3.0. The Waqtu name and logo stay ours, so forks use their own branding.",
    ],
    github: "View the code on GitHub",
    policy: "Privacy policy",
  },
  mac: {
    title: "On a Mac? Waqtu is already there.",
    body: "Waqtu for Mac puts the prayer countdown in your menu bar, blocks your work calendar during salah, and sets your Slack status. Pay once, no subscription.",
    cta: "See Waqtu for Mac",
  },
  faq: {
    heading: "Frequently asked questions",
    items: [
      {
        question: "When does Waqtu launch on iOS and Android?",
        answer:
          "The target is before Ramadhan 1448H, estimated {date}. We email everyone on the waitlist as soon as the app is ready to try.",
      },
      {
        question: "How much does it cost?",
        answer:
          "Pricing for iOS and Android has not been announced. Waqtu for Mac is a one-time purchase with no subscription.",
      },
      {
        question: "What is asynchronous halaqah?",
        answer:
          "A halaqah where members do not have to be present at the same time. There is no meeting hour and no travel, so you join at a time that suits you.",
      },
      {
        question: "Are my location and worship data sent to a server?",
        answer:
          "Your location is not sent. Prayer times are calculated on your phone. We will explain how mutabaah and halaqah data is handled in the privacy policy before those features ship.",
      },
      {
        question: "Do I need internet to see prayer times?",
        answer:
          "No. Times are calculated on the device. Halaqah needs a connection so members receive each other's updates.",
      },
      {
        question: "Which calculation method does it use?",
        answer:
          "Kemenag RI by default. We compared the results against official Kemenag schedules in several cities, from Banda Aceh to Merauke.",
      },
      {
        question: "What happens to my email on the waitlist?",
        answer: `We store your email, plus your device and city if you fill them in, only to tell you about the release. It is not sold or shared. Ask for deletion any time at ${SUPPORT_EMAIL}.`,
      },
      {
        question: "How is this different from Waqtu for Mac?",
        answer:
          "The Mac app is available now and focuses on the menu bar and your work calendar. The iOS and Android apps focus on prayer times, mutabaah and halaqah.",
      },
    ],
  },
  closing: {
    title: "Get on the list before Ramadhan.",
    body: "Leave one email and we will tell you when Waqtu is ready to try.",
  },
  footer: {
    blog: "Blog",
    resources: "Resources",
    changelog: "Changelog",
    privacy: "Privacy",
    terms: "Terms",
    support: "Contact",
    github: "GitHub",
    note: "Prayer times, mutabaah and halaqah. Privacy first, open source.",
  },
  schema: {
    appDescription:
      "Prayer times, mutabaah yaumiyah and asynchronous halaqah for busy Muslims. Privacy first and open source.",
  },
};

export const landing: Record<Locale, LandingCopy> = { id, en };
