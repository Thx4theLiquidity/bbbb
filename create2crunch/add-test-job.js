const { Queue } = require('bullmq');

// Why does this matter?
// - We need to use real token details so the mining job is meaningful and can be picked up by the real GPU miner for actual contract deployment, not just a dummy/test run.

const redisConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASS || '',
};

console.log(`Connecting to Redis: ${redisConfig.host}:${redisConfig.port}`);

// Create queue for mining jobs
const queue = new Queue('vanitySalt', {
    connection: redisConfig,
});

async function addRealMiningJob() {
    try {
        // Why does this matter?
        // - These are the real contract and implementation values, so the miner will search for a valid vanity salt for your actual deployment.
        const deployerAddress = '0xb576eaba740f4235919abf2244d2aee3c373131f';
        const initCodeHash = '0xa84e8beae6db8b6bd82434a9be87561f494ac3ac6efc89c9bf96d3118cc61cfb';
        const tokenId = `real-test-${Date.now()}`;

        const job = await queue.add('vanity-mining', {
            deployerAddress,
            initCodeHash,
            tokenId
        });

        // Why does this matter?
        // - Logging the real values helps you verify the job is correct and lets you track the job in the miner logs.
        console.log(`✅ Real mining job added successfully!`);
        console.log(`   Job ID: ${job.id}`);
        console.log(`   Token ID: ${tokenId}`);
        console.log(`   Deployer: ${deployerAddress}`);
        console.log(`   Init Hash: ${initCodeHash}`);
        console.log('');
        console.log('The GPU miner should pick this up and start mining for 8 leading B\'s...');
        console.log('This will find REAL salts for your Bond contract!');

        await queue.close();
        process.exit(0);
    } catch (error) {
        // Why does this matter?
        // - Proper error handling ensures you know if the job failed to enqueue, so you can debug or retry.
        console.error('Error adding real mining job:', error);
        process.exit(1);
    }
}

addRealMiningJob();
