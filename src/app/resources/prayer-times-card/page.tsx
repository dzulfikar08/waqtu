import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Prayer Times Card — Waqtu Resources",
  description:
    "Create a printable prayer times card to share with colleagues. Shows your typical prayer windows so your team knows when you're unavailable.",
};

export default function PrayerTimesCardPage() {
  return (
    <div className="min-h-screen px-6 py-16 sm:px-10 md:px-14 md:py-24">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/resources"
          className="inline-flex items-center gap-2 text-sm text-[var(--waqtu-muted)] hover:text-[var(--waqtu-text)] transition-colors mb-8"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Resources
        </Link>

        <h1 className="font-display mb-4 text-3xl font-semibold tracking-tight text-[var(--waqtu-text)] sm:text-4xl">
          Prayer Times Card
        </h1>
        <p className="mb-10 max-w-2xl text-[var(--waqtu-muted)] leading-relaxed">
          A simple, printable card showing your typical prayer windows. Keep it at your desk or share
          it with colleagues so they know when you&apos;re unavailable for meetings.
        </p>

        {/* Example card */}
        <div className="neu-card p-8 mb-8">
          <div className="text-center mb-6">
            <h2 className="font-display text-xl font-semibold text-[var(--waqtu-text)]">My Prayer Schedule</h2>
            <p className="mt-1 text-sm text-[var(--waqtu-muted)]">
              I&apos;ll be away briefly during these prayer windows.
            </p>
          </div>

          <div className="space-y-3">
            {[
              { prayer: "Fajr", time: "Before work hours", note: "Typically before 7 AM" },
              { prayer: "Dhuhr", time: "12:30 PM – 1:30 PM", note: "15-minute break" },
              { prayer: "Asr", time: "4:00 PM – 5:00 PM", note: "15-minute break" },
              { prayer: "Maghrib", time: "Sunset (~6:30 PM)", note: "Varies by season" },
              { prayer: "Isha", time: "After work hours", note: "Typically after 8 PM" },
            ].map((p) => (
              <div key={p.prayer} className="flex items-center gap-4 p-3 rounded-lg bg-[var(--waqtu-bg)]">
                <span className="font-medium text-[var(--waqtu-gold)] w-20 text-sm">{p.prayer}</span>
                <span className="flex-1 text-sm text-[var(--waqtu-text)]">{p.time}</span>
                <span className="text-xs text-[var(--waqtu-muted)]">{p.note}</span>
              </div>
            ))}
          </div>

          <p className="mt-6 text-center text-xs text-[var(--waqtu-muted)]">
            Times are approximate and shift slightly each day. Calendar blocks are accurate.
            Questions? Just ask!
          </p>
        </div>

        <div className="neu-card p-8">
          <h2 className="font-display mb-4 text-xl font-semibold text-[var(--waqtu-text)]">
            How to use this
          </h2>
          <ol className="space-y-4 text-sm text-[var(--waqtu-muted)] list-decimal ml-6">
            <li>
              <strong className="text-[var(--waqtu-text)]">Customize the times</strong> — Update the prayer windows
              to match your location and the current season. Use Waqtu to see exact times.
            </li>
            <li>
              <strong className="text-[var(--waqtu-text)]">Print or screenshot</strong> — Keep a copy at your desk
              or share it digitally with your team.
            </li>
            <li>
              <strong className="text-[var(--waqtu-text)]">Set up calendar blocking</strong> — For the most
              reliable approach, use Waqtu&apos;s calendar protection to automatically block your calendar.
              The card is a friendly supplement, not a replacement.
            </li>
            <li>
              <strong className="text-[var(--waqtu-text)]">Keep it casual</strong> — This isn&apos;t a formal
              document. It&apos;s just a helpful reference so colleagues know when to avoid scheduling meetings.
            </li>
          </ol>
        </div>

        <div className="mt-8 text-center">
          <a href="/#download" className="neu-btn inline-flex items-center gap-2 px-6 py-3 font-medium text-[var(--waqtu-bg)]">
            Download Waqtu for automatic calendar blocking
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
}
