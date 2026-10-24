# Waqtu

Prayer times, mutabaah yaumiyah, and halaqah for Muslims with little time. Privacy-first and open
source. Website: [getwaqtu.com](https://getwaqtu.com).

## Layout

| Path           | What                                                                     | Stack                       |
| -------------- | ------------------------------------------------------------------------ | --------------------------- |
| `apps/web`     | getwaqtu.com landing, blog, Polar checkout + webhook                     | Astro on Cloudflare Workers |
| `apps/apple`   | macOS menu-bar companion (direct + Mac App Store), iOS, watchOS, widgets | Swift / SwiftUI, Xcode      |
| `apps/mobile`  | iOS + Android phone app: Today, settings, offline-first SQLite           | Expo / React Native, EAS    |
| `services/api` | Sparkle appcast, DMG download, license activate/validate                 | Cloudflare Worker, D1, R2   |

Prayer-time math runs on the device; location never leaves it.

## Develop

```bash
bun install
bun run dev:web        # landing page
bun run dev:api        # updates/license worker
bun run dev:mobile     # Expo dev server (phone app)
open apps/apple/waqt.xcodeproj   # Apple apps (Xcode, macOS only)
```

Checks (CI runs the same):

```bash
bun run lint && bun run fmt:check && bun run typecheck && bun run build
```

## Releases

GitHub Actions builds everything; no local Mac is needed.

- **CI** (`.github/workflows/ci.yml`): gitleaks over full history, lint/format/typecheck/build, and an
  unsigned `xcodebuild` of the macOS and iOS apps on `macos-latest`.
- **Release macOS** (`release-macos.yml`, manual): runs `apps/apple/scripts/release.sh` → Developer ID
  sign, notarize, DMG, Sparkle sign, upload to R2, record in D1. Secrets are listed at the top of the
  workflow and live in the `release` environment.

## License

- `services/api`: [AGPL-3.0-only](services/api/LICENSE). If you run a modified server, publish your changes.
- Everything else: [MPL-2.0](LICENSE). File-level copyleft, compatible with App Store distribution.

The **Waqtu** name and logo are not covered by these licenses; forks must use their own branding.

Contributions require signing the [CLA](CLA.md) (the bot asks on your first pull request).
