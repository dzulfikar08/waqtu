import type { Metadata } from "next";
import { BlogPostLayout } from "../BlogPostLayout";

export const metadata: Metadata = {
  title: "Prayer Time Calculation Methods Explained — Waqtu Blog",
  description:
    "Understand MWL, ISNA, Egyptian, Umm al-Qura, and other prayer time calculation methods. Choose the one that matches your local mosque.",
};

export default function Page() {
  return (
    <BlogPostLayout meta={{
      slug: "prayer-time-calculation-methods",
      title: "Prayer Time Calculation Methods Explained (MWL, ISNA, Egyptian, Umm al-Qura)",
      description: "Understand the different prayer time calculation methods and which one matches your local mosque.",
      date: "April 2026",
      category: "Guide",
      readTime: "6 min read",
    }}>
      <p>
        One of the most common frustrations with prayer apps is that times don&apos;t match
        the local mosque. This is usually because the app uses a different calculation method.
        Here&apos;s what each method means and how to choose the right one.
      </p>

      <h2>Why there are different methods</h2>
      <p>
        Prayer times are based on the position of the sun. While Dhuhr, Asr, and Maghrib are
        relatively straightforward, Fajr and Isha depend on twilight angles — and different
        scholarly opinions use different angles. Additionally, high-latitude locations (above
        48°N) need special rules because twilight can persist all night in summer.
      </p>

      <h2>Common calculation methods</h2>

      <h3>Muslim World League (MWL)</h3>
      <p>
        <strong>Fajr angle:</strong> 18° | <strong>Isha angle:</strong> 17°<br />
        Used by: Europe, Far East, parts of Americas. This is the default in most apps and a
        good starting point if you&apos;re unsure.
      </p>

      <h3>ISNA (Islamic Society of North America)</h3>
      <p>
        <strong>Fajr angle:</strong> 15° | <strong>Isha angle:</strong> 15°<br />
        Used by: Most North American mosques. If you&apos;re in the US or Canada, this is likely
        what your local mosque uses. ISNA uses equal angles for Fajr and Isha.
      </p>

      <h3>Egyptian General Authority of Survey</h3>
      <p>
        <strong>Fajr angle:</strong> 19.5° | <strong>Isha angle:</strong> 17.5°<br />
        Used by: Egypt, parts of Africa, and some Middle Eastern countries. A bit earlier Fajr
        than MWL.
      </p>

      <h3>Umm al-Qura (Makkah)</h3>
      <p>
        <strong>Fajr angle:</strong> 18.5° | <strong>Isha:</strong> 90 minutes after Maghrib<br />
        Used by: Saudi Arabia and the Arabian Peninsula. Note: Isha is fixed at 90 minutes
        after Maghrib, not based on an angle.
      </p>

      <h3>University of Islamic Sciences, Karachi</h3>
      <p>
        <strong>Fajr angle:</strong> 18° | <strong>Isha angle:</strong> 18°<br />
        Used by: Pakistan, Bangladesh, India, Afghanistan. Equal Fajr/Isha angles.
      </p>

      <h3>Moonsighting Committee</h3>
      <p>
        <strong>Fajr angle:</strong> 15° | <strong>Isha angle:</strong> 15°<br />
        Used by: Parts of North America and UK. Based on actual moonsighting methodology.
      </p>

      <h2>Asr calculation: Shafi vs Hanafi</h2>
      <p>
        In addition to the method, there&apos;s the Asr timing difference:
      </p>
      <ul>
        <li><strong>Shafi/Maliki/Hanbali (earlier):</strong> Asr begins when an object&apos;s shadow equals its length.</li>
        <li><strong>Hanafi (later):</strong> Asr begins when an object&apos;s shadow equals twice its length. ~45–60 minutes later.</li>
      </ul>

      <h2>How to match your local mosque</h2>
      <p>In Waqtu, you can:</p>
      <ol>
        <li>Select the calculation method your mosque uses (Settings → Prayer Times)</li>
        <li>Choose Shafi or Hanafi for Asr</li>
        <li>Use per-prayer minute offsets (±60 min) to fine-tune any prayer to match exactly</li>
      </ol>
      <p>
        The minute offsets are the most practical feature — no matter which method you choose,
        you can adjust each prayer individually to match your mosque&apos;s exact timetable.
      </p>

      <div className="neu-card p-6 mt-10">
        <p className="font-medium text-[var(--waqtu-text)]">12 calculation methods, fully customizable</p>
        <p className="mt-2 text-sm text-[var(--waqtu-muted)]">
          Waqtu supports MWL, ISNA, Egyptian, Umm al-Qura, Karachi, Moonsighting Committee,
          Dubai, Kuwait, Qatar, Singapore, Tehran, Turkey, and custom angle settings.
        </p>
        <a href="/#download" className="neu-btn mt-4 inline-flex items-center gap-2 px-6 py-3 font-medium text-[var(--waqtu-bg)]">
          Download Waqtu
        </a>
      </div>
    </BlogPostLayout>
  );
}
