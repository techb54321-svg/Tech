#!/usr/bin/env python3
"""Turn an osmium GeoJSON-sequence export into the Paw Sign app's venues.json.

Usage: dfv_venues.py <export.geojsonseq> <venues.json>

Keeps named food, drink and retail venues in Victoria that carry a `dog` tag,
reduced to one point and the handful of tags the app reads.
"""
import json
import re
import sys
import time

FOOD = {"cafe", "pub", "bar", "restaurant", "biergarten", "fast_food", "ice_cream"}
KEEP = {"name", "dog", "amenity", "shop", "outdoor_seating", "website", "contact:website", "email",
        "contact:email", "addr:housenumber", "addr:street", "addr:suburb", "addr:city"}

# Rough outline of Victoria as (lon, lat). The northern edge follows the Murray,
# so venues within a few kilometres of the border may land on the wrong side.
VIC = [(140.96, -33.98), (142.2, -34.1), (142.8, -34.55), (143.35, -34.75), (143.6, -35.3), (144.3, -35.75),
       (144.75, -36.1), (145.3, -35.85), (146.0, -35.98), (146.9, -36.09), (147.5, -35.98), (148.05, -36.4),
       (148.2, -36.8), (149.98, -37.51), (149.98, -39.3), (140.96, -39.3)]


def in_vic(lon, lat):
    inside = False
    j = len(VIC) - 1
    for i in range(len(VIC)):
        xi, yi = VIC[i]
        xj, yj = VIC[j]
        if (yi > lat) != (yj > lat) and lon < (xj - xi) * (lat - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def point(geom):
    kind, c = geom.get("type"), geom.get("coordinates")
    if kind == "Point":
        return c
    if kind == "LineString":
        ring = c
    elif kind == "Polygon":
        ring = c[0]
    elif kind == "MultiPolygon":
        ring = c[0][0]
    else:
        return None
    return [sum(p[0] for p in ring) / len(ring), sum(p[1] for p in ring) / len(ring)]


def osm_ref(fid):
    """osmium ids look like n123, w123, or a<2*way> / a<2*relation+1> for areas."""
    m = re.fullmatch(r"([nwra])(\d+)", str(fid))
    if not m:
        return None
    kind, num = m.group(1), int(m.group(2))
    if kind == "a":
        return ("way", num // 2) if num % 2 == 0 else ("relation", (num - 1) // 2)
    return ({"n": "node", "w": "way", "r": "relation"}[kind], num)


def main(src, dst):
    out = {}
    with open(src, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip().lstrip("\x1e")
            if not line:
                continue
            feat = json.loads(line)
            tags = feat.get("properties") or {}
            if not tags.get("name") or not tags.get("dog"):
                continue
            if tags.get("amenity") not in FOOD and not tags.get("shop"):
                continue
            ref = osm_ref(feat.get("id"))
            pt = point(feat.get("geometry") or {})
            if not ref or not pt or not in_vic(pt[0], pt[1]):
                continue
            out[ref] = {"type": ref[0], "id": ref[1], "lat": round(pt[1], 6), "lon": round(pt[0], 6),
                        "tags": {k: v for k, v in tags.items() if k in KEEP}}
    elements = [out[k] for k in sorted(out)]
    with open(dst, "w", encoding="utf-8") as fh:
        json.dump({"generated": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "elements": elements}, fh,
                  ensure_ascii=False, separators=(",", ":"))
    counts = {}
    for e in elements:
        counts[e["tags"]["dog"]] = counts.get(e["tags"]["dog"], 0) + 1
    print("Saved %d venues: %s" % (len(elements), ", ".join("%s %d" % kv for kv in sorted(counts.items()))))
    return 0 if elements else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1], sys.argv[2]))
