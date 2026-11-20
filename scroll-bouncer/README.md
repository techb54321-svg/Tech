# Scroll Bouncer

A browser extension that helps you stop scrolling. Open a social media site and a
little guy walks across the top of the page, pokes the close button, and the tab
is gone.

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

## Files

- `manifest.json`: extension manifest (Manifest V3)
- `defaults.js`: default site list and URL matching
- `content.js`: the character and his animation
- `background.js`: closes the tab and keeps the count
- `popup.html`, `popup.js`: settings
