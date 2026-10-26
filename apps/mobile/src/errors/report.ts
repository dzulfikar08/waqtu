/**
 * Anonymous crash reports: what goes into one, and the small queue that holds them on the phone until
 * `POST /v1/errors` (services/api) accepts them. Pure logic, no React Native, so it runs under bun test.
 * A report carries the app build and the error, never the account, the location or anything typed.
 */

/** Limits of `POST /v1/errors`; longer text is cut here so the server never refuses a batch for it. */
export const MAX_EVENTS_PER_REQUEST = 20;
export const MAX_NAME = 100;
export const MAX_MESSAGE = 500;
export const MAX_STACK = 8192;
export const MAX_SCREEN = 100;
export const MAX_REPEATS = 10_000;
/** Oldest reports are dropped beyond this, so a crash loop cannot grow the queue without end. */
export const MAX_QUEUE = 50;
/** Device-local settings row holding the queue as JSON. Not a synced key, so it never leaves with sync. */
export const QUEUE_KEY = "errors.queue";

export interface AppMeta {
  platform: "ios" | "android";
  appVersion: string;
  buildNumber: string | null;
  runtimeVersion: string | null;
  updateId: string | null;
  channel: string | null;
}

/** One event as `POST /v1/errors` takes it. */
export interface ErrorEvent extends AppMeta {
  fatal: boolean;
  name: string;
  message: string;
  stack: string | null;
  screen: string | null;
  /** Times this same error happened before it was sent. */
  count: number;
}

/** A queued event: `id` is local only, to settle exactly what a request carried. */
export interface QueuedError extends ErrorEvent {
  id: string;
}

const clip = (text: string, max: number): string => (text.length > max ? text.slice(0, max) : text);

/**
 * Takes out what could identify someone if it ever ended up in an error message: email addresses,
 * URL query strings and fragments (tokens, ids), and long decimals such as coordinates.
 */
export function scrub(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "<email>")
    .replace(/(https?:\/\/[^\s?#]+)[?#][^\s)]*/g, "$1")
    .replace(/-?\d{1,3}\.\d{3,}/g, "<num>");
}

/** Name, message and stack of anything that was thrown, Error or not. */
export function describeError(error: unknown): {
  name: string;
  message: string;
  stack: string | null;
} {
  if (error instanceof Error) {
    return { name: error.name || "Error", message: error.message, stack: error.stack ?? null };
  }
  if (typeof error === "string") return { name: "NonError", message: error, stack: null };
  let message: string;
  try {
    message = JSON.stringify(error) ?? String(error);
  } catch {
    message = String(error);
  }
  return { name: "NonError", message, stack: null };
}

export function buildEvent(
  error: unknown,
  fatal: boolean,
  meta: AppMeta,
  screen: string | null,
): ErrorEvent {
  const { name, message, stack } = describeError(error);
  return {
    ...meta,
    fatal,
    name: clip(name, MAX_NAME) || "Error",
    message: clip(scrub(message), MAX_MESSAGE),
    stack: stack ? clip(scrub(stack), MAX_STACK) : null,
    screen: screen ? clip(screen, MAX_SCREEN) : null,
    count: 1,
  };
}

/** Adds `event`, folding it into an identical queued one (count + 1) instead of repeating it. */
export function addToQueue(
  queue: readonly QueuedError[],
  event: ErrorEvent,
  newId: () => string,
): QueuedError[] {
  // An identical error from the same build and screen is folded in.
  const index = queue.findIndex(
    (q) =>
      q.name === event.name &&
      q.message === event.message &&
      q.stack === event.stack &&
      q.fatal === event.fatal &&
      q.screen === event.screen &&
      q.appVersion === event.appVersion &&
      q.updateId === event.updateId,
  );
  if (index >= 0) {
    return queue.map((q, i) =>
      i === index ? { ...q, count: Math.min(MAX_REPEATS, q.count + event.count) } : q,
    );
  }
  return [...queue, { ...event, id: newId() }].slice(-MAX_QUEUE);
}

const isQueued = (v: unknown): v is QueuedError => {
  if (typeof v !== "object" || v === null) return false;
  const q = v as Partial<QueuedError>;
  return (
    typeof q.id === "string" &&
    (q.platform === "ios" || q.platform === "android") &&
    typeof q.appVersion === "string" &&
    typeof q.fatal === "boolean" &&
    typeof q.name === "string" &&
    typeof q.message === "string" &&
    typeof q.count === "number"
  );
};

/** The stored queue; anything unreadable counts as empty rather than blocking new reports. */
export function parseQueue(raw: string | null): QueuedError[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter(isQueued) : [];
  } catch {
    return [];
  }
}

/** Request body for a batch: the events without their local ids. */
export function toPayload(batch: readonly QueuedError[]): { events: ErrorEvent[] } {
  return { events: batch.map(({ id: _id, ...event }) => event) };
}

/**
 * The queue after a request with `sent` answered `status` (null: no answer). Accepted or refused for
 * good (a 4xx other than 408/429: retrying cannot help) removes what was sent; anything else keeps it
 * for the next launch. Repeats folded in while the request was in flight stay queued.
 */
export function settleBatch(
  queue: readonly QueuedError[],
  sent: readonly QueuedError[],
  status: number | null,
): QueuedError[] {
  const done =
    status !== null &&
    ((status >= 200 && status < 300) ||
      (status >= 400 && status < 500 && status !== 408 && status !== 429));
  if (!done) return [...queue];
  const sentCounts = new Map(sent.map((s) => [s.id, s.count]));
  return queue.flatMap((q) => {
    const sentCount = sentCounts.get(q.id);
    if (sentCount === undefined) return [q];
    return q.count > sentCount ? [{ ...q, count: q.count - sentCount }] : [];
  });
}
