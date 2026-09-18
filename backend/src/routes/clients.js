const express = require('express');
const pool = require('../db');
const requireAuth = require('../middleware/auth');
const asyncHandler = require('../asyncHandler');

const router = express.Router();
router.use(requireAuth);

router.get('/', asyncHandler(async (req, res) => {
  const result = await pool.query(
    'SELECT id, name, email, company, phone, created_at FROM clients WHERE user_id = $1 ORDER BY created_at DESC',
    [req.userId]
  );
  res.json({ clients: result.rows });
}));

router.post('/', asyncHandler(async (req, res) => {
  const { name, email, company, phone } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ message: 'Le nom du client est requis' });
  }

  const result = await pool.query(
    'INSERT INTO clients (user_id, name, email, company, phone) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, company, phone, created_at',
    [req.userId, name.trim(), email || null, company || null, phone || null]
  );
  res.status(201).json({ client: result.rows[0] });
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const { name, email, company, phone } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ message: 'Le nom du client est requis' });
  }

  const result = await pool.query(
    'UPDATE clients SET name = $1, email = $2, company = $3, phone = $4 WHERE id = $5 AND user_id = $6 RETURNING id, name, email, company, phone, created_at',
    [name.trim(), email || null, company || null, phone || null, req.params.id, req.userId]
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
