/**
 * Migration script to change logo_url column from TEXT to MEDIUMTEXT
 * This allows storing larger base64-encoded images (up to ~12MB raw files when base64 encoded)
 * 
 * Usage: node database/migrate_logo_url_mediumtext.js
 * 
 * Make sure to set your database credentials in backend/.env first
 */

require('dotenv').config({ path: './backend/.env' });
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function migrate() {
  let connection;

  try {
    // Database configuration
    const dbConfig = {
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      multipleStatements: true
    };

    // Add SSL configuration for TiDB Cloud or production environments
    if (process.env.DB_HOST && (process.env.DB_HOST.includes('tidbcloud.com') || process.env.NODE_ENV === 'production')) {
      dbConfig.ssl = {
        rejectUnauthorized: false
      };
    }

    console.log('Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to database');

    // Read SQL file
    const sqlPath = path.join(__dirname, 'migration_logo_url_mediumtext.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Split by semicolons and execute each statement
    const statements = sql.split(';').filter(s => s.trim().length > 0);

    console.log(`Executing ${statements.length} statement(s)...`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i].trim();
      if (statement) {
        console.log(`Executing statement ${i + 1}...`);
        await connection.execute(statement);
        console.log(`✅ Statement ${i + 1} executed successfully`);
      }
    }

    console.log('');
    console.log('✅ Migration completed successfully!');
    console.log('logo_url column has been changed from TEXT to MEDIUMTEXT.');
    console.log('You can now upload logos up to ~12MB (raw file size) which will be ~16MB when base64 encoded.');

  } catch (error) {
    console.error('❌ Error running migration:', error.message);
    
    if (error.code === 'ER_BAD_FIELD_ERROR') {
      console.error('The logo_url column does not exist. Please run the initial schema creation first.');
    } else if (error.code === 'ER_DUP_ENTRY') {
      console.error('Duplicate entry error. The migration may have already been run.');
    } else {
      console.error('Full error:', error);
    }
    
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('Database connection closed.');
    }
  }
}

migrate();

