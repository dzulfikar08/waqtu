#!/bin/bash
set -e

# Release: build DMG, sign with Sparkle, upload to R2, add row to D1.
# Usage: ./scripts/release.sh SHORT_VERSION [DESCRIPTION]
# Example: ./scripts/release.sh 1.0.0 "Initial release with prayer times and calendar protection."
#
# Prereqs:
# - Xcode: MARKETING_VERSION and CURRENT_PROJECT_VERSION set (CURRENT_PROJECT_VERSION = Sparkle version integer)
# - Sparkle: generate_keys run once, private key in keychain
# - Cloudflare: D1 database waqt-releases-db created, schema applied, R2 bucket waqt-releases, wrangler.toml has database_id
# - Env: R2_PUBLIC_BASE_URL (e.g. https://pub-xxx.r2.dev/waqt-releases) so downloads work

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
WORKER_DIR="$PROJECT_DIR/cloudflare-worker"
BUILD_DIR="$PROJECT_DIR/build"
SHORT_VERSION="${1:?Usage: ./scripts/release.sh SHORT_VERSION [DESCRIPTION]}"
DESCRIPTION="${2:-Update with prayer times and calendar protection.}"

DMG_NAME="Waqtu-${SHORT_VERSION}.dmg"
R2_BUCKET="waqt-releases"

# Sparkle sign_update: when using SPM, artifacts are under DerivedData/SourcePackages/artifacts
SPARKLE_BIN="$BUILD_DIR/DerivedData/SourcePackages/artifacts/sparkle/Sparkle/bin/sign_update"
if [[ ! -f "$SPARKLE_BIN" ]]; then
  SPARKLE_BIN="$PROJECT_DIR/build/DerivedData/SourcePackages/checkouts/Sparkle/bin/sign_update"
fi
if [[ ! -f "$SPARKLE_BIN" ]]; then
  echo "Error: Sparkle sign_update not found. Build the app once in Xcode so SPM fetches Sparkle, or set SPARKLE_SIGN_UPDATE_PATH."
  exit 1
fi

R2_PUBLIC_BASE_URL="${R2_PUBLIC_BASE_URL:-https://waqt-r2-release.dzulfikar.com}"

echo "=== Releasing Waqtu $SHORT_VERSION ==="

# 1. Build DMG (uses same DerivedData so Sparkle is there)
echo "[1/4] Building DMG..."
"$SCRIPT_DIR/build-dmg.sh" "$SHORT_VERSION"

DMG_PATH="$BUILD_DIR/$DMG_NAME"
if [[ ! -f "$DMG_PATH" ]]; then
  echo "Error: DMG not found at $DMG_PATH"
  exit 1
fi

# 2. Sparkle version = CFBundleVersion from built app
APP_PLIST="$BUILD_DIR/DerivedData/Build/Products/Release/waqtu.app/Contents/Info.plist"
if [[ ! -f "$APP_PLIST" ]]; then
  echo "Error: App Info.plist not found. Build may have failed."
  exit 1
fi
SPARKLE_VERSION=$(/usr/libexec/PlistBuddy -c "Print CFBundleVersion" "$APP_PLIST")
echo "    Sparkle version (build): $SPARKLE_VERSION"

# 3. Sign DMG
echo "[2/4] Signing DMG with Sparkle..."
SIGNATURE=$("$SPARKLE_BIN" "$DMG_PATH")
echo "    Signature: ${SIGNATURE:0:40}..."
FILE_LENGTH=$(stat -f%z "$DMG_PATH" 2>/dev/null || stat -c%s "$DMG_PATH")

# 4. Upload to R2
echo "[3/4] Uploading to R2..."
cd "$WORKER_DIR"
# Wrangler v4 defaults to local unless --remote is provided.
npx wrangler r2 object put "$R2_BUCKET/$DMG_NAME" --file="$DMG_PATH" --remote
cd "$PROJECT_DIR"
echo "    Uploaded: $DMG_NAME"

# 5. Insert into D1
ENCLOSURE_URL="${R2_PUBLIC_BASE_URL%/}/$DMG_NAME"
PUB_DATE=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")
TITLE="Waqtu $SHORT_VERSION"
# Escape single quotes for SQL
TITLE_ESC="${TITLE//\'/\'\'}"
DESC_ESC="${DESCRIPTION//\'/\'\'}"
SIG_ESC="${SIGNATURE//\'/\'\'}"

echo "[4/4] Adding release to D1..."
cd "$WORKER_DIR"
npx wrangler d1 execute waqt-releases-db --remote --command "INSERT OR REPLACE INTO releases (version, short_version_string, title, description, enclosure_url, ed_signature, length, pub_date) VALUES ($SPARKLE_VERSION, '$SHORT_VERSION', '$TITLE_ESC', '$DESC_ESC', '$ENCLOSURE_URL', '$SIG_ESC', $FILE_LENGTH, '$PUB_DATE');"
cd "$PROJECT_DIR"

echo ""
echo "=== Done ==="
echo "  Appcast: https://waqt-updates.dzulfikar-at.workers.dev/appcast.xml"
echo "  Deploy worker if you haven't: cd $WORKER_DIR && npx wrangler deploy"
echo "  Optional: git tag -a v$SHORT_VERSION -m 'Release $SHORT_VERSION' && git push origin v$SHORT_VERSION"
