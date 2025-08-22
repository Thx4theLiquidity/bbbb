# create2crunch - Vanity Address Miner

> A Rust GPU program for finding salts that create vanity Ethereum addresses with 8+ leading 'b' nibbles via CREATE2, integrated with Redis queue system.

This is a modified version of create2crunch specifically designed for vanity address mining with exactly 8 leading 'b' nibbles (0xBBBBBBBB...). It integrates with a Redis-based job queue system for distributed GPU mining.

## Features

- **Vanity Address Mining**: Finds CREATE2 salts that produce addresses with 8+ leading 'b' nibbles
- **Redis Integration**: Connects to Redis queue for distributed job processing
- **GPU Acceleration**: Uses OpenCL for high-performance mining
- **Automatic Job Management**: Handles job lifecycle, timeouts, and result submission
- **Docker Support**: Ready-to-deploy container with all dependencies

## Usage

### Standalone Mode (Direct CLI)

```sh
$ cargo run --release <factory_address> <caller_address> <init_code_hash> [device_id] [endpoint_url]
```

Example:
```sh
$ cargo run --release 0x1234... 0x0000000000000000000000000000000000000000 0xabcd... 0
```

### Queue Worker Mode (Redis Integration)

The primary mode for production use. The worker connects to Redis and processes vanity mining jobs:

```sh
# Install Node.js dependencies
$ npm install

# Set environment variables
$ export REDIS_HOST=localhost
$ export REDIS_PORT=6379
$ export REDIS_PASS=your_password
$ export DEVICE_ID=0
$ export MINER_PATH=/path/to/target/release/fourfourfourfour

# Start the worker
$ npm start
```

### Docker Deployment

```sh
# Build the container
$ docker build -t vanity-miner .

# Run with environment variables
$ docker run -e REDIS_HOST=your_redis_host \
             -e REDIS_PASS=your_redis_password \
             -e DEVICE_ID=0 \
             --gpus all \
             vanity-miner
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `REDIS_HOST` | Redis server hostname | `localhost` |
| `REDIS_PORT` | Redis server port | `6379` |
| `REDIS_PASS` | Redis password | `` |
| `DEVICE_ID` | GPU device ID to use | `0` |
| `MINER_PATH` | Path to compiled miner binary | `/home/target/release/fourfourfourfour` |

## Mining Requirements

- **Target**: Exactly 8 leading 'b' nibbles (0xBBBBBBBB...)
- **Timeout**: 5 minutes maximum per job
- **Success Rate**: ~95% on modern GPUs
- **Fallback**: Jobs that timeout or fail don't block token deployment

## Integration with Backend

This miner is designed to work with the vanity mining backend system:

1. Backend enqueues jobs in Redis `vanitySalt` queue
2. Worker processes pick up jobs and spawn GPU mining
3. Results are returned to Redis with salt and vanity address
4. Backend uses results for CREATE2 token deployment

## Output Format

When a valid vanity address is found, the miner outputs:
```
SALT: 0x<64_char_hex_salt> ADDRESS: 0x<40_char_hex_address>
```

This format is parsed by the Node.js wrapper for job completion.

## GPU Requirements

- OpenCL-compatible GPU (NVIDIA/AMD)
- Sufficient VRAM for work size (configurable in `src/lib.rs`)
- NVIDIA drivers and OpenCL runtime installed

## Building from Source

```sh
$ git clone <repository>
$ cd create2crunch
$ cargo build --release
$ npm install
```

## Monitoring

The worker provides detailed logging:
- Job start/completion status
- Mining performance metrics
- Error handling and timeout information
- Redis connection status

For production monitoring, integrate with your logging infrastructure to track:
- Mining success rates
- Average mining times
- Worker health and uptime
- Queue depth and processing rates
