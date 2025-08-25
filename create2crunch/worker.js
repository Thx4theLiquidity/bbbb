const { Queue, Worker } = require('bullmq');
const { spawn } = require('child_process');
const path = require('path');

// Redis connection configuration
// Prefer REDIS_URL if provided; otherwise construct from discrete env vars
const useRedisUrl = process.env.REDIS_URL && process.env.REDIS_URL.trim().length > 0;
const redisTlsEnabledEnv = (process.env.REDIS_TLS || '').toLowerCase();
const redisTlsEnabled = redisTlsEnabledEnv === '1' || redisTlsEnabledEnv === 'true' || redisTlsEnabledEnv === 'yes';

const redisConfig = useRedisUrl
  ? {
      url: process.env.REDIS_URL,
      // Robust defaults for BullMQ/ioredis in containerized environments
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: false,
      retryStrategy: (times) => Math.min(times * 50, 2000),
      reconnectOnError: (err) => {
        const targetErrors = ['READONLY', 'ETIMEDOUT', 'ECONNRESET'];
        return targetErrors.some((code) => err.message && err.message.includes(code));
      },
    }
  : {
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT || 6379),
      password: process.env.REDIS_PASS || undefined,
      username: process.env.REDIS_USERNAME || undefined,
      tls: redisTlsEnabled ? {} : undefined,
      // Robust defaults for BullMQ/ioredis in containerized environments
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: false,
      retryStrategy: (times) => Math.min(times * 50, 2000),
      reconnectOnError: (err) => {
        const targetErrors = ['READONLY', 'ETIMEDOUT', 'ECONNRESET'];
        return targetErrors.some((code) => err.message && err.message.includes(code));
      },
    };

// Worker configuration
const DEVICE_ID = process.env.DEVICE_ID || '0';
const MINER_PATH = process.env.MINER_PATH || '/home/target/release/fourfourfourfour';
const MINING_TIMEOUT = 295000; // 4 minutes 55 seconds (5 seconds buffer before queue timeout)

console.log(`Starting vanity salt worker for device ${DEVICE_ID}`);
if (redisConfig.url) {
  console.log(`Redis config (url): ${redisConfig.url.replace(/:[^:@/]*@/, ':***@')}`);
} else {
  console.log(
    `Redis config: ${redisConfig.host}:${redisConfig.port}` +
      (redisConfig.username ? ` user=${redisConfig.username}` : '') +
      (redisConfig.password ? ' pass=***' : '') +
      (redisConfig.tls ? ' tls' : '')
  );
}
console.log(`Miner path: ${MINER_PATH}`);

// Create worker to process vanity salt mining jobs
const worker = new Worker(
  'vanitySalt',
  async (job) => {
    const { deployerAddress, initCodeHash, tokenId } = job.data;

    console.log(`Starting mining job ${job.id} for token ${tokenId}`);
    console.log(`Deployer: ${deployerAddress}`);
    console.log(`Init code hash: ${initCodeHash}`);

    return new Promise((resolve, reject) => {
      // Spawn the GPU miner process
      const proc = spawn(MINER_PATH, [
        deployerAddress,
        '0x0000000000000000000000000000000000000000', // calling address (null address)
        initCodeHash,
        DEVICE_ID,
        '' // empty endpoint URL since we handle results here
      ]);

      let found = null;
      let minerOutput = '';

      // Set up timeout
      const timeout = setTimeout(() => {
        console.log(`Mining job ${job.id} timed out after ${MINING_TIMEOUT}ms`);
        try { proc.kill('SIGINT'); } catch (e) {}
        reject(new Error('Mining timeout'));
      }, MINING_TIMEOUT);

      // Capture stdout for result parsing
      proc.stdout.on('data', (data) => {
        const output = data.toString();
        minerOutput += output;

        // Look for the expected output format: "SALT: 0x... ADDRESS: 0x..."
        const match = output.match(/SALT: (0x[0-9a-fA-F]{64}) ADDRESS: (0x[0-9a-fA-F]{40})/);
        if (match) {
          found = {
            salt: match[1],
            vanityAddress: match[2],
          };
          console.log(`Found vanity address for job ${job.id}: ${found.vanityAddress}`);
          try { proc.kill('SIGINT'); } catch (e) {}
        }
      });

      // Capture stderr for debugging
      proc.stderr.on('data', (data) => {
        console.error(`Miner stderr: ${data}`);
      });

      // Handle process exit
      proc.on('exit', (code, signal) => {
        clearTimeout(timeout);

        console.log(`Miner process exited with code ${code}, signal ${signal}`);

        if (found) {
          console.log(`Job ${job.id} completed successfully`);
          resolve(found);
        } else {
          console.log(`Job ${job.id} failed - no valid result found`);
          reject(new Error('No valid vanity address found'));
        }
      });

      // Handle process errors
      proc.on('error', (err) => {
        clearTimeout(timeout);
        console.error(`Miner process error: ${err}`);
        reject(err);
      });
    });
  },
  {
    connection: redisConfig,
    concurrency: 1, // Process one job at a time per worker
    removeOnComplete: 10, // Keep last 10 completed jobs
    removeOnFail: 50, // Keep last 50 failed jobs
  }
);

// Handle worker events
worker.on('completed', (job, result) => {
  console.log(`Worker completed job ${job.id} with result:`, result);
});

worker.on('failed', (job, err) => {
  console.error(`Worker failed job ${job.id}:`, err && err.message ? err.message : err);
});

worker.on('error', (err) => {
  console.error('Worker error:', err);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down worker...');
  try { await worker.close(); } catch (e) {}
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down worker...');
  try { await worker.close(); } catch (e) {}
  process.exit(0);
});

console.log(`Worker started and waiting for vanity salt mining jobs...`);