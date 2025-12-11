const request = require('supertest');
const app = require('../../server');
const pool = require('../../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

describe('Products Routes', () => {
  let testShopId;
  let testUserId;
  let testToken;
  let testCategoryId;
  let testProductId;
  const uniqueId = Date.now();

  beforeAll(async () => {
    // Create test shop with unique email
    const [shopResult] = await pool.execute(
      'INSERT INTO shops (shop_name, owner_name, email, phone, address) VALUES (?, ?, ?, ?, ?)',
      [`Test Shop ${uniqueId}`, 'Test Owner', `test${uniqueId}@example.com`, '1234567890', 'Test Address']
    );
    testShopId = shopResult.insertId;

    // Create test user with unique username
    const passwordHash = await bcrypt.hash('testpass123', 10);
    const [userResult] = await pool.execute(
      'INSERT INTO users (shop_id, username, email, password_hash, role, full_name, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [testShopId, `testuser${uniqueId}`, `testuser${uniqueId}@example.com`, passwordHash, 'admin', 'Test User', true]
    );
    testUserId = userResult.insertId;

    // Generate token (must match the format used in auth.js)
    testToken = jwt.sign(
      { userId: testUserId, shopId: testShopId, role: 'admin' },
      process.env.JWT_SECRET || 'test-secret-key-for-jwt',
      { expiresIn: '24h' }
    );

    // Create test category
    const [catResult] = await pool.execute(
      'INSERT INTO categories (shop_id, name, description) VALUES (?, ?, ?)',
      [testShopId, `Test Category ${uniqueId}`, 'Test Description']
    );
    testCategoryId = catResult.insertId;
  });

  afterAll(async () => {
    // Clean up
    if (testProductId) {
      await pool.execute('DELETE FROM products WHERE id = ?', [testProductId]);
    }
    if (testCategoryId) {
      await pool.execute('DELETE FROM categories WHERE id = ?', [testCategoryId]);
    }
    if (testUserId) {
      await pool.execute('DELETE FROM users WHERE id = ?', [testUserId]);
    }
    if (testShopId) {
      await pool.execute('DELETE FROM shops WHERE id = ?', [testShopId]);
    }
    // Don't close the pool as it's shared
  });

  describe('POST /api/products', () => {
    it('should create a product with valid data', async () => {
      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          name: 'Test Product',
          sku: `TEST${uniqueId}`,
          cost_price: 100,
          selling_price: 150,
          stock_quantity: 50,
          unit: 'pcs',
          gst_rate: 18
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      testProductId = response.body.data.id;
    });

    it('should reject duplicate SKU', async () => {
      // First ensure a product was created
      if (!testProductId) {
        // Create a product first
        const createResponse = await request(app)
          .post('/api/products')
          .set('Authorization', `Bearer ${testToken}`)
          .send({
            name: 'Test Product First',
            sku: `TEST${uniqueId}`,
            cost_price: 100,
            selling_price: 150
          });
        testProductId = createResponse.body.data?.id;
      }

      // Now try to create another product with the same SKU
      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          name: 'Test Product 2',
          sku: `TEST${uniqueId}`, // Duplicate
          cost_price: 100,
          selling_price: 150
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          // Missing required fields
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/products')
        .send({
          name: 'Test Product',
          sku: `TEST2${uniqueId}`,
          cost_price: 100,
          selling_price: 150
        });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/products', () => {
    it('should get products list', async () => {
      const response = await request(app)
        .get('/api/products')
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should filter products by search term', async () => {
      const response = await request(app)
        .get('/api/products?search=Test')
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/products/:id', () => {
    it('should get a single product', async () => {
      if (!testProductId) return; // Skip if product wasn't created

      const response = await request(app)
        .get(`/api/products/${testProductId}`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testProductId);
    });

    it('should return 404 for non-existent product', async () => {
      const response = await request(app)
        .get('/api/products/99999')
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(404);
    });
  });
});

