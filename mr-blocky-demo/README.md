# Mr Blocky demo video

`mr-blocky-demo.mp4` is a 20 second video, 1080 by 1920, with no sound. Someone
taps Instagram on their phone and starts scrolling. Mr Blocky walks across the
top, boops the close button and says "Nope not now", and the phone is back on
its home screen.

Mr Blocky is drawn by `../mr-blocky/guy.js`, the same file the browser extension
and the Android app use, so he looks and moves exactly as he does for real.
Everything else is recreated for the video: the phone, the Instagram-style feed,
the photos in it (drawn from scratch), and the people and accounts (made up).

Instagram's name, icon and the look of its app belong to Meta. Showing them is
fine for explaining what Mr Blocky does, but check Meta's brand rules before
using this video in ads or an app store listing. The version before this one,
with a made-up "Social" app in place of Instagram, is in the git history.

## Making it again

After changing how he looks or moves, or the words on screen:

```bash
node make-demo.js
```

That needs Node with Playwright, and ffmpeg. It takes about a minute.

- `demo.html`: the frame of the video, with the captions and the opening and
  closing cards
- `phone.html`: the phone's home screen, the feed and its photos, and the
  timing of the story
- `make-demo.js`: steps through the story a frame at a time and builds the
  video. It serves the project folder on a local address while it works,
  because browsers will not load a font straight from a file on disk.
- `fonts/`: Grand Hotel, a free script font close to Instagram's lettering,
  under the SIL Open Font License (`GrandHotel-OFL.txt`)
