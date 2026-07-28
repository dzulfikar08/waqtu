import type { Metadata } from "next";
import Link from "next/link";
import { BlogPostLayout } from "../BlogPostLayout";

export const metadata: Metadata = {
  title: "How to Show Prayer Times in Your Mac Menu Bar (Setup Guide) — Waqtu",
  description:
    "Step-by-step guide to getting prayer times in your Mac menu bar. Install Waqtu, set your location, match your mosque, and block your calendar during salah.",
  alternates: { canonical: "https://getwaqtu.com/blog/show-prayer-times-menu-bar-mac" },
  openGraph: {
    title: "How to Show Prayer Times in Your Mac Menu Bar (Setup Guide)",
    description:
      "Step-by-step guide to getting prayer times in your Mac menu bar with Waqtu.",
  },
};

const howToSchema = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "How to show prayer times in your Mac menu bar",
  description:
    "Step-by-step guide to installing Waqtu and getting a live prayer countdown in your macOS menu bar, with calendar protection and mosque matching.",
  totalTime: "PT10M",
  supply: [{ "@type": "HowToSupply", name: "A Mac running macOS 12 or later" }],
  tool: [{ "@type": "HowToTool", name: "Waqtu for Mac" }],
  step: [
    {
      "@type": "HowToStep",
      position: 1,
      name: "Download and install Waqtu",
      text: "Download the Waqtu .dmg from getwaqtu.com, open it, and drag Waqtu to your Applications folder. Launch it once so macOS trusts the app.",
    },
    {
      "@type": "HowToStep",
      position: 2,
      name: "Set your location",
      text: "Open Waqtu and allow location access, or enter your city manually. Your location is used only for prayer time calculation and never leaves your Mac.",
    },
    {
      "@type": "HowToStep",
      position: 3,
      name: "Choose your calculation method",
      text: "Pick the method your local mosque uses — MWL, ISNA, Egyptian General Authority, Umm al-Qura, and others are supported.",
    },
    {
      "@type": "HowToStep",
      position: 4,
      name: "Match your local mosque times",
      text: "Add a per-prayer minute offset so Waqtu matches your congregation exactly, turning a mismatch into a 30-second fix.",
    },
    {
      "@type": "HowToStep",
      position: 5,
      name: "Enable calendar protection",
      text: "Grant calendar access so Waqtu blocks your calendar during every prayer. Outlook and Teams will then show you as busy automatically.",
    },
    {
      "@type": "HowToStep",
      position: 6,
      name: "Optional: set your Slack status",
      text: "Add a Slack User OAuth Token in Settings to have your status set to 'Praying' during prayer times and cleared when the block ends.",
    },
  ],
};

export default function Page() {
  return (
    <BlogPostLayout
      meta={{
        slug: "show-prayer-times-menu-bar-mac",
        title: "How to Show Prayer Times in Your Mac Menu Bar (Setup Guide)",
        description:
          "Step-by-step: install Waqtu, set your location, match your mosque, and get a live prayer countdown in your Mac menu bar with calendar protection.",
        date: "July 2026",
        category: "Setup Guide",
        readTime: "6 min read",
      }}
    >
      <script type="application/ld+json">
        {JSON.stringify(howToSchema)}
      </script>

      <p>
        The macOS menu bar is the most glanceable spot on your computer — it&rsquo;s
        always one look away. Putting the next prayer countdown there means you stop
        missing salah because you forgot to check. Here&rsquo;s how to set it up with{" "}
        <Link href="/">Waqtu</Link> in about ten minutes.
      </p>

      <h2>What you&rsquo;ll need</h2>
      <ul>
        <li>A Mac running macOS 12 (Monterey) or later — Intel or Apple Silicon</li>
        <li>Waqtu, downloaded free from getwaqtu.com</li>
        <li>About ten minutes</li>
      </ul>

      <h2>Step 1 — Download and install Waqtu</h2>
      <p>
        Download the Waqtu installer from the{" "}
        <Link href="/#download">download page</Link>. Open the <code>.dmg</code>,
        drag Waqtu into your Applications folder, and launch it. The first time you
        open it, macOS may ask you to confirm — that&rsquo;s normal for any app
        installed outside the Mac App Store.
      </p>
      <p>
        Once it&rsquo;s running, you&rsquo;ll see the Waqtu icon in your menu bar,
        already showing a countdown to the next prayer.
      </p>

      <h2>Step 2 — Set your location</h2>
      <p>
        Click the menu bar icon and open Settings. Allow location access so Waqtu can
        calculate accurate prayer times, or enter your city manually if you&rsquo;d
        rather not grant location permission.
      </p>
      <p>
        Your location is used only for the calculation and{" "}
        <strong>never leaves your Mac</strong>. Waqtu works fully offline.
      </p>

      <h2>Step 3 — Choose your calculation method</h2>
      <p>
        Different regions and scholars use different methods to compute Fajr and Isha
        angles. Pick the one your local mosque uses so the times line up. Waqtu
        supports the major methods — Muslim World League (MWL), ISNA, Egyptian General
        Authority, Umm al-Qura, and more. For a deeper explanation, read our guide to{" "}
        <Link href="/blog/prayer-time-calculation-methods">
          prayer time calculation methods
        </Link>
        .
      </p>
      <p>
        You can also set the Asr calculation to match your madhab — Hanafi or
        Shafi&rsquo;i.
      </p>

      <h2>Step 4 — Match your local mosque times</h2>
      <p>
        Even with the right method, your mosque may start a few minutes earlier or
        later. Add a per-prayer minute offset (for example, +5 minutes for Dhuhr) so
        Waqtu matches your congregation exactly. This is the single biggest reason
        people abandon prayer apps — and it&rsquo;s a 30-second fix here.
      </p>

      <h2>Step 5 — Enable calendar protection</h2>
      <p>
        This is the feature that sets Waqtu apart. Grant calendar access in Settings,
        and Waqtu will block your calendar during every prayer — on your default
        calendar, plus Exchange and iCloud. Outlook and Teams then show you as busy
        automatically, so colleagues stop booking over your salah.
      </p>
      <p>
        For the full walkthrough, see our guide on{" "}
        <Link href="/blog/block-calendar-prayer-times">
          how to block your calendar for prayer times on Mac
        </Link>
        .
      </p>

      <h2>Step 6 (optional) — Set your Slack status automatically</h2>
      <p>
        If your team uses Slack, add a Slack User OAuth Token in Settings &rarr; Slack.
        Waqtu will set your status to &ldquo;Praying&rdquo; during prayer times and
        clear it when the block ends, using Slack&rsquo;s native status expiration. See
        our{" "}
        <Link href="/resources/slack-setup">Slack setup guide</Link> for the exact
        steps.
      </p>

      <h2>You&rsquo;re set</h2>
      <p>
        That&rsquo;s it. You now have a live prayer countdown in your menu bar, your
        calendar protected during salah, and — if you enabled it — a Slack status that
        tells your team you&rsquo;re praying. No ads, no tracking, no subscription.
      </p>

      <h2>Frequently asked questions</h2>
      <p>
        <strong>Do I need an internet connection?</strong> Only for the initial
        download and updates. All prayer time calculation happens on your Mac.
      </p>
      <p>
        <strong>Will it drain my battery?</strong> No. The menu bar countdown is
        lightweight and updates quietly in the background.
      </p>
      <p>
        <strong>Is there a cost?</strong> Waqtu is free to try. When you&rsquo;re
        ready, use code <code>WAQTU299</code> for lifetime access at $2.99.
      </p>

      <div className="neu-card p-6 mt-10">
        <p className="font-medium text-[var(--waqtu-text)]">Get prayer times in your menu bar</p>
        <p className="mt-2 text-sm text-[var(--waqtu-muted)]">
          Download Waqtu free and follow the steps above. You&rsquo;ll have a menu bar
          countdown in minutes. macOS 12+.
        </p>
        <a
          href="/#download"
          className="neu-btn mt-4 inline-flex items-center gap-2 px-6 py-3 font-medium text-[var(--waqtu-bg)]"
        >
          Download Waqtu
        </a>
      </div>
    </BlogPostLayout>
  );
}
