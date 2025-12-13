/**
 * Migration script to change logo_url column from VARCHAR(500) to TEXT
 * 
 * Usage: node database/migrate_logo_url_text.js
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
    
    // Connect to database
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'multi_shop_billing',
    });

    console.log('Connected to database');

    // Read and execute migration SQL
    const sqlPath = path.join(__dirname, 'migration_logo_url_text.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Split by semicolons and execute each statement
    const statements = sql.split(';').filter(s => s.trim().length > 0);
    
    for (const statement of statements) {
      if (statement.trim()) {
        await connection.execute(statement);
      }
    }

    console.log('\n✅ Migration completed successfully!');
    console.log('logo_url column has been changed from VARCHAR(500) to TEXT.');

  } catch (error) {
    console.error('❌ Error running migration:', error.message);
    
    if (error.code === 'ER_BAD_FIELD_ERROR') {
      console.error('\n⚠️  Column not found. Please check your schema.');
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

