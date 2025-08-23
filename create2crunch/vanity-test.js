const { Queue, Worker } = require('bullmq');

async function testVanitySalt() {
  console.log('🎯 Starting Vanity Salt Queue Test...');
  
  const redisConfig = { host: '127.0.0.1', port: 6379 };
  
  // Create queue and worker
  const queue = new Queue('vanitySalt', { connection: redisConfig });
  const worker = new Worker('vanitySalt', async (job) => {
    const { deployerAddress, initCodeHash, tokenId } = job.data;
    
    console.log(`🔄 Mock mining job ${job.id} for token ${tokenId}`);
    console.log(`   Deployer: ${deployerAddress}`);
    console.log(`   Init code hash: ${initCodeHash}`);
    
    // Simulate mining delay
    console.log(`⏳ Mining for 2 seconds...`);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Generate mock result
    const salt = '0xbbbbbbbb' + '11111111'.repeat(7); // 32-byte salt
    const vanityAddress = '0xBBBBBBBB' + '1234567890123456789012345678';
    
    console.log(`✅ Mining completed!`);
    console.log(`   Salt: ${salt}`);
    console.log(`   Address: ${vanityAddress}`);
    
    return { salt, vanityAddress };
  }, { 
    connection: redisConfig,
    concurrency: 1
  });

  // Event listeners
  worker.on('completed', (job, result) => {
    console.log(`🎉 Job ${job.id} completed successfully!`);
    console.log(`   Result:`, result);
  });

  worker.on('failed', (job, err) => {
    console.log(`❌ Job ${job.id} failed:`, err.message);
  });

  // Add vanity salt job
  console.log('📤 Enqueuing vanity salt job...');
  await queue.add('mine', {
    tokenId: 'test-token-123',
    deployerAddress: '0x000000000000000000000000000000000000dEaD',
    initCodeHash: '0x' + '11'.repeat(32),
    minLeadingBs: 8
  });
  
  // Wait for processing
  console.log('⏳ Waiting for job processing...');
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Check queue status
  const waiting = await queue.getWaiting();
  const completed = await queue.getCompleted();
  const failed = await queue.getFailed();
  
  console.log(`📊 Queue Status:`);
  console.log(`   Waiting: ${waiting.length}`);
  console.log(`   Completed: ${completed.length}`);
  console.log(`   Failed: ${failed.length}`);
  
  // Cleanup
  await worker.close();
  await queue.close();
  console.log('🏁 Vanity salt test completed!');
  process.exit(0);
}

testVanitySalt().catch(console.error);
