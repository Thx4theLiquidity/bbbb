const { Queue, Worker } = require('bullmq');
const { spawn } = require('child_process');
const path = require('path');

// Redis connection configuration
const redisConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASS || '',
};

// Worker configuration
const DEVICE_ID = process.env.DEVICE_ID || '0';
const MINER_PATH = process.env.MINER_PATH || '/home/target/release/fourfourfourfour';
const MINING_TIMEOUT = 295000; // 4 minutes 55 seconds (5 seconds buffer before queue timeout)

console.log(`Starting vanity salt worker for device ${DEVICE_ID}`);
console.log(`Redis config: ${redisConfig.host}:${redisConfig.port}`);
console.log(`Miner path: ${MINER_PATH}`);

// Create worker to process vanity salt mining jobs
const worker = new Worker('vanitySalt', async (job) => {
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
            proc.kill('SIGINT');
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
                    vanityAddress: match[2]
                };
                console.log(`✅ FOUND RESULT for job ${job.id}:`);
                console.log(`   Salt: ${found.salt}`);
                console.log(`   Address: ${found.vanityAddress}`);
                proc.kill('SIGINT'); // Gracefully stop the miner
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
                console.log(`✅ Job ${job.id} completed successfully - returning result to Redis:`);
                console.log(`   Salt: ${found.salt}`);
                console.log(`   Address: ${found.vanityAddress}`);
                resolve(found);
            } else {
                console.log(`❌ Job ${job.id} failed - no valid result found`);
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
}, {
    connection: redisConfig,
    concurrency: 1, // Process one job at a time per worker
    removeOnComplete: { count: 10, age: 24 * 3600 }, // Keep last 10 completed jobs for 24 hours
    removeOnFail: { count: 50, age: 24 * 3600 }, // Keep last 50 failed jobs for 24 hours
    stalledInterval: 30 * 1000, // Check for stalled jobs every 30 seconds
    maxStalledCount: 1, // Maximum number of times a job can be marked as stalled
});

// Handle worker events
worker.on('completed', (job, result) => {
    console.log(`🎉 Worker completed job ${job.id} with result:`);
    console.log(`   Salt: ${result.salt}`);
    console.log(`   Address: ${result.vanityAddress}`);
    console.log(`   ✅ Result sent to Redis queue successfully!`);
});

worker.on('failed', (job, err) => {
    console.error(`Worker failed job ${job.id}:`, err.message);
});

worker.on('error', (err) => {
    console.error('Worker error:', err);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('Shutting down worker...');
    try { 
        await worker.close(); 
    } catch (e) { 
        console.error('Error closing worker:', e); 
    }
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('Shutting down worker...');
    try { 
        await worker.close(); 
    } catch (e) { 
        console.error('Error closing worker:', e); 
    }
    process.exit(0);
});

console.log(`Worker started and waiting for vanity salt mining jobs...`);