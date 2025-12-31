/**
 * Migration Script: Customers Management System
 * Run: node database/migrate_customers.js
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'multi_shop_billing',
  ssl: process.env.DB_SSL === 'true' ? {
    rejectUnauthorized: false
  } : false,
  multipleStatements: true
};

async function runMigration() {
  let connection;
  
  try {
    console.log('Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    console.log('Connected successfully!');

    // Read SQL file
    const sqlFilePath = path.join(__dirname, 'migration_customers.sql');
    const sql = fs.readFileSync(sqlFilePath, 'utf8');

    // Split by semicolon and filter out empty statements
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`Executing ${statements.length} statements...`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      // Skip comments
      if (statement.startsWith('--')) {
        continue;
      }

      try {
        // Check if it's a conditional ALTER (MySQL doesn't support IF NOT EXISTS for ALTER TABLE)
        if (statement.includes('ADD COLUMN IF NOT EXISTS')) {
          // Extract table and column info
          const match = statement.match(/ALTER TABLE\s+(\w+)\s+ADD COLUMN IF NOT EXISTS\s+(\w+)/i);
          if (match) {
            const [, tableName, columnName] = match;
            // Check if column exists
            const [columns] = await connection.execute(
              `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
               WHERE TABLE_SCHEMA = DATABASE() 
               AND TABLE_NAME = ? 
               AND COLUMN_NAME = ?`,
              [tableName, columnName]
            );

            if (columns.length === 0) {
              // Column doesn't exist, add it
              const alterStatement = statement.replace('IF NOT EXISTS', '').replace(/IF NOT EXISTS/g, '');
              await connection.execute(alterStatement);
              console.log(`✓ Added column ${columnName} to ${tableName}`);
            } else {
              console.log(`⊘ Column ${columnName} already exists in ${tableName}, skipping`);
            }
            continue;
          }
        }

        // Check for ADD INDEX IF NOT EXISTS
        if (statement.includes('ADD INDEX IF NOT EXISTS')) {
          const match = statement.match(/ALTER TABLE\s+(\w+)\s+ADD INDEX IF NOT EXISTS\s+(\w+)/i);
          if (match) {
            const [, tableName, indexName] = match;
            const [indexes] = await connection.execute(
              `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS 
               WHERE TABLE_SCHEMA = DATABASE() 
               AND TABLE_NAME = ? 
               AND INDEX_NAME = ?`,
              [tableName, indexName]
            );

            if (indexes.length === 0) {
              const alterStatement = statement.replace('IF NOT EXISTS', '');
              await connection.execute(alterStatement);
              console.log(`✓ Added index ${indexName} to ${tableName}`);
            } else {
              console.log(`⊘ Index ${indexName} already exists in ${tableName}, skipping`);
            }
            continue;
          }
        }

        // Check for ADD FOREIGN KEY IF NOT EXISTS
        if (statement.includes('ADD FOREIGN KEY IF NOT EXISTS')) {
          const match = statement.match(/ADD FOREIGN KEY IF NOT EXISTS\s+(\w+)/i);
          if (match) {
            const [, fkName] = match;
            const [fks] = await connection.execute(
              `SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
               WHERE TABLE_SCHEMA = DATABASE() 
               AND CONSTRAINT_NAME = ?`,
              [fkName]
            );

            if (fks.length === 0) {
              const alterStatement = statement.replace('IF NOT EXISTS', '');
              await connection.execute(alterStatement);
              console.log(`✓ Added foreign key ${fkName}`);
            } else {
              console.log(`⊘ Foreign key ${fkName} already exists, skipping`);
            }
            continue;
          }
        }

        // Execute regular statements
        await connection.execute(statement);
        console.log(`✓ Executed statement ${i + 1}/${statements.length}`);
      } catch (error) {
        // If error is about object already existing, skip it
        if (error.code === 'ER_DUP_FIELDNAME' || 
            error.code === 'ER_DUP_KEYNAME' || 
            error.code === 'ER_DUP_KEY' ||
            error.message.includes('already exists')) {
          console.log(`⊘ Statement ${i + 1} skipped (already exists): ${error.message.split('\n')[0]}`);
        } else {
          throw error;
        }
      }
    }

    console.log('\n✅ Migration completed successfully!');
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    if (error.sql) {
      console.error('SQL:', error.sql);
    }
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('Database connection closed.');
    }
  }
}

// Run migration
runMigration();

