## Vanity Miner: Fix Summary, Redis Config, and Vast.ai Setup

### What we fixed
- **ENTRYPOINT and startup**: Added `entrypoint.sh` to auto-launch one worker per GPU and tail logs. Switched Dockerfiles to a **JSON-form ENTRYPOINT** to avoid signal handling issues and the Vast.ai warning.
- **Redis/BullMQ reliability**: Updated `create2crunch/worker.js` to support `REDIS_URL` or discrete vars, optional `REDIS_USERNAME`/`REDIS_PASS`, and `REDIS_TLS=true`. Added resilient ioredis options (`maxRetriesPerRequest: null`, `enableReadyCheck: false`, retry strategy, and `reconnectOnError`) to prevent BullMQ lock/update issues.
- **OpenCL base + build path**: `create2crunch/Dockerfile.working` targets Ubuntu 20.04 with OpenCL runtime (no CUDA) and wires the new entrypoint.

### Files changed
- `create2crunch/worker.js`: Redis URL/TLS/username support and resilient options.
- `create2crunch/entrypoint.sh`: multi-GPU launcher + log tailing.
- `create2crunch/Dockerfile.working`: copies `entrypoint.sh`, uses JSON-form ENTRYPOINT.
- `create2crunch/Dockerfile`: aligned to use the same entrypoint pattern.

### Which Dockerfile to use
- **Build with**: `create2crunch/Dockerfile` (now Ubuntu 20.04 + OpenCL; JSON ENTRYPOINT). The previously separate `Dockerfile.working` is no longer needed.

### Build and push commands
```bash
# Build
docker build -f create2crunch/Dockerfile -t liqliq/vanity-miner:latest ./create2crunch

# Login (when prompted, paste your Docker Hub Personal Access Token)
docker login -u liqliq
# paste token when prompted

# Push
docker push liqliq/vanity-miner:latest
```

### How the container starts now
- The image’s ENTRYPOINT runs the multi-GPU launcher automatically. No custom start command is required.
- If you need to run it manually inside the container:
```bash
bash /home/entrypoint.sh
```

### Vast.ai setup
- **Image**: `docker.io/liqliq/vanity-miner:latest`
- **GPU**: enable GPU for the instance.
- **Start command**: leave empty (ENTRYPOINT handles startup).
- **Environment variables** (choose one of the two options below):
  - Using a single URL:
    - `REDIS_URL` (e.g., `rediss://user:pass@host:port` or `redis://host:port`).
  - Using discrete vars:
    - `REDIS_HOST`: your Redis hostname
    - `REDIS_PORT`: your Redis port
    - `REDIS_USERNAME`: set if your Redis requires it (e.g., `default`)
    - `REDIS_PASS`: your Redis password
    - `REDIS_TLS`: `true` if Redis requires TLS (e.g., Redis Cloud)
- Optional:
  - `MINER_PATH` (defaults to `/home/target/release/fourfourfourfour`)
  - No need to set `DEVICE_ID`; one worker per detected GPU is launched automatically.

#### Vast.ai NVIDIA CDI error ("unresolvable CDI devices nvidia.com/gpu=1: unknown")
- This is a host/runtime issue, not an image issue. If you see this error when Vast.ai starts your container, ask the provider to:
  - Ensure NVIDIA Container Toolkit is installed and CDI enabled, then generate CDI spec on the host:
    - `sudo nvidia-ctk cdi generate --output=/etc/cdi/nvidia.yaml`
    - `nvidia-ctk cdi list` should show `nvidia.com/gpu=all` and indices.
  - Or disable CDI in their Docker runtime until fixed (depends on their host setup), or run with classic `--gpus` flags.
- As a user on Vast.ai UI:
  - Prefer leaving start command empty (we already use JSON ENTRYPOINT).
  - Avoid forcing `NVIDIA_VISIBLE_DEVICES=1`/`NV_GPU=1` unless needed; select GPU in Vast.ai UI instead.
  - If CDI errors persist, switch to a different provider instance where NVIDIA runtime is properly configured.

### Local run example (for quick verification)
```bash
docker run --rm --gpus all \
  -e REDIS_HOST=YOUR_HOST \
  -e REDIS_PORT=YOUR_PORT \
  -e REDIS_USERNAME=default \
  -e REDIS_PASS=YOUR_PASSWORD \
  -e REDIS_TLS=true \
  liqliq/vanity-miner:latest
```

### Troubleshooting checklist
- **Redis auth/TLS**: If using Redis Cloud, set `REDIS_TLS=true` and include username/password (`REDIS_USERNAME`, `REDIS_PASS`), or use a `REDIS_URL` with credentials.
- **GPU detection**: Ensure the instance exposes GPUs; inside the container prefer `clinfo -l` to list OpenCL devices. On NVIDIA, `nvidia-smi` may also list devices but OpenCL availability is validated by `clinfo`.
- **Miner binary path**: Default `MINER_PATH=/home/target/release/fourfourfourfour` is built during image build. Override only if you customized.
- **Logs**: The entrypoint tails `/tmp/miner_*.log` for each worker.

### Quick Deployment Summary

#### Vast.ai
- Image: `docker.io/liqliq/vanity-miner:latest`
- Start command: leave empty (ENTRYPOINT starts `/home/entrypoint.sh`)
- GPU: enable GPUs for the instance
- Environment variables (choose one style):
  - Single URL:
    - `REDIS_URL` (e.g., `rediss://user:pass@host:port` or `redis://host:port`)
  - Discrete vars:
    - `REDIS_HOST`, `REDIS_PORT`, `REDIS_USERNAME` (if required), `REDIS_PASS`, `REDIS_TLS=true` (if TLS)
  - Optional: `MINER_PATH` (default `/home/target/release/fourfourfourfour`)

#### Build & Push
```bash
docker build -f create2crunch/Dockerfile -t liqliq/vanity-miner:latest ./create2crunch
docker login -u liqliq
docker push liqliq/vanity-miner:latest
```

#### On-instance checks (inside container)
```bash
# OpenCL devices
clinfo -l

# Tail miner logs (already tailed to stdout)
tail -F /tmp/miner_*.log

# Redis connectivity
redis-cli -u "$REDIS_URL" ping  # if using REDIS_URL
redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ${REDIS_PASS:+-a "$REDIS_PASS"} ping  # discrete vars
```