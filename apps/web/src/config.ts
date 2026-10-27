/**
 * Launch switches, read at build time. The site is static, so a change takes effect with the next deploy.
 *
 * STORE_BADGES_LIVE: show the App Store, Google Play and Mac App Store badges and switch the hero copy from
 * "coming soon" to "available". Off unless `PUBLIC_STORE_BADGES_LIVE=true` is set for the build; the Deploy
 * workflow sets it from the repository variable `STORE_BADGES_LIVE`. Flip it only after both stores show the
 * app as published.
 */
export const STORE_BADGES_LIVE = import.meta.env.PUBLIC_STORE_BADGES_LIVE === "true";
