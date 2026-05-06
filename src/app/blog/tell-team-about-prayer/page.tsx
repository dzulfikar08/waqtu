import type { Metadata } from "next";
import { BlogPostLayout } from "../BlogPostLayout";

export const metadata: Metadata = {
  title: "How to Tell Your Team You Need to Pray During Work — Waqtu Blog",
  description:
    "Practical scripts and templates for discussing prayer needs with managers and colleagues — without making it awkward.",
};

export default function Page() {
  return (
    <BlogPostLayout meta={{
      slug: "tell-team-about-prayer",
      title: "How to Tell Your Team You Need to Pray During Work Hours",
      description: "Practical scripts and templates for discussing prayer needs with managers and colleagues — without making it awkward.",
      date: "April 2026",
      category: "Workplace",
      readTime: "5 min read",
    }}>
      <p>
        Starting a new job or joining a new team? Telling people you need time for prayer can
        feel awkward — especially if you&apos;re the only Muslim on the team. Here&apos;s how to
        handle it professionally.
      </p>

      <h2>The key principle: keep it simple</h2>
      <p>
        You don&apos;t need to explain the theology of salah. Most colleagues just need to know:
        (1) you&apos;ll be unavailable for a few minutes at certain times, and (2) it won&apos;t
        affect your work. Frame it like any other recurring commitment.
      </p>

      <h2>Sample scripts</h2>

      <h3>During onboarding / with your manager (1-on-1)</h3>
      <blockquote className="border-l-2 border-[var(--waqtu-primary)] pl-4 italic">
        &ldquo;Quick heads-up: I pray a few times during the workday — usually takes about
        10–15 minutes each time. It won&apos;t affect my deliverables, and I&apos;ll work around
        meetings. I just wanted to mention it in case you see me step away.&rdquo;
      </blockquote>

      <h3>In a team standup / Slack</h3>
      <blockquote className="border-l-2 border-[var(--waqtu-primary)] pl-4 italic">
        &ldquo;Hi team — just FYI, I&apos;ll have brief windows during the day for prayer
        (~15 min each). I&apos;ve blocked them on my calendar so you can see when. Happy
        to answer any questions!&rdquo;
      </blockquote>

      <h3>When a meeting conflicts</h3>
      <blockquote className="border-l-2 border-[var(--waqtu-primary)] pl-4 italic">
        &ldquo;I have a quick commitment at 1:15 PM. Could we shift this 15 minutes later,
        or would you mind if I joined 5 minutes late?&rdquo;
      </blockquote>

      <h2>Use calendar blocking to remove the conversation entirely</h2>
      <p>
        The easiest approach: automatic calendar blocking. When your calendar shows busy blocks
        during prayer times, most people won&apos;t schedule over them. They won&apos;t ask why
        you&apos;re busy — they&apos;ll just pick the next available slot.
      </p>
      <p>
        Waqtu creates these blocks automatically. Your calendar shows you as busy. Teams shows
        you as &ldquo;In a meeting.&rdquo; No awkward conversations needed.
      </p>

      <h2>What not to do</h2>
      <ul>
        <li><strong>Don&apos;t over-apologize.</strong> Praying is a right, not a favor. You&apos;re not asking permission — you&apos;re informing them of a scheduling need.</li>
        <li><strong>Don&apos;t be secretive.</strong> Stepping away without explanation creates more questions than a simple heads-up.</li>
        <li><strong>Don&apos;t make it a big deal.</strong> The more casually you treat it, the more casually they&apos;ll receive it.</li>
      </ul>

      <h2>For managers: how to support your Muslim colleagues</h2>
      <p>If you&apos;re a manager and someone on your team mentions prayer needs:</p>
      <ul>
        <li>Say &ldquo;thanks for letting me know&rdquo; and move on — don&apos;t make it a thing</li>
        <li>Avoid scheduling recurring meetings during typical Dhuhr times (12–2 PM)</li>
        <li>If you use shared calendars, the busy blocks will handle everything automatically</li>
        <li>During Ramadan, ask if they need any adjustments (many prefer early meetings)</li>
      </ul>

      <div className="neu-card p-6 mt-10">
        <p className="font-medium text-[var(--waqtu-text)]">Make it effortless with calendar blocking</p>
        <p className="mt-2 text-sm text-[var(--waqtu-muted)]">
          Waqtu automatically blocks your calendar during prayer times. Your colleagues see busy
          blocks. No explanations needed.
        </p>
        <a href="/#download" className="neu-btn mt-4 inline-flex items-center gap-2 px-6 py-3 font-medium text-[var(--waqtu-bg)]">
          Download Waqtu
        </a>
      </div>
    </BlogPostLayout>
  );
}
