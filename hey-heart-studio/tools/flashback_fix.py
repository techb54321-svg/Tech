"""Doctor flashback: the Heart in the older doctor shot is a dark maroon. Recolour it to the bright felt red used
everywhere else, then add the soft white 'memory' edges. usage: flashback_fix.py v19-listen.mp4 out.mp4 seconds"""
import subprocess, sys
import cv2, numpy as np
src, out, secs = sys.argv[1], sys.argv[2], float(sys.argv[3])
cap = cv2.VideoCapture(src); ok, f = cap.read(); H, W = f.shape[:2]
X0, Y0, X1, Y1 = 280, 420, 490, 630                      # the Heart sits here on the couch for the whole shot
yy, xx = np.mgrid[0:H, 0:W]
d = np.sqrt(((xx - W / 2) / (W / 2)) ** 2 + ((yy - H / 2) / (H / 2)) ** 2)
vig = (np.clip((d - 0.72) / 0.55, 0, 1) ** 1.6 * 235 / 255)[..., None]        # soft white edges
white = np.array([240, 250, 255], np.float32)                                 # BGR
p = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", "24", "-i", "-",
                      "-vf", "eq=brightness=0.03:saturation=0.9", "-c:v", "libx264", "-crf", "21", "-preset", "slow",
                      "-pix_fmt", "yuv420p", "-movflags", "+faststart", out], stdin=subprocess.PIPE)
n = 0
while ok and n < secs * 24:
    box = f[Y0:Y1, X0:X1]
    hsv = cv2.cvtColor(box, cv2.COLOR_BGR2HSV).astype(np.float32)
    h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    m = (((h >= 160) | (h <= 4)) & (s > 95) & (v > 35)).astype(np.float32)   # maroon felt (not skin, not the yellow headphones)
    m = cv2.GaussianBlur(cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8)), (0, 0), 1.5)[..., None]
    new = hsv.copy()
    new[..., 0] = 178                                                           # bright red hue
    new[..., 1] = np.clip(s * 1.22, 0, 255)
    new[..., 2] = np.clip(v * 1.2 + 10, 0, 255)                              # lift it to the brightness of the other scenes
    rgb = cv2.cvtColor(new.astype(np.uint8), cv2.COLOR_HSV2BGR).astype(np.float32)
    g = f.astype(np.float32); g[Y0:Y1, X0:X1] = box * (1 - m) + rgb * m
    g = g * (1 - vig) + white * vig
    p.stdin.write(np.clip(g, 0, 255).astype(np.uint8).tobytes())
    ok, f = cap.read(); n += 1
p.stdin.close(); p.wait(); print("done", out, n, "frames")
