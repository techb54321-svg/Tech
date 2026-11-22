"""Dolls-house doors: brass trapdoors swing DOWN under the floor, blood drops into the bottom rooms,
both shut on 'lub', the house squeezes on 'dub'. Drawn frame by frame over the storyboard still."""
import math, subprocess, sys
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance

src, out = sys.argv[1], sys.argv[2]
FPS, DUR, W, H = 24, 13.0, 1280, 720
base = Image.open(src).convert("RGB").resize((W, H), Image.LANCZOS)
S = H / 714  # measurements were taken on a 1280x714 copy

# (centre x, centre y, rx, ry, knob box) for left and right doors
DOORS = [(509, 344 * S, 59, 8, (500, 316 * S, 521, 348 * S)),
         (794, 344 * S, 53, 8, (785, 316 * S, 806, 348 * S))]
PLANK = (330, int(352 * S), 960, int(388 * S))   # front edge of the floor between top and bottom rooms

# open plate: knobs and discs removed (inpainted), dark holes drawn in
arr = np.array(base)
mask = np.zeros((H, W), np.uint8)
for cx, cy, rx, ry, kb in DOORS:
    cv2.rectangle(mask, (int(kb[0]) - 2, int(kb[1]) - 2), (int(kb[2]) + 2, int(kb[3]) + 2), 255, -1)
    cv2.ellipse(mask, (int(cx), int(cy)), (rx + 2, ry + 3), 0, 0, 360, 255, -1)
inp = cv2.inpaint(arr, mask, 7, cv2.INPAINT_TELEA)
open_plate = Image.fromarray(inp)
d = ImageDraw.Draw(open_plate)
for cx, cy, rx, ry, kb in DOORS:
    d.ellipse((cx - rx - 2, cy - ry - 2, cx + rx + 2, cy + ry + 2), fill=(176, 132, 60))      # brass rim
    d.ellipse((cx - rx + 3, cy - ry + 1, cx + rx - 3, cy + ry - 1), fill=(30, 18, 14))         # dark opening
    d.ellipse((cx - rx + 10, cy - ry + 3, cx + rx - 10, cy + ry - 1), fill=(14, 8, 6))

# a felt ball cut from the bottom-left room, for falling blood
ball_src = base.crop((470, int(470 * S), 530, int(470 * S) + 60))
bm = Image.new("L", ball_src.size, 0); ImageDraw.Draw(bm).ellipse((4, 4, 56, 56), fill=255)
bm = bm.filter(ImageFilter.GaussianBlur(1.5))
BALL, BALL_M = ball_src.resize((34, 34)), bm.resize((34, 34))
plank = base.crop(PLANK)

def flap(rx, o):
    """Brass door hanging down under the floor, seen from the front: shadowed at the hinge, lit lower down."""
    hgt = max(2, int(2 * rx * 0.75 * math.sin(o * math.pi / 2)))
    w = 2 * rx + 4
    yy = np.linspace(0, 1, hgt + 4)[:, None] * np.ones((1, w))
    xx = np.linspace(-1, 1, w)[None, :] * np.ones((hgt + 4, 1))
    top, bot = np.array([70, 48, 20]), np.array([206, 160, 70])
    col = top + (bot - top) * (yy ** 0.8)[..., None]
    col = col * (1 - 0.25 * xx[..., None] ** 2) + 18 * np.exp(-((xx - 0.35) / 0.12) ** 2)[..., None] * yy[..., None]
    img = Image.fromarray(np.clip(col, 0, 255).astype(np.uint8))
    m = Image.new("L", (w, hgt + 4), 0); md = ImageDraw.Draw(m)
    md.ellipse((0, -hgt - 2, w - 1, hgt + 2), fill=255)
    m = m.filter(ImageFilter.GaussianBlur(0.8))
    dr = ImageDraw.Draw(img)
    dr.ellipse((1, -hgt - 1, w - 2, hgt + 1), outline=(120, 86, 34), width=3)
    for a in np.linspace(0.12, 0.88, 7):                     # rivets round the rim, like the doors on top
        ang = math.pi * a
        rx_, ry_ = rx - 3, hgt - 2
        px, py = rx + 2 + rx_ * math.cos(ang), ry_ * math.sin(ang)
        dr.ellipse((px - 2, py - 2, px + 2, py + 2), fill=(228, 190, 100))
    if hgt > 22:
        k = (rx + 2, int(hgt * 0.6)); dr.ellipse((k[0] - 6, k[1] - 6, k[0] + 6, k[1] + 6), fill=(214, 172, 80), outline=(110, 78, 30))
    img = img.convert("RGBA"); img.putalpha(m)
    return img

def ramp(a, b, x): return min(1, max(0, (x - a) / (b - a)))
def openness(t):
    o = ramp(1.2, 2.1, t) * (1 - ramp(5.35, 5.55, t))      # open while asking, snap shut on "lub"
    o += ramp(7.4, 8.3, t) * (1 - ramp(9.85, 10.05, t))    # open again, shut
    return min(1, o)
def squeeze(t):
    return 1 - 0.02 * (math.exp(-((t - 6.2) / 0.18) ** 2) + 0.6 * math.exp(-((t - 5.5) / 0.12) ** 2))

def frame(t):
    o = openness(t)
    if o <= 0.001:
        im = base.copy()
    else:
        im = open_plate.copy()
        for k, (cx, cy, rx, ry, kb) in enumerate(DOORS):
            f = flap(rx, o)
            if o > 0.5:
                for j in range(3):   # blood falling out from under the floor into the bottom room
                    ph = (t * 1.3 + j / 3 + k * 0.21) % 1.0
                    bx = cx - 30 + j * 22
                    by = PLANK[3] - 20 + ph * 110
                    a = min(1, ph * 6) * min(1, (1 - ph) * 5)
                    m = BALL_M.point(lambda v: int(v * a))
                    im.paste(BALL, (int(bx), int(by)), m)
            im.paste(f, (int(cx - rx - 2), PLANK[3] - 8), f)   # door hangs in front of the falling blood
        im.paste(plank, PLANK[:2])   # floor edge in front of the hanging doors and falling blood
    s = (1 + 0.05 * t / DUR) * squeeze(t)
    cxp, cyp = 640, 380
    l, tp = cxp * (1 - 1 / s), cyp * (1 - 1 / s)
    return im.crop((round(l), round(tp), round(l + W / s), round(tp + H / s))).resize((W, H), Image.LANCZOS)

if __name__ == "__main__":
    p = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                          "-c:v", "libx264", "-crf", "20", "-preset", "slow", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out], stdin=subprocess.PIPE)
    for n in range(int(FPS * DUR)):
        p.stdin.write(frame(n / FPS).convert("RGB").tobytes())
    p.stdin.close(); p.wait(); print("done", out)
