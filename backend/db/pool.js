const path = require('path');
const { Pool } = require('pg');

// Load the project-root .env regardless of whether the server is started from
// the root or from /backend. Credentials are never committed to this project.
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const databaseUrl = process.env.DATABASE_URL;
const requiresSsl =
  process.env.PGSSLMODE === 'require' || /(?:[?&]sslmode=require)/i.test(databaseUrl || '');

const poolOptions = databaseUrl
  ? { connectionString: databaseUrl }
  : {
      host: process.env.PGHOST,
      port: process.env.PGPORT,
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      database: process.env.PGDATABASE,
    };

if (requiresSsl) {
  poolOptions.ssl = { rejectUnauthorized: false };
}

const pool = new Pool(poolOptions);

pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL pool error', error);
});

module.exports = pool;
