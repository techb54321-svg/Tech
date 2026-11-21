# Mr Blocky demo video

`mr-blocky-demo.mp4` is a 20 second video, 1080 by 1920, with music. Someone
taps Instagram on their phone and starts scrolling. Mr Blocky walks across the
top, boops the close button and says "Nope not now", and the phone is back on
its home screen.

The music is an original, happy ukulele song with a whistled tune, made from
scratch by `make-music.js`, so there is nothing to license. Its beat is set by
his footsteps, so he walks in time with it. The band drops back to a quiet,
sneaky little tune while he tiptoes across, a slide whistle rises as he winds
up, there is a boop and a boing as he hits the button, and in the dark the
whistle sings "Nope not now" to the song's first three notes. The song comes
back for the ending, with a ta-da on the closing card.

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

## The Everygen dance video

`mr-blocky-dance-everygen.mp4` is a 16-second clip of Mr Blocky dancing under
disco lights, for social media. It was made with Everygen (Kling 3.0) as two
8-second clips, one groovy and one funny, each starting and ending on the same
picture of him from the app, so they join seamlessly and the video loops. His
own dance song (`../mr-blocky/dance.ogg`, from 49.65 s) plays over it, lined up
so the song's ta-da lands on his ta-da.
