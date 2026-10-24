# Waqtu Landing Page Conversion Optimization Design

**Date:** 2025-02-15
**Goal:** Optimize landing page for direct lifetime license purchases ($9.99)
**Target Audience:** Muslim professionals, practicing Muslims, Mac enthusiasts
**Key Barriers Addressed:** Skepticism about value, trust concerns, unclear differentiation

---

## Approach: Story-Led Conversion

Emotional connection through relatable pain points → Narrative solution → Trust building → Low-friction conversion.

---

## Page Flow & Copy Specification

### 1. Hero Section

**Headline:** Problem-first hook

```
"You check your calendar, see a meeting at 1:15 PM. But Dhuhr is at 1:00 PM."
```

**Subheadline:**

```
Time for prayer, without the awkward calendar conflicts.

Waqtu sits in your menu bar and blocks your calendar during prayer times—so Outlook and Teams show you as busy before you even step away.
```

**Elements:**

- Problem-first opening (1:00 PM / 1:15 PM dilemma)
- Understanding tone (not judgmental)
- Clear value proposition
- Prominent download button

---

### 2. Problem Agitation Section (NEW)

```
We know what it's like.

You're in back-to-back meetings. The prayer time comes and goes. You make a mental note to "make it up later" (again). Or you step away and come back to "Where were you?" messages.

Your calendar doesn't know about your prayers. Your colleagues don't either.

It's not that work is more important. It's just... louder.
```

**Design:** Warm, spacious, gold accent color emphasis.

---

### 3. Solution Section ("Meet Waqtu")

```
What if your calendar respected your prayers?

Waqtu is a small app that lives in your Mac's menu bar. It knows when it's time for each of the five daily prayers—and it gently protects that time.
```

**Three cards:**

- ○ Always there — Next prayer & countdown
- ◇ Calm reminders — Full-screen overlay
- ▷ Calendar protection — Shows "busy" in Outlook & Teams

---

### 4. "Your Day with Waqtu" Walkthrough (NEW)

Narrative timeline showing product in real life context:

```
Your day with Waqtu

Morning · Fajr
A gentle wake-up reminder. Your calendar is still yours—no blocks needed while you sleep.

Mid-morning · Work begins
Waqtu sits quietly in your menu bar, showing a countdown to Dhuhr. No interruptions.

1:00 PM · Dhuhr arrives
A calm full-screen reminder appears. You dismiss it when ready—and your calendar now shows you "busy" until 1:20 PM.
Your colleagues see "Busy" in Teams. No awkward "where were you?" messages.

Afternoon · Asr & Maghrib
Same peaceful rhythm. You step away, your calendar protects you, you return.

Evening · Isha
Final prayer of the day, final block on your calendar. Tomorrow, Waqtu is there again.
```

**Design:** Vertical timeline with subtle icons. Gold for prayer times, green for calendar protection.

---

### 5. Features Section (UPDATED)

```
Thoughtfully designed for your prayer life
```

**Cards with benefit-led copy:**

| Feature                 | Benefit Copy                                                                                                                              |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Next prayer & countdown | "Never wonder when the next prayer is. A quick glance at your menu bar tells you."                                                        |
| Full-screen reminder    | "Calm, not alarming. A peaceful overlay appears when it's time. Dismiss when you're ready."                                               |
| Calendar protection     | "Your faith on your calendar. Waqtu creates busy blocks in your calendar—Exchange, iCloud, or default. Outlook & Teams show you as busy." |

---

### 6. Social Proof Section (NEW)

```
Join Muslims who've made prayer part of their work day
```

**Testimonials:**

- Ahmed, Software Engineer, London — "Waqtu solved the 'where were you?' problem at work."
- Fatima, Product Manager, Toronto — "I used to feel guilty choosing between meetings and prayer."
- Yusuf, Remote Designer, NYC — "Finally, an app that doesn't feel like it's judging me."

**Note:** Hide section initially if no real testimonials. Use placeholders for development.

---

### 7. Pricing Section (UPDATED)

```
Simple pricing, no surprises
```

**Lifetime Access — $9.99 (was $14.99)**
"Everything you need to protect your prayer times. Forever."

**Features:**

- Menu bar prayer times & countdown
- Full-screen reminders (calm, not alarming)
- Calendar protection (Exchange, iCloud, or default)
- Works offline—your location never leaves your Mac
- Lifetime updates & support
- Use on 1 Mac
- **30-day money-back guarantee**

**CTA Button:** "Get Waqtu for $9.99"

**Below button:** "Not sure? Try free first. No credit card required."

---

### 8. Final CTA Section (UPDATED)

```
Ready to protect your prayer times?

Download Waqtu for macOS. No account required. Free to try, $9.99 if you love it.

[Download button]

Your prayers deserve a place on your calendar.
```

---

### 9. FAQ Section (UPDATED)

Add new question:

```
Q: Is there a free trial?
A: Yes. Download Waqtu and try it free. When you're ready, purchase the lifetime license for $9.99. No subscriptions, no recurring fees.
```

---

## Design Specifications

**Colors:** Keep existing palette

- `--waqtu-bg`: #0f1914
- `--waqtu-primary`: #4a8b6f
- `--waqtu-gold`: #d4a574

**Typography:** Keep existing fonts

- Font-display for headlines
- System font for body

**Animations:**

- Keep fade-up, fade-in, shimmer
- Add subtle timeline animations for "Your day" section

**Components to create:**

- Timeline component for day walkthrough
- Updated testimonial cards (hide initially if no real testimonials)
- Updated pricing card with guarantee badge

---

## Implementation Notes

1. Keep existing page structure and CSS variables
2. Update hero copy to problem-first approach
3. Add problem agitation section
4. Add "Your day with Waqtu" timeline section
5. Reword features to benefit-led copy
6. Add testimonial section (conditionally rendered)
7. Update pricing with guarantee and free trial language
8. Add free trial FAQ item
9. Simplify final CTA

---

## Success Metrics

- Primary: Lifetime license purchases
- Secondary: Download initiations, time on page, scroll depth to pricing

---

## Post-Launch

- Collect genuine testimonials to replace placeholders
- A/B test hero headline variations
- Monitor conversion funnel (hero → pricing → purchase)
