const { Queue, Worker } = require('bullmq');

// Redis connection configuration
const redisConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASS || '',
};

console.log(`Starting MOCK vanity salt worker`);
console.log(`Redis config: ${redisConfig.host}:${redisConfig.port}`);

// Create worker to process vanity salt mining jobs
const worker = new Worker('vanitySalt', async (job) => {
    const { deployerAddress, initCodeHash, tokenId } = job.data;
    
    console.log(`🔄 Processing mock mining job ${job.id} for token ${tokenId}`);
    console.log(`   Deployer: ${deployerAddress}`);
    console.log(`   Init code hash: ${initCodeHash}`);
    
    // Simulate mining delay
    console.log(`⏳ Mock mining for 3 seconds...`);
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Generate mock result (fake salt that would produce a vanity address)
    const mockSalt = '0x' + 'bb'.repeat(16) + '11'.repeat(16); // Mock salt
    const mockVanityAddress = '0xBBBBBBBB' + '1234567890123456789012345678';
    
    console.log(`✅ Mock mining completed!`);
    console.log(`   Salt: ${mockSalt}`);
    console.log(`   Vanity Address: ${mockVanityAddress}`);
    
    return {
        salt: mockSalt,
        vanityAddress: mockVanityAddress
    };
}, { connection: redisConfig });

// Handle worker events
worker.on('completed', (job, result) => {
    console.log(`🎉 Job ${job.id} completed successfully`);
    console.log(`   Result:`, result);
});

worker.on('failed', (job, err) => {
    console.log(`❌ Job ${job.id} failed:`, err.message);
});

worker.on('error', (err) => {
    console.error('❌ Worker error:', err);
});

console.log('🚀 Mock worker started and waiting for jobs...');

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down worker...');
    await worker.close();
    process.exit(0);
});
