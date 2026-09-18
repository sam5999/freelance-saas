const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Sans ce gestionnaire, une coupure de connexion (ex. redémarrage de la base
// chez l'hébergeur) ferait planter tout le serveur.
pool.on('error', (err) => {
  console.error('Erreur inattendue sur une connexion PostgreSQL inactive :', err.message);
});

module.exports = pool;
