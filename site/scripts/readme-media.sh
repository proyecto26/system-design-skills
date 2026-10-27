#!/usr/bin/env bash
# README hero media from a rendered HeroFilm: an animated WebP (inline in GitHub READMEs)
# plus a 1280px MP4 it links to. Needs ffmpeg and img2webp (libwebp).
# Usage: bash scripts/readme-media.sh <input.mp4> <out-dir>
set -euo pipefail
in="$1"; out="$2"
frames="$(mktemp -d)"; trap 'rm -rf "$frames"' EXIT
ffmpeg -loglevel error -y -i "$in" -c:v libx264 -crf 24 -preset slow -pix_fmt yuv420p -movflags +faststart -vf scale=1280:-2 "$out/hero.mp4"
ffmpeg -loglevel error -i "$in" -vf "fps=15,scale=1100:-1:flags=lanczos" "$frames/f%04d.png"
img2webp -loop 0 -lossy -q 70 -m 6 -d 67 "$frames"/f*.png -o "$out/hero.webp"
ls -la "$out/hero.mp4" "$out/hero.webp"
