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

# Clean status bar: 9:41, full battery and signal, no notifications.
adb shell settings put global sysui_demo_allowed 1
adb shell am broadcast -a com.android.systemui.demo -e command enter
adb shell am broadcast -a com.android.systemui.demo -e command clock -e hhmm 0941
adb shell am broadcast -a com.android.systemui.demo -e command battery -e level 100 -e plugged false
adb shell am broadcast -a com.android.systemui.demo -e command network -e wifi show -e level 4
adb shell am broadcast -a com.android.systemui.demo -e command notifications -e visible false

mkdir -p "$out"
cd "$out"
for locale in id en; do
  maestro test -e APP_ID="$app_id" -e LOCALE="$locale" "$flow"
done
adb shell wm size | tee size.txt
ls -l
