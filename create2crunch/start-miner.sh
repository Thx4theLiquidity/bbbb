#!/usr/bin/env bash
set -euo pipefail

echo "🚀 Starting Vanity Miner"

# Verify Redis configuration
if [[ -z "${REDIS_HOST:-}" ]]; then
  echo "❌ REDIS_HOST env variable not set. Exiting." >&2
  exit 1
fi

GPU_COUNT=$(nvidia-smi --list-gpus | wc -l || echo 0)
if [[ "$GPU_COUNT" -eq 0 ]]; then
  echo "⚠️  No GPUs detected via nvidia-smi. Proceeding anyway."
fi

echo "Found $GPU_COUNT GPU(s)"

# Spawn one worker per GPU (or 1 worker if none detected)
if [[ "$GPU_COUNT" -eq 0 ]]; then
  GPU_COUNT=1
fi

for DEVICE_ID in $(seq 0 $((GPU_COUNT-1))); do
  echo "Starting worker for GPU $DEVICE_ID"
  # Spawn worker with per-process DEVICE_ID while inheriting Redis vars
  (
    DEVICE_ID="$DEVICE_ID" \
    nohup node /home/worker.js > "/tmp/miner_${DEVICE_ID}.log" 2>&1 &
  )
  sleep 0.5
done

echo "Workers started. Tailing logs..."
tail -n 100 -f /tmp/miner_*.log