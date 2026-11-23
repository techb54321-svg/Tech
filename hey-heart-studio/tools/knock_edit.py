"""Opening door shot, timed to the narration: closed door with two knock bumps on 'Knock, knock!',
door opens on 'Hi Mia', Heart waves through 'it's me, your heart!'. Source: Kling shot (door opens at ~3.1 s)."""
import subprocess, sys
import numpy as np, cv2
src, out = sys.argv[1], sys.argv[2]
LEAD = 0.30                                   # the app starts the voice 300 ms into the scene
KNOCKS = [LEAD + 0.08, LEAD + 0.32]           # "Knock," "knock!"
cap = cv2.VideoCapture(src); fps = cap.get(cv2.CAP_PROP_FPS); fr = []
while True:
    ok, f = cap.read()
    if not ok: break
    fr.append(cv2.resize(f[192:895, 670:1920], (1280, 720), interpolation=cv2.INTER_AREA))   # reframed: door and Heart only, no empty bed
def src_t(t):                                 # output time -> source time
    if t < 1.45: return 1.65 + t              # closed door (static)
    return 3.10 + (t - 1.45) * 0.85           # door opening and the Heart, slightly slowed
DUR = 1.45 + (len(fr) / fps - 3.10) / 0.85
p = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", "1280x720", "-r", "24", "-i", "-",
                      "-c:v", "libx264", "-crf", "18", "-preset", "slow", "-pix_fmt", "yuv420p", out], stdin=subprocess.PIPE)
n = 0
while n / 24 < DUR:
    t = n / 24; f = fr[min(len(fr) - 1, int(round(src_t(t) * fps)))]
    bump = sum(np.exp(-((t - k) / 0.045) ** 2) for k in KNOCKS)        # a quick jolt of the door on each knock
    if bump > 0.01:
        door = f[0:560, 80:480].copy()
        M = np.float32([[1, 0, 7 * bump], [0, 1, -2.5 * bump]])
        f = f.copy(); f[0:560, 80:480] = cv2.warpAffine(door, M, (400, 560), borderMode=cv2.BORDER_REPLICATE)
    p.stdin.write(f.tobytes()); n += 1
p.stdin.close(); p.wait(); print("done", round(DUR, 2), "s")
