#!/bin/bash
set -e

# Configuration
VERSION="${1:-}"
PRIVATE_KEY_LABEL="sparkle"  # Keychain item name created by generate_keys
R2_BUCKET="waqt-releases"
WORKER_DIR="cloudflare-worker"
BUILD_DIR="build"
DMG_NAME="Waqt-$VERSION.dmg"
SPARKLE_SIGN_TOOL="build/DerivedData/SourcePackages/checkouts/Sparkle/.build/artifacts/sparkle/Sparkle/bin/sign_update"

if [ -z "$VERSION" ]; then
  echo "Usage: ./scripts/release.sh VERSION"
  echo "Example: ./scripts/release.sh 1.0.1"
  exit 1
fi

echo "Releasing Waqt version $VERSION..."

# Check if sign_update tool exists
if [ ! -f "$SPARKLE_SIGN_TOOL" ]; then
  echo "Error: Sparkle sign_update tool not found at $SPARKLE_SIGN_TOOL"
  echo "Make sure Sparkle is properly checked out and built."
  exit 1
fi

# Step 1: Build the DMG
echo "Building DMG..."
if [ -f "./build-dmg" ]; then
  ./build-dmg
else
  echo "Error: build-dmg script not found. Please build the DMG manually first."
  exit 1
fi

# Check if DMG was created
if [ ! -f "$BUILD_DIR/$DMG_NAME" ]; then
  echo "Error: DMG file not found at $BUILD_DIR/$DMG_NAME"
  echo "The build-dmg script may have created it elsewhere. Please check and update BUILD_DIR."
  exit 1
fi

# Step 2: Sign the DMG with Sparkle
echo "Signing DMG..."
SIGNATURE=$("$SPARKLE_SIGN_TOOL" "$BUILD_DIR/$DMG_NAME")

echo "Signature: $SIGNATURE"

# Step 3: Get DMG file size
FILE_SIZE=$(stat -f%z "$BUILD_DIR/$DMG_NAME" 2>/dev/null || stat -c%s "$BUILD_DIR/$DMG_NAME")
echo "DMG size: $FILE_SIZE bytes"

# Step 4: Upload to R2
echo "Uploading to R2..."
npx wrangler r2 object put "$R2_BUCKET/$DMG_NAME" --file="$BUILD_DIR/$DMG_NAME"

echo "✓ Uploaded to R2: $DMG_NAME"

# Step 5: Print update info for Worker
echo ""
echo "========================================="
echo "UPDATE THE FOLLOWING IN cloudflare-worker/worker.ts:"
echo "========================================="
echo "  enclosureUrl: \"https://YOUR_R2_BUCKET_URL/$DMG_NAME\""
echo "  edSignature: \"$SIGNATURE\""
echo "  length: $FILE_SIZE"
echo "  version: \"$VERSION\""
echo "========================================="
echo ""
echo "After updating worker.ts, run: cd $WORKER_DIR && npx wrangler deploy"
echo ""

# Step 6: Ask about git tag
read -p "Create and push git tag v$VERSION? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  git tag -a "v$VERSION" -m "Release version $VERSION"
  git push origin "v$VERSION"
  echo "✓ Tag v$VERSION created and pushed"
fi

echo ""
echo "Release $VERSION preparation complete!"
echo "Next steps:"
echo "  1. Update cloudflare-worker/worker.ts with the info above"
echo "  2. Deploy: cd $WORKER_DIR && npx wrangler deploy"
echo "  3. Test the update in your app"
