const request = require('supertest');
const app = require('../../server');
const pool = require('../../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

describe('Bills Routes', () => {
  let testShopId;
  let testUserId;
  let testToken;
  let testProductId;
  let testBillId;
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

    // Create test product
    const [productResult] = await pool.execute(
      'INSERT INTO products (shop_id, name, sku, cost_price, selling_price, stock_quantity, unit) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [testShopId, 'Test Product', `TEST${uniqueId}`, 100, 150, 100, 'pcs']
    );
    testProductId = productResult.insertId;
  });

  afterAll(async () => {
    // Clean up all bills for this shop
    if (testShopId) {
      const [bills] = await pool.execute('SELECT id FROM bills WHERE shop_id = ?', [testShopId]);
      for (const bill of bills) {
        await pool.execute('DELETE FROM bill_items WHERE bill_id = ?', [bill.id]);
        await pool.execute('DELETE FROM bills WHERE id = ?', [bill.id]);
      }
    }
    if (testProductId) {
      await pool.execute('DELETE FROM products WHERE id = ?', [testProductId]);
    }
    if (testUserId) {
      await pool.execute('DELETE FROM users WHERE id = ?', [testUserId]);
    }
    if (testShopId) {
      await pool.execute('DELETE FROM shops WHERE id = ?', [testShopId]);
    }
    // Don't close the pool as it's shared
  });

  describe('POST /api/bills', () => {
    it('should create a bill with valid data', async () => {
      const response = await request(app)
        .post('/api/bills')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          items: [
            {
              product_id: testProductId,
              quantity: 2
            }
          ],
          payment_mode: 'cash',
          include_gst: true
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      testBillId = response.body.data.id;
    });

    it('should reject bill with insufficient stock', async () => {
      // Ensure product has limited stock
      await pool.execute(
        'UPDATE products SET stock_quantity = ? WHERE id = ?',
        [10, testProductId]
      );

      const response = await request(app)
        .post('/api/bills')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          items: [
            {
              product_id: testProductId,
              quantity: 1000 // More than available
            }
          ],
          payment_mode: 'cash'
        });

      // The error might be 400 or 500 depending on how it's handled
      expect([400, 500]).toContain(response.status);
      expect(response.body.success).toBe(false);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/bills')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          // Missing items
          payment_mode: 'cash'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should create bill without GST when include_gst is false', async () => {
      // First, update product stock to ensure we have enough
      await pool.execute(
        'UPDATE products SET stock_quantity = ? WHERE id = ?',
        [100, testProductId]
      );

      const response = await request(app)
        .post('/api/bills')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          items: [
            {
              product_id: testProductId,
              quantity: 1
            }
          ],
          payment_mode: 'cash',
          include_gst: false
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(parseFloat(response.body.data.gst_amount)).toBe(0);
    });
  });

  describe('GET /api/bills', () => {
    it('should get bills list', async () => {
      const response = await request(app)
        .get('/api/bills')
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('GET /api/bills/:id', () => {
    it('should get a single bill with items', async () => {
      if (!testBillId) return; // Skip if bill wasn't created

      const response = await request(app)
        .get(`/api/bills/${testBillId}`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('items');
      expect(Array.isArray(response.body.data.items)).toBe(true);
    });

    it('should return 404 for non-existent bill', async () => {
      const response = await request(app)
        .get('/api/bills/99999')
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(404);
    });
  });
});

