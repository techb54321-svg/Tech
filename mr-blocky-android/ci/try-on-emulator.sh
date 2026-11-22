#!/usr/bin/env bash
# Installs the app on an emulated phone, opens an app on his list, and checks
# that the little guy turns up and the phone ends up back on the home screen.
# Then it stops the app the way a phone does when it wants the memory back, and
# checks that he comes back by himself and still does his job. Then it asks for
# the dance deal, taps "Let's dance!", jumps up and down with the phone the way
# the emulator lets it, and checks that he lets them back into the app. Last, it
# switches the phone's web view off, and checks that the app is closed even
# though he cannot be drawn.
#
#   ci/try-on-emulator.sh path/to/app-debug.apk [path/to/app-release.apk]
#
# Those parts need the debug build, because that is the one adb is allowed to
# configure. If the release build is given too, it is installed over the top
# and the app's own screen and its preview are tried with that.
set -euo pipefail

APK="$1"
RELEASE="${2:-}"
HERE="$(cd "$(dirname "$0")" && pwd)"
APP=com.scrollbouncer.app
# Which version of Android to try it on, as an API level: 34 is Android 14, 36 is Android 16.
API="${API:-34}"
IMAGE="system-images;android-$API;google_apis;x86_64"
SDK="${ANDROID_HOME:?ANDROID_HOME is not set}"
export PATH="$SDK/cmdline-tools/latest/bin:$SDK/platform-tools:$SDK/emulator:$PATH"
# Left alone, the tool that creates the phone and the emulator that runs it can look in
# different folders, so tell both where it lives.
export ANDROID_AVD_HOME="$HOME/.android/avd"
mkdir -p "$ANDROID_AVD_HOME"

PASSED=()
finish() {
  echo "== Summary (Android API $API)"
  for line in "${PASSED[@]}"; do echo "PASSED: $line"; done
  [ -z "${1:-}" ] || echo "FAILED: $1"
}
pass() { PASSED+=("$1"); echo "PASSED: $1"; }
fail() {
  echo "== The app's own log"
  tail -n 30 log.txt 2> /dev/null || true
  finish "$1"
  exit 1
}

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

# Finds some words on the app's screen, scrolling down to them if need be, and
# leaves what is on screen in ui.xml. It looks from the top of the screen down.
scroll_to_words() {
  local x=$((WIDTH / 2))
  for _ in 1 2 3; do adb shell input swipe "$x" $((HEIGHT * 3 / 10)) "$x" $((HEIGHT * 8 / 10)) 150; done
  for _ in 1 2 3 4 5 6 7; do
    sleep 2
    adb shell uiautomator dump /sdcard/ui.xml > /dev/null 2>&1 || true
    adb exec-out cat /sdcard/ui.xml > ui.xml 2> /dev/null || true
    if python3 "$HERE/read-ui.py" ui.xml "$1" > /dev/null 2>&1; then return 0; fi
    # A slow drag, so the screen moves by just this much and does not fly past.
    adb shell input swipe "$x" $((HEIGHT * 7 / 10)) "$x" $((HEIGHT * 4 / 10)) 600
  done
  return 1
}

# Taps some words on the app's screen, scrolling down to them if need be.
tap_words() {
  scroll_to_words "$1" || return 1
  # shellcheck disable=SC2046  # two numbers: x and y
  adb shell input tap $(python3 "$HERE/read-ui.py" ui.xml "$1")
}

# Whether the app logged exactly these words. A plain search would take "could not go
# on stage" for "on stage", and "not allowed on duty" for "on duty".
logged() { grep -qE "ScrollBouncer *: $1\$" log.txt; }

# Collects what the app has logged, which app is in front, and his count.
collect() {
  # Which app is in front: the one whose screen Android has resumed. Not the window dump,
  # which starts with a snapshot from the last time anything stopped responding, so it can
  # say what was in front back then.
  FOCUS="$(adb shell dumpsys activity activities | tr -d '\r' | grep -m1 'topResumedActivity=' || true)"
  [ -n "$FOCUS" ] || FOCUS="$(adb shell dumpsys activity activities | tr -d '\r' | grep -m1 'ResumedActivity' || true)"
  adb logcat -d -v threadtime > everything.txt || true
  grep -E " (ScrollBouncer|AndroidRuntime) *: |Mr Blocky: (page ready|deal [a-z]+|counted [0-9]+ [a-z]+)|ActivityTaskManager: START u0 .*($TARGET|$APP)" everything.txt \
    | tr -d '\r' | cut -c1-260 > log.txt || true
  adb shell "run-as $APP cat shared_prefs/scroll-bouncer.xml" > prefs.xml || true
  echo "== What the app logged"
  cat log.txt
  echo "== In front afterwards: $FOCUS"
  echo "== His count: $(grep -o 'name="total" value="[0-9]*"' prefs.xml || echo none)"
  # The app has two processes: one keeps watch, and ":stage" draws him. Say how each
  # has ended, because a watcher that is stopped or crashes takes him off duty.
  echo "== How the app's own processes have ended"
  adb shell dumpsys activity exit-info "$APP" | tr -d '\r' | grep -A1 -E "process=$APP(:stage)? " \
    | sed 's/^ *//' | cut -c1-220 | head -n 12 || true
  grep -E "$APP" everything.txt | grep -vE " (ScrollBouncer|AppsFilter) *: " \
    | grep -iE "has died|killing|crash|not allowed|denied|exception|fatal" | cut -c1-240 | tail -n 8 || true
  # A crash in native code, such as inside the web view: which process, the signal, and the reason given.
  grep -E " F (DEBUG|libc) *: " everything.txt \
    | grep -iE "Cmdline|signal [0-9]|Abort message|Fatal signal|#0[0-5] pc" | cut -c1-240 | head -n 16 || true
}

# On a newly started emulated phone, Google's services restart themselves several
# times, and each time Android stops anything that is using the web view. The app
# copes with that, but it would make this a test of luck, so wait for them to settle.
settle() {
  local last="" same=0 pid
  for _ in $(seq 1 48); do            # up to four minutes
    pid="$(adb shell pidof com.google.android.gms.persistent | tr -d '\r' || true)"
    if [ -n "$pid" ] && [ "$pid" = "$last" ]; then same=$((same + 1)); else same=0; fi
    last="$pid"
    if [ "$same" -ge 9 ]; then return 0; fi      # the same process for 45 seconds
    sleep 5
  done
  echo "Google's services were still restarting after four minutes"
}

echo "== Starting an emulated phone (Android API $API)"
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
SIZE="$(adb shell wm size | tr -d '\r' | grep -oE '[0-9]+x[0-9]+' | tail -n 1)"
WIDTH="${SIZE%x*}"
HEIGHT="${SIZE#*x}"
adb shell wm dismiss-keyguard || true
adb shell input keyevent 82 || true
sleep 5

# A stock app to stand in for Instagram: the first of these the phone has. Not
# Settings, because Android hides anything drawn over its own settings screens,
# and nothing that starts by asking to sign in, because that page belongs to
# another app.
TARGET=""
INSTALLED="$(adb shell pm list packages | tr -d '\r' | sed 's/^package://')"
for app in com.google.android.deskclock com.android.deskclock com.google.android.documentsui \
  com.android.documentsui com.google.android.contacts com.android.contacts; do
  if echo "$INSTALLED" | grep -qx "$app"; then TARGET="$app"; break; fi
done
if [ -z "$TARGET" ]; then
  echo "Apps on this phone that can be opened:"
  adb shell cmd package query-activities --brief -a android.intent.action.MAIN -c android.intent.category.LAUNCHER || true
  fail "the emulated phone has no app to stand in for Instagram"
fi
echo "Standing in for Instagram: $TARGET"
# So it does not start by asking a question, which would be another app's screen.
adb shell pm grant "$TARGET" android.permission.POST_NOTIFICATIONS 2> /dev/null || true

echo "== Installing and setting up"
adb install -r "$APK"
adb shell "run-as $APP mkdir -p shared_prefs"
# Dance deals are off, or one could turn up by chance where a plain close is expected.
# The dance deal gets a part of its own, asked for with "Make the next one a dance".
printf '%s\n' "<?xml version='1.0' encoding='utf-8' standalone='yes' ?>" \
  "<map><set name=\"apps\"><string>$TARGET</string></set><boolean name=\"danceDeals\" value=\"false\" /></map>" \
  | adb shell "run-as $APP sh -c 'cat > shared_prefs/scroll-bouncer.xml'"
# What a person switches on by hand: usage access, display over other apps, notifications.
adb shell appops set "$APP" GET_USAGE_STATS allow
adb shell appops set "$APP" SYSTEM_ALERT_WINDOW allow
adb shell pm grant "$APP" android.permission.POST_NOTIFICATIONS || true
adb shell setprop log.tag.ScrollBouncer DEBUG
echo "Stays awake while charging: $(adb shell settings get global stay_on_while_plugged_in | tr -d '\r'), screen goes off after: $(adb shell settings get system screen_off_timeout | tr -d '\r') ms"
# Room for a few minutes of the phone's log: the dance alone takes over two.
adb logcat -G 16M || true
adb logcat -c
# Opening the app puts him on duty.
adb shell am start -n "$APP/.MainActivity" > /dev/null
sleep 25      # a freshly started emulator takes a while to settle
echo "Usage access: $(adb shell appops get "$APP" GET_USAGE_STATS | tr -d '\r' | head -n 1)"
echo "Display over other apps: $(adb shell appops get "$APP" SYSTEM_ALERT_WINDOW | tr -d '\r' | head -n 1)"
adb shell input keyevent KEYCODE_HOME
settle

echo "== 1. Opening an app on his list and watching the screen"
adb shell monkey -p "$TARGET" -c android.intent.category.LAUNCHER 1 > /dev/null 2>&1
watch_screen shots 22
sleep 4
collect
echo "== What was on screen"
python3 "$HERE/read-screens.py" shots --must-walk || fail "he was not seen walking across the app"

logged "on stage" || fail "he never went on"
logged "dark, sent home" || fail "the screen never went dark"
logged "off stage" || fail "he never left"
logged "closed without him" && fail "the app was closed without him"
grep -q "FATAL EXCEPTION" log.txt && fail "the app crashed"
grep -q "ANR in $APP" everything.txt && fail "the app stopped responding"
echo "$FOCUS" | grep -q "$TARGET" && fail "the app he was meant to close is still in front"
grep -q 'name="total" value="1"' prefs.xml || fail "the close was not counted"
pass "he walked across the app, closed it, and the phone went to its home screen"

echo "== 2. Stopping the app the way a phone does, with an app on his list left open"
adb logcat -c
PID="$(adb shell pidof "$APP" | tr -d '\r' || true)"
[ -n "$PID" ] || fail "the app was not running before it was stopped"
# Emulated phones let adb act as the system, which is what it takes to stop another app's process like this.
adb shell su 0 kill -9 "$PID"
adb shell monkey -p "$TARGET" -c android.intent.category.LAUNCHER 1 > /dev/null 2>&1
watch_screen again 28
sleep 4
collect
echo "== What was on screen"
python3 "$HERE/read-screens.py" again --must-walk --brief || fail "he was not seen walking across the app the second time"

logged "on duty" || fail "he did not go back on duty after the app was stopped"
logged "on stage" || fail "he went back on duty, but did not come for the app that was already open"
logged "dark, sent home" || fail "the screen never went dark the second time"
logged "closed without him" && fail "the app was closed without him the second time"
grep -q "FATAL EXCEPTION" log.txt && fail "the app crashed"
echo "$FOCUS" | grep -q "$TARGET" && fail "the app he was meant to close is still in front"
grep -q 'name="total" value="2"' prefs.xml || fail "the second close was not counted"
# From Android 15 an app in the background is not always allowed back on duty straight away.
if grep -q "not allowed on duty" log.txt; then HOW="once a dot was showing, since Android refused at first"; else HOW="straight away"; fi
pass "after the app was stopped he came back by himself ($HOW) and closed the app that was open"

echo "== 3. Opening Mr Blocky itself"
if [ -n "$RELEASE" ]; then adb install -r "$RELEASE"; fi
adb logcat -c
adb shell am start -n "$APP/.MainActivity" > /dev/null
wait_for_words "See him in action" || { python3 "$HERE/read-ui.py" ui.xml || true; fail "the app's own screen did not open"; }
# Its screen should say that he is on duty, and that he was stopped earlier.
wait_for_words "He is on duty" || { python3 "$HERE/read-ui.py" ui.xml || true; fail "the app's screen does not say he is on duty"; }
python3 "$HERE/read-ui.py" ui.xml
python3 "$HERE/read-ui.py" ui.xml "He was stopped" > /dev/null || fail "the app's screen does not mention that he was stopped"
python3 "$HERE/read-ui.py" ui.xml "Let him keep running" > /dev/null || fail "the app's screen does not offer to keep him running"
pass "the app's screen says he is on duty and that he was stopped earlier"

echo "== Tapping See him in action"
TAP="$(python3 "$HERE/read-ui.py" ui.xml "See him in action")"
# shellcheck disable=SC2086  # two numbers: x and y
adb shell input tap $TAP
watch_screen preview 14
python3 "$HERE/read-screens.py" preview --must-walk --brief || fail "he did not perform in the preview"
wait_for_words "See him in action" || fail "the preview did not hand back to the app's screen"
# Stay a little longer: anything that goes wrong after his routine shows up here.
sleep 15
collect
grep -q "FATAL EXCEPTION" log.txt && fail "the app crashed"
grep -q "ANR in $APP" everything.txt && fail "the app stopped responding"
[ -n "$(adb shell pidof "$APP" | tr -d '\r' || true)" ] || fail "the part of the app that keeps watch was no longer running after the preview"
pass "the app opens and its preview plays"

echo "== 4. The dance deal: saying yes, dancing, and being let back in"
tap_words "Make the next one a dance" || { python3 "$HERE/read-ui.py" ui.xml || true; fail "the app's screen has no button to make the next one a dance"; }
sleep 2
scroll_to_words "The next one will be a dance" || { python3 "$HERE/read-ui.py" ui.xml || true; fail "the button does not say that the next one will be a dance"; }
adb shell input keyevent KEYCODE_HOME
sleep 3
adb logcat -c
adb shell monkey -p "$TARGET" -c android.intent.category.LAUNCHER 1 > /dev/null 2>&1
# He closes the app as usual, then asks. His buttons are drawn in his own page, which
# the phone's list of what is on screen does not reach, so "Let's dance!" is found by its colour.
mkdir -p dance
OFFER=""
for _ in $(seq 1 50); do
  adb exec-out screencap -p > dance/offer.png
  if OFFER="$(python3 "$HERE/find-button.py" dance/offer.png 2dd4bf 2> /dev/null)"; then break; fi
  OFFER=""
  sleep 0.5
done
[ -n "$OFFER" ] || { collect; fail "he never offered the dance deal"; }
# shellcheck disable=SC2086  # two numbers: x and y
adb shell input tap $OFFER
echo "Tapped Let's dance! at $OFFER"

# Star jumps and knees up, as the phone's motion sensor feels them: up in the air, where
# it feels lighter, then the jolt of landing, over and over. He counts each one in its own
# part of the dance, so keep going all the way through, quickly enough for knees up, a
# step every half a second.
echo "The motion sensor before jumping: $(adb emu sensor get acceleration 2>&1 | tr -d '\r' | head -n 1)"
touch jumping
(
  while [ -e jumping ]; do
    adb emu sensor set acceleration 0:0:2 > /dev/null 2>&1 || true
    sleep 0.15
    adb emu sensor set acceleration 0:0:22 > /dev/null 2>&1 || true
    sleep 0.15
  done
  adb emu sensor set acceleration 0:9.8:0 > /dev/null 2>&1 || true   # standing still again
) &
JUMPER=$!
# The dance lasts just over a minute. Photograph it every few seconds until he lets them back in.
LET_IN=""
START=$(date +%s)
SHOT=0
while [ $(($(date +%s) - START)) -lt 150 ]; do
  SHOT=$((SHOT + 1))
  adb exec-out screencap -p > "dance/$(printf %02d "$SHOT").png"
  if adb logcat -d -s ScrollBouncer | tr -d '\r' | grep -qE "ScrollBouncer *: let back in$"; then LET_IN=yes; break; fi
  sleep 5
done
rm -f jumping
wait "$JUMPER" || true
echo "The dance took $(($(date +%s) - START)) s from the tap"
sleep 5
collect
echo "== Android's own record of the last apps to come and go"
adb shell dumpsys usagestats | tr -d '\r' | grep -E "type=(ACTIVITY_RESUMED|ACTIVITY_PAUSED|SCREEN_NON_INTERACTIVE)" \
  | grep -oE 'time="[^"]*" type=[A-Z_]+( package=[^ ]+)?' | tail -n 6 || true
logged "dark, sent home" || fail "the screen never went dark before he offered the deal"
logged "dancing" || fail "tapping Let's dance! did not start the dance"
grep -q "Mr Blocky: deal stopped" log.txt && fail "he did not let them in: the star jumps and knees up were not all counted"
[ -n "$LET_IN" ] || fail "they danced, but he did not let them back into the app"
grep -q "FATAL EXCEPTION" log.txt && fail "the app crashed"
grep -q "ANR in $APP" everything.txt && fail "the app stopped responding"
echo "$FOCUS" | grep -q "$TARGET" || fail "after the dance, the app he let them back into is not in front"
# He leaves them be for five minutes: the app stays open, and he does not come again.
sleep 15
collect
[ "$(grep -cE "ScrollBouncer *: on stage$" log.txt)" = 1 ] || fail "he came again during the five minutes he gave them"
echo "$FOCUS" | grep -q "$TARGET" || fail "the app he let them back into was closed again"
pass "they said yes to a dance, did the star jumps and knees up, and he let them back into the app"

adb shell am start -n "$APP/.MainActivity" > /dev/null
sleep 3
scroll_to_words "He is on a break" || { python3 "$HERE/read-ui.py" ui.xml || true; fail "after the dance, the app's screen does not say he is on a break"; }
python3 "$HERE/read-ui.py" ui.xml
# End the break, so he comes for the app again in the next part.
tap_words "End break now" || { python3 "$HERE/read-ui.py" ui.xml || true; fail "the app's screen has no button to end the break"; }
sleep 2
scroll_to_words "He is on duty" || { python3 "$HERE/read-ui.py" ui.xml || true; fail "ending the break did not put him back on duty"; }
pass "the app's screen shows the break the dance earned, and ending it puts him back on duty"

echo "== 5. Switching the phone's web view off, so that he cannot be drawn"
adb logcat -c
adb shell input keyevent KEYCODE_HOME
adb shell pm disable-user --user 0 com.google.android.webview > /dev/null
sleep 5
adb shell monkey -p "$TARGET" -c android.intent.category.LAUNCHER 1 > /dev/null 2>&1
sleep 25      # he is given a while to appear before the app is closed without him
collect
echo "$FOCUS" | grep -q "$TARGET" && fail "with the web view off, the app he was meant to close is still in front"
# Android stops everything that is using the web view when it goes. The part that keeps watch must not be among them.
logged "on duty" && fail "the part that keeps watch was restarted when the web view went away"
if logged "on stage"; then
  # Some versions of Android carry a second web view to fall back on, and then he is drawn after all.
  logged "dark, sent home" || fail "he went on with the web view off, but the screen never went dark"
  pass "this phone still had a web view after Google's was switched off, and he closed the app as usual"
else
  logged "closed without him" || fail "with the web view off, the app was not closed"
  adb shell am start -n "$APP/.MainActivity" > /dev/null
  wait_for_words "closed without him" || { python3 "$HERE/read-ui.py" ui.xml || true; fail "the app's screen does not say that he could not be drawn"; }
  python3 "$HERE/read-ui.py" ui.xml
  pass "with the web view switched off, the app is closed without him and its screen says why"
fi
finish
