#!/usr/bin/env bash
# Re-encode every mp3 in web-assets/music/ to 96 kbps.
#
# Cloudflare Pages has a 25 MiB per-file limit. 96 kbps keeps every
# file well under it while preserving quality for ambient music.
# Idempotent: files already at or below 96 kbps are kept untouched, so
# a re-run skips them.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MUSIC_DIR="$(cd "$SCRIPT_DIR/.." && pwd)/web-assets/music"
BITRATE="96k"
LIMIT_BYTES=$((25 * 1024 * 1024))

if [ ! -d "$MUSIC_DIR" ]; then
  echo "No $MUSIC_DIR directory. Nothing to compress."
  exit 0
fi

shopt -s nullglob
files=("$MUSIC_DIR"/*.mp3)

if [ ${#files[@]} -eq 0 ]; then
  echo "No mp3 files in $MUSIC_DIR. Nothing to compress."
  exit 0
fi

fail=0
saved=0
for file in "${files[@]}"; do
  name="$(basename "$file")"
  before=$(stat -c%s "$file")

  rate=$(ffprobe -v error -select_streams a:0 \
    -show_entries stream=bit_rate -of default=noprint_wrappers=1:nokey=1 \
    "$file" 2>/dev/null | tr -d '\n')
  if [ -n "$rate" ] && [ "$rate" -le 96000 ]; then
    echo "skip  $name (already $((rate / 1000)) kbps)"
    continue
  fi

  tmp="$file.tmp.mp3"
  if ! ffmpeg -y -loglevel error -i "$file" -map 0:a:0 -vn \
    -codec:a libmp3lame -b:a "$BITRATE" "$tmp"; then
    echo "FAIL  $name (ffmpeg error)"
    rm -f "$tmp"
    fail=1
    continue
  fi

  after=$(stat -c%s "$tmp")
  if [ "$after" -gt "$LIMIT_BYTES" ]; then
    echo "FAIL  $name -> $after bytes (still exceeds 25 MiB)"
    rm -f "$tmp"
    fail=1
    continue
  fi

  mv "$tmp" "$file"
  saved=$((saved + before - after))
  printf "ok    %s (%d MiB -> %d MiB)\n" "$name" \
    "$(( (before + 1048575) / 1048576 ))" "$(( (after + 1048575) / 1048576 ))"
done

if [ "$fail" -ne 0 ]; then
  echo "Some files failed. Re-run the script to retry only the missing ones."
  exit 1
fi
echo "Done. Freed $(( (saved + 1048575) / 1048576 )) MiB across ${#files[@]} files."
