"""Describes a folder of phone screenshots in numbers, and prints two of them small.

For each screenshot: how much of it is his mint colour, and how bright the
screen is overall. He should show up as mint near the top, then the screen
should go dark with him still on it, then he should be gone.
"""
import base64
import io
import pathlib
import sys

from PIL import Image

folder = pathlib.Path(sys.argv[1])
times = dict(line.split() for line in (folder / "times.txt").read_text().splitlines())


def is_mint(pixel):
    r, g, b = pixel[:3]
    return g > 150 and b > 120 and r < 140 and g - r > 70 and g >= b


rows = []
for path in sorted(folder.glob("*.png")):
    try:
        image = Image.open(path).convert("RGB")
    except Exception as error:  # a screenshot can come back empty while the screen changes
        print(f"{path.stem}: unreadable ({error})")
        continue
    small = image.resize((image.width // 4, image.height // 4))
    pixels = list(small.getdata())
    mint = sum(is_mint(p) for p in pixels)
    top = sum(is_mint(p) for p in pixels[: small.width * (small.height // 4)])
    brightness = sum(sum(p) for p in pixels) / (3 * len(pixels))
    rows.append((path, small, mint, top, brightness))
    print(f"{path.stem}  t={times.get(path.stem, '?'):>5}s  mint pixels={mint:5d} (top quarter {top:5d})  brightness={brightness:5.1f}")

if not rows:
    sys.exit("no screenshots could be read")

mintiest = max(rows, key=lambda row: row[3])
darkest = min((row for row in rows if row[2] > 20), key=lambda row: row[4], default=None)
print(f"most of him near the top: {mintiest[0].stem}; darkest with him on screen: {darkest[0].stem if darkest else 'none'}")
if mintiest[3] < 40:
    sys.exit("FAILED: he never appeared near the top of the screen")

for label, row in (("WALKING", mintiest), ("DARK", darkest)):
    if row is None:
        continue
    thumb = row[1].resize((row[1].width * 2 // 3, row[1].height * 2 // 3))
    data = io.BytesIO()
    thumb.save(data, "JPEG", quality=55)
    print(f"-----BEGIN {label}-----")
    print(base64.b64encode(data.getvalue()).decode())
    print(f"-----END {label}-----")
