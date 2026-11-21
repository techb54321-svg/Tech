#!/usr/bin/env bash
# Makes the files to upload to the browser stores, from the extension in ../mr-blocky:
#
#   upload/mr-blocky-chrome.zip    for the Chrome Web Store (Chrome, Edge and Brave)
#   upload/mr-blocky-firefox.zip   for Firefox Add-ons
#
# Run it again after changing the extension, and after raising its version number in
# ../mr-blocky/manifest.json: each store only accepts a higher version than the last.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
SRC="$HERE/../mr-blocky"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$HERE/upload"

for store in chrome firefox; do
  mkdir -p "$WORK/$store"
  cp -r "$SRC/." "$WORK/$store/"
  rm -f "$WORK/$store/README.md"
  if [ "$store" = chrome ]; then
    # Chrome runs the background as a service worker only, and does not know Firefox's settings.
    python3 - "$WORK/$store/manifest.json" <<'PY'
import json, sys
path = sys.argv[1]
manifest = json.load(open(path))
manifest['background'] = {'service_worker': manifest['background']['service_worker']}
manifest.pop('browser_specific_settings', None)
open(path, 'w').write(json.dumps(manifest, indent=2) + '\n')
PY
  fi
  # The stores want manifest.json at the top of the zip, not inside a folder.
  rm -f "$HERE/upload/mr-blocky-$store.zip"
  (cd "$WORK/$store" && zip -q -r -X "$HERE/upload/mr-blocky-$store.zip" .)
  echo "Made upload/mr-blocky-$store.zip"
done
