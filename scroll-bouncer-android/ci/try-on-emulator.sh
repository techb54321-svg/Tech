#!/usr/bin/env bash
# Installs the app on an emulated phone, opens an app on his list, and checks
# that the little guy turns up and the phone ends up back on the home screen.
#
#   ci/try-on-emulator.sh path/to/app-debug.apk [path/to/app-release.apk]
#
# The first part needs the debug build, because that is the one adb is allowed
# to configure. If the release build is given too, it is installed over the top
# and the app's own screen and its preview are tried with that.
set -euo pipefail

APK="$1"
RELEASE="${2:-}"
HERE="$(cd "$(dirname "$0")" && pwd)"
APP=com.scrollbouncer.app
IMAGE="system-images;android-34;google_apis;x86_64"
SDK="${ANDROID_HOME:?ANDROID_HOME is not set}"
export PATH="$SDK/cmdline-tools/latest/bin:$SDK/platform-tools:$SDK/emulator:$PATH"
# Left alone, the tool that creates the phone and the emulator that runs it can look in
# different folders, so tell both where it lives.
export ANDROID_AVD_HOME="$HOME/.android/avd"
mkdir -p "$ANDROID_AVD_HOME"

fail() { echo "FAILED: $1"; exit 1; }

# Takes a run of screenshots into a folder, noting when each was taken.
watch_screen() {
  local folder="$1" count="$2" start ms
  mkdir -p "$folder"
  start=$(date +%s%N)
  for i in $(seq -w 1 "$count"); do
    adb exec-out screencap -p > "$folder/$i.png"
    ms=$(( ($(date +%s%N) - start) / 1000000 ))
    printf '%s %d.%d\n' "$i" "$((ms / 1000))" "$((ms % 1000 / 100))" >> "$folder/times.txt"
    sleep 0.6
  done
}

# Waits for some words to be on screen, leaving what is on screen in ui.xml.
wait_for_words() {
  for _ in 1 2 3 4 5 6 7 8; do
    adb shell uiautomator dump /sdcard/ui.xml > /dev/null 2>&1 || true
    adb exec-out cat /sdcard/ui.xml > ui.xml 2> /dev/null || true
    if python3 "$HERE/read-ui.py" ui.xml "$1" > /dev/null 2>&1; then return 0; fi
    sleep 4
  done
  return 1
}

echo "== Starting an emulated phone"
ls -l /dev/kvm || echo "no /dev/kvm: the emulator will have no hardware acceleration"
# "yes" is cut off when sdkmanager finishes; that is not a failure.
(yes 2> /dev/null || true) | sdkmanager --install "$IMAGE" emulator platform-tools > /dev/null
echo no | avdmanager create avd --force -n phone -k "$IMAGE" -d pixel_6 > /dev/null
emulator -accel-check || true
emulator -avd phone -no-window -no-audio -no-boot-anim -no-snapshot -gpu swiftshader_indirect > emulator.log 2>&1 &
EMULATOR=$!

booted() { [ "$(adb shell getprop sys.boot_completed 2> /dev/null | tr -d '\r')" = "1" ]; }
for i in $(seq 1 240); do            # up to twelve minutes
  if booted; then break; fi
  if ! kill -0 "$EMULATOR" 2> /dev/null; then
    echo "The emulator stopped before the phone started:"
    tail -n 40 emulator.log
    exit 1
  fi
  if [ $((i % 20)) = 0 ]; then echo "  still starting after $((i * 3)) s"; fi
  sleep 3
done
if ! booted; then
  echo "The phone did not finish starting:"
  tail -n 40 emulator.log
  exit 1
fi
echo "  the phone is on"
adb shell wm dismiss-keyguard || true
adb shell input keyevent 82 || true
sleep 5

# A stock app to stand in for Instagram. Not Settings: Android hides anything
# drawn over its own settings screens.
TARGET="$(adb shell pm list packages | tr -d '\r' | sed 's/^package://' \
  | grep -E '^com\.(google\.)?android\.(deskclock|calendar|contacts)$' | head -n 1 || true)"
[ -n "$TARGET" ] || fail "the emulated phone has no app to stand in for Instagram"
echo "Standing in for Instagram: $TARGET"

echo "== Installing and setting up"
adb install -r "$APK"
adb shell "run-as $APP mkdir -p shared_prefs"
printf '%s\n' "<?xml version='1.0' encoding='utf-8' standalone='yes' ?>" \
  "<map><set name=\"apps\"><string>$TARGET</string></set></map>" \
  | adb shell "run-as $APP sh -c 'cat > shared_prefs/scroll-bouncer.xml'"
# What a person switches on by hand: usage access, display over other apps, notifications.
adb shell appops set "$APP" GET_USAGE_STATS allow
adb shell appops set "$APP" SYSTEM_ALERT_WINDOW allow
adb shell pm grant "$APP" android.permission.POST_NOTIFICATIONS || true
adb shell setprop log.tag.ScrollBouncer DEBUG
adb logcat -c
# Opening the app puts him on duty.
adb shell am start -n "$APP/.MainActivity" > /dev/null
sleep 25      # a freshly started emulator takes a while to settle
echo "Usage access: $(adb shell appops get "$APP" GET_USAGE_STATS | tr -d '\r' | head -n 1)"
echo "Display over other apps: $(adb shell appops get "$APP" SYSTEM_ALERT_WINDOW | tr -d '\r' | head -n 1)"
echo "Running: $(adb shell dumpsys activity services "$APP" | grep -c ServiceRecord || true) service(s)"
adb shell input keyevent KEYCODE_HOME
sleep 3

echo "== Opening an app on his list and watching the screen"
adb shell monkey -p "$TARGET" -c android.intent.category.LAUNCHER 1 > /dev/null 2>&1
watch_screen shots 22
sleep 4

FOCUS="$(adb shell dumpsys window | grep -m1 mCurrentFocus || true)"
adb logcat -d -s ScrollBouncer:V AndroidRuntime:E chromium:I ActivityTaskManager:I ActivityManager:W > all.txt || true
grep -E "ScrollBouncer|AndroidRuntime|Scroll Bouncer: page ready|START u0 .*$TARGET|scrollbouncer" all.txt | cut -c1-300 > log.txt || true
adb shell "run-as $APP cat shared_prefs/scroll-bouncer.xml" > prefs.xml || true

echo "== What the app logged"
cat log.txt
echo "== In front afterwards: $FOCUS"
echo "== His count"
cat prefs.xml
echo "== What was on screen"
python3 "$HERE/read-screens.py" shots --must-walk

grep -q "on stage" log.txt || fail "he never went on"
grep -q "dark, sent home" log.txt || fail "the screen never went dark"
grep -q "off stage" log.txt || fail "he never left"
grep -q "FATAL EXCEPTION" log.txt && fail "the app crashed"
grep -q "ANR in $APP" log.txt && fail "the app stopped responding"
echo "$FOCUS" | grep -q "$TARGET" && fail "the app he was meant to close is still in front"
grep -q 'name="total" value="1"' prefs.xml || fail "the close was not counted"
echo "PASSED: he closed the app"

echo "== Opening Scroll Bouncer itself"
if [ -n "$RELEASE" ]; then adb install -r "$RELEASE"; fi
adb logcat -c
adb shell am start -n "$APP/.MainActivity" > /dev/null
wait_for_words "See him in action" || { python3 "$HERE/read-ui.py" ui.xml || true; fail "the app's own screen did not open"; }
python3 "$HERE/read-ui.py" ui.xml

echo "== Tapping See him in action"
TAP="$(python3 "$HERE/read-ui.py" ui.xml "See him in action")"
# shellcheck disable=SC2086  # two numbers: x and y
adb shell input tap $TAP
watch_screen preview 14
python3 "$HERE/read-screens.py" preview --must-walk || fail "he did not perform in the preview"
wait_for_words "See him in action" || fail "the preview did not hand back to the app's screen"
adb logcat -d -s AndroidRuntime:E ActivityManager:E > crashes.txt || true
grep -q "FATAL EXCEPTION" crashes.txt && { cat crashes.txt; fail "the app crashed"; }
grep -q "ANR in $APP" crashes.txt && { cat crashes.txt; fail "the app stopped responding"; }
echo "PASSED: the app opens and its preview plays"
