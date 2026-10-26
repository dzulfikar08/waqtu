#!/bin/bash
set -euo pipefail

# Signs a built (unsigned) waqtu.app inside-out: Sparkle's nested code, the widget extension, then
# the app. Each of the app and the widget embeds its own provisioning profile, which Sign in with
# Apple and iCloud require. Developer ID by default; the Mac App Store build (release-mas.yml) passes
# its Apple Distribution identity, App Store profiles and APP_ENTITLEMENTS.
#
# usage: sign-app.sh APP_PATH IDENTITY
# env:   PROVISIONING_PROFILE_PATH         profile for dat.waqtu
#        WIDGET_PROVISIONING_PROFILE_PATH  profile for dat.waqtu.mac-widget
#        APP_ENTITLEMENTS                  app entitlements (default waqtu/waqtu.entitlements)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
APP="$1"
IDENTITY="$2"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

sign() { codesign --force --timestamp --options runtime --sign "$IDENTITY" "$@"; }

# Sparkle ships pre-signed by its authors; re-sign with ours, deepest code first.
SPARKLE="$APP/Contents/Frameworks/Sparkle.framework"
if [[ -d "$SPARKLE" ]]; then
  while IFS= read -r xpc; do
    sign --preserve-metadata=entitlements "$xpc"
  done < <(find "$SPARKLE" -type d -name "*.xpc")
  while IFS= read -r tool; do
    sign --preserve-metadata=entitlements "$tool"
  done < <(find "$SPARKLE" -type f -name "Autoupdate")
  while IFS= read -r updater; do
    sign --preserve-metadata=entitlements "$updater"
  done < <(find "$SPARKLE" -type d -name "Updater.app")
  sign "$SPARKLE"
fi

# Widget extension(s)
if [[ -d "$APP/Contents/PlugIns" ]]; then
  while IFS= read -r appex; do
    if [[ -n "${WIDGET_PROVISIONING_PROFILE_PATH:-}" ]]; then
      cp "$WIDGET_PROVISIONING_PROFILE_PATH" "$appex/Contents/embedded.provisionprofile"
    fi
    python3 "$SCRIPT_DIR/make-entitlements.py" "$PROJECT_DIR/macos-widget/macos-widget.entitlements" \
      "$TMP/widget.entitlements" "dat.waqtu.mac-widget" ${WIDGET_PROVISIONING_PROFILE_PATH:+"$WIDGET_PROVISIONING_PROFILE_PATH"}
    sign --entitlements "$TMP/widget.entitlements" "$appex"
  done < <(find "$APP/Contents/PlugIns" -maxdepth 1 -type d -name "*.appex")
fi

# The app
if [[ -n "${PROVISIONING_PROFILE_PATH:-}" ]]; then
  cp "$PROVISIONING_PROFILE_PATH" "$APP/Contents/embedded.provisionprofile"
fi
python3 "$SCRIPT_DIR/make-entitlements.py" "${APP_ENTITLEMENTS:-$PROJECT_DIR/waqtu/waqtu.entitlements}" \
  "$TMP/app.entitlements" "dat.waqtu" ${PROVISIONING_PROFILE_PATH:+"$PROVISIONING_PROFILE_PATH"}
sign --entitlements "$TMP/app.entitlements" "$APP"

codesign --verify --deep --strict --verbose=2 "$APP"
echo "--- entitlements: app"
codesign -d --entitlements :- "$APP"
while IFS= read -r appex; do
  echo "--- entitlements: $(basename "$appex")"
  codesign -d --entitlements :- "$appex"
done < <(find "$APP/Contents/PlugIns" -maxdepth 1 -type d -name "*.appex" 2>/dev/null)
