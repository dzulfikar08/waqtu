# Waqtu mobile launch plan

Scope: the iOS and Android phone app (`apps/mobile`). Positioning: **Halaqah tanpa macet**. Prayer times, mutabaah yaumiyah and asynchronous halaqah for busy and introverted Muslims. Location never leaves the device, the code is open source.

Dates that drive the plan (Ramadan dates follow the app's own calculation, Indonesia may start a day later):

| Date         | Event                                      |
| ------------ | ------------------------------------------ |
| 15 Jan 2027  | Store submission target (App Store + Play) |
| ~8 Feb 2027  | Ramadan 1448H day 1                        |
| ~24 Feb 2027 | 17 Ramadan                                 |
| ~9 Mar 2027  | Eid al-Fitr                                |

Store listing copy lives in `apps/mobile/store/`. Screenshots come from the `Store screenshots` workflow.

## Rules for every post

- Say only what the app does today. Halaqah circles need an account and Premium; the Ramadan halaqah program stays out of posts until its content is approved.
- Real screenshots only (from the screenshot workflow), no mockups with invented numbers, no testimonials until a real user has said it.
- One call to action per post: join the waitlist (before launch) or open the store link (after).
- Indonesian first, English for the Threads/IG carousels that travel internationally.
- Track each link with a UTM: `utm_source=threads|ig|tiktok|yt`, `utm_campaign=mar3-launch`.

## Content calendar, Dec 2026 to Mar 2027

Cadence: Threads 4 posts per week, Instagram 2 feed + stories, TikTok 3 per week, YouTube Shorts reuse the TikTok cut. One long-form idea per week gets split into all four channels.

| Period             | Theme                    | Threads (text, replies)                                                                      | IG (carousel/Reels)                                                | TikTok / Shorts (15-40 s)                                        |
| ------------------ | ------------------------ | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------- |
| 1-14 Dec           | The problem              | "Halaqah itu bagus, tapi macet dan jadwal bentrok." Ask followers how they keep consistency. | Carousel: 5 reasons halaqah gets skipped                           | Screen-recorded day of a busy commuter ticking the checklist     |
| 15-31 Dec          | Build in public          | Weekly dev log: what shipped, what broke. Show the open repo.                                | Carousel: how prayer times are calculated on the phone             | Short: "Lokasimu tidak ke mana-mana" with the privacy explainer  |
| 1-14 Jan           | Waitlist push            | Waitlist link pinned. Poll: ikhwan/akhwat circles, anonymous or named?                       | Reel: Today tab walkthrough, id captions                           | Short: streak with grace days ("satu hari terlewat bukan akhir") |
| 15-31 Jan          | Submitted + Ramadan prep | "Sudah kami kirim ke App Store dan Play." Share the review status honestly.                  | Carousel: Ramadan planner (imsakiyah, khatam, qadha, zakat)        | Short: khatam target that rebalances when you fall behind        |
| 1-7 Feb            | Countdown to Ramadan     | Daily "H-7 ... H-1" posts with one feature each.                                             | Story series H-7 to H-1, countdown sticker                         | Short: iftar countdown on lock screen                            |
| 8-28 Feb (Ramadan) | Launch and daily use     | Daily reflection prompt tied to the app (no reposting of unapproved halaqah content).        | 2 posts per week: imsakiyah image share, khatam progress           | 3 per week: tarawih/tadarus tracking, last ten nights marker     |
| 1-9 Mar            | Last ten nights and Eid  | Zakat fitrah reminder post, thank-you thread, ask for store reviews.                         | Carousel: "what we learned in the first month" (real numbers only) | Short: Eid zakat calculator walkthrough                          |
| 10-31 Mar          | After Ramadan            | Retention: "amalan setelah Ramadhan" prompts, changelog threads.                             | Carousel: using the voluntary fasting item for Syawal fasts        | Short: how to keep one practice after Ramadan                    |

Review the calendar on the first of each month against real analytics (Revklik) and drop formats that got no saves or replies.

## Waitlist email sequence (id)

Sent to the getwaqtu.com waitlist. Plain text, one link each, unsubscribe line in the footer. Subject lines are suggestions. The one bracketed line in email 2 must be filled with the real store status at send time.

### Email 1: Terima kasih sudah daftar (send immediately after sign-up)

Subject: Kamu masuk daftar tunggu Waqtu

> Assalamu'alaikum,
>
> Terima kasih sudah mendaftar. Waqtu adalah aplikasi waktu sholat dan mutabaah yaumiyah untuk kamu yang jadwalnya padat. Waktu sholat dihitung di ponselmu, lokasimu tidak dikirim ke server, dan kodenya terbuka di github.com/dzulfikar08/waqtu.
>
> Rencananya aplikasi rilis di iOS dan Android sebelum Ramadhan 1448H. Kami akan kirim satu email lagi menjelang rilis dan satu saat aplikasi sudah bisa diunduh. Selain itu tidak ada email.
>
> Kalau ada fitur yang paling kamu tunggu, balas email ini. Kami baca semuanya.
>
> Tim Waqtu

### Email 2: Seminggu sebelum Ramadhan (send ~1 Feb 2027)

Subject: Ramadhan tinggal seminggu: ini yang sudah siap

> Assalamu'alaikum,
>
> Ramadhan 1448H dimulai sekitar 8 Februari 2027. Di Waqtu sudah ada:
>
> - hitung mundur imsak dan iftar, termasuk di layar kunci jika perangkatmu mendukung
> - jadwal imsakiyah sebulan yang bisa dibagikan sebagai gambar
> - rencana khatam dengan target harian yang menyesuaikan kalau kamu tertinggal
> - catatan puasa, tarawih, tadarus, dan i'tikaf, pelacak qadha, dan kalkulator zakat fitrah
>
> Waktu sholat dan mutabaah dasar gratis, tanpa iklan. [State the real store status here: "sudah tersedia" with links, or "masih dalam review" with the expected date from the store.]
>
> Tim Waqtu

### Email 3: Sudah bisa diunduh (send the day both stores are live)

Subject: Waqtu sudah ada di App Store dan Google Play

> Assalamu'alaikum,
>
> Waqtu sudah bisa diunduh:
>
> - iPhone: https://apps.apple.com/id/app/id6826628861
> - Android: https://play.google.com/store/apps/details?id=dat.waqtu.app
>
> Mulai dari tab Hari ini: pilih kota atau izinkan lokasi, lalu centang amalan pertamamu. Masuk akun itu opsional dan hanya perlu untuk sinkron dan lingkaran halaqah (Premium).
>
> Kalau Waqtu terasa berguna, ulasan singkat di toko sangat membantu orang lain menemukannya. Kalau ada yang salah atau kurang, balas email ini.
>
> Tim Waqtu

## Kajian channel outreach

Goal: ask kajian channels and ustadz whether they want to hand their audience a tool, not to buy reach. Nothing is posted in their name without their approval, and the halaqah program content stays out until it is approved.

1. **List (Dec 2026).** 30 channels in a sheet: YouTube/IG kajian accounts, masjid-run channels, campus LDK accounts. Columns: channel, audience size (public number), language, contact, last contact, status. Prefer channels whose audience is commuters, students and young professionals.
2. **Pitch (first 10 days of Jan 2027).** Short DM or email in Indonesian: who we are, one screenshot, the open-source and privacy facts, what we ask (try it, tell us what is wrong). No payment offered, no promise of coverage.
3. **Ask (after submission, late Jan).** For channels that replied: a Ramadan imsakiyah image with their channel name on request, and a link to the store page. A free Premium period is offered only if it can be set up in the stores first; do not promise it before then.
4. **Follow-up (Ramadan).** One message in week 2 with what changed from their feedback. Stop after two unanswered messages.
5. **Log.** Every contact and reply goes into the sheet. Link clicks come from a per-channel UTM (`utm_source=kajian-<channel>`).

## Launch day checklist

Before:

- [ ] Both stores show status "ready for sale" / "published", checked on a real device by searching "Waqtu".
- [ ] Listing copy, keywords and screenshots match `apps/mobile/store/`.
- [ ] Privacy policy at getwaqtu.com/privacy covers the phone app (sync, circles, microphone) and matches the store privacy answers.
- [ ] Premium purchase tested with a sandbox tester (App Store) and a license tester (Play); restore purchase works.
- [ ] Production API reachable from the release build (`api.getwaqtu.com`): sign-in, sync and entitlement check.
- [ ] Landing page store badges point at the live listings; waitlist form still works.
- [ ] Support inbox (dzulfikar.at@gmail.com) watched; saved replies for the five most likely questions (prayer times differ from the mosque, Hijri date off by one, adhan not arriving on Android, Premium restore, account deletion).
- [ ] Email 3 scheduled, social posts queued with UTM links.

On the day:

- [ ] Send email 3 to the waitlist.
- [ ] Post on Threads, Instagram, TikTok and YouTube Shorts with the store links.
- [ ] DM the kajian channels that replied.
- [ ] Reply to every comment and review within the day.
- [ ] Check crash and error logs every few hours; hold new marketing if sign-in or sync is failing.

After (days 1 to 7):

- [ ] Daily: store ratings, crash-free sessions, support mail, Revklik traffic by UTM.
- [ ] Day 3: thank-you post with only real numbers.
- [ ] Day 7: write down what to change in the next release, grouped by what users said.
