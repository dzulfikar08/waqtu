import type { Metadata } from "next";
import { BlogPostLayout } from "../BlogPostLayout";

export const metadata: Metadata = {
  title: "Prayer Times in Your Menu Bar — A Guide for Muslim Professionals",
  description:
    "Why the Mac menu bar is the perfect place for prayer times, and how it helps you stay on top of your prayers during the workday.",
};

export default function Page() {
  return (
    <BlogPostLayout meta={{
      slug: "menu-bar-prayer-times-guide",
      title: "Prayer Times in Your Menu Bar: A Guide for Muslim Professionals",
      description: "Why the menu bar is the perfect place for prayer times, and how it helps you stay on top of your prayers during the workday.",
      date: "April 2026",
      category: "Productivity",
      readTime: "3 min read",
    }}>
      <p>
        You check your menu bar dozens of times a day — for the time, your WiFi, your battery,
        your Slack notifications. Now add prayer times to that list.
      </p>

      <h2>The problem with phone-based prayer apps</h2>
      <p>
        Most Muslims use their phone to check prayer times. But at work, pulling out your
        phone every hour is (a) distracting, (b) looks unprofessional, and (c) means you
        might forget to check entirely.
      </p>
      <p>
        A phone app requires you to <em>remember</em> to open it. A menu bar app shows you
        the time <em>without you remembering</em>.
      </p>

      <h2>Why the menu bar works</h2>
      <ul>
        <li><strong>Always visible</strong> — A quick glance tells you the next prayer and countdown. No apps to open.</li>
        <li><strong>Discreet</strong> — It&apos;s just an icon and time. Colleagues won&apos;t know what you&apos;re checking.</li>
        <li><strong>Contextual</strong> — You&apos;re already on your Mac for work. Prayer times live where you work.</li>
        <li><strong>No friction</strong> — Zero clicks to see prayer times. Information radiators work.</li>
      </ul>

      <h2>What Waqtu shows in the menu bar</h2>
      <ul>
        <li>A small icon with the Waqtu symbol</li>
        <li>Click to see the full dropdown: next prayer countdown, today&apos;s prayer times, Hijri date, your location</li>
        <li>Quick toggle for the reminder overlay</li>
        <li>Settings and Quit buttons</li>
      </ul>
      <p>
        The dropdown also shows your current location (city, country) and the Hijri date —
        useful during Ramadan and Islamic months.
      </p>

      <h2>Beyond the menu bar</h2>
      <p>
        Waqtu isn&apos;t just a menu bar counter. It also:
      </p>
      <ul>
        <li>Blocks your calendar during prayer times (Exchange, iCloud)</li>
        <li>Shows a calm full-screen reminder when it&apos;s time for prayer</li>
        <li>Sends pre-prayer notification reminders (&ldquo;Asr in 5 minutes&rdquo;)</li>
        <li>Plays Adhan audio (optional)</li>
        <li>Supports 12+ calculation methods with per-prayer offsets</li>
        <li>Works completely offline — no data leaves your Mac</li>
      </ul>

      <div className="neu-card p-6 mt-10">
        <p className="font-medium text-[var(--waqtu-text)]">Prayer times at a glance</p>
        <p className="mt-2 text-sm text-[var(--waqtu-muted)]">
          Free to try. macOS 12+. See your next prayer time without opening a single app.
        </p>
        <a href="/#download" className="neu-btn mt-4 inline-flex items-center gap-2 px-6 py-3 font-medium text-[var(--waqtu-bg)]">
          Download Waqtu
        </a>
      </div>
    </BlogPostLayout>
  );
}
