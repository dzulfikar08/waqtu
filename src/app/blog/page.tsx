import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Blog — Waqtu",
  description:
    "Tips, guides, and stories about prayer times, productivity, and building habits as a Muslim professional.",
};

interface BlogPost {
  slug: string;
  title: string;
  description: string;
  date: string;
  category: string;
  readTime: string;
}

const posts: BlogPost[] = [
  {
    slug: "slack-status-prayer-times",
    title: "Automatically Set Your Slack Status to 'Praying' During Prayer Times",
    description:
      "How Waqtu's new Slack integration lets your team know you're praying — automatically. Your status sets and clears itself.",
    date: "May 2026",
    category: "Feature",
    readTime: "3 min read",
  },
  {
    slug: "prayer-streaks-build-consistency",
    title: "Prayer Streaks: How Tracking Builds Consistency in Your Salah",
    description:
      "Why streak tracking works and how Waqtu's automatic prayer log, streak counter, and accountability features help you build consistent habits.",
    date: "May 2026",
    category: "Feature",
    readTime: "4 min read",
  },
  {
    slug: "block-calendar-prayer-times",
    title: "How to Block Your Calendar for Prayer Times on Mac",
    description:
      "A step-by-step guide to automatically blocking your work calendar during prayer times so you appear busy in Outlook and Teams.",
    date: "May 2026",
    category: "Guide",
    readTime: "4 min read",
  },
  {
    slug: "muslim-pro-privacy-lesson",
    title: "Why Your Prayer App Shouldn't Track You: The Muslim Pro Privacy Lesson",
    description:
      "The Muslim Pro data scandal was a wake-up call for Muslims worldwide. Here's what happened and why offline-first prayer apps matter.",
    date: "May 2026",
    category: "Privacy",
    readTime: "5 min read",
  },
  {
    slug: "prayer-time-calculation-methods",
    title: "Prayer Time Calculation Methods Explained (MWL, ISNA, Egyptian, Umm al-Qura)",
    description:
      "Understand the different prayer time calculation methods and which one matches your local mosque.",
    date: "April 2026",
    category: "Guide",
    readTime: "6 min read",
  },
  {
    slug: "tell-team-about-prayer",
    title: "How to Tell Your Team You Need to Pray During Work Hours",
    description:
      "Practical scripts and templates for discussing prayer needs with managers and colleagues — without making it awkward.",
    date: "April 2026",
    category: "Workplace",
    readTime: "5 min read",
  },
  {
    slug: "why-mac-prayer-times-app",
    title: "Why You Need a Prayer Times App on Your Mac (Not Just Your Phone)",
    description:
      "Browser bookmarks and phone apps fall short for Muslim professionals. Here's why a native Mac app changes everything.",
    date: "May 2026",
    category: "Guide",
    readTime: "5 min read",
  },
  {
    slug: "menu-bar-prayer-times-guide",
    title: "Prayer Times in Your Menu Bar: A Guide for Muslim Professionals",
    description:
      "Why the menu bar is the perfect place for prayer times, and how it helps you stay on top of your prayers during the workday.",
    date: "April 2026",
    category: "Productivity",
    readTime: "3 min read",
  },
];

export default function BlogPage() {
  return (
    <div className="min-h-screen px-6 py-16 sm:px-10 md:px-14 md:py-24">
      <div className="mx-auto max-w-4xl">
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
          Waqtu Blog
        </h1>
        <p className="mb-12 max-w-2xl text-[var(--waqtu-muted)] leading-relaxed">
          Tips, guides, and stories about prayer times, productivity at work, and building consistent habits as a Muslim professional.
        </p>

        <div className="grid gap-6 sm:grid-cols-2">
          {posts.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="neu-card group p-6 flex flex-col hover:border-[var(--waqtu-primary)] transition-all"
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--waqtu-gold)] bg-[var(--waqtu-gold)]/10 px-2 py-0.5 rounded-full">
                  {post.category}
                </span>
                <span className="text-xs text-[var(--waqtu-muted)]">{post.readTime}</span>
              </div>
              <h2 className="font-display mb-2 text-lg font-semibold text-[var(--waqtu-text)] group-hover:text-[var(--waqtu-primary)] transition-colors">
                {post.title}
              </h2>
              <p className="flex-1 text-sm text-[var(--waqtu-muted)] leading-relaxed">
                {post.description}
              </p>
              <div className="mt-4 pt-4 border-t border-[var(--waqtu-border)] flex items-center justify-between">
                <span className="text-xs text-[var(--waqtu-muted)]">{post.date}</span>
                <span className="text-xs text-[var(--waqtu-primary)] group-hover:translate-x-1 transition-transform">
                  Read more &rarr;
                </span>
              </div>
            </Link>
          ))}
        </div>

        {/* Newsletter CTA */}
        <div className="mt-16 neu-card p-8 text-center">
          <h2 className="font-display mb-2 text-xl font-semibold text-[var(--waqtu-text)]">
            Get updates
          </h2>
          <p className="mb-4 text-[var(--waqtu-muted)]">
            New articles about prayer, productivity, and updates from Waqtu.
          </p>
          <a
            href="/#download"
            className="neu-btn inline-flex items-center gap-2 px-6 py-3 font-medium text-[var(--waqtu-bg)]"
          >
            Download Waqtu
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
}
