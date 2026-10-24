# Sparkle Auto-Update Setup Design

**Date:** 2025-02-17
**Project:** Waqt Prayer Time App
**Status:** Approved

## Overview

Set up server-side components for Sparkle auto-updates in the Waqt macOS prayer time app. This includes EdDSA code signing keys, a Cloudflare Worker to serve the appcast feed, and a release workflow for distributing updates via Cloudflare R2.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Waqt App      │────▶│  Cloudflare      │────▶│   Cloudflare    │
│   (Sparkle)     │     │  Worker          │     │   R2 Storage    │
│                 │     │  (appcast.xml)   │     │  (.dmg files)   │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

### Update Flow

1. App checks Cloudflare Worker URL on launch/scheduled interval
2. Worker returns `appcast.xml` with latest version info
3. If new version available, Sparkle downloads DMG from R2
4. EdDSA signature verified before install

## Components

### 1. EdDSA Code Signing Keys

- **Private key**: Stored securely, used to sign updates before distribution
- **Public key**: Embedded in app, used to verify update signatures
- **Key locations**:
  - Private: `~/PrivateKeys/sparkle_private_key` or CI/CD secrets
  - Public: `waqtu.app/Contents/Resources/public_ed25519.pem`

### 2. Xcode Configuration

Build settings/Info.plist entries:

| Setting         | Value                                                                        |
| --------------- | ---------------------------------------------------------------------------- |
| `SUFeedURL`     | Cloudflare Worker URL (e.g., `https://waqt-updates.workers.dev/appcast.xml`) |
| `SUPublicEDKey` | Base64-encoded EdDSA public key                                              |

### 3. Cloudflare Worker

Serves the `appcast.xml` feed with responsibilities:

- Return properly formatted XML appcast
- Handle HTTPS (automatic)
- Support CORS if needed
- Cache responses appropriately

### 4. Cloudflare R2 Storage

Hosts the signed `.dmg` update files for download.

### 5. Release Workflow

1. Build and archive the app
2. Export DMG with existing `build-dmg` script
3. Sign DMG with Sparkle's `sign_update` tool
4. Upload DMG to Cloudflare R2
5. Update `appcast.xml` with new version info and signature
6. Deploy updated Worker

## Files to Create/Modify

| File                                 | Action                                                  |
| ------------------------------------ | ------------------------------------------------------- |
| `waqtu/Resources/public_ed25519.pem` | Create - add public key to Xcode resources              |
| `waqt.xcodeproj`                     | Modify - add SUFeedURL and SUPublicEDKey build settings |
| `scripts/release.sh`                 | Create - automate build, sign, upload steps             |
| `cloudflare-worker/worker.ts`        | Create - Worker code for appcast                        |
| `cloudflare-worker/wrangler.toml`    | Create - Worker config                                  |

## Appcast XML Format

```xml
<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle">
  <channel>
    <title>Waqt App Updates</title>
    <item>
      <title>Version 1.0.1</title>
      <sparkle:version>1.0.1</sparkle:version>
      <pubDate>...</pubDate>
      <enclosure url="https://releases.your-domain.com/Waqt-1.0.1.dmg"
                 sparkle:edSignature="..."
                 length="..." />
    </item>
  </channel>
</rss>
```

## Existing Code Integration

The following Sparkle code is already in place:

- `AppDelegate.swift`: `SPUStandardUpdaterController` initialized
- `waqtuApp.swift`: `CheckForUpdatesView` for "Check for Updates" menu item
- Package dependency: Sparkle 2.8.1

No changes needed to existing Swift code - only configuration and server-side setup.
