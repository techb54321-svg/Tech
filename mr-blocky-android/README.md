# Mr Blocky for Android

Mr Blocky, the same little guy as in the browser extension, for the apps on an
Android phone. Open an app on his list and he walks across the top of the screen
and boops a close button. The screen goes dark, he shakes his head and says "Nope not now",
and you are back on the home screen.

## Install

1. On the phone, download `dist/mr-blocky.apk` from this folder (on GitHub,
   open the file and tap the download button) and open it. Android asks whether
   to allow installing from that source; allow it, then tap Install.
2. Open Mr Blocky. It lists two things to switch on, each with a button
   that opens the right settings screen:
   - **Usage access**, so he can see which app you have opened
   - **Display over other apps**, so he can appear on top of it
3. If a switch is greyed out or Android says it is a **restricted setting**, go
   back to Mr Blocky and tap **Open App info**. Tap the three dots in the
   top corner, choose **Allow restricted settings**, then try again.

Tap **See him in action** to watch his routine without opening anything.

## Dance deals

Now and then, after "Nope not now", he goes quiet for a moment, then asks:
"…unless… you want to dance with me?"

- Tap **No thanks**, or leave it, and he closes the app as usual.
- Tap **Let's dance!** and music starts. He dances in the middle of the screen
  for just over a minute, calling out each move: dance, star jumps, march on
  the spot, arms up and wiggle, and a big finish. Hold on to your phone: it
  feels your star jumps with its motion sensor, and he needs 10 of them. Tap
  **Stop** to give up part way.
- Dance to the end and he says "OK, you did good!", boops the app back open
  with his nose, and leaves you be for 5 minutes. If you are still in the app
  when they are up, he comes back for it and says "Time's up!".

He offers it about one time in four, and never twice within two hours. The
**Dance deals** card on Mr Blocky's screen turns it on or off, **Make the next
one a dance** makes sure the next app he closes gets the offer, and **Try the
dance now** plays it inside the app without closing anything.

On a phone with no motion sensor he does not count star jumps, and finishing
the dance is enough.

## If he does not turn up

The lines under the app's name say how he is getting on: whether he is on
duty, which apps he has noticed being opened, when he last went on screen, and
anything that has gone wrong. Open an app on his list, come back to Mr
Blocky, and read them.

- **He cannot start until the two settings below are switched on**: one of the
  two settings in step 2 is still off.
- **He is on a break** or **He is switched off**: end the break, or turn the
  switch at the top back on.
- **He was stopped**: the phone closed the app. A card appears with a **Let him
  keep running** button, which asks the phone to leave him alone. Some phones
  also have their own setting for this, usually called Autostart or Background
  activity, under the app's battery settings.
- The app you opened is not marked **on his list**: tick it under **Apps he
  closes**.

If he cannot be drawn for any reason, the app is still closed, with a short
"Nope not now" message in his place.

The small print under the buttons is there to help work out a problem: which
settings are on, the last few times Android closed the app and why, and which
version of the app and of Android this is.

## Using it

- The switch at the top turns him on and off.
- **Apps he closes** lists the apps on the phone. Instagram, TikTok, Facebook,
  X, Reddit, Threads and Snapchat are ticked to begin with.
- **Let me in for 5 minutes** gives you a break when you really do need to get
  in. Dancing with him for a dance deal gives you the same break.
- The two numbers count how many times he has closed something.

While he is switched on, Android shows a small "Mr Blocky is on duty"
notification. If you leave the app yourself before he reaches the button, he
goes away without doing anything. If you are still in an app when a break runs
out, he comes for it then.

## What it can see

It is told which app has been opened and when, from Android's record of app
use. It cannot read what is on the screen, and without the internet permission
it has no way to send anything anywhere. The last few apps it noticed are shown
on its own screen and forgotten when the app closes.

It deliberately does not use Android's accessibility permission. Google Play
Protect refuses to install apps from outside the Play Store that ask for it.

## Building it

```bash
./gradlew assembleRelease
```

The app is written to `app/build/outputs/apk/release/app-release.apk`. Building
needs the Android SDK; Android Studio installs it. `dist/mr-blocky.apk` is
a copy of that file, kept here so it can be downloaded without building.

The app used to be called Scroll Bouncer. Its internal name,
`com.scrollbouncer.app`, and the name of the file its settings are kept in have
been left alone, so that a new build installs over an old one and keeps its
settings and permissions.

Every build is signed with `dev.keystore`, a development key kept in this
folder so that a new build installs over the last one. Anyone with this folder
has that key, so replace it with a private one before publishing to an app
store.

## How it fits together

The app runs as two processes. One keeps watch and is kept small, so that
Android leaves it alone. The other draws him, using the phone's web view, which
is large, occasionally crashes, and is stopped by Android whenever the Google
service it borrows fonts from restarts. Kept apart, none of that interrupts the
watching.

- `app/src/main/java/.../BouncerService.java`: keeps watch. Checks which app is
  in front and sends for him when it is one on the list
- `StageService.java`: draws him over the app, and tells the watcher as he
  goes on, the screen goes dark and he finishes. The watcher sends the phone
  to its home screen. For a dance deal it also tells the watcher when they say
  yes, and when he boops the app back open, so the watcher can open it again
- `JumpCounter.java`: counts star jumps with the phone's motion sensor: a
  moment of near weightlessness, then the jolt of landing. It needs no
  permission
- `Access.java`: whether the two settings above are switched on
- `BootReceiver.java`: puts him back on duty after the phone restarts or the
  app is updated
- `Status.java`: the notes behind the lines under the app's name
- `App.java`: writes down a crash, so the next visit to the app can say so
- `Stage.java`: the see-through web view he is drawn in, used by `StageService`
  and by the preview
- `MainActivity.java`: the settings screen
- `PreviewActivity.java`: plays his routine inside the app
- `Prefs.java`: the chosen apps, the break, the counts, and when he last
  offered a dance deal
- `app/src/main/assets/bouncer.html`: the page shown in the web view
- `../mr-blocky/guy.js`: the little guy himself, shared with the browser
  extension and copied into the app when it is built, along with
  `../mr-blocky/dance.ogg`, the dance music (made by `../mr-blocky-music`)
- `ci/`: tries the app on emulated phones running Android 14 and Android 16
