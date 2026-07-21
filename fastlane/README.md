# Waqtu fastlane

Automates screenshots, metadata, and TestFlight upload for the iOS/watchOS app and the Mac App Store app.

## Install

```bash
brew install fastlane
```

## Auth (do once — enables non-interactive uploads)

App Store Connect → Users and Access → Integrations → **App Store Connect API** → generate an **Admin** key. Then:

```bash
export APP_STORE_CONNECT_API_KEY_PATH=/absolute/AuthKey_XXXXXXXXXX.p8
export APP_STORE_CONNECT_API_KEY_ID=XXXXXXXXXX
export APP_STORE_CONNECT_API_KEY_ISSUER_ID=xxxxxxxx-xxxx-...
export APP_STORE_CONNECT_APPLE_ID=you@example.com
```

Without the API key, fastlane falls back to your Apple ID (interactive 2FA prompt).

## Lanes

| Lane | What it does |
|---|---|
| `fastlane ios_beta` | Archive `waqtu-ios` → upload to TestFlight |
| `fastlane ios_metadata` | Push `fastlane/metadata/ios` text to ASC (no binary) |
| `fastlane ios_screenshots` | Capture screenshots (needs iOS UITest w/ `snapshot()` — see below) |
| `fastlane mas_beta` | Archive `waqtu-mas` → upload to TestFlight (Mac App Store) |
| `fastlane mas_metadata` | Push `fastlane/metadata/macos` text to ASC |
| `fastlane tag version:2.0.0` | Tag + push a release tag |

## One-time per app

1. Create the ASC app record (iOS `dat.waqtu.ios`, macOS `dat.waqtu`).
2. Pull the (empty) metadata tree to start editing:
   ```bash
   fastlane deliver download_metadata -a dat.waqtu.ios --skip_screenshots
   fastlane deliver download_metadata -a dat.waqtu    --app_platform mac --skip_screenshots
   ```
   Then paste copy from `../docs/app-store-metadata.md` into the generated files under `fastlane/metadata/`.
3. Host the privacy policy (`../docs/PRIVACY.md`) and set the URL in `fastlane/metadata/*/privacy_url.txt`.

## Screenshots

`ios_screenshots` uses fastlane `snapshot`, which needs an **iOS UI Test target** calling `snapshot("01_Home")` etc. on each screen. The repo has no iOS UITest target yet. Until you add one, capture manually:

```bash
xcrun simctl boot "iPhone 15 Pro Max"
open -a Simulator
# navigate the app, then:
xcrun simctl io booted screenshot ~/Desktop/waqtu_01.png
```

Upload via ASC web or `fastlane deliver` once captured.

## Full publish checklist (lanes + manual)

### iOS + watch
- [ ] `waqtu-ios/widget/watch` signing green in Xcode (team `F6Q6UFUK69`)
- [ ] ASC iOS app record + privacy URL + metadata (`ios_metadata`)
- [ ] Screenshots (6.7")
- [ ] `fastlane ios_beta` → TestFlight
- [ ] Test on device (prayer times, streak, watch, widget)
- [ ] Submit for Review

### Mac App Store
- [ ] Developer Portal: App Group `group.com.waqtu.shared` + iCloud on `dat.waqtu`
- [ ] ASC IAP: non-consumable `dat.waqtu.lifetime`, $9.99
- [ ] ASC macOS app record + privacy URL + metadata (`mas_metadata`)
- [ ] Xcode: waqtu-mas Run scheme → StoreKit config = `WaqtuProducts.storekit`; Sandbox-buy test
- [ ] `fastlane mas_beta` → TestFlight
- [ ] Submit app + IAP for Review

## Notes
- Lanes pass `precheck_include_in_app_purchases=false` to avoid precheck choking on the IAP before it's approved.
- Direct-distribution `waqtu` (Sparkle + Polar) is **not** managed here — it builds via `../scripts/release.sh`.
