#!/usr/bin/env bash
# Boots a 6.9" iPhone simulator, installs the demo .app and captures every store screenshot in id and en (light
# appearance), then the design review shots in <output dir>/review/{dark,light}: the store screens in dark plus
# review.yaml in both appearances.
# Usage: ios-shots.sh <Waqtu.app> <output dir> [APP_ID]
set -euo pipefail

app=$1
out=$2
app_id=${3:-dat.waqtu.ios}
maestro_dir="$(cd "$(dirname "$0")/.." && pwd)/maestro"
flow="$maestro_dir/screens.yaml"

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
# Store screenshots are the light appearance.
xcrun simctl ui "$udid" appearance light

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
# Design review: best effort, never fails the store screenshots above.
review() {
  local theme=$1 file=$2 dest="$out/review/$1"
  xcrun simctl ui "$udid" appearance "$theme"
  mkdir -p "$dest"
  for attempt in 1 2; do
    dir="$dest/maestro-$(basename "$file" .yaml)-$attempt"
    if maestro --device "$udid" test -e APP_ID="$app_id" -e LOCALE=en --test-output-dir "$dir" "$file"; then
      find "$dir" -name "en-*.png" -exec cp {} "$dest/" \;
      return 0
    fi
  done
  echo "::warning::review shots ($theme, $(basename "$file")) failed"
}
review dark "$flow"
review dark "$maestro_dir/review.yaml"
review light "$maestro_dir/review.yaml"
xcrun simctl ui "$udid" appearance light

xcrun simctl list devices | grep "$udid" | tee device.txt
ls -l
