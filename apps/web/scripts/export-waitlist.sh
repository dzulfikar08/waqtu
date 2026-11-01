#!/usr/bin/env bash
# Export the waitlist as CSV (header: email,platform,city,locale,created_at) for a mail merge.
#
#   apps/web/scripts/export-waitlist.sh [--locale id|en] [--local] > /tmp/waitlist.csv
#
# Reads the production database `waqtu-waitlist` by default, so run it with the production Cloudflare account
# (CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN). `--local` reads the local dev database instead. Needs
# `bunx` (wrangler) and `jq`. The output holds personal data: keep it out of the repo and delete it after the send.
set -euo pipefail

where=--remote
locale=
while [ $# -gt 0 ]; do
  case "$1" in
    --local) where=--local ;;
    --locale)
      locale="${2:-}"
      shift
      ;;
    *)
      echo "usage: $0 [--locale id|en] [--local]" >&2
      exit 2
      ;;
  esac
  shift
done

query="SELECT email, platform, city, locale, created_at FROM waitlist"
case "$locale" in
  "") ;;
  id | en) query="$query WHERE locale = '$locale'" ;;
  *)
    echo "--locale must be id or en" >&2
    exit 2
    ;;
esac
query="$query ORDER BY id"

cd "$(dirname "$0")/.."
bunx wrangler d1 execute waqtu-waitlist "$where" --json --command "$query" |
  jq -r '
    # city is free text from the form: stop a spreadsheet from reading it as a formula.
    def safe: if type == "string" and test("^[=+@-]") then "\u0027" + . else . end;
    ["email", "platform", "city", "locale", "created_at"],
    (.[0].results[] | [.email, .platform, (.city | safe), .locale, .created_at])
    | @csv'
