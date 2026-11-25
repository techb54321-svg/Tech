# Mr Blocky's dance music

`../mr-blocky/dance.ogg` is the song Mr Blocky dances to when someone takes him up
on a dance deal: a minute of funky 1970s disco, made with ElevenLabs Music.

## How it was made

ElevenLabs Music (model `eleven_music_v2_5`, 70 seconds, instrumental) was given
this description:

> Upbeat funky 1970s disco instrumental at a steady 120 BPM in 4/4:
> four-on-the-floor kick, crisp open hi-hats on the offbeats, slap bass, wah-wah
> rhythm guitar, punchy brass stabs, lush strings and a cowbell, bright, fun and
> very danceable. It opens with a short drum count-in, grooves at full energy with
> brass hits and a cowbell section in the middle, builds with a snare drum roll
> near the end, and finishes on one big brass-and-cymbal hit that rings out.

It made four takes, and take 4 was chosen. `dance-elevenlabs.mp3` is that take
exactly as ElevenLabs made it. `fit-dance-music.sh` turns it into
`../mr-blocky/dance.ogg`:

```bash
./fit-dance-music.sh
```

The dance is timed to 120 beats a minute, a beat every half second, and so is the
take, but its kick drum lands 42 ms after each half second. The script trims those
42 ms from the start, so every beat falls where his bounces land, turns it down
2.7 dB to the loudness of the music before it (-15 LUFS), and gives it a gentle
end. `find-the-beat.py` measures where the kick lands (it needs numpy and scipy):

```bash
python3 find-the-beat.py ../mr-blocky/dance.ogg
```

It hears a kick that is exactly on the beat 24 ms late, so 24 ms means lined up.
For a new track, take 24 ms from what it says about the original to find the trim.

## How it lines up with the dance

| Seconds | The song                  | His moves (`DANCE` in `../mr-blocky/guy.js`)   |
|---------|---------------------------|------------------------------------------------|
| 0-8     | drums only                | get ready, then side to side from 4 s          |
| 8-64    | the whole band            | side to side, move your hips, star jumps, knees up, arms up and wiggle, shake your booty, get ready to jump |
| 64      | one big final chord       | ta-da                                          |
| 64-70   | the chord rings out       | he holds his ta-da and says "OK, you did good!" |

The final chord lands on his ta-da because both are 64 seconds in. If the dance's
length changes, the song has to change with it.

## Licence

The song was made on a paid ElevenLabs plan (Creator), whose terms allow music
made with it to be used commercially, as in an app or extension that is
published.

## The song before it

`make-dance-music.py` makes the original dance song, written out as notes for
brass, electric piano, bass, strings, glockenspiel, clavinet, drums and a round
of applause, and played through fluidsynth with the MuseScore General sound bank
(MIT licence, parts public domain or CC0, by S. Christian Collins, built on Fluid
(R3) by Frank Wen, MIT). It saves it as `dance-original.ogg` here, so it never
replaces the ElevenLabs song by accident:

```bash
sudo apt-get install fluidsynth musescore-general-soundfont ffmpeg
python3 make-dance-music.py
```

Its sections were written to fit the moves as they were then (a disco point, a
march and a spin, since replaced).
