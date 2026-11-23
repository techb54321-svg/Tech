"""Clean train cut-out: car bodies as outlines, wheels as circles, red cells / Heart / chimney by colour.
Drops the grey leftovers of the original shadow and poster that showed as a dark smudge."""
import cv2, numpy as np, sys
s = cv2.imread(sys.argv[1], cv2.IMREAD_UNCHANGED); F = s[..., :3].astype(int); a0 = s[..., 3] > 128
b, g, r = F[..., 0], F[..., 1], F[..., 2]
q = lambda pts: (np.array(pts, np.float32) / 4).round().astype(np.int32)        # outlines measured at 4x
m = np.zeros(a0.shape, np.uint8)
for poly in [[(36, 300), (332, 305), (330, 440), (40, 432)],                    # wagon 1
             [(358, 312), (648, 318), (645, 452), (360, 445)],                  # wagon 2
             [(690, 300), (850, 290), (1010, 330), (1012, 450), (1000, 500), (690, 470)]]:   # engine
    cv2.fillPoly(m, [q(poly)], 1)
for x, y in [(90, 432), (240, 440), (420, 450), (570, 462), (745, 462), (915, 492)]:
    cv2.circle(m, (round(x / 4), round(y / 4)), 9, 1, -1)                       # wheels
red = (r > g + 50) & (r > 90)                                                     # blood cells, Heart, engine
teal = (g > r + 5) & (b > r)                                                      # headband, chimney
shapes = m.copy()
cv2.ellipse(shapes, (round(750 / 4), round(190 / 4)), (round(100 / 4), round(150 / 4)), 0, 0, 360, 1, -1)   # the Heart, whole
cv2.ellipse(shapes, (round(610 / 4), round(195 / 4)), (round(35 / 4), round(30 / 4)), 0, 0, 360, 1, -1)     # its waving hand
yy = np.mgrid[0:m.shape[0], 0:m.shape[1]][0] * 4
colour = (red | teal) & ~((yy > 470) & (shapes == 0))                              # no track scraps under the cars
m = shapes | colour.astype(np.uint8)
m &= a0.astype(np.uint8)
h, w = m.shape; inv = (1 - m).astype(np.uint8); n, l, st, _ = cv2.connectedComponentsWithStats(inv)
for i in range(1, n):                                                             # fill eyes and small holes
    x, y, ww, hh, ar = st[i]
    if x > 0 and y > 0 and x + ww < w and y + hh < h and ar < 400: m[l == i] = 1
m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8))
n, l, st, _ = cv2.connectedComponentsWithStats(m); k = np.zeros_like(m)
for i in range(1, n):
    if st[i, 4] > 40: k[l == i] = 1
al = cv2.GaussianBlur(k.astype(np.float32) * 255, (3, 3), 0).astype(np.uint8)
cv2.imwrite(sys.argv[2], np.dstack([s[..., :3], al])); print("ok")
