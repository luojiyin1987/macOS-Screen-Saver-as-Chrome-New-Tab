#!/usr/bin/env bash
# Download the 40 zen-mode music files into web-assets/music/.
#
# Source: the author's public CDN (macify.knb.im), same files served to
# the Chrome Web Store build. Idempotent: complete files are kept, so a
# failed run can simply be re-run. Fails if any file exceeds the
# Cloudflare Pages per-file limit of 25 MiB.

set -euo pipefail

BASE_URL="https://macify.knb.im/music"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)/web-assets/music"
COUNT=40
LIMIT_BYTES=$((25 * 1024 * 1024))

mkdir -p "$OUT_DIR"

fail=0
for i in $(seq 1 "$COUNT"); do
  name=$(printf "music%05d.mp3" "$i")
  file="$OUT_DIR/$name"

  if [ -s "$file" ]; then
    size=$(stat -c%s "$file")
    if [ "$size" -le "$LIMIT_BYTES" ]; then
      echo "skip  $name (already present)"
      continue
    fi
    echo "reget $name (oversized, re-downloading)"
  fi

  code=$(curl -s -o "$file" -w "%{http_code}" --max-time 180 "$BASE_URL/$name")
  size=$(stat -c%s "$file" 2>/dev/null || echo 0)
  if [ "$code" != "200" ]; then
    echo "FAIL  $name -> HTTP $code"
    rm -f "$file"
    fail=1
    continue
  fi
  if [ "$size" -gt "$LIMIT_BYTES" ]; then
    echo "FAIL  $name -> $size bytes (exceeds 25 MiB)"
    fail=1
  else
    echo "ok    $name ($(( (size + 1048575) / 1048576 )) MiB)"
  fi
done

if [ "$fail" -ne 0 ]; then
  echo "Some files failed. Re-run the script to retry only the missing ones."
  exit 1
fi
echo "All $COUNT music files present in $OUT_DIR"
