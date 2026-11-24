"""Train lap (AI shot): the felt heart printed on the body mat wanders during the take (chest -> face -> legs).
The camera is static, so the mat's upper body inside the track is held to the first frame the whole time, and a patch
over the legs is held to the first frame whenever the train is not passing over it."""
import subprocess, sys
import cv2, numpy as np
src, out = sys.argv[1], sys.argv[2]
cap = cv2.VideoCapture(src); ok, f0 = cap.read(); H, W = f0.shape[:2]

def soft(poly_or_ell, blur=8):
    m = np.zeros((H, W), np.float32)
    if len(poly_or_ell) == 4 and not isinstance(poly_or_ell[0], tuple):
        cx, cy, rx, ry = poly_or_ell; cv2.ellipse(m, (cx, cy), (rx, ry), 0, 0, 360, 1, -1)
    else:
        cv2.fillPoly(m, [np.array(poly_or_ell, np.int32)], 1)
    return cv2.GaussianBlur(m, (0, 0), blur)[..., None]

# upper body inside the track loop (1920x1080 pixels), inset from the rails
UPPER = soft([(965, 230), (1040, 185), (1270, 180), (1345, 225), (1345, 450), (1300, 600), (1290, 680),
              (1000, 680), (995, 600), (960, 470)])
LOWER = soft([(1000, 600), (1290, 600), (1290, 870), (1000, 870)], 10)
# after ~1.5 s the stray heart sits still on the legs; a frame with the train far away shows it on its own
cap.set(1, int(6.0 * 24)); _, P6 = cap.read(); cap.set(1, 1)
p = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", "24", "-i", "-",
                      "-vf", "scale=1280:720:flags=lanczos", "-c:v", "libx264", "-crf", "21", "-preset", "slow", "-pix_fmt", "yuv420p",
                      "-movflags", "+faststart", out], stdin=subprocess.PIPE)
f = f0; n = 0
while ok:
    g = f * (1 - UPPER) + f0 * UPPER
    if n < 36:                         # first 1.5 s: the train is still up the left side, hold the whole lower body
        occ = np.zeros((H, W, 1), np.float32)
    else:                              # keep only what differs from BOTH the clean mat and the stray-heart mat: the train
        d0 = np.abs(f.astype(np.int16) - f0).max(2); d6 = np.abs(f.astype(np.int16) - P6).max(2)
        occ = (np.minimum(d0, d6) > 34).astype(np.uint8)
        occ = cv2.dilate(cv2.morphologyEx(occ, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8)), np.ones((15, 15), np.uint8))
        occ = cv2.GaussianBlur(occ.astype(np.float32), (0, 0), 4)[..., None]
    m = LOWER * (1 - occ)
    g = g * (1 - m) + f0 * m
    p.stdin.write(g.astype(np.uint8).tobytes())
    ok, f = cap.read(); n += 1
p.stdin.close(); p.wait(); print("done", out)
