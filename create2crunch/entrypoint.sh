#!/usr/bin/env bash
set -euo pipefail

echo "🚀 Starting Vanity Miner"

if command -v clinfo >/dev/null 2>&1; then
  GPU_COUNT=$(clinfo -l 2>/dev/null | awk '/^ +Device #/{count++} END{print count+0}')
elif command -v nvidia-smi >/dev/null 2>&1; then
  nvidia-smi --list-gpus || true
  GPU_COUNT=$(nvidia-smi --list-gpus | wc -l || echo 0)
else
  echo "No GPU tooling found; assuming 0 GPUs"
  GPU_COUNT=0
fi

echo "Found ${GPU_COUNT} GPU(s)"

# Ensure logs directory exists
mkdir -p /tmp

if [ "$GPU_COUNT" -gt 0 ]; then
  for DEVICE_ID in $(seq 0 $((GPU_COUNT-1))); do
    echo "Starting worker for GPU ${DEVICE_ID}"
    DEVICE_ID=${DEVICE_ID} nohup node /home/worker.js > "/tmp/miner_${DEVICE_ID}.log" 2>&1 &
  done
else
  echo "No GPUs detected; starting a single CPU worker as fallback"
  DEVICE_ID=0 nohup node /home/worker.js > "/tmp/miner_0.log" 2>&1 &
fi

# Tail logs from all workers
sleep 1
if ls /tmp/miner_*.log >/dev/null 2>&1; then
  echo "Workers started. Tailing logs..."
  exec tail -F /tmp/miner_*.log
else
  echo "No logs found to tail; exiting"
  exit 1
fi