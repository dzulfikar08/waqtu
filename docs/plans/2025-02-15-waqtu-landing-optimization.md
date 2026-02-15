# Waqtu Landing Page Conversion Optimization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Optimize the Waqtu landing page for conversions using a story-led approach with problem-first messaging, narrative walkthrough, and trust-building elements.

**Architecture:** Update the existing React/Next.js landing page component (`src/app/page.tsx`) with new sections and revised copy while maintaining the existing design system (CSS variables, animations, glassmorphism cards).

**Tech Stack:** Next.js 16, React, TypeScript, Tailwind CSS

---

## Task 1: Update Hero Section with Problem-First Copy

**Files:**
- Modify: `src/app/page.tsx:95-163`

**Step 1: Update the hero section JSX**

Replace the hero section (lines 95-163) with problem-first messaging:

```tsx
        {/* Hero Section */}
        <section className="px-6 pt-24 pb-32 sm:px-10 md:px-14 md:pt-36 md:pb-44">
          <div className="flex flex-col items-center text-center">
            <p
              className="animate-fade-up mb-6 text-sm font-medium uppercase tracking-[0.2em] text-[var(--waqtu-gold)]"
              style={{ animationDelay: "0ms", opacity: 0 }}
            >
              Prayer times · Calendar protection · Mac menu bar
            </p>
            <h1
              className="font-display animate-fade-up max-w-4xl text-4xl font-semibold leading-[1.15] tracking-tight text-[var(--waqtu-text)] sm:text-5xl md:text-6xl md:leading-[1.1]"
              style={{ animationDelay: "80ms", opacity: 0 }}
            >
              "You check your calendar,
              <br />
              <span className="text-[var(--waqtu-light)]">see a meeting at 1:15 PM.</span>
              <br />
              But Dhuhr is at 1:00 PM."
            </h1>
            <p
              className="animate-fade-up mt-8 max-w-xl text-lg leading-relaxed text-[var(--waqtu-muted)]"
              style={{ animationDelay: "160ms", opacity: 0 }}
            >
              Time for prayer, without the awkward calendar conflicts.
              Waqtu sits in your menu bar and blocks your calendar during prayer
              times—so Outlook and Teams show you as busy before you even step away.
            </p>
            <div
              className="animate-fade-up mt-12 flex flex-wrap items-center justify-center gap-4"
              style={{ animationDelay: "240ms", opacity: 0 }}
            >
              <a
                href="#pricing"
                className="group inline-flex items-center gap-2 rounded-full bg-[var(--waqtu-primary)] px-6 py-3.5 font-medium text-[var(--waqtu-bg)] transition-all hover:bg-[var(--waqtu-primary-soft)] hover:shadow-[0_0_28px_rgba(74,139,111,0.4)]"
              >
                Get Waqtu for Mac
                <span className="transition-transform group-hover:translate-x-0.5">
                  →
                </span>
              </a>
              <a
                href="#features"
                className="inline-flex items-center gap-2 text-[var(--waqtu-muted)] transition-colors hover:text-[var(--waqtu-text)]"
              >
                See how it works
              </a>
            </div>

            {/* Trust indicators */}
            <div
              className="animate-fade-up mt-16 flex flex-wrap items-center justify-center gap-8 text-[var(--waqtu-muted)]"
              style={{ animationDelay: "320ms", opacity: 0 }}
            >
              <div className="flex items-center gap-2">
                <svg
                  className="h-5 w-5 text-[var(--waqtu-gold)]"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span className="text-sm">30-day money-back guarantee</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm">Free to try</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm">macOS 12+</span>
              </div>
            </div>
          </div>
        </section>
```

**Step 2: Run dev server to verify changes**

```bash
bun run dev
```

Expected: Page loads, hero shows new problem-first headline with quote formatting

**Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: update hero with problem-first messaging"
```

---

## Task 2: Add Problem Agitation Section

**Files:**
- Modify: `src/app/page.tsx` (insert after Hero, before Quote section)

**Step 1: Insert problem agitation section after hero (after line 163)**

```tsx
        {/* Problem Agitation Section */}
        <section className="relative z-10 section-tint-1 px-6 py-16 sm:px-10 md:px-14 md:py-24">
          <div className="mx-auto max-w-2xl">
            <h2 className="font-display mb-6 text-center text-2xl font-semibold tracking-tight text-[var(--waqtu-text)] sm:text-3xl">
              We know what it's like.
            </h2>
            <div className="space-y-4 text-[var(--waqtu-muted)] leading-relaxed">
              <p>
                You're in back-to-back meetings. The prayer time comes and goes.
                You make a mental note to "make it up later" <em className="text-[var(--waqtu-gold)]">(again)</em>.
                Or you step away and come back to "Where were you?" messages.
              </p>
              <p>
                Your calendar doesn't know about your prayers. Your colleagues don't either.
              </p>
              <p className="text-[var(--waqtu-text)] font-medium">
                It's not that work is more important. It's just... louder.
              </p>
            </div>
          </div>
        </section>
```

**Step 2: Verify in browser**

Check that the section appears between hero and quote strip, with proper spacing and emphasis.

**Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: add problem agitation section"
```

---

## Task 3: Add Solution Section ("Meet Waqtu")

**Files:**
- Modify: `src/app/page.tsx` (insert after Problem Agitation)

**Step 1: Insert solution section**

```tsx
        {/* Solution Section */}
        <section className="relative z-10 border-y border-[var(--waqtu-border)] px-6 py-16 sm:px-10 md:px-14 md:py-24">
          <div className="mx-auto max-w-4xl">
            <h2 className="font-display mb-4 text-center text-2xl font-semibold tracking-tight text-[var(--waqtu-text)] sm:text-3xl">
              What if your calendar respected your prayers?
            </h2>
            <p className="mx-auto mb-12 max-w-2xl text-center text-[var(--waqtu-muted)]">
              Waqtu is a small app that lives in your Mac's menu bar. It knows when it's time
              for each of the five daily prayers—and it gently protects that time.
            </p>
            <div className="grid gap-6 sm:grid-cols-3">
              {[
                {
                  title: "Always there",
                  description: "Next prayer & countdown in your menu bar",
                  icon: "○",
                },
                {
                  title: "Calm reminders",
                  description: "Full-screen overlay appears when it's time to pray",
                  icon: "◇",
                },
                {
                  title: "Calendar protection",
                  description: "Shows you \"busy\" in Outlook & Teams during prayer times",
                  icon: "▷",
                },
              ].map((item, i) => (
                <article
                  key={item.title}
                  className="rounded-2xl border border-[var(--waqtu-border)] bg-[var(--waqtu-surface)]/60 p-6 text-center backdrop-blur-sm"
                >
                  <span className="mb-3 block text-2xl text-[var(--waqtu-gold)] opacity-80">
                    {item.icon}
                  </span>
                  <h3 className="font-display mb-2 font-semibold text-[var(--waqtu-text)]">
                    {item.title}
                  </h3>
                  <p className="text-sm text-[var(--waqtu-muted)]">
                    {item.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>
```

**Step 2: Verify in browser**

Check that 3 cards display properly with icons and descriptions.

**Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: add solution section with 3 key features"
```

---

## Task 4: Add "Your Day with Waqtu" Timeline Section

**Files:**
- Modify: `src/app/page.tsx` (insert after Solution section)

**Step 1: Insert timeline section**

```tsx
        {/* Your Day with Waqtu - Timeline */}
        <section className="relative z-10 section-tint-2 px-6 py-16 sm:px-10 md:px-14 md:py-24">
          <div className="mx-auto max-w-3xl">
            <h2 className="font-display mb-4 text-center text-2xl font-semibold tracking-tight text-[var(--waqtu-text)] sm:text-3xl">
              Your day with Waqtu
            </h2>
            <p className="mx-auto mb-12 max-w-2xl text-center text-[var(--waqtu-muted)]">
              See how Waqtu fits into your daily rhythm.
            </p>

            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-4 top-0 h-full w-0.5 bg-[var(--waqtu-border)] sm:left-6" />

              <div className="space-y-8">
                {/* Fajr */}
                <div className="relative flex gap-4 sm:gap-6">
                  <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--waqtu-bg)] border-2 border-[var(--waqtu-gold)] sm:h-10 sm:w-10">
                    <span className="text-xs text-[var(--waqtu-gold)]">🌙</span>
                  </div>
                  <div className="flex-1 rounded-2xl border border-[var(--waqtu-border)] bg-[var(--waqtu-surface)]/60 p-6 backdrop-blur-sm">
                    <h3 className="font-display font-semibold text-[var(--waqtu-gold)]">Morning · Fajr</h3>
                    <p className="mt-2 text-sm text-[var(--waqtu-muted)]">
                      A gentle wake-up reminder. Your calendar is still yours—no blocks needed while you sleep.
                    </p>
                  </div>
                </div>

                {/* Work begins */}
                <div className="relative flex gap-4 sm:gap-6">
                  <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--waqtu-bg)] border-2 border-[var(--waqtu-muted)] sm:h-10 sm:w-10">
                    <span className="text-xs text-[var(--waqtu-muted)]">💻</span>
                  </div>
                  <div className="flex-1 rounded-2xl border border-[var(--waqtu-border)] bg-[var(--waqtu-surface)]/60 p-6 backdrop-blur-sm">
                    <h3 className="font-display font-semibold text-[var(--waqtu-text)]">Mid-morning · Work begins</h3>
                    <p className="mt-2 text-sm text-[var(--waqtu-muted)]">
                      Waqtu sits quietly in your menu bar, showing a countdown to Dhuhr. No interruptions.
                    </p>
                  </div>
                </div>

                {/* Dhuhr */}
                <div className="relative flex gap-4 sm:gap-6">
                  <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--waqtu-bg)] border-2 border-[var(--waqtu-primary)] sm:h-10 sm:w-10">
                    <span className="text-xs text-[var(--waqtu-primary)]">🕌</span>
                  </div>
                  <div className="flex-1 rounded-2xl border border-[var(--waqtu-primary)]/30 bg-[var(--waqtu-card)]/80 p-6 backdrop-blur-sm">
                    <h3 className="font-display font-semibold text-[var(--waqtu-primary)]">1:00 PM · Dhuhr arrives</h3>
                    <p className="mt-2 text-sm text-[var(--waqtu-muted)]">
                      A calm full-screen reminder appears. You dismiss it when ready—and your calendar now shows you <span className="text-[var(--waqtu-primary)]">"busy"</span> until 1:20 PM.
                    </p>
                    <p className="mt-2 text-sm text-[var(--waqtu-muted)]">
                      Your colleagues see "Busy" in Teams. No awkward "where were you?" messages.
                    </p>
                  </div>
                </div>

                {/* Asr & Maghrib */}
                <div className="relative flex gap-4 sm:gap-6">
                  <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--waqtu-bg)] border-2 border-[var(--waqtu-primary)] sm:h-10 sm:w-10">
                    <span className="text-xs text-[var(--waqtu-primary)]">🕌</span>
                  </div>
                  <div className="flex-1 rounded-2xl border border-[var(--waqtu-border)] bg-[var(--waqtu-surface)]/60 p-6 backdrop-blur-sm">
                    <h3 className="font-display font-semibold text-[var(--waqtu-text)]">Afternoon · Asr & Maghrib</h3>
                    <p className="mt-2 text-sm text-[var(--waqtu-muted)]">
                      Same peaceful rhythm. You step away, your calendar protects you, you return.
                    </p>
                  </div>
                </div>

                {/* Isha */}
                <div className="relative flex gap-4 sm:gap-6">
                  <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--waqtu-bg)] border-2 border-[var(--waqtu-gold)] sm:h-10 sm:w-10">
                    <span className="text-xs text-[var(--waqtu-gold)]">🌙</span>
                  </div>
                  <div className="flex-1 rounded-2xl border border-[var(--waqtu-border)] bg-[var(--waqtu-surface)]/60 p-6 backdrop-blur-sm">
                    <h3 className="font-display font-semibold text-[var(--waqtu-gold)]">Evening · Isha</h3>
                    <p className="mt-2 text-sm text-[var(--waqtu-muted)]">
                      Final prayer of the day, final block on your calendar. Tomorrow, Waqtu is there again.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
```

**Step 2: Verify in browser**

Check that timeline displays with vertical line, icons, and proper spacing on mobile.

**Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: add 'your day with Waqtu' timeline section"
```

---

## Task 5: Update Features Section with Benefit-Led Copy

**Files:**
- Modify: `src/app/page.tsx:178-232` (Features section)

**Step 1: Update features array with benefit-led copy**

Replace the features array (lines 192-210) with:

```tsx
              {
                title: "Never wonder when the next prayer is",
                description: "A quick glance at your menu bar tells you. No checking apps, no guessing.",
                icon: "○",
              },
              {
                title: "Calm, not alarming",
                description: "A peaceful overlay appears when it's time. Dismiss when you're ready to pray.",
                icon: "◇",
              },
              {
                title: "Your faith on your calendar",
                description: "Waqtu creates busy blocks in your calendar—Exchange, iCloud, or default. Outlook & Teams show you as busy.",
                icon: "▷",
              },
```

**Step 2: Verify in browser**

Check that feature cards show the new benefit-led headlines.

**Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: update features with benefit-led copy"
```

---

## Task 6: Add Social Proof / Testimonials Section

**Files:**
- Modify: `src/app/page.tsx` (insert after Features section, before Pricing)

**Step 1: Insert testimonials section**

```tsx
        {/* Testimonials Section */}
        <section className="relative z-10 border-y border-[var(--waqtu-border)] px-6 py-16 sm:px-10 md:px-14 md:py-24">
          <div className="mx-auto max-w-4xl">
            <h2 className="font-display mb-4 text-center text-2xl font-semibold tracking-tight text-[var(--waqtu-text)] sm:text-3xl">
              Join Muslims who've made prayer part of their work day
            </h2>
            <p className="mx-auto mb-12 max-w-2xl text-center text-[var(--waqtu-muted)]">
              No more choosing between meetings and prayer.
            </p>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  name: "Ahmed",
                  role: "Software Engineer, London",
                  text: "Waqtu solved the 'where were you?' problem at work. My colleagues now see me as busy during Dhuhr—it just feels respectful all around.",
                },
                {
                  name: "Fatima",
                  role: "Product Manager, Toronto",
                  text: "I used to feel guilty choosing between meetings and prayer. Now I don't have to choose.",
                },
                {
                  name: "Yusuf",
                  role: "Remote Designer, NYC",
                  text: "Finally, an app that doesn't feel like it's judging me. It just helps.",
                },
              ].map((testimonial, i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-[var(--waqtu-border)] bg-[var(--waqtu-surface)]/60 p-6 backdrop-blur-sm"
                >
                  <p className="mb-4 text-[var(--waqtu-muted)] leading-relaxed">
                    "{testimonial.text}"
                  </p>
                  <div>
                    <p className="font-medium text-[var(--waqtu-text)]">
                      {testimonial.name}
                    </p>
                    <p className="text-sm text-[var(--waqtu-muted)]">
                      {testimonial.role}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
```

**Note:** These are placeholder testimonials. Replace with real ones when available, or hide this section by commenting it out.

**Step 2: Verify in browser**

Check that testimonials display in a 3-column grid on desktop, 2-column on tablet, 1-column on mobile.

**Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: add testimonials section with placeholder reviews"
```

---

## Task 7: Update Pricing Section with Guarantee

**Files:**
- Modify: `src/app/page.tsx:311-429` (Pricing section)

**Step 1: Update pricing description**

Replace the pricing description (lines 319-322) with:

```tsx
            <p className="mx-auto mb-16 max-w-2xl text-center text-[var(--waqtu-muted)]">
              Everything you need to protect your prayer times. Forever.
            </p>
```

**Step 2: Update features array to reorder and highlight guarantee**

Replace the features array (lines 331-341) with:

```tsx
                  features: [
                    "Menu bar prayer times & countdown",
                    "Full-screen reminders (calm, not alarming)",
                    "Calendar protection (Exchange, iCloud, or default)",
                    "Works offline—your location never leaves your Mac",
                    "Lifetime updates & support",
                    "Use on 1 Mac",
                    "30-day money-back guarantee",
                  ],
```

**Step 3: Add free trial text below button**

After the button element (around line 404), add:

```tsx
                  <p className="mt-3 text-center text-sm text-[var(--waqtu-muted)]">
                    Not sure? <a href="#download" className="text-[var(--waqtu-primary)] hover:underline">Try free first</a>. No credit card required.
                  </p>
```

**Step 4: Verify in browser**

Check that guarantee is listed in features and free trial link appears below button.

**Step 5: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: update pricing with guarantee and free trial CTA"
```

---

## Task 8: Update Final CTA Section

**Files:**
- Modify: `src/app/page.tsx:522-554` (CTA section)

**Step 1: Update CTA copy**

Replace the CTA section content (lines 527-552) with:

```tsx
          <div className="mx-auto max-w-2xl rounded-3xl border border-[var(--waqtu-border)] bg-[var(--waqtu-surface)]/80 p-12 text-center backdrop-blur-sm md:p-16">
            <h2 className="font-display text-2xl font-semibold tracking-tight text-[var(--waqtu-text)] sm:text-3xl">
              Ready to protect your prayer times?
            </h2>
            <p className="mt-4 text-[var(--waqtu-muted)]">
              Download Waqtu for macOS. No account required. Free to try, $9.99 if you love it.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <a
                href="#pricing"
                className="inline-flex items-center gap-2 rounded-full bg-[var(--waqtu-primary)] px-8 py-4 font-medium text-[var(--waqtu-bg)] transition-all hover:bg-[var(--waqtu-primary-soft)] hover:shadow-[0_0_32px_rgba(74,139,111,0.45)]"
              >
                Get Waqtu for $9.99
                <span>→</span>
              </a>
            </div>
            <p className="mt-6 text-sm text-[var(--waqtu-muted)]">
              Your prayers deserve a place on your calendar.
            </p>
          </div>
```

**Step 2: Verify in browser**

Check that CTA section has simplified messaging with direct purchase CTA.

**Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: simplify final CTA with direct purchase messaging"
```

---

## Task 9: Update FAQ Section

**Files:**
- Modify: `src/app/page.tsx:444-474` (FAQ items array)

**Step 1: Update the "Can I try before buying?" FAQ answer**

Replace the FAQ answer (lines 471-474) with:

```tsx
                {
                  question: "Is there a free trial?",
                  answer:
                    "Yes. Download Waqtu and try it free. When you're ready, purchase the lifetime license for $9.99. No subscriptions, no recurring fees.",
                },
```

**Step 2: Remove or update the subscription cancellation FAQ**

Since there's no subscription, update lines 476-479 to remove or replace with a different question. Consider replacing with:

```tsx
                {
                  question: "How do refunds work?",
                  answer:
                    "If you're not satisfied with Waqtu, contact us within 30 days of purchase for a full refund. No questions asked.",
                },
```

**Step 3: Verify in browser**

Check that FAQ answers reflect free trial and money-back guarantee.

**Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: update FAQ with free trial and refund info"
```

---

## Task 10: Update Header CTA

**Files:**
- Modify: `src/app/page.tsx:84-89` (Header CTA button)

**Step 1: Update header button text and link**

Replace the header CTA (lines 84-89) with:

```tsx
          <a
            href="#pricing"
            className="rounded-full bg-[var(--waqtu-primary)] px-5 py-2.5 font-medium text-[var(--waqtu-bg)] transition-all hover:bg-[var(--waqtu-primary-soft)] hover:shadow-[0_0_24px_rgba(74,139,111,0.35)]"
          >
            Get Waqtu
          </a>
```

**Step 2: Verify in browser**

Check that header CTA links to pricing and has updated text.

**Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: update header CTA to link to pricing"
```

---

## Task 11: Final Review and Testing

**Step 1: Run full page test**

```bash
bun run dev
```

Check:
- [ ] Hero displays problem-first headline properly
- [ ] Problem agitation section appears with proper emphasis
- [ ] Solution section 3 cards display correctly
- [ ] Timeline section has vertical line and proper spacing
- [ ] Features have benefit-led copy
- [ ] Testimonials display in grid (or are hidden if no real ones)
- [ ] Pricing shows guarantee and free trial link
- [ ] CTA section is simplified
- [ ] FAQ includes free trial question
- [ ] Header CTA links to pricing
- [ ] Mobile responsive (check at 375px, 768px widths)
- [ ] Animations work (fade-up, fade-in)

**Step 2: Build production version**

```bash
bun run build
```

Expected: Successful build with no errors.

**Step 3: Final commit**

```bash
git add src/app/page.tsx
git commit -m "feat: complete landing page conversion optimization"
```

---

## Post-Deployment Tasks

1. **Collect real testimonials** - Replace placeholder testimonials with genuine user reviews
2. **Monitor analytics** - Track conversion rate from hero → pricing → purchase
3. **A/B test hero headline** - Try variations like "Your calendar should respect your prayers"
4. **Add Product Hunt launch copy** - Prepare for potential launch

---

## Rollback Plan

If issues arise, revert to previous version:

```bash
git revert HEAD~11  # Reverts all 11 commits from this plan
git push
```

Or deploy previous commit from git history.
