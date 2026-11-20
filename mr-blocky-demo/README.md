# Mr Blocky demo video

`mr-blocky-demo.mp4` is a 20 second video, 1080 by 1920, with no sound. It shows
someone opening a social app on their phone, Mr Blocky walking across the top,
booping the close button and saying "Nope not now", and the phone back on its
home screen.

The phone and the social app in it are made up for the video. Mr Blocky is not:
he is drawn by `../mr-blocky/guy.js`, the same file the browser extension and
the Android app use, so he looks and moves exactly as he does for real.

## Making it again

After changing how he looks or moves, or the words on screen:

```bash
node make-demo.js
```

That needs Node with Playwright, and ffmpeg. It takes about a minute.

- `demo.html`: the frame of the video, with the captions and the opening and
  closing cards
- `phone.html`: the phone's home screen and the made-up social app, and the
  timing of the story
- `make-demo.js`: steps through the story a frame at a time and builds the video
