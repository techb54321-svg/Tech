"""Dolls-house doors: painted, panelled double doors swing DOWN under the floor, blood drops into the bottom rooms,
both shut on 'lub', the house squeezes on 'dub'. Drawn frame by frame over the storyboard still."""
import math, subprocess, sys
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance

src, out = sys.argv[1], sys.argv[2]
FPS, DUR, W, H = 24, 14.0, 1280, 720
base = Image.open(src).convert("RGB").resize((W, H), Image.LANCZOS)
S = H / 714  # measurements were taken on a 1280x714 copy

# (centre x, centre y, rx, ry, knob box) for left and right doors
DOORS = [(509, 344 * S, 59, 8, (500, 316 * S, 521, 348 * S)),
         (794, 344 * S, 53, 8, (785, 316 * S, 806, 348 * S))]
PLANK = (330, int(352 * S), 960, int(388 * S))   # front edge of the floor between top and bottom rooms

# plate with the old brass lids removed (inpainted); doors are drawn on top of it in every frame
arr = np.array(base)
mask = np.zeros((H, W), np.uint8)
for cx, cy, rx, ry, kb in DOORS:
    cv2.rectangle(mask, (int(kb[0]) - 2, int(kb[1]) - 2), (int(kb[2]) + 2, int(kb[3]) + 2), 255, -1)
    cv2.ellipse(mask, (int(cx), int(cy) + 4), (rx + 5, ry + 12), 0, 0, 360, 255, -1)
plate = Image.fromarray(cv2.inpaint(arr, mask, 7, cv2.INPAINT_TELEA))

# dolls-house paint: sage-green doors, honey wood frames, brass knobs and hinges, a little red heart
PAINT, PAINT_D, PAINT_L = (150, 186, 156), (110, 146, 118), (190, 218, 192)
WOOD, WOOD_D = (196, 150, 98), (128, 88, 50)
BRASS, BRASS_D, BRASS_L = (214, 172, 80), (124, 88, 34), (248, 222, 150)
HEARTC = (200, 40, 48)
SS = 4   # supersampling for crisp little details

def heart_poly(x, y, r):
    pts = []
    for i in range(40):
        a = 2 * math.pi * i / 40
        hx = 16 * math.sin(a) ** 3
        hy = -(13 * math.cos(a) - 5 * math.cos(2 * a) - 2 * math.cos(3 * a) - math.cos(4 * a))
        pts.append((x + hx * r / 16, y + hy * r / 16))
    return pts

def leaf(w, h, knob_side):
    """One painted, panelled dolls-house door leaf, face on, hinge edge at the top. Drawn big, then shrunk."""
    W2, H2 = w * SS, h * SS
    img = Image.new("RGBA", (W2, H2), (0, 0, 0, 0)); d = ImageDraw.Draw(img)
    r = 3 * SS
    d.rounded_rectangle((0, 0, W2 - 1, H2 - 1), r, fill=PAINT_D)                       # edge
    d.rounded_rectangle((SS, SS, W2 - 1 - SS, H2 - 1 - 2 * SS), r, fill=PAINT)         # face
    m = int(0.16 * W2)                                                                 # two raised panels
    ph = (H2 - 3 * m) / 2
    for k in range(2):
        y0 = m + k * (ph + m)
        box = (m, y0, W2 - m, y0 + ph)
        d.rounded_rectangle(box, 2 * SS, fill=PAINT_D)
        d.rounded_rectangle((box[0] + SS, box[1] + SS, box[2], box[3]), 2 * SS, fill=PAINT_L)
        d.rounded_rectangle((box[0] + SS, box[1] + SS, box[2] - SS, box[3] - SS), 2 * SS, fill=PAINT)
    hy = m + ph / 2                                                                    # little painted heart
    d.polygon(heart_poly(W2 / 2, hy, min(W2, ph) * 0.22), fill=HEARTC)
    kx = W2 - m * 0.55 if knob_side > 0 else m * 0.55; ky = m + ph + m / 2             # brass knob
    kr = 2.6 * SS
    d.ellipse((kx - kr, ky - kr, kx + kr, ky + kr), fill=BRASS, outline=BRASS_D, width=SS // 2)
    d.ellipse((kx - kr * .45, ky - kr * .6, kx + kr * .05, ky - kr * .1), fill=BRASS_L)
    for hx in (0.22, 0.78):                                                            # brass hinges at the top
        x = W2 * hx
        d.rectangle((x - 3 * SS, 0, x + 3 * SS, 3 * SS), fill=BRASS, outline=BRASS_D)
    img = img.resize((w, h), Image.LANCZOS)
    a = np.array(img).astype(np.float32)
    rng = np.random.default_rng(w * 31 + h + knob_side)
    grain = rng.normal(0, 5, (h, 1)) + rng.normal(0, 3, (h, w))          # brush/grain streaks
    a[..., :3] += grain[..., None]
    a[..., :3] *= (0.9 + 0.1 * np.linspace(0, 1, h))[:, None, None]       # a touch darker near the hinge
    img = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "RGBA")
    return img.filter(ImageFilter.GaussianBlur(0.45))

def hole_layer(cx, cy, rx, ry):
    """Wooden frame set into the floor, with a dark opening."""
    lay = Image.new("RGBA", (W * 1, H * 1), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    d.rounded_rectangle((cx - rx - 4, cy - ry - 3, cx + rx + 4, cy + ry + 4), 4, fill=WOOD_D)
    d.rounded_rectangle((cx - rx - 3, cy - ry - 3, cx + rx + 3, cy + ry + 2), 4, fill=WOOD)
    d.rounded_rectangle((cx - rx, cy - ry, cx + rx, cy + ry), 3, fill=(34, 20, 16))
    d.rounded_rectangle((cx - rx + 6, cy - ry + 2, cx + rx - 6, cy + ry), 3, fill=(16, 9, 7))
    return lay

def floor_doors(cx, cy, rx, ry, c):
    """The two leaves lying shut in the floor, seen at a low angle; c = 1 shut, shrinking toward the front edge as they drop."""
    hh = max(1, int(round(2 * ry * c)))
    w = rx
    out = []
    for side in (-1, 1):
        lf = leaf(w * 2, w * 2, side)                      # same painted face, squashed into floor perspective
        lf = lf.resize((w - 1, hh), Image.LANCZOS)
        x = cx - w if side < 0 else cx + 1
        out.append((lf, (int(x), int(cy + ry - hh))))
    return out

HOLES = [hole_layer(cx, cy, rx, ry) for cx, cy, rx, ry, kb in DOORS]
# a felt ball cut from the bottom-left room, for falling blood
ball_src = base.crop((470, int(470 * S), 530, int(470 * S) + 60))
bm = Image.new("L", ball_src.size, 0); ImageDraw.Draw(bm).ellipse((4, 4, 56, 56), fill=255)
bm = bm.filter(ImageFilter.GaussianBlur(1.5))
BALL, BALL_M = ball_src.resize((34, 34)), bm.resize((34, 34))
plank = plate.crop(PLANK)
# a clean single ball from the top-left room for blood rolling through the doors
_rb = base.crop((353, 315, 401, 363))                       # one felt cell, centred (377, 339), radius ~22
RB_M = Image.new("L", _rb.size, 0); ImageDraw.Draw(RB_M).ellipse((3, 3, 45, 45), fill=255)
RB_M = RB_M.filter(ImageFilter.GaussianBlur(1.0))
RB = _rb.resize((57, 57), Image.LANCZOS); RB_M = RB_M.resize((57, 57), Image.LANCZOS)   # visible ball ~50 px, same as the rooms

def ramp(a, b, x): return min(1, max(0, (x - a) / (b - a)))
def openness(t):
    o = ramp(0.5, 1.2, t) * (1 - ramp(1.58, 1.75, t))      # open on "Is it my doors?", snap shut on "Lub"
    o += ramp(3.4, 4.1, t) * (1 - ramp(5.32, 5.49, t))     # open again, shut on "snapping shut"
    return min(1, o)
def squeeze(t):                                          # the whole heart squeezes on "lub" and "dub"
    return 1 - 0.02 * (math.exp(-((t - 2.57) / 0.18) ** 2) + 0.6 * math.exp(-((t - 1.74) / 0.12) ** 2))

# ---- upright front doors, like a dolls house: one stands at the front of each top room ----
def door_size(rx): return int(rx * 1.0), int(rx * 1.55)

def arch_mask(w, h, inset=0):
    m = Image.new("L", (w, h), 0); d = ImageDraw.Draw(m)
    r = w / 2 - inset
    d.ellipse((inset, inset, w - inset, 2 * r + inset), fill=255)
    d.rectangle((inset, r + inset, w - inset, h - inset), fill=255)
    return m

def front_door(w, h, hinge):
    """Painted, panelled arched front door with a heart window, brass knob and letterbox. Face on."""
    W2, H2 = w * SS, h * SS
    img = Image.new("RGBA", (W2, H2), PAINT_D + (255,)); d = ImageDraw.Draw(img)
    d.bitmap((0, 0), arch_mask(W2, H2, SS), fill=PAINT)
    m = int(0.17 * W2); r = W2 / 2
    # heart window in the arch
    d.polygon(heart_poly(W2 / 2, r * 0.95, W2 * 0.2), fill=(255, 226, 170))
    d.line(heart_poly(W2 / 2, r * 0.95, W2 * 0.2) + [heart_poly(W2 / 2, r * 0.95, W2 * 0.2)[0]], fill=PAINT_D, width=SS)
    # two raised panels
    top = r * 1.55; bot = H2 - m; ph = (bot - top - m * 0.6) / 2
    for k in range(2):
        y0 = top + k * (ph + m * 0.6); box = (m, y0, W2 - m, y0 + ph)
        d.rounded_rectangle(box, 2 * SS, fill=PAINT_D)
        d.rounded_rectangle((box[0] + SS, box[1] + SS, box[2], box[3]), 2 * SS, fill=PAINT_L)
        d.rounded_rectangle((box[0] + SS, box[1] + SS, box[2] - SS, box[3] - SS), 2 * SS, fill=PAINT)
    # brass letterbox and knob (knob on the side away from the hinge)
    ly = top + ph + m * 0.3
    d.rounded_rectangle((W2 * 0.3, ly - 1.6 * SS, W2 * 0.7, ly + 1.6 * SS), SS, fill=BRASS, outline=BRASS_D)
    kx = W2 - m * 0.6 if hinge < 0 else m * 0.6; ky = ly; kr = 2.8 * SS
    d.ellipse((kx - kr, ky - kr, kx + kr, ky + kr), fill=BRASS, outline=BRASS_D, width=SS // 2)
    d.ellipse((kx - kr * .5, ky - kr * .65, kx, ky - kr * .1), fill=BRASS_L)
    img.putalpha(arch_mask(W2, H2))
    img = img.resize((w, h), Image.LANCZOS)
    a = np.array(img).astype(np.float32)
    rng = np.random.default_rng(w * 7 + h)
    a[..., :3] += (rng.normal(0, 4, (1, w)) + rng.normal(0, 3, (h, w)))[..., None]   # vertical brush grain
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "RGBA").filter(ImageFilter.GaussianBlur(0.4))

def doorway(w, h):
    """Wooden arched frame with a dark opening and a little step, always there behind the door."""
    fw = 5
    lay = Image.new("RGBA", (w + 2 * fw, h + fw + 4), (0, 0, 0, 0))
    outer = arch_mask(w + 2 * fw, h + fw)
    wood = Image.new("RGBA", outer.size, WOOD + (255,))
    ImageDraw.Draw(wood).rectangle((0, h + fw - 3, w + 2 * fw, h + fw), fill=WOOD_D)
    lay.paste(wood, (0, 0), outer)
    dark = Image.new("RGBA", (w, h), (0, 0, 0, 255))
    g = np.linspace(0, 1, h)[:, None] * np.ones((1, w))
    col = np.stack([40 - 26 * (1 - g), 22 - 14 * (1 - g), 16 - 10 * (1 - g)], -1)      # warm glow low down
    dark = Image.fromarray(np.clip(col, 0, 255).astype(np.uint8)).convert("RGBA")
    lay.paste(dark, (fw, fw), arch_mask(w, h))
    st = ImageDraw.Draw(lay)                                                              # step
    st.rounded_rectangle((fw - 3, h + fw - 1, w + fw + 3, h + fw + 3), 2, fill=WOOD, outline=WOOD_D)
    return lay, fw

def persp_coeffs(src, dst):
    """PIL PERSPECTIVE coefficients mapping output (dst) points back to source points."""
    A, B = [], []
    for (x, y), (u, v) in zip(dst, src):
        A.append([x, y, 1, 0, 0, 0, -u * x, -u * y]); B.append(u)
        A.append([0, 0, 0, x, y, 1, -v * x, -v * y]); B.append(v)
    return np.linalg.solve(np.array(A, float), np.array(B, float)).tolist()

def swung(door, ang, hinge):
    """The door turned about its hinge edge toward us: narrower, and the free edge a little taller (closer)."""
    w, h = door.size
    if ang < 0.01: return door, 0
    c = math.cos(ang); grow = 0.16 * math.sin(ang)
    fw = max(2, w * c); dh = h * grow / 2
    pad = int(h * 0.1) + 2
    if hinge < 0:   # hinge on the left, free edge swings out to the right/front
        dst = [(0, pad), (fw, pad - dh), (fw, pad + h + dh), (0, pad + h)]
    else:
        dst = [(w - fw, pad - dh), (w, pad), (w, pad + h), (w - fw, pad + h + dh)]
    src = [(0, 0), (w, 0), (w, h), (0, h)]
    co = persp_coeffs(src, dst)
    out = door.transform((w, h + 2 * pad), Image.PERSPECTIVE, co, Image.BICUBIC)
    out = ImageEnhance.Brightness(out).enhance(1 - 0.25 * math.sin(ang))   # turning away from the light
    return out, pad

FRONT = []
for k, (cx, cy, rx, ry, kb) in enumerate(DOORS):
    w, h = door_size(rx); hinge = -1 if k == 0 else 1
    dw, fw = doorway(w, h)
    FRONT.append((front_door(w, h, hinge), dw, fw, w, h, hinge))

ROLL = 1.1                                                         # seconds for one cell to roll into the doorway
DEPARTS = list(np.arange(0.45, DUR, 0.55))                         # a new cell leaves the pile every 0.55 s (only while the door is open)

def frame(t):
    o = openness(t)
    im = plate.copy()
    ang = o * math.radians(105)          # swings right open, a little past square
    for k, (cx, cy, rx, ry, kb) in enumerate(DOORS):
        door, dw, fw, w, h, hinge = FRONT[k]
        x0, y0 = int(cx - w / 2), int(cy + ry - h)     # door stands on the front of the floor
        sh = Image.new("RGBA", (w + 8, 6), (30, 16, 8, 70)).filter(ImageFilter.GaussianBlur(2))
        im.paste(sh, (x0 - 4, int(cy + ry) - 2), sh)
        im.paste(dw, (x0 - fw, y0 - fw), dw)
        # blood rolls off the edge of the pile (the side away from the door's hinge), across the floor
        # and into the dark doorway: it turns as it rolls and simply goes into the dark, nothing pops in or out
        side = -hinge
        bs = RB.size[0]; r = bs * 0.44
        sx, ex = cx + side * (w * 0.5 + r + 6), cx               # start beside the doorway, end inside it
        fy = cy + ry - 3 - bs                                     # sitting on the floor
        im.paste(RB, (int(sx - bs / 2), int(fy)), RB_M)          # the cell waiting at the pile edge
        for td in DEPARTS:
            u = (t - td) / ROLL
            if 0 <= u <= 1 and openness(td) > 0.6:
                e = u * u * (3 - 2 * u)                           # gentle start, glide in
                x = sx + (ex - sx) * e
                spin = math.degrees(-(x - sx) / r) * side
                inside = max(0, min(1, (abs(x - sx) - (w * 0.5 + 6)) / (r * 1.2)))   # how far into the doorway
                b = ImageEnhance.Brightness(RB.rotate(spin, resample=Image.BICUBIC)).enhance(1 - 0.75 * inside)
                a = 1 - max(0, (u - 0.8) / 0.2)                   # last bit: lost in the dark
                im.paste(b, (int(x - bs / 2), int(fy)), RB_M.point(lambda v: int(v * a)))
        if ang <= math.pi / 2:
            d2, pad = swung(door, ang, hinge)
            im.paste(d2, (x0, y0 - pad), d2)
        else:                                 # past square: we see the back of the door, plain wood
            back = Image.new("RGBA", door.size, PAINT_D + (255,)); back.putalpha(door.split()[3])
            d2, pad = swung(back, math.pi - ang, hinge)
            ox = -d2.size[0] if hinge < 0 else d2.size[0]
            # mirror to the outside of the hinge
            d2 = d2.transpose(Image.FLIP_LEFT_RIGHT)
            im.paste(d2, (x0 + (ox if hinge < 0 else 0) + (0 if hinge < 0 else w - 0), y0 - pad) if False else (x0 - d2.size[0] if hinge < 0 else x0 + w, y0 - pad), d2)
    im.paste(plank, PLANK[:2])   # floor edge in front of the falling blood
    s = (1 + 0.05 * t / DUR) * squeeze(t)
    cxp, cyp = 640, 380
    l, tp = cxp * (1 - 1 / s), cyp * (1 - 1 / s)
    return im.crop((round(l), round(tp), round(l + W / s), round(tp + H / s))).resize((W, H), Image.LANCZOS)

if __name__ == "__main__" and len(sys.argv) > 3:   # stills: script src out.jpg t1 t2 ...
    ims = [frame(float(x)) for x in sys.argv[3:]]
    sheet = Image.new("RGB", (W, H * len(ims)))
    for i, f in enumerate(ims): sheet.paste(f, (0, H * i))
    sheet.save(out, quality=88); sys.exit()

if __name__ == "__main__":
    p = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                          "-c:v", "libx264", "-crf", "20", "-preset", "slow", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out], stdin=subprocess.PIPE)
    for n in range(int(FPS * DUR)):
        p.stdin.write(frame(n / FPS).convert("RGB").tobytes())
    p.stdin.close(); p.wait(); print("done", out)
