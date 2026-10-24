import { SUPPORT_EMAIL } from "./landing";

export type LegalLocale = "id" | "en";

/** Body text may contain inline HTML (links, strong); it is authored here, never user input. */
export interface LegalSection {
  heading: string;
  paragraphs?: string[];
  items?: string[];
}

export interface LegalDoc {
  title: string;
  description: string;
  updatedLabel: string;
  intro: string[];
  sections: LegalSection[];
}

export interface SupportDoc {
  title: string;
  description: string;
  intro: string;
  contactHeading: string;
  contactBody: string;
  contactCta: string;
  faqHeading: string;
  faq: { question: string; answer: string }[];
  linksHeading: string;
}

/** Date both legal pages and the policy text refer to. Bump it whenever either document changes. */
export const LEGAL_UPDATED = "2026-10-25";

const mail = `<a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>`;

export const legalNav = {
  id: {
    back: "Kembali ke Waqtu",
    privacy: "Kebijakan privasi",
    terms: "Syarat layanan",
    support: "Bantuan",
    switchLabel: "English",
    switchLang: "en",
  },
  en: {
    back: "Back to Waqtu",
    privacy: "Privacy policy",
    terms: "Terms of service",
    support: "Support",
    switchLabel: "Bahasa Indonesia",
    switchLang: "id",
  },
} as const;

export const legalPaths = {
  id: { home: "/", privacy: "/privacy", terms: "/terms", support: "/support" },
  en: { home: "/en/", privacy: "/en/privacy", terms: "/en/terms", support: "/en/support" },
} as const;

export const privacy: Record<LegalLocale, LegalDoc> = {
  id: {
    title: "Kebijakan Privasi Waqtu",
    description:
      "Data apa yang disentuh Waqtu di aplikasi Mac, iPhone, Android, dan situs getwaqtu.com, ke mana perginya, berapa lama disimpan, dan cara menghapus akunmu.",
    updatedLabel: "Terakhir diperbarui",
    intro: [
      "Halaman ini berlaku untuk aplikasi Waqtu di Mac, iPhone, dan Android, situs getwaqtu.com, dan daftar tunggu. &quot;Kami&quot; berarti pengembang Waqtu. Kontak ada di bagian paling bawah.",
      "Ringkasnya: waktu sholat dihitung di perangkatmu, lokasimu tidak dikirim ke server kami, akun bersifat opsional, dan aplikasi tidak memuat iklan maupun SDK analitik. Rinciannya di bawah, termasuk hal-hal yang memang keluar dari perangkatmu.",
    ],
    sections: [
      {
        heading: "Yang tetap di perangkatmu",
        paragraphs: ["Hal-hal ini tidak pernah kami terima, dengan atau tanpa akun:"],
        items: [
          "<strong>Lokasi.</strong> Koordinat dipakai untuk menghitung waktu sholat dan disimpan di perangkat. Di aplikasi ponsel tidak ada pencarian nama kota lewat server; di Mac kami memakai CoreLocation dengan akurasi kasar (sekitar satu kilometer). Lokasi tidak ikut sinkron.",
          "<strong>Refleksi halaqah.</strong> Catatan yang kamu tulis setelah halaqah hanya tersimpan di ponsel ini. Yang tersinkron hanyalah tanda bahwa halaqah hari itu sudah dicentang di daftar mutabaah, sama seperti item lain.",
          "<strong>Rencana dan rekaman hafalan.</strong> Rencana hafalan dan rekaman bacaanmu hanya ada di ponsel ini. Rekaman dikecualikan dari cadangan (di iOS lewat penanda &quot;exclude from backup&quot;, di Android karena cadangan aplikasi dimatikan), jadi tidak ikut pindah ke ponsel baru. Tanda murojaah di daftar mutabaah tersinkron seperti item lain; isi bacaan dan rekamannya tidak.",
          "<strong>Pengingat adzan.</strong> Dijadwalkan lokal di perangkat. Kami tidak memakai notifikasi push.",
          "<strong>Isi kalender (Mac).</strong> Jika kamu mengizinkan, Waqtu menulis blok sholat ke kalendermu lewat EventKit. Isi kalendermu tidak dikirim ke server kami.",
        ],
      },
      {
        heading: "Akun (opsional)",
        paragraphs: [
          "Waktu sholat, pengingat, dan mutabaah dasar bisa dipakai tanpa akun. Kalau kamu masuk dengan Apple atau Google, server kami menerima:",
        ],
        items: [
          "nama dan alamat email dari Apple atau Google, plus foto profil jika penyedia mengirimkannya. Apple bisa menyembunyikan emailmu lewat alamat relay; kami menyimpan alamat yang diberikan Apple.",
          "catatan sesi masuk: token sesi, alamat IP dan jenis perangkat/peramban (user agent) saat sesi dibuat, serta waktu mulai dan berakhirnya sesi. Sesi dipakai agar kamu tetap masuk dan berakhir setelah 7 hari tanpa aktivitas; keluar atau menghapus akun menghapusnya.",
        ],
      },
      {
        heading: "Sinkron mutabaah",
        paragraphs: ["Saat masuk dan sinkron aktif, aplikasi mengirim ke server kami:"],
        items: [
          "centang harian: tanggal, item, dan nilainya;",
          "sebagian pengaturan: daftar item mutabaah (termasuk nama item buatanmu sendiri), pengaturan streak, metode hisab, mazhab ashar, koreksi tanggal Hijriah, dan koreksi menit per waktu sholat.",
          "Lokasi, bahasa, refleksi halaqah, dan hafalan tidak termasuk.",
        ],
      },
      {
        heading: "Lingkaran (Circles)",
        paragraphs: [
          "Lingkaran adalah kelompok kecil untuk saling menyemangati, dipisah untuk ikhwan dan akhwat. Tidak ada pesan pribadi. Untuk memakainya kamu membuat profil lingkaran, dan server kami menyimpan:",
        ],
        items: [
          "nama samaran (handle) pilihanmu, yang menjadi satu-satunya identitas yang dilihat anggota lain;",
          "pilihan ikhwan atau akhwat. Ini pernyataanmu sendiri, dipakai hanya untuk menempatkanmu di lingkaran dengan kelompok yang sama, dan tidak bisa diubah dari aplikasi setelah disimpan;",
          "bahasa lingkaran dan selisih zona waktu dalam jam bulat dari UTC (diambil dari jam ponsel, bukan dari lokasi);",
          "pilihan berbagi ringkasan mingguan, keanggotaan lingkaran, dan statusnya (aktif, jeda, keluar);",
          "kiriman: teks (maksimal 2.000 karakter), pesan suara (maksimal 3 menit dan 5 MB, disimpan di Cloudflare R2), dan ringkasan mingguan yang kamu bagikan sendiri (hanya angka total pekan itu, tanpa nama ibadah), serta reaksi emoji;",
          "daftar orang yang kamu blokir dan laporan yang kamu kirim (alasan dan catatan opsional).",
        ],
      },
      {
        heading: "Moderasi",
        items: [
          "Laporan masuk ke antrean moderasi yang kami tinjau. Sebuah kiriman otomatis disembunyikan setelah dilaporkan tiga orang berbeda, sambil menunggu tinjauan.",
          "Kami bisa memulihkan, menghapus kiriman (termasuk pesan suaranya), atau menangguhkan akses lingkaran seseorang.",
          "Memblokir seseorang menyembunyikan kiriman kalian satu sama lain.",
          "Kamu bisa menghapus kirimanmu sendiri kapan saja. Pesan suara yang diunggah tetapi tidak pernah jadi kiriman dihapus otomatis setelah 24 jam.",
          "Kiriman tidak kedaluwarsa sendiri; ia bertahan sampai kamu atau kami menghapusnya, atau sampai akunmu dihapus.",
        ],
      },
      {
        heading: "Pembayaran dan Premium",
        items: [
          "<strong>App Store dan Google Play.</strong> Pembayaran diproses Apple atau Google; kami tidak melihat data kartumu. Server kami memverifikasi pembelian ke Apple atau Google dan menyimpan catatan hak Premium yang terhubung ke akunmu: sumber pembelian, ID produk, ID transaksi atau pesanan, lingkungan (produksi atau uji), waktu berakhir, dan status pengembalian dana.",
          "<strong>Mac, unduhan langsung.</strong> Pembayaran lewat Polar. Polar menerima email dan namamu saat checkout dan mengirim kunci lisensi. Saat aktivasi, aplikasi Mac mengirim kunci lisensi dan ID acak perangkat ke layanan lisensi kami, yang memeriksanya ke Polar. Jika kamu menautkan kunci ke akun Waqtu, kami menyimpan catatan lisensi itu beserta referensi pelanggan Polar.",
          "<strong>Mac, Mac App Store.</strong> Pembelian ditangani Apple.",
          "Pembeli lisensi Mac seumur hidup mendapat Premium seumur hidup di ponsel jika kuncinya ditautkan ke akun.",
        ],
      },
      {
        heading: "Koneksi lain yang dilakukan aplikasi",
        items: [
          "<strong>Ponsel:</strong> pembaruan aplikasi lewat Expo Updates (u.expo.dev), yang menerima versi aplikasi, platform, dan alamat IP-mu; video halaqah lewat YouTube dengan host privasi-ditingkatkan (youtube-nocookie.com), yang dimuat hanya saat kamu membuka video; Apple dan Google saat masuk.",
          "<strong>Mac:</strong> pembaruan otomatis (Sparkle) lewat layanan pembaruan kami; Slack, hanya jika kamu menyalakan integrasinya, dengan token yang kamu berikan sendiri, untuk mengatur teks dan emoji status; Google Calendar, hanya jika kamu menyambungkannya; unduhan audio dari quranicaudio.com dan archive.org saat kamu memintanya.",
          "Kami tidak menemukan SDK analitik, pelaporan error, atau iklan di aplikasi Mac maupun ponsel.",
        ],
      },
      {
        heading: "Situs web dan daftar tunggu",
        items: [
          "<strong>Analitik situs.</strong> getwaqtu.com memuat skrip One Dollar Stats untuk menghitung kunjungan halaman dan klik tombol, serta kedalaman gulir. Menurut dokumentasi mereka, pengunjung dibedakan lewat hash gabungan alamat IP, user agent, dan tanggal hari itu. Kode situs kami tidak memasang cookie atau memakai localStorage.",
          "<strong>Daftar tunggu.</strong> Kami menyimpan email, jenis perangkat dan kota jika kamu mengisinya, bahasa halaman, dan waktu pendaftaran, hanya untuk mengabari rilis. Alamat IP-mu tidak disimpan; hash bergaram darinya dipakai paling lama 20 menit untuk membatasi pendaftaran berulang. Entri bertahan sampai kamu minta dihapus.",
          "<strong>Checkout web.</strong> Halaman pembayaran dikelola Polar. Situs kami tidak menyimpan data pembayaran.",
        ],
      },
      {
        heading: "Pihak yang memproses data",
        paragraphs: [
          "Kami tidak menjual atau menyewakan datamu. Data hanya sampai ke pihak berikut sebatas yang dijelaskan di atas: Cloudflare (hosting server, basis data D1, dan penyimpanan R2), Apple dan Google (masuk dan pembelian), Polar (pembayaran dan lisensi Mac), Expo (pembaruan aplikasi ponsel), One Dollar Stats (analitik situs), YouTube (video halaqah), serta Slack dan Google Calendar jika kamu menyambungkannya.",
        ],
      },
      {
        heading: "Penyimpanan dan penghapusan data",
        paragraphs: [
          "Data akun, sinkron, lingkaran, dan catatan Premium disimpan selama akunmu ada.",
          "<strong>Menghapus akun di aplikasi ponsel:</strong> buka Pengaturan, bagian Akun, lalu ketuk Hapus akun dan konfirmasi. Ini menghapus di server kami: akun dan sesi masuk, sinkron mutabaah dan pengaturan, profil lingkaran, keanggotaan, kiriman, reaksi, blokir, laporan yang kamu kirim, catatan hak Premium, dan semua pesan suaramu (berkas di R2 dihapus lebih dulu; kalau gagal, akun tetap ada dan kamu bisa mencoba lagi). Tindakan ini tidak bisa dibatalkan.",
          "<strong>Yang tidak ikut terhapus:</strong> data di ponselmu (hapus dengan mencopot aplikasi), langganan di App Store atau Google Play (batalkan di toko), catatan transaksi yang disimpan Apple, Google, atau Polar sendiri, dan salinan cadangan basis data Cloudflare yang kami tidak kendalikan. Masuk lagi setelah menghapus akan membuat akun baru yang kosong.",
          "<strong>Aplikasi Mac belum punya tombol hapus akun.</strong> Hapus lewat aplikasi ponsel, atau kirim email ke " +
            mail +
            ".",
          "<strong>Daftar tunggu, lisensi, dan permintaan lain:</strong> kirim email ke " +
            mail +
            ". Kami membalas dalam 30 hari.",
        ],
      },
      {
        heading: "Pilihan dan hakmu",
        items: [
          "Cabut izin lokasi, mikrofon, kalender, atau notifikasi kapan saja di pengaturan sistem.",
          "Slack dan Google Calendar di Mac mati secara bawaan.",
          "Minta salinan, koreksi, atau penghapusan datamu lewat email. Tergantung tempat tinggalmu, hukum seperti UU Pelindungan Data Pribadi Indonesia atau GDPR bisa memberimu hak tambahan.",
        ],
      },
      {
        heading: "Keamanan",
        paragraphs: [
          "Token sesi disimpan di Keychain iOS, Keystore Android, atau Keychain Mac. Server berjalan di Cloudflare. Tidak ada sistem yang sepenuhnya kebal; kalau kami menemukan kebocoran yang menyangkut datamu, kami akan memberi tahu lewat email yang terdaftar.",
        ],
      },
      {
        heading: "Anak-anak",
        paragraphs: [
          "Waqtu tidak ditujukan untuk anak di bawah 13 tahun, dan kami tidak sengaja mengumpulkan data pribadi mereka.",
        ],
      },
      {
        heading: "Perubahan kebijakan",
        paragraphs: [
          "Kalau isi kebijakan ini berubah, versi baru dipasang di halaman ini dengan tanggal pembaruan yang baru.",
        ],
      },
      {
        heading: "Kontak",
        paragraphs: ["Pertanyaan soal privasi dan data: " + mail + "."],
      },
    ],
  },
  en: {
    title: "Waqtu Privacy Policy",
    description:
      "What data Waqtu touches in the Mac, iPhone and Android apps and on getwaqtu.com, where it goes, how long we keep it, and how to delete your account.",
    updatedLabel: "Last updated",
    intro: [
      "This page covers the Waqtu apps for Mac, iPhone and Android, the getwaqtu.com website, and the waitlist. &quot;We&quot; means the developer of Waqtu. Contact details are at the bottom.",
      "In short: prayer times are calculated on your device, your location is not sent to our servers, an account is optional, and the apps contain no ads or analytics SDKs. The details follow, including the things that do leave your device.",
    ],
    sections: [
      {
        heading: "What stays on your device",
        paragraphs: ["We never receive these, with or without an account:"],
        items: [
          "<strong>Location.</strong> Coordinates are used to calculate prayer times and stored on the device. The phone app does not look up city names through a server; the Mac app uses CoreLocation at coarse accuracy (about one kilometer). Location is not synced.",
          "<strong>Halaqah reflections.</strong> The notes you write after a halaqah stay on this phone. Only the tick that marks that day's halaqah as done in your mutabaah checklist syncs, like any other checklist item.",
          "<strong>Hafalan plans and recordings.</strong> Your memorization plans and recitation recordings exist only on this phone. Recordings are excluded from backups (on iOS through the &quot;exclude from backup&quot; flag, on Android because app backup is turned off), so they do not move to a new phone. The murojaah tick in your checklist syncs like any other item; the recitation and recordings do not.",
          "<strong>Adhan reminders.</strong> Scheduled locally on the device. We do not use push notifications.",
          "<strong>Calendar content (Mac).</strong> If you allow it, Waqtu writes prayer blocks to your calendar through EventKit. Your calendar content is not sent to our servers.",
        ],
      },
      {
        heading: "Account (optional)",
        paragraphs: [
          "Prayer times, reminders and the basic mutabaah checklist work without an account. If you sign in with Apple or Google, our server receives:",
        ],
        items: [
          "your name and email address from Apple or Google, plus a profile picture if the provider sends one. Apple may hide your email behind a relay address; we store the address Apple gives us.",
          "sign-in session records: a session token, the IP address and device/browser type (user agent) when the session is created, and when it starts and ends. Sessions keep you signed in and expire after 7 days without activity; signing out or deleting your account removes them.",
        ],
      },
      {
        heading: "Mutabaah sync",
        paragraphs: ["When you are signed in and sync is on, the app sends our server:"],
        items: [
          "daily checks: date, item and value;",
          "some settings: your checklist items (including names of custom items you create), streak settings, calculation method, asr method, Hijri date adjustment, and per-prayer minute offsets.",
          "Location, language, halaqah reflections and hafalan are not included.",
        ],
      },
      {
        heading: "Circles",
        paragraphs: [
          "Circles are small groups for encouragement, separated into brothers (ikhwan) and sisters (akhwat). There are no direct messages. To use them you create a circle profile, and our server stores:",
        ],
        items: [
          "the anonymous handle you choose, which is the only identity other members see;",
          "your ikhwan or akhwat choice. This is self-declared, used only to place you in circles with the same group, and cannot be changed in the app once saved;",
          "the circle language and your time zone offset in whole hours from UTC (taken from the phone clock, not from your location);",
          "your weekly-summary sharing choice, your circle memberships and their status (active, paused, left);",
          "posts: text (up to 2,000 characters), voice notes (up to 3 minutes and 5 MB, stored in Cloudflare R2), weekly summaries you share yourself (only that week's totals, never practice names), and emoji reactions;",
          "the list of people you block and the reports you send (a reason and an optional note).",
        ],
      },
      {
        heading: "Moderation",
        items: [
          "Reports go to a moderation queue that we review. A post is hidden automatically once three different people report it, pending review.",
          "We can restore or remove a post (including its voice note) and suspend someone's access to circles.",
          "Blocking someone hides your posts from each other.",
          "You can delete your own posts at any time. Voice notes that were uploaded but never became a post are deleted automatically after 24 hours.",
          "Posts do not expire on their own. They stay until you or we delete them, or until your account is deleted.",
        ],
      },
      {
        heading: "Payments and Premium",
        items: [
          "<strong>App Store and Google Play.</strong> Apple or Google processes the payment; we never see your card details. Our server verifies the purchase with Apple or Google and stores an entitlement record linked to your account: purchase source, product ID, transaction or order ID, environment (production or test), expiry time, and refund status.",
          "<strong>Mac, direct download.</strong> Payment goes through Polar. Polar receives your email and name at checkout and issues a license key. On activation the Mac app sends the license key and a random device ID to our license service, which checks it with Polar. If you link the key to a Waqtu account, we store that license record along with the Polar customer reference.",
          "<strong>Mac, Mac App Store.</strong> Apple handles the purchase.",
          "Buyers of the lifetime Mac license get lifetime Premium on their phone when the key is linked to their account.",
        ],
      },
      {
        heading: "Other connections the apps make",
        items: [
          "<strong>Phone:</strong> app updates through Expo Updates (u.expo.dev), which receives your app version, platform and IP address; halaqah videos through YouTube's privacy-enhanced host (youtube-nocookie.com), loaded only when you open a video; Apple and Google when you sign in.",
          "<strong>Mac:</strong> automatic updates (Sparkle) through our update service; Slack, only if you turn the integration on, with a token you provide, to set a status text and emoji; Google Calendar, only if you connect it; audio downloads from quranicaudio.com and archive.org when you ask for them.",
          "We found no analytics, crash-reporting or advertising SDKs in the Mac or phone apps.",
        ],
      },
      {
        heading: "Website and waitlist",
        items: [
          "<strong>Site analytics.</strong> getwaqtu.com loads the One Dollar Stats script to count page views, button clicks and scroll depth. According to their documentation, visitors are told apart by a hash of IP address, user agent and the current day. Our site code sets no cookies and uses no localStorage.",
          "<strong>Waitlist.</strong> We store your email, your device type and city if you fill them in, the page language, and the sign-up time, only to tell you about the release. Your IP address is not stored; a salted hash of it is kept for at most 20 minutes to limit repeated sign-ups. Entries stay until you ask us to delete them.",
          "<strong>Web checkout.</strong> The payment page is run by Polar. Our site stores no payment data.",
        ],
      },
      {
        heading: "Who processes data",
        paragraphs: [
          "We do not sell or rent your data. It reaches the following parties only as described above: Cloudflare (server hosting, D1 database and R2 storage), Apple and Google (sign-in and purchases), Polar (payments and Mac licenses), Expo (phone app updates), One Dollar Stats (site analytics), YouTube (halaqah videos), and Slack and Google Calendar if you connect them.",
        ],
      },
      {
        heading: "Retention and deletion",
        paragraphs: [
          "Account, sync, circle and entitlement data are kept as long as your account exists.",
          "<strong>Deleting your account in the phone app:</strong> open Settings, find the Account section, tap Delete account and confirm. On our server this removes: your account and sign-in sessions, mutabaah sync and settings, circle profile, memberships, posts, reactions, blocks, reports you sent, entitlement records, and all your voice notes (the R2 files are deleted first; if that fails the account stays and you can try again). It cannot be undone.",
          "<strong>What is not removed:</strong> data on your phone (delete it by uninstalling the app), subscriptions in the App Store or Google Play (cancel them in the store), transaction records that Apple, Google or Polar keep themselves, and Cloudflare database backups that we do not control. Signing in again after deletion creates a new, empty account.",
          "<strong>The Mac app has no delete-account button yet.</strong> Delete through the phone app, or email " +
            mail +
            ".",
          "<strong>Waitlist, licenses and other requests:</strong> email " +
            mail +
            ". We reply within 30 days.",
        ],
      },
      {
        heading: "Your choices and rights",
        items: [
          "Revoke location, microphone, calendar or notification access at any time in system settings.",
          "Slack and Google Calendar on Mac are off by default.",
          "Ask for a copy, a correction or deletion of your data by email. Depending on where you live, laws such as Indonesia's Personal Data Protection Law or the GDPR may give you further rights.",
        ],
      },
      {
        heading: "Security",
        paragraphs: [
          "Session tokens are kept in the iOS Keychain, the Android Keystore, or the Mac Keychain. The server runs on Cloudflare. No system is immune; if we find a breach that involves your data, we will tell you at the email on your account.",
        ],
      },
      {
        heading: "Children",
        paragraphs: [
          "Waqtu is not directed to children under 13, and we do not knowingly collect their personal information.",
        ],
      },
      {
        heading: "Changes to this policy",
        paragraphs: [
          "If this policy changes, we post the new version here with a new update date.",
        ],
      },
      {
        heading: "Contact",
        paragraphs: ["Questions about privacy and data: " + mail + "."],
      },
    ],
  },
};

export const terms: Record<LegalLocale, LegalDoc> = {
  id: {
    title: "Syarat Layanan Waqtu",
    description:
      "Syarat memakai Waqtu di Mac, iPhone, dan Android: langganan Premium, perpanjangan otomatis, pembatalan lewat toko, lisensi Mac lewat Polar, dan aturan Lingkaran.",
    updatedLabel: "Terakhir diperbarui",
    intro: [
      'Dengan mengunduh atau memakai Waqtu (aplikasi Mac, iPhone, atau Android) kamu menyetujui syarat ini. Kalau tidak setuju, jangan pakai aplikasinya. Cara kami menangani datamu dijelaskan di <a href="/privacy">Kebijakan Privasi</a>.',
    ],
    sections: [
      {
        heading: "Yang gratis dan yang Premium",
        paragraphs: [
          "Waktu sholat, pengingat adzan, dan mutabaah dasar gratis. Premium membuka fitur tambahan yang tercantum di layar Premium dalam aplikasi. Daftar fitur dan harga di layar itu dan di halaman toko adalah yang berlaku untukmu saat membeli.",
        ],
      },
      {
        heading: "Langganan di iPhone dan Android",
        items: [
          "Premium dijual sebagai langganan bulanan atau tahunan lewat App Store atau Google Play. Harga ditampilkan toko dalam mata uangmu sebelum kamu membeli.",
          "Pembayaran dibebankan ke akun Apple atau Google-mu saat pembelian dikonfirmasi.",
          "Langganan diperpanjang otomatis kecuali kamu membatalkannya paling lambat 24 jam sebelum periode berjalan berakhir. Akunmu ditagih untuk perpanjangan dalam 24 jam sebelum periode berakhir, dengan harga periode yang sama.",
          "Kamu membatalkan dan mengelola langganan di toko, bukan lewat kami: di iPhone lewat Pengaturan, nama kamu, Langganan; di Android lewat Google Play, Pembayaran dan langganan, Langganan. Setelah dibatalkan, Premium tetap aktif sampai periode yang sudah dibayar habis.",
          "Pengembalian dana ditangani Apple atau Google sesuai kebijakan mereka. Kami tidak bisa memproses pengembalian untuk pembelian lewat toko. Jika toko mengembalikan dana, Premium untuk transaksi itu berakhir.",
          "Pulihkan pembelian lewat tombol Pulihkan pembelian di layar Premium. Masuk ke akun Waqtu dulu agar langganan terhubung ke akunmu dan berlaku di semua perangkat.",
        ],
      },
      {
        heading: "Waqtu untuk Mac",
        items: [
          "Waqtu untuk Mac yang diunduh langsung dijual lewat Polar sebagai lisensi seumur hidup untuk satu Mac. Polar memproses pembayaran; kunci lisensi dikirim setelah pembayaran dikonfirmasi.",
          "Lisensi bersifat pribadi. Jangan membagikan, menjual ulang, membongkar aplikasi, atau menghindari verifikasi lisensi.",
          "Tidak puas? Kirim email ke " +
            mail +
            " dalam 30 hari sejak pembelian untuk pengembalian dana penuh, tanpa perlu alasan. Setelah itu penjualan bersifat final. Jika pembayaran dikembalikan lewat Polar, lisensinya dicabut.",
          "Versi Mac App Store dibeli dan dikelola lewat Apple, dengan syarat toko Apple.",
          "Pemilik lisensi Mac seumur hidup mendapat Premium seumur hidup di ponsel setelah menautkan kunci di layar Premium.",
        ],
      },
      {
        heading: "Akun",
        paragraphs: [
          "Akun bersifat opsional dan dibuat lewat Apple atau Google. Kamu bertanggung jawab atas akses ke akun tersebut. Kamu bisa menghapus akun kapan saja dari Pengaturan di aplikasi ponsel; lihat Kebijakan Privasi untuk apa yang terhapus. Menghapus akun tidak membatalkan langganan di toko.",
        ],
      },
      {
        heading: "Aturan Lingkaran",
        paragraphs: [
          "Lingkaran adalah ruang kecil untuk saling menyemangati. Dengan memakainya kamu setuju untuk:",
        ],
        items: [
          "tidak mengirim spam, iklan, pelecehan, ujaran kasar, atau konten yang tidak pantas;",
          "memilih ikhwan atau akhwat dengan jujur, karena pilihan itu menentukan lingkaranmu dan tidak bisa diubah dari aplikasi;",
          "tidak mencoba mengetahui identitas anggota lain atau membagikan data pribadi orang lain.",
          "Kiriman yang dilaporkan akan kami tinjau. Kami bisa menyembunyikan atau menghapus kiriman dan menangguhkan akses lingkaran siapa pun yang melanggar aturan ini, tanpa pengembalian biaya langganan untuk periode berjalan. Kamu bisa melaporkan dan memblokir dari menu pada setiap kiriman.",
        ],
      },
      {
        heading: "Akurasi waktu sholat",
        paragraphs: [
          "Waqtu menghitung waktu sholat dengan metode hisab yang dikenal, tetapi kami tidak menjamin ketepatannya sampai ke menit. Untuk hal yang bergantung pada ketepatan, seperti mulai dan berakhirnya puasa, cocokkan dengan masjid atau otoritas setempat. Kamu bisa mengatur metode dan koreksi menit di aplikasi.",
        ],
      },
      {
        heading: "Hak kekayaan intelektual",
        paragraphs: [
          "Aplikasi, tampilan, nama, dan logo Waqtu dimiliki pengembang Waqtu. Beberapa bagian kode dirilis di bawah lisensi sumber terbuka yang tercantum di repositori; lisensi itu berlaku untuk kode tersebut. Kiriman yang kamu tulis di Lingkaran tetap milikmu; kamu mengizinkan kami menyimpan dan menampilkannya kepada anggota lingkaranmu agar fitur ini berjalan.",
        ],
      },
      {
        heading: "Tanpa jaminan",
        paragraphs: [
          "Waqtu disediakan &quot;apa adanya&quot; tanpa jaminan apa pun, tersurat maupun tersirat, termasuk jaminan kelayakan untuk diperdagangkan atau kecocokan untuk tujuan tertentu. Sejauh diizinkan hukum, pengembang tidak bertanggung jawab atas kerugian tidak langsung atau kerusakan yang timbul dari pemakaian aplikasi. Fitur dan layanan server bisa berubah atau berhenti; kalau fitur Premium yang sudah kamu bayar dihentikan, kami akan memberi tahu di aplikasi atau lewat email.",
        ],
      },
      {
        heading: "Penghentian",
        paragraphs: [
          "Kamu bisa berhenti memakai Waqtu kapan saja. Kami bisa menghentikan akses ke akun atau lisensi yang melanggar syarat ini. Lisensi Mac yang dicabut berhenti berlaku di aplikasi.",
        ],
      },
      {
        heading: "Perubahan syarat",
        paragraphs: [
          "Kami bisa mengubah syarat ini. Versi baru dipasang di halaman ini dengan tanggal pembaruan baru. Memakai aplikasi setelah perubahan berarti kamu menerimanya. Perubahan harga langganan mengikuti aturan toko.",
        ],
      },
      {
        heading: "Hukum yang berlaku",
        paragraphs: ["Syarat ini tunduk pada hukum Malaysia."],
      },
      {
        heading: "Kontak",
        paragraphs: ["Pertanyaan soal syarat ini: " + mail + "."],
      },
    ],
  },
  en: {
    title: "Waqtu Terms of Service",
    description:
      "Terms for using Waqtu on Mac, iPhone and Android: Premium subscriptions, auto-renewal, cancelling through the store, Mac licenses through Polar, and Circles rules.",
    updatedLabel: "Last updated",
    intro: [
      'By downloading or using Waqtu (the Mac, iPhone or Android app) you agree to these terms. If you do not agree, do not use the app. How we handle your data is described in the <a href="/en/privacy">Privacy Policy</a>.',
    ],
    sections: [
      {
        heading: "What is free and what is Premium",
        paragraphs: [
          "Prayer times, adhan reminders and the basic mutabaah checklist are free. Premium unlocks extra features listed on the Premium screen in the app. The feature list and price on that screen and on the store page are what apply to you when you buy.",
        ],
      },
      {
        heading: "Subscriptions on iPhone and Android",
        items: [
          "Premium is sold as a monthly or yearly subscription through the App Store or Google Play. The store shows the price in your currency before you buy.",
          "Payment is charged to your Apple or Google account when the purchase is confirmed.",
          "The subscription renews automatically unless you cancel it at least 24 hours before the current period ends. Your account is charged for renewal within 24 hours before the period ends, at the price of the same period.",
          "You cancel and manage the subscription in the store, not through us: on iPhone in Settings, your name, Subscriptions; on Android in Google Play, Payments and subscriptions, Subscriptions. After you cancel, Premium stays active until the paid period ends.",
          "Refunds are handled by Apple or Google under their policies. We cannot process refunds for store purchases. If the store refunds a purchase, Premium for that transaction ends.",
          "Restore purchases with the Restore purchases button on the Premium screen. Sign in to your Waqtu account first so the subscription is linked to it and applies on all your devices.",
        ],
      },
      {
        heading: "Waqtu for Mac",
        items: [
          "Waqtu for Mac downloaded directly is sold through Polar as a lifetime license for one Mac. Polar processes the payment; the license key is sent once payment is confirmed.",
          "The license is personal. Do not share it, resell it, reverse engineer the app, or bypass license verification.",
          "Not satisfied? Email " +
            mail +
            " within 30 days of purchase for a full refund, no reason needed. After that, sales are final. If a payment is refunded through Polar, the license is revoked.",
          "The Mac App Store version is bought and managed through Apple, under Apple's store terms.",
          "Owners of the lifetime Mac license get lifetime Premium on their phone after linking the key on the Premium screen.",
        ],
      },
      {
        heading: "Accounts",
        paragraphs: [
          "An account is optional and is created through Apple or Google. You are responsible for access to that account. You can delete your account at any time from Settings in the phone app; see the Privacy Policy for what is removed. Deleting your account does not cancel a store subscription.",
        ],
      },
      {
        heading: "Circles rules",
        paragraphs: ["Circles are small spaces for encouragement. By using them you agree to:"],
        items: [
          "not post spam, advertising, harassment, abusive language, or inappropriate content;",
          "choose ikhwan or akhwat honestly, because that choice decides your circle and cannot be changed in the app;",
          "not try to learn other members' identities or share other people's personal data.",
          "We review reported posts. We may hide or remove posts and suspend circle access for anyone who breaks these rules, without a refund of the current subscription period. You can report and block from the menu on every post.",
        ],
      },
      {
        heading: "Prayer time accuracy",
        paragraphs: [
          "Waqtu calculates prayer times with recognized methods, but we do not guarantee minute-level accuracy. For anything that depends on precision, such as the start and end of a fast, check with your local mosque or authority. You can set the method and minute offsets in the app.",
        ],
      },
      {
        heading: "Intellectual property",
        paragraphs: [
          "The app, its look, name and logo belong to the developer of Waqtu. Parts of the code are released under the open-source licenses listed in the repository; those licenses apply to that code. Posts you write in Circles remain yours; you allow us to store them and show them to the members of your circle so the feature works.",
        ],
      },
      {
        heading: "No warranty",
        paragraphs: [
          "Waqtu is provided &quot;as is&quot; without warranty of any kind, express or implied, including merchantability and fitness for a particular purpose. To the extent the law allows, the developer is not liable for indirect loss or damage arising from use of the app. Features and server services can change or stop; if a Premium feature you paid for is discontinued, we will say so in the app or by email.",
        ],
      },
      {
        heading: "Termination",
        paragraphs: [
          "You can stop using Waqtu at any time. We may end access to an account or license that breaks these terms. A revoked Mac license stops working in the app.",
        ],
      },
      {
        heading: "Changes to these terms",
        paragraphs: [
          "We may change these terms. The new version is posted here with a new update date. Using the app after a change means you accept it. Subscription price changes follow the store's rules.",
        ],
      },
      {
        heading: "Governing law",
        paragraphs: ["These terms are governed by the laws of Malaysia."],
      },
      {
        heading: "Contact",
        paragraphs: ["Questions about these terms: " + mail + "."],
      },
    ],
  },
};

export const support: Record<LegalLocale, SupportDoc> = {
  id: {
    title: "Bantuan Waqtu",
    description:
      "Hubungi Waqtu dan temukan jawaban untuk pertanyaan umum: menghapus akun, membatalkan langganan, notifikasi adzan, lisensi Mac, dan Lingkaran.",
    intro:
      "Tanya langsung lewat email. Jawaban untuk pertanyaan yang paling sering datang ada di bawah.",
    contactHeading: "Hubungi kami",
    contactBody:
      "Tulis versi aplikasi dan jenis perangkatmu (misalnya Android 15 atau macOS 15) supaya kami bisa mengecek lebih cepat. Jangan kirim kunci lisensi atau kata sandi di email kecuali kami memintanya.",
    contactCta: "Kirim email",
    faqHeading: "Pertanyaan umum",
    linksHeading: "Dokumen",
    faq: [
      {
        question: "Bagaimana cara menghapus akun saya?",
        answer:
          'Di aplikasi ponsel: Pengaturan, bagian Akun, Hapus akun, lalu konfirmasi. Kalau muncul pesan untuk masuk ulang, keluar dulu, masuk lagi, lalu ulangi. Aplikasi Mac belum punya tombol ini; hapus lewat aplikasi ponsel atau kirim email. Detail apa yang terhapus ada di <a href="/privacy">Kebijakan Privasi</a>.',
      },
      {
        question: "Bagaimana cara membatalkan langganan Premium?",
        answer:
          "Lewat toko tempat kamu membeli. iPhone: Pengaturan, namamu, Langganan, Waqtu. Android: Google Play, Pembayaran dan langganan, Langganan, Waqtu. Aplikasi juga punya tombol Kelola langganan di layar Premium. Menghapus akun Waqtu tidak membatalkan langganan.",
      },
      {
        question: "Pembelianku tidak terdeteksi.",
        answer:
          "Masuk ke akun Waqtu di Pengaturan, buka layar Premium, lalu ketuk Pulihkan pembelian. Pastikan kamu memakai akun Apple atau Google yang sama dengan saat membeli.",
      },
      {
        question: "Saya punya lisensi Waqtu Mac. Bagaimana mendapat Premium di ponsel?",
        answer:
          "Masuk ke akun Waqtu, buka layar Premium, isi kunci lisensi di bagian Tautkan lisensi. Premium aktif seumur hidup untuk akun itu.",
      },
      {
        question: "Notifikasi adzan tidak berbunyi tepat waktu.",
        answer:
          "Cek izin notifikasi di Pengaturan aplikasi. Di Android, aktifkan juga izin alarm tepat waktu (baris yang muncul di Pengaturan Waqtu), dan keluarkan Waqtu dari penghemat baterai ketat jika ponselmu mematikan aplikasi di latar belakang.",
      },
      {
        question: "Waktu sholat berbeda beberapa menit dari masjid saya.",
        answer:
          "Ganti metode hisab dan mazhab ashar di Pengaturan, lalu tambahkan koreksi menit per waktu sholat jika masjidmu memakai ihtiyath. Waktu dihitung di perangkat dari lokasimu, jadi pastikan lokasinya benar.",
      },
      {
        question: "Apakah lokasi saya dikirim ke server?",
        answer:
          'Tidak. Waktu sholat dihitung di perangkatmu dan lokasi tidak ikut sinkron. Lingkaran hanya menyimpan selisih zona waktu dalam jam bulat. Rinciannya ada di <a href="/privacy">Kebijakan Privasi</a>.',
      },
      {
        question: "Rekaman hafalan atau refleksi halaqah saya hilang di ponsel baru.",
        answer:
          "Keduanya sengaja hanya disimpan di ponsel tempat kamu membuatnya, tidak ikut sinkron dan rekaman tidak ikut cadangan. Yang berpindah ke ponsel baru lewat sinkron adalah centang mutabaah dan pengaturan dasar.",
      },
      {
        question: "Saya salah memilih ikhwan atau akhwat di Lingkaran.",
        answer:
          "Pilihan itu terkunci setelah disimpan dan tidak bisa diubah dari aplikasi. Kirim email dan jelaskan situasimu; kami lihat kasusnya satu per satu.",
      },
      {
        question: "Bagaimana melaporkan atau memblokir kiriman di Lingkaran?",
        answer:
          "Ketuk menu opsi pada kiriman, lalu pilih Laporkan, Laporkan pengirim, atau Blokir pengirim. Kiriman yang dilaporkan tiga orang berbeda disembunyikan otomatis sambil menunggu tinjauan kami. Daftar blokir ada di profil lingkaranmu, tempat kamu bisa membuka blokir.",
      },
      {
        question: "Saya masuk lewat Apple dan emailku tersembunyi.",
        answer:
          "Itu pilihan Apple (Sembunyikan Email Saya). Kami menyimpan alamat relay yang diberikan Apple. Kalau kamu menghubungi kami soal akun, tulis dari alamat yang bisa kami cocokkan, atau sebutkan nama di profilmu.",
      },
    ],
  },
  en: {
    title: "Waqtu Support",
    description:
      "Contact Waqtu and find answers to common questions: deleting your account, cancelling a subscription, adhan notifications, Mac licenses and Circles.",
    intro: "Ask by email. Answers to the questions that come up most often are below.",
    contactHeading: "Contact us",
    contactBody:
      "Include your app version and device (for example Android 15 or macOS 15) so we can check faster. Do not send license keys or passwords by email unless we ask for them.",
    contactCta: "Send an email",
    faqHeading: "Common questions",
    linksHeading: "Documents",
    faq: [
      {
        question: "How do I delete my account?",
        answer:
          'In the phone app: Settings, the Account section, Delete account, then confirm. If it asks you to sign in again, sign out, sign in, and repeat. The Mac app has no such button yet; delete through the phone app or send an email. What gets removed is listed in the <a href="/en/privacy">Privacy Policy</a>.',
      },
      {
        question: "How do I cancel my Premium subscription?",
        answer:
          "In the store where you bought it. iPhone: Settings, your name, Subscriptions, Waqtu. Android: Google Play, Payments and subscriptions, Subscriptions, Waqtu. The app also has a Manage subscription button on the Premium screen. Deleting your Waqtu account does not cancel the subscription.",
      },
      {
        question: "My purchase is not showing up.",
        answer:
          "Sign in to your Waqtu account in Settings, open the Premium screen, and tap Restore purchases. Make sure you use the same Apple or Google account you bought with.",
      },
      {
        question: "I have a Waqtu Mac license. How do I get Premium on my phone?",
        answer:
          "Sign in to your Waqtu account, open the Premium screen, and enter the license key under Link license. Premium becomes lifetime for that account.",
      },
      {
        question: "Adhan notifications do not ring on time.",
        answer:
          "Check notification permission in the app's Settings. On Android, also allow exact alarms (the row that appears in Waqtu's Settings), and take Waqtu out of strict battery saving if your phone kills background apps.",
      },
      {
        question: "Prayer times differ by a few minutes from my mosque.",
        answer:
          "Change the calculation method and asr method in Settings, then add per-prayer minute offsets if your mosque uses precautionary minutes. Times are calculated on the device from your location, so check the location is right.",
      },
      {
        question: "Is my location sent to a server?",
        answer:
          'No. Prayer times are calculated on your device and location does not sync. Circles only stores a time zone offset in whole hours. Details are in the <a href="/en/privacy">Privacy Policy</a>.',
      },
      {
        question: "My hafalan recordings or halaqah reflections are gone on a new phone.",
        answer:
          "Both are stored only on the phone where you made them, on purpose. They do not sync and recordings are excluded from backups. What moves to a new phone through sync is the mutabaah checks and basic settings.",
      },
      {
        question: "I picked the wrong ikhwan or akhwat option in Circles.",
        answer:
          "The choice is locked once saved and cannot be changed in the app. Email us and describe the situation; we look at each case.",
      },
      {
        question: "How do I report or block a post in Circles?",
        answer:
          "Tap the options menu on the post, then choose Report, Report sender, or Block sender. A post reported by three different people is hidden automatically until we review it. Your blocked list is in your circle profile, where you can unblock.",
      },
      {
        question: "I signed in with Apple and my email is hidden.",
        answer:
          "That is Apple's Hide My Email choice. We store the relay address Apple gives us. If you contact us about an account, write from an address we can match, or tell us the name on your profile.",
      },
    ],
  },
};
