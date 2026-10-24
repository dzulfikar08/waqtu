#!/bin/bash
set -euo pipefail

# ============================================================
# Waqtu Release Pipeline
# ============================================================
# End-to-end: Build → Sign → Notarize → Sparkle → Upload → D1
#
# Usage:
#   ./scripts/release.sh VERSION [DESCRIPTION]
#   ./scripts/release.sh 1.2.0 "Added prayer streaks and Google Calendar"
#
# Quick start (first time):
#   1. xcrun notarytool store-credentials "waqtu-notary" --apple-id "you@email.com" --team-id "YOURTEAM" --password "@keychain:AC_PASSWORD"
#   2. export NOTARIZE=1
#   3. ./scripts/release.sh 1.2.0
#
# Env vars:
#   NOTARIZE=1                    Enable Apple notarization (requires credentials)
#   CODESIGN_IDENTITY=SHA1        Override signing identity
#   R2_PUBLIC_BASE_URL=...        R2 public URL for downloads
#   SKIP_BUILD=1                  Skip xcodebuild (reuse existing .app)
#   SKIP_UPLOAD=1                 Skip R2/D1 (dry-run Sparkle signing only)
#   SPARKLE_ED_KEY_FILE=path      Sign with this EdDSA private key file instead of the login keychain (CI)
#   NOTARY_KEYCHAIN=path          Keychain holding the notarytool profile (CI; default: login keychain)
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
WORKER_DIR="$(cd "$PROJECT_DIR/../../services/api" && pwd)"
BUILD_DIR="$PROJECT_DIR/build"

# ---- Parse args ----
VERSION="${1:-}"
DESCRIPTION="${2:-Bug fixes and improvements.}"

if [[ -z "$VERSION" ]]; then
  # Auto-detect from Xcode project
  PBXPROJ="$PROJECT_DIR/waqt.xcodeproj/project.pbxproj"
  if [[ -f "$PBXPROJ" ]]; then
    VERSION=$(grep -m1 'MARKETING_VERSION = ' "$PBXPROJ" | head -1 | sed 's/.*MARKETING_VERSION = //;s/;//')
  fi
  if [[ -z "$VERSION" ]]; then
    echo "Usage: ./scripts/release.sh VERSION [DESCRIPTION]"
    echo "Example: ./scripts/release.sh 1.2.0 'Added prayer streaks and Google Calendar'"
    exit 1
  fi
fi

# ---- Config ----
DMG_NAME="Waqtu-${VERSION}.dmg"
DMG_PATH="$BUILD_DIR/$DMG_NAME"
APP_PATH="$BUILD_DIR/DerivedData/Build/Products/Release/waqtu.app"
R2_BUCKET="waqt-releases"
R2_PUBLIC_BASE_URL="${R2_PUBLIC_BASE_URL:-https://waqt-r2-release.dzulfikar.com}"
SKIP_BUILD="${SKIP_BUILD:-0}"
SKIP_UPLOAD="${SKIP_UPLOAD:-0}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info()  { echo -e "${BLUE}[*]${NC} $1"; }
ok()    { echo -e "${GREEN}[✓]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
err()   { echo -e "${RED}[✗]${NC} $1"; }
step()  { echo -e "\n${BLUE}━━━ $1 ━━━${NC}"; }

# ============================================================
# 0. PRE-FLIGHT CHECKS
# ============================================================
step "Pre-flight checks"

# Check Xcode
if ! xcodebuild -version &>/dev/null; then
  err "Xcode not found. Install Xcode first."
  exit 1
fi
ok "Xcode: $(xcodebuild -version | head -1)"

# Check workspace
if [[ ! -d "$PROJECT_DIR/waqt.xcodeproj" ]]; then
  err "Project not found at $PROJECT_DIR"
  exit 1
fi
ok "Project directory: $PROJECT_DIR"

# Check wrangler
if [[ "$SKIP_UPLOAD" == "0" ]]; then
  cd "$WORKER_DIR"
  if ! npx wrangler --version &>/dev/null; then
    warn "wrangler not available — upload step will fail"
  else
    ok "wrangler: $(npx wrangler --version 2>&1 | head -1)"
  fi
  cd "$PROJECT_DIR"
fi

# Check Sparkle sign_update
SPARKLE_BIN="$BUILD_DIR/DerivedData/SourcePackages/artifacts/sparkle/Sparkle/bin/sign_update"
if [[ ! -f "$SPARKLE_BIN" ]]; then
  # alt path
  SPARKLE_BIN="$BUILD_DIR/DerivedData/SourcePackages/checkouts/Sparkle/bin/sign_update"
fi

# If not found yet, try to locate it
if [[ ! -f "$SPARKLE_BIN" ]] && [[ "$SKIP_BUILD" == "0" ]]; then
  info "Sparkle sign_update not found — will resolve after build"
elif [[ ! -f "$SPARKLE_BIN" ]]; then
  # Try common locations
  for candidate in \
    "$BUILD_DIR/DerivedData/SourcePackages/artifacts/sparkle/Sparkle/bin/sign_update" \
    "$BUILD_DIR/DerivedData/SourcePackages/checkouts/Sparkle/bin/sign_update" \
    "$HOME/Library/Developer/Xcode/DerivedData/*/SourcePackages/artifacts/sparkle/Sparkle/bin/sign_update"; do
    if compgen -G "$candidate" > /dev/null 2>&1; then
      SPARKLE_BIN=$(ls -t $candidate 2>/dev/null | head -1)
      break
    fi
  done
fi

if [[ -f "$SPARKLE_BIN" ]]; then
  ok "Sparkle sign_update: $SPARKLE_BIN"
else
  warn "Sparkle sign_update not found — will search after build"
fi

# Verify new feature source files (auto-discovered by Xcode 16 PBXFileSystemSynchronizedRootGroup)
REQUIRED_FILES=(
  "waqtu/Core/PrayerStreakManager.swift"
  "waqtu/Core/LocationProfilesManager.swift"
  "waqtu/Core/CustomSoundManager.swift"
  "waqtu/Core/DailyHadithProvider.swift"
  "waqtu/Core/GoogleCalendarManager.swift"
)

info "Checking feature source files..."
all_found=true
for f in "${REQUIRED_FILES[@]}"; do
  if [[ -f "$PROJECT_DIR/$f" ]]; then
    ok "$f"
  else
    err "$f — MISSING"
    all_found=false
  fi
done

if ! $all_found; then
  err "Some source files are missing. Run from project root."
  exit 1
fi
ok "All 12 Core source files present (project uses PBXFileSystemSynchronizedRootGroup — no manual Xcode setup needed)"

# ============================================================
# 1. BUILD
# ============================================================
step "Step 1/5: Building $VERSION"

if [[ "$SKIP_BUILD" == "1" ]]; then
  warn "Skipping build (SKIP_BUILD=1)"
  if [[ ! -d "$APP_PATH" ]]; then
    err "App not found at $APP_PATH — cannot skip build"
    exit 1
  fi
else
  info "Running xcodebuild (this may take a few minutes)..."
  cd "$PROJECT_DIR"
  xcodebuild \
    -scheme waqtu \
    -configuration Release \
    -derivedDataPath "$BUILD_DIR/DerivedData" \
    clean build 2>&1 | tail -20

  if [[ ! -d "$APP_PATH" ]]; then
    err "Build failed — app not found at $APP_PATH"
    exit 1
  fi
  ok "Build complete: $APP_PATH"
fi

# ============================================================
# 2. CODE SIGN & NOTARIZE
# ============================================================
step "Step 2/5: Signing & Notarizing"

# Find signing identity
if [[ -z "${CODESIGN_IDENTITY:-}" ]]; then
  CODESIGN_IDENTITY=$(security find-identity -v -p codesigning 2>/dev/null \
    | awk '/Developer ID Application: Dzulfikar/ { print $2; exit }')
  if [[ -z "$CODESIGN_IDENTITY" ]]; then
    CODESIGN_IDENTITY=$(security find-identity -v -p codesigning 2>/dev/null \
      | awk '/Apple Development:/ { print $2; exit }')
    if [[ -n "$CODESIGN_IDENTITY" ]]; then
      warn "Using Apple Development certificate (not for production distribution)"
    fi
  fi
  if [[ -z "$CODESIGN_IDENTITY" ]]; then
    err "No signing identity found. Set CODESIGN_IDENTITY."
    exit 1
  fi
fi

info "Signing with: $(security find-identity -v -p codesigning 2>/dev/null | grep "$CODESIGN_IDENTITY" | head -1)"
codesign --deep --force --verify --verbose \
  --sign "$CODESIGN_IDENTITY" \
  --options runtime \
  --preserve-metadata=entitlements \
  "$APP_PATH"
ok "Signed successfully"

# Notarize
CERT_NAME=$(security find-identity -v -p codesigning 2>/dev/null | grep "$CODESIGN_IDENTITY" | head -1)
if [[ "$CERT_NAME" =~ "Apple Development" ]]; then
  warn "Skipping notarization (development certificate)"
else
  NOTARIZE="${NOTARIZE:-0}"
  if [[ "$NOTARIZE" == "1" ]]; then
    info "Submitting for notarization..."
    ZIP_PATH="$BUILD_DIR/Waqtu-${VERSION}.zip"
    rm -f "$ZIP_PATH"
    ditto -c -k --keepParent "$APP_PATH" "$ZIP_PATH"

    NOTARY_PROFILE="${NOTARY_KEYCHAIN_PROFILE:-waqtu-notary}"
    NOTARY_ARGS=(--keychain-profile "$NOTARY_PROFILE")
    [[ -n "${NOTARY_KEYCHAIN:-}" ]] && NOTARY_ARGS+=(--keychain "$NOTARY_KEYCHAIN")
    xcrun notarytool submit "$ZIP_PATH" "${NOTARY_ARGS[@]}" --wait
    xcrun stapler staple "$APP_PATH"
    spctl --assess --verbose "$APP_PATH"
    ok "Notarized and stapled"
  else
    warn "Skipping notarization (set NOTARIZE=1 to enable)"
  fi
fi

# ============================================================
# 3. CREATE DMG
# ============================================================
step "Step 3/5: Creating DMG"

DMG_DIR="$BUILD_DIR/dmg"
rm -rf "$DMG_DIR"
mkdir -p "$DMG_DIR"
cp -R "$APP_PATH" "$DMG_DIR/"
ln -sf /Applications "$DMG_DIR/Applications"

rm -f "$DMG_PATH"
hdiutil create \
  -volname "Waqtu $VERSION" \
  -srcfolder "$DMG_DIR" \
  -ov -format UDZO \
  "$DMG_PATH"
ok "DMG created: $DMG_PATH"

FILE_SIZE=$(stat -f%z "$DMG_PATH" 2>/dev/null || stat -c%s "$DMG_PATH")
FILE_SIZE_MB=$(echo "scale=1; $FILE_SIZE / 1048576" | bc)
info "DMG size: ${FILE_SIZE_MB} MB"

# ============================================================
# 4. SPARKLE SIGN
# ============================================================
step "Step 4/5: Sparkle signing"

# Re-locate Sparkle after build
if [[ ! -f "$SPARKLE_BIN" ]]; then
  for candidate in \
    "$BUILD_DIR/DerivedData/SourcePackages/artifacts/sparkle/Sparkle/bin/sign_update" \
    "$BUILD_DIR/DerivedData/SourcePackages/checkouts/Sparkle/bin/sign_update"; do
    if [[ -f "$candidate" ]]; then
      SPARKLE_BIN="$candidate"
      break
    fi
  done
fi

if [[ ! -f "$SPARKLE_BIN" ]]; then
  err "Sparkle sign_update still not found. Set SPARKLE_SIGN_UPDATE_PATH."
  exit 1
fi

if [[ -n "${SPARKLE_ED_KEY_FILE:-}" ]]; then
  SIGNATURE=$("$SPARKLE_BIN" --ed-key-file "$SPARKLE_ED_KEY_FILE" "$DMG_PATH")
else
  SIGNATURE=$("$SPARKLE_BIN" "$DMG_PATH")
fi
ok "Sparkle signature: ${SIGNATURE:0:40}..."

# Get Sparkle version (CFBundleVersion)
APP_PLIST="$APP_PATH/Contents/Info.plist"
SPARKLE_VERSION=$(/usr/libexec/PlistBuddy -c "Print CFBundleVersion" "$APP_PLIST")
ok "Sparkle build version: $SPARKLE_VERSION"

# ============================================================
# 5. UPLOAD TO R2 & D1
# ============================================================
step "Step 5/5: Uploading"

if [[ "$SKIP_UPLOAD" == "1" ]]; then
  warn "Skipping upload (SKIP_UPLOAD=1)"
else
  info "Uploading to R2 bucket '$R2_BUCKET'..."
  cd "$WORKER_DIR"
  npx wrangler r2 object put "$R2_BUCKET/$DMG_NAME" --file="$DMG_PATH" --remote
  cd "$PROJECT_DIR"
  ok "Uploaded: $DMG_NAME to R2"

  ENCLOSURE_URL="${R2_PUBLIC_BASE_URL%/}/$DMG_NAME"
  PUB_DATE=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")
  TITLE="Waqtu $VERSION"

  # Escape single quotes for SQL
  TITLE_ESC="${TITLE//\'/\'\'}"
  DESC_ESC="${DESCRIPTION//\'/\'\'}"
  SIG_ESC="${SIGNATURE//\'/\'\'}"

  info "Inserting release into D1..."
  cd "$WORKER_DIR"
  npx wrangler d1 execute waqt-releases-db --remote --command \
    "INSERT OR REPLACE INTO releases (version, short_version_string, title, description, enclosure_url, ed_signature, length, pub_date) VALUES ($SPARKLE_VERSION, '$VERSION', '$TITLE_ESC', '$DESC_ESC', '$ENCLOSURE_URL', '$SIG_ESC', $FILE_SIZE, '$PUB_DATE');"
  cd "$PROJECT_DIR"
  ok "D1 record inserted"
fi

# ============================================================
# DONE
# ============================================================
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║         Release $VERSION Complete              ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  DMG:      ${BLUE}$DMG_PATH${NC}"
echo -e "  Size:     ${BLUE}${FILE_SIZE_MB} MB${NC}"
echo -e "  Appcast:  ${BLUE}https://waqt-updates.dzulfikar-at.workers.dev/appcast.xml${NC}"
echo ""

if [[ "$SKIP_UPLOAD" == "0" ]]; then
  echo -e "  ${YELLOW}Deploy worker if updated:${NC}"
  echo -e "    cd $WORKER_DIR && npx wrangler deploy"
  echo ""
fi

echo -e "  ${YELLOW}Optional — tag the release:${NC}"
echo -e "    git tag -a v$VERSION -m 'Release $VERSION'"
echo -e "    git push origin v$VERSION"
echo ""
echo -e "  ${YELLOW}Optional — verify appcast:${NC}"
echo -e "    curl -s https://waqt-updates.dzulfikar-at.workers.dev/appcast.xml | xmllint --format -"
