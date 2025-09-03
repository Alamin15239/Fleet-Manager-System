#!/usr/bin/env node

const https = require('https');
const http = require('http');

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.primeofferonline.shop';

const apiRoutes = [
  '/api/health',
  '/api/maintenance',
  '/api/trucks',
  '/api/trailers',
  '/api/dashboard/stats'
];

async function testRoute(route) {
  return new Promise((resolve) => {
    const url = `${BASE_URL}${route}`;
    const client = url.startsWith('https') ? https : http;
    
    const req = client.get(url, (res) => {
      resolve({
        route,
        status: res.statusCode,
        success: res.statusCode !== 404
      });
    });
    
    req.on('error', (err) => {
      resolve({
        route,
        status: 'ERROR',
        success: false,
        error: err.message
      });
    });
    
    req.setTimeout(5000, () => {
      req.destroy();
      resolve({
        route,
        status: 'TIMEOUT',
        success: false
      });
    });
  });
}

async function verifyDeployment() {
  console.log(`🔍 Verifying deployment at: ${BASE_URL}`);
  console.log('=' .repeat(50));
  
  const results = [];
  
  for (const route of apiRoutes) {
    const result = await testRoute(route);
    results.push(result);
    
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${route} - ${result.status}`);
    
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  }
  
  console.log('=' .repeat(50));
  
  const successCount = results.filter(r => r.success).length;
  const totalCount = results.length;
  
  if (successCount === totalCount) {
    console.log('🎉 All API routes are working correctly!');
    process.exit(0);
  } else {
    console.log(`⚠️  ${totalCount - successCount} out of ${totalCount} routes are failing`);
    
    if (results.some(r => r.status === 404)) {
      console.log('\n💡 Possible solutions for 404 errors:');
      console.log('1. Ensure your deployment platform supports Next.js API routes');
      console.log('2. Check that output: "export" is not set in next.config.js');
      console.log('3. Verify the build includes API routes (check build output)');
      console.log('4. Ensure serverless functions are enabled on your platform');
    }
    
    process.exit(1);
  }
}

verifyDeployment().catch(console.error);