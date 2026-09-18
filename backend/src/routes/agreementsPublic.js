const express = require('express');
const pool = require('../db');

const router = express.Router();

router.get('/:token', async (req, res) => {
  const result = await pool.query(
    `SELECT a.title, a.description, a.amount, a.status, a.confirmed_at,
            c.name AS client_name,
            u.full_name AS freelance_name
     FROM agreements a
     JOIN clients c ON c.id = a.client_id
     JOIN users u ON u.id = a.user_id
     WHERE a.confirmation_token = $1`,
    [req.params.token]
  );
  const agreement = result.rows[0];
  if (!agreement) {
    return res.status(404).json({ message: 'Accord introuvable ou lien invalide' });
  }
  res.json({ agreement });
});

router.post('/:token/confirm', async (req, res) => {
  const existing = await pool.query('SELECT id, status FROM agreements WHERE confirmation_token = $1', [
    req.params.token,
  ]);
  const agreement = existing.rows[0];
  if (!agreement) {
    return res.status(404).json({ message: 'Accord introuvable ou lien invalide' });
  }

  if (agreement.status !== 'confirmed') {
    await pool.query(`UPDATE agreements SET status = 'confirmed', confirmed_at = now() WHERE id = $1`, [
      agreement.id,
    ]);
  }
  res.status(204).send();
});

module.exports = router;
