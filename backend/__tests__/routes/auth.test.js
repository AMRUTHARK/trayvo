const request = require('supertest');
const app = require('../../server');
const pool = require('../../config/database');
const bcrypt = require('bcryptjs');

describe('Authentication Routes', () => {
  let testShopId;
  let testUserId;
  let testToken;
  let testRegistrationToken;
  const uniqueId = Date.now();

  beforeAll(async () => {
    // Create a test shop with unique email
    // Use a shorter GSTIN to avoid column length issues
    const shortGstin = `GST${uniqueId.toString().slice(-10)}`; // Last 10 digits
    const [shopResult] = await pool.execute(
      'INSERT INTO shops (shop_name, owner_name, email, phone, address, gstin) VALUES (?, ?, ?, ?, ?, ?)',
      [`Test Shop ${uniqueId}`, 'Test Owner', `test${uniqueId}@example.com`, '1234567890', 'Test Address', shortGstin]
    );
    testShopId = shopResult.insertId;

    // Create a test user with unique username
    const passwordHash = await bcrypt.hash('testpass123', 10);
    const [userResult] = await pool.execute(
      'INSERT INTO users (shop_id, username, email, password_hash, role, full_name, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [testShopId, `testuser${uniqueId}`, `testuser${uniqueId}@example.com`, passwordHash, 'admin', 'Test User', true]
    );
    testUserId = userResult.insertId;
  });

  afterAll(async () => {
    // Clean up test data
    if (testRegistrationToken) {
      await pool.execute('DELETE FROM registration_tokens WHERE token = ?', [testRegistrationToken]);
    }
    if (testUserId) {
      await pool.execute('DELETE FROM users WHERE id = ?', [testUserId]);
    }
    if (testShopId) {
      await pool.execute('DELETE FROM shops WHERE id = ?', [testShopId]);
    }
    // Don't close the pool as it's shared
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: `testuser${uniqueId}`,
          password: 'testpass123'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data).toHaveProperty('user');
      testToken = response.body.data.token;
    });

    it('should reject invalid username', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: `nonexistent${uniqueId}`,
          password: 'testpass123'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should reject invalid password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: `testuser${uniqueId}`,
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should require username and password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/register', () => {
    beforeAll(async () => {
      // Ensure testShopId is set
      if (!testShopId) {
        throw new Error('testShopId is not set');
      }
      // Create a registration token for testing
      const tokenValue = `test-token-${uniqueId}`;
      await pool.execute(
        'INSERT INTO registration_tokens (shop_id, token, email, expires_at) VALUES (?, ?, ?, ?)',
        [testShopId, tokenValue, `invite${uniqueId}@example.com`, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)] // 7 days from now
      );
      testRegistrationToken = tokenValue;
    });

    it('should register a new user with valid token', async () => {
      const newUsername = `newuser${uniqueId}`;
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          registration_token: testRegistrationToken,
          full_name: 'New User',
          email: `newuser${uniqueId}@example.com`,
          username: newUsername,
          password: 'newpass123',
          role: 'cashier'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);

      // Clean up
      await pool.execute('DELETE FROM users WHERE username = ?', [newUsername]);
    });

    it('should reject registration with invalid token', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          registration_token: 'invalid-token',
          full_name: 'New User',
          email: 'newuser2@example.com',
          username: 'newuser2',
          password: 'newpass123',
          role: 'cashier'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should reject duplicate username', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          registration_token: testRegistrationToken,
          full_name: 'New User',
          email: `newuser3${uniqueId}@example.com`,
          username: `testuser${uniqueId}`, // Already exists
          password: 'newpass123',
          role: 'cashier'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          registration_token: testRegistrationToken,
          // Missing required fields
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });
});

