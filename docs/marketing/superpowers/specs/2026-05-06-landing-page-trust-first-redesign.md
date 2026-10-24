# Landing Page Trust-First Redesign

**Date**: 2026-05-06
**Approach**: Trust-First Redesign (Approach A)
**Goals**: Improve conversions, increase downloads, launch-ready positioning for Reddit/Product Hunt/HN

## Design System

Keep the current neumorphic dark theme (CSS variables, neu-card, neu-btn, etc.). All changes are structural/content — the visual system stays.

## Section Flow

### 1. Header (no changes)
- Logo "Waqtu", nav links (Features, Pricing, FAQ), CTA "Get Waqtu — $2.99"

### 2. Hero (tighten copy)
- **Voucher badge**: Keep as-is
- **H1**: "Prayer Times in Your Menu Bar" (keep)
- **Subhead**: "Your calendar blocks lunch. Why not prayer?" (keep)
- **Body copy**: Trim to 2 sentences. Focus on calendar-blocking differentiator.
  > Waqtu blocks your work calendar during prayer times. Your colleagues see you as busy — no explanation needed.
- **CTAs**: Keep "Get Waqtu — $2.99" + "See how it works"
- **Trust bar**: Change to "No ads · No tracking · Works offline · macOS 12+"

### 3. Trust Strip (NEW — replaces Quran verse)
- Centered single line: "Your location never leaves your Mac. No ads. No tracking. Ever."
- Keep a subtle Quranic reference (4:103) as a smaller element to maintain Islamic identity

### 4. Features (expand from 3 to 6)
2×3 grid (3×2 on mobile):
1. Prayer countdown in menu bar (keep)
2. Calendar protection — "Blocks your calendar during every prayer. Teams shows you as busy. No explanation needed."
3. Calm reminders (keep)
4. Works completely offline — "Prayer times calculated on your Mac. No internet needed after download."
5. Location stays private — "Calculated locally on your Mac. Never transmitted, never stored, never sold."
6. No ads, no subscriptions — "One payment. No recurring charges. No ad banners. Ever."

Icons for new features: offline (cloud-off), privacy (shield-check), no-ads (ban/x-circle)

### 5. Visual Showcase (keep)
- 3-column media grid unchanged
- Captions unchanged

### 6. Why Waqtu Comparison Strip (NEW)
Simple comparison table, 4-5 rows, 4 competitors:
- Rows: Menu bar countdown, Calendar blocking, Works offline, No ads/tracking, One-time price
- Competitors: Waqtu, Sajda, Guidance, PrayerCal
- Use checkmarks and dashes, keep factual

### 7. Testimonials (NEW)
Single founder testimonial card:
> "I built Waqtu because I was spending 12 hours a day in front of my Mac and missing prayers because of meetings. Now my calendar automatically blocks prayer times, and I've been consistent for months."
> — Dzulfikar, Founder

Subtle roadmap hint below: "More coming — Google Calendar sync, Apple Watch, and more." (small, muted text)

### 8. Pricing (keep structure, minor copy improvements)
- Add "No subscription. One payment, forever." above price
- Keep voucher box
- Keep feature list
- Keep CTA button

### 9. FAQ (expand from 6 to 8-9)
Keep existing 6, add:
- "How is Waqtu different from other prayer apps?" (differentiation, SEO)
- "Does Waqtu support different prayer calculation methods?" (SEO, addresses roadmap)
- "Can I match Waqtu to my local mosque times?" (addresses #1 user complaint)

### 10. Download CTA (keep)
- Current design works, minor copy strengthening if needed

### 11. Footer (no changes)

## Files to modify
- `src/app/page.tsx` — all section changes
- `src/app/globals.css` — minor additions for comparison table styling
- `src/components/json-ld.tsx` — add new FAQ entries to schema

## Out of scope
- Layout/component extraction (page.tsx stays as single file)
- New images or media assets
- Payment flow changes
- Backend/API changes
