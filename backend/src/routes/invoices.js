const express = require('express');
const pool = require('../db');
const requireAuth = require('../middleware/auth');
const { requireSubscription } = require('../middleware/subscription');
const asyncHandler = require('../asyncHandler');
const { generateInvoicePdf } = require('../pdf');
const { VAT_RATES, missingProfileFields, buildSellerSnapshot, buildClientSnapshot } = require('../legal');

const router = express.Router();
router.use(requireAuth);
router.use(requireSubscription);

// Colonnes renvoyées au frontend. Les dates sont converties en texte (AAAA-MM-JJ)
// pour éviter tout décalage de fuseau horaire à l'affichage.
function invoiceFields(p = '') {
  return `${p}id, ${p}invoice_number, ${p}title, ${p}description, ${p}amount, ${p}vat_rate, ${p}status,
    to_char(${p}due_date, 'YYYY-MM-DD') AS due_date,
    to_char(${p}service_date, 'YYYY-MM-DD') AS service_date,
    ${p}paid_at, ${p}created_at,
    ROUND(${p}amount * (1 + ${p}vat_rate / 100), 2) AS total_ttc,
    ${p}seller_info->>'vatRegime' AS vat_regime`;
}

const PROFILE_COLUMNS = `full_name, email, business_name, legal_form, address, siret, share_capital, phone,
  vat_regime, vat_number, default_vat_rate, vat_on_debits, payment_info, legal_notes`;

// Numéro séquentiel par année : FA-2026-0001, FA-2026-0002...
// On repart du plus grand numéro existant (et non du nombre de factures) pour ne jamais
// produire deux fois le même numéro.
async function nextInvoiceNumber(userId) {
  const prefix = `FA-${new Date().getFullYear()}-`;
  const { rows } = await pool.query(
    `SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM '[0-9]+$') AS INTEGER)), 0) AS last
     FROM invoices WHERE user_id = $1 AND invoice_number LIKE $2`,
    [userId, `${prefix}%`]
  );
  return `${prefix}${String(rows[0].last + 1).padStart(4, '0')}`;
}

// Renvoie le montant arrondi au centime, ou null s'il est invalide.
function parseAmount(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0 || n > 99999999.99) return null;
  return Math.round(n * 100) / 100;
}

// Renvoie null (vide), la date AAAA-MM-JJ (valide) ou undefined (invalide).
function cleanDate(value) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    return undefined;
  }
  return value;
}

function isBlank(value) {
  return value === undefined || value === null || value === '';
}

router.get('/', asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT ${invoiceFields('i.')}, c.id AS client_id, c.name AS client_name
     FROM invoices i
     JOIN clients c ON c.id = i.client_id
     WHERE i.user_id = $1
     ORDER BY i.created_at DESC`,
    [req.userId]
  );
  res.json({ invoices: result.rows });
}));

router.post('/', asyncHandler(async (req, res) => {
  const { agreementId, clientId, title, description, vatRate } = req.body;
  const amount = parseAmount(req.body.amount);
  const dueDate = cleanDate(req.body.dueDate);
  const serviceDate = cleanDate(req.body.serviceDate);

  if (!clientId || !title || !title.trim() || amount === null) {
    return res.status(400).json({ message: 'Client, titre et montant (positif) sont requis' });
  }
  if (dueDate === undefined || serviceDate === undefined) {
    return res.status(400).json({ message: 'Date invalide' });
  }

  const userResult = await pool.query(`SELECT ${PROFILE_COLUMNS} FROM users WHERE id = $1`, [req.userId]);
  const user = userResult.rows[0];
  const missing = missingProfileFields(user);
  if (missing.length > 0) {
    return res.status(400).json({
      code: 'PROFILE_INCOMPLETE',
      message: `Complète d'abord ton profil pour émettre une facture conforme (${missing.join(', ')}).`,
    });
  }

  const clientResult = await pool.query(
    'SELECT id, name, company, email, address, siret FROM clients WHERE id = $1 AND user_id = $2',
    [clientId, req.userId]
  );
  const client = clientResult.rows[0];
  if (!client) {
    return res.status(404).json({ message: 'Client introuvable' });
  }
  if (!client.address) {
    return res.status(400).json({
      message: "Ajoute l'adresse de facturation de ce client (page Clients) avant de créer la facture.",
    });
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

  let rate = 0;
  if (user.vat_regime === 'subject') {
    rate = isBlank(vatRate) ? Number(user.default_vat_rate) : Number(vatRate);
    if (!VAT_RATES.includes(rate)) {
      return res.status(400).json({ message: 'Taux de TVA non valide' });
    }
  }

  const invoiceNumber = await nextInvoiceNumber(req.userId);

  const result = await pool.query(
    `INSERT INTO invoices (user_id, client_id, agreement_id, invoice_number, title, description, amount,
       vat_rate, due_date, service_date, seller_info, client_info)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING ${invoiceFields()}`,
    [
      req.userId, clientId, agreementId || null, invoiceNumber, title.trim(), description || null, amount,
      rate, dueDate, serviceDate,
      JSON.stringify(buildSellerSnapshot(user)),
      JSON.stringify(buildClientSnapshot(client)),
    ]
  );
  res.status(201).json({ invoice: result.rows[0] });
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const { title, description, vatRate } = req.body;
  const amount = parseAmount(req.body.amount);
  const dueDate = cleanDate(req.body.dueDate);
  const serviceDate = cleanDate(req.body.serviceDate);

  if (!title || !title.trim() || amount === null) {
    return res.status(400).json({ message: 'Titre et montant (positif) sont requis' });
  }
  if (dueDate === undefined || serviceDate === undefined) {
    return res.status(400).json({ message: 'Date invalide' });
  }

  const existing = await pool.query(
    `SELECT vat_rate, seller_info->>'vatRegime' AS vat_regime
     FROM invoices WHERE id = $1 AND user_id = $2 AND status = 'pending'`,
    [req.params.id, req.userId]
  );
  if (existing.rows.length === 0) {
    return res.status(404).json({ message: 'Facture introuvable ou déjà payée' });
  }

  // Le taux de TVA ne peut changer que si la facture a été émise par un assujetti à la TVA.
  let rate = Number(existing.rows[0].vat_rate);
  if (existing.rows[0].vat_regime === 'subject' && !isBlank(vatRate)) {
    rate = Number(vatRate);
    if (!VAT_RATES.includes(rate)) {
      return res.status(400).json({ message: 'Taux de TVA non valide' });
    }
  }

  const result = await pool.query(
    `UPDATE invoices SET title = $1, description = $2, amount = $3, vat_rate = $4, due_date = $5, service_date = $6
     WHERE id = $7 AND user_id = $8 AND status = 'pending'
     RETURNING ${invoiceFields()}`,
    [title.trim(), description || null, amount, rate, dueDate, serviceDate, req.params.id, req.userId]
  );
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
    `UPDATE invoices SET status = 'paid', paid_at = now() WHERE id = $1 AND user_id = $2
     RETURNING ${invoiceFields()}`,
    [req.params.id, req.userId]
  );
  if (result.rows.length === 0) return res.status(404).json({ message: 'Facture introuvable' });
  res.json({ invoice: result.rows[0] });
}));

router.post('/:id/mark-pending', asyncHandler(async (req, res) => {
  const result = await pool.query(
    `UPDATE invoices SET status = 'pending', paid_at = NULL WHERE id = $1 AND user_id = $2
     RETURNING ${invoiceFields()}`,
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

  // Les factures utilisent la copie figée de l'émetteur/client faite à l'émission.
  // Repli minimal pour d'éventuelles factures créées avant l'ajout des mentions légales.
  const seller = row.seller_info || { name: row.freelance_name || row.freelance_email, email: row.freelance_email };
  const client = row.client_info || { name: row.client_name, company: row.client_company, email: row.client_email };

  const pdfBuffer = await generateInvoicePdf({ invoice: row, seller, client });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${row.invoice_number}.pdf"`);
  res.send(pdfBuffer);
}));

module.exports = router;
