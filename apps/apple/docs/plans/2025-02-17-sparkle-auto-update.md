# Sparkle Auto-Update Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Set up server-side components and configuration for Sparkle auto-updates in the Waqt prayer time macOS app.

**Architecture:** EdDSA code signing for security, Cloudflare Worker serving appcast.xml feed, Cloudflare R2 hosting signed .dmg files, Xcode build configuration pointing to feed URL and public key.

**Tech Stack:** Sparkle 2.8.1, Cloudflare Workers, Cloudflare R2, Swift Package Manager, Xcode

---

## Prerequisites

- Cloudflare account with Workers and R2 enabled
- GitHub repository for version tagging
- Existing Sparkle integration in app (already in place)

---

### Task 1: Generate EdDSA Signing Keys

**Files:**
- Create: `~/PrivateKeys/sparkle_private_key` (local only, never commit)
- Create: `waqtu/Resources/public_ed25519.pem`

**Step 1: Build Sparkle's generate_keys tool**

```bash
cd build/DerivedData/SourcePackages/checkouts/Sparkle/generate_keys
swift build
```

**Step 2: Generate the key pair**

```bash
swift run
```

Expected output: Two files created - `private_key` and `public_key`

**Step 3: Move private key to secure location**

```bash
mkdir -p ~/PrivateKeys
mv private_key ~/PrivateKeys/sparkle_private_key
chmod 600 ~/PrivateKeys/sparkle_private_key
```

**Step 4: Create Resources directory in app bundle**

```bash
mkdir -p waqtu/Resources
```

**Step 5: Copy public key to app Resources**

```bash
cp public_key waqtu/Resources/public_ed25519.pem
```

**Step 6: Add public key file to Xcode project**

Open Xcode:
1. Select `waqtu` project
2. Select `waqtu` target
3. Go to "Build Phases" → "Copy Bundle Resources"
4. Click "+" and add `waqtu/Resources/public_ed25519.pem`

**Step 7: Clean up temporary public_key file**

```bash
rm public_key
```

**Step 8: Commit public key**

```bash
git add waqtu/Resources/public_ed25519.pem waqt.xcodeproj
git commit -m "feat: add Sparkle public key for update verification"
```

---

### Task 2: Configure Xcode Build Settings

**Files:**
- Modify: `waqt.xcodeproj/project.pbxproj`

**Step 1: Get the base64-encoded public key**

```bash
cat waqtu/Resources/public_ed25519.pem | base64
```

Expected output: Base64 string (keep for next step)

**Step 2: Open Xcode and add SUFeedURL build setting**

In Xcode:
1. Select `waqtu` project → `waqtu` target
2. Go to "Build Settings" tab
3. Click "+" → "Add User-Defined Setting"
4. Name: `SUFeedURL`
5. Value: `https://waqt-updates.YOUR_SUBDOMAIN.workers.dev/appcast.xml`
   (Replace YOUR_SUBDOMAIN with your actual Worker subdomain)

**Step 3: Add SUPublicEDKey build setting**

In Xcode (same location):
1. Click "+" → "Add User-Defined Setting"
2. Name: `SUPublicEDKey`
3. Value: [paste base64 string from Step 1]

**Step 4: Verify Info.plist includes these values**

In Xcode:
1. Select `waqtu/Info.plist`
2. Add entries if not present:
   - Key: `SUFeedURL`, Type: String, Value: $(SUFeedURL)
   - Key: `SUPublicEDKey`, Type: String, Value: $(SUPublicEDKey)

**Step 5: Commit**

```bash
git add waqt.xcodeproj
git commit -m "feat: configure Sparkle feed URL and public key in build settings"
```

---

### Task 3: Create Cloudflare Worker

**Files:**
- Create: `cloudflare-worker/worker.ts`
- Create: `cloudflare-worker/wrangler.toml`
- Create: `cloudflare-worker/package.json`

**Step 1: Create worker directory**

```bash
mkdir -p cloudflare-worker
cd cloudflare-worker
```

**Step 2: Initialize npm project**

```bash
npm init -y
```

**Step 3: Create wrangler.toml**

```toml
name = "waqt-updates"
main = "worker.ts"
compatibility_date = "2024-01-01"

[vars]
ENVIRONMENT = "production"
```

**Step 4: Create worker.ts with appcast endpoint**

```typescript
interface AppcastItem {
  title: string;
  version: string;
  shortVersionString: string;
  description: string;
  pubDate: string;
  enclosureUrl: string;
  edSignature: string;
  length: number;
}

function generateAppcast(items: AppcastItem[]): string {
  const itemsXml = items.map(item => `
    <item>
      <title>${item.title}</title>
      <sparkle:version>${item.version}</sparkle:version>
      <sparkle:shortVersionString>${item.shortVersionString}</sparkle:shortVersionString>
      <description>${item.description}</description>
      <pubDate>${item.pubDate}</pubDate>
      <enclosure
        url="${item.enclosureUrl}"
        sparkle:edSignature="${item.edSignature}"
        sparkle:version="${item.version}"
        length="${item.length}"
        type="application/octet-stream"
      />
    </item>`).join('');

  return `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>Waqt App Updates</title>
    <link>https://waqt-updates.YOUR_SUBDOMAIN.workers.dev/</link>
    <description>Most recent Waqt releases with automatic updates.</description>
    <language>en</language>
    ${itemsXml}
  </channel>
</rss>`;
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Serve appcast.xml at root or /appcast path
    if (url.pathname === '/' || url.pathname === '/appcast.xml') {
      // For now, return a placeholder - will be replaced with KV/R2 binding
      const appcast = generateAppcast([{
        title: "Version 1.0.0",
        version: "1.0.0",
        shortVersionString: "1.0.0",
        description: "Initial release with prayer time notifications.",
        pubDate: new Date().toUTCString(),
        enclosureUrl: "https://YOUR_R2_BUCKET.r2.dev/Waqt-1.0.0.dmg",
        edSignature: "PLACEHOLDER_SIGNATURE",
        length: 0
      }]);

      return new Response(appcast, {
        headers: {
          'Content-Type': 'application/xml; charset=utf-8',
          'Cache-Control': 'public, max-age=600'
        }
      });
    }

    return new Response('Not found', { status: 404 });
  }
};
```

**Step 5: Update package.json with build script**

```bash
cat > package.json << 'EOF'
{
  "name": "waqt-updates-worker",
  "version": "1.0.0",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy"
  },
  "devDependencies": {
    "wrangler": "^3.0.0"
  }
}
EOF
```

**Step 6: Install dependencies**

```bash
npm install
```

**Step 7: Test worker locally**

```bash
npx wrangler dev
```

Expected: Worker running at http://localhost:8787

**Step 8: Test the endpoint**

In another terminal:

```bash
curl http://localhost:8787/appcast.xml
```

Expected: XML response with appcast structure

**Step 9: Commit**

```bash
cd ..
git add cloudflare-worker/
git commit -m "feat: add Cloudflare Worker for Sparkle appcast feed"
```

---

### Task 4: Deploy Cloudflare Worker

**Files:**
- None (deployment only)

**Step 1: Authenticate with Cloudflare**

```bash
npx wrangler login
```

Expected: Browser opens for authentication

**Step 2: Deploy the worker**

```bash
cd cloudflare-worker
npx wrangler deploy
```

Expected output: Worker URL displayed

**Step 3: Note the Worker URL**

Copy the URL from output, e.g.,:
`https://waqt-updates.YOUR_SUBDOMAIN.workers.dev`

**Step 4: Test the deployed worker**

```bash
curl https://waqt-updates.YOUR_SUBDOMAIN.workers.dev/appcast.xml
```

Expected: XML response

**Step 5: Update Xcode SUFeedURL if needed**

If the deployed URL differs from what you set in Task 2, update the `SUFeedURL` build setting in Xcode.

**Step 6: Commit any changes**

```bash
cd ..
git add cloudflare-worker/wrangler.toml
git commit -m "chore: update Worker URL in wrangler.toml" || echo "No changes to commit"
```

---

### Task 5: Set Up Cloudflare R2 Bucket

**Files:**
- None (R2 setup only)

**Step 1: Create R2 bucket**

```bash
npx wrangler r2 bucket create waqt-releases
```

Expected: Bucket created confirmation

**Step 2: Verify bucket creation**

```bash
npx wrangler r2 bucket list
```

Expected: `waqt-releases` in list

---

### Task 6: Create Release Automation Script

**Files:**
- Create: `scripts/release.sh`

**Step 1: Create scripts directory**

```bash
mkdir -p scripts
```

**Step 2: Create release.sh script**

```bash
cat > scripts/release.sh << 'EOF'
#!/bin/bash
set -e

# Configuration
VERSION="${1:-}"
PRIVATE_KEY="$HOME/PrivateKeys/sparkle_private_key"
R2_BUCKET="waqt-releases"
WORKER_DIR="cloudflare-worker"
BUILD_DIR="build"
DMG_NAME="Waqt-$VERSION.dmg"

if [ -z "$VERSION" ]; then
  echo "Usage: ./scripts/release.sh VERSION"
  echo "Example: ./scripts/release.sh 1.0.1"
  exit 1
fi

echo "Releasing Waqt version $VERSION..."

# Step 1: Build the DMG
echo "Building DMG..."
./build-dmg

# Step 2: Sign the DMG with Sparkle
echo "Signing DMG..."
SIGNATURE=$(cd build/DerivedData/SourcePackages/checkouts/Sparkle/sign_update && \
  swift run "$BUILD_DIR/$DMG_NAME" "$PRIVATE_KEY")

echo "Signature: $SIGNATURE"

# Step 3: Get DMG file size
FILE_SIZE=$(stat -f%z "$BUILD_DIR/$DMG_NAME" 2>/dev/null || stat -c%s "$BUILD_DIR/$DMG_NAME")

# Step 4: Upload to R2
echo "Uploading to R2..."
npx wrangler r2 object put "$R2_BUCKET/$DMG_NAME" --file="$BUILD_DIR/$DMG_NAME"

# Step 5: Update appcast.xml in Worker
echo "Updating appcast..."
# This is a placeholder - you'll need to implement the actual update logic
# based on how you store the appcast (KV, R2, or static)

# Step 6: Deploy updated Worker
echo "Deploying Worker..."
cd "$WORKER_DIR"
npx wrangler deploy
cd ..

# Step 7: Create and push git tag
echo "Creating git tag..."
git tag -a "v$VERSION" -m "Release version $VERSION"
git push origin "v$VERSION"

echo "Release $VERSION complete!"
EOF
```

**Step 3: Make script executable**

```bash
chmod +x scripts/release.sh
```

**Step 4: Commit**

```bash
git add scripts/release.sh
git commit -m "feat: add release automation script for Sparkle updates"
```

---

### Task 7: Create First Release

**Files:**
- None (execution only)

**Step 1: Update appcast.xml with real values**

Edit `cloudflare-worker/worker.ts`:
- Replace `YOUR_SUBDOMAIN` with actual Worker subdomain
- Replace `YOUR_R2_BUCKET` with actual R2 public URL
- Set appropriate version info

**Step 2: Deploy updated Worker**

```bash
cd cloudflare-worker
npx wrangler deploy
cd ..
```

**Step 3: Build and test the release**

```bash
./scripts/release.sh 1.0.0
```

Expected: DMG built, signed, uploaded to R2

**Step 4: Verify appcast returns valid data**

```bash
curl https://waqt-updates.YOUR_SUBDOMAIN.workers.dev/appcast.xml
```

Expected: Valid XML with your version info

**Step 5: Test in-app update check**

1. Build and run Waqt app in Xcode
2. Click "Check for Updates…" in app menu
3. Verify no errors (should show "No new version available" since you're on 1.0.0)

**Step 6: Commit Worker URL updates**

```bash
git add cloudflare-worker/
git commit -m "chore: update Worker URLs for production"
```

---

### Task 8: Test Update Flow (End-to-End)

**Files:**
- Modify: `waqtu/Resources/public_ed25519.pem` (temporarily for testing)

**Step 1: Increment version for testing**

In Xcode:
1. Select `waqtu` project → `waqtu` target
2. Set "Marketing Version" to `1.0.1`

**Step 2: Create test release**

```bash
./scripts/release.sh 1.0.1
```

**Step 3: Revert to 1.0.0 in Xcode**

Set marketing version back to `1.0.0`

**Step 4: Build and run app**

Build and run from Xcode

**Step 5: Trigger update check**

In app menu: "Check for Updates…"

Expected: Update available dialog appears

**Step 6: Clean up test data**

After testing, you may want to remove test releases from R2.

---

## Verification Checklist

After completing all tasks:

- [ ] Private key exists at `~/PrivateKeys/sparkle_private_key` and is not in git
- [ ] Public key is in Xcode bundle resources
- [ ] `SUFeedURL` and `SUPublicEDKey` are configured in Xcode build settings
- [ ] Cloudflare Worker is deployed and returns valid XML
- [ ] R2 bucket is created and accessible
- [ ] Release script runs without errors
- [ ] First release (1.0.0) is uploaded to R2
- [ ] In-app "Check for Updates" works without errors
- [ ] Update flow shows update dialog when new version available

---

## Notes

- **Never commit** the private key (`~/PrivateKeys/sparkle_private_key`)
- The Worker currently serves a hardcoded appcast - for production, consider storing version info in Cloudflare KV or R2 for easier updates
- Update the appcast in Worker to include proper release notes for each version
- Consider adding automatic release notes from git commits
- The DMG signing requires the Sparkle `sign_update` tool - ensure its path is correct in the release script
