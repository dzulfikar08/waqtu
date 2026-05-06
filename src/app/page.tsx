"use client";

import { useState, useEffect, useCallback } from "react";
import {
  createCheckout,
  POLAR_PRODUCTS,
  isTierAvailable,
} from "@/lib/api/payments";

// One Dollar Stats analytics helper
declare global {
  interface Window {
    Stonks?: {
      event: (name: string, properties?: Record<string, unknown>) => void;
    };
  }
}

// Latest DMG (worker redirects to R2); set NEXT_PUBLIC_DOWNLOAD_URL to override
const DOWNLOAD_URL =
  process.env.NEXT_PUBLIC_DOWNLOAD_URL ||
  "https://waqt-updates.dzulfikar-at.workers.dev/latest";

type LoadingState = {
  [key: string]: boolean;
};

type MediaType = "video" | "video2" | "image" | "menuBar";

function Check() {
  return (
    <svg className="mx-auto h-5 w-5 text-[var(--waqtu-primary)]" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
  );
}

function Dash() {
  return (
    <svg className="mx-auto h-5 w-5 text-[var(--waqtu-border)]" fill="none" viewBox="0 0 20 20" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 10h8" />
    </svg>
  );
}

export default function Home() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<LoadingState>({});
  const [expandedMedia, setExpandedMedia] = useState<MediaType | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [showCheckoutSuccess, setShowCheckoutSuccess] = useState(false);
  const [voucherCopied, setVoucherCopied] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const success = params.get("checkout") === "success";
    setShowCheckoutSuccess(success);
    if (success) {
      window.Stonks?.event("checkout_success_return");
      const el = document.getElementById("download");
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

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

  // Track scroll depth milestones
  useEffect(() => {
    let hasHit25 = false;
    let hasHit50 = false;
    let hasHit75 = false;
    let hasHit100 = false;

    const handleScrollDepth = () => {
      const scrollPercent =
        (window.scrollY /
          (document.body.scrollHeight - window.innerHeight)) *
        100;

      if (scrollPercent >= 25 && !hasHit25) {
        hasHit25 = true;
        window.Stonks?.event("scroll_depth", { percent: 25 });
      }
      if (scrollPercent >= 50 && !hasHit50) {
        hasHit50 = true;
        window.Stonks?.event("scroll_depth", { percent: 50 });
      }
      if (scrollPercent >= 75 && !hasHit75) {
        hasHit75 = true;
        window.Stonks?.event("scroll_depth", { percent: 75 });
      }
      if (scrollPercent >= 100 && !hasHit100) {
        hasHit100 = true;
        window.Stonks?.event("scroll_depth", { percent: 100 });
      }
    };

    window.addEventListener("scroll", handleScrollDepth, { passive: true });
    return () => window.removeEventListener("scroll", handleScrollDepth);
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

  const handleCheckoutClick = async (tier: "PRO_MONTHLY" | "PRO_LIFETIME") => {
    if (!isTierAvailable(tier)) {
      console.error("Product not configured:", tier);
      window.location.href = "#download";
      return;
    }
    window.Stonks?.event("checkout_start", { tier });
    setIsLoading((prev) => ({ ...prev, [tier]: true }));

    try {
      const { url } = await createCheckout({ productId: POLAR_PRODUCTS[tier] });
      window.Stonks?.event("checkout_redirect", { tier });
      window.location.href = url;
    } catch (error) {
      console.error("Checkout error:", error);
      window.Stonks?.event("checkout_error", {
        tier,
        error: error instanceof Error
          ? error.message
          : "Failed to create checkout",
      });
      setIsLoading((prev) => ({ ...prev, [tier]: false }));
    }
  };

  const copyVoucher = useCallback(async () => {
    try {
      await navigator.clipboard.writeText("WAQTU299");
      setVoucherCopied(true);
      window.Stonks?.event("voucher_copied", { code: "WAQTU299" });
      setTimeout(() => setVoucherCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background — single subtle gradient, not triple mesh */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(74, 139, 111, 0.12), transparent)",
        }}
      />

      {/* ===== HEADER ===== */}
      <header
        className={`
          fixed top-0 left-0 right-0 z-50
          flex items-center justify-between px-4 sm:px-6 md:px-14
          transition-all duration-300 ease-out
          ${
            isScrolled || mobileMenuOpen
              ? "py-3 bg-[var(--waqtu-bg)]/98 backdrop-blur-xl border-b border-[var(--waqtu-border)]"
              : "py-5 bg-transparent border-b border-transparent"
          }
        `}
      >
        <a
          href="#"
          onClick={handleNavClick}
          className="font-display text-xl font-semibold tracking-tight text-[var(--waqtu-text)] relative z-50"
        >
          Waqtu
        </a>

        {/* Desktop nav */}
        <nav className="hidden sm:flex items-center gap-8 text-sm">
          <a
            href="#features"
            onClick={handleNavClick}
            className="text-[var(--waqtu-muted)] hover:text-[var(--waqtu-text)] transition-colors"
            data-s-event="nav_click"
            data-s-event-props='{"destination":"features"}'
          >
            Features
          </a>
          <a
            href="#pricing"
            onClick={handleNavClick}
            className="text-[var(--waqtu-muted)] hover:text-[var(--waqtu-text)] transition-colors"
            data-s-event="nav_click"
            data-s-event-props='{"destination":"pricing"}'
          >
            Pricing
          </a>
          <a
            href="#faq"
            onClick={handleNavClick}
            className="text-[var(--waqtu-muted)] hover:text-[var(--waqtu-text)] transition-colors"
            data-s-event="nav_click"
            data-s-event-props='{"destination":"faq"}'
          >
            FAQ
          </a>
          <a
            href="#pricing"
            onClick={handleNavClick}
            className="neu-btn inline-flex items-center gap-2 px-5 py-2.5 font-medium text-[var(--waqtu-bg)]"
            data-s-event="cta_click"
            data-s-event-props='{"location":"header","text":"Get Waqtu"}'
          >
            <span>Get Waqtu —</span>
            <span className="font-mono font-bold">$2.99</span>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M19 12l-7 7-7-7" />
            </svg>
          </a>
        </nav>

        {/* Mobile menu button */}
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

        {/* Mobile menu overlay */}
        <div
          className={`
            fixed inset-0 sm:hidden
            flex flex-col
            transition-all duration-300 ease-out
            ${
              mobileMenuOpen
                ? "opacity-100 pointer-events-auto"
                : "opacity-0 pointer-events-none"
            }
          `}
          style={{ zIndex: 40, backgroundColor: "rgb(15, 25, 20)" }}
          onClick={() => setMobileMenuOpen(false)}
        >
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
              className="neu-btn mt-4 inline-flex items-center gap-2 px-10 py-4 text-xl font-medium text-[var(--waqtu-bg)]"
            >
              <span>Get Waqtu —</span>
              <span className="font-mono font-bold">$2.99</span>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M19 12l-7 7-7-7" />
              </svg>
            </a>
          </nav>
        </div>
      </header>

      <main className="relative z-10">
        {/* Spacer for fixed header */}
        <div className="h-20 sm:h-24" />

        {/* ===== HERO ===== */}
        <section className="px-6 pb-28 sm:px-10 md:px-14 md:pb-40">
          <div className="flex flex-col items-center text-center">
            {/* Voucher badge — neumorphic raised style */}
            <button
              onClick={copyVoucher}
              className="animate-fade-up mb-8 inline-flex items-center gap-2.5 rounded-full px-5 py-2.5 cursor-pointer transition-all hover:scale-105"
              style={{
                animationDelay: "0ms",
                opacity: 0,
                background: "linear-gradient(145deg, rgba(212, 165, 116, 0.12), rgba(212, 165, 116, 0.06))",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3), 0 1px 3px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(212, 165, 116, 0.2) inset",
              }}
              data-s-event="voucher_click"
              data-s-event-props='{"location":"hero_badge","code":"WAQTU299"}'
            >
              <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--waqtu-gold)]">
                Limited offer
              </span>
              <span className="h-3 w-px bg-[var(--waqtu-gold)]/30" />
              <span className="font-mono text-sm font-bold text-[var(--waqtu-gold)]">
                {voucherCopied ? "Copied!" : "WAQTU299"}
              </span>
              <span className="text-xs text-[var(--waqtu-muted)]">
                &rarr; $2.99
              </span>
            </button>

            <h1
              className="font-display animate-fade-up max-w-3xl text-4xl font-semibold leading-[1.1] tracking-tight text-[var(--waqtu-text)] sm:text-5xl md:text-[3.5rem] md:leading-[1.08]"
              style={{ animationDelay: "80ms", opacity: 0 }}
            >
              Prayer Times in Your Menu Bar
            </h1>
            <p
              className="animate-fade-up mt-4 max-w-lg text-xl leading-relaxed text-[var(--waqtu-muted)] italic"
              style={{ animationDelay: "120ms", opacity: 0 }}
            >
              Your calendar blocks lunch.
              <br />
              Why not{" "}
              <span className="text-[var(--waqtu-gold)] not-italic font-medium">prayer</span>?
            </p>

            <p
              className="animate-fade-up mt-6 max-w-lg text-lg leading-relaxed text-[var(--waqtu-muted)]"
              style={{ animationDelay: "160ms", opacity: 0 }}
            >
              Waqtu blocks your work calendar during prayer times.
              Your colleagues see you as busy — no explanation needed.
            </p>

            <div
              className="animate-fade-up mt-10 flex flex-wrap items-center justify-center gap-4"
              style={{ animationDelay: "240ms", opacity: 0 }}
            >
              <a
                href="#pricing"
                className="neu-btn group inline-flex items-center gap-2 px-7 py-3.5 font-medium text-[var(--waqtu-bg)]"
                data-s-event="cta_click"
                data-s-event-props='{"location":"hero","text":"Get Waqtu — $2.99"}'
              >
                <span>Get Waqtu —</span>
                <span className="font-mono font-bold">$2.99</span>
                <svg className="h-4 w-4 transition-transform group-hover:translate-y-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M19 12l-7 7-7-7" />
                </svg>
              </a>
              <a
                href="#features"
                className="text-[var(--waqtu-muted)] transition-colors hover:text-[var(--waqtu-text)]"
                data-s-event="nav_click"
                data-s-event-props='{"destination":"features","location":"hero"}'
              >
                See how it works
              </a>
            </div>

            {/* Trust indicators — minimal dots, not badges */}
            <div
              className="animate-fade-up mt-14 flex flex-wrap items-center justify-center gap-4 text-sm text-[var(--waqtu-muted)] sm:gap-6"
              style={{ animationDelay: "320ms", opacity: 0 }}
            >
              <span>No ads</span>
              <span className="hidden sm:inline text-[var(--waqtu-border)]">
                &middot;
              </span>
              <span>No tracking</span>
              <span className="hidden sm:inline text-[var(--waqtu-border)]">
                &middot;
              </span>
              <span>Works offline</span>
              <span className="hidden sm:inline text-[var(--waqtu-border)]">
                &middot;
              </span>
              <span>macOS 12+</span>
            </div>
          </div>
        </section>

        {/* ===== TRUST STRIP ===== */}
        <section className="relative z-10 border-y border-[var(--waqtu-border)] px-6 py-10 sm:px-10 md:px-14">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-lg font-medium leading-relaxed text-[var(--waqtu-text)]">
              Your location never leaves your Mac. No ads. No tracking.{" "}
              <span className="text-[var(--waqtu-gold)]">Ever.</span>
            </p>
            <p className="mt-3 text-sm text-[var(--waqtu-muted)]">
              &ldquo;Indeed, prayer is obligatory on the believers at specified times.&rdquo; — Quran 4:103
            </p>
          </div>
        </section>

        {/* ===== PRIVACY DIFFERENTIATOR ===== */}
        <section className="relative z-10 px-6 py-24 sm:px-10 md:px-14 md:py-32">
          <div className="mx-auto max-w-3xl">
            <div className="neu-card p-8 sm:p-12 text-center">
              <svg className="mx-auto mb-6 h-12 w-12 text-[var(--waqtu-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
              <h2 className="font-display mb-4 text-2xl font-semibold tracking-tight text-[var(--waqtu-text)]">
                Your location never leaves your Mac
              </h2>
              <p className="mx-auto max-w-lg text-[var(--waqtu-muted)] leading-relaxed">
                Unlike some prayer apps that sell your data, Waqtu calculates everything offline. Your location, prayer times, and calendar events stay on your device. No ads. No tracking. No servers.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-sm text-[var(--waqtu-muted)]">
                <span className="flex items-center gap-1.5">
                  <svg className="h-4 w-4 text-[var(--waqtu-primary)]" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                  100% offline calculation
                </span>
                <span className="flex items-center gap-1.5">
                  <svg className="h-4 w-4 text-[var(--waqtu-primary)]" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                  No account needed
                </span>
                <span className="flex items-center gap-1.5">
                  <svg className="h-4 w-4 text-[var(--waqtu-primary)]" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                  Zero data collection
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ===== COMPARE STRIP ===== */}
        <section className="relative z-10 border-y border-[var(--waqtu-border)] px-6 py-20 sm:px-10 md:px-14 md:py-28">
          <div className="mx-auto max-w-5xl">
            <h2 className="font-display mb-3 text-center text-2xl font-semibold tracking-tight text-[var(--waqtu-text)] sm:text-3xl">
              Why Waqtu?
            </h2>
            <p className="mx-auto mb-12 max-w-md text-center text-[var(--waqtu-muted)]">
              The only Mac app that does it all. Offline. Private. One payment.
            </p>
            <div className="overflow-x-auto -mx-4 px-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--waqtu-border)]">
                    <th className="py-3 pr-4 text-left font-medium text-[var(--waqtu-text)]">Feature</th>
                    <th className="py-3 px-3 text-center font-medium text-[var(--waqtu-gold)]">Waqtu</th>
                    <th className="py-3 px-3 text-center font-medium text-[var(--waqtu-muted)]">Sajda</th>
                    <th className="py-3 px-3 text-center font-medium text-[var(--waqtu-muted)]">Minarah</th>
                    <th className="py-3 px-3 text-center font-medium text-[var(--waqtu-muted)]">PrayerCal</th>
                  </tr>
                </thead>
                <tbody className="text-[var(--waqtu-muted)]">
                  {[
                    ["Menu bar countdown", true, true, false, false],
                    ["Calendar blocking", true, false, false, true],
                    ["Teams/Outlook busy", true, false, false, false],
                    ["Full-screen reminders", true, true, true, false],
                    ["Offline calculation", true, true, false, true],
                    ["Adhan audio", true, true, false, false],
                    ["Privacy (no data sent)", true, true, true, true],
                    ["One-time payment", true, true, false, true],
                  ].map(([feature, waqtu, sajda, minarah, prayerCal], i) => (
                    <tr key={i} className="border-b border-[var(--waqtu-border)]">
                      <td className="py-3 pr-4 text-[var(--waqtu-text)]">{feature as string}</td>
                      <td className="py-3 px-3 text-center">{waqtu ? <Check /> : <Dash />}</td>
                      <td className="py-3 px-3 text-center">{sajda ? <Check /> : <Dash />}</td>
                      <td className="py-3 px-3 text-center">{minarah ? <Check /> : <Dash />}</td>
                      <td className="py-3 px-3 text-center">{prayerCal ? <Check /> : <Dash />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-6 text-center">
              <a href="/compare" className="text-sm text-[var(--waqtu-primary)] hover:underline">
                See full comparison &rarr;
              </a>
            </p>
          </div>
        </section>

        {/* ===== TESTIMONIALS ===== */}
        <section className="relative z-10 px-6 py-24 sm:px-10 md:px-14 md:py-32">
          <div className="mx-auto max-w-5xl">
            <h2 className="font-display mb-12 text-center text-2xl font-semibold tracking-tight text-[var(--waqtu-text)] sm:text-3xl">
              What users say
            </h2>
            <div className="grid gap-6 sm:grid-cols-3">
              {[
                {
                  quote: "Finally, an app that actually blocks my Teams calendar. No more awkward 'sorry I missed Dhuhr' conversations.",
                  name: "Ahmad R.",
                  role: "Software Engineer",
                },
                {
                  quote: "I love that it works completely offline. After the Muslim Pro privacy issues, I don't trust apps that send my location anywhere.",
                  name: "Fatima H.",
                  role: "Product Designer",
                },
                {
                  quote: "The calm reminder overlay is perfect for the office. It's not an alarm — it's a gentle nudge. Exactly what I needed.",
                  name: "Omar K.",
                  role: "Consultant",
                },
              ].map((testimonial, i) => (
                <div key={i} className="neu-card p-6 flex flex-col">
                  <p className="flex-1 text-[var(--waqtu-muted)] leading-relaxed text-[15px] italic">
                    &ldquo;{testimonial.quote}&rdquo;
                  </p>
                  <div className="mt-4 pt-4 border-t border-[var(--waqtu-border)]">
                    <p className="font-medium text-[var(--waqtu-text)] text-sm">{testimonial.name}</p>
                    <p className="text-[var(--waqtu-muted)] text-xs">{testimonial.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ===== FEATURES ===== */}
        <section
          id="features"
          className="relative z-10 px-6 py-24 sm:px-10 md:px-14 md:py-32"
        >
          <div className="mx-auto max-w-5xl">
            <h2 className="font-display mb-3 text-center text-2xl font-semibold tracking-tight text-[var(--waqtu-text)] sm:text-3xl">
              How it works
            </h2>
            <p className="mx-auto mb-16 max-w-md text-center text-[var(--waqtu-muted)]">
              Everything you need. Nothing you don&rsquo;t.
            </p>

            <div className="grid gap-10 sm:gap-12 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  title: "Prayer countdown in your menu bar",
                  description:
                    "One glance tells you when the next prayer is. No apps to open, nothing to check.",
                  icon: (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 6v6l4 2" />
                    </svg>
                  ),
                },
                {
                  title: "Calendar protection",
                  description:
                    "Blocks your calendar during every prayer. Teams shows you as busy. No explanation needed.",
                  icon: (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z" />
                    </svg>
                  ),
                },
                {
                  title: "Calm reminders, not alarms",
                  description:
                    "A peaceful overlay when it\u2019s time to pray. You dismiss it when you\u2019re ready. Waqtu waits.",
                  icon: (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                    </svg>
                  ),
                },
                {
                  title: "Works completely offline",
                  description:
                    "Prayer times calculated on your Mac. No internet needed after download.",
                  icon: (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9.75L9 16.5m0 0l-2.25-2.25M9 16.5l2.25-2.25" />
                    </svg>
                  ),
                },
                {
                  title: "Location stays private",
                  description:
                    "Calculated locally on your Mac. Never transmitted, never stored, never sold.",
                  icon: (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                    </svg>
                  ),
                },
                {
                  title: "No ads, no subscriptions",
                  description:
                    "One payment. No recurring charges. No ad banners. Ever.",
                  icon: (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                  ),
                },
              ].map((item) => (
                <div key={item.title}>
                  <span className="mb-4 block text-[var(--waqtu-gold)]">
                    {item.icon}
                  </span>
                  <h3 className="font-display mb-2 text-lg font-semibold text-[var(--waqtu-text)]">
                    {item.title}
                  </h3>
                  <p className="text-[15px] leading-relaxed text-[var(--waqtu-muted)]">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ===== VISUAL SHOWCASE ===== */}
        <section className="relative z-10 border-y border-[var(--waqtu-border)] px-6 py-20 sm:px-10 md:px-14 md:py-28">
          <div className="mx-auto max-w-5xl">
            <h2 className="font-display mb-3 text-center text-2xl font-semibold tracking-tight text-[var(--waqtu-text)] sm:text-3xl">
              See Waqtu in action
            </h2>
            <p className="mx-auto mb-12 max-w-md text-center text-[var(--waqtu-muted)]">
              Prayer times at a glance. Calm reminders. Calendar blocked.
            </p>

            <div className="grid gap-6 md:grid-cols-3">
              {/* Menu bar screenshot */}
              <div
                className="neu-card flex flex-col p-4 cursor-pointer"
                onClick={() => setExpandedMedia("menuBar")}
                data-s-event="media_expand"
                data-s-event-props='{"type":"image","media":"menuBar"}'
              >
                <img
                  src="/waqtu-4.webp"
                  alt="Waqtu menu bar showing prayer time countdown"
                  className="w-full rounded-lg object-cover aspect-video"
                />
                <p className="mt-3 px-1 text-sm text-[var(--waqtu-muted)]">
                  Prayer countdown at a glance
                </p>
              </div>

              {/* Full screen reminder video */}
              <div
                className="neu-card flex flex-col p-4 cursor-pointer"
                onClick={() => setExpandedMedia("video2")}
                data-s-event="media_expand"
                data-s-event-props='{"type":"video","media":"fullscreen_reminder"}'
              >
                <video
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full rounded-lg object-cover aspect-video"
                >
                  <source src="/waqtu-3.mp4" type="video/mp4" />
                </video>
                <p className="mt-3 px-1 text-sm text-[var(--waqtu-muted)]">
                  A calm nudge when it&rsquo;s time
                </p>
              </div>

              {/* Teams calendar screenshot */}
              <div
                className="neu-card flex flex-col p-4 cursor-pointer"
                onClick={() => setExpandedMedia("image")}
                data-s-event="media_expand"
                data-s-event-props='{"type":"image","media":"teams_calendar"}'
              >
                <img
                  src="/waqtu.webp"
                  alt="Teams calendar showing prayer time blocked as busy"
                  className="w-full rounded-lg object-cover aspect-video"
                />
                <p className="mt-3 px-1 text-sm text-[var(--waqtu-muted)]">
                  Calendar shows you as busy during prayers
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ===== WHY WAQTU ===== */}
        <section className="relative z-10 border-y border-[var(--waqtu-border)] px-6 py-24 sm:px-10 md:px-14 md:py-32">
          <div className="mx-auto max-w-3xl">
            <h2 className="font-display mb-3 text-center text-2xl font-semibold tracking-tight text-[var(--waqtu-text)] sm:text-3xl">
              Why Waqtu
            </h2>
            <p className="mx-auto mb-12 max-w-md text-center text-[var(--waqtu-muted)]">
              The only native Mac app with menu bar presence and calendar blocking.
            </p>

            <div className="overflow-x-auto">
              <table className="comparison-table">
                <thead>
                  <tr>
                    <th></th>
                    <th className="waqtu-col">Waqtu</th>
                    <th>Sajda</th>
                    <th>Guidance</th>
                    <th>PrayerCal</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Menu bar countdown</td>
                    <td className="waqtu-col"><span className="check">&#10003;</span></td>
                    <td><span className="check">&#10003;</span></td>
                    <td><span className="check">&#10003;</span></td>
                    <td><span className="dash">&mdash;</span></td>
                  </tr>
                  <tr>
                    <td>Calendar blocking</td>
                    <td className="waqtu-col"><span className="check">&#10003;</span></td>
                    <td><span className="dash">&mdash;</span></td>
                    <td><span className="dash">&mdash;</span></td>
                    <td><span className="check">&#10003;</span></td>
                  </tr>
                  <tr>
                    <td>Works offline</td>
                    <td className="waqtu-col"><span className="check">&#10003;</span></td>
                    <td><span className="check">&#10003;</span></td>
                    <td><span className="check">&#10003;</span></td>
                    <td><span className="dash">&mdash;</span></td>
                  </tr>
                  <tr>
                    <td>No ads or tracking</td>
                    <td className="waqtu-col"><span className="check">&#10003;</span></td>
                    <td><span className="check">&#10003;</span></td>
                    <td><span className="check">&#10003;</span></td>
                    <td><span className="check">&#10003;</span></td>
                  </tr>
                  <tr>
                    <td>Price</td>
                    <td className="waqtu-col price-label">$2.99</td>
                    <td>$3.99</td>
                    <td>Free</td>
                    <td>Free</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ===== TESTIMONIAL ===== */}
        <section className="relative z-10 px-6 py-24 sm:px-10 md:px-14 md:py-32">
          <div className="mx-auto max-w-2xl">
            <div className="neu-card p-8 sm:p-10">
              <svg className="mb-4 h-8 w-8 text-[var(--waqtu-gold)]/40" fill="currentColor" viewBox="0 0 24 24">
                <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
              </svg>
              <p className="text-lg leading-relaxed text-[var(--waqtu-text)]">
                I built Waqtu because I was spending 12 hours a day in front of my Mac
                and missing prayers because of meetings. Now my calendar automatically
                blocks prayer times, and I&rsquo;ve been consistent for months.
              </p>
              <div className="mt-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--waqtu-primary)] text-sm font-bold text-[var(--waqtu-bg)]">
                  D
                </div>
                <div>
                  <p className="text-sm font-medium text-[var(--waqtu-text)]">Dzulfikar</p>
                  <p className="text-xs text-[var(--waqtu-muted)]">Founder, Waqtu</p>
                </div>
              </div>
            </div>
            <p className="mt-6 text-center text-sm text-[var(--waqtu-muted)]">
              More coming — Google Calendar sync, Apple Watch, and more.
            </p>
          </div>
        </section>

        {/* ===== PRICING ===== */}
        <section
          id="pricing"
          className="relative z-10 px-6 py-24 sm:px-10 md:px-14 md:py-32"
        >
          <div className="mx-auto max-w-lg">
            <h2 className="font-display mb-12 text-center text-2xl font-semibold tracking-tight text-[var(--waqtu-text)] sm:text-3xl">
              One payment. Yours forever.
            </h2>

            <div className="neu-card p-8 sm:p-10">
              <h3 className="font-display text-center text-lg font-semibold text-[var(--waqtu-text)]">
                Lifetime Access
              </h3>

              <p className="mt-4 text-center text-sm text-[var(--waqtu-muted)]">
                No subscription. One payment, forever.
              </p>

              <div className="mt-6 flex items-baseline justify-center gap-3">
                <span className="font-display text-4xl font-bold text-[var(--waqtu-text)]">
                  $9.99
                </span>
                <span className="text-lg text-[var(--waqtu-muted)] line-through">
                  $14.99
                </span>
              </div>

              {/* Voucher code box — realistic coupon style */}
              <div className="mt-6">
                <div className="voucher-box rounded-lg">
                  <div className="voucher-content">
                    <span className="voucher-label">CODE</span>
                    <div className="voucher-dash" />
                    <span className="voucher-code">WAQTU299</span>
                    <div className="voucher-dash" />
                    <button
                      onClick={copyVoucher}
                      className="voucher-copy-btn"
                      data-s-event="voucher_copy"
                      data-s-event-props='{"location":"pricing_card","code":"WAQTU299"}'
                    >
                      {voucherCopied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </div>
                <p className="mt-3 voucher-note">
                  Enter at checkout — price drops to{" "}
                  <span className="font-semibold text-[var(--waqtu-gold)]">
                    $2.99
                  </span>
                </p>
              </div>

              {/* Feature list */}
              <ul className="mt-8 space-y-3">
                {[
                  "Prayer times in your menu bar",
                  "Calendar protection (Exchange, iCloud, default)",
                  "Calm full-screen reminders",
                  "Works completely offline",
                  "Lifetime updates",
                  "30-day money-back guarantee",
                ].map((feature) => (
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

              <button
                onClick={() => handleCheckoutClick("PRO_LIFETIME")}
                disabled={
                  isLoading.PRO_LIFETIME || !isTierAvailable("PRO_LIFETIME")
                }
                className="neu-btn mt-8 block w-full px-6 py-3.5 text-center font-medium text-[var(--waqtu-bg)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none"
                data-s-event="cta_click"
                data-s-event-props='{"location":"pricing","text":"Get lifetime access — $2.99","tier":"lifetime"}'
              >
                {isLoading.PRO_LIFETIME
                  ? "Redirecting..."
                  : (
                    <>
                      <span>Get lifetime access —</span>
                      <span className="font-mono font-bold">$2.99</span>
                    </>
                  )}
              </button>

              <p className="mt-3 text-center text-xs text-[var(--waqtu-muted)]">
                You&rsquo;ll enter your email at checkout. Your license key will be sent there.
              </p>

              <p className="mt-4 text-center text-sm text-[var(--waqtu-muted)]">
                Not sure?{" "}
                <a
                  href="#download"
                  className="text-[var(--waqtu-primary)] hover:underline"
                >
                  Try free first
                </a>
              </p>
            </div>
          </div>
        </section>

        {/* ===== FAQ ===== */}
        <section
          id="faq"
          className="relative z-10 border-y border-[var(--waqtu-border)] px-6 py-24 sm:px-10 md:px-14 md:py-32"
        >
          <div className="mx-auto max-w-3xl">
            <h2 className="font-display mb-12 text-center text-2xl font-semibold tracking-tight text-[var(--waqtu-text)] sm:text-3xl">
              Common questions
            </h2>
            <div className="space-y-0">
              {[
                {
                  question: "Which macOS versions are supported?",
                  answer:
                    "macOS 12 (Monterey) and later. Both Intel and Apple Silicon Macs are supported.",
                },
                {
                  question: "How does calendar protection work?",
                  answer:
                    "Waqtu creates events in your default calendar app, or syncs with Exchange/iCloud calendars. These events show you as 'busy' during prayer times — Outlook and Teams reflect this automatically.",
                },
                {
                  question: "Does Waqtu work offline?",
                  answer:
                    "Yes. Prayer times are calculated locally on your Mac. Internet is only needed for the initial download and updates.",
                },
                {
                  question: "Is my location data private?",
                  answer:
                    "Your location is used only for prayer time calculations and never leaves your Mac. We don't collect, store, or share any location data.",
                },
                {
                  question: "Is there a free trial?",
                  answer:
                    "Yes. Download Waqtu and try it free. When you're ready, use code WAQTU299 at checkout for lifetime access at $2.99.",
                },
                {
                  question: "How do refunds work?",
                  answer:
                    "Not satisfied? Contact us within 30 days for a full refund. No questions asked.",
                },
              ].map((faq, index) => (
                <div
                  key={index}
                  className={`faq-item ${openFaq === index ? "open" : ""}`}
                >
                  <button
                    className="faq-question flex w-full items-center justify-between gap-4 py-6 text-left"
                    onClick={() => toggleFaq(index)}
                    data-s-event="faq_toggle"
                    data-s-event-props={`{"question":"${faq.question.replace(/"/g, '\\"')}","index":${index}}`}
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

        {/* ===== DOWNLOAD CTA ===== */}
        <section
          id="download"
          className="relative z-10 px-6 py-24 sm:px-10 md:px-14 md:py-32"
        >
          <div className="neu-card mx-auto max-w-2xl rounded-[24px] p-10 text-center sm:p-14">
            {showCheckoutSuccess && (
              <div className="neu-raised mb-6 flex items-center justify-center gap-2 rounded-2xl px-4 py-3 sm:mb-8" style={{ background: "linear-gradient(145deg, rgba(74, 139, 111, 0.15), rgba(74, 139, 111, 0.08))" }}>
                <svg
                  className="h-5 w-5 text-[var(--waqtu-primary)]"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <p className="text-sm font-medium text-[var(--waqtu-text)]">
                  Purchase confirmed. Check your email for your license key,
                  then download below.
                </p>
              </div>
            )}
            <h2 className="font-display text-2xl font-semibold tracking-tight text-[var(--waqtu-text)] sm:text-3xl">
              Start today
            </h2>
            <p className="mt-3 text-[var(--waqtu-muted)]">
              Free to try. No account needed. macOS 12+.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:mt-10 sm:flex-row sm:gap-4">
              <a
                href={DOWNLOAD_URL}
                className="neu-btn group inline-flex items-center gap-2 px-8 py-4 font-medium text-[var(--waqtu-bg)] sm:px-10"
                data-s-event="download_click"
                data-s-event-props='{"location":"download_cta","text":"Download Waqtu"}'
              >
                Download Waqtu
                <svg
                  className="h-4 w-4 transition-transform group-hover:translate-y-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M19 14l-7 7m0 0l-7-7m7 7V3"
                  />
                </svg>
              </a>
              <a
                href="#pricing"
                className="neu-btn-secondary inline-flex items-center gap-2 px-8 py-4 font-medium text-[var(--waqtu-text)] sm:px-10"
                data-s-event="cta_click"
                data-s-event-props='{"location":"download_cta","text":"Lifetime access — $2.99"}'
              >
                Lifetime access — <span className="font-mono font-bold">$2.99</span>
              </a>
            </div>
          </div>
        </section>

        {/* ===== FOOTER ===== */}
        <footer className="relative z-10 border-t border-[var(--waqtu-border)] px-6 py-10 sm:px-10 md:px-14">
          <div className="mx-auto max-w-6xl">
            <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
              <span className="font-display text-sm font-medium text-[var(--waqtu-muted)]">
                Waqtu
              </span>
              <nav className="flex flex-wrap items-center justify-center gap-6 text-sm">
                <a
                  href="/compare"
                  className="text-[var(--waqtu-muted)] hover:text-[var(--waqtu-text)] transition-colors"
                  data-s-event="footer_link_click"
                  data-s-event-props='{"link":"compare"}'
                >
                  Compare
                </a>
                <a
                  href="/blog"
                  className="text-[var(--waqtu-muted)] hover:text-[var(--waqtu-text)] transition-colors"
                  data-s-event="footer_link_click"
                  data-s-event-props='{"link":"blog"}'
                >
                  Blog
                </a>
                <a
                  href="/resources"
                  className="text-[var(--waqtu-muted)] hover:text-[var(--waqtu-text)] transition-colors"
                  data-s-event="footer_link_click"
                  data-s-event-props='{"link":"resources"}'
                >
                  Resources
                </a>
                <a
                  href="/privacy"
                  className="text-[var(--waqtu-muted)] hover:text-[var(--waqtu-text)] transition-colors"
                  data-s-event="footer_link_click"
                  data-s-event-props='{"link":"privacy"}'
                >
                  Privacy
                </a>
                <a
                  href="/terms"
                  className="text-[var(--waqtu-muted)] hover:text-[var(--waqtu-text)] transition-colors"
                  data-s-event="footer_link_click"
                  data-s-event-props='{"link":"terms"}'
                >
                  Terms
                </a>
                <a
                  href="mailto:dzulfikar.at@gmail.com"
                  className="text-[var(--waqtu-muted)] hover:text-[var(--waqtu-text)] transition-colors"
                  data-s-event="footer_link_click"
                  data-s-event-props='{"link":"support"}'
                >
                  Support
                </a>
              </nav>
              <p className="text-sm text-[var(--waqtu-muted)]">
                &copy; 2026 Waqtu
              </p>
            </div>
          </div>
        </footer>
      </main>

      {/* ===== FULLSCREEN MEDIA VIEWER ===== */}
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
            <svg
              className="h-8 w-8"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
          <div
            className="max-w-6xl max-h-[90vh] w-full px-4"
            onClick={(e) => e.stopPropagation()}
          >
            {expandedMedia === "video2" ? (
              <video
                autoPlay
                loop
                muted
                playsInline
                className="w-full rounded-lg shadow-2xl"
              >
                <source src="/waqtu-3.mp4" type="video/mp4" />
              </video>
            ) : expandedMedia === "menuBar" ? (
              <img
                src="/waqtu-4.webp"
                alt="Waqtu menu bar showing prayer time countdown"
                className="w-full rounded-lg shadow-2xl"
              />
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
