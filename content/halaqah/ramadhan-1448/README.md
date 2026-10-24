# Halaqah Ramadhan 1448 H — draft program untuk persetujuan owner (DEV-9)

Status: **DRAFT, belum disetujui owner. Tidak ada kode aplikasi di folder ini.**

Isi: 30 hari, satu kajian per hari (video YouTube resmi yang di-embed) + ringkasan, pertanyaan refleksi, dan satu amalan kecil, semuanya berbahasa Indonesia.

| File | Fungsi |
|---|---|
| `program.json` | Program 30 hari (`days`), definisi pekan (`program.phases`), dan `alternates` — video cadangan yang juga sudah diverifikasi lewat oEmbed untuk dipakai bila owner ingin mengganti hari tertentu. |
| `README.md` | Dokumen ini. |

## Garis editorial

Titik temu yang diterima empat mazhab. Program ini **tidak** memuat konten yang memihak dalam polemik internal umat (manhaj, takfir, politik praktis). Di mana fiqh berbeda, topik menampilkan posisi mazhab, bukan memilih satu:

- Setiap hari fiqh punya `madhhab_note_id` yang merangkum perbedaan (niat, qadha/fidyah, tarawih, i'tikaf, zakat fitrah, puasa Syawal). Hari non-fiqh bernilai `null`.
- Catatan yang berasal dari pengetahuan editor, bukan dari video, ditandai **"catatan editor"** di dalam teksnya dan harus dicek oleh orang yang paham fiqh sebelum rilis.
- Hari 3 sengaja memperkenalkan mengapa mazhab berbeda (Ust. Ahmad Sarwat, Rumah Fiqih) agar pengguna punya kerangka sebelum masuk ke topik fiqh.

## Alur 30 hari

Perkiraan 1 Ramadhan 1448 H ada di sekitar 8 Februari 2027; tanggal resmi mengikuti penetapan pemerintah.

| Pekan | Hari | Tema |
|---|---|---|
| 1 | 1–7 | Niat dan dasar fiqh puasa (tujuan puasa, niat, empat mazhab, makna Ramadhan, uzur/qadha/fidyah, pembatal, sahur) |
| 2 | 8–14 | Al-Quran dan kebiasaan tilawah (bulan Al-Quran, tadarus Nabi bersama Jibril, target khatam, isi Al-Quran, cara memahami, tarawih, adab doa) |
| 3 | 15–19 | Akhlaq dan tazkiyah (lisan, marah, sabar-syukur, taubat, ikhlas). Pekan ini 5 hari karena malam ke-21 sudah dimulai Maghrib hari ke-20. |
| 10 malam terakhir | 20–25 | I'tikaf (hari 20, pas sore sebelum malam ke-21), Lailatul Qadar (makna, waktu/tanda, amalan dan doa), qiyamul lail |
| Penutup | 26–30 | Zakat fitrah, zakat/sedekah, berdamai di hari raya, istiqamah setelah Ramadhan, puasa enam hari Syawal |

Catatan pemakaian: kajian hari ke-N sebaiknya dibuka **sebelum Maghrib hari ke-N** karena malamnya dihitung sebagai malam ke-(N+1).

## Daftar 30 hari

| Hari | Topik | Judul | Pembicara | Kanal | Menit | Video |
|---|---|---|---|---|---|---|
| 1 | tazkiyah | Mengapa Kita Berpuasa? Takwa sebagai Tujuan | Ust. Adi Hidayat, Lc., MA | [Adi Hidayat Official](https://www.youtube.com/@AdiHidayatOfficiaI) | 15 | [`m97SDRxy8GM`](https://www.youtube.com/watch?v=m97SDRxy8GM) |
| 2 | fiqh-puasa | Niat Puasa: Kapan, Bagaimana, dan Perbedaan Mazhab | Buya Yahya | [Buya Yahya](https://www.youtube.com/@buyayahyaofficial) | 16 | [`cuKJ0qrQ8fo`](https://www.youtube.com/watch?v=cuKJ0qrQ8fo) |
| 3 | fiqh-puasa | Mengapa Ada Empat Mazhab? Bekal Menyikapi Perbedaan | Ust. Ahmad Sarwat, Lc., MA | [Rumah Fiqih](https://www.youtube.com/@RumahFiqihIndonesia) | 38 | [`6OcMZ82xC04`](https://www.youtube.com/watch?v=6OcMZ82xC04) |
| 4 | tazkiyah | Makna Ramadhan: Iman, Ihtisab, dan Terhapusnya Dosa | Ust. Adi Hidayat, Lc., MA | [Adi Hidayat Official](https://www.youtube.com/@AdiHidayatOfficiaI) | 21 | [`hvDePKNlC2M`](https://www.youtube.com/watch?v=hvDePKNlC2M) |
| 5 | fiqh-puasa | Uzur Puasa, Qadha, dan Fidyah | Buya Yahya | [Buya Yahya](https://www.youtube.com/@buyayahyaofficial) | 27 | [`fmoYpPyC-zs`](https://www.youtube.com/watch?v=fmoYpPyC-zs) |
| 6 | fiqh-puasa | Sembilan Hal yang Membatalkan Puasa | Buya Yahya | [Buya Yahya](https://www.youtube.com/@buyayahyaofficial) | 24 | [`5C9EXa1lvG8`](https://www.youtube.com/watch?v=5C9EXa1lvG8) |
| 7 | fiqh-puasa | Rahasia Waktu Sahur | Ust. Adi Hidayat, Lc., MA | [Adi Hidayat Official](https://www.youtube.com/@AdiHidayatOfficiaI) | 28 | [`GQnVpeWZnao`](https://www.youtube.com/watch?v=GQnVpeWZnao) |
| 8 | quran | Ramadhan, Bulan Al-Quran: Dari Membaca ke Berdialog | Prof. Dr. M. Quraish Shihab | [Quraish Shihab](https://www.youtube.com/@QuraishShihabMuhammad) | 19 | [`VnHZ98jKFuA`](https://www.youtube.com/watch?v=VnHZ98jKFuA) |
| 9 | sirah | Amalan Nabi di Ramadhan: Tadarus bersama Jibril | Ust. Adi Hidayat, Lc., MA | [Adi Hidayat Official](https://www.youtube.com/@AdiHidayatOfficiaI) | 16 | [`e1RA5KWIr3U`](https://www.youtube.com/watch?v=e1RA5KWIr3U) |
| 10 | quran | Ramadhan Menang Banyak: Niat, Khatam, dan Dzikir | Ust. Hanan Attaki | [Hanan Attaki](https://www.youtube.com/@HananAttaki) | 25 | [`aaGStWKziUA`](https://www.youtube.com/watch?v=aaGStWKziUA) |
| 11 | quran | Tiga Pokok Kandungan Al-Quran | Prof. Dr. M. Quraish Shihab | [Quraish Shihab](https://www.youtube.com/@QuraishShihabMuhammad) | 25 | [`k6W0J9yy4Ss`](https://www.youtube.com/watch?v=k6W0J9yy4Ss) |
| 12 | quran | Tuntunan Memahami Al-Quran: Semangat Perlu Panduan | Gus Baha & Prof. Dr. M. Quraish Shihab | [Pusat Studi Al-Quran](https://www.youtube.com/@PusatStudiAlQuran) | 28 | [`szw85eYaqrw`](https://www.youtube.com/watch?v=szw85eYaqrw) |
| 13 | fiqh-puasa | Bilangan Rakaat Tarawih: Memahami Perbedaan Ulama | Buya Yahya | [Buya Yahya](https://www.youtube.com/@buyayahyaofficial) | 32 | [`DXrv1Crhua0`](https://www.youtube.com/watch?v=DXrv1Crhua0) |
| 14 | dua | Adab dan Etika Berdoa | Ust. Adi Hidayat, Lc., MA | [Adi Hidayat Official](https://www.youtube.com/@AdiHidayatOfficiaI) | 17 | [`LVzTX9Pdeu0`](https://www.youtube.com/watch?v=LVzTX9Pdeu0) |
| 15 | akhlaq | Larangan-larangan dalam Lisan | Aa Gym (KH. Abdullah Gymnastiar) | [Aagym Official](https://www.youtube.com/@AaGymOfficial) | 18 | [`p1I2ZO7dXaw`](https://www.youtube.com/watch?v=p1I2ZO7dXaw) |
| 16 | akhlaq | Marah dan Batasnya | Prof. Dr. M. Quraish Shihab | [Quraish Shihab](https://www.youtube.com/@QuraishShihabMuhammad) | 20 | [`wNMflmuZ_vg`](https://www.youtube.com/watch?v=wNMflmuZ_vg) |
| 17 | tazkiyah | Sabar Tanpa Tepi, Syukur Tanpa Tapi | Buya Yahya | [Buya Yahya](https://www.youtube.com/@buyayahyaofficial) | 26 | [`M-1c9y6QaUs`](https://www.youtube.com/watch?v=M-1c9y6QaUs) |
| 18 | tazkiyah | Cara Taubat di Bulan Ramadhan | Ust. Adi Hidayat, Lc., MA | [Adi Hidayat Official](https://www.youtube.com/@AdiHidayatOfficiaI) | 16 | [`8p_QF2LpaCs`](https://www.youtube.com/watch?v=8p_QF2LpaCs) |
| 19 | tazkiyah | Belajar Ikhlas agar Hati Tenang | Aa Gym (KH. Abdullah Gymnastiar) | [Aagym Official](https://www.youtube.com/@AaGymOfficial) | 34 | [`r1GQwM3hU9g`](https://www.youtube.com/watch?v=r1GQwM3hU9g) |
| 20 | fiqh-puasa | Persiapan I'tikaf 10 Hari Terakhir | Ust. Abdul Somad | [Ustadz Abdul Somad Official](https://www.youtube.com/@ustadzabdulsomadofficial) | 34 | [`p1X4sNMAodc`](https://www.youtube.com/watch?v=p1X4sNMAodc) |
| 21 | quran | Rahasia Lailatul Qadar: Al-Quran dan Takdir | Ust. Adi Hidayat, Lc., MA | [Adi Hidayat Official](https://www.youtube.com/@AdiHidayatOfficiaI) | 36 | [`fioT2GhmrXo`](https://www.youtube.com/watch?v=fioT2GhmrXo) |
| 22 | fiqh-puasa | Kapan Lailatul Qadar Tiba? Waktu, Tanda, dan Sikap | Buya Yahya | [Al-Bahjah TV](https://www.youtube.com/@albahjah-tv) | 35 | [`IhCGgFQ-9Bg`](https://www.youtube.com/watch?v=IhCGgFQ-9Bg) |
| 23 | dua | Amalan Malam Al-Qadr dan Doa Aisyah | Ust. Adi Hidayat, Lc., MA | [Adi Hidayat Official](https://www.youtube.com/@AdiHidayatOfficiaI) | 37 | [`tuJBglPWTmI`](https://www.youtube.com/watch?v=tuJBglPWTmI) |
| 24 | tazkiyah | Empat Tingkatan Qiyamul Lail di Sepuluh Malam Terakhir | Ust. Muhammad Nuzul Dzikri | [Muhammad Nuzul Dzikri](https://www.youtube.com/@MuhammadNuzulDzikri) | 23 | [`kHmlHfqP8gE`](https://www.youtube.com/watch?v=kHmlHfqP8gE) |
| 25 | tazkiyah | Ikhtiar Meraih Lailatul Qadar dengan Keterbatasan Kita | Aa Gym (KH. Abdullah Gymnastiar) | [Aagym Official](https://www.youtube.com/@AaGymOfficial) | 33 | [`h5s9ZDe-ipY`](https://www.youtube.com/watch?v=h5s9ZDe-ipY) |
| 26 | fiqh-puasa | Panduan Zakat Fitrah: Waktu, Siapa, dan Penyalurannya | Buya Yahya | [Al-Bahjah TV](https://www.youtube.com/@albahjah-tv) | 22 | [`GBJs-bIrYLA`](https://www.youtube.com/watch?v=GBJs-bIrYLA) |
| 27 | tazkiyah | Zakat, Sedekah, dan Infak: Menyucikan Jiwa dan Harta | Prof. Dr. M. Quraish Shihab | [Quraish Shihab](https://www.youtube.com/@QuraishShihabMuhammad) | 19 | [`ZaDr3fxaCOU`](https://www.youtube.com/watch?v=ZaDr3fxaCOU) |
| 28 | akhlaq | Hari Raya Momen Berdamai | Buya Yahya | [Al-Bahjah TV](https://www.youtube.com/@albahjah-tv) | 22 | [`tVf8mSBeo8c`](https://www.youtube.com/watch?v=tVf8mSBeo8c) |
| 29 | tazkiyah | Setelah Ramadhan Berakhir: Jangan Turun Lagi | Prof. Dr. M. Quraish Shihab | [Quraish Shihab](https://www.youtube.com/@QuraishShihabMuhammad) | 18 | [`fBFMfoaA8AA`](https://www.youtube.com/watch?v=fBFMfoaA8AA) |
| 30 | fiqh-puasa | Puasa Enam Hari Syawal: Hitungan Pahala dan Pandangan Mazhab | Ust. Ahmad Zarkasih, Lc. | [Rumah Fiqih](https://www.youtube.com/@RumahFiqihIndonesia) | 18 | [`pn6aMJdZHQQ`](https://www.youtube.com/watch?v=pn6aMJdZHQQ) |

Distribusi topik: fiqh-puasa 10, tazkiyah 9, quran 5, akhlaq 3, dua 2, sirah 1. Topik 'fiqh-puasa' juga dipakai untuk fiqh ibadah Ramadhan lain (tarawih, i'tikaf, zakat fitrah, tanda dan waktu Lailatul Qadar, puasa Syawal) karena enum topik tidak punya kategori terpisah.

## Pembicara dan alasan dipilih

| Pembicara | Hari | Kenapa cocok |
|---|---|---|
| Ust. Adi Hidayat (Adi Hidayat Official) | 1, 4, 7, 9, 14, 18, 21, 23 | Sangat luas jangkauannya; kajian sistematis berbasis Al-Quran dan hadis (Kitabush Shaum Sahih Bukhari, Akusuka); gaya runtut untuk penonton umum. |
| Buya Yahya (Buya Yahya dan Al-Bahjah TV) | 2, 5, 6, 13, 17, 22, 26, 28 | Fikih mazhab Syafi'i yang rapi dan sering menyebut pendapat mazhab lain (niat sebulan Maliki, zakat fitrah dengan uang Hanafi, perbedaan jumlah rakaat tarawih). Dipakai hanya untuk fiqh dan akhlaq, bukan konten polemik. |
| Prof. Dr. M. Quraish Shihab (Quraish Shihab, Pusat Studi Al-Quran) | 8, 11, 12, 16, 27, 29 | Mufasir Indonesia yang paling diterima lintas kelompok (Tafsir Al-Mishbah); nada moderat dan mendidik; cocok untuk tema Al-Quran dan akhlaq. |
| Gus Baha (bersama Prof. Quraish, kanal Pusat Studi Al-Quran) | 12 | Ulama pesantren yang luas penerimaannya; memberi sudut pandang tradisi ilmu tafsir. |
| Aa Gym (Aagym Official) | 15, 19, 25 | Akhlaq dan tazkiyah dengan bahasa sehari-hari; sudah lama menjadi rujukan tema lisan, hati, dan ikhlas. |
| Ust. Hanan Attaki (Hanan Attaki) | 10 | Gaya anak muda; menjangkau pengguna yang lebih muda dengan tips praktis menjaga target Ramadhan. |
| Rumah Fiqih (Ust. Ahmad Sarwat, Ust. Ahmad Zarkasih) | 3, 30 | Lembaga kajian fiqh perbandingan mazhab; paling tepat untuk menampilkan posisi empat mazhab tanpa memihak. |
| Ust. Abdul Somad (Ustadz Abdul Somad Official) | 20 | Populer luas; membahas i'tikaf dengan rujukan Syafi'i dan Maliki serta praktik langsung. Lihat catatan kekhawatiran di bawah. |
| Ust. Muhammad Nuzul Dzikri (Muhammad Nuzul Dzikri) | 24 | Kajian hadis (Riyadhush Shalihin) dengan penonton luas dan berusia muda; membawa penjelasan qiyamul lail praktis. |

Sepuluh kanal berbeda tampil di 30 hari, tetapi Adi Hidayat (8) dan Buya Yahya (8) memegang 16 dari 30 hari. Pembagian ini sengaja karena keduanya paling konsisten bergaya fiqh/ibadah, namun owner bisa memakai `alternates` untuk meratakannya.

## Catatan lisensi: embed saja

- Semua video hanya **di-embed lewat pemutar YouTube resmi** (`youtube.com/embed/<id>`, sebaiknya `youtube-nocookie.com`) dari kanal pembicara atau lembaganya sendiri. Tidak ada video yang diunduh, diunggah ulang, dipotong, atau dipisah audionya.
- Verifikasi oEmbed berhasil untuk semua video (YouTube mengembalikan galat bila embedding dimatikan), jadi embed diizinkan oleh pemilik kanal saat verifikasi dilakukan.
- Tampilkan nama pembicara dan tautan ke kanal asli di setiap hari. Jangan menutupi iklan atau atribusi dari pemutar.
- Ringkasan, pertanyaan refleksi, dan amalan adalah teks orisinal kami (diparafrasekan dengan kata-kata sendiri); tidak menyalin transkrip.
- Disarankan memberi tahu atau meminta izin tertulis kepada kanal terkait untuk ditampilkan di aplikasi komersial, bukan karena embed dilarang, tetapi demi hubungan baik dan untuk antisipasi bila ada kanal yang tidak berkenan.
- Video bisa dihapus atau dijadikan privat oleh pemiliknya kapan saja. Sebelum rilis, jalankan ulang pemeriksaan oEmbed dan sediakan fallback (`alternates`).

## Cara verifikasi

- `youtube_id`, `verified_title`, `channel_name`, dan `channel_url` disalin persis dari `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=<id>&format=json` pada 2026-10-24 (dicek ulang untuk 30 video sesaat sebelum commit).
- Durasi diambil dari metadata YouTube (`yt-dlp`) dan dibulatkan ke menit; seluruhnya antara 15 dan 45 menit.
- Ringkasan disusun dari **transkrip otomatis (auto-caption) berbahasa Indonesia** dan judul. Kualitas auto-caption untuk istilah Arab kurang baik, jadi ringkasan hanya memuat hal yang terbaca jelas. Referensi ayat/hadis pada `sources` diberi keterangan "(disebut di video)" bila terdeteksi di transkrip, atau "(rujukan tema)" bila hanya rujukan umum topiknya. Video tidak ditonton penuh oleh penyusun draft; owner atau reviewer sebaiknya mengecek sampel.
- Semua video juga dipindai kata kunci sensitif (wahabi, syiah, kafir, sesat, liberal, politik, pemerintah, khilafah, presiden, Israel, dst.). Temuan yang relevan tercantum di bagian kekhawatiran di bawah.

## Kekhawatiran dan hal yang perlu diputuskan

1. **Hari 13 (tarawih, Buya Yahya)** menegaskan 20 rakaat dan 8 rakaat sama-sama bukan bid'ah, tetapi cenderung memperkuat 20. Teksnya sudah menampilkan posisi mazhab; owner perlu memutuskan apakah ini cukup netral atau ingin dipasangkan dengan sumber 8+3.
2. **Hari 12 (Gus Baha dan Prof. Quraish)** padat, bergaya pesantren, dan di tengah ada sindiran ringan tentang kalangan "tekstualis". Informatif, tetapi berat untuk pemula. Alternatif: episode lain Tafsir Al-Mishbah.
3. **Hari 16** memuat iklan sisipan (Sun Life Syariah, cariustad.id) di dalam video; **hari 28** adalah program TV dengan tanya jawab santri dan sapaan di penghujung.
4. **Hari 20 (Ust. Abdul Somad)**: video ini bersih dari kata kunci sensitif, tetapi beliau pernah menjadi sumber kontroversi di luar video ini. Bila owner ingin menghindarinya, pakai cadangan Buya Yahya (`uMtNTeZL_aM`).
5. **Hari 24 (Nuzul Dzikri)** memuat doa untuk Palestina di bagian pembuka dan mengutip pendapat Syekh Utsaimin tentang tingkatan qiyamul lail. Bukan polemik, tetapi owner mungkin ingin tahu.
6. **Hari 26 (zakat fitrah)** menjelaskan perbedaan mazhab dengan jelas; tetapi penyampaian dari sisi Syafi'i. Takaran dalam kg (2,4–2,8) adalah penyampaian pembicara; nilai pastinya diperselisihkan.
7. **Hari 27** tidak memakai episode zakat profesi (Quraish Shihab) karena kategori itu adalah ijtihad kontemporer yang ditolak sebagian ulama; dipilih pembahasan konsep zakat/sedekah/infak.
8. **Hari 21 (NU Online)** tidak dipilih karena memuat beberapa riwayat yang perlu dicek kekuatannya; tersedia di `alternates` bila owner ingin suara NU.
9. **Perbedaan fiqh yang perlu pengecekan oleh orang berilmu**: kolom `madhhab_note_id` di hari 2, 5, 13, 20, 22, 26, 30. Terutama klaim yang bertanda "catatan editor" (Hanafi pada niat, Maliki 36 rakaat tarawih, Hanafi dan Hanbali pada i'tikaf).
10. **Auto-caption**: pencocokan istilah Arab sering keliru. Mohon owner sampling beberapa ringkasan terhadap video.
11. **Waktu rilis harian**: kalender Ramadhan 1448 harus dicocokkan dengan keputusan pemerintah (1 Ramadhan bisa bergeser sehari).
12. **Sirah hanya eksplisit di hari 9** (Nabi dan Jibril bertadarus). Tema sirah lain, seperti sejarah Ramadhan di zaman Nabi (Badar, Fathu Makkah), belum ada. Owner bisa meminta penambahan bila ingin porsi sirah lebih besar.

## Checklist persetujuan owner

- [ ] Garis editorial di atas sesuai (tidak ada kontroversi intra-umat; fiqh ditampilkan multi-mazhab).
- [ ] Daftar 10 kanal / 10 pembicara dapat diterima; keputusan soal Ust. Abdul Somad (hari 20) dan Buya Yahya/Adi Hidayat yang dominan.
- [ ] Alur 30 hari sesuai (pekan 1 niat/fiqh, pekan 2 Al-Quran, pekan 3 akhlaq, 10 malam terakhir, zakat fitrah dan Syawal).
- [ ] Setiap hari fiqh: `madhhab_note_id` sudah dicek orang yang paham fiqh (terutama hari 2, 5, 13, 20, 22, 26, 30).
- [ ] Sampel ringkasan dicek terhadap video (disarankan minimal hari 3, 13, 20, 26, 30).
- [ ] Pendekatan embed-only dan kebijakan atribusi disetujui; keputusan apakah meminta izin kanal secara tertulis.
- [ ] Pasangan alternatif yang diinginkan sudah dipilih dari `alternates` (atau tidak ada).
- [ ] Format `program.json` dapat langsung dipakai tim aplikasi (field: `day`, `theme_id`, `title_id`, `title_en`, `topic`, `video.*`, `summary_id`, `reflection_prompt_id`, `amalan_id`, `sources`, serta tambahan `phase` dan `madhhab_note_id`).
- [ ] Tanggal rilis harian dicocokkan dengan kalender resmi Ramadhan 1448.
