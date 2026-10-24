#!/usr/bin/env bash
# Installs the demo APK on the running emulator and captures every store screenshot in id and en.
# Usage: android-shots.sh <apk> <output dir> [APP_ID]
set -euo pipefail

apk=$1
out=$2
app_id=${3:-dat.waqtu.app}
flow="$(cd "$(dirname "$0")/.." && pwd)/maestro/screens.yaml"

adb wait-for-device
adb install -r "$apk"

# A slow CI emulator can trip "Pixel Launcher isn't responding"; never let a system dialog cover a screenshot.
adb shell settings put global hide_error_dialogs 1

# Clean status bar: 9:41, full battery and signal, no notifications.
adb shell settings put global sysui_demo_allowed 1
adb shell am broadcast -a com.android.systemui.demo -e command enter
adb shell am broadcast -a com.android.systemui.demo -e command clock -e hhmm 0941
adb shell am broadcast -a com.android.systemui.demo -e command battery -e level 100 -e plugged false
adb shell am broadcast -a com.android.systemui.demo -e command network -e wifi show -e level 4
adb shell am broadcast -a com.android.systemui.demo -e command notifications -e visible false

mkdir -p "$out"
# On failure keep what the screen and the app said, so the artifact explains it.
trap 'adb exec-out screencap -p > "$out/failure.png" || true; adb logcat -d > "$out/logcat.txt" || true' ERR
out=$(cd "$out" && pwd)
cd "$out"
for locale in id en; do
  # Up to three tries per language: a stuck emulator or a lost deep link should not sink the run.
  # Each try keeps its own output folder (logs and failure screenshots); screenshots are collected from the one that passed.
  for attempt in 1 2 3; do
    dir="$out/maestro-$locale-$attempt"
    if maestro test -e APP_ID="$app_id" -e LOCALE="$locale" --test-output-dir "$dir" "$flow"; then
      find "$dir" -name "$locale-*.png" -exec cp {} "$out/" \;
      break
    fi
    [ "$attempt" -lt 3 ] || exit 1
  done
done
adb shell wm size | tee size.txt
ls -l
