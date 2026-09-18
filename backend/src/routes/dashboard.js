const express = require('express');
const pool = require('../db');
const requireAuth = require('../middleware/auth');
const asyncHandler = require('../asyncHandler');

const router = express.Router();
router.use(requireAuth);

router.get('/summary', asyncHandler(async (req, res) => {
  const [clientsResult, agreementsResult, invoicesResult] = await Promise.all([
    pool.query('SELECT COUNT(*) FROM clients WHERE user_id = $1', [req.userId]),
    pool.query('SELECT status, COUNT(*) FROM agreements WHERE user_id = $1 GROUP BY status', [req.userId]),
    pool.query(
      `SELECT status, COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total
       FROM invoices WHERE user_id = $1 GROUP BY status`,
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
