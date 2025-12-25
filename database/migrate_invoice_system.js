/**
 * Migration Script: Invoice System Enhancements
 * 
 * This migration adds:
 * - Shop fields: state, bank details, invoice number pattern
 * - HSN code to products and bill_items
 * - Shipping address and customer GSTIN to bills
 * - invoice_templates table for flexible template management
 * 
 * Run this after the base schema is set up.
 */

require('dotenv').config({ path: './backend/.env' });
const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');

async function migrate() {
  let connection;
  
  try {
    // Load environment variables from backend/.env
    const envPath = path.join(__dirname, '..', 'backend', '.env');
    require('dotenv').config({ path: envPath });
    
    // Connect to database with SSL configuration (required for TiDB Cloud)
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'multi_shop_billing',
      port: parseInt(process.env.DB_PORT) || 3306,
      multipleStatements: true, // Allow multiple statements
      // SSL configuration for TiDB Serverless (required)
      ssl: process.env.DB_HOST && process.env.DB_HOST.includes('tidbcloud.com') ? {
        rejectUnauthorized: true
      } : (process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: true
      } : false)
    });

    console.log('✅ Connected to database');
    console.log('📦 Running invoice system migration...\n');

    // Read and execute migration SQL
    const sqlPath = path.join(__dirname, 'migration_invoice_system.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Split SQL into individual statements
    // Remove comments first
    let cleanSql = sql.replace(/--.*$/gm, ''); // Remove line comments
    cleanSql = cleanSql.replace(/\/\*[\s\S]*?\*\//g, ''); // Remove block comments
    
    // Split by semicolons
    const statements = cleanSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

    let executedCount = 0;
    for (const statement of statements) {
      if (statement.length > 0) {
        try {
          // Execute each statement
          await connection.execute(statement);
          executedCount++;
          
          // Extract a meaningful description from the statement
          let desc = statement.substring(0, 50).replace(/\n/g, ' ').trim();
          if (statement.includes('ALTER TABLE shops')) {
            desc = 'Added fields to shops table';
          } else if (statement.includes('ALTER TABLE products')) {
            desc = 'Added hsn_code to products table';
          } else if (statement.includes('ALTER TABLE bills')) {
            desc = 'Added fields to bills table';
          } else if (statement.includes('ALTER TABLE bill_items')) {
            desc = 'Added hsn_code to bill_items table';
          } else if (statement.includes('CREATE TABLE')) {
            desc = 'Created invoice_templates table';
          }
          
          console.log(`✓ ${desc}`);
        } catch (error) {
          // Handle specific errors gracefully
          if (error.code === 'ER_DUP_FIELDNAME' || error.code === 'Duplicate column name') {
            const colName = error.message.match(/`(\w+)`/)?.[1] || 'column';
            console.log(`⚠️  Column '${colName}' already exists, skipping`);
          } else if (error.code === 'ER_TABLE_EXISTS_ERROR' || error.code === 'ER_CANT_CREATE_TABLE') {
            console.log(`⚠️  Table already exists, skipping`);
          } else if (error.message.includes('already exists')) {
            console.log(`⚠️  Already exists, skipping`);
          } else {
            // Re-throw unexpected errors
            console.error(`❌ Error executing statement: ${statement.substring(0, 100)}...`);
            throw error;
          }
        }
      }
    }

    console.log('\n✅ Migration completed successfully!');
    console.log(`   Executed ${executedCount} statements`);
    console.log('\n📋 Summary of changes:');
    console.log('   - Added state, bank details, and invoice pattern fields to shops table');
    console.log('   - Added hsn_code to products table');
    console.log('   - Added customer_gstin, customer_address, shipping_address to bills table');
    console.log('   - Added hsn_code to bill_items table');
    console.log('   - Created invoice_templates table');

  } catch (error) {
    console.error('\n❌ Error running migration:', error.message);
    console.error('Error code:', error.code);
    
    if (error.code === 'ER_NO_SUCH_TABLE') {
      console.error('\n⚠️  Required table not found. Please run schema.sql first.');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('\n⚠️  Could not connect to database. Please check:');
      console.error('   1. MySQL server is running');
      console.error('   2. Database credentials in backend/.env are correct');
      console.error('   3. Database exists: ' + (process.env.DB_NAME || 'multi_shop_billing'));
    }
    
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Database connection closed.');
    }
  }
}

// Run the migration
migrate();

