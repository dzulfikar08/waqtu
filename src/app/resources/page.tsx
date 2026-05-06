import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Resources — Waqtu",
  description:
    "Free resources for Muslim professionals: prayer accommodation email templates, prayer times cards, and workplace guides.",
};

export default function ResourcesPage() {
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
          Resources
        </h1>
        <p className="mb-12 max-w-2xl text-[var(--waqtu-muted)] leading-relaxed">
          Free resources to help Muslim professionals navigate prayer at work — email templates,
          prayer times cards, and workplace guides.
        </p>

        <div className="grid gap-8 sm:grid-cols-2">
          {/* Slack Setup Guide */}
          <div className="neu-card p-8">
            <h2 className="font-display mb-3 text-xl font-semibold text-[var(--waqtu-text)]">
              Slack Status Setup
            </h2>
            <p className="mb-4 text-sm text-[var(--waqtu-muted)] leading-relaxed">
              Step-by-step guide to auto-set your Slack status to &ldquo;Praying&rdquo; during prayer times.
              Create a Slack app, get your token, and connect it to Waqtu.
            </p>
            <Link
              href="/resources/slack-setup"
              className="neu-btn inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-[var(--waqtu-bg)]"
            >
              View setup guide
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>
          </div>

          {/* Prayer Accommodation Template */}
          <div className="neu-card p-8">
            <h2 className="font-display mb-3 text-xl font-semibold text-[var(--waqtu-text)]">
              Prayer Accommodation Email
            </h2>
            <p className="mb-4 text-sm text-[var(--waqtu-muted)] leading-relaxed">
              A professional email template to request prayer accommodations from your manager
              or HR department. Customizable and respectful.
            </p>
            <Link
              href="/resources/prayer-accommodation"
              className="neu-btn inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-[var(--waqtu-bg)]"
            >
              View template
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>
          </div>

          {/* Prayer Times Card */}
          <div className="neu-card p-8">
            <h2 className="font-display mb-3 text-xl font-semibold text-[var(--waqtu-text)]">
              Prayer Times Card
            </h2>
            <p className="mb-4 text-sm text-[var(--waqtu-muted)] leading-relaxed">
              A printable prayer times card you can share with colleagues or post at your desk.
              Shows your typical prayer windows so the team knows when you&apos;re unavailable.
            </p>
            <Link
              href="/resources/prayer-times-card"
              className="neu-btn inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-[var(--waqtu-bg)]"
            >
              View card template
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>
          </div>

          {/* Workplace Guide */}
          <div className="neu-card p-8">
            <h2 className="font-display mb-3 text-xl font-semibold text-[var(--waqtu-text)]">
              For Managers
            </h2>
            <p className="mb-4 text-sm text-[var(--waqtu-muted)] leading-relaxed">
              A short guide for managers and team leads on supporting Muslim colleagues. Covers
              Ramadan, prayer times, and how to create an inclusive workplace.
            </p>
            <Link
              href="/blog/tell-team-about-prayer"
              className="neu-btn inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-[var(--waqtu-bg)]"
            >
              Read the guide
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>
          </div>

          {/* Calculation Methods Guide */}
          <div className="neu-card p-8">
            <h2 className="font-display mb-3 text-xl font-semibold text-[var(--waqtu-text)]">
              Calculation Methods Guide
            </h2>
            <p className="mb-4 text-sm text-[var(--waqtu-muted)] leading-relaxed">
              Understand the difference between MWL, ISNA, Egyptian, Umm al-Qura and other
              prayer time calculation methods. Find the one your mosque uses.
            </p>
            <Link
              href="/blog/prayer-time-calculation-methods"
              className="neu-btn inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-[var(--waqtu-bg)]"
            >
              Read the guide
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-16 neu-card p-8 text-center">
          <h2 className="font-display mb-2 text-xl font-semibold text-[var(--waqtu-text)]">
            More questions?
          </h2>
          <p className="mb-4 text-[var(--waqtu-muted)]">
            Check our FAQ or reach out directly. We&apos;re here to help.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <a href="/#faq" className="neu-btn-secondary inline-flex items-center gap-2 px-6 py-3 text-sm font-medium text-[var(--waqtu-text)]">
              View FAQ
            </a>
            <a href="mailto:dzulfikar.at@gmail.com" className="neu-btn inline-flex items-center gap-2 px-6 py-3 text-sm font-medium text-[var(--waqtu-bg)]">
              Contact Support
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
