"""Lists the words on the phone's screen, or finds where to tap for one of them.

    read-ui.py ui.xml                 prints every piece of text on screen
    read-ui.py ui.xml "Some button"   prints the x and y of the middle of it

The file is what `adb shell uiautomator dump` writes.
"""
import re
import sys

xml = open(sys.argv[1], encoding="utf-8", errors="replace").read()
nodes = re.findall(r'<node[^>]*?text="([^"]*)"[^>]*?bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', xml)

if len(sys.argv) > 2:
    wanted = sys.argv[2].lower()
    for text, x1, y1, x2, y2 in nodes:
        if text.lower() == wanted:
            print((int(x1) + int(x2)) // 2, (int(y1) + int(y2)) // 2)
            sys.exit(0)
    sys.exit(f'"{sys.argv[2]}" is not on the screen')

print("On screen: " + " | ".join(text for text, *_ in nodes if text))
