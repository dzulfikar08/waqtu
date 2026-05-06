import type { Metadata } from "next";
import { BlogPostLayout } from "../BlogPostLayout";

export const metadata: Metadata = {
  title: "Slack Status for Prayer Times — Waqtu Blog",
  description:
    "Automatically set your Slack status to 'Praying' during prayer times. A guide to Waqtu's Slack integration — no more missing Dhuhr because of Slack messages.",
};

export default function Page() {
  return (
    <BlogPostLayout meta={{
      slug: "slack-status-prayer-times",
      title: "Automatically Set Your Slack Status to 'Praying' During Prayer Times",
      description: "How Waqtu's Slack integration lets your team know you're praying — automatically.",
      date: "May 2026",
      category: "Feature",
      readTime: "3 min read",
    }}>
      <p>
        You&apos;re in a Slack-heavy workplace. Someone @mentions you during Dhuhr. Your phone buzzes.
        Your watch lights up. You feel the pressure to respond — but you&apos;re supposed to be praying.
      </p>
      <p>
        Waqtu&apos;s new Slack integration solves this. Your Slack status changes to <strong>&ldquo;Praying 🙏&rdquo;</strong>{" "}
        automatically during prayer times — and clears itself when the prayer window ends.
      </p>

      <h2>How it works</h2>
      <ol>
        <li><strong>Connect Slack</strong> — Paste a User OAuth Token in Settings → Slack</li>
        <li><strong>Enable auto-status</strong> — Toggle it on</li>
        <li><strong>Customize</strong> — Choose your status text (e.g. &ldquo;Praying&rdquo;) and emoji (:pray:, 🕌, 🙏)</li>
      </ol>
      <p>
        When a prayer time arrives, your Slack status updates immediately. Team members see your status
        and know you&apos;re unavailable. No need to explain.
      </p>

      <h2>Auto-clears when you&apos;re done</h2>
      <p>
        Waqtu uses Slack&apos;s built-in <code>status_expiration</code> feature. Your status automatically
        clears after the prayer block duration. You don&apos;t need to remember to turn it off.
      </p>

      <h2>Setup takes 3 minutes</h2>
      <ol>
        <li>Go to <a href="https://api.slack.com/apps" className="text-[var(--waqtu-primary)] hover:underline">api.slack.com/apps</a></li>
        <li>Create a new app → OAuth &amp; Permissions</li>
        <li>Add the <code>users.profile:write</code> scope</li>
        <li>Install to your workspace</li>
        <li>Copy the User OAuth Token (starts with <code>xoxp-</code>)</li>
        <li>Paste into Waqtu Settings → Slack → Connect</li>
      </ol>

      <h2>Privacy first</h2>
      <p>
        Your Slack token is stored securely in your Mac&apos;s Keychain. Waqtu never sees it, never
        transmits it, never stores it on any server. The API call goes directly from your Mac to Slack.
      </p>

      <div className="neu-card p-6 mt-10">
        <p className="font-medium text-[var(--waqtu-text)]">Try Slack integration</p>
        <p className="mt-2 text-sm text-[var(--waqtu-muted)]">
          Download Waqtu, connect Slack in Settings, and let your team know when you&apos;re praying — without saying a word.
        </p>
        <a href="/#download" className="neu-btn mt-4 inline-flex items-center gap-2 px-6 py-3 font-medium text-[var(--waqtu-bg)]">
          Download Waqtu
        </a>
      </div>
    </BlogPostLayout>
  );
}
