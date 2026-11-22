# Mr Blocky

A browser extension that helps you stop scrolling. Open a social media site and
Mr Blocky, a little round guy, walks in from the left, toddles all the way across
the top of the page to the close button and boops it with his nose. The page
goes dark, he turns to face you, shakes his head, wags a hand and says "Nope not
now", and the tab is gone.

## Install

**Chrome, Edge, Brave, Arc (desktop)**

1. Go to `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and pick this `mr-blocky` folder.

**Firefox (desktop)**: open `about:debugging#/runtime/this-firefox`, click
**Load Temporary Add-on**, and pick `manifest.json`.

**Safari on a Mac**

Safari only runs extensions that are wrapped in an app, which is done with Xcode.
These steps have not been tested, and menu names can differ a little between
versions.

1. Install Xcode from the Mac App Store and open it once.
2. In Terminal, run this. Change the path if the folder is somewhere else:

   ```bash
   xcrun safari-web-extension-packager ~/mr-blocky --macos-only --app-name "Mr Blocky"
   ```

   It creates an Xcode project and opens it. On older versions of Xcode the tool
   is called `safari-web-extension-converter`.
3. In Xcode, press Run. A small Mr Blocky app opens; it can be closed.
4. In Safari's Settings, open Advanced and tick "Show features for web
   developers". Then open the Developer tab and tick "Allow unsigned extensions".
5. Still in Safari's Settings, open Extensions, tick Mr Blocky, and allow it
   on every website.

Safari forgets "Allow unsigned extensions" every time it quits, so step 4 has to
be repeated after restarting Safari. Signing the app through a paid Apple
Developer membership removes that. After updating this folder, press Run in
Xcode again.

**Android**

Chrome on Android does not run extensions. Firefox for Android does, but only
ones Mozilla has signed, so it has to be published on addons.mozilla.org first:

1. Zip the files inside this folder (not the folder itself), so that
   `manifest.json` is at the top level of the zip.
2. Create a free account at addons.mozilla.org, open the Developer Hub and
   submit a new add-on. Choose to list it on the site, upload the zip, and tick
   Firefox for Android as a compatible platform.
3. Once it is approved, open Firefox on the phone, go to Extensions, and install
   Mr Blocky from addons.mozilla.org.

It passes Mozilla's add-on validator, but has not been run in Firefox.

On a phone the extension covers social media opened in the browser, not the
Instagram or TikTok apps themselves. For those there is a separate Android app
with the same little guy in `../mr-blocky-android`.

## Using it

Click the toolbar icon to:

- turn him on or off
- add or remove sites (`reddit.com` covers the whole site, `youtube.com/shorts`
  covers only that section)
- take a 5 minute break when you really do need to get in
- see how many tabs he has closed

## Dance deals

Now and then, after "Nope not now", he pauses... "...unless... you want to
dance with me?" Say yes and the lights come up, and he dances for a minute to
his own song, calling out each move for you to copy: side to side, squats,
star jumps, knees up, arms up and wiggle, a spin, and a jump for the big
finish. Dance along to the end and he boops the page back open and lets
you stay for 5 minutes. Then he comes back: "Time's up!"

- He offers about one time in four, and never twice within two hours, so
  opening a site over and over hoping for a deal does not work.
- "No thanks", or waiting, closes the tab as usual. So does Stop, part way
  through.
- To try it straight away, click **Make the next one a dance** in the popup,
  then open one of the sites. Dance deals can be switched off there too.

The music is `dance.ogg`, an original song made by
`../mr-blocky-music/make-dance-music.py`. Its sections are timed to his moves
(`DANCE` in `guy.js`), so the two change together.

## Changing how he looks, moves and what he says

Seven settings at the top of `guy.js`:

- `WALK_SPEED`: how fast he walks, in pixels per second. His steps keep pace on
  their own, so his feet never slide. He crosses the whole page, so this also
  sets how long you get before the tab closes.
- `SIZE`: how tall he is, in pixels.
- `LINE`: what he says while shaking his head.
- `GLASSES`: whether he wears round glasses.
- `ARMS`: whether he has arms.
- `COLOR`: his colours.
- `OUTLINE`: how thick the soft outline round him is.

After a change, click the reload arrow on his card at `chrome://extensions`.

## Files

- `manifest.json`: extension manifest (Manifest V3)
- `defaults.js`: default site list and URL matching
- `guy.js`: the character, his animation, his routine and the dance (shared with the Android app)
- `dance.ogg`: the dance music
- `content.js`: decides when to send him in and when to offer a dance, and closes the tab afterwards
- `background.js`: closes the tab and keeps the count
- `popup.html`, `popup.js`: settings
