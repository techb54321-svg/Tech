"""Finds a button of one flat colour in a screenshot, and prints where to tap it.

    find-button.py screenshot.png 2dd4bf

Prints the x and y of the middle of the button, or fails if there is none.

The buttons he shows, such as "Let's dance!", are in his own web page over the
top of other apps, where the phone's list of what is on screen does not reach,
so they are found by their colour instead. His teal "Let's dance!" button is
close to his own mint, but he is shaded and the button is flat, so only the
button has many pixels of exactly its colour.
"""
import sys

from PIL import Image

NEAR = 6       # how far each of red, green and blue may be from the colour
ENOUGH = 1500  # pixels of the colour, at full size, for it to be a button rather than a speck
STEP = 3       # look at every third pixel each way, which is plenty to find a button

image = Image.open(sys.argv[1]).convert("RGB")
want = tuple(int(sys.argv[2][i:i + 2], 16) for i in (0, 2, 4))
small = image.resize((image.width // STEP, image.height // STEP), Image.NEAREST)
data = small.tobytes()  # red, green, blue, red, green, blue, ...
xs, ys = [], []
for i in range(0, len(data), 3):
    if all(abs(data[i + c] - want[c]) <= NEAR for c in range(3)):
        xs.append(i // 3 % small.width * STEP)
        ys.append(i // 3 // small.width * STEP)

found = len(xs) * STEP * STEP
if found < ENOUGH:
    sys.exit(f"no button of colour #{sys.argv[2]} on the screen (about {found} pixels of it)")
# The middle of the button: half of its pixels are to each side, and half above and below.
xs.sort()
ys.sort()
print(xs[len(xs) // 2], ys[len(ys) // 2])
