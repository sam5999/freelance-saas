const express = require('express');
const crypto = require('crypto');
const pool = require('../db');
const requireAuth = require('../middleware/auth');
const { sendAgreementConfirmationEmail } = require('../email');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const result = await pool.query(
    `SELECT a.id, a.title, a.description, a.amount, a.status, a.confirmation_token,
            a.sent_at, a.confirmed_at, a.created_at,
            c.id AS client_id, c.name AS client_name
     FROM agreements a
     JOIN clients c ON c.id = a.client_id
     WHERE a.user_id = $1
     ORDER BY a.created_at DESC`,
    [req.userId]
  );
  res.json({ agreements: result.rows });
});

router.post('/', async (req, res) => {
  const { clientId, title, description, amount } = req.body;
  if (!clientId || !title || !title.trim()) {
    return res.status(400).json({ message: 'Le client et le titre sont requis' });
  }

  const client = await pool.query('SELECT id FROM clients WHERE id = $1 AND user_id = $2', [clientId, req.userId]);
  if (client.rows.length === 0) {
    return res.status(404).json({ message: 'Client introuvable' });
  }

  const result = await pool.query(
    `INSERT INTO agreements (user_id, client_id, title, description, amount)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [req.userId, clientId, title.trim(), description || null, amount || null]
  );
  res.status(201).json({ agreement: result.rows[0] });
});

router.put('/:id', async (req, res) => {
  const { title, description, amount } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ message: 'Le titre est requis' });
  }

  const existing = await pool.query('SELECT status FROM agreements WHERE id = $1 AND user_id = $2', [
    req.params.id,
    req.userId,
  ]);
  if (existing.rows.length === 0) {
    return res.status(404).json({ message: 'Accord introuvable' });
  }
  if (existing.rows[0].status !== 'draft') {
    return res.status(400).json({ message: 'Un accord déjà envoyé ne peut plus être modifié' });
  }

  const result = await pool.query(
    `UPDATE agreements SET title = $1, description = $2, amount = $3
     WHERE id = $4 AND user_id = $5 RETURNING *`,
    [title.trim(), description || null, amount || null, req.params.id, req.userId]
  );
  res.json({ agreement: result.rows[0] });
});

router.delete('/:id', async (req, res) => {
  const result = await pool.query('DELETE FROM agreements WHERE id = $1 AND user_id = $2 RETURNING id', [
    req.params.id,
    req.userId,
  ]);
  if (result.rows.length === 0) {
    return res.status(404).json({ message: 'Accord introuvable' });
  }
  res.status(204).send();
});

router.post('/:id/send', async (req, res) => {
  const result = await pool.query(
    `SELECT a.id, a.title, a.description, a.amount, a.status, a.confirmation_token,
            c.name AS client_name, c.email AS client_email,
            u.full_name AS freelance_name, u.email AS freelance_email
     FROM agreements a
     JOIN clients c ON c.id = a.client_id
     JOIN users u ON u.id = a.user_id
     WHERE a.id = $1 AND a.user_id = $2`,
    [req.params.id, req.userId]
  );
  const agreement = result.rows[0];
  if (!agreement) {
    return res.status(404).json({ message: 'Accord introuvable' });
  }
  if (!agreement.client_email) {
    return res.status(400).json({ message: "Ce client n'a pas d'adresse email enregistrée" });
  }
  if (agreement.status === 'confirmed') {
    return res.status(400).json({ message: 'Cet accord est déjà confirmé' });
  }

  const token = agreement.confirmation_token || crypto.randomBytes(24).toString('hex');
  const confirmUrl = `${process.env.FRONTEND_URL}/confirm/${token}`;

  await sendAgreementConfirmationEmail({
    to: agreement.client_email,
    freelanceName: agreement.freelance_name || agreement.freelance_email,
    clientName: agreement.client_name,
    title: agreement.title,
    amount: agreement.amount,
    confirmUrl,
  });

  const updated = await pool.query(
    `UPDATE agreements SET confirmation_token = $1, status = 'sent', sent_at = now()
     WHERE id = $2 AND status <> 'confirmed' RETURNING *`,
    [token, agreement.id]
  );
  res.json({ agreement: updated.rows[0] });
});

module.exports = router;
