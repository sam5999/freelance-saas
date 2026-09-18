const express = require('express');
const pool = require('../db');
const requireAuth = require('../middleware/auth');
const { requireSubscription } = require('../middleware/subscription');
const asyncHandler = require('../asyncHandler');

const router = express.Router();
router.use(requireAuth);
router.use(requireSubscription);

router.get('/summary', asyncHandler(async (req, res) => {
  const [clientsResult, agreementsResult, invoicesResult] = await Promise.all([
    pool.query('SELECT COUNT(*) FROM clients WHERE user_id = $1', [req.userId]),
    pool.query('SELECT status, COUNT(*) FROM agreements WHERE user_id = $1 GROUP BY status', [req.userId]),
    pool.query(
      // Factures émises uniquement (ni brouillons, ni avoirs), après déduction des avoirs :
      // une facture entièrement annulée ne compte plus, une facture créditée en partie compte pour le reste dû.
      `SELECT i.status, COUNT(*) AS count,
              COALESCE(SUM(ROUND(i.amount * (1 + i.vat_rate / 100), 2) - COALESCE(cr.credit_ttc, 0)), 0) AS total
       FROM invoices i
       LEFT JOIN LATERAL (
         SELECT SUM(x.amount) AS credit_ht, SUM(ROUND(x.amount * (1 + x.vat_rate / 100), 2)) AS credit_ttc
         FROM invoices x WHERE x.credited_invoice_id = i.id AND x.type = 'credit_note'
       ) cr ON true
       WHERE i.user_id = $1 AND i.type = 'invoice' AND i.status IN ('pending', 'paid')
         AND COALESCE(cr.credit_ht, 0) < i.amount
       GROUP BY i.status`,
      [req.userId]
    ),
  ]);

  const agreements = { draft: 0, sent: 0, confirmed: 0 };
  agreementsResult.rows.forEach((row) => {
    agreements[row.status] = parseInt(row.count, 10);
  });

  const invoices = {
    pending: { count: 0, total: 0 },
    paid: { count: 0, total: 0 },
  };
  invoicesResult.rows.forEach((row) => {
    invoices[row.status] = { count: parseInt(row.count, 10), total: Number(row.total) };
  });

  res.json({
    clientsCount: parseInt(clientsResult.rows[0].count, 10),
    agreements,
    invoices,
  });
}));

module.exports = router;
