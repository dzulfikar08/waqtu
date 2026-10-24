# Landing Page Trust-First Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the landing page around trust signals, competitive differentiation, and expanded features to improve conversions, downloads, and launch-readiness.

**Architecture:** Single-page Next.js app. All changes in `src/app/page.tsx` (sections), `src/app/globals.css` (new styles for comparison table), and `src/components/json-ld.tsx` (expanded FAQ schema). Keep neumorphic design system — only content and section changes.

**Tech Stack:** Next.js 16, React, Tailwind CSS 4, TypeScript

---

## File Structure

| File                         | Action | Responsibility                           |
| ---------------------------- | ------ | ---------------------------------------- |
| `src/app/globals.css`        | Modify | Add comparison table styles              |
| `src/app/page.tsx`           | Modify | All section content and ordering changes |
| `src/components/json-ld.tsx` | Modify | Add 3 new FAQ schema entries             |

---

### Task 1: Add CSS for comparison table

**Files:**

- Modify: `src/app/globals.css`

- [ ] **Step 1: Add comparison table styles to globals.css**

Append before the `/* Sticky header support */` comment block (before line 327):

```css
/* Comparison table */
.comparison-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.comparison-table thead th {
  padding: 12px 16px;
  text-align: center;
  font-weight: 600;
  color: var(--waqtu-muted);
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid var(--waqtu-border);
}

.comparison-table thead th:first-child {
  text-align: left;
}

.comparison-table thead th.waqtu-col {
  color: var(--waqtu-gold);
}

.comparison-table tbody td {
  padding: 12px 16px;
  text-align: center;
  color: var(--waqtu-muted);
  border-bottom: 1px solid var(--waqtu-border);
}

.comparison-table tbody td:first-child {
  text-align: left;
  color: var(--waqtu-text);
  font-weight: 500;
}

.comparison-table tbody td.waqtu-col {
  color: var(--waqtu-primary);
  font-weight: 600;
}

.comparison-table .check {
  color: var(--waqtu-primary);
}

.comparison-table .dash {
  color: var(--waqtu-border);
}

.comparison-table .price-label {
  font-family: "Courier New", Courier, monospace;
  font-weight: 700;
}
```

- [ ] **Step 2: Start dev server and verify no errors**

Run: `npm run dev`
Expected: Page loads with no console errors, existing styles unchanged.

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "style: add comparison table CSS for landing page redesign"
```

---

### Task 2: Update hero copy and trust bar

**Files:**

- Modify: `src/app/page.tsx`

- [ ] **Step 1: Trim hero body copy**

Replace the hero body paragraph (the second `<p>` after the italic subhead, around lines 363-370):

Old:

```tsx
<p
  className="animate-fade-up mt-6 max-w-lg text-lg leading-relaxed text-[var(--waqtu-muted)]"
  style={{ animationDelay: "160ms", opacity: 0 }}
>
  Waqtu blocks your work calendar during prayer times. Your colleagues see you as busy in Teams. No
  more choosing between meetings and prayer.
</p>
```

New:

```tsx
<p
  className="animate-fade-up mt-6 max-w-lg text-lg leading-relaxed text-[var(--waqtu-muted)]"
  style={{ animationDelay: "160ms", opacity: 0 }}
>
  Waqtu blocks your work calendar during prayer times. Your colleagues see you as busy — no
  explanation needed.
</p>
```

- [ ] **Step 2: Update trust bar text**

Replace the trust indicators div content (around lines 399-413):

Old:

```tsx
<span>30-day money-back</span>
<span className="hidden sm:inline text-[var(--waqtu-border)]">
  &middot;
</span>
<span>Free to try</span>
<span className="hidden sm:inline text-[var(--waqtu-border)]">
  &middot;
</span>
<span>macOS 12+</span>
```

New:

```tsx
<span>No ads</span>
<span className="hidden sm:inline text-[var(--waqtu-border)]">
  &middot;
</span>
<span>No tracking</span>
<span className="hidden sm:inline text-[var(--waqtu-border)]">
  &middot;
</span>
<span>Works offline</span>
<span className="hidden sm:inline text-[var(--waqtu-border)]">
  &middot;
</span>
<span>macOS 12+</span>
```

- [ ] **Step 3: Verify hero renders correctly**

Check in browser: hero copy is 2 sentences, trust bar shows 4 items (No ads · No tracking · Works offline · macOS 12+).

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: tighten hero copy and update trust bar signals"
```

---

### Task 3: Replace Quran verse with Trust Strip

**Files:**

- Modify: `src/app/page.tsx`

- [ ] **Step 1: Replace the Quran verse section**

Replace the entire Quran verse section (the `<section>` block between the hero and features, around lines 417-425):

Old:

```tsx
{
  /* ===== QURAN VERSE STRIP ===== */
}
<section className="relative z-10 border-y border-[var(--waqtu-border)] px-6 py-10 sm:px-10 md:px-14">
  <blockquote className="mx-auto max-w-2xl text-center text-lg italic leading-relaxed text-[var(--waqtu-muted)]">
    &ldquo;Indeed, prayer is obligatory on the believers at specified times.&rdquo;
  </blockquote>
  <cite className="mt-3 block text-center text-sm not-italic text-[var(--waqtu-gold)]">
    &mdash; Quran 4:103
  </cite>
</section>;
```

New:

```tsx
{
  /* ===== TRUST STRIP ===== */
}
<section className="relative z-10 border-y border-[var(--waqtu-border)] px-6 py-10 sm:px-10 md:px-14">
  <div className="mx-auto max-w-2xl text-center">
    <p className="text-lg font-medium leading-relaxed text-[var(--waqtu-text)]">
      Your location never leaves your Mac. No ads. No tracking.{" "}
      <span className="text-[var(--waqtu-gold)]">Ever.</span>
    </p>
    <p className="mt-3 text-sm text-[var(--waqtu-muted)]">
      &ldquo;Indeed, prayer is obligatory on the believers at specified times.&rdquo; — Quran 4:103
    </p>
  </div>
</section>;
```

- [ ] **Step 2: Verify trust strip renders**

Check in browser: large trust statement centered, smaller Quranic reference below it.

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: replace Quran verse with trust strip, keep Islamic reference"
```

---

### Task 4: Expand features from 3 to 6

**Files:**

- Modify: `src/app/page.tsx`

- [ ] **Step 1: Update the features section subtitle**

Replace the features subtitle (around line 437):

Old:

```tsx
<p className="mx-auto mb-16 max-w-md text-center text-[var(--waqtu-muted)]">
  Three things. That&rsquo;s it.
</p>
```

New:

```tsx
<p className="mx-auto mb-16 max-w-md text-center text-[var(--waqtu-muted)]">
  Everything you need. Nothing you don&rsquo;t.
</p>
```

- [ ] **Step 2: Update grid layout and expand feature items**

Replace the grid container and feature array (from the `<div className="grid...">` opening through its closing `</div>`, around lines 441-513):

Old:

```tsx
<div className="grid gap-10 sm:gap-12 sm:grid-cols-3">
  {[
    {
      title: "Prayer countdown in your menu bar",
      description:
        "One glance tells you when the next prayer is. No apps to open, nothing to check.",
      icon: (
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
      ),
    },
    {
      title: "Calendar protection",
      description:
        "Creates busy blocks in Exchange, iCloud, or your default calendar. Teams shows you as busy. No explanation needed.",
      icon: (
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z"
          />
        </svg>
      ),
    },
    {
      title: "Calm reminders, not alarms",
      description:
        "A peaceful overlay when it\u2019s time to pray. You dismiss it when you\u2019re ready. Waqtu waits.",
      icon: (
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
          />
        </svg>
      ),
    },
  ].map((item) => (
    <div key={item.title}>
      <span className="mb-4 block text-[var(--waqtu-gold)]">{item.icon}</span>
      <h3 className="font-display mb-2 text-lg font-semibold text-[var(--waqtu-text)]">
        {item.title}
      </h3>
      <p className="text-[15px] leading-relaxed text-[var(--waqtu-muted)]">{item.description}</p>
    </div>
  ))}
</div>
```

New:

```tsx
<div className="grid gap-10 sm:gap-12 sm:grid-cols-2 lg:grid-cols-3">
  {[
    {
      title: "Prayer countdown in your menu bar",
      description:
        "One glance tells you when the next prayer is. No apps to open, nothing to check.",
      icon: (
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
      ),
    },
    {
      title: "Calendar protection",
      description:
        "Blocks your calendar during every prayer. Teams shows you as busy. No explanation needed.",
      icon: (
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z"
          />
        </svg>
      ),
    },
    {
      title: "Calm reminders, not alarms",
      description:
        "A peaceful overlay when it\u2019s time to pray. You dismiss it when you\u2019re ready. Waqtu waits.",
      icon: (
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
          />
        </svg>
      ),
    },
    {
      title: "Works completely offline",
      description: "Prayer times calculated on your Mac. No internet needed after download.",
      icon: (
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.75 9.75L9 16.5m0 0l-2.25-2.25M9 16.5l2.25-2.25"
          />
        </svg>
      ),
    },
    {
      title: "Location stays private",
      description: "Calculated locally on your Mac. Never transmitted, never stored, never sold.",
      icon: (
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
          />
        </svg>
      ),
    },
    {
      title: "No ads, no subscriptions",
      description: "One payment. No recurring charges. No ad banners. Ever.",
      icon: (
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
          />
        </svg>
      ),
    },
  ].map((item) => (
    <div key={item.title}>
      <span className="mb-4 block text-[var(--waqtu-gold)]">{item.icon}</span>
      <h3 className="font-display mb-2 text-lg font-semibold text-[var(--waqtu-text)]">
        {item.title}
      </h3>
      <p className="text-[15px] leading-relaxed text-[var(--waqtu-muted)]">{item.description}</p>
    </div>
  ))}
</div>
```

- [ ] **Step 3: Verify 6 features render in 2x3 grid**

Check in browser: 6 feature cards in 3 columns on desktop, 2 on tablet, 1 on mobile.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: expand features from 3 to 6 with privacy and pricing pillars"
```

---

### Task 5: Add Why Waqtu comparison section

**Files:**

- Modify: `src/app/page.tsx`

- [ ] **Step 1: Insert comparison section between visual showcase and pricing**

Insert after the visual showcase closing `</section>` tag (after the section ending around line 584 in original, now after the showcase) and before the pricing section:

```tsx
{
  /* ===== WHY WAQTU ===== */
}
<section className="relative z-10 border-y border-[var(--waqtu-border)] px-6 py-24 sm:px-10 md:px-14 md:py-32">
  <div className="mx-auto max-w-3xl">
    <h2 className="font-display mb-3 text-center text-2xl font-semibold tracking-tight text-[var(--waqtu-text)] sm:text-3xl">
      Why Waqtu
    </h2>
    <p className="mx-auto mb-12 max-w-md text-center text-[var(--waqtu-muted)]">
      The only native Mac app with menu bar presence and calendar blocking.
    </p>

    <div className="overflow-x-auto">
      <table className="comparison-table">
        <thead>
          <tr>
            <th></th>
            <th className="waqtu-col">Waqtu</th>
            <th>Sajda</th>
            <th>Guidance</th>
            <th>PrayerCal</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Menu bar countdown</td>
            <td className="waqtu-col">
              <span className="check">&#10003;</span>
            </td>
            <td>
              <span className="check">&#10003;</span>
            </td>
            <td>
              <span className="check">&#10003;</span>
            </td>
            <td>
              <span className="dash">&mdash;</span>
            </td>
          </tr>
          <tr>
            <td>Calendar blocking</td>
            <td className="waqtu-col">
              <span className="check">&#10003;</span>
            </td>
            <td>
              <span className="dash">&mdash;</span>
            </td>
            <td>
              <span className="dash">&mdash;</span>
            </td>
            <td>
              <span className="check">&#10003;</span>
            </td>
          </tr>
          <tr>
            <td>Works offline</td>
            <td className="waqtu-col">
              <span className="check">&#10003;</span>
            </td>
            <td>
              <span className="check">&#10003;</span>
            </td>
            <td>
              <span className="check">&#10003;</span>
            </td>
            <td>
              <span className="dash">&mdash;</span>
            </td>
          </tr>
          <tr>
            <td>No ads or tracking</td>
            <td className="waqtu-col">
              <span className="check">&#10003;</span>
            </td>
            <td>
              <span className="check">&#10003;</span>
            </td>
            <td>
              <span className="check">&#10003;</span>
            </td>
            <td>
              <span className="check">&#10003;</span>
            </td>
          </tr>
          <tr>
            <td>Price</td>
            <td className="waqtu-col price-label">$2.99</td>
            <td>$3.99</td>
            <td>Free</td>
            <td>Free</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</section>;
```

- [ ] **Step 2: Verify comparison table renders correctly**

Check in browser: 5-row comparison table, Waqtu column highlighted, checkmarks and dashes display correctly.

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: add Why Waqtu competitive comparison table"
```

---

### Task 6: Add testimonials section

**Files:**

- Modify: `src/app/page.tsx`

- [ ] **Step 1: Insert testimonials section between comparison and pricing**

Insert after the Why Waqtu section and before the pricing section:

```tsx
{
  /* ===== TESTIMONIAL ===== */
}
<section className="relative z-10 px-6 py-24 sm:px-10 md:px-14 md:py-32">
  <div className="mx-auto max-w-2xl">
    <div className="neu-card p-8 sm:p-10">
      <svg
        className="mb-4 h-8 w-8 text-[var(--waqtu-gold)]/40"
        fill="currentColor"
        viewBox="0 0 24 24"
      >
        <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
      </svg>
      <p className="text-lg leading-relaxed text-[var(--waqtu-text)]">
        I built Waqtu because I was spending 12 hours a day in front of my Mac and missing prayers
        because of meetings. Now my calendar automatically blocks prayer times, and I&rsquo;ve been
        consistent for months.
      </p>
      <div className="mt-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--waqtu-primary)] text-sm font-bold text-[var(--waqtu-bg)]">
          D
        </div>
        <div>
          <p className="text-sm font-medium text-[var(--waqtu-text)]">Dzulfikar</p>
          <p className="text-xs text-[var(--waqtu-muted)]">Founder, Waqtu</p>
        </div>
      </div>
    </div>
    <p className="mt-6 text-center text-sm text-[var(--waqtu-muted)]">
      More coming — Google Calendar sync, Apple Watch, and more.
    </p>
  </div>
</section>;
```

- [ ] **Step 2: Verify testimonial card renders**

Check in browser: card with quote, avatar initial, name, and roadmap hint below.

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: add founder testimonial section with roadmap hint"
```

---

### Task 7: Update pricing section copy

**Files:**

- Modify: `src/app/page.tsx`

- [ ] **Step 1: Add no-subscription line above price**

Inside the pricing card `<div className="neu-card p-8 sm:p-10">`, after the `<h3>` heading (around "Lifetime Access") and before the price display `<div className="mt-6 flex items-baseline...">`, insert:

```tsx
<p className="mt-4 text-center text-sm text-[var(--waqtu-muted)]">
  No subscription. One payment, forever.
</p>
```

- [ ] **Step 2: Verify pricing section**

Check in browser: "No subscription. One payment, forever." appears above the $9.99 price.

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: add no-subscription copy to pricing section"
```

---

### Task 8: Expand FAQ with 3 new questions

**Files:**

- Modify: `src/app/page.tsx`

- [ ] **Step 1: Add 3 new FAQ items to the array**

Add these 3 items at the end of the FAQ array (after the "How do refunds work?" item, before the closing `].map((faq, index)`):

```tsx
{
  question: "How is Waqtu different from other prayer apps?",
  answer:
    "Waqtu is the only native Mac app that combines menu bar prayer countdown with automatic calendar blocking. Other apps show prayer times — Waqtu also ensures your colleagues see you as busy during prayers, directly in Teams and Outlook.",
},
{
  question: "Does Waqtu support different prayer calculation methods?",
  answer:
    "Yes. Waqtu supports multiple calculation methods including MWL, ISNA, Egyptian General Authority, and Umm al-Qura. You can also adjust the Asr calculation for Hanafi or Shafi'i madhab.",
},
{
  question: "Can I match Waqtu to my local mosque times?",
  answer:
    "Yes. You can add a custom time offset for each prayer to match your local mosque schedule. This ensures your calendar blocks and reminders align with your congregation.",
},
```

- [ ] **Step 2: Verify FAQ section**

Check in browser: 9 FAQ items total. New items expand/collapse correctly.

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: add 3 FAQ items for SEO and competitive differentiation"
```

---

### Task 9: Update JSON-LD schema with new FAQ entries

**Files:**

- Modify: `src/components/json-ld.tsx`

- [ ] **Step 1: Add 3 new FAQ schema entries**

Add these 3 items at the end of the `mainEntity` array (after the "How do refunds work?" entry, before the closing `]`):

```tsx
{
  "@type": "Question",
  name: "How is Waqtu different from other prayer apps?",
  acceptedAnswer: {
    "@type": "Answer",
    text: "Waqtu is the only native Mac app that combines menu bar prayer countdown with automatic calendar blocking. Other apps show prayer times — Waqtu also ensures your colleagues see you as busy during prayers, directly in Teams and Outlook.",
  },
},
{
  "@type": "Question",
  name: "Does Waqtu support different prayer calculation methods?",
  acceptedAnswer: {
    "@type": "Answer",
    text: "Yes. Waqtu supports multiple calculation methods including MWL, ISNA, Egyptian General Authority, and Umm al-Qura. You can also adjust the Asr calculation for Hanafi or Shafi'i madhab.",
  },
},
{
  "@type": "Question",
  name: "Can I match Waqtu to my local mosque times?",
  acceptedAnswer: {
    "@type": "Answer",
    text: "Yes. You can add a custom time offset for each prayer to match your local mosque schedule. This ensures your calendar blocks and reminders align with your congregation.",
  },
},
```

- [ ] **Step 2: Verify JSON-LD renders without errors**

Check page source or browser console: no schema errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/json-ld.tsx
git commit -m "feat: add 3 new FAQ entries to JSON-LD structured data"
```

---

### Task 10: Final visual verification and cleanup

**Files:**

- All modified files

- [ ] **Step 1: Full page scroll-through**

Run dev server (`npm run dev`). Check every section in order:

1. Header — nav works, CTA visible
2. Hero — voucher badge, tight copy, 4-item trust bar
3. Trust strip — bold statement + subtle Quranic reference
4. Features — 6 items in grid
5. Visual showcase — 3 media items, click to expand
6. Why Waqtu — comparison table, Waqtu column highlighted
7. Testimonial — quote card, avatar, roadmap hint
8. Pricing — no-sub line, voucher box, feature list, CTA
9. FAQ — 9 items, all expand/collapse
10. Download CTA — buttons work
11. Footer — links work

- [ ] **Step 2: Check mobile responsiveness**

Resize browser to mobile width (~375px). Verify:

- All sections stack vertically
- Comparison table scrolls horizontally if needed
- Feature grid goes to 1 column
- Mobile menu works

- [ ] **Step 3: Fix any visual issues found**

Address any spacing, overflow, or alignment issues discovered during verification.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "fix: visual polish for landing page trust-first redesign"
```
