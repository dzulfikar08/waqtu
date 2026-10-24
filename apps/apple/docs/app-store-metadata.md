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

## Mac App Store app — `dat.waqtu` (Waqtu)

**App Name**

```
Waqtu
```

**Subtitle** (≤30)

```
Prayer times in your menu bar
```

**Description** (≤4000)

```
Waqtu lives in your Mac's menu bar and protects your prayer time at work.

• Next-prayer countdown always visible in the menu bar
• Calendar protection — automatic "busy" blocks during prayers so Outlook, Teams, and calendar apps show you as unavailable
• Full-screen prayer reminder overlay with a circular countdown timer
• Pre-prayer notifications (5/10/15/30 minutes before)
• Adhan audio playback
• Prayer streak tracking with a weekly report
• Daily hadith and dua in the reminder overlay
• 13 calculation methods, Hanafi/Shafi'i Asr, per-prayer adjustments
• Multiple location profiles (office, home, travel)
• Light and dark overlay themes
• Hijri date in the menu bar

Runs fully offline. Your location stays on your Mac — no servers, no analytics, no ads.

Unlock lifetime access with a single one-time In-App Purchase. A 7-day free trial lets you try everything first.
```

**Keywords** (≤100)

```
prayer times,adhan,salah,namaz,islamic,muslim,menu bar,mosque,quran,ramadan,hijri,prayer reminder,azan
```

**Primary Category**: Lifestyle
**Secondary Category**: Productivity

**What's New** (v2.0 — first MAS release)

```
Waqtu arrives on the Mac App Store: menu-bar prayer countdown, calendar busy protection, reminder overlay, prayer streaks, and 13 calculation methods. One-time lifetime unlock via In-App Purchase with a 7-day free trial.
```

**In-App Purchase** (create in ASC → In-App Purchases)

```
Reference Name:     Waqtu Lifetime
Product ID:         dat.waqtu.lifetime      <- must match code exactly
Type:               Non-Consumable
Price:              $9.99 USD (tier)
Display Name (en):  Lifetime Access
Description (en):   Unlock Waqtu forever on this device. One-time purchase.
```

**App Review Notes**

```
Menu-bar agent app (no dock icon; LSUIElement). Grant Location for accurate times and Calendar access for the "busy block" feature — both are optional but recommended. The lifetime unlock is a non-consumable In-App Purchase (dat.waqtu.lifetime); a 7-day free trial precedes it. Restore Purchases is available in Settings → Upgrade. This sandboxed build excludes Slack/Google Calendar and auto-update (handled by the App Store).
```

**Privacy Policy URL**: same as iOS.

---

## Pricing notes

- MAS lifetime IAP: $9.99 tier matches the direct-distribution Polar price (Apple takes 30%).
- iOS companion is free (no IAP).
