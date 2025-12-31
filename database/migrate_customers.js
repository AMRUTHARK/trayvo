/**
 * Migration Script: Customers Management System
 * Run: node database/migrate_customers.js
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  let connection;
  
  try {
    // Load environment variables from backend/.env
    const envPath = path.join(__dirname, '..', 'backend', '.env');
    require('dotenv').config({ path: envPath });
    
    // Check if DB_HOST contains tidbcloud or similar cloud providers that require SSL
    const requiresSSL = process.env.DB_HOST?.includes('tidbcloud') || 
                        process.env.DB_HOST?.includes('tidb') ||
                        process.env.DB_SSL === 'true';
    
    const dbConfig = {
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'multi_shop_billing',
      ssl: requiresSSL ? {
        rejectUnauthorized: false
      } : undefined,
      multipleStatements: true
    };
    
    console.log('Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    console.log('Connected successfully!');

    // Read SQL file
    const sqlFilePath = path.join(__dirname, 'migration_customers.sql');
    const sql = fs.readFileSync(sqlFilePath, 'utf8');

    // Split SQL into statements more carefully (handling CREATE TABLE with multiple semicolons)
    // Remove comments first
    const lines = sql.split('\n').filter(line => !line.trim().startsWith('--'));
    const cleanedSql = lines.join('\n');
    
    // Split by semicolon but be smarter about it
    let statements = [];
    let currentStatement = '';
    let inCreateTable = false;
    let parenCount = 0;
    
    for (let i = 0; i < cleanedSql.length; i++) {
      const char = cleanedSql[i];
      currentStatement += char;
      
      if (char === '(') {
        parenCount++;
        if (currentStatement.toUpperCase().includes('CREATE TABLE')) {
          inCreateTable = true;
        }
      } else if (char === ')') {
        parenCount--;
        if (parenCount === 0 && inCreateTable) {
          inCreateTable = false;
        }
      } else if (char === ';' && !inCreateTable && parenCount === 0) {
        const stmt = currentStatement.trim();
        if (stmt.length > 0) {
          statements.push(stmt);
        }
        currentStatement = '';
      }
    }
    
    // Add any remaining statement
    if (currentStatement.trim().length > 0) {
      statements.push(currentStatement.trim());
    }
    
    // Filter out empty statements
    statements = statements.filter(s => s.length > 0 && !s.startsWith('--'));

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

    // After all statements, add index and foreign key if column was created
    try {
      // Check if customer_id column exists
      const [columns] = await connection.execute(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() 
         AND TABLE_NAME = 'bills' 
         AND COLUMN_NAME = 'customer_id'`
      );

      if (columns.length > 0) {
        // Column exists, now add index if it doesn't exist
        const [indexes] = await connection.execute(
          `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS 
           WHERE TABLE_SCHEMA = DATABASE() 
           AND TABLE_NAME = 'bills' 
           AND INDEX_NAME = 'idx_customer_id'`
        );

        if (indexes.length === 0) {
          await connection.execute('ALTER TABLE bills ADD INDEX idx_customer_id (customer_id)');
          console.log('✓ Added index idx_customer_id to bills table');
        } else {
          console.log('⊘ Index idx_customer_id already exists, skipping');
        }

        // Add foreign key if it doesn't exist
        const [fks] = await connection.execute(
          `SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
           WHERE TABLE_SCHEMA = DATABASE() 
           AND CONSTRAINT_NAME = 'fk_bills_customer'`
        );

        if (fks.length === 0) {
          await connection.execute(
            'ALTER TABLE bills ADD CONSTRAINT fk_bills_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL'
          );
          console.log('✓ Added foreign key fk_bills_customer');
        } else {
          console.log('⊘ Foreign key fk_bills_customer already exists, skipping');
        }
      }
    } catch (error) {
      console.log(`⚠ Warning: Could not add index/foreign key: ${error.message}`);
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

