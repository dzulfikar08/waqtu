# App Store Connect — Submission Metadata

Draft copy for App Store Connect. Review and adjust wording/pricing before pasting in.

---

## iOS app — `dat.waqtu.ios` (Waqtu)

**App Name** (≤30)

```
Waqtu
```

**Subtitle** (≤30)

```
Prayer times and streaks
```

**Promotional Text** (≤170, update anytime)

```
See the next prayer countdown at a glance, track your prayer streak, and stay consistent — all calculated privately on your device.
```

**Description** (≤4000)

```
Waqtu is a calm, privacy-first prayer-time companion. It shows the next prayer countdown, today's full schedule, and your prayer streak — and keeps everything in sync across your Mac, iPhone, and Apple Watch.

KEY FEATURES
• Next-prayer countdown, always one glance away
• Today's five daily prayers with Hijri date
• Prayer streak tracker with a weekly view and today's progress
• 13 calculation methods (MWL, ISNA, Egyptian, Umm al-Qura, Karachi, Dubai, Qatar, Kuwait, Singapore, Tehran, Turkey, Moonsighting Committee, Custom)
• Hanafi and Shafi'i Asr calculation
• Per-prayer minute adjustments
• iCloud sync of your settings and streak across your own devices

PRIVACY FIRST
Prayer times are calculated on your device from your coordinates — your location never leaves your phone. No analytics, no ads, no trackers.

Waqtu works fully standalone on iPhone. Pair it with the Waqtu Mac app for calendar "busy" protection, reminders, and the full-screen prayer overlay.

Apple Watch app and home-screen widgets included.
```

**Keywords** (≤100, comma-separated, no spaces)

```
prayer times,adhan,salah,namaz,islamic,muslim,mosque,quran,ramadan,hijri,dua,prayer reminder,azan
```

**Primary Category**: Lifestyle
**Secondary Category**: Utilities

**What's New** (v1.0)

```
Welcome to Waqtu for iPhone — prayer times, countdown, and streaks, synced across your devices via iCloud. Includes Apple Watch app and widgets.
```

**App Review Notes**

```
The app calculates prayer times on-device from location; no login or account is required. Grant Location access for accurate local times, or it falls back to default coordinates. iCloud sync is optional and only moves data between the user's own devices. The Apple Watch companion bundle id is dat.waqtu.ios.watch; the widget extension is dat.waqtu.ios.widget.
```

**Privacy Policy URL**: host `docs/PRIVACY.md` at e.g. `https://getwaqtu.com/privacy`

**Screenshots required**: 6.7" iPhone (iPhone 15 Pro Max) at minimum; 6.5"/5.5" accepted from the same source.

---

## Mac App Store app — `dat.waqtu` (Waqtu for Mac, 6827054953)

The listing lives in `apps/apple/store/appstore` (`id/` primary, `en/`, `review_notes.txt`) and is pushed with
`.github/workflows/store-submit.yml` (platform `mac`), together with the screenshots of `mas-screenshots.yml` and the
subscriptions `dat.waqtu.mac.premium.monthly` / `.yearly` (group "Waqtu Premium", Rp 29.000 / Rp 249.000). App Privacy
is not available to API keys; it is answered by hand in App Store Connect.

---

## Pricing notes

- Mac App Store: the same Waqtu Premium prices as the phone apps (Rp 29.000 / Rp 249.000).
- The direct-download build sells nothing; it unlocks with a subscribed Waqtu account.
