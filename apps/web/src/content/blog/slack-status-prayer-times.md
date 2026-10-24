---
title: "Automatically Set Your Slack Status to 'Praying' During Prayer Times"
description: "How Waqtu's Slack integration lets your team know you're praying — automatically."
pubDate: "May 2026"
category: "Feature"
readTime: "3 min read"
---

You're in a Slack-heavy workplace. Someone @mentions you during Dhuhr. Your phone buzzes. Your watch lights up. You feel the pressure to respond — but you're supposed to be praying.

Waqtu's new Slack integration solves this. Your Slack status changes to **"Praying 🙏"** automatically during prayer times — and clears itself when the prayer window ends.

## How it works

1. **Connect Slack** — Paste a User OAuth Token in Settings → Slack
2. **Enable auto-status** — Toggle it on
3. **Customize** — Choose your status text (e.g. "Praying") and emoji (:pray:, 🕌, 🙏)

When a prayer time arrives, your Slack status updates immediately. Team members see your status and know you're unavailable. No need to explain.

## Auto-clears when you're done

Waqtu uses Slack's built-in `status_expiration` feature. Your status automatically clears after the prayer block duration. You don't need to remember to turn it off.

## Setup takes 3 minutes

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Create a new app → OAuth & Permissions
3. Add the `users.profile:write` scope
4. Install to your workspace
5. Copy the User OAuth Token (starts with `xoxp-`)
6. Paste into Waqtu Settings → Slack → Connect

## Privacy first

Your Slack token is stored securely in your Mac's Keychain. Waqtu never sees it, never transmits it, never stores it on any server. The API call goes directly from your Mac to Slack.

<div class="neu-card p-6 mt-10">
  <p class="font-medium text-[var(--waqtu-text)]">Try Slack integration</p>
  <p class="mt-2 text-sm text-[var(--waqtu-muted)]">
    Download Waqtu, connect Slack in Settings, and let your team know when you're praying — without saying a word.
  </p>
  <a href="/#download" class="neu-btn mt-4 inline-flex items-center gap-2 px-6 py-3 font-medium text-[var(--waqtu-bg)]">Download Waqtu</a>
</div>
