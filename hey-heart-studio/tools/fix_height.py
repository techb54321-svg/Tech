"""Height-chart shot: paint out the vertical pencil strokes the video model drew, and draw a proper
horizontal line at Mia's height, growing as the Heart's pencil moves. Wall-only: never draws over Mia or the Heart."""
import subprocess, sys
import numpy as np, cv2

src, out = sys.argv[1], sys.argv[2]
cap = cv2.VideoCapture(src); frames = []
while True:
    ok, f = cap.read()
    if not ok: break
    frames.append(f)
clean = frames[40].astype(np.int16)                 # before any pencil marks
X0, X1, Y0, Y1 = 800, 834, 166, 272                 # where the stray vertical strokes are
LY, LX0, LX1 = 224, 742, 866                        # the height line: y, left and right ends
F0, F1 = 60, 69                                     # pencil crosses Mia's head height: the mark spreads out from its tip
TIP = 818

def lum(a): return a[..., 0] * .11 + a[..., 1] * .59 + a[..., 2] * .3
H, W = frames[0].shape[:2]
p = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", "24", "-i", "-",
                      "-c:v", "libx264", "-crf", "18", "-preset", "slow", "-pix_fmt", "yuv420p", out], stdin=subprocess.PIPE)
for n, f in enumerate(frames):
    g = f.copy()
    if n > 40:
        reg = g[Y0:Y1, X0:X1]
        L = lum(reg.astype(np.float32)).astype(np.float32)
        closed = cv2.morphologyEx(L, cv2.MORPH_CLOSE, np.ones((1, 15), np.uint8))   # fills thin dark vertical lines
        a = reg.astype(np.int16)
        redish = (a[..., 2] > a[..., 1] + 80) & (a[..., 2] > 165)                    # the Heart's arm: keep
        stroke = ((closed - L) > 10) & ~redish
        stroke[LY - Y0 - 5:LY - Y0 + 5] = False                 # the dashed height line joins the strokes: cut it out
        k, lab, st, _ = cv2.connectedComponentsWithStats(stroke.astype(np.uint8), connectivity=8)
        keep = np.zeros_like(stroke)
        for i in range(1, k):                                   # only tall thin marks are pencil strokes
            if st[i, cv2.CC_STAT_HEIGHT] >= 12 and st[i, cv2.CC_STAT_WIDTH] <= 16: keep |= lab == i
        m = cv2.dilate(keep.astype(np.uint8) * 255, np.ones((13, 9), np.uint8))   # tall kernel bridges the cut
        if m.any():
            g[Y0:Y1, X0:X1] = cv2.inpaint(np.ascontiguousarray(reg), m, 4, cv2.INPAINT_TELEA)
    if n >= F0:
        k = min(1, (n - F0 + 1) / (F1 - F0)); k = 1 - (1 - k) ** 2              # quick swipe, easing out
        xa, xb = int(TIP - (TIP - LX0) * k), int(TIP + (LX1 - TIP) * k)
        if xb > xa:
            lay = g.copy()
            cv2.line(lay, (xa, LY), (xb, LY), (36, 28, 160), 5, cv2.LINE_AA)      # red pencil line
            cv2.line(lay, (xa, LY - 2), (xb, LY - 2), (80, 70, 205), 1, cv2.LINE_AA)
            band = slice(LY - 5, LY + 6), slice(LX0 - 2, LX1 + 3)
            b = f[band].astype(np.int16)                                                # wall/chart, not hair or Heart
            wall = (lum(b) > 95) & ~(b[..., 2] > b[..., 1] + 105) & ~(b[..., 1] > b[..., 2] + 10)
            m = np.zeros(g.shape[:2], bool); m[band] = wall
            g[m] = lay[m]
    p.stdin.write(g.tobytes())
p.stdin.close(); p.wait(); print("done", len(frames))
