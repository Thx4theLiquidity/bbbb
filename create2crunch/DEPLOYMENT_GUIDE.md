# Vanity Mining Worker Deployment Guide

This guide covers deploying the updated vanity mining worker that integrates with the backend Redis queue system.

## Overview

The miner has been updated according to the Vanity Mining Integration Plan to:
- Mine for exactly 8 leading 'b' nibbles (0xBBBBBBBB...)
- Connect to Redis queue for job processing
- Handle timeouts and failures gracefully
- Return results in the expected format

## Prerequisites

### Hardware Requirements
- GPU with OpenCL support (NVIDIA/AMD)
- Sufficient GPU memory (4GB+ recommended)
- Network connectivity to Redis server

### Software Requirements
- Docker with GPU support OR
- Rust toolchain + Node.js 16+ + OpenCL drivers

## Deployment Options

### Option 1: Docker Deployment (Recommended)

1. **Build the container:**
```bash
cd create2crunch
docker build -t vanity-miner .
```

2. **Run with environment variables:**
```bash
docker run -d \
  --name vanity-worker-gpu0 \
  --gpus all \
  -e REDIS_HOST=your-redis-host \
  -e REDIS_PORT=6379 \
  -e REDIS_PASS=your-redis-password \
  -e DEVICE_ID=0 \
  --restart unless-stopped \
  vanity-miner
```

### Option 2: Local Development

1. **Install dependencies:**
```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install Node.js 16+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install OpenCL (Ubuntu/Debian)
sudo apt-get install -y ocl-icd-opencl-dev clinfo
```

2. **Build and run:**
```bash
cd create2crunch
chmod +x start-worker.sh
./start-worker.sh
```

### Option 3: vast.ai GPU Cloud

1. **Create a vast.ai template with this Docker command:**
```bash
docker run --gpus all \
  -e REDIS_HOST=${REDIS_HOST} \
  -e REDIS_PASS=${REDIS_PASS} \
  -e DEVICE_ID=0 \
  your-registry/vanity-miner:latest
```

2. **Set environment variables in vast.ai dashboard**

## Environment Configuration

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `REDIS_HOST` | Redis server hostname | `redis.example.com` |
| `REDIS_PASS` | Redis password | `your-secure-password` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `REDIS_PORT` | Redis server port | `6379` |
| `DEVICE_ID` | GPU device ID | `0` |
| `MINER_PATH` | Path to miner binary | `/home/target/release/fourfourfourfour` |

## Verification

### 1. Check Redis Connection
```bash
redis-cli -h $REDIS_HOST -p $REDIS_PORT -a $REDIS_PASS ping
# Should return: PONG
```

### 2. Check GPU Availability
```bash
clinfo
# Should list available OpenCL devices
```

### 3. Monitor Worker Logs
```bash
docker logs -f vanity-worker-gpu0
```

Expected output:
```
🚀 Starting Vanity Mining Worker...
✅ Redis connection successful
✅ OpenCL devices found
🎯 Starting worker for vanity salt mining...
Worker started and waiting for vanity salt mining jobs...
```

## Production Deployment

### Multi-GPU Setup

Deploy one worker per GPU:
```bash
# GPU 0
docker run -d --name vanity-worker-gpu0 --gpus '"device=0"' \
  -e DEVICE_ID=0 -e REDIS_HOST=... vanity-miner

# GPU 1
docker run -d --name vanity-worker-gpu1 --gpus '"device=1"' \
  -e DEVICE_ID=1 -e REDIS_HOST=... vanity-miner
```

### Monitoring and Alerts

1. **Health Checks:**
```bash
# Check if worker is running
docker ps | grep vanity-worker

# Check Redis queue length
redis-cli -h $REDIS_HOST -a $REDIS_PASS llen bull:vanitySalt:waiting
```

2. **Log Aggregation:**
- Forward Docker logs to your logging system
- Monitor for error patterns
- Track mining success rates

3. **Metrics to Track:**
- Jobs processed per hour
- Mining success rate (should be ~95%)
- Average mining time
- GPU utilization

### Scaling

- **Horizontal:** Add more GPU workers
- **Vertical:** Use higher-end GPUs
- **Geographic:** Deploy workers in multiple regions

## Troubleshooting

### Common Issues

1. **"No OpenCL devices found"**
   - Install GPU drivers
   - Install OpenCL runtime
   - Check `clinfo` output

2. **"Redis connection failed"**
   - Verify Redis host/port/password
   - Check network connectivity
   - Verify Redis server is running

3. **"Miner binary not found"**
   - Ensure Rust compilation completed
   - Check MINER_PATH environment variable
   - Verify file permissions

4. **Jobs timing out**
   - Check GPU performance
   - Monitor GPU memory usage
   - Verify mining difficulty (8 leading b's)

### Performance Tuning

1. **Adjust work size** in `src/lib.rs`:
```rust
const WORK_SIZE: u32 = 0x4000000; // Increase for more powerful GPUs
```

2. **GPU memory optimization:**
   - Monitor VRAM usage
   - Adjust work size accordingly
   - Use multiple smaller workers if needed

3. **Queue optimization:**
   - Monitor queue depth
   - Scale workers based on demand
   - Implement priority queuing if needed

## Security Considerations

1. **Redis Security:**
   - Use strong passwords
   - Enable TLS if possible
   - Restrict network access

2. **Worker Security:**
   - Run in isolated containers
   - Limit resource usage
   - Monitor for unusual activity

3. **Result Validation:**
   - All results are cryptographically verified
   - Invalid results are rejected automatically
   - Monitor for mining anomalies

## Support

For issues or questions:
1. Check worker logs for error messages
2. Verify environment configuration
3. Test Redis connectivity
4. Monitor GPU health and performance

The worker is designed to be fault-tolerant and will automatically reconnect to Redis and handle job failures gracefully.