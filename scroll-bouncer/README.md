# Scroll Bouncer

A browser extension that helps you stop scrolling. Open a social media site and a
little round guy drops in at the top of the page, toddles over to the close
button and boops it with his nose. The page goes dark, he turns to face you,
shakes his head and says "Nope not now", and the tab is gone.

## Install

**Chrome, Edge, Brave, Arc (desktop)**

1. Go to `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and pick this `scroll-bouncer` folder.

**Firefox (desktop)**: open `about:debugging#/runtime/this-firefox`, click
**Load Temporary Add-on**, and pick `manifest.json`.

**Phone**: this covers social media opened in a browser, not the native apps.
Firefox for Android runs extensions; iPhone needs the extension wrapped as a
Safari Web Extension in Xcode.

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
  their own, so his feet never slide.
- `WALK_DISTANCE`: how far from the close button he drops in, in pixels.
- `SIZE`: how tall he is, in pixels.
- `LINE`: what he says while shaking his head.
- `GLASSES`: whether he wears round glasses.
- `COLOR`: his colours.

After a change, click the reload arrow on his card at `chrome://extensions`.

## Files

- `manifest.json`: extension manifest (Manifest V3)
- `defaults.js`: default site list and URL matching
- `content.js`: the character and his animation
- `background.js`: closes the tab and keeps the count
- `popup.html`, `popup.js`: settings
