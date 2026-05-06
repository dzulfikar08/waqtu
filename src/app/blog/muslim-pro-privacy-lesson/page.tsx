import type { Metadata } from "next";
import { BlogPostLayout } from "../BlogPostLayout";

export const metadata: Metadata = {
  title: "Why Your Prayer App Shouldn't Track You — Waqtu Blog",
  description:
    "The Muslim Pro data scandal was a wake-up call. Here's what happened and why offline-first prayer apps are the future.",
};

export default function Page() {
  return (
    <BlogPostLayout meta={{
      slug: "muslim-pro-privacy-lesson",
      title: "Why Your Prayer App Shouldn't Track You: The Muslim Pro Privacy Lesson",
      description: "The Muslim Pro data scandal was a wake-up call for Muslims worldwide. Here's what happened and why offline-first prayer apps matter.",
      date: "May 2026",
      category: "Privacy",
      readTime: "5 min read",
    }}>
      <p>
        In 2020, it was revealed that Muslim Pro — the world&apos;s most popular Islamic app with
        over 98 million downloads — was secretly selling user location data to data brokers,
        including a firm that later sold it to the US military.
      </p>

      <h2>What happened</h2>
      <p>
        An investigation by Vice found that Muslim Pro was using a third-party SDK to collect
        precise location data, device identifiers, and usage patterns from its users. This data
        was then sold through the data broker ecosystem — ultimately reaching government
        contractors and military intelligence firms.
      </p>

      <h2>Why it matters for prayer apps</h2>
      <p>
        Prayer apps need your location to calculate accurate prayer times. This makes them
        uniquely sensitive — every Muslim&apos;s app knows their home location, workplace,
        and daily rhythm. When a prayer app sells this data, it&apos;s not just a privacy
        violation — it&apos;s a safety concern.
      </p>

      <h2>The community&apos;s response</h2>
      <p>
        Reddit communities like r/islam and r/MuslimLounge were flooded with posts warning
        users to delete Muslim Pro. The hashtag #DeleteMuslimPro trended. Many users
        switched to open-source alternatives — but found them lacking features.
      </p>

      <h2>How Waqtu approaches privacy differently</h2>
      <ul>
        <li><strong>100% offline calculation</strong> — Prayer times are calculated locally on your Mac using the Adhan library. Your coordinates never leave your device.</li>
        <li><strong>No analytics, no tracking</strong> — We don&apos;t collect usage data. No third-party SDKs. No data brokers.</li>
        <li><strong>No account required</strong> — You don&apos;t create an account, log in, or provide an email (unless you choose to purchase).</li>
        <li><strong>Calendar stays local</strong> — Calendar events are created directly via macOS EventKit. We never read or transmit your calendar data.</li>
        <li><strong>Transparent business model</strong> — We make money by selling licenses, not data. One payment. That&apos;s it.</li>
      </ul>

      <h2>What to look for in a privacy-respecting prayer app</h2>
      <ol>
        <li><strong>Does it work offline?</strong> — If it requires internet to show prayer times, your location is being sent somewhere.</li>
        <li><strong>Is there a privacy policy?</strong> — Read it. Look for mentions of &ldquo;third-party services,&rdquo; &ldquo;analytics,&rdquo; or &ldquo;advertising partners.&rdquo;</li>
        <li><strong>Does it require an account?</strong> — If yes, why? Prayer times don&apos;t need cloud sync.</li>
        <li><strong>Open-source?</strong> — Apps you can inspect yourself eliminate trust issues entirely.</li>
        <li><strong>Paid vs free?</strong> — If it&apos;s free, you are the product. A one-time payment means the developer is paid by you, not advertisers.</li>
      </ol>

      <div className="neu-card p-6 mt-10">
        <p className="font-medium text-[var(--waqtu-text)]">Prayer times with no data collection</p>
        <p className="mt-2 text-sm text-[var(--waqtu-muted)]">
          Waqtu calculates everything on your Mac. Your location, prayer times, and calendar stay on your device — always.
        </p>
        <a href="/#download" className="neu-btn mt-4 inline-flex items-center gap-2 px-6 py-3 font-medium text-[var(--waqtu-bg)]">
          Download Waqtu
        </a>
      </div>
    </BlogPostLayout>
  );
}
