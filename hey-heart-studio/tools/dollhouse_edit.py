"""Dolls-house scene from two AI shots with a static camera: A = doors swing open, B = doors snap shut.
The Heart and Mia play at natural speed (A, B, A, B joined end to start), while each top room, with its door, is
laid in from the frame that shows the door state the narration needs: left door snaps on "lub", right door on "dub".
usage: dollhouse_edit.py doors-open.mp4 doors-shut.mp4 out.mp4"""
import subprocess, sys
import cv2, numpy as np

A_SRC, B_SRC, OUT = sys.argv[1:4]
FPS, DUR = 24, 17.1
def load(p):
    cap = cv2.VideoCapture(p); fr = []; ok, f = cap.read()
    while ok: fr.append(f); ok, f = cap.read()
    return fr
A, B = load(A_SRC), load(B_SRC); H, W = A[0].shape[:2]
OPEN0, OPEN1 = 21, 39          # in A: doors start to swing / are fully open
SNAP = 32                      # in B: the frame where the doors snap shut (moves over frames 29..35)

# when things happen (seconds, scene clock = narration + 0.45 s lead)
LUB, DUB, NO, LUB2, DUB2 = 5.16, 5.84, 10.04, 14.65, 15.25
OPENS = [2.80, 7.75, 13.15]                          # doors start to open (both together)
SHUTS = {"L": [LUB, NO, LUB2], "R": [DUB, NO, DUB2]}  # each door's snaps

def door_frame(side, t):
    """Which source frame shows this door's state at time t: ('A'|'B', frame)."""
    last_open = max([o for o in OPENS if o <= t], default=None)
    last_shut = max([s for s in SHUTS[side] if s - 0.125 <= t], default=None)
    if last_open is None: return A, 8                                        # closed, before anything happens
    if last_shut is None or last_open > last_shut:                           # opening or open
        return A, int(min(OPEN1 + 6, OPEN0 + (t - last_open) * FPS))
    return B, int(min(SNAP + 8, SNAP + (t - last_shut) * FPS))               # snapping shut or closed

def bg_frame(t):
    """Heart and Mia at natural speed; the Heart's little jump (B, frame ~31) lands on the door snaps."""
    if t < 3.87:  return A, min(len(A) - 1, int(round((t + 1.17) * FPS)))
    if t < 8.91:  return B, min(len(B) - 1, int(round((t - 3.87) * FPS)))
    if t < 13.36: return A, min(len(A) - 1, int(round((t - 8.91) * FPS * 1.133)))
    return B, min(len(B) - 1, int(round((t - 13.36) * FPS)))

def soft_rect(x0, y0, x1, y1):
    m = np.zeros((H, W), np.float32); m[y0:y1, x0:x1] = 1
    return cv2.GaussianBlur(m, (0, 0), 5)[..., None]
MASK = {"L": soft_rect(524, 166, 957, 545), "R": soft_rect(963, 166, 1396, 545)}   # the two top rooms
# the Heart's pointer tip rests on the shelf at the left door's bottom-left corner in some frames: keep that
# little corner from the Heart's own footage, so no stray pointer tip is left behind
notch = np.zeros((H, W), np.float32); notch[531:560, 690:742] = 1
MASK["L"] = MASK["L"] * (1 - cv2.GaussianBlur(notch, (0, 0), 2)[..., None])

p = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                      "-vf", "scale=1280:720:flags=lanczos", "-c:v", "libx264", "-crf", "20", "-preset", "slow", "-pix_fmt", "yuv420p",
                      "-movflags", "+faststart", OUT], stdin=subprocess.PIPE)
for n in range(int(DUR * FPS)):
    t = n / FPS
    clip, k = bg_frame(t); g = clip[k].astype(np.float32)
    for side in "LR":
        c, k = door_frame(side, t); m = MASK[side]
        g = g * (1 - m) + c[min(k, len(c) - 1)].astype(np.float32) * m
    p.stdin.write(np.clip(g, 0, 255).astype(np.uint8).tobytes())
p.stdin.close(); p.wait(); print("done", OUT)
