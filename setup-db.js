const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: './backend/.env' });

async function setupDatabase() {
  try {
    const dbName = process.env.DB_NAME || 'multi_shop_billing';
    const dbHost = process.env.DB_HOST || 'localhost';
    const dbUser = process.env.DB_USER || 'root';
    const dbPassword = process.env.DB_PASSWORD || '';
    const dbPort = parseInt(process.env.DB_PORT) || 3306;

    console.log('Connecting to MySQL server...');
    console.log(`Host: ${dbHost}, User: ${dbUser}, Port: ${dbPort}`);

    // Connect without database first
    const connection = await mysql.createConnection({
      host: dbHost,
      user: dbUser,
      password: dbPassword,
      port: dbPort,
    });

    console.log('✓ Connected to MySQL server');

    // Create database
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    console.log(`✓ Database '${dbName}' created or already exists`);

    // Close connection and reconnect to the new database
    await connection.end();

    const dbConnection = await mysql.createConnection({
      host: dbHost,
      user: dbUser,
      password: dbPassword,
      database: dbName,
      port: dbPort,
      multipleStatements: true,
    });

    console.log('✓ Connected to database');

    // Read and execute schema
    const schemaPath = path.join(__dirname, 'database', 'schema.sql');
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Schema file not found at ${schemaPath}`);
    }

    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Split by semicolons and execute each statement
    const statements = schema
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      if (statement.length > 0) {
        try {
          await dbConnection.query(statement);
        } catch (err) {
          // Ignore "table already exists" errors
          if (!err.message.includes('already exists')) {
            console.warn(`Warning: ${err.message}`);
          }
        }
      }
    }

    console.log('✓ Schema imported successfully');

    await dbConnection.end();
    console.log('\n✅ Database setup complete!');
    console.log('\nYou can now start the application:');
    console.log('  Terminal 1: cd backend && npm run dev');
    console.log('  Terminal 2: npm run dev');
  } catch (error) {
    console.error('\n❌ Error setting up database:');
    console.error(error.message);
    console.error('\nPlease check:');
    console.error('1. MySQL server is running');
    console.error('2. backend/.env file exists with correct credentials');
    console.error('3. Database credentials are correct');
    process.exit(1);
  }
}

setupDatabase();

