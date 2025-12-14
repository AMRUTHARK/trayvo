/**
 * Script to insert products for Shop3 based on DEYAM AA PRODUCTS price list
 * 
 * Usage: node database/insert_shop3_products.js
 * 
 * Make sure to set your database credentials in backend/.env first
 */

const mysql = require('mysql2/promise');
const path = require('path');
const dotenv = require('dotenv');

// Product data from the image
const productsData = [
  // DRYFRUITS Section
  { category: 'DRYFRUITS', name: 'DATES-KAIMA', weight: '200g', mrp: 60, mop: 50 },
  { category: 'DRYFRUITS', name: 'DATES-KAIMA', weight: '250g', mrp: 75, mop: 63 },
  { category: 'DRYFRUITS', name: 'DATES-KAIMA', weight: '500g', mrp: 150, mop: 125 },
  { category: 'DRYFRUITS', name: 'ALMOND', weight: '100g', mrp: 120, mop: 100 },
  { category: 'DRYFRUITS', name: 'ALMOND', weight: '250g', mrp: 300, mop: 250 },
  { category: 'DRYFRUITS', name: 'CASHEW-W210', weight: '100g', mrp: 135, mop: 115 },
  { category: 'DRYFRUITS', name: 'CASHEW-W210', weight: '200g', mrp: 270, mop: 230 },
  { category: 'DRYFRUITS', name: 'CASHEW-W210', weight: '250g', mrp: 338, mop: 288 },
  { category: 'DRYFRUITS', name: 'CASHEW-W320', weight: '100g', mrp: 120, mop: 100 },
  { category: 'DRYFRUITS', name: 'CASHEW-W320', weight: '200g', mrp: 240, mop: 200 },
  { category: 'DRYFRUITS', name: 'CASHEW-W320', weight: '250g', mrp: 300, mop: 250 },
  { category: 'DRYFRUITS', name: 'CASHEW-SPLIT', weight: '100g', mrp: 110, mop: 90 },
  { category: 'DRYFRUITS', name: 'CASHEW-SPLIT', weight: '200g', mrp: 220, mop: 180 },
  { category: 'DRYFRUITS', name: 'CASHEW-SPLIT', weight: '250g', mrp: 275, mop: 225 },
  { category: 'DRYFRUITS', name: 'BLACK RAISINS', weight: '100g', mrp: 75, mop: 60 },
  { category: 'DRYFRUITS', name: 'BLACK RAISINS', weight: '200g', mrp: 150, mop: 120 },
  { category: 'DRYFRUITS', name: 'BLACK RAISINS', weight: '250g', mrp: 188, mop: 150 },
  { category: 'DRYFRUITS', name: 'WALNUT', weight: '50g', mrp: 120, mop: 105 },
  { category: 'DRYFRUITS', name: 'WALNUT', weight: '100g', mrp: 240, mop: 210 },
  { category: 'DRYFRUITS', name: 'WALNUT', weight: '200g', mrp: 480, mop: 420 },
  { category: 'DRYFRUITS', name: 'PISTHA', weight: '100g', mrp: 145, mop: 130 },
  { category: 'DRYFRUITS', name: 'PISTHA', weight: '200g', mrp: 290, mop: 260 },
  { category: 'DRYFRUITS', name: 'PISTHA', weight: '250g', mrp: 363, mop: 325 },
  { category: 'DRYFRUITS', name: 'CHERRY', weight: '50g', mrp: 25, mop: 20 },
  { category: 'DRYFRUITS', name: 'CHERRY', weight: '100g', mrp: 50, mop: 40 },
  { category: 'DRYFRUITS', name: 'CHERRY', weight: '250g', mrp: 125, mop: 100 },
  
  // SPICES Section
  { category: 'SPICES', name: 'BLACK PEPPER-GRADE A', weight: '50g', mrp: 70, mop: 65 },
  { category: 'SPICES', name: 'BLACK PEPPER-GRADE A', weight: '100g', mrp: 140, mop: 130 },
  { category: 'SPICES', name: 'BLACK PEPPER-GRADE A', weight: '200g', mrp: 280, mop: 260 },
  { category: 'SPICES', name: 'BLACK PEPPER-GRADE A', weight: '250g', mrp: 350, mop: 325 },
  { category: 'SPICES', name: 'BLACK PEPPER-GRADE B', weight: '50g', mrp: 60, mop: 53 },
  { category: 'SPICES', name: 'BLACK PEPPER-GRADE B', weight: '100g', mrp: 120, mop: 106 },
  { category: 'SPICES', name: 'BLACK PEPPER-GRADE B', weight: '200g', mrp: 240, mop: 212 },
  { category: 'SPICES', name: 'BLACK PEPPER-GRADE B', weight: '250g', mrp: 300, mop: 265 },
  { category: 'SPICES', name: 'CARDAMOM 7MM', weight: '50g', mrp: 100, mop: 90 },
  { category: 'SPICES', name: 'CARDAMOM 7MM', weight: '100g', mrp: 200, mop: 180 },
  { category: 'SPICES', name: 'CARDAMOM 7MM', weight: '200g', mrp: 400, mop: 360 },
  { category: 'SPICES', name: 'CARDAMOM 7MM', weight: '250g', mrp: 500, mop: 450 },
  { category: 'SPICES', name: 'CARDAMOM 6MM', weight: '50g', mrp: 90, mop: 78 },
  { category: 'SPICES', name: 'CARDAMOM 6MM', weight: '100g', mrp: 180, mop: 156 },
  { category: 'SPICES', name: 'CARDAMOM 6MM', weight: '200g', mrp: 360, mop: 312 },
  { category: 'SPICES', name: 'CARDAMOM 6MM', weight: '250g', mrp: 450, mop: 390 },
  { category: 'SPICES', name: 'CLOVE', weight: '50g', mrp: 80, mop: 69 },
  { category: 'SPICES', name: 'CLOVE', weight: '100g', mrp: 160, mop: 138 },
  { category: 'SPICES', name: 'CLOVE', weight: '200g', mrp: 320, mop: 276 },
  { category: 'SPICES', name: 'CLOVE', weight: '250g', mrp: 400, mop: 345 },
  { category: 'SPICES', name: 'GARAM MASALA', weight: '50g', mrp: 50, mop: 40 },
  { category: 'SPICES', name: 'GARAM MASALA', weight: '70g', mrp: 70, mop: 56 },
  { category: 'SPICES', name: 'GARAM MASALA', weight: '100g', mrp: 100, mop: 80 },
  { category: 'SPICES', name: 'GARAM MASALA', weight: '200g', mrp: 200, mop: 160 },
  { category: 'SPICES', name: 'GARAM MASALA', weight: '250g', mrp: 250, mop: 200 },
];

async function insertProducts() {
  let connection;
  
  try {
    // Load environment variables from backend/.env
    const envPath = path.join(__dirname, '..', 'backend', '.env');
    const result = dotenv.config({ path: envPath });
    
    if (result.error) {
      console.warn('⚠️  Could not load backend/.env file:', result.error.message);
    }
    
    // Also try loading from root if backend/.env doesn't exist
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

    // SSL configuration for TiDB Serverless (required)
    if (process.env.DB_HOST && process.env.DB_HOST.includes('tidbcloud.com')) {
      dbConfig.ssl = {
        rejectUnauthorized: true
      };
    } else if (process.env.NODE_ENV === 'production') {
      dbConfig.ssl = {
        rejectUnauthorized: true
      };
    }

    console.log('Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    console.log('Connected successfully');

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
    console.log(`\n✅ Found shop: ${shopName} (ID: ${shopId})\n`);

    // Create or get categories
    const categories = {};
    for (const categoryName of ['DRYFRUITS', 'SPICES']) {
      // Check if category exists
      const [existing] = await connection.execute(
        'SELECT id FROM categories WHERE shop_id = ? AND name = ?',
        [shopId, categoryName]
      );

      if (existing.length > 0) {
        categories[categoryName] = existing[0].id;
        console.log(`✅ Category "${categoryName}" already exists (ID: ${categories[categoryName]})`);
      } else {
        const [result] = await connection.execute(
          'INSERT INTO categories (shop_id, name, description) VALUES (?, ?, ?)',
          [shopId, categoryName, `${categoryName} category for ${shopName}`]
        );
        categories[categoryName] = result.insertId;
        console.log(`✅ Created category "${categoryName}" (ID: ${categories[categoryName]})`);
      }
    }

    console.log('\n📦 Inserting products...\n');

    let inserted = 0;
    let skipped = 0;
    let errors = 0;

    for (const product of productsData) {
      try {
        const productName = `${product.name} ${product.weight}`;
        const sku = `${product.category}-${product.name.replace(/\s+/g, '-').toUpperCase()}-${product.weight.toUpperCase()}`;
        
        // Check if product already exists
        const [existing] = await connection.execute(
          'SELECT id FROM products WHERE shop_id = ? AND sku = ?',
          [shopId, sku]
        );

        if (existing.length > 0) {
          console.log(`⏭️  Skipped: ${productName} (already exists)`);
          skipped++;
          continue;
        }

        // Calculate cost price (80% of MOP as an estimate)
        const costPrice = product.mop * 0.8;
        
        // Extract weight value for stock quantity (default to 0)
        const weightValue = parseFloat(product.weight.replace('g', ''));

        await connection.execute(
          `INSERT INTO products (
            shop_id, category_id, name, sku, unit, cost_price, selling_price, 
            gst_rate, stock_quantity, min_stock_level, description, is_active
          ) VALUES (?, ?, ?, ?, 'g', ?, ?, 0, 0, 0, ?, TRUE)`,
          [
            shopId,
            categories[product.category],
            productName,
            sku,
            costPrice.toFixed(2),
            product.mop,
            `MRP: ₹${product.mrp}, MOP: ₹${product.mop}`
          ]
        );

        console.log(`✅ Inserted: ${productName} - SKU: ${sku} - MOP: ₹${product.mop}`);
        inserted++;
      } catch (error) {
        console.error(`❌ Error inserting ${product.name} ${product.weight}:`, error.message);
        errors++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Summary:');
    console.log(`   ✅ Inserted: ${inserted} products`);
    console.log(`   ⏭️  Skipped: ${skipped} products (already exist)`);
    console.log(`   ❌ Errors: ${errors} products`);
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('Database connection closed.');
    }
  }
}

insertProducts();

