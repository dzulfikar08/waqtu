# Waqtu license flow and landing page

## Overview

- **Purchase**: User buys lifetime access on getwaqtu.com (Polar checkout).
- **After payment**: Polar sends email (receipt) with **license key**. Customer **downloads the app from the landing page** (getwaqtu.com → Download section; link goes to worker `/latest` redirect to R2 DMG). No need to upload DMG to Polar.
- **Device binding**: License is limited to **1 activation** (one device). If they share the DMG, the other person can install but has no valid license; they only get the 7-day trial. Activating the same key on a second device fails (Polar activation limit).

## Polar setup

1. **Product**: Create a one-time purchase product (e.g. "Waqtu lifetime access").
2. **Benefit – License keys** (required):
   - Type: License Keys
   - **Activation limit**: 1 (one device per key)
   - Optional: key prefix (e.g. `WAQTU-`), no expiration for lifetime
   - Polar will email the license key with the receipt. No need to add a File download benefit — customers download the app from the landing page (worker `/latest` redirects to the current R2 DMG).

## Flow

1. User visits **getwaqtu.com** → clicks “Buy lifetime access” → Polar checkout.
2. After payment, Polar shows receipt and emails **license key**; customer downloads the app from getwaqtu.com (Download section → worker `/latest` → R2 DMG).
3. User downloads DMG, installs Waqtu.
4. App: trial runs first. When they enter their **license key** (Settings or upgrade screen), app calls your **license API** with key + **device id** (e.g. hardware UUID).
5. **First time**: API calls Polar **Activate** → Polar binds that key to this device (activation count 1/1). API returns success; app stores key + activation_id in Keychain and grants lifetime access.
6. **Later launches**: App sends key + activation_id to your API → API calls Polar **Validate** → if valid, app keeps access.
7. If someone else installs the same DMG and enters the same key, **Activate** fails (max activations reached). They only get the 7-day trial unless they buy their own key.

## Implemented pieces

- **License API**: Cloudflare Worker routes `POST /license/activate` and `POST /license/validate` (see worker and env vars below).
- **App**: License manager (Keychain), “Enter license key” UI, validation on launch; `hasAccess` = trial active OR licensed.
- **Landing page**: Static HTML in `landing/` you can host on getwaqtu.com (buy button → Polar checkout, copy about download + license key).

## Worker secrets (license API)

Set these so the app can call `/license/activate` and `/license/validate`:

```bash
cd cloudflare-worker
npx wrangler secret put POLAR_ACCESS_TOKEN   # Polar API token (dashboard)
npx wrangler secret put POLAR_ORG_ID         # Polar organization ID (settings)
```

Polar license key benefit: set **activation limit** to **1** so each key is bound to one device.
