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
