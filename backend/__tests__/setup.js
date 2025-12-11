// Test environment setup
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-jwt';
process.env.JWT_EXPIRES_IN = '24h';
// Use the regular database for tests (tests will clean up after themselves)
// Don't override DB_NAME if it's already set
if (!process.env.DB_NAME) {
  process.env.DB_NAME = 'multi_shop_billing';
}

