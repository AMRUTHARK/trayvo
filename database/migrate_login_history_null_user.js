/**
 * Migration script to allow user_id to be NULL in login_history table
 * 
 * Usage: node database/migrate_login_history_null_user.js
 * 
 * Make sure to set your database credentials in backend/.env first
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
    
    // SSL configuration for TiDB Serverless (required)
    // Enable SSL for TiDB Cloud connections, disable for local development
    const sslConfig = process.env.DB_HOST && process.env.DB_HOST.includes('tidbcloud.com') ? {
      rejectUnauthorized: true
    } : (process.env.NODE_ENV === 'production' ? {
      rejectUnauthorized: true
    } : false);
    
    // Connect to database with multipleStatements enabled for dynamic SQL
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'multi_shop_billing',
      port: parseInt(process.env.DB_PORT) || 3306,
      ssl: sslConfig,
      multipleStatements: true // Required for dynamic SQL (PREPARE/EXECUTE)
    });

    console.log('Connected to database');

    // Read and execute migration SQL
    // Use query() instead of execute() to support dynamic SQL (PREPARE/EXECUTE)
    const sqlPath = path.join(__dirname, 'migration_login_history_null_user.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('Running migration...');
    await connection.query(sql);

    console.log('\n✅ Migration completed successfully!');
    console.log('user_id column in login_history table can now be NULL for failed login attempts.');

  } catch (error) {
    console.error('❌ Error running migration:', error.message);
    
    if (error.code === 'ER_NO_SUCH_TABLE') {
      console.error('\n⚠️  login_history table not found. Please run migrate_login_history.js first.');
    }
    
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the migration
migrate();

