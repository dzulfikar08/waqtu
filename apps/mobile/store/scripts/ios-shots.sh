#!/usr/bin/env bash
# Boots a 6.9" iPhone simulator, installs the demo .app and captures every store screenshot in id and en.
# Usage: ios-shots.sh <Waqtu.app> <output dir> [APP_ID]
set -euo pipefail

app=$1
out=$2
app_id=${3:-dat.waqtu.ios}
flow="$(cd "$(dirname "$0")/.." && pwd)/maestro/screens.yaml"

# Newest "Pro Max" iPhone among the installed runtimes (1320x2868 = the 6.9" App Store size).
udid=$(xcrun simctl list devices available -j | jq -r '
  [.devices | to_entries[] | select(.key | test("iOS")) | .value[] | select(.name | test("^iPhone [0-9]+ Pro Max$"))]
  | sort_by(.name | capture("(?<n>[0-9]+)").n | tonumber) | last | .udid')
test -n "$udid" && [ "$udid" != null ]
xcrun simctl boot "$udid" || true
xcrun simctl bootstatus "$udid" -b
xcrun simctl status_bar "$udid" override --time 9:41 --batteryState charged --batteryLevel 100 \
  --cellularMode active --cellularBars 4 --wifiMode active --wifiBars 3
xcrun simctl install "$udid" "$app"

mkdir -p "$out"
cd "$out"
for locale in id en; do
  maestro --device "$udid" test -e APP_ID="$app_id" -e LOCALE="$locale" "$flow"
done
xcrun simctl list devices | grep "$udid" | tee device.txt
ls -l
