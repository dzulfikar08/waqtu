# @waqtu/web

getwaqtu.com: Astro 7 on Cloudflare Workers (worker `waqtu-landing-astro`).

| Route                      | What                                                                               |
| -------------------------- | ---------------------------------------------------------------------------------- |
| `/`                        | Mobile landing in Indonesian (default): waitlist, Premium, Ramadhan countdown, FAQ |
| `/en/`                     | Same page in English                                                               |
| `/mac`                     | Waqtu for Mac landing, download and Premium pricing (English)                      |
| `/blog`, `/resources`, ... | Content pages (English)                                                            |
| `POST /api/waitlist`       | Waitlist signup, stores into D1 (`prerender = false`)                              |

The site sells nothing. Waqtu Premium is bought in the App Store, Google Play or the Mac App Store edition;
Polar webhooks go to the API worker (`/v1/billing/polar/webhook`).

Landing copy for both languages lives in `src/i18n/landing.ts` (one shape, no per-language template).
The page is `src/components/Landing.astro`; `src/pages/index.astro` and `src/pages/en/index.astro` only pick the locale.

## Develop

```bash
bun run dev:web          # from the repo root; astro dev with the Cloudflare platform proxy
```

Astro dev emulates the `WAITLIST_DB` binding with a local D1. Create its tables once:

```bash
cd apps/web
bunx wrangler d1 migrations apply waqtu-waitlist --local
```

To test the built worker the way it runs in production:

```bash
bun run build
bunx wrangler d1 migrations apply waqtu-waitlist --local --persist-to .wrangler/state
bunx wrangler dev --config dist/server/wrangler.json --local --persist-to .wrangler/state \
  --var WAITLIST_IP_SALT:dev
curl -X POST localhost:8787/api/waitlist -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","platform":"ios","city":"Malang","locale":"id"}'
```

## Waitlist

`POST /api/waitlist` takes JSON (`email`, optional `platform` of `ios|android|mac`, optional `city`, `locale` of
`id|en`) or a plain form post, which gets a `303` back to the page. Behavior:

- Email is trimmed and lowercased; it is the unique key. A repeat signup changes nothing and returns the same
  `{ "ok": true }`, so the form never reveals who is on the list.
- Invalid input returns `400` (`invalid_email`, `invalid_platform`, `invalid_city`, `bad_request`).
- A filled `website` field (the honeypot) returns `{ "ok": true }` and stores nothing.
- Rate limit: 5 requests per 10 minutes per IP (`429 rate_limited`). The counter is keyed by a salted SHA-256 of
  the `cf-connecting-ip` header; counter rows older than the previous window are deleted on every request.
- `WAITLIST_IP_SALT` is required. Set it once in production: `bunx wrangler secret put WAITLIST_IP_SALT`.
  Without it the endpoint logs the problem and returns `500`; it never stores unsalted IP hashes. For
  local runs pass `--var WAITLIST_IP_SALT:dev`, or put it in `apps/web/.dev.vars` (git-ignored).

The browser fires the Stonks event `waitlist_submit` (`location`, `locale`, `platform`) on success.

### Operate the production database

The database is `waqtu-waitlist` (binding `WAITLIST_DB`, id in `wrangler.jsonc`). Use the production
Cloudflare account (`CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`), not your default wrangler login.

```bash
cd apps/web

# apply new migrations
bunx wrangler d1 migrations apply waqtu-waitlist --remote

# count and export (CSV)
bunx wrangler d1 execute waqtu-waitlist --remote --command "SELECT count(*) AS total FROM waitlist"
bunx wrangler d1 execute waqtu-waitlist --remote --json \
  --command "SELECT email, platform, city, locale, created_at FROM waitlist ORDER BY id" \
  | jq -r '.[0].results[] | [.email, .platform, .city, .locale, .created_at] | @csv' > waitlist.csv

# CSV for a mail merge (header row, spreadsheet-safe city), optionally one locale
scripts/export-waitlist.sh --locale id > /tmp/waitlist.csv

# signups per platform
bunx wrangler d1 execute waqtu-waitlist --remote \
  --command "SELECT coalesce(platform, 'unset') AS platform, count(*) AS n FROM waitlist GROUP BY 1"

# delete one person on request (the privacy policy promises this)
bunx wrangler d1 execute waqtu-waitlist --remote \
  --command "DELETE FROM waitlist WHERE email = 'someone@example.com'"
```

## Store badges (launch flag)

The App Store, Google Play and Mac App Store links are built into the landing pages (`/`, `/en/`, `/mac`) but
stay hidden until `STORE_BADGES_LIVE` is on (`src/config.ts`, component `src/components/StoreBadges.astro`).
With the flag off the pages are the pre-launch pages. With it on, the hero swaps "coming soon" for the
badges and `/mac` gets the Mac App Store badge. The badges are styled links, not Apple or Google artwork.

- Turn it on for the live site: set the repository variable `STORE_BADGES_LIVE` to `true`, then run the
  Deploy workflow with target `web`. Delete the variable (or set it to anything else) and redeploy to turn it off.
- Preview locally: `PUBLIC_STORE_BADGES_LIVE=true bun run build`, then serve `dist/client`.

The URLs are constants in `src/i18n/landing.ts`. The flag does not touch the waitlist form or the FAQ copy
about the release date; edit those when the stores are live.

## Ramadhan countdown

`src/lib/ramadhan.ts` finds 1 Ramadhan 1448 at build time with `Intl` and the `islamic-umalqura` calendar
(8 February 2027). Indonesia sets the month at the Kemenag isbat session, which can fall one day away from
Umm al-Qura, so the page labels the date as an estimate. The countdown targets midnight in Jakarta (UTC+7).
If the date needs to follow the isbat result, change `ramadhan1448()` to return the declared date.

## Deploy

```bash
bun run deploy:web       # from the repo root: astro build && wrangler deploy
```
