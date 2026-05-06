import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Waqtu vs Alternatives — Compare Mac Prayer Apps",
  description:
    "Compare Waqtu with Sajda, Minarah, PrayerCal, and other Mac prayer time apps. See which app offers menu bar countdown, calendar blocking, and privacy.",
  openGraph: {
    title: "Waqtu vs Alternatives — Compare Mac Prayer Apps",
    description:
      "Compare Waqtu with Sajda, Minarah, PrayerCal, and other Mac prayer time apps.",
  },
};

const CheckIcon = () => (
  <svg className="h-5 w-5 text-[var(--waqtu-primary)]" fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
  </svg>
);

const DashIcon = () => (
  <svg className="h-5 w-5 text-[var(--waqtu-border)]" fill="none" viewBox="0 0 20 20" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 10h8" />
  </svg>
);

const PartIcon = () => (
  <span className="text-sm text-[var(--waqtu-gold)]">Partial</span>
);

const competitors = [
  {
    name: "Waqtu",
    price: "$2.99 intro / $9.99 lifetime",
    platform: "macOS 12+",
    highlights: [true, true, true, true, true, true, true, true, true, true, true, true],
  },
  {
    name: "Sajda",
    price: "Free / $3.99 Pro",
    platform: "macOS 13+",
    highlights: [true, false, false, true, true, true, true, false, false, false, false, false],
  },
  {
    name: "Minarah",
    price: "Free",
    platform: "macOS 14+",
    highlights: [false, false, false, true, false, false, true, false, true, false, false, false],
  },
  {
    name: "PrayerCal",
    price: "Free",
    platform: "Web (ICS)",
    highlights: [false, true, false, false, true, false, false, false, false, false, false, false],
  },
  {
    name: "Guidance",
    price: "Free",
    platform: "macOS + iOS",
    highlights: [false, false, false, false, true, false, false, false, false, false, false, false],
  },
];

const features = [
  "Menu bar countdown",
  "Calendar blocking (Exchange/iCloud)",
  "Teams shows you as busy",
  "Full-screen calm reminders",
  "Adhan audio",
  "Offline prayer calculation",
  "Multiple calculation methods",
  "Per-prayer time offsets",
  "Focus mode (screen block)",
  "Hijri date display",
  "Prayer log / streaks",
  "One-time payment (no subscription)",
];

export default function ComparePage() {
  return (
    <div className="min-h-screen px-6 py-16 sm:px-10 md:px-14 md:py-24">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-[var(--waqtu-muted)] hover:text-[var(--waqtu-text)] transition-colors mb-8"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Waqtu
        </Link>

        <h1 className="font-display mb-4 text-3xl font-semibold tracking-tight text-[var(--waqtu-text)] sm:text-4xl">
          Waqtu vs Alternatives
        </h1>
        <p className="mb-12 max-w-2xl text-[var(--waqtu-muted)] leading-relaxed">
          Compare Waqtu with the most popular Mac prayer time apps. See which one gives you menu bar countdown,
          calendar protection, and complete privacy — all for a single payment.
        </p>

        {/* Feature comparison table */}
        <div className="overflow-x-auto -mx-4 px-4">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="border-b border-[var(--waqtu-border-strong)]">
                <th className="py-4 pr-4 text-left font-medium text-[var(--waqtu-text)] sticky left-0 bg-[var(--waqtu-bg)]">Feature</th>
                {competitors.map((c) => (
                  <th key={c.name} className={`py-4 px-3 text-center font-medium ${c.name === "Waqtu" ? "text-[var(--waqtu-gold)]" : "text-[var(--waqtu-muted)]"}`}>
                    <div>{c.name}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Pricing row */}
              <tr className="border-b border-[var(--waqtu-border)] bg-[var(--waqtu-bg-tint-1)]">
                <td className="py-3 pr-4 font-medium text-[var(--waqtu-text)] sticky left-0 bg-[var(--waqtu-bg)]">Price</td>
                {competitors.map((c) => (
                  <td key={c.name} className={`py-3 px-3 text-center text-xs ${c.name === "Waqtu" ? "text-[var(--waqtu-gold)] font-medium" : "text-[var(--waqtu-muted)]"}`}>
                    {c.price}
                  </td>
                ))}
              </tr>
              {/* Platform row */}
              <tr className="border-b border-[var(--waqtu-border)] bg-[var(--waqtu-bg-tint-1)]">
                <td className="py-3 pr-4 font-medium text-[var(--waqtu-text)] sticky left-0 bg-[var(--waqtu-bg)]">Platform</td>
                {competitors.map((c) => (
                  <td key={c.name} className={`py-3 px-3 text-center text-xs ${c.name === "Waqtu" ? "text-[var(--waqtu-gold)] font-medium" : "text-[var(--waqtu-muted)]"}`}>
                    {c.platform}
                  </td>
                ))}
              </tr>
              {/* Feature rows */}
              {features.map((feature, i) => (
                <tr key={feature} className="border-b border-[var(--waqtu-border)]">
                  <td className="py-3 pr-4 text-[var(--waqtu-text)] sticky left-0 bg-[var(--waqtu-bg)]">{feature}</td>
                  {competitors.map((c) => (
                    <td key={c.name} className="py-3 px-3 text-center">
                      {c.highlights[i] ? <CheckIcon /> : <DashIcon />}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Per-competitor breakdowns */}
        <div className="mt-20 space-y-16">
          <CompetitorSection
            name="Waqtu"
            summary="The only Mac app that combines menu bar countdown, calendar protection, and privacy-first design. Built for Muslim professionals who use a Mac at work."
            pros={[
              "Menu bar shows countdown to next prayer",
              "Blocks calendar during prayer (Exchange, iCloud, default)",
              "Teams/Outlook shows you as busy automatically",
              "Full-screen calm reminder overlay",
              "Works completely offline — no data leaves your Mac",
              "Multiple calculation methods (MWL, ISNA, Egyptian, etc.)",
              "Per-prayer minute offsets to match local mosque",
              "Hijri date display",
              "Adhan audio with Fajr-specific version",
              "Pre-prayer reminder notifications",
              "One-time payment, lifetime access",
              "30-day money-back guarantee",
            ]}
            cons={["macOS only (iOS companion planned)"]}
            bestFor="Muslim professionals who use a Mac at work and want calendar protection"
          />

          <CompetitorSection
            name="Sajda"
            summary="Open-source Mac prayer app with a clean interface. Good for users who want free and open-source software."
            pros={[
              "Open-source",
              "Clean, modern interface",
              "Adhan audio",
              "Full-screen reminders",
              "Free with optional $3.99 Pro",
            ]}
            cons={[
              "No calendar integration",
              "No Teams/Outlook status",
              "No menu bar countdown",
              "Fewer calculation methods",
              "No per-prayer offsets",
            ]}
            bestFor="Users who prefer open-source and don't need calendar blocking"
          />

          <CompetitorSection
            name="Minarah"
            summary="Unique focus-mode app that forces you to stop working during prayer by blocking the screen."
            pros={[
              "Focus mode forces screen block",
              "Full-screen reminders",
              "Free",
            ]}
            cons={[
              "No menu bar presence",
              "No calendar integration",
              "macOS 14+ only",
              "Fewer features overall",
              "Can be disruptive in office settings",
            ]}
            bestFor="Users who want a hard stop (not a gentle reminder)"
          />

          <CompetitorSection
            name="PrayerCal"
            summary="Web-based tool that generates ICS calendar feeds for prayer times. No native app."
            pros={[
              "Calendar integration via ICS",
              "Works on any platform (web-based)",
              "Free",
              "Endorsed by notable figures",
            ]}
            cons={[
              "No native Mac app",
              "No menu bar",
              "No reminders or notifications",
              "No offline support",
              "Must manually subscribe to ICS feed",
              "No customization per prayer",
            ]}
            bestFor="Users who only need prayer times in their calendar"
          />

          <CompetitorSection
            name="Guidance"
            summary="Longest-running Islamic prayer app for Mac. Trusted and simple, but lacks modern features."
            pros={[
              "Trusted, established app",
              "macOS + iOS support",
              "Apple Watch support",
              "Free",
            ]}
            cons={[
              "Dated interface",
              "No calendar integration",
              "No menu bar countdown",
              "No Teams/Outlook integration",
              "Limited calculation options",
            ]}
            bestFor="Users who want a simple, cross-platform prayer times viewer"
          />
        </div>

        {/* CTA */}
        <div className="mt-20 text-center">
          <div className="neu-card inline-block p-8 sm:p-12">
            <h2 className="font-display mb-4 text-2xl font-semibold text-[var(--waqtu-text)]">
              Ready to try Waqtu?
            </h2>
            <p className="mb-6 text-[var(--waqtu-muted)]">
              Free to try. No account needed. macOS 12+.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <a
                href="/#download"
                className="neu-btn inline-flex items-center gap-2 px-8 py-3.5 font-medium text-[var(--waqtu-bg)]"
              >
                Download Waqtu
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </a>
              <a
                href="/#pricing"
                className="neu-btn-secondary inline-flex items-center gap-2 px-8 py-3.5 font-medium text-[var(--waqtu-text)]"
              >
                Lifetime access — <span className="font-mono font-bold">$2.99</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CompetitorSection({
  name,
  summary,
  pros,
  cons,
  bestFor,
}: {
  name: string;
  summary: string;
  pros: string[];
  cons: string[];
  bestFor: string;
}) {
  return (
    <section>
      <h2 className="font-display mb-2 text-2xl font-semibold text-[var(--waqtu-text)]">{name}</h2>
      <p className="mb-6 text-[var(--waqtu-muted)] leading-relaxed">{summary}</p>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="neu-card p-6">
          <h3 className="flex items-center gap-2 mb-4 text-sm font-medium text-[var(--waqtu-primary)]">
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Pros
          </h3>
          <ul className="space-y-2">
            {pros.map((p) => (
              <li key={p} className="flex items-start gap-2 text-sm text-[var(--waqtu-muted)]">
                <svg className="mt-0.5 h-4 w-4 shrink-0 text-[var(--waqtu-primary)]" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                {p}
              </li>
            ))}
          </ul>
        </div>

        <div className="neu-card p-6">
          <h3 className="flex items-center gap-2 mb-4 text-sm font-medium text-red-400">
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            Cons
          </h3>
          <ul className="space-y-2">
            {cons.map((c) => (
              <li key={c} className="flex items-start gap-2 text-sm text-[var(--waqtu-muted)]">
                <svg className="mt-0.5 h-4 w-4 shrink-0 text-[var(--waqtu-border)]" fill="none" viewBox="0 0 20 20" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 10h8" />
                </svg>
                {c}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="mt-4 text-sm text-[var(--waqtu-muted)]">
        <span className="font-medium text-[var(--waqtu-text)]">Best for: </span>
        {bestFor}
      </p>
    </section>
  );
}
