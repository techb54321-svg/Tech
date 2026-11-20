"""Describes a folder of phone screenshots in words and numbers.

    read-screens.py folder [--must-walk] [--brief]

He walks along the top of the screen, so each screenshot is checked for his
mint colour in its top quarter. He should move from left to right there, then
the screen should go dark with him still on it. The app underneath may be a
dark one itself, so "dark" here means darker than it was while he walked.

Unless --brief is given, every screenshot gets a line, and two of them are also
drawn as text so the layout can be checked without opening an image: m is him,
x is the red close button, w is white (his speech bubble, on the dark screen),
. is dark and a space is anything else.
"""
import pathlib
import sys

from PIL import Image

folder = pathlib.Path(sys.argv[1])
must_walk = "--must-walk" in sys.argv  # fail unless he is seen moving most of the way across
brief = "--brief" in sys.argv
times = dict(line.split() for line in (folder / "times.txt").read_text().splitlines())
ENOUGH = 200  # this many mint pixels in the top quarter (at a quarter size) is him, not an icon


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


rows = []  # (path, image, mint pixels, brightness, how far across he is)
for path in sorted(folder.glob("*.png")):
    try:
        image = Image.open(path).convert("RGB")
    except Exception as error:  # a screenshot can come back empty while the screen changes
        print(f"{path.stem}: unreadable ({error})")
        continue
    small = image.resize((image.width // 4, image.height // 4))
    pixels = small.load()
    mint = [(x, y) for y in range(small.height // 4) for x in range(small.width) if is_mint(pixels[x, y])]
    brightness = sum(sum(pixels[x, y]) for y in range(small.height) for x in range(small.width)) / (3 * small.width * small.height)
    if mint:
        xs, ys = [x for x, _ in mint], [y for _, y in mint]
        where = f"x {min(xs) * 4}-{max(xs) * 4}, y {min(ys) * 4}-{max(ys) * 4} of {image.width}x{image.height}"
    else:
        where = "nowhere"
    rows.append((path, image, len(mint), brightness, max(xs) * 4 / image.width if mint else 0))
    if not brief:
        print(f"{path.stem}  t={times.get(path.stem, '?'):>5}s  mint pixels={len(mint):5d}  at {where}  brightness={brightness:5.1f}")

if not rows:
    sys.exit("no screenshots could be read")

him = [row for row in rows if row[2] >= ENOUGH]
across = [row[4] for row in him]
# The screen as it was when he first appeared, and the screenshots where it is clearly darker than that.
lit = him[0][3] if him else 0
dark = [row for row in him if row[3] < lit * 0.7]
walking = [row for row in him if row not in dark]
print(f"He is in {len(him)} of {len(rows)} screenshots"
      + (f", from {min(across):.0%} to {max(across):.0%} of the way across" if across else "")
      + f". The screen has gone dark in {len(dark)} of them.")
if not him:
    sys.exit("FAILED: he never appeared on the screen")
if must_walk:
    if len(across) < 2 or max(across) - min(across) < 0.15:
        sys.exit("FAILED: he was not seen walking across the screen")
    if max(across) < 0.6:
        sys.exit("FAILED: he never got past the middle of the screen")
if not brief:
    for label, row in (("walking", max(walking or him, key=lambda row: row[2])), ("dark", dark[-1] if dark else None)):
        if row is None:
            print(f"no {label} screenshot to draw")
            continue
        print(f"--- {label}: screenshot {row[0].stem}, top of the screen ---")
        print(drawing(row[1]))
        print("---")
