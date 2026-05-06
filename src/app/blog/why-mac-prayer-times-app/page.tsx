import type { Metadata } from "next";
import { BlogPostLayout } from "../BlogPostLayout";

export const metadata: Metadata = {
  title: "Why You Need a Prayer Times App for Mac — Waqtu Blog",
  description:
    "If you spend your day in front of a Mac, you need prayer times where you actually look: in your menu bar. Here's why browser bookmarks and phone apps fall short.",
};

export default function Page() {
  return (
    <BlogPostLayout meta={{
      slug: "why-mac-prayer-times-app",
      title: "Why You Need a Prayer Times App on Your Mac (Not Just Your Phone)",
      description: "Browser bookmarks and phone apps fall short for Muslim professionals. Here's why a native Mac app changes everything.",
      date: "May 2026",
      category: "Guide",
      readTime: "5 min read",
    }}>
      <p>
        Most Muslims check prayer times on their phone. That works at home. At work, it doesn&apos;t.
      </p>
      <p>
        You&apos;re in a flow state. You&apos;re deep in code, or a spreadsheet, or a presentation.
        Your phone is in your bag or on Do Not Disturb. Dhuhr comes and goes without you noticing.
      </p>
      <p>
        This is the problem a native Mac prayer times app solves. Not by being another prayer app —
        but by putting prayer times where you already look: your menu bar.
      </p>

      <h2>The problem with browser bookmarks</h2>
      <p>
        Many people rely on IslamicFinder.org or similar sites. You bookmark them. You check when you
        remember. Three problems:
      </p>
      <ul>
        <li><strong>You have to remember to check</strong> — The browser doesn&apos;t remind you</li>
        <li><strong>Requires internet</strong> — No offline calculation, and your location data goes to a server</li>
        <li><strong>No calendar integration</strong> — Colleagues still book meetings over your prayer time</li>
      </ul>

      <h2>The problem with phone apps</h2>
      <p>
        Phone apps are great — for home. At work:
      </p>
      <ul>
        <li>Your phone is often out of sight, on silent, or in your bag</li>
        <li>Notifications compete with Slack, email, and everything else</li>
        <li>Checking your phone during a meeting looks like you&apos;re distracted</li>
      </ul>

      <h2>Why the menu bar</h2>
      <p>
        The macOS menu bar is the most glanceable real estate on your computer. It&apos;s always visible,
        always one look away. Waqtu puts the next prayer countdown there — &ldquo;Dhuhr in 1h 45m&rdquo; —
        quietly updating every second.
      </p>
      <p>
        You don&apos;t open anything. You don&apos;t check anything. You just see it, like you see the time.
      </p>

      <h2>What a native Mac app gets you</h2>
      <ul>
        <li><strong>Calendar blocking</strong> — Automatically show as &ldquo;busy&rdquo; during prayers in Outlook/Teams</li>
        <li><strong>Offline calculation</strong> — Prayer times calculated on-device, no internet needed</li>
        <li><strong>Location privacy</strong> — Your location stays on your Mac, never transmitted</li>
        <li><strong>Slack status</strong> — Auto-set &ldquo;Praying&rdquo; during prayer times</li>
        <li><strong>Prayer streaks</strong> — Track your consistency automatically</li>
      </ul>

      <h2>No account needed</h2>
      <p>
        Waqtu doesn&apos;t require an account. There&apos;s no login, no cloud sync (unless you want it),
        no data collection. Everything runs locally on your Mac. Your prayer data is yours alone.
      </p>

      <h2>One payment, forever</h2>
      <p>
        Waqtu costs $9.99 for lifetime access — less than most apps charge per year. No subscription.
        No recurring charges. One payment, all features, all future updates.
      </p>

      <div className="neu-card p-6 mt-10">
        <p className="font-medium text-[var(--waqtu-text)]">Try it yourself</p>
        <p className="mt-2 text-sm text-[var(--waqtu-muted)]">
          Download Waqtu free. The trial gives you full access. See how prayer times in your menu bar changes your day.
        </p>
        <a href="/#download" className="neu-btn mt-4 inline-flex items-center gap-2 px-6 py-3 font-medium text-[var(--waqtu-bg)]">
          Download Waqtu
        </a>
      </div>
    </BlogPostLayout>
  );
}
