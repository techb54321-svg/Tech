"""Render the heart-house doors shot: trapdoors swing DOWN, blood drops through, both snap shut on 'lub'.
Frames are drawn with PIL over the clip's first frame and piped to ffmpeg."""
import math, subprocess, sys
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance

src, out = sys.argv[1], sys.argv[2]
FPS, DUR, W, H = 24, 13.0, 1280, 720
base = Image.open(src).convert("RGB").resize((W, H))

# door geometry measured on the frame: (cx, cy, inner rx, inner ry)
DOORS = [(481, 372, 66, 41), (695, 293, 63, 39)]

# a real felt ball cut from the top-left room, used for falling blood
ball_src = base.crop((322, 188, 392, 258))
bm = Image.new("L", ball_src.size, 0); ImageDraw.Draw(bm).ellipse((3, 3, 67, 67), fill=255)
bm = bm.filter(ImageFilter.GaussianBlur(1.5))
BALL = ball_src.resize((40, 40)); BALL_M = bm.resize((40, 40))

# Heart cut-out (feathered rectangle) for a gentle bob
HB = (805, 236, 1065, 655)
heart = base.crop(HB)
hm = Image.new("L", heart.size, 0); ImageDraw.Draw(hm).rounded_rectangle((14, 6, heart.size[0] - 14, heart.size[1] - 4), 40, fill=255)
hm = hm.filter(ImageFilter.GaussianBlur(10))

def door_disc(cx, cy, rx, ry):
    box = (cx - rx, cy - ry, cx + rx, cy + ry)
    d = base.crop(box)
    m = Image.new("L", d.size, 0); ImageDraw.Draw(m).ellipse((0, 0, d.size[0] - 1, d.size[1] - 1), fill=255)
    return d, m
DISCS = [door_disc(*d) for d in DOORS]

# timeline (scene seconds; voice starts at 0.45 s): open while asking, shut on "lub" (~5.5 s),
# squeeze on "dub" (~6.15 s), open again at 7.4 s and shut at 10.0 s
def openness(t):
    def ramp(a, b, x):
        return min(1, max(0, (x - a) / (b - a)))
    o = ramp(1.2, 2.0, t) * (1 - ramp(5.35, 5.55, t))   # snaps shut fast
    o += ramp(7.4, 8.2, t) * (1 - ramp(9.85, 10.05, t))
    return min(1, o)

def squeeze(t):
    k = math.exp(-((t - 6.2) / 0.18) ** 2) + 0.6 * math.exp(-((t - 5.5) / 0.12) ** 2)
    return 1 - 0.018 * k

def frame(t):
    im = base.copy(); d = ImageDraw.Draw(im)
    o = openness(t)
    for k, ((cx, cy, rx, ry), (disc, dm)) in enumerate(zip(DOORS, DISCS)):
        if o <= 0.001:
            continue
        # dark hole inside the brass rim, with a soft warm inner edge
        hole = Image.new("RGB", (2 * rx, 2 * ry), (34, 20, 16))
        hd = ImageDraw.Draw(hole)
        # warm shadow at the rim fading to near-black in the middle (the drop below the floor)
        for i in range(14):
            f = i / 13
            c = (int(92 - 70 * f), int(58 - 46 * f), int(38 - 30 * f))
            inset_x, inset_y = i * rx / 16, i * ry / 16
            hd.ellipse((inset_x, inset_y * 1.3, 2 * rx - inset_x, 2 * ry - inset_y * 0.4), fill=c)
        hole = hole.filter(ImageFilter.GaussianBlur(2))
        hm_ = Image.new("L", hole.size, 0); ImageDraw.Draw(hm_).ellipse((0, 0, 2 * rx - 1, 2 * ry - 1), fill=255)
        im.paste(hole, (cx - rx, cy - ry), hm_)
        # falling blood balls (clipped to the hole so they drop below the floor)
        clip = Image.new("L", (W, H), 0); ImageDraw.Draw(clip).ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=255)
        layer = Image.new("RGB", (W, H)); lm = Image.new("L", (W, H), 0)
        for j in range(3):
            phase = ((t * 1.6 + j / 3 + k * 0.17) % 1.0)
            if o < 0.6:
                continue
            bx = cx - 18 + (j - 1) * 22
            by = cy - ry - 30 + phase * (2 * ry + 70)
            sc = 1 - 0.35 * phase
            b = BALL.resize((int(40 * sc), int(40 * sc))); m = BALL_M.resize(b.size)
            b = ImageEnhance.Brightness(b).enhance(1 - 0.55 * phase)
            layer.paste(b, (int(bx), int(by)), m); lm.paste(m, (int(bx), int(by)), m)
        from PIL import ImageChops
        im.paste(layer, (0, 0), ImageChops.multiply(lm, clip))
        # the door swings DOWN about its far (hinge) edge: it foreshortens toward the hinge and darkens
        ang = o * math.pi / 2
        h = max(2, int(2 * ry * math.cos(ang)))
        dd = ImageEnhance.Brightness(disc.resize((2 * rx, h))).enhance(1 - 0.6 * o)
        mm = dm.resize((2 * rx, h))
        im.paste(dd, (cx - rx, cy - ry), mm)
    # Heart bobs gently (nods with the doors)
    bob = int(round(3 * math.sin(t * 2 * math.pi / 1.6)))
    if bob:
        im.paste(heart, (HB[0], HB[1] + bob), hm)
    # heart squeeze on lub/dub + slow push-in
    s = (1 + 0.05 * t / DUR) * squeeze(t)
    cxp, cyp = 600, 380   # this point stays put while we push in
    l, tp = cxp * (1 - 1 / s), cyp * (1 - 1 / s)
    im = im.crop((round(l), round(tp), round(l + W / s), round(tp + H / s))).resize((W, H), Image.LANCZOS)
    return im

p = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                      "-c:v", "libx264", "-crf", "20", "-preset", "slow", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out], stdin=subprocess.PIPE)
for n in range(int(FPS * DUR)):
    p.stdin.write(frame(n / FPS).tobytes())
p.stdin.close(); p.wait(); print("done", out)
