/**
 * Script to create 50 random sales for Shop3
 * 
 * Usage: node database/create_random_sales_shop3.js
 * 
 * Make sure to set your database credentials in backend/.env first
 */

const mysql = require('mysql2/promise');
const path = require('path');
const dotenv = require('dotenv');

// Random customer names
const customerNames = [
  'Rajesh Kumar', 'Priya Sharma', 'Amit Patel', 'Sneha Reddy', 'Vikram Singh',
  'Anjali Desai', 'Rahul Mehta', 'Kavita Joshi', 'Suresh Nair', 'Meera Iyer',
  'Arjun Menon', 'Divya Rao', 'Kiran Nair', 'Ravi Pillai', 'Lakshmi Warrier',
  'Ganesh Nambiar', 'Saranya Unni', 'Manoj Kurup', 'Deepa Thampi', 'Santhosh Kumar',
  'Rekha Menon', 'Biju Nair', 'Anitha Pillai', 'Sreekumar Warrier', 'Leela Nambiar',
  'Harish Unni', 'Radha Kurup', 'Suresh Thampi', 'Geetha Kumar', 'Ramesh Menon',
  'Sunitha Nair', 'Prakash Pillai', 'Vijaya Warrier', 'Balakrishnan Nambiar', 'Indira Unni',
  'Madhavan Kurup', 'Kamala Thampi', 'Narayanan Kumar', 'Parvathy Menon', 'Gopal Nair',
  'Usha Pillai', 'Krishnan Warrier', 'Lalitha Nambiar', 'Venkatesh Unni', 'Padma Kurup',
  'Subramanian Thampi', 'Chandrika Kumar', 'Mohan Menon', 'Shanti Nair', 'Raman Pillai'
];

// Payment modes
const paymentModes = ['cash', 'upi', 'card', 'mixed'];

// Generate random date within last 30 days
function getRandomDate() {
  const now = new Date();
  const daysAgo = Math.floor(Math.random() * 30);
  const hoursAgo = Math.floor(Math.random() * 24);
  const minutesAgo = Math.floor(Math.random() * 60);
  
  const date = new Date(now);
  date.setDate(date.getDate() - daysAgo);
  date.setHours(date.getHours() - hoursAgo);
  date.setMinutes(date.getMinutes() - minutesAgo);
  
  return date;
}

// Generate bill number
function generateBillNumber(date, sequence) {
  const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
  return `BILL-${dateStr}-${sequence.toString().padStart(4, '0')}`;
}

async function createRandomSales() {
  let connection;
  
  try {
    // Load environment variables
    const envPath = path.join(__dirname, '..', 'backend', '.env');
    const result = dotenv.config({ path: envPath });
    
    if (result.error) {
      console.warn('⚠️  Could not load backend/.env file:', result.error.message);
    }
    
    if (!process.env.DB_HOST) {
      const rootResult = dotenv.config({ path: path.join(__dirname, '..', '.env') });
      if (rootResult.error) {
        console.warn('⚠️  Could not load root .env file:', rootResult.error.message);
      }
    }
    
    // Connect to database
    const dbConfig = {
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'multi_shop_billing',
      port: parseInt(process.env.DB_PORT) || 3306,
      multipleStatements: true
    };

    // SSL configuration
    if (process.env.DB_HOST && process.env.DB_HOST.includes('tidbcloud.com')) {
      dbConfig.ssl = { rejectUnauthorized: true };
    } else if (process.env.NODE_ENV === 'production') {
      dbConfig.ssl = { rejectUnauthorized: true };
    }

    console.log('Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    console.log('Connected successfully\n');

    // Start transaction
    await connection.beginTransaction();

    // Find Shop3
    const [shops] = await connection.execute(
      'SELECT id, shop_name FROM shops WHERE shop_name LIKE ? OR id = 3',
      ['%Shop3%']
    );

    if (shops.length === 0) {
      console.error('❌ Shop3 not found. Please create Shop3 first.');
      process.exit(1);
    }

    const shopId = shops[0].id;
    const shopName = shops[0].shop_name;
    console.log(`✅ Found shop: ${shopName} (ID: ${shopId})\n`);

    // Get a user from Shop3 (admin or cashier)
    const [users] = await connection.execute(
      'SELECT id, username, role FROM users WHERE shop_id = ? AND is_active = TRUE LIMIT 1',
      [shopId]
    );

    if (users.length === 0) {
      console.error('❌ No active users found for Shop3. Please create a user first.');
      process.exit(1);
    }

    const userId = users[0].id;
    const userName = users[0].username;
    console.log(`✅ Using user: ${userName} (ID: ${userId}, Role: ${users[0].role})\n`);

    // Get all active products from Shop3
    const [products] = await connection.execute(
      'SELECT id, name, sku, unit, selling_price, gst_rate, stock_quantity FROM products WHERE shop_id = ? AND is_active = TRUE',
      [shopId]
    );

    if (products.length === 0) {
      console.error('❌ No products found for Shop3. Please add products first.');
      process.exit(1);
    }

    console.log(`✅ Found ${products.length} products\n`);
    console.log('📦 Creating 50 random sales...\n');

    let billsCreated = 0;
    let totalRevenue = 0;

    // Create 50 random bills
    for (let i = 1; i <= 50; i++) {
      try {
        const billDate = getRandomDate();
        const billNumber = generateBillNumber(billDate, i);
        
        // Random customer (sometimes no customer)
        const hasCustomer = Math.random() > 0.2; // 80% chance of having customer
        const customerName = hasCustomer ? customerNames[Math.floor(Math.random() * customerNames.length)] : null;
        const customerPhone = hasCustomer && Math.random() > 0.3 ? `9${Math.floor(Math.random() * 9000000000) + 1000000000}` : null;
        
        // Random number of items (1-5 items per bill)
        const numItems = Math.floor(Math.random() * 5) + 1;
        const selectedProducts = [];
        const usedProductIds = new Set();
        
        // Select random products
        for (let j = 0; j < numItems && j < products.length; j++) {
          let product;
          let attempts = 0;
          do {
            product = products[Math.floor(Math.random() * products.length)];
            attempts++;
          } while (usedProductIds.has(product.id) && attempts < 50);
          
          if (!usedProductIds.has(product.id)) {
            usedProductIds.add(product.id);
            selectedProducts.push(product);
          }
        }

        if (selectedProducts.length === 0) {
          console.log(`⏭️  Skipped bill ${i}: No products available`);
          continue;
        }

        // Calculate bill totals
        let subtotal = 0;
        let totalGst = 0;
        const billItems = [];

        for (const product of selectedProducts) {
          // Random quantity (1-10, but consider available stock)
          const maxQty = Math.min(10, Math.max(1, Math.floor(product.stock_quantity || 0)));
          const quantity = maxQty > 0 
            ? Math.max(0.001, Math.min(maxQty, Math.random() * maxQty + 1))
            : Math.max(0.001, Math.random() * 5 + 1); // If no stock, allow anyway for demo
          
          const unitPrice = parseFloat(product.selling_price);
          const gstRate = parseFloat(product.gst_rate || 0);
          
          const itemSubtotal = quantity * unitPrice;
          const itemGst = (itemSubtotal * gstRate) / 100;
          const itemTotal = itemSubtotal + itemGst;
          
          subtotal += itemSubtotal;
          totalGst += itemGst;
          
          billItems.push({
            product_id: product.id,
            product_name: product.name,
            sku: product.sku,
            quantity: quantity,
            unit: product.unit,
            unit_price: unitPrice,
            gst_rate: gstRate,
            gst_amount: itemGst,
            discount_amount: 0,
            total_amount: itemTotal
          });
        }

        // Random discount (0-10% chance, max 5% discount)
        const hasDiscount = Math.random() > 0.9;
        const discountPercent = hasDiscount ? Math.random() * 5 : 0;
        const discountAmount = subtotal * (discountPercent / 100);
        const finalSubtotal = subtotal - discountAmount;
        const finalTotal = finalSubtotal + totalGst;

        // Random payment mode
        const paymentMode = paymentModes[Math.floor(Math.random() * paymentModes.length)];

        // Insert bill
        const [billResult] = await connection.execute(
          `INSERT INTO bills (
            shop_id, bill_number, user_id, customer_name, customer_phone,
            subtotal, discount_amount, discount_percent, gst_amount, total_amount,
            payment_mode, status, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?)`,
          [
            shopId, billNumber, userId, customerName, customerPhone,
            subtotal, discountAmount, discountPercent, totalGst, finalTotal,
            paymentMode, billDate
          ]
        );

        const billId = billResult.insertId;

        // Insert bill items and update stock
        for (const item of billItems) {
          // Insert bill item
          await connection.execute(
            `INSERT INTO bill_items (
              bill_id, product_id, product_name, sku, quantity, unit,
              unit_price, gst_rate, gst_amount, discount_amount, total_amount
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              billId, item.product_id, item.product_name, item.sku,
              item.quantity, item.unit, item.unit_price, item.gst_rate,
              item.gst_amount, item.discount_amount, item.total_amount
            ]
          );

          // Update product stock
          const [currentStock] = await connection.execute(
            'SELECT stock_quantity FROM products WHERE id = ?',
            [item.product_id]
          );

          const oldStock = parseFloat(currentStock[0].stock_quantity || 0);
          const newStock = Math.max(0, oldStock - item.quantity);

          await connection.execute(
            'UPDATE products SET stock_quantity = ? WHERE id = ?',
            [newStock, item.product_id]
          );

          // Add to stock ledger
          await connection.execute(
            `INSERT INTO stock_ledger (
              shop_id, product_id, transaction_type, reference_id, reference_type,
              quantity_change, quantity_before, quantity_after, notes, created_by, created_at
            ) VALUES (?, ?, 'sale', ?, 'bill', ?, ?, ?, ?, ?, ?)`,
            [
              shopId, item.product_id, billId,
              -item.quantity, oldStock, newStock,
              `Sale: ${billNumber}`, userId, billDate
            ]
          );
        }

        billsCreated++;
        totalRevenue += finalTotal;

        if (i % 10 === 0) {
          console.log(`✅ Created ${i} bills...`);
        }
      } catch (error) {
        console.error(`❌ Error creating bill ${i}:`, error.message);
      }
    }

    // Commit transaction
    await connection.commit();
    console.log('\n' + '='.repeat(60));
    console.log('📊 Summary:');
    console.log(`   ✅ Bills created: ${billsCreated}`);
    console.log(`   💰 Total revenue: ₹${totalRevenue.toFixed(2)}`);
    console.log(`   📈 Average bill value: ₹${(totalRevenue / billsCreated).toFixed(2)}`);
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('Database connection closed.');
    }
  }
}

createRandomSales();

