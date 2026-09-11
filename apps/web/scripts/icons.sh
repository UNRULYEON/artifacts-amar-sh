#!/bin/sh
# Renders every PNG icon from public/icon.svg. macOS only (qlmanage, sips).
set -eu
cd "$(dirname "$0")/.."
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

render() { # render <svg> <size> <out>
  qlmanage -t -s "$2" -o "$tmp" "$1" >/dev/null 2>&1
  mv "$tmp/$(basename "$1").png" "$3"
}

render public/icon.svg 1024 public/icon-1024.png
sips -z 512 512 public/icon-1024.png --out public/icon-512.png >/dev/null
sips -z 192 192 public/icon-1024.png --out public/icon-192.png >/dev/null
sips -z 180 180 public/icon-1024.png --out public/apple-icon.png >/dev/null

# Maskable: the mark sits inside the 80% safe zone.
sed 's/viewBox="0 0 1024 1024"/viewBox="-128 -128 1280 1280"/' public/icon.svg > "$tmp/maskable.svg"
render "$tmp/maskable.svg" 512 public/icon-maskable-512.png
