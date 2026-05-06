import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Slack Setup Guide — Waqtu Resources",
  description:
    "Step-by-step guide to connecting Waqtu with Slack for automatic prayer status updates. Set your status to 'Praying' during prayer times.",
};

export default function Page() {
  return (
    <div className="min-h-screen px-6 py-16 sm:px-10 md:px-14 md:py-24">
      <article className="mx-auto max-w-3xl">
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
          How to Set Up Slack Status with Waqtu
        </h1>
        <p className="mb-10 text-[var(--waqtu-muted)] leading-relaxed">
          Follow this guide to connect Waqtu to Slack. Your status will automatically change to &ldquo;Praying&rdquo; during prayer times.
        </p>

        <div className="space-y-8 text-[var(--waqtu-muted)] leading-relaxed">
          <section>
            <h2 className="font-display text-xl font-semibold text-[var(--waqtu-text)] mb-3">1. Open Slack API Console</h2>
            <p>
              Go to{" "}
              <a href="https://api.slack.com/apps" className="text-[var(--waqtu-primary)] hover:underline">
                api.slack.com/apps
              </a>{" "}
              and sign in with your Slack workspace account.
            </p>
            <p className="mt-2">Click the green <strong>&ldquo;Create New App&rdquo;</strong> button and select <strong>&ldquo;From scratch.&rdquo;</strong></p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-[var(--waqtu-text)] mb-3">2. Name Your App</h2>
            <p>Name it something like &ldquo;Waqtu&rdquo; and select your workspace. This name appears in your team&apos;s app directory.</p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-[var(--waqtu-text)] mb-3">3. Add Permissions</h2>
            <p>In the left sidebar, navigate to <strong>OAuth &amp; Permissions</strong>.</p>
            <p className="mt-2">Scroll to <strong>Scopes</strong> → <strong>User Token Scopes</strong> → click <strong>Add an OAuth Scope</strong>.</p>
            <p className="mt-2">Search for and add: <code className="neu-badge px-2 py-0.5 text-sm">users.profile:write</code></p>
            <p className="mt-2 text-sm">This scope allows Waqtu to update YOUR Slack status. It cannot read messages or access channels.</p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-[var(--waqtu-text)] mb-3">4. Install to Workspace</h2>
            <p>Scroll up to <strong>OAuth Tokens for Your Workspace</strong> and click <strong>Install to Workspace</strong>.</p>
            <p className="mt-2">Slack will ask you to authorize the app. Click <strong>Allow</strong>.</p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-[var(--waqtu-text)] mb-3">5. Copy Your Token</h2>
            <p>After installation, you&apos;ll see a <strong>User OAuth Token</strong> starting with <code>xoxp-</code>.</p>
            <p className="mt-2">Click <strong>Copy</strong> to copy it to your clipboard.</p>
            <div className="neu-card p-4 mt-3 bg-[var(--waqtu-gold)]/5 border-[var(--waqtu-gold)]/20">
              <p className="text-sm text-[var(--waqtu-gold)]">
                ⚠️ Keep this token private. Anyone with this token can update your Slack status.
              </p>
            </div>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-[var(--waqtu-text)] mb-3">6. Paste into Waqtu</h2>
            <ol className="list-decimal ml-6 space-y-1">
              <li>Open Waqtu Settings (click the Waqtu icon → Settings)</li>
              <li>Go to the <strong>Slack</strong> tab</li>
              <li>Paste your token into the &ldquo;User OAuth Token&rdquo; field</li>
              <li>Click <strong>Connect</strong></li>
              <li>Toggle on <strong>Auto-set Slack status</strong></li>
              <li>Customize your status text and emoji if desired</li>
            </ol>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-[var(--waqtu-text)] mb-3">Done!</h2>
            <p>
              When the next prayer time arrives, Waqtu will automatically set your Slack status.
              It auto-clears after the prayer block ends — no manual toggling needed.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-[var(--waqtu-text)] mb-3">Troubleshooting</h2>
            <ul className="list-disc ml-6 space-y-2">
              <li><strong>Status not updating?</strong> — Make sure the token starts with <code>xoxp-</code> (not <code>xoxb-</code> which is a bot token).</li>
              <li><strong>Token rejected?</strong> — Revisit OAuth &amp; Permissions and confirm <code>users.profile:write</code> is listed under User Token Scopes.</li>
              <li><strong>Want to disconnect?</strong> — Click Disconnect in the Slack tab, or revoke the app at api.slack.com/apps.</li>
              <li><strong>Security concern?</strong> — Your token stays in your Mac&apos;s Keychain. Waqtu never transmits it to any server.</li>
            </ul>
          </section>
        </div>

        <div className="mt-12 neu-card p-6 text-center">
          <p className="font-medium text-[var(--waqtu-text)]">Haven&apos;t downloaded Waqtu yet?</p>
          <a href="/#download" className="neu-btn mt-4 inline-flex items-center gap-2 px-6 py-3 font-medium text-[var(--waqtu-bg)]">
            Download Waqtu
          </a>
        </div>
      </article>
    </div>
  );
}
