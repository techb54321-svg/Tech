#!/usr/bin/env python3
"""Makes Mr Blocky's dance music: a minute of upbeat disco-funk to dance to.

    python3 make-dance-music.py [output.ogg]

The song is written out below as notes. This saves it as a MIDI file, plays it
through fluidsynth with the MuseScore General sound bank (recordings of real
instruments, MIT licence, parts public domain), evens out the loudness with
ffmpeg and saves it as an .ogg file, by default ../mr-blocky/dance.ogg.

Needs fluidsynth, the MuseScore General sound bank and ffmpeg. On Ubuntu:

    sudo apt-get install fluidsynth musescore-general-soundfont ffmpeg

The song is 120 beats a minute, so a bar lasts two seconds. Its sections line
up with the moves in guy.js (DANCE there), so if a section changes length here,
change it there too:

    bars  0-1    0-4 s   get ready
    bars  2-9    4-20 s  dance
    bars 10-17  20-36 s  star jumps, one on beats 1 and 3
    bars 18-23  36-48 s  march on the spot, a step every beat
    bars 24-28  48-58 s  arms up and wiggle
    bars 29-31  58-64 s  big finish
    bar  32     64 s     ta-da, then applause
"""
import json
import os
import random
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
SOUNDS = '/usr/share/sounds/sf3/MuseScore_General_Full.sf3'
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '..', 'mr-blocky', 'dance.ogg')

BPM = 120
PPQ = 480                  # MIDI ticks to a beat
random.seed(7)             # the same small human wobbles every time


def pitch(name):
    """MIDI number of a note name such as 'C4' (60) or 'F#2'."""
    letter, rest = name[0], name[1:]
    shift = 0
    while rest and rest[0] in '#b':
        shift += 1 if rest[0] == '#' else -1
        rest = rest[1:]
    return 12 * (int(rest) + 1) + {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}[letter] + shift


class Part:
    """One instrument on its own MIDI channel. Times are in beats from the start."""

    def __init__(self, channel, program, volume, pan=64, reverb=40, chorus=0):
        self.channel = channel
        self.events = []   # (tick, order, bytes); order puts note-offs before note-ons at the same tick
        self.at(0, 0xC0, program)
        self.control(0, 7, volume)
        self.control(0, 10, pan)
        self.control(0, 91, reverb)
        self.control(0, 93, chorus)

    def at(self, beat, status, *data, order=1):
        tick = max(0, round(beat * PPQ))
        self.events.append((tick, order, bytes([status | self.channel, *data])))

    def control(self, beat, number, value):
        self.at(beat, 0xB0, number, max(0, min(127, round(value))))

    def note(self, beat, name, length, velocity=90, loose=True):
        """A note, a little early or late and a little harder or softer, as a person plays."""
        nudge = random.uniform(-0.012, 0.012) if loose else 0
        start = beat + nudge
        velocity = velocity + (random.randint(-6, 6) if loose else 0)
        number = name if isinstance(name, int) else pitch(name)
        self.at(start, 0x90, number, max(1, min(127, velocity)), order=1)
        self.at(start + max(0.05, length), 0x80, number, 0, order=0)

    def chord(self, beat, names, length, velocity=80):
        for name in names:
            self.note(beat, name, length, velocity)


# General MIDI drum sounds.
KICK, SIDESTICK, SNARE, CLAP, HAT, OPEN_HAT, CRASH, TAMB = 36, 37, 38, 39, 42, 46, 49, 54
COWBELL, CONGA_HI, CONGA_LO, CABASA, CLAVES = 56, 62, 64, 69, 75
TOM_HI, TOM_MID, TOM_LOWMID, TOM_LOW = 50, 48, 47, 45

brass = Part(0, 61, 110, pan=64, reverb=45)            # brass section: the tune
keys = Part(1, 4, 88, pan=44, reverb=35, chorus=30)    # electric piano
bass = Part(2, 33, 104, pan=64, reverb=5)              # electric bass, fingered
strings = Part(3, 48, 92, pan=86, reverb=70)           # string section
glock = Part(4, 9, 112, pan=90, reverb=55)             # glockenspiel
clav = Part(5, 7, 100, pan=80, reverb=25)              # clavinet
crowd = Part(6, 126, 127, pan=64, reverb=40)           # applause
drums = Part(9, 0, 100, pan=64, reverb=22)

# Chord shapes: the notes the piano and strings hold, and the root for the bass.
CHORDS = {
    'C': (['C4', 'E4', 'G4'], 'C2'), 'Am': (['A3', 'C4', 'E4'], 'A1'), 'F': (['A3', 'C4', 'F4'], 'F1'),
    'G': (['B3', 'D4', 'G4'], 'G1'), 'Em': (['B3', 'E4', 'G4'], 'E1'), 'Dm': (['A3', 'D4', 'F4'], 'D2'),
    'G7': (['B3', 'F4', 'G4'], 'G1'), 'Am7': (['C4', 'E4', 'G4', 'A4'], 'A1'), 'Dm7': (['C4', 'D4', 'F4', 'A4'], 'D2'),
}
BRASS_STAB = {'F': ['A4', 'C5', 'F5'], 'G': ['B4', 'D5', 'G5'], 'Em': ['B4', 'E5', 'G5'], 'Am': ['C5', 'E5', 'A5']}


def up(name, octaves=1):
    return name[:-1] + str(int(name[-1]) + octaves)


def bar(n):
    """First beat of bar n."""
    return 4 * n


def play_line(part, start, line, velocity=95, short=0.88):
    for beat, name, length in line:
        part.note(start + beat, name, length * short, velocity)


def disco_bass(start, chord, velocity=100):
    """Eighth notes jumping between the root and the octave above: the disco bass."""
    low = CHORDS[chord][1]
    for e in range(8):
        bass.note(start + e / 2, low if e % 2 == 0 else up(low), 0.42, velocity if e % 2 == 0 else velocity - 14)


def disco_drums(start, *, cowbell=False, tambourine=True, crash=False):
    for b in range(4):
        drums.note(start + b, KICK, 0.25, 112 if b % 2 == 0 else 104)
        drums.note(start + b + 0.5, OPEN_HAT, 0.25, 82)
        drums.note(start + b, HAT, 0.1, 58)
        if cowbell:
            drums.note(start + b, COWBELL, 0.1, 74 if b % 2 == 0 else 60)
    for b in (1, 3):
        drums.note(start + b, CLAP, 0.25, 96)
        drums.note(start + b, SNARE, 0.25, 62)
    if tambourine:
        for s in range(16):
            drums.note(start + s / 4, TAMB, 0.1, 56 if s % 2 else 70)
    if crash:
        drums.note(start, CRASH, 1, 92)


def offbeat_keys(start, chord, velocity=72):
    """Piano chords on the offbeats, the bounce in disco."""
    for b in range(4):
        keys.chord(start + b + 0.5, CHORDS[chord][0], 0.35, velocity)


def pad(start, chord, beats=4, velocity=62):
    strings.chord(start, [up(n) for n in CHORDS[chord][0]][:3], beats * 0.98, velocity)


def string_run(start, notes, velocity=70):
    """A quick rush up the scale in sixteenths, into the next section."""
    for i, name in enumerate(notes):
        strings.note(start + i / 4, name, 0.3, velocity + i * 3)


# The tune. It starts with the three notes Mr Blocky says "Nope not now" to.
HOOK = [
    (0, 'E5', .5), (.5, 'D5', .5), (1, 'C5', 1), (2, 'G4', .5), (2.5, 'C5', .5), (3, 'E5', 1),
    (4.5, 'E5', .5), (5, 'D5', .5), (5.5, 'C5', .5), (6, 'A4', 1), (7, 'C5', .5), (7.5, 'D5', .5),
    (8, 'F5', .5), (8.5, 'E5', .5), (9, 'D5', 1), (10, 'A4', .5), (10.5, 'D5', .5), (11, 'F5', 1),
    (12.5, 'F5', .5), (13, 'E5', .5), (13.5, 'D5', .5), (14, 'G5', 2),
]
ANSWER = [
    (16, 'E5', .5), (16.5, 'D5', .5), (17, 'C5', 1), (18, 'G4', .5), (18.5, 'C5', .5), (19, 'E5', 1),
    (20.5, 'A5', .5), (21, 'G5', .5), (21.5, 'E5', .5), (22, 'C5', 1), (23, 'D5', .5), (23.5, 'E5', .5),
    (24, 'F5', 1), (25, 'A5', 1), (26, 'G5', .5), (26.5, 'F5', .5), (27, 'E5', .5), (27.5, 'D5', .5),
    (28, 'D5', .5), (28.5, 'E5', .5), (29, 'D5', 1), (30, 'B4', 1), (31, 'G4', 1),
]

# ---- Bars 0-1: get ready. Four clicks to count in, then a build. ------------------
for b in range(4):
    drums.note(b, CLAVES, 0.2, 92 if b == 0 else 80)
start = bar(1)
for b in range(4):
    drums.note(start + b, KICK, 0.25, 96)
for e in range(8):
    drums.note(start + e / 2, HAT, 0.1, 50 + 4 * e)
for s in range(8):
    drums.note(start + 2 + s / 4, SNARE, 0.2, 50 + 8 * s)
keys.chord(start, CHORDS['G7'][0], 3.6, 66)
strings.control(start, 11, 40)
for i in range(8):
    strings.control(start + i / 2, 11, 40 + 11 * i)
pad(start, 'G', 4, 70)
for b, name in [(0, 'G1'), (1, 'G1'), (2, 'G1'), (2.5, 'A1'), (3, 'B1'), (3.5, 'D2')]:
    bass.note(start + b, name, 0.45, 96)
brass.chord(start + 3.5, ['B4', 'D5', 'G5'], 0.4, 88)

# ---- Bars 2-9: dance. The tune on brass over the full band. ------------------------
strings.control(bar(2), 11, 110)
for i, chord in enumerate(['C', 'Am', 'F', 'G', 'C', 'Am', 'F', 'G']):
    start = bar(2 + i)
    disco_bass(start, chord)
    disco_drums(start, crash=i in (0, 4))
    offbeat_keys(start, chord)
    pad(start, chord, velocity=56)
play_line(brass, bar(2), HOOK + ANSWER)
string_run(bar(9) + 2, ['G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F5', 'G5'])

# ---- Bars 10-17: star jumps. A brass hit for each jump, on beats 1 and 3, with the
# strings soaring above. ------------------------------------------------------------
soar = [('A5', 4), ('B5', 2), ('D6', 2), ('G5', 4), ('E5', 2), ('A5', 2), ('C6', 4), ('B5', 2), ('D6', 2), ('A5', 4), ('B5', 2), ('G5', 2)]
for i, chord in enumerate(['F', 'G', 'Em', 'Am', 'F', 'G', 'Am', 'G']):
    start = bar(10 + i)
    disco_bass(start, chord, 106)
    disco_drums(start, crash=i % 2 == 0)
    offbeat_keys(start, chord, 76)
    pad(start, chord, velocity=60)
    for b in (0, 2):
        brass.chord(start + b, BRASS_STAB[chord], 0.4, 104 if b == 0 else 96)
    if i % 2 == 1:
        brass.chord(start + 3.5, BRASS_STAB[chord], 0.3, 84)
beat = bar(10)
for name, length in soar:
    strings.note(beat, name, length * 0.97, 76)
    beat += length
string_run(bar(17) + 2, ['G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F5', 'G5'])

# ---- Bars 18-23: march on the spot. The tune comes back with a cowbell on every
# step and a glockenspiel on top. -----------------------------------------------------
march = HOOK + [
    (16, 'E5', .5), (16.5, 'D5', .5), (17, 'C5', 1), (18, 'G4', .5), (18.5, 'C5', .5), (19, 'E5', 1),
    (20, 'D5', 1), (21, 'B4', 1), (22, 'G4', 1), (23, 'G4', .5), (23.5, 'B4', .5),
]
for i, chord in enumerate(['C', 'Am', 'F', 'G', 'C', 'G']):
    start = bar(18 + i)
    disco_bass(start, chord)
    disco_drums(start, cowbell=True, tambourine=False, crash=i == 0)
    offbeat_keys(start, chord)
    pad(start, chord, velocity=56)
play_line(brass, bar(18), march, 92)
play_line(glock, bar(18), [(b, up(n), l) for b, n, l in march], 96, short=1)

# ---- Bars 24-28: arms up and wiggle. The band drops to a funky groove on clavinet,
# bass and congas, then brass climbs out of it. ---------------------------------------
funk_bass = {'Am7': ('A1', 'A2', 'E2', 'G2'), 'Dm7': ('D2', 'D3', 'A2', 'C3'), 'G7': ('G1', 'G2', 'D2', 'F2')}
for i, chord in enumerate(['Am7', 'Am7', 'Dm7', 'Dm7', 'G7']):
    start = bar(24 + i)
    low, high, fifth, seventh = funk_bass[chord]
    for b, name, length in [(0, low, .45), (.75, low, .2), (1.5, high, .2), (2, fifth, .45), (2.75, seventh, .2), (3.5, low, .45)]:
        bass.note(start + b, name, length, 102)
    for b in (0, 1.75, 2.5):
        drums.note(start + b, KICK, 0.25, 104)
    for b in (1, 3):
        drums.note(start + b, CLAP, 0.25, 92)
    for s in range(16):
        drums.note(start + s / 4, CABASA, 0.1, 40 if s % 2 else 52)
    for b, sound in [(0.5, CONGA_LO), (1.5, CONGA_HI), (2, CONGA_LO), (3.25, CONGA_HI), (3.5, CONGA_HI)]:
        drums.note(start + b, sound, 0.2, 76)
    for b in (0.5, 1.25, 1.75, 2.5, 3, 3.75):
        clav.chord(start + b, CHORDS[chord][0], 0.18, 84)
    pad(start, chord, velocity=50)
for b, velocity in [(0, 70), (1, 80), (2, 92), (3, 104)]:
    brass.chord(bar(28) + b, ['B4', 'D5', 'F5'], 0.45, velocity)
string_run(bar(28) + 2, ['G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F5', 'G5'], 74)

# ---- Bars 29-31: big finish. A drum roll that gets faster and louder, everything
# climbing... ------------------------------------------------------------------------
for i, chord in enumerate(['F', 'G', 'G']):
    start = bar(29 + i)
    for b in range(4):
        drums.note(start + b, KICK, 0.25, 108)
    keys.chord(start, CHORDS[chord][0], 3.8, 70)
    pad(start, chord, velocity=66)
for e in range(8):
    drums.note(bar(29) + e / 2, SNARE, 0.2, 60 + 3 * e)
for s in range(16):
    drums.note(bar(30) + s / 4, SNARE, 0.2, 76 + 2 * s)
for s in range(8):
    drums.note(bar(31) + s / 4, SNARE, 0.2, 100 + 2 * s)
for s, tom in enumerate([TOM_HI, TOM_HI, TOM_MID, TOM_MID, TOM_LOWMID, TOM_LOWMID, TOM_LOW, TOM_LOW]):
    drums.note(bar(31) + 2 + s / 4, tom, 0.2, 104 + 2 * s)
for e in range(8):
    bass.note(bar(29) + e / 2, 'F1', 0.42, 100)
    bass.note(bar(30) + e / 2, 'G1', 0.42, 102)
for e, name in enumerate(['G1', 'G1', 'G1', 'G1', 'G#1', 'A1', 'A#1', 'B1']):
    bass.note(bar(31) + e / 2, name, 0.42, 100 + 2 * e)
brass.control(bar(29), 11, 70)
for i in range(16):
    brass.control(bar(29) + i / 2, 11, 70 + 3.5 * i)
brass.chord(bar(29), ['A4', 'C5'], 3.9, 92)
brass.chord(bar(30), ['B4', 'D5'], 3.9, 96)
for b, notes in enumerate([['C5', 'E5'], ['D5', 'F5'], ['D#5', 'F#5'], ['D5', 'G5']]):
    brass.chord(bar(31) + b, notes, 0.9, 100 + 4 * b)
string_run(bar(31), ['G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F5', 'F#5'], 80)
strings.note(bar(31) + 2, 'G5', 2, 96)

# ---- Bar 32: ta-da! Then applause. ----------------------------------------------------
tada = bar(32)
brass.control(tada, 11, 127)
brass.chord(tada, ['C5', 'E5', 'G5', 'C6'], 3, 112)
strings.chord(tada, ['C5', 'E5', 'G5', 'C6'], 4, 92)
keys.chord(tada, ['C4', 'E4', 'G4', 'C5'], 3, 84)
bass.note(tada, 'C2', 3, 110)
for name in ('C1',):
    bass.note(tada, name, 2.5, 80)
drums.note(tada, KICK, 0.5, 120)
drums.note(tada, CRASH, 4, 112)
for i, name in enumerate(['C6', 'E6', 'G6', 'C7']):
    glock.note(tada + i * 0.125, name, 1.5, 84)
crowd.control(tada + 0.5, 11, 100)
crowd.note(tada + 0.5, 'C4', 7, 127, loose=False)
for i in range(13):
    crowd.control(tada + 3 + i / 2, 11, 100 - 7.5 * i)
END_BEAT = tada + 8   # 4 seconds after the ta-da


def write_midi(path, parts):
    def vlq(n):
        out = [n & 0x7F]
        n >>= 7
        while n:
            out.insert(0, (n & 0x7F) | 0x80)
            n >>= 7
        return bytes(out)

    def track(events, end_tick):
        data = bytearray()
        last = 0
        for tick, _, message in sorted(events, key=lambda e: (e[0], e[1])):
            data += vlq(tick - last) + message
            last = tick
        data += vlq(max(0, end_tick - last)) + b'\xff\x2f\x00'
        return b'MTrk' + len(data).to_bytes(4, 'big') + bytes(data)

    end = round(END_BEAT * PPQ)
    tempo = 60_000_000 // BPM
    tracks = [track([(0, 0, b'\xff\x51\x03' + tempo.to_bytes(3, 'big'))], end)]
    tracks += [track(part.events, end) for part in parts]
    header = b'MThd' + (6).to_bytes(4, 'big') + (1).to_bytes(2, 'big') + len(tracks).to_bytes(2, 'big') + PPQ.to_bytes(2, 'big')
    with open(path, 'wb') as f:
        f.write(header + b''.join(tracks))


def run(*args):
    subprocess.run(args, check=True)


with tempfile.TemporaryDirectory() as work:
    midi, raw = os.path.join(work, 'dance.mid'), os.path.join(work, 'raw.wav')
    write_midi(midi, [brass, keys, bass, strings, glock, clav, crowd, drums])
    run('fluidsynth', '-ni', '-q', '-r', '48000', '-g', '0.45',
        '-o', 'synth.reverb.room-size=0.55', '-o', 'synth.reverb.level=0.6',
        '-F', raw, SOUNDS, midi)
    seconds = END_BEAT * 60 / BPM
    # Measure the loudness, then set it to what streaming services aim for, in a second pass.
    measured = subprocess.run(['ffmpeg', '-hide_banner', '-i', raw, '-t', str(seconds), '-af',
                               'loudnorm=I=-15:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'],
                              capture_output=True, text=True, check=True).stderr
    m = json.loads(measured[measured.rindex('{'):measured.rindex('}') + 1])
    level = (f"loudnorm=I=-15:TP=-1.5:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:"
             f"measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true")
    run('ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', raw, '-t', str(seconds),
        '-af', f'{level},afade=t=out:st={seconds - 1.2}:d=1.2', '-ar', '48000',
        '-c:a', 'libvorbis', '-q:a', '5', OUT)
print(f'Wrote {os.path.normpath(OUT)}')
