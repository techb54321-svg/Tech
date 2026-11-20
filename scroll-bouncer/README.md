# Scroll Bouncer

A browser extension that helps you stop scrolling. Open a social media site and a
little round guy walks in from the left, toddles all the way across the top of
the page to the close button and boops it with his nose. The page goes dark, he
turns to face you, shakes his head, wags a hand and says "Nope not now", and the
tab is gone.

## Install

**Chrome, Edge, Brave, Arc (desktop)**

1. Go to `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and pick this `scroll-bouncer` folder.

**Firefox (desktop)**: open `about:debugging#/runtime/this-firefox`, click
**Load Temporary Add-on**, and pick `manifest.json`.

**Safari on a Mac, and Safari on an iPhone or iPad**

Safari only runs extensions that are wrapped in an app, which is done with Xcode
on a Mac. These steps have not been tested, and menu names can differ a little
between versions.

1. Install Xcode from the Mac App Store and open it once. In Xcode's Settings,
   under Accounts, add your Apple ID.
2. In Terminal, run this. Change the path if the folder is somewhere else, and
   replace `YOURNAME` with anything unique:

   ```bash
   xcrun safari-web-extension-converter ~/scroll-bouncer --app-name "Scroll Bouncer" --bundle-identifier com.YOURNAME.scrollbouncer
   ```

   It creates an Xcode project holding a Mac app and an iPhone app, and opens it.
3. In Xcode, click the project, and for each target choose your Apple ID as the
   Team under Signing & Capabilities.
4. **Mac:** choose the `Scroll Bouncer (macOS)` scheme and press Run. Then in
   Safari's Settings, under Extensions, turn on Scroll Bouncer and allow it on
   every website. If it is not listed, turn on "Allow unsigned extensions" in
   Safari's developer settings.
5. **iPhone:** turn on Developer Mode on the phone (Settings, Privacy &
   Security), plug it in, choose the `Scroll Bouncer (iOS)` scheme and your
   phone, and press Run. Then on the phone open Settings, Safari, Extensions,
   turn on Scroll Bouncer and allow it on all websites.

With a free Apple ID the iPhone app stops working after 7 days and has to be run
from Xcode again; a paid Apple Developer membership removes that limit. After
updating this folder, press Run again to rebuild.

**Android**: Firefox for Android can run it, but only once it is published on
addons.mozilla.org.

On any phone this covers social media opened in the browser, not the Instagram
or TikTok apps themselves.

## Using it

Click the toolbar icon to:

- turn the bouncer on or off
- add or remove sites (`reddit.com` covers the whole site, `youtube.com/shorts`
  covers only that section)
- take a 5 minute break when you really do need to get in
- see how many tabs he has closed

## Changing how he looks, moves and what he says

Six settings at the top of `content.js`:

- `WALK_SPEED`: how fast he walks, in pixels per second. His steps keep pace on
  their own, so his feet never slide. He crosses the whole page, so this also
  sets how long you get before the tab closes.
- `SIZE`: how tall he is, in pixels.
- `LINE`: what he says while shaking his head.
- `GLASSES`: whether he wears round glasses.
- `ARMS`: whether he has arms.
- `COLOR`: his colours.

After a change, click the reload arrow on his card at `chrome://extensions`.

## Files

- `manifest.json`: extension manifest (Manifest V3)
- `defaults.js`: default site list and URL matching
- `content.js`: the character and his animation
- `background.js`: closes the tab and keeps the count
- `popup.html`, `popup.js`: settings
