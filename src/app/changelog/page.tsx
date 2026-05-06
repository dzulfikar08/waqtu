import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Changelog — Waqtu",
  description: "See what's new in Waqtu — features, improvements, and fixes for the Mac prayer times app.",
};

interface Release {
  version: string;
  date: string;
  changes: string[];
}

const releases: Release[] = [
  {
    version: "1.1.0",
    date: "May 2026",
    changes: [
      "Slack status integration — auto-set 'Praying' status during prayer times with auto-expiration",
      "Pre-prayer calendar buffer — start calendar blocks 0–10 min before prayer for wudu/preparation",
      "Dark/light overlay theme — choose dark or warm cream light theme for prayer reminders",
      "Prayer streak tracking — automatic prayer log with streak counter and weekly heatmap in menu bar",
      "Post-prayer activity detection — gentle reminder if you stay at your Mac after committing to pray",
      "First-run onboarding — 4-step welcome walkthrough explaining all features",
      "Google Calendar integration via OAuth",
      "Custom notification sounds (calm alternatives to Adhan)",
      "Multiple location profiles (office, home, traveling)",
      "Daily hadith/dua provider with Quranic quote in overlay",
      "Slate blue secondary color palette for UI polish",
      "Refactored color system with shared named Color constants",
    ],
  },
  {
    version: "1.0.0",
    date: "March 2026",
    changes: [
      "Prayer time countdown in macOS menu bar",
      "Calendar protection — automatic busy blocks in Exchange, iCloud, Google Calendar",
      "Full-screen calm prayer reminders with circular countdown timer",
      "13 prayer time calculation methods (MWL, ISNA, Egyptian, Umm al-Qura, and more)",
      "Hanafi and Shafi'i Asr calculation support",
      "Per-prayer minute adjustments to match local mosque times",
      "Pre-prayer notification reminders (5/10/15/30 min before)",
      "Adhan audio playback for Fajr and other prayers",
      "Snooze functionality (5/10/15 minutes)",
      "Hijri date display in menu bar dropdown",
      "Offline prayer calculation — no internet required",
      "Location privacy — coordinates never leave your Mac",
      "7-day free trial with lifetime license ($9.99)",
      "Sparkle auto-updates via Cloudflare R2",
      "Polar.sh payment integration",
    ],
  },
];

export default function ChangelogPage() {
  return (
    <div className="min-h-screen px-6 py-16 sm:px-10 md:px-14 md:py-24">
      <div className="mx-auto max-w-3xl">
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
          Changelog
        </h1>
        <p className="mb-12 text-[var(--waqtu-muted)] leading-relaxed">
          What&apos;s new in each Waqtu release. Waqtu updates automatically via Sparkle — you&apos;ll always have the latest version.
        </p>

        <div className="space-y-12">
          {releases.map((release) => (
            <div key={release.version}>
              <div className="flex items-baseline gap-3 mb-4">
                <span className="neu-badge text-sm font-semibold text-[var(--waqtu-gold)] bg-[var(--waqtu-gold)]/10 px-3 py-1 rounded-full">
                  v{release.version}
                </span>
                <span className="text-sm text-[var(--waqtu-muted)]">{release.date}</span>
              </div>
              <ul className="space-y-2">
                {release.changes.map((change, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-[var(--waqtu-muted)]">
                    <span className="mt-1.5 block h-1.5 w-1.5 rounded-full bg-[var(--waqtu-primary)] flex-shrink-0" />
                    {change}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 neu-card p-8 text-center">
          <h2 className="font-display mb-2 text-xl font-semibold text-[var(--waqtu-text)]">
            Have a feature request?
          </h2>
          <p className="mb-4 text-[var(--waqtu-muted)]">
            We build Waqtu for Muslim professionals like you. Tell us what you need.
          </p>
          <a
            href="mailto:feedback@getwaqtu.com"
            className="neu-btn inline-flex items-center gap-2 px-6 py-3 font-medium text-[var(--waqtu-bg)]"
          >
            Send feedback
          </a>
        </div>
      </div>
    </div>
  );
}
