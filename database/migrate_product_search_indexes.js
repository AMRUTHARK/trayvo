/**
 * Script to add indexes for product search performance
 * 
 * Usage: node database/migrate_product_search_indexes.js
 * 
 * Make sure to set your database credentials in backend/.env first
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

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

async function runMigration() {
  let connection;
  try {
    console.log('Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    console.log('Connected successfully');

    const sql = fs.readFileSync(path.join(__dirname, 'migration_product_search_indexes.sql'), 'utf8');
    console.log('Running migration...');
    await connection.query(sql);
    console.log('Migration completed successfully!');
    console.log('Product search indexes have been added for improved performance.');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

runMigration();

