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

const PROFILE_COLUMNS = `full_name, email, business_name, legal_form, address, siret, share_capital, phone,
  vat_regime, vat_number, default_vat_rate, vat_on_debits, payment_info, legal_notes`;

// Format renvoyé au frontend pour les factures ET les avoirs. Les dates sont converties en texte
// (AAAA-MM-JJ) pour éviter tout décalage de fuseau horaire à l'affichage.
// "cancelled" = facture entièrement annulée par des avoirs ; "net_ttc" = ce qu'il reste dû.
const LIST_SELECT = `
  SELECT i.id, i.type, i.invoice_number, i.title, i.description, i.amount, i.vat_rate, i.status,
    to_char(i.due_date, 'YYYY-MM-DD') AS due_date,
    to_char(i.service_date, 'YYYY-MM-DD') AS service_date,
    i.paid_at, i.created_at, i.issued_at, i.credited_invoice_id,
    ROUND(i.amount * (1 + i.vat_rate / 100), 2) AS total_ttc,
    COALESCE(cr.credit_ht, 0) AS credited_ht,
    (i.type = 'invoice' AND COALESCE(cr.credit_ht, 0) >= i.amount) AS cancelled,
    CASE WHEN COALESCE(cr.credit_ht, 0) >= i.amount THEN 0
         ELSE ROUND(i.amount * (1 + i.vat_rate / 100), 2) - COALESCE(cr.credit_ttc, 0) END AS net_ttc,
    orig.invoice_number AS credited_invoice_number,
    c.id AS client_id, c.name AS client_name
  FROM invoices i
  JOIN clients c ON c.id = i.client_id
  LEFT JOIN invoices orig ON orig.id = i.credited_invoice_id
  LEFT JOIN LATERAL (
    SELECT SUM(x.amount) AS credit_ht, SUM(ROUND(x.amount * (1 + x.vat_rate / 100), 2)) AS credit_ttc
    FROM invoices x WHERE x.credited_invoice_id = i.id AND x.type = 'credit_note'
  ) cr ON true
  WHERE i.user_id = $1`;

async function fetchRows(userId, id) {
  const params = [userId];
  let extra = '';
  if (id) {
    params.push(id);
    extra = ' AND i.id = $2';
  }
  const { rows } = await pool.query(
    `${LIST_SELECT}${extra} ORDER BY COALESCE(i.issued_at, i.created_at) DESC, i.id DESC`,
    params
  );
  return rows;
}

// Numéro séquentiel par année et par type : FA-2026-0001 (factures), AV-2026-0001 (avoirs).
// On repart du plus grand numéro existant (et non du nombre de documents) pour ne jamais
// produire deux fois le même numéro.
async function nextNumber(userId, base) {
  const prefix = `${base}-${new Date().getFullYear()}-`;
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

// Taux de TVA d'un brouillon selon le régime actuel du profil : 0 hors TVA, sinon le taux
// choisi (ou le taux par défaut). Renvoie { rate } ou { error }.
async function resolveVatRate(userId, vatRate) {
  const { rows } = await pool.query('SELECT vat_regime, default_vat_rate FROM users WHERE id = $1', [userId]);
  const user = rows[0];
  if (user.vat_regime !== 'subject') return { rate: 0 };
  const rate = isBlank(vatRate) ? Number(user.default_vat_rate) : Number(vatRate);
  if (!VAT_RATES.includes(rate)) return { error: 'Taux de TVA non valide' };
  return { rate };
}

async function loadOwned(id, userId) {
  const { rows } = await pool.query(
    'SELECT id, type, status, client_id, vat_rate, invoice_number FROM invoices WHERE id = $1 AND user_id = $2',
    [id, userId]
  );
  return rows[0];
}

const LOCKED_MESSAGE =
  'Une facture émise ne peut plus être modifiée ni supprimée. Pour l\'annuler ou la corriger, crée un avoir.';

router.get('/', asyncHandler(async (req, res) => {
  res.json({ invoices: await fetchRows(req.userId) });
}));

// Création d'un BROUILLON : pas de numéro, modifiable et supprimable jusqu'à l'émission.
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

  const vat = await resolveVatRate(req.userId, vatRate);
  if (vat.error) return res.status(400).json({ message: vat.error });

  const result = await pool.query(
    `INSERT INTO invoices (user_id, client_id, agreement_id, status, title, description, amount, vat_rate, due_date, service_date)
     VALUES ($1, $2, $3, 'draft', $4, $5, $6, $7, $8, $9) RETURNING id`,
    [req.userId, clientId, agreementId || null, title.trim(), description || null, amount, vat.rate, dueDate, serviceDate]
  );
  const [invoice] = await fetchRows(req.userId, result.rows[0].id);
  res.status(201).json({ invoice });
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

  const existing = await loadOwned(req.params.id, req.userId);
  if (!existing) return res.status(404).json({ message: 'Facture introuvable' });
  if (existing.type !== 'invoice' || existing.status !== 'draft') {
    return res.status(400).json({ message: LOCKED_MESSAGE });
  }

  const vat = await resolveVatRate(req.userId, vatRate);
  if (vat.error) return res.status(400).json({ message: vat.error });

  await pool.query(
    `UPDATE invoices SET title = $1, description = $2, amount = $3, vat_rate = $4, due_date = $5, service_date = $6
     WHERE id = $7 AND user_id = $8 AND status = 'draft'`,
    [title.trim(), description || null, amount, vat.rate, dueDate, serviceDate, req.params.id, req.userId]
  );
  const [invoice] = await fetchRows(req.userId, req.params.id);
  res.json({ invoice });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const existing = await loadOwned(req.params.id, req.userId);
  if (!existing) return res.status(404).json({ message: 'Facture introuvable' });
  if (existing.type !== 'invoice' || existing.status !== 'draft') {
    return res.status(400).json({ message: LOCKED_MESSAGE });
  }
  await pool.query("DELETE FROM invoices WHERE id = $1 AND user_id = $2 AND status = 'draft'", [
    req.params.id,
    req.userId,
  ]);
  res.status(204).send();
}));

// Émission : attribue le numéro définitif, fige l'émetteur et le client, verrouille la facture.
router.post('/:id/issue', asyncHandler(async (req, res) => {
  const draft = await loadOwned(req.params.id, req.userId);
  if (!draft) return res.status(404).json({ message: 'Facture introuvable' });
  if (draft.type !== 'invoice' || draft.status !== 'draft') {
    return res.status(400).json({ message: 'Cette facture est déjà émise.' });
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
    [draft.client_id, req.userId]
  );
  const client = clientResult.rows[0];
  if (!client.address) {
    return res.status(400).json({
      message: "Ajoute l'adresse de facturation de ce client (page Clients) avant d'émettre la facture.",
    });
  }

  const rate = Number(draft.vat_rate);
  const rateMatchesRegime = user.vat_regime === 'subject' ? VAT_RATES.includes(rate) : rate === 0;
  if (!rateMatchesRegime) {
    return res.status(400).json({
      message: 'Le taux de TVA de ce brouillon ne correspond plus à ton régime de TVA. Modifie le brouillon puis réessaie.',
    });
  }

  const number = await nextNumber(req.userId, 'FA');
  const result = await pool.query(
    `UPDATE invoices SET status = 'pending', invoice_number = $1, issued_at = now(), seller_info = $2, client_info = $3
     WHERE id = $4 AND user_id = $5 AND status = 'draft' RETURNING id`,
    [number, JSON.stringify(buildSellerSnapshot(user)), JSON.stringify(buildClientSnapshot(client)), req.params.id, req.userId]
  );
  if (result.rows.length === 0) {
    return res.status(409).json({ message: 'Cette facture vient d\'être émise.' });
  }
  const [invoice] = await fetchRows(req.userId, req.params.id);
  res.json({ invoice });
}));

// Seule une facture émise peut être marquée payée (ni un brouillon, ni un avoir).
async function setPaid(req, res, paid) {
  const existing = await loadOwned(req.params.id, req.userId);
  if (!existing) return res.status(404).json({ message: 'Facture introuvable' });
  if (existing.type !== 'invoice' || existing.status === 'draft') {
    return res.status(400).json({ message: 'Seule une facture émise peut être marquée payée.' });
  }
  await pool.query(
    `UPDATE invoices SET status = $1, paid_at = ${paid ? 'now()' : 'NULL'} WHERE id = $2 AND user_id = $3`,
    [paid ? 'paid' : 'pending', req.params.id, req.userId]
  );
  const [invoice] = await fetchRows(req.userId, req.params.id);
  res.json({ invoice });
}

router.post('/:id/mark-paid', asyncHandler((req, res) => setPaid(req, res, true)));
router.post('/:id/mark-pending', asyncHandler((req, res) => setPaid(req, res, false)));

// Avoir : annule ou réduit une facture émise. Le total des avoirs ne peut pas dépasser la facture.
router.post('/:id/credit-note', asyncHandler(async (req, res) => {
  const reason = req.body.reason ? String(req.body.reason).trim() : '';
  if (!reason) return res.status(400).json({ message: "Indique le motif de l'avoir" });
  if (reason.length > 500) return res.status(400).json({ message: 'Motif : 500 caractères maximum' });

  const result = await pool.query(
    `SELECT i.*, COALESCE((SELECT SUM(x.amount) FROM invoices x
                           WHERE x.credited_invoice_id = i.id AND x.type = 'credit_note'), 0) AS credited_ht
     FROM invoices i
     WHERE i.id = $1 AND i.user_id = $2`,
    [req.params.id, req.userId]
  );
  const invoice = result.rows[0];
  if (!invoice) return res.status(404).json({ message: 'Facture introuvable' });
  if (invoice.type !== 'invoice' || invoice.status === 'draft') {
    return res.status(400).json({ message: 'Un avoir ne peut porter que sur une facture émise.' });
  }

  const remainingCents = Math.round(Number(invoice.amount) * 100) - Math.round(Number(invoice.credited_ht) * 100);
  if (remainingCents <= 0) {
    return res.status(400).json({ message: 'Cette facture est déjà entièrement annulée.' });
  }

  let amountCents = remainingCents;
  if (!isBlank(req.body.amount)) {
    const amount = parseAmount(req.body.amount);
    if (amount === null) return res.status(400).json({ message: "Montant de l'avoir invalide" });
    amountCents = Math.round(amount * 100);
    if (amountCents > remainingCents) {
      return res.status(400).json({
        message: `Le montant de l'avoir dépasse ce qui reste à créditer (${(remainingCents / 100).toFixed(2)} € HT).`,
      });
    }
  }

  const number = await nextNumber(req.userId, 'AV');
  const inserted = await pool.query(
    `INSERT INTO invoices (user_id, client_id, agreement_id, type, status, invoice_number, title, description,
       amount, vat_rate, issued_at, seller_info, client_info, credited_invoice_id)
     VALUES ($1, $2, NULL, 'credit_note', 'issued', $3, $4, $5, $6, $7, now(), $8, $9, $10) RETURNING id`,
    [
      req.userId, invoice.client_id, number, `Avoir sur facture ${invoice.invoice_number}`, reason,
      amountCents / 100, invoice.vat_rate,
      invoice.seller_info ? JSON.stringify(invoice.seller_info) : null,
      invoice.client_info ? JSON.stringify(invoice.client_info) : null,
      invoice.id,
    ]
  );
  const [creditNote] = await fetchRows(req.userId, inserted.rows[0].id);
  res.status(201).json({ invoice: creditNote });
}));

router.get('/:id/pdf', asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT i.*, c.name AS client_name, c.company AS client_company, c.email AS client_email,
            u.full_name AS freelance_name, u.email AS freelance_email,
            orig.invoice_number AS orig_number, COALESCE(orig.issued_at, orig.created_at) AS orig_date
     FROM invoices i
     JOIN clients c ON c.id = i.client_id
     JOIN users u ON u.id = i.user_id
     LEFT JOIN invoices orig ON orig.id = i.credited_invoice_id
     WHERE i.id = $1 AND i.user_id = $2`,
    [req.params.id, req.userId]
  );
  const row = result.rows[0];
  if (!row) {
    return res.status(404).json({ message: 'Facture introuvable' });
  }
  if (row.status === 'draft') {
    return res.status(400).json({ message: 'Émets d\'abord la facture pour obtenir son PDF définitif.' });
  }

  // Les documents utilisent la copie figée de l'émetteur/client faite à l'émission.
  // Repli minimal pour d'éventuelles factures créées avant l'ajout des mentions légales.
  const seller = row.seller_info || { name: row.freelance_name || row.freelance_email, email: row.freelance_email };
  const client = row.client_info || { name: row.client_name, company: row.client_company, email: row.client_email };
  const original = row.orig_number ? { number: row.orig_number, date: row.orig_date } : null;

  const pdfBuffer = await generateInvoicePdf({ invoice: row, seller, client, original });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${row.invoice_number}.pdf"`);
  res.send(pdfBuffer);
}));

module.exports = router;
