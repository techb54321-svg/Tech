#!/usr/bin/env bash
# Makes ../mr-blocky/dance.ogg from dance-elevenlabs.mp3, the track as ElevenLabs made it.
#
# The track is 120 beats a minute, as the dance is, but its kick drum lands 42 ms after
# each half second. Trimming those 42 ms from the start puts every beat where his bounces
# land, and puts its final chord on his ta-da, 64 seconds in. It is also turned down
# 2.7 dB, to the loudness of the music before it (-15 LUFS), and given a gentle end.
#
# find-the-beat.py measures where the kick lands: run it on a new track to find the
# trim, then on the result, which should say 24 ms (how late it hears a kick that is
# exactly on the beat).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ffmpeg -v error -y -i "$HERE/dance-elevenlabs.mp3" \
  -af "atrim=start=0.042,asetpts=PTS-STARTPTS,volume=-2.7dB,afade=t=in:d=0.005,afade=t=out:st=69.4:d=0.5" \
  -t 69.9 -ar 48000 -ac 2 -c:a libvorbis -q:a 5 "$HERE/../mr-blocky/dance.ogg"
echo "Made ../mr-blocky/dance.ogg"
