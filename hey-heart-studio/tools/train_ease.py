"""Train lap timing: steady speed, then the train slows down and pulls in beside the heart right as the scene ends
(no frozen picture). Held frames, no blending. usage: train_ease.py src out total_seconds ease_seconds"""
import subprocess, sys
import cv2
src, out, T, D = sys.argv[1], sys.argv[2], float(sys.argv[3]), float(sys.argv[4])
cap = cv2.VideoCapture(src); frames = []
ok, f = cap.read()
while ok: frames.append(f); ok, f = cap.read()
L = (len(frames) - 1) / 24.0                       # source seconds
r = L / (T - D / 2)                                # steady rate so the lap finishes exactly at T
def pos(t):                                        # source time shown at output time t
    if t <= T - D: return r * t
    u = (t - (T - D)) / D
    return r * (T - D) + r * D * (u - u * u / 2)   # speed falls smoothly to zero
H, W = frames[0].shape[:2]
p = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", "24", "-i", "-",
                      "-c:v", "libx264", "-crf", "20", "-preset", "slow", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out], stdin=subprocess.PIPE)
for n in range(int(T * 24) + 1):
    p.stdin.write(frames[min(len(frames) - 1, round(pos(min(n / 24, T)) * 24))].tobytes())
p.stdin.close(); p.wait(); print("done", out, "steady rate", round(r, 3))
