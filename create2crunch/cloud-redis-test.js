const { Queue, Worker } = require('bullmq');

async function testCloudRedis() {
  console.log('☁️  Testing Vanity Salt Queue with Redis Cloud...');
  
  const redisConfig = {
    host: 'redis-19685.c82.us-east-1-2.ec2.redns.redis-cloud.com',
    port: 19685,
    password: 'eEQen6j50qkNhDSHLXXRslkyfX5K8cfw',
    username: 'default'
  };
  
  console.log('🔗 Connecting to Redis Cloud...');
  
  // Create queue and worker
  const queue = new Queue('vanitySalt', { connection: redisConfig });
  const worker = new Worker('vanitySalt', async (job) => {
    const { deployerAddress, initCodeHash, tokenId } = job.data;
    
    console.log(`🔄 Processing mining job ${job.id} for token ${tokenId}`);
    console.log(`   Deployer: ${deployerAddress}`);
    console.log(`   Init code hash: ${initCodeHash}`);
    
    // Simulate mining
    console.log(`⛏️  Mining for 3 seconds...`);
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Generate result
    const salt = '0xbbbbbbbb' + '11111111'.repeat(7);
    const vanityAddress = '0xBBBBBBBB' + '1234567890123456789012345678';
    
    console.log(`✅ Mining completed!`);
    console.log(`   Salt: ${salt}`);
    console.log(`   Vanity Address: ${vanityAddress}`);
    
    return { salt, vanityAddress };
  }, { 
    connection: redisConfig,
    concurrency: 1
  });

  // Event listeners
  worker.on('completed', (job, result) => {
    console.log(`🎉 Job ${job.id} completed successfully!`);
  });

  worker.on('failed', (job, err) => {
    console.log(`❌ Job ${job.id} failed:`, err.message);
  });

  // Add test job
  console.log('📤 Enqueuing test job to Redis Cloud...');
  await queue.add('mine', {
    tokenId: 'cloud-test-123',
    deployerAddress: '0x000000000000000000000000000000000000dEaD',
    initCodeHash: '0x' + '22'.repeat(32),
    minLeadingBs: 8
  });
  
  // Wait for processing
  console.log('⏳ Waiting for cloud processing...');
  await new Promise(resolve => setTimeout(resolve, 6000));
  
  // Cleanup
  await worker.close();
  await queue.close();
  console.log('🏁 Cloud Redis test completed!');
  process.exit(0);
}

testCloudRedis().catch(console.error);
