/**
 * Migration Script: Edit Transaction Support
 * 
 * This migration adds:
 * - Edit tracking fields to bills and purchases tables
 * - transaction_edit_history table for audit trail
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
      multipleStatements: true,
      // SSL configuration for TiDB Serverless (required)
      ssl: process.env.DB_HOST && process.env.DB_HOST.includes('tidbcloud.com') ? {
        rejectUnauthorized: true
      } : (process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: true
      } : false)
    });

    console.log('✅ Connected to database');
    console.log('📦 Running edit transaction migration...\n');

    // Read and execute migration SQL
    const sqlPath = path.join(__dirname, 'migration_edit_transactions.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Remove comments first
    let cleanSql = sql.replace(/--.*$/gm, '');
    cleanSql = cleanSql.replace(/\/\*[\s\S]*?\*\//g, '');
    
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
          await connection.execute(statement);
          executedCount++;
          
          let desc = statement.substring(0, 50).replace(/\n/g, ' ').trim();
          if (statement.includes('ALTER TABLE bills')) {
            desc = 'Added edit fields to bills table';
          } else if (statement.includes('ALTER TABLE purchases')) {
            desc = 'Added edit fields to purchases table';
          } else if (statement.includes('CREATE TABLE transaction_edit_history')) {
            desc = 'Created transaction_edit_history table';
          }
          
          console.log(`✓ ${desc}`);
        } catch (error) {
          if (error.code === 'ER_DUP_FIELDNAME' || error.code === 'Duplicate column name') {
            const colName = error.message.match(/`(\w+)`/)?.[1] || 'column';
            console.log(`⚠️  Column '${colName}' already exists, skipping`);
          } else if (error.code === 'ER_TABLE_EXISTS_ERROR' || error.code === 'ER_CANT_CREATE_TABLE') {
            console.log(`⚠️  Table already exists, skipping`);
          } else if (error.message.includes('already exists')) {
            console.log(`⚠️  Already exists, skipping`);
          } else if (error.code === 'ER_DUP_KEYNAME' || error.message.includes('Duplicate key name')) {
            console.log(`⚠️  Index already exists, skipping`);
          } else {
            console.error(`❌ Error executing statement: ${statement.substring(0, 100)}...`);
            throw error;
          }
        }
      }
    }

    // Add foreign keys separately (may fail if columns don't exist, that's ok)
    try {
      // Check if foreign key already exists before adding
      const [fkCheckBills] = await connection.execute(
        `SELECT CONSTRAINT_NAME 
         FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
         WHERE TABLE_SCHEMA = DATABASE() 
         AND TABLE_NAME = 'bills' 
         AND COLUMN_NAME = 'locked_by' 
         AND CONSTRAINT_NAME != 'PRIMARY'`
      );
      
      if (fkCheckBills.length === 0) {
        await connection.execute(`
          ALTER TABLE bills 
          ADD CONSTRAINT fk_bills_locked_by 
          FOREIGN KEY (locked_by) REFERENCES users(id) ON DELETE SET NULL
        `);
        console.log('✓ Added foreign key for bills.locked_by');
      }
    } catch (error) {
      if (!error.message.includes('already exists') && !error.message.includes('Duplicate')) {
        console.log(`⚠️  Could not add bills.locked_by foreign key: ${error.message}`);
      }
    }

    try {
      const [fkCheckBills2] = await connection.execute(
        `SELECT CONSTRAINT_NAME 
         FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
         WHERE TABLE_SCHEMA = DATABASE() 
         AND TABLE_NAME = 'bills' 
         AND COLUMN_NAME = 'last_edited_by' 
         AND CONSTRAINT_NAME != 'PRIMARY'`
      );
      
      if (fkCheckBills2.length === 0) {
        await connection.execute(`
          ALTER TABLE bills 
          ADD CONSTRAINT fk_bills_last_edited_by 
          FOREIGN KEY (last_edited_by) REFERENCES users(id) ON DELETE SET NULL
        `);
        console.log('✓ Added foreign key for bills.last_edited_by');
      }
    } catch (error) {
      if (!error.message.includes('already exists') && !error.message.includes('Duplicate')) {
        console.log(`⚠️  Could not add bills.last_edited_by foreign key: ${error.message}`);
      }
    }

    console.log('\n✅ Migration completed successfully!');
    console.log(`   Executed ${executedCount} statements`);
    console.log('\n📋 Summary of changes:');
    console.log('   - Added edit tracking fields to bills table');
    console.log('   - Added edit tracking fields to purchases table');
    console.log('   - Created transaction_edit_history table for audit trail');

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

