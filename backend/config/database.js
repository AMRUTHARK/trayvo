const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'multi_shop_billing',
  port: parseInt(process.env.DB_PORT) || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  // SSL configuration for TiDB Serverless (required)
  // Enable SSL for TiDB Cloud connections, disable for local development
  ssl: process.env.DB_HOST && process.env.DB_HOST.includes('tidbcloud.com') ? {
    rejectUnauthorized: true
  } : (process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: true
  } : false)
});

// Test connection
pool.getConnection()
  .then(connection => {
    console.log('Database connected successfully');
    connection.release();
  })
  .catch(err => {
    console.error('Database connection error:', err);
  });

module.exports = pool;

