"""Train scene edit: show only the parts of the AI lap where the Heart faces the right way.
The Heart sits facing backwards on the engine, so driving away up the right side shows its face from behind the train.
Edit: waiting at the heart -> dissolve -> over the head, down the left side, along the feet -> dissolve -> back at the heart."""
import subprocess, sys
import numpy as np, cv2

src, out = sys.argv[1], sys.argv[2]
cap = cv2.VideoCapture(src); fr = []
while True:
    ok, f = cap.read()
    if not ok: break
    fr.append(cv2.resize(f, (1280, 720), interpolation=cv2.INTER_AREA))
last = len(fr) - 1

seq = [fr[0]] * 46                                        # waiting at the heart, waving at Mia (~1.9 s)
run = fr[32:95]                                           # 1.33-3.95 s: over the head, down the left, along the feet
home = fr[113:last + 1]                                   # 4.71-5.0 s: rolling into the station
def dissolve(a, b, n):
    return [cv2.addWeighted(b, (k + 1) / (n + 1), a, 1 - (k + 1) / (n + 1), 0) for k in range(n)]
seq += dissolve(seq[-1], run[0], 5) + run
seq += dissolve(run[-1], home[0], 9) + home
seq += [home[-1]] * 110                                   # home again, Heart facing Mia (~2.9 s, covers the join-in card)

p = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", "1280x720", "-r", "24", "-i", "-",
                      "-an", "-c:v", "libx264", "-crf", "23", "-preset", "slow", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out],
                     stdin=subprocess.PIPE)
for f in seq: p.stdin.write(f.tobytes())
p.stdin.close(); p.wait(); print("done", len(seq) / 24, "s")
