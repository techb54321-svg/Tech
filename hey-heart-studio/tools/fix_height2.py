"""New height shot: remove the stray dash the video model drew on the wall above the chart (keep the real height line)."""
import subprocess, sys
import numpy as np, cv2
src, out = sys.argv[1], sys.argv[2]
X0, X1, Y0, Y1 = 869, 935, 92, 128                      # wall just right of the chart, above the height line
cap = cv2.VideoCapture(src); fr = []
while True:
    ok, f = cap.read()
    if not ok: break
    fr.append(f)
p = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", "1280x720", "-r", "24", "-i", "-",
                      "-an", "-c:v", "libx264", "-crf", "20", "-preset", "slow", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out], stdin=subprocess.PIPE)
for f in fr:
    reg = np.ascontiguousarray(f[Y0:Y1, X0:X1])
    L = cv2.cvtColor(reg, cv2.COLOR_BGR2GRAY).astype(np.float32)
    bgl = cv2.medianBlur(L.astype(np.uint8), 15).astype(np.float32)
    m = ((bgl - L) > 18).astype(np.uint8) * 255
    m = cv2.dilate(m, np.ones((5, 7), np.uint8))
    if m.any(): f[Y0:Y1, X0:X1] = cv2.inpaint(reg, m, 5, cv2.INPAINT_TELEA)
    p.stdin.write(f.tobytes())
p.stdin.close(); p.wait(); print("done", len(fr))
