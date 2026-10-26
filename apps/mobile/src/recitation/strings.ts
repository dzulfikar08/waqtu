/**
 * Copy for the recitation check (developer feature) and the About screen. Spread into the app
 * locales as the `recitation` and `about` keys.
 */
export const recitationId = {
  title: "Cek bacaan (eksperimen)",
  hint: "Fitur pengembang. Bacaanmu direkam, ditranskripsi di ponsel ini (tanpa internet setelah model diunduh), lalu dibandingkan kata demi kata dengan teks. Audionya dihapus setelah ditranskripsi.",
  model: "Model",
  models: {
    base: "Tarteel whisper-base ({{mb}} MB)",
    tiny: "Tarteel whisper-tiny, ringan ({{mb}} MB)",
  },
  download: "Unduh model ({{mb}} MB)",
  downloading: "Mengunduh {{percent}}% ({{done}} dari {{total}} MB)",
  paused: "Unduhan dijeda di {{percent}}%",
  pause: "Jeda",
  resume: "Lanjutkan",
  cancel: "Batal",
  verifying: "Memeriksa SHA-256 berkas {{percent}}%",
  ready: "Model siap. Pemeriksaan berjalan tanpa internet.",
  deleteModel: "Hapus model",
  deleteTitle: "Hapus model?",
  deleteBody: "{{mb}} MB dibebaskan. Unduh lagi untuk memakai cek bacaan.",
  failed: {
    network: "Unduhan gagal. Periksa koneksi lalu coba lagi.",
    checksum:
      "Berkas model tidak cocok dengan SHA-256 yang diharapkan dan sudah dihapus. Coba unduh lagi.",
    storage: "Model tidak bisa disimpan. Kosongkan ruang penyimpanan lalu coba lagi.",
  },
  retry: "Coba lagi",
  meteredTitle: "Tidak tersambung ke Wi-Fi",
  meteredBody: "Model berukuran {{mb}} MB. Tetap unduh dengan data seluler?",
  meteredGo: "Unduh",
  offline: "Tidak ada koneksi internet. Model perlu diunduh sekali.",
  start: "Cek bacaan",
  recording: "Merekam {{time}}",
  stop: "Selesai & periksa",
  transcribing: "Mentranskripsi di ponsel… {{percent}}%",
  transcribeFailed: "Transkripsi gagal. Coba lagi atau pakai model ringan.",
  recordDenied: "Izin mikrofon ditolak. Aktifkan di pengaturan sistem.",
  recordFailed: "Rekaman gagal. Coba lagi.",
  counts:
    "{{correct}} dari {{words}} kata cocok · {{skipped}} terlewat · {{substituted}} tertukar · {{inserted}} tambahan",
  jump: "Di ayat {{at}} membaca ayat {{from}}",
  legend:
    "Merah bergaris bawah: kata terlewat. Oranye: kata tertukar. Nomor ayat merah: lompat ke ayat lain.",
  heard: "Terdengar: {{text}}",
  timing: "Transkripsi {{seconds}} dtk untuk {{audio}} dtk rekaman",
  hide: "Sembunyikan hasil",
  export_one: "Bagikan {{count}} transkrip (manifest eval)",
  export_other: "Bagikan {{count}} transkrip (manifest eval)",
  exportTitle: "Manifest cek bacaan",
  exportUnavailable: "Berbagi tidak tersedia di perangkat ini.",
  clearChecks: "Hapus transkrip tersimpan",
} as const;

type Widen<T> = { [K in keyof T]: T[K] extends string ? string : Widen<T[K]> };

export const recitationEn: Widen<typeof recitationId> = {
  title: "Check recitation (experimental)",
  hint: "Developer feature. Your recitation is recorded, transcribed on this phone (offline once the model is downloaded) and compared word by word with the text. The audio is deleted once transcribed.",
  model: "Model",
  models: {
    base: "Tarteel whisper-base ({{mb}} MB)",
    tiny: "Tarteel whisper-tiny, light ({{mb}} MB)",
  },
  download: "Download model ({{mb}} MB)",
  downloading: "Downloading {{percent}}% ({{done}} of {{total}} MB)",
  paused: "Download paused at {{percent}}%",
  pause: "Pause",
  resume: "Resume",
  cancel: "Cancel",
  verifying: "Checking the file's SHA-256 {{percent}}%",
  ready: "Model ready. Checks run offline.",
  deleteModel: "Delete model",
  deleteTitle: "Delete the model?",
  deleteBody: "Frees {{mb}} MB. Download it again to use the recitation check.",
  failed: {
    network: "The download failed. Check your connection and try again.",
    checksum:
      "The model file did not match its expected SHA-256 and was deleted. Try downloading again.",
    storage: "Couldn't save the model. Free some storage and try again.",
  },
  retry: "Try again",
  meteredTitle: "Not on Wi-Fi",
  meteredBody: "The model is {{mb}} MB. Download it over mobile data?",
  meteredGo: "Download",
  offline: "No internet connection. The model has to be downloaded once.",
  start: "Check recitation",
  recording: "Recording {{time}}",
  stop: "Done & check",
  transcribing: "Transcribing on this phone… {{percent}}%",
  transcribeFailed: "Transcription failed. Try again or use the light model.",
  recordDenied: "Microphone permission was denied. Enable it in system settings.",
  recordFailed: "Recording failed. Try again.",
  counts:
    "{{correct}} of {{words}} words match · {{skipped}} skipped · {{substituted}} replaced · {{inserted}} extra",
  jump: "At ayah {{at}} recited ayah {{from}}",
  legend:
    "Red underlined: skipped word. Orange: replaced word. Red ayah number: jumped to another ayah.",
  heard: "Heard: {{text}}",
  timing: "Transcribed in {{seconds}} s for {{audio}} s of audio",
  hide: "Hide results",
  export_one: "Share {{count}} transcript (eval manifest)",
  export_other: "Share {{count}} transcripts (eval manifest)",
  exportTitle: "Recitation check manifest",
  exportUnavailable: "Sharing isn't available on this device.",
  clearChecks: "Delete stored transcripts",
};

export const aboutId = {
  row: "Tentang & lisensi",
  title: "Tentang Waqtu",
  version: "Versi {{version}}",
  licences: "Lisensi",
  quran:
    "Teks Al-Qur'an: Tanzil Project (tanzil.net), Uthmani 1.1, dipakai tanpa perubahan sesuai ketentuan Tanzil.",
  font: "Huruf Al-Qur'an: Amiri Quran, SIL Open Font License 1.1.",
  adhkar:
    "Dzikir pagi & petang, Al-Ma'tsurat (wirid susunan Imam Hasan al-Banna, kubro dan sughro), doa harian, dan bacaan tasbih: dari aplikasi Mutabaah (pengembang yang sama), dipakai tanpa perubahan. Teks Arab ditampilkan apa adanya. Terjemahan mengikuti bahasa yang ada di sumbernya: Al-Ma'tsurat berbahasa Indonesia; dzikir, doa dan tasbih berbahasa Inggris. Rujukan hadits tampil di tiap bacaan yang memilikinya.",
  models:
    "Model pengenal bacaan (diunduh hanya saat cek bacaan dipakai): tarteel-ai/whisper-base-ar-quran dan tarteel-ai/whisper-tiny-ar-quran oleh Tarteel AI, dikonversi ke ggml oleh sadrapp dan ram-a-dhan. Dilisensikan di bawah Apache License 2.0; berkas dipakai tanpa perubahan. Model dasar Whisper oleh OpenAI (MIT).",
  apache: "Baca Apache License 2.0",
  runtime: "whisper.rn dan whisper.cpp: MIT License.",
  developer: "Pengembang",
  recitationCheck: "Cek bacaan (eksperimen)",
  recitationCheckHint:
    "Menampilkan cek bacaan di layar hafalan. Model diunduh saat pertama dipakai.",
  devUnlocked: "Menu pengembang aktif.",
} as const;

export const aboutEn: Widen<typeof aboutId> = {
  row: "About & licences",
  title: "About Waqtu",
  version: "Version {{version}}",
  licences: "Licences",
  quran:
    "Quran text: Tanzil Project (tanzil.net), Uthmani 1.1, used unmodified under Tanzil's terms.",
  font: "Quran font: Amiri Quran, SIL Open Font License 1.1.",
  adhkar:
    "Morning & evening dhikr, Al-Ma'thurat (the wird compiled by Imam Hasan al-Banna, kubro and sughro), daily duas and the tasbih phrases: from the Mutabaah app (same developer), used unmodified. Arabic text is shown exactly as stored. Translations are in the language of the source: Al-Ma'thurat in Indonesian; dhikr, duas and tasbih in English. Hadith references are shown on every text that has one.",
  models:
    "Recitation recognition models (downloaded only when the recitation check is used): tarteel-ai/whisper-base-ar-quran and tarteel-ai/whisper-tiny-ar-quran by Tarteel AI, converted to ggml by sadrapp and ram-a-dhan. Licensed under the Apache License 2.0; the files are used unmodified. Base Whisper model by OpenAI (MIT).",
  apache: "Read the Apache License 2.0",
  runtime: "whisper.rn and whisper.cpp: MIT License.",
  developer: "Developer",
  recitationCheck: "Check recitation (experimental)",
  recitationCheckHint:
    "Shows the recitation check on the hafalan screen. The model downloads on first use.",
  devUnlocked: "Developer menu on.",
};
