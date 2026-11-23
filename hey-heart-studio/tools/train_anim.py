"""Blood train: the felt train (engine with the Heart + two wagons of red cells) rides the poster's track exactly,
timed to the narration: leaves the heart on 'zooms', at the head on 'head', at the toes on 'toes', home on 'back to me!'.
Background: the original shot with the poster replaced by a clean plate (the AI train removed)."""
import json, math, subprocess, sys
import numpy as np, cv2

SB = "clips/sb/"; src_clip, out = sys.argv[1], sys.argv[2]
FPS, DUR, W, H = 24, 10.5, 1280, 720
plate = cv2.imread(SB + "train_plate.png")
P = np.array(json.load(open(SB + "train_path.json"))["points"]); N = len(P); STEP = 2.0; L = N * STEP
SC = 0.6                                                                 # train scaled to suit the track's curves
spr0 = cv2.imread(SB + "train_sprite_clean.png", cv2.IMREAD_UNCHANGED)         # 270 x 146, engine on the right
spr = cv2.resize(spr0, None, fx=SC, fy=SC, interpolation=cv2.INTER_AREA)
sh, sw = spr.shape[:2]
yy, xx = np.mgrid[0:sh, 0:sw] / SC
# split into cars: wagon 1 | wagon 2 | engine (the Heart overhangs wagon 2, so the engine claims x>=147 up top)
eng = (xx >= 168) | ((xx >= 147) & (yy < 75))
cars = []
for name, m, cx, by, back in [("w1", xx < 85, 42, 118, 178), ("w2", (xx >= 85) & ~eng, 127, 124, 93), ("eng", eng, 220, 132, 0)]:
    c = spr.copy(); c[..., 3] = (c[..., 3] * m).astype(np.uint8)
    cars.append(dict(img=c, ax=cx * SC, ay=(by - 3) * SC, back=back * SC))

# background: original frames ping-ponged (Mia's small movements), poster area from the clean plate
cap = cv2.VideoCapture(src_clip); frames = []
while True:
    ok, f = cap.read()
    if not ok: break
    frames.append(f)
seq = frames + frames[::-1]
pm = np.zeros((H, W), np.float32); cv2.rectangle(pm, (488, 22), (948, 612), 1, -1); pm = cv2.GaussianBlur(pm, (7, 7), 0)[..., None]

KEYS = [(0.0, 0), (1.2, 0), (4.0, 400), (6.3, 1212), (8.4, L), (10.5, L)]   # (time, distance): leave on "zooms", head ~"head", home at "warmer!"
def _pchip_slopes(ts, ss):
    """Monotone cubic (Fritsch-Carlson) slopes: smooth speed, never runs backwards or overshoots."""
    h = np.diff(ts); d = np.diff(ss) / h; m = np.zeros(len(ts))
    for i in range(1, len(ts) - 1):
        if d[i - 1] * d[i] > 0:
            w1, w2 = 2 * h[i] + h[i - 1], h[i] + 2 * h[i - 1]
            m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i])
    return m
_TS = np.array([k[0] for k in KEYS]); _SS = np.array([k[1] for k in KEYS], float); _M = _pchip_slopes(_TS, _SS)
def smooth_s(t):
    if t >= _TS[-1]: return L
    i = max(0, np.searchsorted(_TS, t, side="right") - 1); h = _TS[i + 1] - _TS[i]; u = (t - _TS[i]) / h
    h00, h10, h01, h11 = 2*u**3 - 3*u**2 + 1, u**3 - 2*u**2 + u, -2*u**3 + 3*u**2, u**3 - u**2
    return h00 * _SS[i] + h10 * h * _M[i] + h01 * _SS[i + 1] + h11 * h * _M[i + 1]

def at(s):
    s %= L; i = int(s / STEP) % N; j = (i + 1) % N; f = s / STEP - int(s / STEP)
    p = P[i] * (1 - f) + P[j] * f
    a, b = P[(i - 6) % N], P[(i + 6) % N]
    return p, math.atan2(b[1] - a[1], b[0] - a[0])

flip_state = {}
def place(canvas, car, s, t, idx):
    p, ang = at(s)
    deg = math.degrees(ang)
    # face the way we're going without turning the Heart upside down (hysteresis so it doesn't flicker)
    prev = flip_state.get(idx, False)
    flipped = (abs(deg) > 100) or (prev and abs(deg) > 80)
    flip_state[idx] = flipped
    img = car["img"]; ax = car["ax"]
    if flipped:
        img = img[:, ::-1]; ax = sw - 1 - ax; deg = deg - 180 if deg > 0 else deg + 180
    bob = 1.5 * math.sin(t * 18 + idx) if 1.75 < t < 5.95 else 0
    M = cv2.getRotationMatrix2D((ax, car["ay"]), -deg, 1.0)
    M[0, 2] += p[0] - ax; M[1, 2] += p[1] - car["ay"] + bob
    warped = cv2.warpAffine(img, M, (W, H), flags=cv2.INTER_LINEAR, borderValue=(0, 0, 0, 0))
    a = warped[..., 3:4].astype(np.float32) / 255
    shadow = cv2.GaussianBlur(np.roll(np.roll(a[..., 0], 3, 0), 2, 1), (9, 9), 0)[..., None] * 0.16
    canvas[:] = canvas * (1 - shadow)
    canvas[:] = canvas * (1 - a) + warped[..., :3].astype(np.float32) * a

p = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                      "-c:v", "libx264", "-crf", "18", "-preset", "slow", "-pix_fmt", "yuv420p", out], stdin=subprocess.PIPE)
for n in range(int(FPS * DUR)):
    t = n / FPS
    bg = seq[n % len(seq)].astype(np.float32)
    canvas = bg * (1 - pm) + plate.astype(np.float32) * pm
    s = smooth_s(t)
    for k, car in enumerate(cars):                    # wagons first, engine last (on top)
        place(canvas, car, s - car["back"], t, k)
    p.stdin.write(np.clip(canvas, 0, 255).astype(np.uint8).tobytes())
p.stdin.close(); p.wait(); print("done", out)
