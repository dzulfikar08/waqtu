"use client";

import { useState, useEffect } from "react";
import {
  createCheckout,
  POLAR_PRODUCTS,
  isTierAvailable,
} from "@/lib/api/payments";

type LoadingState = {
  [key: string]: boolean;
};

type MediaType = "video" | "image";

export default function Home() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<LoadingState>({});
  const [expandedMedia, setExpandedMedia] = useState<MediaType | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  // Track scroll for header state
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close mobile menu when clicking a link
  const handleNavClick = () => {
    setMobileMenuOpen(false);
  };

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  const handleCheckout = async (tier: "PRO_MONTHLY" | "PRO_LIFETIME") => {
    if (!isTierAvailable(tier)) {
      console.error("Product not configured:", tier);
      // For now, just redirect to download
      window.location.href = "#download";
      return;
    }

    const productId = POLAR_PRODUCTS[tier];
    setIsLoading((prev) => ({ ...prev, [tier]: true }));

    try {
      const { url } = await createCheckout({ productId });
      window.location.href = url;
    } catch (error) {
      console.error("Checkout error:", error);
      // Fallback to download section
      window.location.href = "#download";
    } finally {
      setIsLoading((prev) => ({ ...prev, [tier]: false }));
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background gradient mesh */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        aria-hidden
        style={{
          background: `
            radial-gradient(ellipse 80% 50% at 50% -20%, rgba(74, 139, 111, 0.18), transparent),
            radial-gradient(ellipse 60% 40% at 90% 60%, rgba(45, 95, 76, 0.2), transparent),
            radial-gradient(ellipse 50% 30% at 10% 80%, rgba(212, 165, 116, 0.08), transparent)
          `,
        }}
      />

      {/* Header */}
      <header
        className={`
          fixed top-0 left-0 right-0 z-50
          flex items-center justify-between px-4 sm:px-6 md:px-14
          transition-all duration-300 ease-out
          ${isScrolled || mobileMenuOpen
            ? "py-3 bg-[var(--waqtu-bg)]/98 backdrop-blur-xl border-b border-[var(--waqtu-border)] shadow-sm"
            : "py-5 bg-transparent border-b border-transparent"
          }
        `}
      >
        {/* Logo */}
        <a
          href="#"
          onClick={handleNavClick}
          className="font-display text-xl font-semibold tracking-tight text-[var(--waqtu-text)] relative z-50"
        >
          Waqtu
        </a>

        {/* Desktop Navigation */}
        <nav className="hidden sm:flex items-center gap-8 text-sm">
          <a
            href="#features"
            onClick={handleNavClick}
            className="text-[var(--waqtu-muted)] transition-colors hover:text-[var(--waqtu-text)]"
          >
            Features
          </a>
          <a
            href="#pricing"
            onClick={handleNavClick}
            className="text-[var(--waqtu-muted)] transition-colors hover:text-[var(--waqtu-text)]"
          >
            Pricing
          </a>
          <a
            href="#faq"
            onClick={handleNavClick}
            className="text-[var(--waqtu-muted)] transition-colors hover:text-[var(--waqtu-text)]"
          >
            FAQ
          </a>
          <a
            href="#pricing"
            onClick={handleNavClick}
            className="rounded-full bg-[var(--waqtu-primary)] px-5 py-2.5 font-medium text-[var(--waqtu-bg)] transition-all hover:bg-[var(--waqtu-primary-soft)] hover:shadow-[0_0_24px_rgba(74,139,111,0.35)]"
          >
            Get Waqtu
          </a>
        </nav>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="sm:hidden relative z-50 p-2 -mr-2 text-[var(--waqtu-text)] touch-manipulation"
          aria-label="Toggle menu"
          aria-expanded={mobileMenuOpen}
        >
          <svg
            className={`h-6 w-6 transition-transform duration-300 ${mobileMenuOpen ? "rotate-90" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            {mobileMenuOpen ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M6 18L18 6M6 6l12 12"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M4 6h16M4 12h16M4 18h16"
              />
            )}
          </svg>
        </button>

        {/* Mobile Menu - Combined overlay and content */}
        <div
          className={`
            fixed inset-0 sm:hidden
            flex flex-col
            transition-all duration-300 ease-out
            ${mobileMenuOpen
              ? "opacity-100 pointer-events-auto"
              : "opacity-0 pointer-events-none"
            }
          `}
          style={{ zIndex: 40, backgroundColor: 'var(--waqtu-bg, #0f1914)' }}
          onClick={() => setMobileMenuOpen(false)}
        >

          {/* Close button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMobileMenuOpen(false);
            }}
            className="absolute top-6 right-4 p-2 text-[var(--waqtu-text)] touch-manipulation"
            aria-label="Close menu"
          >
            <svg
              className="h-8 w-8"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>

          {/* Menu content */}
          <nav
            className="relative flex-1 flex flex-col items-center justify-center gap-10 px-6"
            onClick={(e) => e.stopPropagation()}
          >
            <a
              href="#features"
              onClick={handleNavClick}
              className="text-3xl font-medium text-[var(--waqtu-text)] hover:text-[var(--waqtu-primary)] transition-colors py-2"
            >
              Features
            </a>
            <a
              href="#pricing"
              onClick={handleNavClick}
              className="text-3xl font-medium text-[var(--waqtu-text)] hover:text-[var(--waqtu-primary)] transition-colors py-2"
            >
              Pricing
            </a>
            <a
              href="#faq"
              onClick={handleNavClick}
              className="text-3xl font-medium text-[var(--waqtu-text)] hover:text-[var(--waqtu-primary)] transition-colors py-2"
            >
              FAQ
            </a>
            <a
              href="#pricing"
              onClick={handleNavClick}
              className="mt-4 rounded-full bg-[var(--waqtu-primary)] px-10 py-4 text-xl font-medium text-[var(--waqtu-bg)] transition-all hover:bg-[var(--waqtu-primary-soft)] hover:shadow-[0_0_24px_rgba(74,139,111,0.35)]"
            >
              Get Waqtu
            </a>
          </nav>
        </div>
      </header>

      <main className="relative z-10">
        {/* Spacer for fixed header */}
        <div className="h-20 sm:h-24" />

        {/* Hero Section */}
        <section className="px-6 pb-32 sm:px-10 md:px-14 md:pb-44">
          <div className="flex flex-col items-center text-center">
            <p
              className="animate-fade-up mb-6 text-sm font-medium uppercase tracking-[0.2em] text-[var(--waqtu-gold)]"
              style={{ animationDelay: "0ms", opacity: 0 }}
            >
              Prayer times · Calendar protection · Mac menu bar
            </p>
            <h1
              className="font-display animate-fade-up max-w-4xl text-4xl font-semibold leading-[1.15] tracking-tight text-[var(--waqtu-text)] sm:text-5xl md:text-6xl md:leading-[1.1]"
              style={{ animationDelay: "80ms", opacity: 0 }}
            >
              You check your calendar,
              <br />
              <span className="text-[var(--waqtu-light)]">
                see a meeting at 1:15 PM.
              </span>
              <br />
              But Dhuhr is at 1:00 PM.
            </h1>
            <p
              className="animate-fade-up mt-8 max-w-xl text-lg leading-relaxed text-[var(--waqtu-muted)]"
              style={{ animationDelay: "160ms", opacity: 0 }}
            >
              Time for prayer, without the awkward calendar conflicts. Waqtu
              sits in your menu bar and blocks your calendar during prayer
              times—so Outlook and Teams show you as busy before you even step
              away.
            </p>
            <div
              className="animate-fade-up mt-12 flex flex-wrap items-center justify-center gap-4"
              style={{ animationDelay: "240ms", opacity: 0 }}
            >
              <a
                href="#pricing"
                className="group inline-flex items-center gap-2 rounded-full bg-[var(--waqtu-primary)] px-6 py-3.5 font-medium text-[var(--waqtu-bg)] transition-all hover:bg-[var(--waqtu-primary-soft)] hover:shadow-[0_0_28px_rgba(74,139,111,0.4)]"
              >
                Get Waqtu for Mac
                <span className="transition-transform group-hover:translate-x-0.5">
                  →
                </span>
              </a>
              <a
                href="#features"
                className="inline-flex items-center gap-2 text-[var(--waqtu-muted)] transition-colors hover:text-[var(--waqtu-text)]"
              >
                See how it works
              </a>
            </div>

            {/* Trust indicators */}
            <div
              className="animate-fade-up mt-16 flex flex-wrap items-center justify-center gap-8 text-[var(--waqtu-muted)]"
              style={{ animationDelay: "320ms", opacity: 0 }}
            >
              <div className="flex items-center gap-2">
                <svg
                  className="h-5 w-5 text-[var(--waqtu-gold)]"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span className="text-sm">30-day money-back guarantee</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm">Free to try</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm">macOS 12+</span>
              </div>
            </div>
          </div>
        </section>

        {/* Problem Agitation Section */}
        <section className="relative z-10 section-tint-1 px-6 py-16 sm:px-10 md:px-14 md:py-24">
          <div className="mx-auto max-w-2xl">
            <h2 className="font-display mb-6 text-center text-2xl font-semibold tracking-tight text-[var(--waqtu-text)] sm:text-3xl">
              We know what it's like.
            </h2>
            <div className="space-y-4 text-[var(--waqtu-muted)] leading-relaxed">
              <p>
                You're in back-to-back meetings. The prayer time comes and goes.
                You make a mental note to "make it up later"{" "}
                <em className="text-[var(--waqtu-gold)]">(again)</em>. Or you
                step away and come back to "Where were you?" messages.
              </p>
              <p>
                Your calendar doesn't know about your prayers. Your colleagues
                don't either.
              </p>
              <p className="text-[var(--waqtu-text)] font-medium">
                It's not that work is more important. It's just... louder.
              </p>
            </div>
          </div>
        </section>

        {/* Your Day with Waqtu - Timeline */}
        <section className="relative z-10 section-tint-2 px-6 py-16 sm:px-10 md:px-14 md:py-24">
          <div className="mx-auto max-w-3xl">
            <h2 className="font-display mb-4 text-center text-2xl font-semibold tracking-tight text-[var(--waqtu-text)] sm:text-3xl">
              Your day with Waqtu
            </h2>
            <p className="mx-auto mb-12 max-w-2xl text-center text-[var(--waqtu-muted)]">
              See how Waqtu fits into your daily rhythm.
            </p>

            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-4 top-0 h-full w-0.5 bg-[var(--waqtu-border)] sm:left-6" />

              <div className="space-y-8">
                {/* Fajr */}
                <div className="relative flex gap-4 sm:gap-6">
                  <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--waqtu-bg)] border-2 border-[var(--waqtu-gold)] sm:h-10 sm:w-10">
                    <span className="text-xs text-[var(--waqtu-gold)]">🌙</span>
                  </div>
                  <div className="flex-1 rounded-2xl border border-[var(--waqtu-border)] bg-[var(--waqtu-surface)]/60 p-6 backdrop-blur-sm">
                    <h3 className="font-display font-semibold text-[var(--waqtu-gold)]">
                      Morning · Fajr
                    </h3>
                    <p className="mt-2 text-sm text-[var(--waqtu-muted)]">
                      A gentle wake-up reminder. Your calendar is still yours—no
                      blocks needed while you sleep.
                    </p>
                  </div>
                </div>

                {/* Work begins */}
                <div className="relative flex gap-4 sm:gap-6">
                  <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--waqtu-bg)] border-2 border-[var(--waqtu-muted)] sm:h-10 sm:w-10">
                    <span className="text-xs text-[var(--waqtu-muted)]">
                      💻
                    </span>
                  </div>
                  <div className="flex-1 rounded-2xl border border-[var(--waqtu-border)] bg-[var(--waqtu-surface)]/60 p-6 backdrop-blur-sm">
                    <h3 className="font-display font-semibold text-[var(--waqtu-text)]">
                      Mid-morning · Work begins
                    </h3>
                    <p className="mt-2 text-sm text-[var(--waqtu-muted)]">
                      Waqtu sits quietly in your menu bar, showing a countdown
                      to Dhuhr. No interruptions.
                    </p>
                  </div>
                </div>

                {/* Dhuhr */}
                <div className="relative flex gap-4 sm:gap-6">
                  <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--waqtu-bg)] border-2 border-[var(--waqtu-primary)] sm:h-10 sm:w-10">
                    <span className="text-xs text-[var(--waqtu-primary)]">
                      🕌
                    </span>
                  </div>
                  <div className="flex-1 rounded-2xl border border-[var(--waqtu-primary)]/30 bg-[var(--waqtu-card)]/80 p-6 backdrop-blur-sm">
                    <h3 className="font-display font-semibold text-[var(--waqtu-primary)]">
                      1:00 PM · Dhuhr arrives
                    </h3>
                    <p className="mt-2 text-sm text-[var(--waqtu-muted)]">
                      A calm full-screen reminder appears. You dismiss it when
                      ready—and your calendar now shows you{" "}
                      <span className="text-[var(--waqtu-primary)]">
                        "busy"
                      </span>{" "}
                      until 1:20 PM.
                    </p>
                    <p className="mt-2 text-sm text-[var(--waqtu-muted)]">
                      Your colleagues see "Busy" in Teams. No awkward "where
                      were you?" messages.
                    </p>
                  </div>
                </div>

                {/* Asr & Maghrib */}
                <div className="relative flex gap-4 sm:gap-6">
                  <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--waqtu-bg)] border-2 border-[var(--waqtu-primary)] sm:h-10 sm:w-10">
                    <span className="text-xs text-[var(--waqtu-primary)]">
                      🕌
                    </span>
                  </div>
                  <div className="flex-1 rounded-2xl border border-[var(--waqtu-border)] bg-[var(--waqtu-surface)]/60 p-6 backdrop-blur-sm">
                    <h3 className="font-display font-semibold text-[var(--waqtu-text)]">
                      Afternoon · Asr & Maghrib
                    </h3>
                    <p className="mt-2 text-sm text-[var(--waqtu-muted)]">
                      Same peaceful rhythm. You step away, your calendar
                      protects you, you return.
                    </p>
                  </div>
                </div>

                {/* Isha */}
                <div className="relative flex gap-4 sm:gap-6">
                  <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--waqtu-bg)] border-2 border-[var(--waqtu-gold)] sm:h-10 sm:w-10">
                    <span className="text-xs text-[var(--waqtu-gold)]">🌙</span>
                  </div>
                  <div className="flex-1 rounded-2xl border border-[var(--waqtu-border)] bg-[var(--waqtu-surface)]/60 p-6 backdrop-blur-sm">
                    <h3 className="font-display font-semibold text-[var(--waqtu-gold)]">
                      Evening · Isha
                    </h3>
                    <p className="mt-2 text-sm text-[var(--waqtu-muted)]">
                      Final prayer of the day, final block on your calendar.
                      Tomorrow, Waqtu is there again.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Quote strip */}
        <section className="relative z-10 section-tint-1 border-y border-[var(--waqtu-border)] px-6 py-10 sm:px-10 md:px-14">
          <blockquote
            className="animate-fade-in mx-auto max-w-2xl text-center text-lg italic leading-relaxed text-[var(--waqtu-muted)]"
            style={{ opacity: 0 }}
          >
            "Indeed, prayer is obligatory on the believers at specified times."
          </blockquote>
          <cite className="mt-3 block text-center text-sm not-italic text-[var(--waqtu-gold)]">
            — Quran 4:103
          </cite>
        </section>

        {/* Features Section */}
        <section
          id="features"
          className="relative z-10 section-tint-2 px-6 py-24 sm:px-10 md:px-14 md:py-32"
        >
          <div className="mx-auto max-w-6xl">
            <h2 className="font-display mb-4 text-center text-2xl font-semibold tracking-tight text-[var(--waqtu-text)] sm:text-3xl">
              What Waqtu does
            </h2>
            <p className="mx-auto mb-16 max-w-2xl text-center text-[var(--waqtu-muted)]">
              Three thoughtful features designed to help you stay consistent
              with your prayers without disrupting your workflow.
            </p>
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  title: "Never wonder when the next prayer is",
                  description:
                    "A quick glance at your menu bar tells you. No checking apps, no guessing.",
                  icon: "○",
                },
                {
                  title: "Calm, not alarming",
                  description:
                    "A peaceful overlay appears when it's time. Dismiss when you're ready to pray.",
                  icon: "◇",
                },
                {
                  title: "Your faith on your calendar",
                  description:
                    "Waqtu creates busy blocks in your calendar—Exchange, iCloud, or default. Outlook & Teams show you as busy.",
                  icon: "▷",
                },
              ].map((item, i) => (
                <article
                  key={item.title}
                  className="group rounded-2xl border border-[var(--waqtu-border)] bg-[var(--waqtu-surface)]/60 p-8 backdrop-blur-sm transition-all hover:border-[var(--waqtu-primary)]/30 hover:bg-[var(--waqtu-card)]/80"
                  style={{
                    animationDelay: `${320 + i * 60}ms`,
                  }}
                >
                  <span className="mb-4 block text-2xl text-[var(--waqtu-gold)] opacity-80">
                    {item.icon}
                  </span>
                  <h3 className="font-display mb-3 text-lg font-semibold text-[var(--waqtu-text)]">
                    {item.title}
                  </h3>
                  <p className="text-[var(--waqtu-muted)] leading-relaxed">
                    {item.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Visual Showcase Section */}
        <section className="relative z-10 border-y border-[var(--waqtu-border)] px-6 py-16 sm:px-10 md:px-14 md:py-24">
          <div className="mx-auto max-w-5xl">
            <h2 className="font-display mb-4 text-center text-2xl font-semibold tracking-tight text-[var(--waqtu-text)] sm:text-3xl">
              See Waqtu in action
            </h2>
            <p className="mx-auto mb-12 max-w-2xl text-center text-[var(--waqtu-muted)]">
              A calm reminder when it's time to pray. Your calendar protected
              during prayer times.
            </p>

            <div className="grid gap-8 md:grid-cols-2">
              {/* Video - Full screen reminder */}
              <div 
                className="rounded-2xl border border-[var(--waqtu-border)] bg-[var(--waqtu-surface)]/60 p-4 backdrop-blur-sm cursor-pointer hover:border-[var(--waqtu-primary)]/50 transition-all"
                onClick={() => setExpandedMedia("video")}
              >
                <div className="mb-3">
                  <h3 className="font-display text-lg font-semibold text-[var(--waqtu-text)]">
                    Full-screen prayer reminder
                  </h3>
                  <p className="mt-1 text-sm text-[var(--waqtu-muted)]">
                    A peaceful overlay appears at prayer time. Dismiss when
                    you're ready. Click to expand.
                  </p>
                </div>
                <video
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full rounded-xl border border-[var(--waqtu-border)]"
                >
                  <source src="/waqtu.mp4" type="video/mp4" />
                </video>
              </div>

              {/* Image - Teams calendar */}
              <div 
                className="rounded-2xl border border-[var(--waqtu-border)] bg-[var(--waqtu-surface)]/60 p-4 backdrop-blur-sm cursor-pointer hover:border-[var(--waqtu-primary)]/50 transition-all"
                onClick={() => setExpandedMedia("image")}
              >
                <div className="mb-3">
                  <h3 className="font-display text-lg font-semibold text-[var(--waqtu-text)]">
                    Your calendar respects your prayers
                  </h3>
                  <p className="mt-1 text-sm text-[var(--waqtu-muted)]">
                    Waqtu blocks your calendar during prayer times. Teams shows
                    you as "Busy". Click to expand.
                  </p>
                </div>
                <img
                  src="/waqtu.webp"
                  alt="Teams calendar showing prayer time blocked as busy"
                  className="w-full rounded-xl border border-[var(--waqtu-border)]"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Testimonials Section - Hidden until we have real feedback */}
        {/* <section className="relative z-10 border-y border-[var(--waqtu-border)] px-6 py-16 sm:px-10 md:px-14 md:py-24">
          <div className="mx-auto max-w-4xl">
            <h2 className="font-display mb-4 text-center text-2xl font-semibold tracking-tight text-[var(--waqtu-text)] sm:text-3xl">
              Join Muslims who've made prayer part of their work day
            </h2>
            <p className="mx-auto mb-12 max-w-2xl text-center text-[var(--waqtu-muted)]">
              No more choosing between meetings and prayer.
            </p>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  name: "Ahmed",
                  role: "Software Engineer, London",
                  text: "Waqtu solved the 'where were you?' problem at work. My colleagues now see me as busy during Dhuhr—it just feels respectful all around.",
                },
                {
                  name: "Fatima",
                  role: "Product Manager, Toronto",
                  text: "I used to feel guilty choosing between meetings and prayer. Now I don't have to choose.",
                },
                {
                  name: "Yusuf",
                  role: "Remote Designer, NYC",
                  text: "Finally, an app that doesn't feel like it's judging me. It just helps.",
                },
              ].map((testimonial, i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-[var(--waqtu-border)] bg-[var(--waqtu-surface)]/60 p-6 backdrop-blur-sm"
                >
                  <p className="mb-4 text-[var(--waqtu-muted)] leading-relaxed">
                    "{testimonial.text}"
                  </p>
                  <div>
                    <p className="font-medium text-[var(--waqtu-text)]">
                      {testimonial.name}
                    </p>
                    <p className="text-sm text-[var(--waqtu-muted)]">
                      {testimonial.role}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section> */}

        {/* Pricing Section */}
        <section
          id="pricing"
          className="relative z-10 section-tint-3 px-6 py-24 sm:px-10 md:px-14 md:py-32"
        >
          <div className="mx-auto max-w-3xl">
            <h2 className="font-display mb-4 text-center text-2xl font-semibold tracking-tight text-[var(--waqtu-text)] sm:text-3xl">
              Simple, transparent pricing
            </h2>
            <p className="mx-auto mb-16 max-w-2xl text-center text-[var(--waqtu-muted)]">
              Everything you need to protect your prayer times. Forever.
            </p>
            <div className="grid gap-8 sm:grid-cols-1">
              {[
                {
                  name: "Lifetime",
                  price: "$9.99",
                  period: "once",
                  originalPrice: "$14.99",
                  description: "Best value for long-term use",
                  features: [
                    "Menu bar prayer times & countdown",
                    "Full-screen reminders (calm, not alarming)",
                    "Calendar protection (Exchange, iCloud, or default)",
                    "Works offline—your location never leaves your Mac",
                    "Lifetime updates & support",
                    "Use on 1 Mac",
                    "30-day money-back guarantee",
                  ],
                  cta: "Get lifetime access",
                  featured: true,
                },
              ].map((plan) => (
                <div
                  key={plan.name}
                  className={`pricing-card relative rounded-2xl border p-8 ${
                    plan.featured
                      ? "border-[var(--waqtu-primary)] bg-[var(--waqtu-card)]/80 featured"
                      : "border-[var(--waqtu-border)] bg-[var(--waqtu-surface)]/60"
                  }`}
                >
                  {plan.featured && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="rounded-full bg-[var(--waqtu-primary)] px-3 py-1 text-xs font-medium text-[var(--waqtu-bg)]">
                        Most popular
                      </span>
                    </div>
                  )}
                  <h3 className="font-display text-center text-lg font-semibold text-[var(--waqtu-text)]">
                    {plan.name}
                  </h3>
                  <p className="mt-2 text-center text-sm text-[var(--waqtu-muted)]">
                    {plan.description}
                  </p>
                  <div className="mt-6 flex items-baseline justify-center gap-2">
                    <div className="flex items-baseline gap-1">
                      <span className="font-display text-4xl font-semibold text-[var(--waqtu-text)]">
                        {plan.price}
                      </span>
                      <span className="text-[var(--waqtu-muted)]">
                        /{plan.period}
                      </span>
                    </div>
                    {plan.originalPrice && (
                      <span className="text-sm text-[var(--waqtu-muted)] line-through">
                        {plan.originalPrice}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      if (plan.name === "Lifetime") {
                        handleCheckout("PRO_LIFETIME");
                      } else {
                        window.location.href = "#download";
                      }
                    }}
                    disabled={
                      isLoading.PRO_LIFETIME ||
                      (plan.name === "Lifetime" &&
                        !isTierAvailable("PRO_LIFETIME"))
                    }
                    className={`mt-6 block w-full rounded-full px-6 py-3 text-center font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                      plan.featured
                        ? "bg-[var(--waqtu-primary)] text-[var(--waqtu-bg)] hover:bg-[var(--waqtu-primary-soft)] hover:shadow-[0_0_24px_rgba(74,139,111,0.35)]"
                        : "border border-[var(--waqtu-border-strong)] text-[var(--waqtu-text)] hover:border-[var(--waqtu-primary)] hover:bg-[var(--waqtu-card)]"
                    }`}
                  >
                    {isLoading.PRO_LIFETIME && plan.name === "Lifetime"
                      ? "Redirecting..."
                      : plan.cta}
                  </button>
                  <p className="mt-3 text-center text-sm text-[var(--waqtu-muted)]">
                    Not sure?{" "}
                    <a
                      href="#download"
                      className="text-[var(--waqtu-primary)] hover:underline"
                    >
                      Try free first
                    </a>
                    . No credit card required.
                  </p>
                  <ul className="mt-8 space-y-3">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <svg
                          className="mt-0.5 h-4 w-4 shrink-0 text-[var(--waqtu-primary)]"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <span className="text-sm text-[var(--waqtu-muted)]">
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section
          id="faq"
          className="relative z-10 section-tint-1 border-y border-[var(--waqtu-border)] px-6 py-24 sm:px-10 md:px-14 md:py-32"
        >
          <div className="mx-auto max-w-3xl">
            <h2 className="font-display mb-4 text-center text-2xl font-semibold tracking-tight text-[var(--waqtu-text)] sm:text-3xl">
              Frequently asked questions
            </h2>
            <p className="mx-auto mb-16 max-w-2xl text-center text-[var(--waqtu-muted)]">
              Everything you need to know about Waqtu.
            </p>
            <div className="space-y-0">
              {[
                {
                  question: "Which macOS versions are supported?",
                  answer:
                    "Waqtu supports macOS 12 (Monterey) and later, including the latest macOS releases. Both Intel and Apple Silicon Macs are supported.",
                },
                {
                  question: "How does calendar protection work?",
                  answer:
                    "Waqtu can create events in your default calendar app, or sync with Exchange/iCloud calendars. These events show you as 'busy' during prayer times, so your Outlook and Teams status will reflect this automatically.",
                },
                {
                  question: "Can I customize prayer calculation methods?",
                  answer:
                    "Yes! Waqtu supports multiple calculation methods including Muslim World League, ISNA, Egyptian General Authority, Umm Al-Qura, and more. You can also adjust angles and minutes for precise control.",
                },
                {
                  question: "Does Waqtu work offline?",
                  answer:
                    "Once downloaded, Waqtu works completely offline. Prayer times are calculated locally on your Mac. An internet connection is only needed for the initial download and updates.",
                },
                {
                  question: "Is my location data private?",
                  answer:
                    "Absolutely. Your location is used solely for accurate prayer time calculations and never leaves your device. We don't collect, store, or share any location data.",
                },
                {
                  question: "Is there a free trial?",
                  answer:
                    "Yes. Download Waqtu and try it free. When you're ready, purchase the lifetime license for $9.99. No subscriptions, no recurring fees.",
                },
                {
                  question: "How do refunds work?",
                  answer:
                    "If you're not satisfied with Waqtu, contact us within 30 days of purchase for a full refund. No questions asked.",
                },
                {
                  question: "Does the app track my prayers?",
                  answer:
                    "Waqtu focuses on notifications and calendar integration. We don't track or record which prayers you've completed - that's personal and stays between you and your faith.",
                },
              ].map((faq, index) => (
                <div
                  key={index}
                  className={`faq-item ${openFaq === index ? "open" : ""}`}
                >
                  <button
                    className="faq-question flex w-full items-center justify-between gap-4 py-6 text-left"
                    onClick={() => toggleFaq(index)}
                  >
                    <span className="font-medium text-[var(--waqtu-text)]">
                      {faq.question}
                    </span>
                    <svg
                      className="faq-icon h-5 w-5 shrink-0 text-[var(--waqtu-gold)] transition-transform duration-300"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>
                  <div className="faq-answer">
                    <p className="text-[var(--waqtu-muted)] leading-relaxed">
                      {faq.answer}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section
          id="download"
          className="relative z-10 px-6 py-24 sm:px-10 md:px-14 md:py-32"
        >
          <div className="mx-auto max-w-2xl rounded-3xl border border-[var(--waqtu-border)] bg-[var(--waqtu-surface)]/80 p-12 text-center backdrop-blur-sm md:p-16">
            <h2 className="font-display text-2xl font-semibold tracking-tight text-[var(--waqtu-text)] sm:text-3xl">
              Ready to protect your prayer times?
            </h2>
            <p className="mt-4 text-[var(--waqtu-muted)]">
              Download Waqtu for macOS. No account required. Free to try, $9.99
              if you love it.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <a
                href="#pricing"
                className="inline-flex items-center gap-2 rounded-full bg-[var(--waqtu-primary)] px-8 py-4 font-medium text-[var(--waqtu-bg)] transition-all hover:bg-[var(--waqtu-primary-soft)] hover:shadow-[0_0_32px_rgba(74,139,111,0.45)]"
              >
                Get Waqtu for $9.99
                <span>→</span>
              </a>
            </div>
            <p className="mt-6 text-sm text-[var(--waqtu-muted)]">
              Your prayers deserve a place on your calendar.
            </p>
          </div>
        </section>

        {/* Footer */}
        <footer className="relative z-10 border-t border-[var(--waqtu-border)] px-6 py-10 sm:px-10 md:px-14">
          <div className="mx-auto max-w-6xl">
            <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
              <span className="font-display text-sm font-medium text-[var(--waqtu-muted)]">
                Waqtu
              </span>
              <nav className="flex flex-wrap items-center justify-center gap-6 text-sm">
                <a
                  href="/privacy"
                  className="text-[var(--waqtu-muted)] transition-colors hover:text-[var(--waqtu-text)]"
                >
                  Privacy
                </a>
                <a
                  href="/terms"
                  className="text-[var(--waqtu-muted)] transition-colors hover:text-[var(--waqtu-text)]"
                >
                  Terms
                </a>
                <a
                  href="mailto:dzulfikar.at@gmail.com"
                  className="text-[var(--waqtu-muted)] transition-colors hover:text-[var(--waqtu-text)]"
                >
                  Support
                </a>
                <a
                  href="mailto:dzulfikar.at@gmail.com"
                  className="text-[var(--waqtu-muted)] transition-colors hover:text-[var(--waqtu-text)]"
                >
                  Contact
                </a>
              </nav>
              <p className="text-sm text-[var(--waqtu-muted)]">
                Prayer times for your day
              </p>
            </div>
            <div className="mt-8 text-center text-sm text-[var(--waqtu-muted)]">
              <p>© 2026 Waqtu. Made with intention.</p>
            </div>
          </div>
        </footer>
      </main>

      {/* Fullscreen Media Viewer */}
      {expandedMedia && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
          onClick={() => setExpandedMedia(null)}
        >
          <button 
            className="absolute top-6 right-6 text-white/80 hover:text-white transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              setExpandedMedia(null);
            }}
          >
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div 
            className="max-w-6xl max-h-[90vh] w-full px-4"
            onClick={(e) => e.stopPropagation()}
          >
            {expandedMedia === "video" ? (
              <video
                autoPlay
                loop
                muted
                playsInline
                className="w-full rounded-lg shadow-2xl"
              >
                <source src="/waqtu.mp4" type="video/mp4" />
              </video>
            ) : (
              <img
                src="/waqtu.webp"
                alt="Teams calendar showing prayer time blocked as busy"
                className="w-full rounded-lg shadow-2xl"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
