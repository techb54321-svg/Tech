"""Centre line of the felt track on the poster: hand-placed points, a closed spline, then snapped to the middle of the red rails."""
import numpy as np, cv2, json, sys
plate = cv2.imread(sys.argv[1]); out = sys.argv[2]
CTRL = [(712,290),(760,256),(800,215),(812,170),(808,120),(785,85),(740,64),(690,62),(640,70),(600,92),(575,130),(565,180),
        (565,240),(570,295),(585,345),(620,378),(680,394),(760,400),(830,408),(862,430),(870,470),(855,508),(815,532),(750,544),
        (680,546),(610,540),(555,520),(528,480),(527,440),(540,400),(565,370),(600,345),(650,320)]
def catmull(P, n=40):
    P = np.array(P, float); out = []
    for i in range(len(P)):
        p0, p1, p2, p3 = P[i - 1], P[i], P[(i + 1) % len(P)], P[(i + 2) % len(P)]
        for t in np.linspace(0, 1, n, endpoint=False):
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    return np.array(out)
def resample(pts, step=2.0):
    seg = np.r_[0, np.cumsum(np.linalg.norm(np.diff(np.vstack([pts, pts[:1]]), axis=0), axis=1))]
    L = seg[-1]; s = np.arange(0, L, step); closed = np.vstack([pts, pts[:1]])
    return np.c_[np.interp(s, seg, closed[:, 0]), np.interp(s, seg, closed[:, 1])], L
b, g, r = [plate[..., i].astype(int) for i in range(3)]
red = ((r > 120) & (r > g + 60) & (r > b + 40)).astype(np.uint8)
band = cv2.morphologyEx(red, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (21, 21)))
pts, L = resample(catmull(CTRL))
for it in range(3):                                   # snap: slide each point along its normal to the band's middle
    tang = np.roll(pts, -2, 0) - np.roll(pts, 2, 0); tang /= np.linalg.norm(tang, axis=1, keepdims=True) + 1e-9
    nrm = np.c_[-tang[:, 1], tang[:, 0]]
    new = pts.copy()
    for i, (p, nv) in enumerate(zip(pts, nrm)):
        offs = [o for o in range(-16, 17) if band[int(round(p[1] + o * nv[1])), int(round(p[0] + o * nv[0]))]]
        if offs:
            # choose the run of band pixels closest to the point, take its middle
            runs, cur = [], [offs[0]]
            for o in offs[1:]:
                if o == cur[-1] + 1: cur.append(o)
                else: runs.append(cur); cur = [o]
            runs.append(cur); run = min(runs, key=lambda rr: abs(np.mean(rr)))
            new[i] = p + np.mean(run) * nv
    k = np.ones(9) / 9                                 # smooth the snapped line
    pts = np.c_[np.convolve(np.r_[new[-4:, 0], new[:, 0], new[:4, 0]], k, 'valid'), np.convolve(np.r_[new[-4:, 1], new[:, 1], new[:4, 1]], k, 'valid')]
    pts, L = resample(pts)
json.dump({"points": pts.round(2).tolist(), "length": L}, open(out, "w"))
vis = plate.copy()
for i in range(len(pts)):
    cv2.line(vis, tuple(map(int, pts[i])), tuple(map(int, pts[(i + 1) % len(pts)])), (255, 255, 0), 1, cv2.LINE_AA)
for i in range(0, len(pts), 60): cv2.circle(vis, tuple(map(int, pts[i])), 3, (0, 255, 0) if i else (255, 0, 255), -1)
cv2.imwrite(out.replace(".json", "_vis.jpg"), cv2.resize(vis[30:600, 480:920], None, fx=2, fy=2))
print("length", round(L), "points", len(pts))
