import type { Metadata } from "next";
import { BlogPostLayout } from "../BlogPostLayout";

export const metadata: Metadata = {
  title: "Prayer Streaks: Build Consistency in Your Salah — Waqtu Blog",
  description:
    "How tracking prayer streaks helps build consistency. Waqtu's automatic prayer log, streak counter, and accountability features explained.",
};

export default function Page() {
  return (
    <BlogPostLayout meta={{
      slug: "prayer-streaks-build-consistency",
      title: "Prayer Streaks: How Tracking Builds Consistency in Your Salah",
      description: "Why streak tracking works and how Waqtu's prayer log helps you build consistent habits.",
      date: "May 2026",
      category: "Feature",
      readTime: "4 min read",
    }}>
      <p>
        Consistency is the hardest part of salah. Anyone can pray five times on a good day.
        The challenge is doing it every day — through meetings, travel, and fatigue.
      </p>
      <p>
        Waqtu&apos;s prayer streak tracking turns consistency into a visible, motivating habit.
        Here&apos;s how it works and why it matters.
      </p>

      <h2>Why streaks work</h2>
      <p>
        Streak tracking works because it changes your relationship with consistency. Missing a prayer
        isn&apos;t just a spiritual loss — it breaks a visible chain. That visual cue creates accountability
        that a mental note never can.
      </p>
      <p>
        Research on habit formation shows that tracking progress is one of the most effective ways to
        build lasting habits. The same principle that makes Duolingo streaks and fitness rings effective
        applies to salah.
      </p>

      <h2>How Waqtu tracks your prayers</h2>
      <ul>
        <li><strong>Automatic logging</strong> — When you click &ldquo;I am going to pray&rdquo; on the overlay, Waqtu marks
        that prayer as complete</li>
        <li><strong>Missed prayer detection</strong> — If you dismiss the overlay but keep working at your Mac,
        Waqtu notices and gently reminds you</li>
        <li><strong>Manual control</strong> — Your prayer log is always accurate because it&apos;s tied to your actual actions</li>
      </ul>

      <h2>Your streak report</h2>
      <p>
        In the Waqtu menu bar, expand the Streak section to see:
      </p>
      <ul>
        <li><strong>Current streak</strong> — How many consecutive days you&apos;ve completed all 5 prayers</li>
        <li><strong>Best streak</strong> — Your all-time record</li>
        <li><strong>Today&apos;s status</strong> — Which prayers are done, pending, or missed</li>
        <li><strong>Weekly grid</strong> — A 7-day heatmap showing your consistency patterns</li>
        <li><strong>Weekly percentage</strong> — e.g. &ldquo;15/25 (60%)&rdquo;</li>
      </ul>

      <h2>The accountability feature</h2>
      <p>
        Waqtu includes a gentle accountability mechanism. After you tap &ldquo;I am going to pray,&rdquo; Waqtu
        watches for 5 minutes. If you stay at your Mac — moving the mouse, typing — it sends a simple reminder:
      </p>
      <p className="text-[var(--waqtu-gold)] italic">
        &ldquo;Still at your Mac? You tapped &lsquo;I am going to pray&rsquo; for Dhuhr but your Mac is still active.
        Don&apos;t forget your commitment.&rdquo;
      </p>

      <h2>Privacy note</h2>
      <p>
        Your prayer log is stored locally on your Mac in UserDefaults. It never leaves your device.
        No account required. No cloud sync (unless you want iCloud in a future update).
      </p>

      <div className="neu-card p-6 mt-10">
        <p className="font-medium text-[var(--waqtu-text)]">Start your streak</p>
        <p className="mt-2 text-sm text-[var(--waqtu-muted)]">
          Download Waqtu, and let every prayer count toward your streak.
        </p>
        <a href="/#download" className="neu-btn mt-4 inline-flex items-center gap-2 px-6 py-3 font-medium text-[var(--waqtu-bg)]">
          Download Waqtu
        </a>
      </div>
    </BlogPostLayout>
  );
}
