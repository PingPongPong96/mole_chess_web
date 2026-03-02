#!/bin/bash
set -e
cd "$(dirname "$0")"
mkdir -p offline_release/release_logs
TS="$(date +%Y%m%d_%H%M%S)"
LOG="offline_release/release_logs/release_${TS}.log"

echo "[release] Running release:expo ..."
echo "[release] Log: $LOG"
if npm run release:expo > "$LOG" 2>&1; then
  echo "[release] SUCCESS."
  echo "[release] Please send folder under offline_release/outgoing_release_*"
else
  echo "[release] FAILED. See log: $LOG"
  exit 1
fi
