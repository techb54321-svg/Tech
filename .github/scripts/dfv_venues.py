#!/usr/bin/env python3
"""Turn an osmium GeoJSON-sequence export into the Paw Sign app's venue lists.

Usage: dfv_venues.py <export.geojsonseq> <venues.json> <venues-nosign.json>

venues.json         places in Victoria with dog-access information: food, drink,
                    retail and places to stay that carry a `dog` tag, parks and
                    beaches that carry one, and every dog park.
venues-nosign.json  named cafes, pubs, bars and restaurants with no `dog` tag,
                    as compact rows [type, id, lat, lon, name, kind].
"""
import json
import re
import sys
import time

FOOD = {"cafe", "pub", "bar", "restaurant", "biergarten", "fast_food", "ice_cream"}
ASK = {"cafe": "c", "pub": "p", "bar": "p", "restaurant": "r"}
STAY = {"hotel", "motel", "guest_house", "hostel", "caravan_site", "camp_site", "apartment", "chalet"}
GREEN = {"park", "nature_reserve", "garden"}
KEEP = {"name", "dog", "amenity", "shop", "leisure", "tourism", "natural", "outdoor_seating", "website",
        "contact:website", "email", "contact:email", "addr:housenumber", "addr:street", "addr:suburb", "addr:city"}

# Rough outline of Victoria as (lon, lat). The northern edge follows the Murray,
# so places within a few kilometres of the border may land on the wrong side.
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
    try:
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
    except (TypeError, IndexError, ZeroDivisionError):
        return None


def osm_ref(fid):
    """osmium ids look like n123, w123, or a<2*way> / a<2*relation+1> for areas."""
    m = re.fullmatch(r"([nwra])(\d+)", str(fid))
    if not m:
        return None
    kind, num = m.group(1), int(m.group(2))
    if kind == "a":
        return ("way", num // 2) if num % 2 == 0 else ("relation", (num - 1) // 2)
    return ({"n": "node", "w": "way", "r": "relation"}[kind], num)


def classify(tags):
    """'info' for a place with dog-access information, 'ask' for one worth asking, else None."""
    if tags.get("leisure") == "dog_park":
        return "info"
    name, dog = tags.get("name"), tags.get("dog")
    if not name:
        return None
    if dog:
        if (tags.get("amenity") in FOOD or tags.get("shop") or tags.get("tourism") in STAY
                or tags.get("leisure") in GREEN or tags.get("natural") == "beach"):
            return "info"
        return None
    return "ask" if tags.get("amenity") in ASK else None


def main(src, dst, dst_ask):
    info, ask = {}, {}
    with open(src, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip().lstrip("\x1e")
            if not line:
                continue
            feat = json.loads(line)
            tags = feat.get("properties") or {}
            kind = classify(tags)
            if not kind:
                continue
            ref = osm_ref(feat.get("id"))
            pt = point(feat.get("geometry") or {})
            if not ref or not pt or not in_vic(pt[0], pt[1]):
                continue
            lat, lon = round(pt[1], 5), round(pt[0], 5)
            if kind == "info":
                info[ref] = {"type": ref[0], "id": ref[1], "lat": lat, "lon": lon,
                             "tags": {k: v for k, v in tags.items() if k in KEEP}}
            else:
                ask[ref] = [ref[0][0], ref[1], lat, lon, tags["name"][:60], ASK[tags["amenity"]]]
    stamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    elements = [info[k] for k in sorted(info)]
    with open(dst, "w", encoding="utf-8") as fh:
        json.dump({"generated": stamp, "elements": elements}, fh, ensure_ascii=False, separators=(",", ":"))
    with open(dst_ask, "w", encoding="utf-8") as fh:
        json.dump({"generated": stamp, "rows": [ask[k] for k in sorted(ask) if k not in info]}, fh,
                  ensure_ascii=False, separators=(",", ":"))
    groups = {}
    for e in elements:
        t = e["tags"]
        g = ("dog park" if t.get("leisure") == "dog_park" else "park or beach" if t.get("leisure") or t.get("natural")
             else "stay" if t.get("tourism") else "food, drink or shop")
        groups[g] = groups.get(g, 0) + 1
    print("Saved %d places with dog info: %s" % (len(elements), ", ".join("%s %d" % kv for kv in sorted(groups.items()))))
    print("Saved %d venues with no dog info yet" % len(ask))
    return 0 if elements else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1], sys.argv[2], sys.argv[3]))
