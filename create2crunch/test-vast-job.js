const { Queue } = require('bullmq');

async function sendTestJob() {
  console.log('📤 Sending test job to Vast.ai miner...');
  
  const redisConfig = {
    host: 'redis-19685.c82.us-east-1-2.ec2.redns.redis-cloud.com',
    port: 19685,
    password: 'eEQen6j50qkNhDSHLXXRslkyfX5K8cfw',
    username: 'default'
  };
  
  const queue = new Queue('vanitySalt', { connection: redisConfig });
  
  await queue.add('mine', {
    tokenId: 'vast-test-' + Date.now(),
    deployerAddress: '0x000000000000000000000000000000000000dEaD',
    initCodeHash: '0x' + '33'.repeat(32),
    minLeadingBs: 8
  });
  
  console.log('✅ Test job sent to Vast.ai!');
  console.log('🔍 Check your Vast.ai instance logs to see if it picks up the job');
  
  await queue.close();
  process.exit(0);
}

sendTestJob().catch(console.error);
