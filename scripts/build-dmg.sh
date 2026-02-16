#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SCHEME="waqtu"
APP_NAME="waqtu"
BUILD_DIR="$PROJECT_DIR/build"
DMG_DIR="$BUILD_DIR/dmg"
DMG_NAME="Waqtu"

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

# Copy app to DMG staging
cp -R "$APP_PATH" "$DMG_DIR/"

# Create Applications symlink
ln -sf /Applications "$DMG_DIR/Applications"

echo " Creating DMG..."
DMG_OUTPUT="$PROJECT_DIR/${DMG_NAME}.dmg"
rm -f "$DMG_OUTPUT"

hdiutil create -volname "$DMG_NAME" -srcfolder "$DMG_DIR" -ov -format UDZO "$DMG_OUTPUT"

echo " Done: $DMG_OUTPUT"
