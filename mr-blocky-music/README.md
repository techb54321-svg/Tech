# Mr Blocky's dance music

`make-dance-music.py` makes `../mr-blocky/dance.ogg`: about a minute of upbeat
disco-funk that Mr Blocky dances to when someone takes him up on a dance deal.

```bash
python3 make-dance-music.py
```

The song is written out in the script as notes, for brass, electric piano,
bass, strings, glockenspiel, clavinet, drums and a round of applause at the
end. The script saves it as a MIDI file, plays that through fluidsynth with the
MuseScore General sound bank, sets the loudness with ffmpeg, and saves the
result as an .ogg file. On Ubuntu, the tools are:

```bash
sudo apt-get install fluidsynth musescore-general-soundfont ffmpeg
```

It runs at 120 beats a minute, so a bar lasts two seconds, and its sections
line up with his moves in `DANCE` in `../mr-blocky/guy.js`:

| Bars  | Seconds | Move |
|-------|---------|------|
| 0-1   | 0-4     | get ready (a count-in) |
| 2-9   | 4-20    | side to side, then move your hips |
| 10-17 | 20-36   | star jumps, a brass hit on each one |
| 18-23 | 36-48   | knees up, a cowbell on each step |
| 24-28 | 48-58   | arms up and wiggle |
| 29-31 | 58-64   | big finish: shake your booty, then get ready to jump |
| 32    | 64      | ta-da, then applause |

Change a section's length in one place and change it in the other too.

## Licences

The song is original. The instrument sounds come from MuseScore General
(MIT licence, parts public domain or CC0), by S. Christian Collins, built on
Fluid (R3) by Frank Wen (MIT), so the finished file can be shipped freely.
