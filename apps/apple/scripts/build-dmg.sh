#!/bin/bash
set -e

# Usage: ./build-dmg.sh [VERSION]
# If VERSION is set (e.g. 1.0.0), outputs build/Waqtu-1.0.0.dmg and uses that in volname.
# Otherwise outputs Waqtu.dmg in project root (legacy).

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SCHEME="waqtu"
APP_NAME="waqtu"
BUILD_DIR="$PROJECT_DIR/build"
DMG_DIR="$BUILD_DIR/dmg"
VERSION="${1:-}"
DMG_VOLUME_NAME="Waqtu"

cd "$PROJECT_DIR"

echo " Building $APP_NAME (Release)..."
xcodebuild -scheme "$SCHEME" -configuration Release -derivedDataPath "$BUILD_DIR/DerivedData" clean build

APP_PATH="$BUILD_DIR/DerivedData/Build/Products/Release/$APP_NAME.app"
if [[ ! -d "$APP_PATH" ]]; then
  echo "Error: App not found at $APP_PATH"
  exit 1
fi

# Re-sign the app bundle for distribution (Developer ID + hardened runtime).
# You can override by exporting CODESIGN_IDENTITY (recommended: use the certificate SHA-1).
if [[ -z "${CODESIGN_IDENTITY:-}" ]]; then
  # Try to find Developer ID Application identity first (for production distribution)
  CODESIGN_IDENTITY=$(
    security find-identity -v -p codesigning 2>/dev/null \
      | awk '/Developer ID Application: Dzulfikar/ { print $2; exit }'
  )
  
  # Fall back to Apple Development certificate if no Developer ID found
  if [[ -z "$CODESIGN_IDENTITY" ]]; then
    CODESIGN_IDENTITY=$(
      security find-identity -v -p codesigning 2>/dev/null \
        | awk '/Apple Development: Dzulfikar/ { print $2; exit }'
    )
    if [[ -n "$CODESIGN_IDENTITY" ]]; then
      echo "⚠️  Using Apple Development certificate (not for production distribution)"
      echo "    For production, get a Developer ID Application certificate"
    fi
  fi
  
  if [[ -z "$CODESIGN_IDENTITY" ]]; then
    echo "Error: Could not find any code signing identity in keychain search list."
    echo "Set CODESIGN_IDENTITY to your certificate (preferably SHA-1) and retry."
    exit 1
  fi
fi
echo " Re-signing $APP_NAME.app with hardened runtime..."
# Preserve the Xcode entitlements (including Calendar access) when re-signing with
# the Developer ID certificate. Without this, Hardened Runtime builds lose the
# personal-information.calendars entitlement and EventKit calls fail in release builds.
codesign --deep --force --verify --verbose \
  --sign "$CODESIGN_IDENTITY" \
  --options runtime \
  --preserve-metadata=entitlements \
  "$APP_PATH"

# Notarize + staple (recommended for distribution)
# Uses either NOTARY_KEYCHAIN_PROFILE (recommended) OR NOTARY_APPLE_ID + NOTARY_TEAM_ID + NOTARY_PASSWORD.
# To enable: export NOTARIZE=1 (requires notarization credentials setup)
# Auto-skip notarization if using development certificate (can't be notarized)
CERT_NAME=$(security find-identity -v -p codesigning 2>/dev/null | grep "$CODESIGN_IDENTITY" | head -1)
if [[ "$CERT_NAME" =~ "Apple Development" ]]; then
  NOTARIZE="${NOTARIZE:-0}"
  if [[ "$NOTARIZE" == "1" ]]; then
    echo "⚠️  Notarization disabled: Apple Development certificates cannot be notarized"
    NOTARIZE=0
  fi
else
  # Default to skip notarization even with Developer ID cert (can enable with NOTARIZE=1)
  NOTARIZE="${NOTARIZE:-0}"
fi
# Default profile name (created via: xcrun notarytool store-credentials "waqtu-notary" ...)
NOTARY_KEYCHAIN_PROFILE="${NOTARY_KEYCHAIN_PROFILE:-waqtu-notary}"
NOTARY_APPLE_ID="${NOTARY_APPLE_ID:-}"
NOTARY_TEAM_ID="${NOTARY_TEAM_ID:-}"
NOTARY_PASSWORD="${NOTARY_PASSWORD:-}"

if [[ "$NOTARIZE" == "1" ]]; then
  ZIP_PATH="$BUILD_DIR/Waqtu.zip"
  echo " Zipping for notarization..."
  rm -f "$ZIP_PATH"
  ditto -c -k --keepParent "$APP_PATH" "$ZIP_PATH"

  echo " Submitting to Apple notarization..."
  if [[ -n "$NOTARY_KEYCHAIN_PROFILE" ]]; then
    xcrun notarytool submit "$ZIP_PATH" --keychain-profile "$NOTARY_KEYCHAIN_PROFILE" --wait
  else
    if [[ -z "$NOTARY_APPLE_ID" || -z "$NOTARY_TEAM_ID" || -z "$NOTARY_PASSWORD" ]]; then
      echo "Error: Notarization enabled but credentials not set."
      echo "Set either:"
      echo "  - NOTARY_KEYCHAIN_PROFILE (preferred; created via: xcrun notarytool store-credentials)"
      echo "or:"
      echo "  - NOTARY_APPLE_ID, NOTARY_TEAM_ID, NOTARY_PASSWORD (app-specific password)"
      exit 1
    fi
    xcrun notarytool submit "$ZIP_PATH" \
      --apple-id "$NOTARY_APPLE_ID" \
      --team-id "$NOTARY_TEAM_ID" \
      --password "$NOTARY_PASSWORD" \
      --wait
  fi

  echo " Stapling notarization ticket..."
  xcrun stapler staple "$APP_PATH"

  echo " Verifying Gatekeeper acceptance..."
  spctl --assess --verbose "$APP_PATH"
fi

echo " Preparing DMG..."
rm -rf "$DMG_DIR"
mkdir -p "$DMG_DIR"

cp -R "$APP_PATH" "$DMG_DIR/"
ln -sf /Applications "$DMG_DIR/Applications"

if [[ -n "$VERSION" ]]; then
  DMG_OUTPUT="$BUILD_DIR/Waqtu-${VERSION}.dmg"
  DMG_VOLUME_NAME="Waqtu $VERSION"
else
  DMG_OUTPUT="$PROJECT_DIR/Waqtu.dmg"
fi

echo " Creating DMG..."
rm -f "$DMG_OUTPUT"
hdiutil create -volname "$DMG_VOLUME_NAME" -srcfolder "$DMG_DIR" -ov -format UDZO "$DMG_OUTPUT"

echo " Done: $DMG_OUTPUT"
