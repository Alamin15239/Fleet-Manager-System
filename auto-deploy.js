const { exec } = require('child_process');
const { watch } = require('fs');
const path = require('path');

let deployTimeout;
const DEPLOY_DELAY = 3000; // 3 seconds delay to batch changes

function deploy() {
  console.log('🚀 Deploying to production...');
  exec('vercel --prod --yes', (error, stdout, stderr) => {
    if (error) {
      console.error('❌ Deploy failed:', error);
      return;
    }
    console.log('✅ Deploy successful!');
    console.log(stdout);
  });
}

function scheduleDeployment() {
  clearTimeout(deployTimeout);
  deployTimeout = setTimeout(deploy, DEPLOY_DELAY);
  console.log('⏱️  Deployment scheduled...');
}

// Watch for changes
const watchPaths = [
  'src/app/api',
  'src/lib',
  'prisma/schema.prisma'
];

watchPaths.forEach(watchPath => {
  watch(watchPath, { recursive: true }, (eventType, filename) => {
    if (filename && (filename.endsWith('.ts') || filename.endsWith('.js') || filename.endsWith('.prisma'))) {
      console.log(`📁 File changed: ${filename}`);
      scheduleDeployment();
    }
  });
});

console.log('👀 Watching for changes...');
console.log('📂 Watched paths:', watchPaths);
console.log('🔄 Auto-deploy enabled - changes will be deployed automatically');