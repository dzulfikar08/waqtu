/**
 * Waqtu site interactivity — vanilla TS, zero framework.
 * Wires up: header scroll state, mobile menu, FAQ accordion, media lightbox,
 * voucher copy-to-clipboard, Polar checkout, checkout-success banner,
 * and One Dollar Stats scroll-depth events.
 * Analytics clicks fire automatically via the `data-s-event` attributes.
 */

const DOWNLOAD_URL =
  import.meta.env.PUBLIC_DOWNLOAD_URL ||
  "https://waqt-updates.dzulfikar-at.workers.dev/latest";

type Stonks = { event: (name: string, properties?: Record<string, unknown>) => void };
const stonks = (): Stonks | undefined =>
  (window as unknown as { Stonks?: Stonks }).Stonks;

// ---------- header scroll state ----------
function initHeader() {
  const header = document.getElementById("site-header");
  if (!header) return;
  const onScroll = () => {
    header.dataset.scrolled = window.scrollY > 10 ? "true" : "false";
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
}

// ---------- mobile menu ----------
function initMobileMenu() {
  const toggle = document.getElementById("menu-toggle");
  const overlay = document.getElementById("mobile-menu");
  const links = document.querySelectorAll<HTMLElement>("#mobile-menu a[data-nav]");
  if (!toggle || !overlay) return;

  const setOpen = (open: boolean) => {
    overlay.dataset.open = open ? "true" : "false";
    toggle.dataset.open = open ? "true" : "false";
    toggle.setAttribute("aria-expanded", String(open));
    document.body.style.overflow = open ? "hidden" : "";
  };

  toggle.addEventListener("click", () => setOpen(overlay.dataset.open !== "true"));
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) setOpen(false);
  });
  links.forEach((a) => a.addEventListener("click", () => setOpen(false)));
}

// ---------- FAQ accordion ----------
function initFaq() {
  const items = document.querySelectorAll<HTMLElement>(".faq-item");
  items.forEach((item) => {
    const btn = item.querySelector<HTMLButtonElement>(".faq-question");
    if (!btn) return;
    btn.addEventListener("click", () => {
      const wasOpen = item.classList.contains("open");
      items.forEach((i) => i.classList.remove("open"));
      if (!wasOpen) item.classList.add("open");
    });
  });
}

// ---------- media lightbox ----------
function initLightbox() {
  const triggers = document.querySelectorAll<HTMLElement>("[data-media]");
  const viewer = document.getElementById("media-viewer");
  if (!triggers.length || !viewer) return;
  const slot = viewer.querySelector<HTMLElement>("[data-viewer-content]");
  const close = () => {
    viewer.dataset.open = "false";
    if (slot) slot.innerHTML = "";
    document.body.style.overflow = "";
  };

  triggers.forEach((el) => {
    el.addEventListener("click", () => {
      const media = el.dataset.media;
      if (!media || !slot) return;
      if (media === "video2") {
        slot.innerHTML = `<video autoplay loop muted playsInline class="w-full rounded-lg shadow-2xl"><source src="/waqtu-3.mp4" type="video/mp4" /></video>`;
      } else if (media === "menuBar") {
        slot.innerHTML = `<img src="/waqtu-4.webp" alt="Waqtu menu bar showing prayer time countdown" class="w-full rounded-lg shadow-2xl" />`;
      } else {
        slot.innerHTML = `<img src="/waqtu.webp" alt="Teams calendar showing prayer time blocked as busy" class="w-full rounded-lg shadow-2xl" />`;
      }
      viewer.dataset.open = "true";
      document.body.style.overflow = "hidden";
    });
  });

  viewer.addEventListener("click", (e) => {
    if (e.target === viewer) close();
  });
  document.getElementById("media-viewer-close")?.addEventListener("click", close);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });
}

// ---------- voucher copy ----------
function initVoucher() {
  const buttons = document.querySelectorAll<HTMLElement>("[data-voucher]");
  if (!buttons.length) return;
  buttons.forEach((btn) => {
    const label = btn.querySelector<HTMLElement>("[data-voucher-label]");
    btn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText("WAQTU299");
        if (label) label.textContent = "Copied!";
        stonks()?.event("voucher_copied", { code: "WAQTU299" });
        setTimeout(() => {
          if (label) label.textContent = btn.dataset.voucherText || "Copy";
        }, 2000);
      } catch {
        /* clipboard unavailable */
      }
    });
  });
}

// ---------- Polar checkout ----------
function initCheckout() {
  const buttons = document.querySelectorAll<HTMLButtonElement>("[data-checkout]");
  if (!buttons.length) return;

  buttons.forEach((btn) => {
    btn.addEventListener("click", async () => {
      const tier = (btn.dataset.checkout || "PRO_LIFETIME") as "PRO_LIFETIME" | "PRO_MONTHLY";
      const productId = btn.dataset.productId;
      if (!productId) {
        window.location.href = "#download";
        return;
      }
      stonks()?.event("checkout_start", { tier });
      btn.dataset.loading = "true";
      const text = btn.querySelector<HTMLElement>("[data-checkout-text]");
      const original = text?.textContent;
      if (text) text.textContent = "Redirecting...";

      try {
        const res = await fetch("/api/payments/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ productId }),
        });
        if (!res.ok) throw new Error("Failed to create checkout session");
        const { url } = (await res.json()) as { url: string };
        stonks()?.event("checkout_redirect", { tier });
        window.location.href = url;
      } catch (err) {
        stonks()?.event("checkout_error", {
          tier,
          error: err instanceof Error ? err.message : "Failed to create checkout",
        });
        btn.dataset.loading = "false";
        if (text) text.textContent = original;
      }
    });
  });
}

// ---------- checkout success banner ----------
function initCheckoutSuccess() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("checkout") !== "success") return;
  const banner = document.getElementById("checkout-success");
  if (banner) banner.dataset.show = "true";
  stonks()?.event("checkout_success_return");
  document.getElementById("download")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ---------- scroll-depth analytics ----------
function initScrollDepth() {
  const milestones = [25, 50, 75, 100];
  const hit = new Set<number>();
  const onScroll = () => {
    const max = document.body.scrollHeight - window.innerHeight;
    const pct = max > 0 ? (window.scrollY / max) * 100 : 100;
    milestones.forEach((m) => {
      if (pct >= m && !hit.has(m)) {
        hit.add(m);
        stonks()?.event("scroll_depth", { percent: m });
      }
    });
  };
  window.addEventListener("scroll", onScroll, { passive: true });
}

// ---------- set dynamic download hrefs ----------
function initDownloadLinks() {
  document.querySelectorAll<HTMLAnchorElement>("[data-download-url]").forEach((a) => {
    a.href = DOWNLOAD_URL;
  });
}

function init() {
  initHeader();
  initMobileMenu();
  initFaq();
  initLightbox();
  initVoucher();
  initCheckout();
  initCheckoutSuccess();
  initScrollDepth();
  initDownloadLinks();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
