const express = require('express');
const pool = require('../db');
const requireAuth = require('../middleware/auth');
const asyncHandler = require('../asyncHandler');
const { generateInvoicePdf } = require('../pdf');

const router = express.Router();
router.use(requireAuth);

async function nextInvoiceNumber(userId) {
  const { rows } = await pool.query('SELECT COUNT(*) FROM invoices WHERE user_id = $1', [userId]);
  const seq = parseInt(rows[0].count, 10) + 1;
  const year = new Date().getFullYear();
  return `FA-${year}-${String(seq).padStart(4, '0')}`;
}

router.get('/', asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT i.id, i.invoice_number, i.title, i.amount, i.status, i.due_date, i.paid_at, i.created_at,
            c.id AS client_id, c.name AS client_name
     FROM invoices i
     JOIN clients c ON c.id = i.client_id
     WHERE i.user_id = $1
     ORDER BY i.created_at DESC`,
    [req.userId]
  );
  res.json({ invoices: result.rows });
}));

router.post('/', asyncHandler(async (req, res) => {
  const { agreementId, clientId, title, description, amount, dueDate } = req.body;

  if (!clientId || !title || !title.trim() || !amount) {
    return res.status(400).json({ message: 'Client, titre et montant sont requis' });
  }

  const client = await pool.query('SELECT id FROM clients WHERE id = $1 AND user_id = $2', [clientId, req.userId]);
  if (client.rows.length === 0) {
    return res.status(404).json({ message: 'Client introuvable' });
  }

  if (agreementId) {
    const agreement = await pool.query(
      'SELECT id FROM agreements WHERE id = $1 AND user_id = $2 AND client_id = $3',
      [agreementId, req.userId, clientId]
    );
    if (agreement.rows.length === 0) {
      return res.status(400).json({ message: "L'accord sélectionné ne correspond pas à ce client" });
    }
  }

  const invoiceNumber = await nextInvoiceNumber(req.userId);

  const result = await pool.query(
    `INSERT INTO invoices (user_id, client_id, agreement_id, invoice_number, title, description, amount, due_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [req.userId, clientId, agreementId || null, invoiceNumber, title.trim(), description || null, amount, dueDate || null]
  );
  res.status(201).json({ invoice: result.rows[0] });
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const { title, description, amount, dueDate } = req.body;
  if (!title || !title.trim() || !amount) {
    return res.status(400).json({ message: 'Titre et montant sont requis' });
  }

  const result = await pool.query(
    `UPDATE invoices SET title = $1, description = $2, amount = $3, due_date = $4
     WHERE id = $5 AND user_id = $6 AND status = 'pending' RETURNING *`,
    [title.trim(), description || null, amount, dueDate || null, req.params.id, req.userId]
  );
  if (result.rows.length === 0) {
    return res.status(404).json({ message: 'Facture introuvable ou déjà payée' });
  }
  res.json({ invoice: result.rows[0] });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const result = await pool.query('DELETE FROM invoices WHERE id = $1 AND user_id = $2 RETURNING id', [
    req.params.id,
    req.userId,
  ]);
  if (result.rows.length === 0) {
    return res.status(404).json({ message: 'Facture introuvable' });
  }
  res.status(204).send();
}));

router.post('/:id/mark-paid', asyncHandler(async (req, res) => {
  const result = await pool.query(
    `UPDATE invoices SET status = 'paid', paid_at = now() WHERE id = $1 AND user_id = $2 RETURNING *`,
    [req.params.id, req.userId]
  );
  if (result.rows.length === 0) return res.status(404).json({ message: 'Facture introuvable' });
  res.json({ invoice: result.rows[0] });
}));

router.post('/:id/mark-pending', asyncHandler(async (req, res) => {
  const result = await pool.query(
    `UPDATE invoices SET status = 'pending', paid_at = NULL WHERE id = $1 AND user_id = $2 RETURNING *`,
    [req.params.id, req.userId]
  );
  if (result.rows.length === 0) return res.status(404).json({ message: 'Facture introuvable' });
  res.json({ invoice: result.rows[0] });
}));

router.get('/:id/pdf', asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT i.*, c.name AS client_name, c.company AS client_company, c.email AS client_email,
            u.full_name AS freelance_name, u.email AS freelance_email
     FROM invoices i
     JOIN clients c ON c.id = i.client_id
     JOIN users u ON u.id = i.user_id
     WHERE i.id = $1 AND i.user_id = $2`,
    [req.params.id, req.userId]
  );
  const row = result.rows[0];
  if (!row) {
    return res.status(404).json({ message: 'Facture introuvable' });
  }

  const pdfBuffer = await generateInvoicePdf({
    invoice: row,
    client: { name: row.client_name, company: row.client_company, email: row.client_email },
    freelance: { full_name: row.freelance_name, email: row.freelance_email },
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${row.invoice_number}.pdf"`);
  res.send(pdfBuffer);
}));

module.exports = router;
