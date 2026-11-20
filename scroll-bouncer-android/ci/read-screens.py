"""Describes a folder of phone screenshots in words and numbers.

    read-screens.py folder [--must-cross]

For each screenshot: how much of it is his mint colour and where, and how bright
the screen is overall. He should show up as mint near the top, moving from left
to right, then the screen should go dark with him still on it.

Two of the screenshots are also drawn as text, so the layout can be checked
without opening an image: m is him, x is the red close button, w is white (his
speech bubble, on the dark screen), . is dark and a space is anything else.
"""
import pathlib
import sys

from PIL import Image

folder = pathlib.Path(sys.argv[1])
must_cross = "--must-cross" in sys.argv  # fail unless he gets past the middle of the screen
times = dict(line.split() for line in (folder / "times.txt").read_text().splitlines())


def is_mint(pixel):
    r, g, b = pixel[:3]
    return g > 150 and b > 120 and r < 140 and g - r > 70 and g >= b


def is_red(pixel):
    r, g, b = pixel[:3]
    return r > 200 and g < 110 and b < 110


def letter(pixel):
    if is_mint(pixel):
        return "m"
    if is_red(pixel):
        return "x"
    if min(pixel[:3]) > 235:
        return "w"
    if max(pixel[:3]) < 40:
        return "."
    return " "


def drawing(image):
    """The top 30% of the screen as 72 x 22 characters."""
    top = image.crop((0, 0, image.width, int(image.height * 0.3))).resize((72, 22))
    pixels = top.load()
    return "\n".join("".join(letter(pixels[x, y]) for x in range(72)).rstrip() for y in range(22))


rows = []
for path in sorted(folder.glob("*.png")):
    try:
        image = Image.open(path).convert("RGB")
    except Exception as error:  # a screenshot can come back empty while the screen changes
        print(f"{path.stem}: unreadable ({error})")
        continue
    small = image.resize((image.width // 4, image.height // 4))
    pixels = small.load()
    mint = [(x, y) for y in range(small.height) for x in range(small.width) if is_mint(pixels[x, y])]
    brightness = sum(sum(pixels[x, y]) for y in range(small.height) for x in range(small.width)) / (3 * small.width * small.height)
    if mint:
        xs, ys = [x for x, _ in mint], [y for _, y in mint]
        where = f"x {min(xs) * 4}-{max(xs) * 4}, y {min(ys) * 4}-{max(ys) * 4} of {image.width}x{image.height}"
    else:
        where = "nowhere"
    rows.append((path, image, len(mint), brightness, max(xs) * 4 / image.width if mint else 0))
    print(f"{path.stem}  t={times.get(path.stem, '?'):>5}s  mint pixels={len(mint):5d}  at {where}  brightness={brightness:5.1f}")

if not rows:
    sys.exit("no screenshots could be read")

mintiest = max(rows, key=lambda row: row[2])
dark = [row for row in rows if row[2] > 20 and row[3] < 60]
if mintiest[2] < 40:
    sys.exit("FAILED: he never appeared on the screen")
if must_cross and max(row[4] for row in rows if row[2] >= 40) < 0.6:
    sys.exit("FAILED: he never got past the middle of the screen")
for label, row in (("walking", mintiest), ("dark", dark[-1] if dark else None)):
    if row is None:
        print(f"no {label} screenshot to draw")
        continue
    print(f"--- {label}: screenshot {row[0].stem}, top of the screen ---")
    print(drawing(row[1]))
    print("---")
