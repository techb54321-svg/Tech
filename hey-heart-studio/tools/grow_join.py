"""Growing scene as one continuous shot: the height-chart clip flows straight into the playing clip.
Both clips start from the same picture and the camera matches exactly, so at the join only Mia's head and the
Heart move: an optical-flow morph over a third of a second glides them into place (no cut, no fade)."""
import subprocess, sys
import numpy as np, cv2

h_src, p_src, out = sys.argv[1], sys.argv[2], sys.argv[3]
H_END, P_START, N = 90, 1, 8                         # join: height-chart frame 90 (3.75 s) -> playing frame 1

def frames(p):
    cap = cv2.VideoCapture(p); fr = []
    while True:
        ok, f = cap.read()
        if not ok: break
        fr.append(f)
    return fr
H, P = frames(h_src), frames(p_src)
a, b = H[H_END], P[P_START]
ga, gb = cv2.cvtColor(a, cv2.COLOR_BGR2GRAY), cv2.cvtColor(b, cv2.COLOR_BGR2GRAY)
dis = cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
fab, fba = dis.calc(ga, gb, None), dis.calc(gb, ga, None)
hh, ww = ga.shape; gy, gx = np.mgrid[0:hh, 0:ww].astype(np.float32)
def warp(img, flow, t):
    return cv2.remap(img, gx + flow[..., 0] * t, gy + flow[..., 1] * t, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
morph = []
for k in range(1, N + 1):
    t = k / (N + 1); s = t * t * (3 - 2 * t)          # ease in and out
    wa = warp(a, fba, s)                               # a pushed towards b
    wb = warp(b, fab, 1 - s)                           # b pulled back towards a
    morph.append(cv2.addWeighted(wb, s, wa, 1 - s, 0))
seq = H[:H_END + 1] + morph + P[P_START:]

p = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{ww}x{hh}", "-r", "24", "-i", "-",
                      "-an", "-c:v", "libx264", "-crf", "21", "-preset", "slow", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out],
                     stdin=subprocess.PIPE)
for f in seq: p.stdin.write(f.tobytes())
p.stdin.close(); p.wait(); print("done", round(len(seq) / 24, 2), "s")
