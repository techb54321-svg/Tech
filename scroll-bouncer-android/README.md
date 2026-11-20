# Scroll Bouncer for Android

The same little guy as the browser extension, for the apps on an Android phone.
Open an app on his list and he walks across the top of the screen and boops a
close button. The screen goes dark, he shakes his head and says "Nope not now",
and you are back on the home screen.

## Install

1. Get `scroll-bouncer.apk` onto the phone and open it. Android asks whether to
   allow installing from that source; allow it, then tap Install.
2. Open Scroll Bouncer and tap **Open Accessibility settings**. Find Scroll
   Bouncer in the list (it may be under "Downloaded apps") and turn it on.
3. If Android says it is a **restricted setting**, go back to Scroll Bouncer and
   tap **Open App info**. Tap the three dots in the top corner, choose **Allow
   restricted settings**, then repeat step 2.

Tap **See him in action** to watch his routine without opening anything.

## Using it

- The switch at the top turns him on and off.
- **Apps he closes** lists the apps on the phone. Instagram, TikTok, Facebook,
  X, Reddit, Threads and Snapchat are ticked to begin with.
- **Let me in for 5 minutes** gives you a break when you really do need to get
  in.
- The two numbers count how many times he has closed something.

If you leave the app yourself before he reaches the button, he goes away
without doing anything.

## What it can see

Android's accessibility permission is a broad one, so this app asks for as
little of it as it can. It is told only that a different window has come to the
front and which app it belongs to. It cannot read what is on the screen. It
requests no other permissions, and without the internet permission it has no
way to send anything anywhere.

## Building it

```bash
./gradlew assembleRelease
```

The app is written to `app/build/outputs/apk/release/app-release.apk`. Building
needs the Android SDK; Android Studio installs it.

Every build is signed with `dev.keystore`, a development key kept in this
folder so that a new build installs over the last one. Anyone with this folder
has that key, so replace it with a private one before publishing to an app
store.

## How it fits together

- `app/src/main/java/.../BouncerService.java`: watches which app comes to the
  front, puts him on screen, and sends the phone to its home screen
- `Stage.java`: the see-through web view he is drawn in
- `MainActivity.java`: the settings screen
- `PreviewActivity.java`: plays his routine inside the app
- `Prefs.java`: the chosen apps, the break, and the counts
- `app/src/main/assets/bouncer.html`: the page shown in the web view
- `../scroll-bouncer/guy.js`: the little guy himself, shared with the browser
  extension and copied into the app when it is built
- `ci/`: tries the app on an emulated phone
