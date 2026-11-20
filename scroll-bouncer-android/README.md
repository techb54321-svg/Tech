# Scroll Bouncer for Android

The same little guy as the browser extension, for the apps on an Android phone.
Open an app on his list and he walks across the top of the screen and boops a
close button. The screen goes dark, he shakes his head and says "Nope not now",
and you are back on the home screen.

## Install

1. On the phone, download `dist/scroll-bouncer.apk` from this folder (on GitHub,
   open the file and tap the download button) and open it. Android asks whether
   to allow installing from that source; allow it, then tap Install.
2. Open Scroll Bouncer. It lists two things to switch on, each with a button
   that opens the right settings screen:
   - **Usage access**, so he can see which app you have opened
   - **Display over other apps**, so he can appear on top of it
3. If a switch is greyed out or Android says it is a **restricted setting**, go
   back to Scroll Bouncer and tap **Open App info**. Tap the three dots in the
   top corner, choose **Allow restricted settings**, then try again.

Tap **See him in action** to watch his routine without opening anything.

## Using it

- The switch at the top turns him on and off.
- **Apps he closes** lists the apps on the phone. Instagram, TikTok, Facebook,
  X, Reddit, Threads and Snapchat are ticked to begin with.
- **Let me in for 5 minutes** gives you a break when you really do need to get
  in.
- The two numbers count how many times he has closed something.

While he is switched on, Android shows a small "Scroll Bouncer is on duty"
notification. If you leave the app yourself before he reaches the button, he
goes away without doing anything.

## What it can see

It is told which app has been opened and when, from Android's record of app
use. It cannot read what is on the screen, and without the internet permission
it has no way to send anything anywhere.

It deliberately does not use Android's accessibility permission. Google Play
Protect refuses to install apps from outside the Play Store that ask for it.

## Building it

```bash
./gradlew assembleRelease
```

The app is written to `app/build/outputs/apk/release/app-release.apk`. Building
needs the Android SDK; Android Studio installs it. `dist/scroll-bouncer.apk` is
a copy of that file, kept here so it can be downloaded without building.

Every build is signed with `dev.keystore`, a development key kept in this
folder so that a new build installs over the last one. Anyone with this folder
has that key, so replace it with a private one before publishing to an app
store.

## How it fits together

- `app/src/main/java/.../BouncerService.java`: checks which app is in front,
  puts him on screen, and sends the phone to its home screen
- `Access.java`: whether the two settings above are switched on
- `BootReceiver.java`: puts him back on duty after the phone restarts
- `Stage.java`: the see-through web view he is drawn in
- `MainActivity.java`: the settings screen
- `PreviewActivity.java`: plays his routine inside the app
- `Prefs.java`: the chosen apps, the break, and the counts
- `app/src/main/assets/bouncer.html`: the page shown in the web view
- `../scroll-bouncer/guy.js`: the little guy himself, shared with the browser
  extension and copied into the app when it is built
- `ci/`: tries the app on an emulated phone
