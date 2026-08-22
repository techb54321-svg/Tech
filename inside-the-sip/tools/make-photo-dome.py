#!/usr/bin/env python3
"""Turn a flat photo into a 360 panorama + depth map for the VR photo dome.

A normal photo only covers a slice of the sphere, and it is flat — which in a
headset reads as wallpaper, because both eyes see the same image and leaning
your head moves nothing. So we emit two files:

1. <output>.jpg — the colour panorama. The photo is projected properly
   (gnomonic / rectilinear) into the forward part of the sphere so it looks
   like a real window rather than a sphere-stretched smear, and the rest of
   the sphere is filled with a mirrored, heavily blurred, darkened version of
   the same photo so turning your head never hits a hard edge.
2. <output>-depth.png — a greyscale depth map in the same projection, which
   the app uses to displace the dome's vertices. That is what turns the
   picture into a place: each eye gets its own view of it, and leaning moves
   the near teeth against the far throat.

The depth estimate is a heuristic tuned for a photo of a cavity: dark and
central reads as deep (the throat), bright or peripheral reads as near (teeth,
lips). It is heavily blurred, because smooth depth displaces cleanly while
sharp depth edges tear the mesh into spikes.

Usage:
    python3 tools/make-photo-dome.py <photo> <output.jpg> [--hfov 120]

Requires Pillow + numpy (dev-only; the app ships just the generated images).
"""

import argparse
import math

import numpy as np
from PIL import Image, ImageFilter

# Depth of the blurred surround, i.e. the value that means "the dome's own
# radius". The app maps 0..1 onto NEAR..FAR around it.
SURROUND_DEPTH = 0.6


def build(photo_path: str, out_path: str, hfov_deg: float, width: int) -> None:
    photo = Image.open(photo_path).convert("RGB")
    pw, ph = photo.size
    height = width // 2

    hfov = math.radians(hfov_deg)
    # Keep the photo's aspect ratio so nothing is stretched.
    vfov = 2 * math.atan(math.tan(hfov / 2) * ph / pw)

    # --- background: mirrored + blurred so the whole sphere is covered -------
    small = photo.resize((48, 27), Image.LANCZOS).filter(ImageFilter.GaussianBlur(6))
    tile = np.asarray(small, dtype=np.float32)
    mirrored = np.concatenate([tile, tile[:, ::-1]], axis=1)          # 2 wide
    mirrored = np.concatenate([mirrored, mirrored], axis=1)           # 4 wide
    mirrored = np.concatenate([mirrored, mirrored[::-1, :]], axis=0)  # 2 tall
    bg = Image.fromarray(mirrored.astype(np.uint8)).resize((width, height), Image.LANCZOS)
    bg = bg.filter(ImageFilter.GaussianBlur(width / 40))
    bg_arr = np.asarray(bg, dtype=np.float32) * 0.6  # dim it: the eye goes to the photo

    # --- foreground: rectilinear projection of the photo --------------------
    lon = (np.linspace(0, width - 1, width, dtype=np.float32) / width - 0.5) * 2 * math.pi
    lat = (0.5 - np.linspace(0, height - 1, height, dtype=np.float32) / height) * math.pi
    lon_g, lat_g = np.meshgrid(lon, lat)

    cos_lat = np.cos(lat_g)
    # Camera forward is -Z, lon 0 / lat 0 is dead ahead.
    dx = np.sin(lon_g) * cos_lat
    dy = np.sin(lat_g)
    dz = -np.cos(lon_g) * cos_lat

    front = dz < -1e-3
    depth = np.where(front, -dz, 1.0)
    # Normalised image plane coords in [-1, 1] across the photo.
    px = (dx / depth) / math.tan(hfov / 2)
    py = (dy / depth) / math.tan(vfov / 2)

    inside = front & (np.abs(px) <= 1) & (np.abs(py) <= 1)
    sx = np.clip(((px + 1) / 2) * (pw - 1), 0, pw - 1)
    sy = np.clip(((1 - py) / 2) * (ph - 1), 0, ph - 1)

    photo_arr = np.asarray(photo, dtype=np.float32)
    fg = bilinear(photo_arr, sx, sy)

    # Feather the photo's border into the blurred surround (no hard edge).
    edge = np.maximum(np.abs(px), np.abs(py))
    alpha = np.clip((0.95 - edge) / 0.25, 0, 1)
    alpha = np.where(inside, alpha, 0).astype(np.float32)[..., None]

    out = fg * alpha + bg_arr * (1 - alpha)
    Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(
        out_path, quality=88, optimize=True, progressive=True
    )
    print(f"wrote {out_path} ({width}x{height}, hfov {hfov_deg:.0f}°, vfov {math.degrees(vfov):.0f}°)")

    depth_path = out_path.rsplit(".", 1)[0] + "-depth.png"
    write_depth(photo, depth_path, px, py, alpha[..., 0], sx, sy, width, height)


def write_depth(photo, depth_path, px, py, alpha, sx, sy, width, height):
    """Estimate depth for a photo of a cavity and save it in panorama space.

    Two cues, both crude on their own and complementary together:
      * luminance — inside a mouth the light falls off with distance, so dark
        is far (the throat) and bright is near (enamel, wet lip highlights);
      * distance from the centre — the photo looks straight down the axis of
        the cavity, so the middle is the deep end and the rim is closest.
    """
    gray = np.asarray(photo.convert("L").filter(ImageFilter.GaussianBlur(6)), dtype=np.float32) / 255
    lum = bilinear(gray[..., None], sx, sy)[..., 0]

    radial = np.clip(np.sqrt(px ** 2 + py ** 2), 0, 1)  # 0 centre .. 1 rim
    far = np.clip(0.55 * (1 - lum) + 0.55 * (1 - radial), 0, 1)

    # Outside the photo, sit at the mid depth the dome radius represents, and
    # cross-fade with the same feather the colour uses so there is no crease.
    far = far * alpha + SURROUND_DEPTH * (1 - alpha)

    img = Image.fromarray((np.clip(far, 0, 1) * 255).astype(np.uint8), mode="L")
    # Depth wants to be smooth, not detailed: every bump here becomes real
    # geometry in the headset. Half resolution + a wide blur keeps the mesh
    # calm and the file small.
    img = img.resize((width // 4, height // 4), Image.LANCZOS)
    img = img.filter(ImageFilter.GaussianBlur(width / 320))
    img.save(depth_path, optimize=True)
    print(f"wrote {depth_path} ({img.width}x{img.height} depth, 0=near 255=far)")


def bilinear(src: np.ndarray, sx: np.ndarray, sy: np.ndarray) -> np.ndarray:
    h, w, _ = src.shape
    x0 = np.floor(sx).astype(np.int32)
    y0 = np.floor(sy).astype(np.int32)
    x1 = np.clip(x0 + 1, 0, w - 1)
    y1 = np.clip(y0 + 1, 0, h - 1)
    fx = (sx - x0)[..., None]
    fy = (sy - y0)[..., None]
    top = src[y0, x0] * (1 - fx) + src[y0, x1] * fx
    bottom = src[y1, x0] * (1 - fx) + src[y1, x1] * fx
    return top * (1 - fy) + bottom * fy


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("photo")
    ap.add_argument("output")
    ap.add_argument("--hfov", type=float, default=120.0, help="horizontal field of view the photo covers")
    ap.add_argument("--width", type=int, default=4096, help="panorama width (height is half)")
    args = ap.parse_args()
    build(args.photo, args.output, args.hfov, args.width)
