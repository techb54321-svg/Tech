# Mr Blocky demo video

`mr-blocky-demo.mp4` is a 20 second video, 1080 by 1920, with music. Someone
taps Instagram on their phone and starts scrolling. Mr Blocky walks across the
top, boops the close button and says "Nope not now", and the phone is back on
its home screen.

The music is an original cartoon score, made from scratch by `make-music.js`, so
there is nothing to license. A bouncy oom-pah tune plays while the feed scrolls
and grinds to a halt when he turns up. He tiptoes in to a pizzicato on every
footstep, a slide whistle rises as he winds up, there is a boop and a boing as
he hits the button, a kazoo goes "nuh-uh" with each shake of his head, and the
tune comes back, sunny, for the ending.

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

That needs Node with Playwright, and ffmpeg. It takes about a minute. To change
only the music, edit the score at the bottom of `make-music.js` and run:

```bash
node make-demo.js --music-only
```

That keeps the picture and takes a few seconds.

- `demo.html`: the frame of the video, with the captions and the opening and
  closing cards
- `phone.html`: the phone's home screen, the feed and its photos, and the
  timing of the story
- `make-demo.js`: steps through the story a frame at a time and builds the
  video. It serves the project folder on a local address while it works,
  because browsers will not load a font straight from a file on disk.
- `timeline.json`: when each of his moves happens in the video (every
  footstep, the boop, each shake of his head), noted by `make-demo.js` as it
  records, so the music lands on them even if he changes
- `make-music.js`: the synthesizer and the score
- `fonts/`: Grand Hotel, a free script font close to Instagram's lettering,
  under the SIL Open Font License (`GrandHotel-OFL.txt`)
