/**
 * Generate a secure JWT secret for production use
 * Run: node generate-jwt-secret.js
 */

const crypto = require('crypto');

const jwtSecret = crypto.randomBytes(32).toString('hex');

console.log('\n✅ JWT Secret Generated:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(jwtSecret);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('\n📋 Copy this value and use it as JWT_SECRET in Render environment variables.');
console.log('⚠️  Keep this secret secure - do not share or commit to Git!\n');

