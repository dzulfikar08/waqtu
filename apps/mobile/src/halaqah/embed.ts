import { YOUTUBE_ID } from "./program";

/** Privacy-enhanced YouTube host: no cookies until the user plays the video. */
export const EMBED_HOST = "www.youtube-nocookie.com";
const ORIGIN = `https://${EMBED_HOST}`;

/** Embed URL for a video. No autoplay; related videos limited to the same channel. */
export function embedUrl(youtubeId: string): string {
  if (!YOUTUBE_ID.test(youtubeId)) throw new RangeError(`Invalid YouTube id: ${youtubeId}`);
  return `${ORIGIN}/embed/${youtubeId}?autoplay=0&rel=0&playsinline=1&modestbranding=1&origin=${encodeURIComponent(ORIGIN)}`;
}

/**
 * HTML that hosts the embed. Loaded with `baseUrl` = the embed host so YouTube receives a real
 * referrer (it refuses embeds without one).
 */
export function embedHtml(youtubeId: string): { html: string; baseUrl: string } {
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;height:100%;background:#000}iframe{border:0;width:100%;height:100%}</style></head><body><iframe src="${embedUrl(youtubeId)}" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></body></html>`;
  return { html, baseUrl: ORIGIN };
}

/**
 * Whether the WebView may load `url`. The first load is the page itself (iOS reports it as the
 * base URL, with or without a trailing slash, or about:blank); after that the top frame may only
 * go to the embed. Sub-frame loads (the player's own frames) are not restricted.
 */
export function isEmbedNavigation(url: string, isTopFrame = true): boolean {
  if (!isTopFrame) return true;
  return (
    url === "about:blank" ||
    url === ORIGIN ||
    url === `${ORIGIN}/` ||
    url.startsWith(`${ORIGIN}/embed/`)
  );
}

/** Plain watch link, offered as a fallback when the embed cannot play. */
export function watchUrl(youtubeId: string): string {
  if (!YOUTUBE_ID.test(youtubeId)) throw new RangeError(`Invalid YouTube id: ${youtubeId}`);
  return `https://www.youtube.com/watch?v=${youtubeId}`;
}
