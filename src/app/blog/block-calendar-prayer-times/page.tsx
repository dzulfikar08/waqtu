import type { Metadata } from "next";
import { BlogPostLayout } from "../BlogPostLayout";

export const metadata: Metadata = {
  title: "How to Block Your Calendar for Prayer Times on Mac — Waqtu Blog",
  description:
    "A step-by-step guide to automatically blocking your work calendar during prayer times so you appear busy in Outlook and Teams.",
};

export default function Page() {
  return (
    <BlogPostLayout meta={{
      slug: "block-calendar-prayer-times",
      title: "How to Block Your Calendar for Prayer Times on Mac",
      description: "A step-by-step guide to automatically blocking your work calendar during prayer times so you appear busy in Outlook and Teams.",
      date: "May 2026",
      category: "Guide",
      readTime: "4 min read",
    }}>
      <p>
        If you work in a corporate environment with back-to-back meetings, you know the struggle:
        Dhuhr comes and goes while you&apos;re in a meeting, and you didn&apos;t even realize it.
      </p>

      <h2>Why calendar blocking matters</h2>
      <p>
        Calendar blocking is the simplest way to protect your prayer time. When your calendar shows
        you as &ldquo;busy&rdquo; during prayer times, colleagues won&apos;t schedule meetings over them.
        In Microsoft Teams and Outlook, your status automatically changes to &ldquo;Busy&rdquo; —
        no explanation needed.
      </p>

      <h2>How Waqtu does it automatically</h2>
      <ol>
        <li><strong>Grant calendar access</strong> — Waqtu asks for permission to create events</li>
        <li><strong>Choose your calendar</strong> — Select Exchange, iCloud, or your default</li>
        <li><strong>Enable calendar protection</strong> — Turn it on in Settings → General</li>
        <li><strong>Done</strong> — Waqtu creates daily prayer blocks, refreshed at midnight</li>
      </ol>

      <h2>What your colleagues see</h2>
      <p>
        In Outlook, your calendar shows &ldquo;Prayer – Dhuhr&rdquo; as busy blocks. Teams
        automatically reflects your Outlook status. Colleagues simply see you as unavailable.
      </p>

      <h2>Customizing your blocks</h2>
      <ul>
        <li><strong>Duration</strong> — Set each block to 10–20 minutes</li>
        <li><strong>Reminders</strong> — 5-min calendar alert before each prayer</li>
        <li><strong>Calendar choice</strong> — Pick Exchange for Teams sync</li>
      </ul>

      <h2>Pro tips</h2>
      <ul>
        <li>Use Exchange/Outlook so Teams reflects your status</li>
        <li>15-minute blocks give enough time for wudu and prayer</li>
        <li>Events refresh daily at midnight for accurate times</li>
        <li>Everything happens locally on your Mac — no internet needed</li>
      </ul>

      <div className="neu-card p-6 mt-10">
        <p className="font-medium text-[var(--waqtu-text)]">Ready to protect your prayer time?</p>
        <p className="mt-2 text-sm text-[var(--waqtu-muted)]">
          Download Waqtu, enable calendar protection, and never miss a prayer due to meetings again.
        </p>
        <a href="/#download" className="neu-btn mt-4 inline-flex items-center gap-2 px-6 py-3 font-medium text-[var(--waqtu-bg)]">
          Download Waqtu
        </a>
      </div>
    </BlogPostLayout>
  );
}
