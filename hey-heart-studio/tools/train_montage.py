"""Train scene edit: one continuous take, no dissolves, no pauses.
The AI Heart sits facing backwards on the engine, so the stretch where the train drives away up the right side
(its face looking back at us) is left out: the scene starts with the train already curving over the head, then
down the left side and past the feet, played a little slower (toy-train pace) to fill the narration."""
import subprocess, sys

src, out = sys.argv[1], sys.argv[2]
SPEED = float(sys.argv[3]) if len(sys.argv) > 3 else 0.55
START, END = 1.33, 4.42                                   # seconds of the AI lap that are used
subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{START}", "-to", f"{END}", "-i", src,
                "-vf", f"scale=1280:720,setpts=PTS/{SPEED},fps=24",
                "-an", "-c:v", "libx264", "-crf", "21", "-preset", "slow", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out], check=True)
print("done", out)
