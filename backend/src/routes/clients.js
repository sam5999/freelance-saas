const express = require('express');
const pool = require('../db');
const requireAuth = require('../middleware/auth');
const { requireSubscription } = require('../middleware/subscription');
const asyncHandler = require('../asyncHandler');

const router = express.Router();
router.use(requireAuth);
router.use(requireSubscription);

const FIELDS = 'id, name, email, company, phone, address, siret, created_at';

// Valide et normalise le corps de la requête. Renvoie { error } ou { values }.
function parseClient(body) {
  const name = body.name ? String(body.name).trim() : '';
  if (!name) return { error: 'Le nom du client est requis' };

  const siret = body.siret ? String(body.siret).replace(/\s/g, '') : null;
  if (siret && !/^(\d{9}|\d{14})$/.test(siret)) {
    return { error: 'Le SIREN doit contenir 9 chiffres (ou 14 pour un SIRET)' };
  }
  const address = body.address ? String(body.address).trim() : null;
  if (address && address.length > 500) return { error: 'Adresse : 500 caractères maximum' };

  return {
    values: [name, body.email || null, body.company || null, body.phone || null, address || null, siret],
  };
}

router.get('/', asyncHandler(async (req, res) => {
  const result = await pool.query(`SELECT ${FIELDS} FROM clients WHERE user_id = $1 ORDER BY created_at DESC`, [
    req.userId,
  ]);
  res.json({ clients: result.rows });
}));

router.post('/', asyncHandler(async (req, res) => {
  const { error, values } = parseClient(req.body);
  if (error) return res.status(400).json({ message: error });

  const result = await pool.query(
    `INSERT INTO clients (name, email, company, phone, address, siret, user_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING ${FIELDS}`,
    [...values, req.userId]
  );
  res.status(201).json({ client: result.rows[0] });
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const { error, values } = parseClient(req.body);
  if (error) return res.status(400).json({ message: error });

  const result = await pool.query(
    `UPDATE clients SET name = $1, email = $2, company = $3, phone = $4, address = $5, siret = $6
     WHERE id = $7 AND user_id = $8 RETURNING ${FIELDS}`,
    [...values, req.params.id, req.userId]
  );
  if (result.rows.length === 0) {
    return res.status(404).json({ message: 'Client introuvable' });
  }
  res.json({ client: result.rows[0] });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const result = await pool.query('DELETE FROM clients WHERE id = $1 AND user_id = $2 RETURNING id', [
    req.params.id,
    req.userId,
  ]);
  if (result.rows.length === 0) {
    return res.status(404).json({ message: 'Client introuvable' });
  }
  res.status(204).send();
}));

module.exports = router;
