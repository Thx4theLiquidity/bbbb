const { Queue } = require('bullmq');

(async () => {
  try {
    const q = new Queue('vanitySalt', { 
      connection: { 
        host: 'redis-19685.c82.us-east-1-2.ec2.redns.redis-cloud.com',
        port: 19685,
        password: 'eEQen6j50qkNhDSHLXXRslkyfX5K8cfw'
      } 
    });
    
    await q.add('mine', {
      tokenId: 'test-8-nibbles-' + Date.now(),
      deployerAddress: '0x000000000000000000000000000000000000dEaD',
      initCodeHash: '0x' + '22'.repeat(32),
      minLeadingBs: 8
    }, { timeout: 300_000 });
    
    console.log('✅ Test job enqueued successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error enqueuing job:', error.message);
    process.exit(1);
  }
})();
