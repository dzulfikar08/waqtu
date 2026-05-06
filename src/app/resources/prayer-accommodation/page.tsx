"use client";

import { useState } from "react";
import type { Metadata } from "next";
import Link from "next/link";

export default function PrayerAccommodationPage() {
  const [copied, setCopied] = useState<string | null>(null);

  const templates = [
    {
      id: "manager",
      title: "To your manager (1-on-1)",
      subject: "Quick note about my schedule",
      body: `Hi [Manager Name],

I wanted to give you a quick heads-up about my daily schedule. I observe daily prayers that take about 10–15 minutes each, at specific times throughout the day. I'll be stepping away briefly for these — typically once in the afternoon (around 1–2 PM) and once in the late afternoon (around 4–5 PM), depending on the season.

This won't affect my deliverables or availability for meetings — I work around my calendar and I'm happy to flex my time as needed. I've blocked these windows on my calendar so you can see when I'm away.

Let me know if you have any questions!

Best,
[Your Name]`,
    },
    {
      id: "hr",
      title: "To HR (formal accommodation request)",
      subject: "Request for religious accommodation — prayer breaks",
      body: `Dear [HR Contact Name],

I'm writing to formally request a religious accommodation for daily prayer breaks, in accordance with [Company Name]'s diversity and inclusion policy and applicable employment laws.

As a practicing Muslim, I observe five daily prayers at specific times. During standard work hours, this typically affects 1–2 prayer times per day, each requiring approximately 10–15 minutes. The specific times shift slightly throughout the year based on the solar calendar.

I've already set up automatic calendar blocking for these windows so my availability is always visible. I'm happy to discuss any scheduling concerns and ensure my work commitments are fully met.

Please let me know if you need any additional information or documentation.

Thank you,
[Your Name]`,
    },
    {
      id: "team",
      title: "To your team (casual Slack/Teams)",
      body: `Hi team! Quick FYI — I have brief windows during the day for prayer (~15 min each). I've blocked them on my calendar so you'll see when I'm away. Nothing to worry about — just a heads-up in case you notice me stepping out at regular times. Happy to answer any questions! 🙂`,
    },
  ];

  const copyTemplate = async (id: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="min-h-screen px-6 py-16 sm:px-10 md:px-14 md:py-24">
      <div className="mx-auto max-w-3xl">
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
          Prayer Accommodation Templates
        </h1>
        <p className="mb-10 max-w-2xl text-[var(--waqtu-muted)] leading-relaxed">
          Ready-to-use email templates for requesting prayer accommodations at work. Copy, customize,
          and send. No need to overthink it.
        </p>

        <div className="space-y-8">
          {templates.map((template) => (
            <div key={template.id} className="neu-card p-6 sm:p-8">
              <div className="flex items-start justify-between gap-4 mb-4">
                <h2 className="font-display text-lg font-semibold text-[var(--waqtu-text)]">
                  {template.title}
                </h2>
                <button
                  onClick={() => {
                    const fullText = template.subject
                      ? `Subject: ${template.subject}\n\n${template.body}`
                      : template.body;
                    copyTemplate(template.id, fullText);
                  }}
                  className="neu-btn-secondary shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--waqtu-text)]"
                >
                  {copied === template.id ? (
                    <>
                      <svg className="h-3.5 w-3.5 text-[var(--waqtu-primary)]" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Copied!
                    </>
                  ) : (
                    <>
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy
                    </>
                  )}
                </button>
              </div>
              {template.subject && (
                <p className="mb-3 text-sm text-[var(--waqtu-muted)]">
                  <span className="font-medium text-[var(--waqtu-text)]">Subject: </span>
                  {template.subject}
                </p>
              )}
              <pre className="whitespace-pre-wrap text-sm text-[var(--waqtu-muted)] leading-relaxed font-sans bg-[var(--waqtu-bg)] rounded-lg p-4 border border-[var(--waqtu-border)] overflow-x-auto">
                {template.body}
              </pre>
            </div>
          ))}
        </div>

        <div className="mt-10 neu-card p-6">
          <h2 className="font-display mb-2 text-lg font-semibold text-[var(--waqtu-text)]">
            Tips for sending these emails
          </h2>
          <ul className="space-y-2 text-sm text-[var(--waqtu-muted)]">
            <li>• Customize [Manager Name], [Company Name], and [Your Name] before sending</li>
            <li>• Adjust the prayer time windows to match your timezone and season</li>
            <li>• The more casual and matter-of-fact you are, the better it&apos;s received</li>
            <li>• If you&apos;ve already set up calendar blocking with Waqtu, mention it — it shows you&apos;re proactive</li>
            <li>• In most countries, religious accommodation is a legal right — you&apos;re not asking for a favor</li>
          </ul>
        </div>

        <div className="mt-8 text-center">
          <a href="/#download" className="neu-btn inline-flex items-center gap-2 px-6 py-3 font-medium text-[var(--waqtu-bg)]">
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
