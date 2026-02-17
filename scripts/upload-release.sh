#!/bin/bash
set -e

# Re-upload a release to R2 and add to D1 (retry after auth fix or partial failure).
# Usage: ./scripts/upload-release.sh SHORT_VERSION [DESCRIPTION]
# Example: ./scripts/upload-release.sh 1.1.15 "Fix location display and build warnings"
#
# Prereqs:
# - DMG must exist at build/Waqtu-{VERSION}.dmg (from prior release.sh run)
# - Sparkle: sign_update available, private key in keychain
# - Cloudflare: wrangler login (fix auth first if D1 failed with code 10000)
# - Env: R2_PUBLIC_BASE_URL (optional)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
WORKER_DIR="$PROJECT_DIR/cloudflare-worker"
BUILD_DIR="$PROJECT_DIR/build"
SHORT_VERSION="${1:?Usage: ./scripts/upload-release.sh SHORT_VERSION [DESCRIPTION]}"
DESCRIPTION="${2:-Update with prayer times and calendar protection.}"

DMG_NAME="Waqtu-${SHORT_VERSION}.dmg"
DMG_PATH="$BUILD_DIR/$DMG_NAME"
R2_BUCKET="waqt-releases"
R2_PUBLIC_BASE_URL="${R2_PUBLIC_BASE_URL:-https://waqt-r2-release.dzulfikar.com}"

if [[ ! -f "$DMG_PATH" ]]; then
  echo "Error: DMG not found at $DMG_PATH"
  echo "Run release.sh first or ensure the DMG exists."
  exit 1
fi

# Sparkle sign_update
SPARKLE_BIN="$BUILD_DIR/DerivedData/SourcePackages/artifacts/sparkle/Sparkle/bin/sign_update"
if [[ ! -f "$SPARKLE_BIN" ]]; then
  SPARKLE_BIN="$PROJECT_DIR/build/DerivedData/SourcePackages/checkouts/Sparkle/bin/sign_update"
fi
if [[ ! -f "$SPARKLE_BIN" ]]; then
  echo "Error: Sparkle sign_update not found. Build the app once in Xcode so SPM fetches Sparkle."
  exit 1
fi

# Sparkle version from built app
APP_PLIST="$BUILD_DIR/DerivedData/Build/Products/Release/waqtu.app/Contents/Info.plist"
if [[ ! -f "$APP_PLIST" ]]; then
  echo "Error: App Info.plist not found at $APP_PLIST. Run full release.sh first."
  exit 1
fi
SPARKLE_VERSION=$(/usr/libexec/PlistBuddy -c "Print CFBundleVersion" "$APP_PLIST")

echo "=== Uploading Waqtu $SHORT_VERSION (build $SPARKLE_VERSION) ==="

echo "[1/3] Signing DMG..."
SIGNATURE=$("$SPARKLE_BIN" "$DMG_PATH")
echo "    Signature: ${SIGNATURE:0:40}..."
FILE_LENGTH=$(stat -f%z "$DMG_PATH" 2>/dev/null || stat -c%s "$DMG_PATH")

echo "[2/3] Uploading to R2..."
cd "$WORKER_DIR"
npx wrangler r2 object put "$R2_BUCKET/$DMG_NAME" --file="$DMG_PATH" --remote
cd "$PROJECT_DIR"
echo "    Uploaded: $DMG_NAME"

echo "[3/3] Adding release to D1..."
ENCLOSURE_URL="${R2_PUBLIC_BASE_URL%/}/$DMG_NAME"
PUB_DATE=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")
TITLE="Waqtu $SHORT_VERSION"
TITLE_ESC="${TITLE//\'/\'\'}"
DESC_ESC="${DESCRIPTION//\'/\'\'}"
SIG_ESC="${SIGNATURE//\'/\'\'}"

cd "$WORKER_DIR"
npx wrangler d1 execute waqt-releases-db --remote --command "INSERT OR REPLACE INTO releases (version, short_version_string, title, description, enclosure_url, ed_signature, length, pub_date) VALUES ($SPARKLE_VERSION, '$SHORT_VERSION', '$TITLE_ESC', '$DESC_ESC', '$ENCLOSURE_URL', '$SIG_ESC', $FILE_LENGTH, '$PUB_DATE');"
cd "$PROJECT_DIR"

echo ""
echo "=== Done ==="
echo "  Appcast: https://waqt-updates.dzulfikar-at.workers.dev/appcast.xml"
