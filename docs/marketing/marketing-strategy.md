# Waqtu Marketing Strategy

## Positioning

**One-liner**: The only Mac app that blocks your work calendar during prayer times.

**Target persona**: Muslim professionals who use a Mac at work, schedule meetings in Teams/Outlook, and occasionally miss prayers because of conflicting meetings.

**Why they care**: They already block lunch in their calendar. Prayer should be the same — automatic, respected, no explanation needed.

---

## Core Message Pillars

### 1. Calendar Protection (killer feature)
Nobody else does this natively on Mac. PrayerCal exists as a web tool but has no menu bar, no reminders, no offline.

**Copy angle**: "Your calendar blocks lunch. Why not prayer?" (current hero — keep this)

### 2. Privacy-First
Muslim Pro sold user data to a company that sold it to the US military. This is widely known on Reddit (r/islam, r/MuslimLounge). Users actively warn each other.

**Copy angle**: "Your location never leaves your Mac. No ads. No tracking. Ever."

### 3. Professional-Grade
Not a mobile port. Built for the Mac you use at work. Respects your focus.

**Copy angle**: "Made for the Mac you work on."

### 4. Fair Pricing
One-time $2.99 intro / $9.99 lifetime. No subscription.

**Copy angle**: "One payment. Yours forever." (current — keep this)

---

## Channel Strategy

### Tier 1: High-Intent, Low-Cost (Start Here)

#### Reddit (r/macapps, r/islam, r/MuslimLounge)
- **Why**: These are the exact communities where users ask "what prayer app should I use?" Multiple threads with 50-100+ comments.
- **How**: Genuine developer posts. Share the story of *why* you built it. Not a product launch — a "I built this because..." post. The Sajda developer got strong engagement this way.
- **Format**: "I'm a Muslim professional who kept missing Dhuhr because of meetings. So I built a Mac app that blocks your calendar during prayer times."
- **Frequency**: 1-2 posts per month, different angles (feature updates, story updates)

#### Product Hunt
- **Why**: Mac tools perform well on PH. The "prayer times + calendar integration" angle is unique.
- **How**: Launch with a clear demo video. The waqtu-3.mp4 (calm reminder overlay) is perfect for this.
- **Timing**: Coordinate with a minor feature release (e.g., pre-prayer notifications from roadmap Phase 1).

#### Hacker News (Show HN)
- **Why**: Developer audience, Mac-native apps get attention.
- **How**: "Show HN: I built a Mac menu bar app that blocks your calendar during prayer times"
- **Angle**: Technical — SwiftUI, offline calculation, calendar EventKit integration.

### Tier 2: Content & SEO (Medium-Term)

#### SEO Target Keywords
Based on research, these terms have intent and manageable competition:

| Keyword | Intent | Priority |
|---------|--------|----------|
| prayer times mac | High | 1 |
| mac menu bar prayer times | High | 1 |
| salah reminder mac | Medium | 1 |
| islamic prayer app macos | Medium | 2 |
| prayer times calendar block | High | 2 |
| muslim professional prayer calendar | High | 2 |
| prayer times app mac | High | 1 |
| mac os prayer times | Medium | 2 |

#### Blog/Content Ideas (for later)
- "How to block your calendar for prayer times on Mac"
- "Prayer times in your menu bar: a guide for Muslim professionals"
- "Muslim Pro privacy scandal: why your prayer app shouldn't track you"
- "How to tell your team you need to pray during work hours"
- "Prayer time calculation methods explained (MWL, ISNA, Egyptian, Umm al-Qura)"

#### Landing Page SEO (already implemented)
- robots.txt, sitemap.xml, JSON-LD schema (SoftwareApplication + FAQPage)
- OG/Twitter cards for social sharing
- Keyword-rich H1: "Prayer Times in Your Menu Bar"
- Canonical URL, meta description with keywords

### Tier 3: Community & Partnerships (Long-Term)

#### Mosque Partnerships
- Offer free licenses to imams/mosque staff in exchange for recommendations
- Create a "mosque resources" page with embeddable prayer time widgets

#### Muslim Professional Networks
- Partner with Muslim professional Slack/Discord communities
- Offer group discounts for workplace Islamic societies

#### Islamic Content Creators
- Reach out to Muslim tech YouTubers/reviewers
- Offer review copies to Islamic app review blogs

---

## Pricing Strategy

### Current: $2.99 intro (WAQTU299) / $9.99 regular
This is well-positioned. Research shows:
- Sajda Pro: $3.99 one-time (Mac)
- Sajda+ iOS: $3.99/mo subscription
- Guidance: Free
- PrayerCal: Free

**Recommendation**:
- Keep $2.99 intro for early traction and reviews
- Move to $4.99 regular (not $9.99) — competitive with Sajda Pro but still premium over free options
- $9.99 is fine as a future "established" price once you have reviews and social proof
- Never go subscription — Muslim users explicitly complain about subscription fatigue

---

## Trust Signals to Build

From Reddit research, users care about:

1. **No ads** — Say it loud. Every prayer app thread has complaints about ads.
2. **No data collection** — Reference Muslim Pro scandal implicitly ("unlike some apps, we never sell your data")
3. **Open-source potential** — Consider open-sourcing the prayer calculation engine. Sajda got goodwill from being open-source.
4. **Reviews/testimonials** — Add to landing page ASAP. Even 3-5 quotes from early users.
5. **Money-back guarantee** — Already have 30-day. Make it more visible.

---

## Launch Checklist

- [ ] Product Hunt page prepared (title, tagline, demo video, first comment)
- [ ] Reddit post drafted for r/macapps (personal story angle)
- [ ] Reddit post drafted for r/islam (practical solution angle)
- [ ] Show HN post drafted
- [ ] Twitter/X account with consistent posting (share dev updates, screenshots)
- [ ] App Store? — Consider Mac App Store distribution for discovery (even if sold via Polar)
- [ ] At least 3 user testimonials collected and added to landing page
- [ ] Demo video optimized for social sharing (15-30 sec, shows menu bar + calendar + reminder)

---

## Metrics to Track

| Metric | Tool | Target |
|--------|------|--------|
| Organic traffic | One Dollar Stats / Google Analytics | 500 visits/mo (month 3) |
| Keyword ranking | Google Search Console | Top 10 for "prayer times mac" (month 6) |
| Conversion rate | Polar.sh analytics | 2-5% of landing page visitors |
| Reddit referral traffic | One Dollar Stats UTM | Track per post |
| Download → purchase | Custom tracking | 10-20% conversion |

---

## Key Insight from Research

The #1 reason users abandon prayer apps is **inaccuracy vs local mosque times**. The #2 reason is **ads and data collection**. The #3 reason is **subscription fatigue**.

Waqtu nails #2 and #3 by design. For #1, adding custom time offsets (roadmap Phase 1) is critical — it turns "the app doesn't match my mosque" from a dealbreaker into a 30-second fix.

The calendar integration angle is validated by:
- PrayerCal existing (and getting endorsements from figures like Iqbal Nasim MBE)
- Muslim Prayer Reminder for Slack existing (and its dev.to article resonating)
- Multiple Reddit threads about managing prayer at work

No other native Mac app does what Waqtu does. The positioning is clear. The market is underserved.
