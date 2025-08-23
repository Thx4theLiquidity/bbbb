const { Queue } = require('bullmq');

(async () => {
  try {
    const q = new Queue('vanitySalt', { connection: { host: '127.0.0.1' } });
    
    await q.add('mine', {
      tokenId: 'test123',
      deployerAddress: '0x000000000000000000000000000000000000dEaD',
      initCodeHash: '0x' + '11'.repeat(32),
      minLeadingBs: 8
    }, { timeout: 300_000 });
    
    console.log('✅ Test job enqueued successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error enqueuing job:', error.message);
    process.exit(1);
  }
})();
