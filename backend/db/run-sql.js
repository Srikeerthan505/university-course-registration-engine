const fs = require('fs');
const path = require('path');
const pool = require('./pool');

const command = process.argv[2];
const fileName = command === 'schema' ? 'schema.sql' : command === 'seed' ? 'seed.sql' : null;

if (!fileName) {
  console.error('Usage: node db/run-sql.js <schema|seed>');
  process.exitCode = 1;
  return;
}

async function run() {
  const sql = fs.readFileSync(path.resolve(__dirname, fileName), 'utf8');
  await pool.query(sql);
  console.log(`Applied ${fileName}.`);
}

run()
  .catch((error) => {
    console.error(`Failed to apply ${fileName}:`, error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
