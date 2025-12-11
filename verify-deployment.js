/**
 * Verify deployment endpoints
 * Run: node verify-deployment.js <frontend-url> <backend-url>
 * Example: node verify-deployment.js https://my-app.vercel.app https://my-api.onrender.com
 */

const https = require('https');
const http = require('http');

const frontendUrl = process.argv[2];
const backendUrl = process.argv[3];

if (!frontendUrl || !backendUrl) {
  console.error('\n❌ Usage: node verify-deployment.js <frontend-url> <backend-url>');
  console.error('Example: node verify-deployment.js https://my-app.vercel.app https://my-api.onrender.com\n');
  process.exit(1);
}

console.log('\n🔍 Verifying Deployment...\n');

// Test backend health endpoint
function testBackend() {
  return new Promise((resolve, reject) => {
    const url = new URL(backendUrl);
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: '/health',
      method: 'GET',
      timeout: 10000
    };

    const req = (url.protocol === 'https:' ? https : http).request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const json = JSON.parse(data);
            if (json.status === 'ok') {
              resolve({ success: true, message: 'Backend health check passed' });
            } else {
              resolve({ success: false, message: 'Backend returned unexpected response' });
            }
          } catch (e) {
            resolve({ success: false, message: 'Backend returned invalid JSON' });
          }
        } else {
          resolve({ success: false, message: `Backend returned status ${res.statusCode}` });
        }
      });
    });

    req.on('error', (error) => {
      resolve({ success: false, message: `Backend connection error: ${error.message}` });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ success: false, message: 'Backend request timeout' });
    });

    req.end();
  });
}

// Test frontend accessibility
function testFrontend() {
  return new Promise((resolve, reject) => {
    const url = new URL(frontendUrl);
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: '/',
      method: 'GET',
      timeout: 10000
    };

    const req = (url.protocol === 'https:' ? https : http).request(options, (res) => {
      if (res.statusCode === 200 || res.statusCode === 304) {
        resolve({ success: true, message: 'Frontend is accessible' });
      } else {
        resolve({ success: false, message: `Frontend returned status ${res.statusCode}` });
      }
      res.on('data', () => {}); // Consume response
      res.on('end', () => {});
    });

    req.on('error', (error) => {
      resolve({ success: false, message: `Frontend connection error: ${error.message}` });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ success: false, message: 'Frontend request timeout' });
    });

    req.end();
  });
}

async function runTests() {
  console.log('Testing Backend...');
  const backendResult = await testBackend();
  console.log(backendResult.success ? '✅' : '❌', backendResult.message);
  console.log(`   URL: ${backendUrl}/health\n`);

  console.log('Testing Frontend...');
  const frontendResult = await testFrontend();
  console.log(frontendResult.success ? '✅' : '❌', frontendResult.message);
  console.log(`   URL: ${frontendUrl}\n`);

  if (backendResult.success && frontendResult.success) {
    console.log('🎉 Deployment verification successful!\n');
    console.log('Next steps:');
    console.log('1. Test login at:', frontendUrl + '/login');
    console.log('2. Test backend API at:', backendUrl + '/api/health');
    console.log('3. Create super admin user\n');
  } else {
    console.log('⚠️  Some checks failed. Please review the errors above.\n');
    process.exit(1);
  }
}

runTests();

