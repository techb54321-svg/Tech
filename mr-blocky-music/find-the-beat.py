"""Finds where the kick drum lands, against a steady 120 beats a minute.

    python3 find-the-beat.py file [file ...]     (needs numpy and scipy, and ffmpeg)

Decodes with ffmpeg (the same decoding the finished file is made from), keeps only the
lowest notes, and folds their attacks onto one half-second beat: the peak is where in
each beat the kick lands. Done for the whole track and for each 8 seconds, so any drift
shows. Also reports the first sound, the biggest hit in the last 15 seconds, and
loudness every half second near the end.
"""
import subprocess, sys
import numpy as np
from scipy.signal import butter, sosfiltfilt

SR = 48000
BEAT = 0.5

def decode(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'],
                         check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32)

for path in sys.argv[1:]:
    x = decode(path)
    low = sosfiltfilt(butter(4, [35, 110], btype='band', fs=SR, output='sos'), x)
    hop = 48                                     # 1 ms
    env = np.sqrt(np.convolve(low ** 2, np.ones(240) / 240, mode='same'))[::hop]
    rise = np.maximum(0, np.diff(env, prepend=env[0]))
    t = np.arange(len(rise)) / 1000.0
    def fold(sel):
        phase = np.round((t[sel] % BEAT) * 1000).astype(int) % 500
        h = np.bincount(phase, weights=rise[sel], minlength=500)
        h = np.convolve(np.concatenate([h[-5:], h, h[:5]]), np.ones(5) / 5, mode='same')[5:-5]
        return int(np.argmax(h)), h.max() / (h.mean() + 1e-12)
    whole, strength = fold(np.ones_like(t, dtype=bool))
    windows = []
    for s in range(0, int(t[-1]) - 4, 8):
        p, st = fold((t >= s) & (t < s + 8))
        windows.append(f'{s}s:{p}ms' + ('' if st > 3 else '?'))
    loud = 20 * np.log10(np.sqrt(np.convolve(x ** 2, np.ones(4800) / 4800, mode='same'))[::480] + 1e-9)   # every 10 ms
    first = np.argmax(loud > loud.max() - 40) * 0.01
    full = np.abs(x)
    tail = int(max(0, len(x) / SR - 15) * SR)
    # The biggest broadband hit near the end: the largest jump in loudness.
    jump = np.diff(loud)
    k0 = int(tail / 480)
    big = (k0 + np.argmax(jump[k0:])) * 0.01
    ends = ' '.join(f'{loud[int(s * 100)]:.0f}' for s in np.arange(max(0, len(x) / SR - 12), len(x) / SR - 0.1, 0.5))
    print(f'{path.split("/")[-1]}: kick lands {whole} ms into each beat (clarity {strength:.1f}); by 8 s: {" ".join(windows)}')
    print(f'   first sound at {first:.2f} s; biggest jump in the last 15 s at {big:.2f} s; loudness every 0.5 s over the last 12 s: {ends}')
