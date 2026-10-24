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
out=$(cd "$out" && pwd)
cd "$out"
for locale in id en; do
  # Up to three tries per language: a stuck emulator or a lost deep link should not sink the run.
  # Each try keeps its own output folder (logs and failure screenshots); screenshots are collected from the one that passed.
  for attempt in 1 2 3; do
    dir="$out/maestro-$locale-$attempt"
    if maestro --device "$udid" test -e APP_ID="$app_id" -e LOCALE="$locale" --test-output-dir "$dir" "$flow"; then
      find "$dir" -name "$locale-*.png" -exec cp {} "$out/" \;
      break
    fi
    [ "$attempt" -lt 3 ] || exit 1
  done
done
xcrun simctl list devices | grep "$udid" | tee device.txt
ls -l
