# Waqtu Privacy Policy

Last updated: 2026-07-21

Waqtu ("we", "the app") is a prayer-time companion for macOS, iOS, and watchOS. We are built privacy-first. This policy explains what data each feature touches and where it goes.

## Core principle: prayer times are computed on your device

Prayer times are calculated locally using your coordinates and the [Adhan](https://github.com/batoulapps/Adhan-Swift) library. **Your location coordinates never leave your device.** No server receives your location.

## Data we process

| Feature                                                             | What happens                                                                                                                                                                                                                             | Leaves your device?                        |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| **Location**                                                        | Used only to compute prayer times. Coordinates stay in memory/on-device.                                                                                                                                                                 | No                                         |
| **Calendar**                                                        | With your permission, Waqtu creates and removes "busy" calendar blocks during prayer times using EventKit (Exchange, iCloud, Google). Events live in your calendar only.                                                                 | No (only to your chosen calendar provider) |
| **iCloud sync**                                                     | Your settings and prayer streak sync across **your own** devices via `NSUbiquitousKeyValueStore`. Stored in your iCloud account, not on our servers.                                                                                     | Only to your iCloud                        |
| **App Group**                                                       | Prayer data is shared between the app and its widgets/watchOS companion so widgets can display it. Stored in an on-device shared container.                                                                                              | No                                         |
| **Slack status** _(optional, direct-distribution macOS build only)_ | If you enable it, Waqtu sets your Slack status to "Praying" during prayer times using a Slack API token **you provide**. The token is stored in your macOS Keychain.                                                                     | To Slack (api.slack.com), using your token |
| **Google Calendar** _(optional, macOS)_                             | OAuth via Apple's `ASWebAuthenticationSession`. Waqtu only creates/lists/deletes its own prayer-block events.                                                                                                                            | To Google, via OAuth                       |
| **Waqtu account and Premium**                                       | If you sign in, your account id and premium status are read from our server (`api.getwaqtu.com`). A subscription bought in the Mac App Store build is sent to the server as Apple's signed transaction so it unlocks your other devices. | To our server                              |
| **Purchases (Mac App Store build)**                                 | Handled by Apple StoreKit.                                                                                                                                                                                                               | To Apple                                   |

## Data we do NOT collect

- No analytics or usage tracking.
- No advertising SDKs.
- No third-party trackers.
- We do not sell or share data.

## Mac App Store build

The Mac App Store build runs inside the macOS App Sandbox. It does **not** include the Slack integration, Google Calendar integration, Polar licensing, or Sparkle auto-update — only the sandbox-compatible subset (prayer times, calendar blocks, iCloud sync, widgets, StoreKit In-App Purchase).

## Your choices

- Grant or revoke Location and Calendar access any time in System Settings / Settings.
- Disable iCloud sync by signing out of iCloud.
- The Slack and Google Calendar features are off by default.

## Contact

Questions: open an issue at the Waqtu source repository.
