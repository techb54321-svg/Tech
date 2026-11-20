#!/usr/bin/env bash
# Installs the app on an emulated phone, opens an app on his list, and checks
# that the little guy turns up and the phone ends up back on the home screen.
#
#   ci/try-on-emulator.sh path/to/app-debug.apk
#
# It needs the debug build, because that is the one adb is allowed to configure.
set -euo pipefail

APK="$1"
HERE="$(cd "$(dirname "$0")" && pwd)"
APP=com.scrollbouncer.app
TARGET=com.android.settings          # a stock app to stand in for Instagram
IMAGE="system-images;android-34;google_apis;x86_64"
SDK="${ANDROID_HOME:?ANDROID_HOME is not set}"
export PATH="$SDK/cmdline-tools/latest/bin:$SDK/platform-tools:$SDK/emulator:$PATH"

echo "== Starting an emulated phone"
yes | sdkmanager --install "$IMAGE" emulator platform-tools > /dev/null
echo no | avdmanager create avd --force -n phone -k "$IMAGE" -d pixel_6 > /dev/null
emulator -avd phone -no-window -no-audio -no-boot-anim -no-snapshot -gpu swiftshader_indirect > emulator.log 2>&1 &
adb wait-for-device
timeout 900 bash -c 'until [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d "\r")" = "1" ]; do sleep 3; done'
adb shell input keyevent 82 || true
sleep 5

echo "== Installing and setting up"
adb install -r "$APK"
adb shell "run-as $APP mkdir -p shared_prefs"
printf '%s\n' "<?xml version='1.0' encoding='utf-8' standalone='yes' ?>" \
  "<map><set name=\"apps\"><string>$TARGET</string></set></map>" \
  | adb shell "run-as $APP sh -c 'cat > shared_prefs/scroll-bouncer.xml'"
adb shell settings put secure enabled_accessibility_services "$APP/$APP.BouncerService"
adb shell settings put secure accessibility_enabled 1
sleep 5
adb shell input keyevent KEYCODE_HOME
sleep 3

echo "== Opening an app on his list and watching the screen"
mkdir -p shots
adb logcat -c
adb shell am start -a android.settings.SETTINGS > /dev/null
START=$(date +%s.%N)
for i in $(seq -w 1 16); do
  adb exec-out screencap -p > "shots/$i.png"
  printf '%s %.1f\n' "$i" "$(echo "$(date +%s.%N) - $START" | bc)" >> shots/times.txt
  sleep 0.6
done
sleep 4

FOCUS="$(adb shell dumpsys window | grep -m1 mCurrentFocus || true)"
adb logcat -d -s ScrollBouncer:V AndroidRuntime:E chromium:E > log.txt || true
adb shell "run-as $APP cat shared_prefs/scroll-bouncer.xml" > prefs.xml || true

echo "== What the app logged"
cat log.txt
echo "== In front afterwards: $FOCUS"
echo "== His count"
cat prefs.xml
echo "== What was on screen"
python3 "$HERE/read-screens.py" shots

fail() { echo "FAILED: $1"; exit 1; }
grep -q "on stage" log.txt || fail "he never went on"
grep -q "dark, sent home: true" log.txt || fail "the screen never went dark"
grep -q "off stage" log.txt || fail "he never left"
grep -q "FATAL EXCEPTION" log.txt && fail "the app crashed"
echo "$FOCUS" | grep -q "$TARGET" && fail "the app he was meant to close is still in front"
grep -q 'name="total" value="1"' prefs.xml || fail "the close was not counted"
echo "PASSED"
