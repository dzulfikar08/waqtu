/**
 * Interactivity for the mobile landing pages (`/` and `/en/`): the Ramadhan countdown,
 * the waitlist forms and the mobile menu. Vanilla TS, no framework.
 * Header, FAQ and scroll-depth behaviour comes from site.ts.
 */

export {};

declare global {
  interface Window {
    Stonks?: { event: (name: string, properties?: Record<string, unknown>) => void };
  }
}
const stonks = () => window.Stonks;

// ---------- Ramadhan countdown ----------
function initCountdown() {
  const root = document.querySelector<HTMLElement>("[data-countdown]");
  if (!root) return;
  const startsAt = Number(root.dataset.startsAt);
  if (!Number.isFinite(startsAt)) return;

  const slots = {
    days: root.querySelector<HTMLElement>('[data-unit="days"]'),
    hours: root.querySelector<HTMLElement>('[data-unit="hours"]'),
    minutes: root.querySelector<HTMLElement>('[data-unit="minutes"]'),
    seconds: root.querySelector<HTMLElement>('[data-unit="seconds"]'),
  };
  const units = root.querySelector<HTMLElement>("[data-countdown-units]");
  const started = root.querySelector<HTMLElement>("[data-countdown-started]");
  let timer: number | undefined;

  const render = () => {
    const left = startsAt - Date.now();
    if (left <= 0) {
      units?.setAttribute("hidden", "");
      started?.removeAttribute("hidden");
      window.clearInterval(timer);
      return;
    }
    const totalSeconds = Math.floor(left / 1000);
    const pad = (n: number) => String(n).padStart(2, "0");
    if (slots.days) slots.days.textContent = String(Math.floor(totalSeconds / 86400));
    if (slots.hours) slots.hours.textContent = pad(Math.floor((totalSeconds % 86400) / 3600));
    if (slots.minutes) slots.minutes.textContent = pad(Math.floor((totalSeconds % 3600) / 60));
    if (slots.seconds) slots.seconds.textContent = pad(totalSeconds % 60);
  };

  render();
  timer = window.setInterval(render, 1000);
}

// ---------- waitlist forms ----------
function initWaitlist() {
  const params = new URLSearchParams(window.location.search);
  const returned = params.get("waitlist");

  document.querySelectorAll<HTMLElement>("[data-waitlist]").forEach((wrap, index) => {
    const form = wrap.querySelector<HTMLFormElement>("[data-waitlist-form]");
    const success = wrap.querySelector<HTMLElement>("[data-waitlist-success]");
    const error = wrap.querySelector<HTMLElement>("[data-waitlist-error]");
    const button = form?.querySelector<HTMLButtonElement>("button[type=submit]");
    if (!form || !success || !error || !button) return;

    const showError = (code: string) => {
      error.textContent =
        form.getAttribute(`data-err-${code}`) ?? form.getAttribute("data-err-generic") ?? "";
      error.hidden = false;
    };
    const showSuccess = () => {
      form.hidden = true;
      success.hidden = false;
      success.focus();
    };

    // Plain form posts (no JS at submit time) come back as /?waitlist=ok|error#waitlist.
    if (index === 0 && returned === "ok") showSuccess();
    if (index === 0 && returned === "error") showError("generic");

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      error.hidden = true;
      const data = new FormData(form);
      const email = String(data.get("email") ?? "").trim();
      if (!email || !form.querySelector<HTMLInputElement>("[name=email]")?.checkValidity()) {
        showError("invalid_email");
        form.querySelector<HTMLInputElement>("[name=email]")?.focus();
        return;
      }

      button.disabled = true;
      button.textContent = form.dataset.submittingLabel ?? button.textContent;
      try {
        const res = await fetch(form.action, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(Object.fromEntries(data)),
        });
        if (res.ok) {
          stonks()?.event("waitlist_submit", {
            location: wrap.dataset.location ?? "",
            locale: String(data.get("locale") ?? ""),
            platform: String(data.get("platform") ?? "") || "none",
          });
          showSuccess();
          return;
        }
        const body: unknown = await res.json().catch(() => null);
        showError(
          body && typeof body === "object" && "error" in body ? String(body.error) : "generic",
        );
      } catch {
        showError("generic");
      }
      button.disabled = false;
      button.textContent = button.dataset.submitLabel ?? button.textContent;
    });
  });
}

// ---------- mobile menu ----------
function initMenu() {
  const menu = document.querySelector<HTMLDetailsElement>("details[data-menu]");
  if (!menu) return;
  menu.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => (menu.open = false)));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") menu.open = false;
  });
}

function init() {
  initCountdown();
  initWaitlist();
  initMenu();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
