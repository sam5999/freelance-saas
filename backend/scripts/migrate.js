// Applique src/db/schema.sql sur la base pointée par DATABASE_URL.
// Le fichier est écrit pour être rejouable sans danger (IF NOT EXISTS partout).
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../src/db');

async function main() {
  const sql = fs.readFileSync(path.join(__dirname, '../src/db/schema.sql'), 'utf8');
  await pool.query(sql);
  console.log('Base de données à jour.');
  await pool.end();
}

main().catch((err) => {
  console.error('Échec de la migration :', err.message);
  process.exit(1);
});
