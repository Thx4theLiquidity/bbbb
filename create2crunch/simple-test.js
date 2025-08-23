const { Queue, Worker } = require('bullmq');

async function test() {
  console.log('🧪 Starting simple BullMQ test...');
  
  const redisConfig = { host: '127.0.0.1', port: 6379 };
  
  // Create queue and worker
  const queue = new Queue('test', { connection: redisConfig });
  const worker = new Worker('test', async (job) => {
    console.log(`📝 Processing job ${job.id}:`, job.data);
    await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
    return { result: 'success', processed: job.data };
  }, { connection: redisConfig });

  // Add event listeners
  worker.on('completed', (job, result) => {
    console.log(`✅ Job ${job.id} completed:`, result);
  });

  worker.on('failed', (job, err) => {
    console.log(`❌ Job ${job.id} failed:`, err.message);
  });

  // Add a test job
  console.log('📤 Enqueuing test job...');
  await queue.add('testJob', { message: 'Hello World', timestamp: Date.now() });
  
  // Wait for processing
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Cleanup
  await worker.close();
  await queue.close();
  console.log('🏁 Test completed');
  process.exit(0);
}

test().catch(console.error);
