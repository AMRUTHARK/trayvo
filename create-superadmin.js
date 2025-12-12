/**
 * Script to create the first super admin user
 * 
 * Usage: node create-superadmin.js
 * 
 * Make sure to set your database credentials in backend/.env first
 */

const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
const path = require('path');
const dotenv = require('dotenv');

async function createSuperAdmin() {
  let connection;
  
  try {
    // Load environment variables from backend/.env
    const envPath = path.join(__dirname, 'backend', '.env');
    const result = dotenv.config({ path: envPath });
    
    if (result.error) {
      console.warn('⚠️  Could not load backend/.env file:', result.error.message);
    }
    
    // Also try loading from root if backend/.env doesn't exist
    if (!process.env.DB_HOST) {
      const rootResult = dotenv.config({ path: path.join(__dirname, '.env') });
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
    };

    // SSL configuration for TiDB Serverless (required)
    // Enable SSL for TiDB Cloud connections, disable for local development
    if (process.env.DB_HOST && process.env.DB_HOST.includes('tidbcloud.com')) {
      dbConfig.ssl = {
        rejectUnauthorized: true
      };
    } else if (process.env.NODE_ENV === 'production') {
      dbConfig.ssl = {
        rejectUnauthorized: true
      };
    }

    connection = await mysql.createConnection(dbConfig);

    console.log('Connected to database');

    // Default super admin credentials (CHANGE THESE!)
    const username = process.env.SUPERADMIN_USERNAME || 'superadmin';
    const email = process.env.SUPERADMIN_EMAIL || 'superadmin@system.com';
    const password = process.env.SUPERADMIN_PASSWORD || 'SuperAdmin123!';
    const fullName = process.env.SUPERADMIN_FULL_NAME || 'Super Administrator';
    
    // Debug: Show which values are being used
    if (process.env.SUPERADMIN_PASSWORD) {
      console.log('✓ Using SUPERADMIN_PASSWORD from .env file');
    } else {
      console.log('⚠️  SUPERADMIN_PASSWORD not found in .env, using default password');
    }

    // Check if super admin already exists
    const [existing] = await connection.execute(
      'SELECT id FROM users WHERE role = ? AND username = ?',
      ['super_admin', username]
    );

    if (existing.length > 0) {
      console.log('Super admin already exists!');
      console.log('To create a new one, delete the existing super admin from the database first.');
      return;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create super admin user (shop_id is NULL for super admin)
    await connection.execute(
      `INSERT INTO users (shop_id, username, email, password_hash, role, full_name, is_active)
       VALUES (NULL, ?, ?, ?, 'super_admin', ?, TRUE)`,
      [username, email, passwordHash, fullName]
    );

    console.log('\n✅ Super admin created successfully!');
    console.log('\n📋 Login Credentials:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Username: ${username}`);
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n⚠️  IMPORTANT: Change the password after first login!');
    console.log('\nYou can now login at: http://localhost:3000/login');

  } catch (error) {
    console.error('❌ Error creating super admin:', error.message);
    
    if (error.code === 'ER_NO_SUCH_TABLE') {
      console.error('\n⚠️  Database tables not found. Please run the schema.sql first.');
    } else if (error.code === 'ER_DUP_ENTRY') {
      console.error('\n⚠️  Username or email already exists.');
    } else if (error.code === 'ER_BAD_FIELD_ERROR') {
      console.error('\n⚠️  Database schema needs to be updated. Please run migration_superadmin.sql first.');
    }
    
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the script
createSuperAdmin();

