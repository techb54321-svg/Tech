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
spr0 = cv2.imread(SB + "train_sprite.png", cv2.IMREAD_UNCHANGED)         # 270 x 146, engine on the right
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
pm = np.zeros((H, W), np.float32); cv2.rectangle(pm, (512, 22), (948, 612), 1, -1); pm = cv2.GaussianBlur(pm, (13, 13), 0)[..., None]

def smooth_s(t):
    keys = [(0, 0), (1.75, 0), (3.95, 332), (5.05, 1212), (5.95, L), (99, L)]
    for (t0, s0), (t1, s1) in zip(keys, keys[1:]):
        if t0 <= t < t1:
            u = (t - t0) / (t1 - t0)
            if s0 == 0 and s1 == 332: u = u * u * (1.4 - 0.4 * u)               # pull away gently
            elif s1 == L and s0 == 1212: u = 1 - (1 - u) ** 2                    # brake into the station
            return s0 + (s1 - s0) * u
    return L

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
    shadow = cv2.GaussianBlur(np.roll(np.roll(a[..., 0], 5, 0), 3, 1), (11, 11), 0)[..., None] * 0.35
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
