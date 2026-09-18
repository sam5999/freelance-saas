const express = require('express');
const pool = require('../db');
const requireAuth = require('../middleware/auth');
const { requireSubscription } = require('../middleware/subscription');
const asyncHandler = require('../asyncHandler');
const { VAT_RATES, LEGAL_FORMS, missingProfileFields } = require('../legal');

const router = express.Router();
router.use(requireAuth);
router.use(requireSubscription);

const COLUMNS = `full_name, email, business_name, legal_form, address, siret, share_capital, phone,
  vat_regime, vat_number, default_vat_rate, vat_on_debits, payment_info, legal_notes`;

function toProfile(row) {
  return {
    fullName: row.full_name,
    email: row.email,
    businessName: row.business_name,
    legalForm: row.legal_form,
    address: row.address,
    siret: row.siret,
    shareCapital: row.share_capital,
    phone: row.phone,
    vatRegime: row.vat_regime,
    vatNumber: row.vat_number,
    defaultVatRate: Number(row.default_vat_rate),
    vatOnDebits: row.vat_on_debits,
    paymentInfo: row.payment_info,
    legalNotes: row.legal_notes,
  };
}

// Texte vide -> null, espaces superflus retirés.
function clean(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text === '' ? null : text;
}

router.get('/', asyncHandler(async (req, res) => {
  const result = await pool.query(`SELECT ${COLUMNS} FROM users WHERE id = $1`, [req.userId]);
  const row = result.rows[0];
  res.json({ profile: toProfile(row), missingFields: missingProfileFields(row) });
}));

router.put('/', asyncHandler(async (req, res) => {
  const body = req.body;

  const fullName = clean(body.fullName);
  const businessName = clean(body.businessName);
  const legalForm = clean(body.legalForm);
  const address = clean(body.address);
  const shareCapital = clean(body.shareCapital);
  const phone = clean(body.phone);
  const vatRegime = clean(body.vatRegime);
  const paymentInfo = clean(body.paymentInfo);
  const legalNotes = clean(body.legalNotes);
  const siret = clean(body.siret)?.replace(/\s/g, '') ?? null;
  const vatNumber = clean(body.vatNumber)?.replace(/\s/g, '').toUpperCase() ?? null;
  const vatOnDebits = Boolean(body.vatOnDebits);
  const defaultVatRate = body.defaultVatRate === undefined || body.defaultVatRate === '' ? 20 : Number(body.defaultVatRate);

  if (legalForm && !LEGAL_FORMS[legalForm]) {
    return res.status(400).json({ message: 'Forme juridique inconnue' });
  }
  if (vatRegime && !['franchise', 'subject'].includes(vatRegime)) {
    return res.status(400).json({ message: 'Régime de TVA inconnu' });
  }
  if (!VAT_RATES.includes(defaultVatRate)) {
    return res.status(400).json({ message: 'Taux de TVA non valide' });
  }
  if (siret && !/^\d{14}$/.test(siret)) {
    return res.status(400).json({ message: 'Le SIRET doit contenir exactement 14 chiffres' });
  }
  if (vatNumber && !/^[A-Z]{2}[A-Z0-9]{2,12}$/.test(vatNumber)) {
    return res.status(400).json({ message: 'Numéro de TVA invalide (exemple : FR12345678901)' });
  }
  const limits = [
    ['Nom complet', fullName, 255],
    ['Dénomination', businessName, 255],
    ['Capital social', shareCapital, 50],
    ['Téléphone', phone, 50],
    ['Adresse', address, 500],
    ['Modalités de paiement', paymentInfo, 1000],
    ['Autres mentions', legalNotes, 1000],
  ];
  for (const [label, value, max] of limits) {
    if (value && value.length > max) {
      return res.status(400).json({ message: `${label} : ${max} caractères maximum` });
    }
  }

  const result = await pool.query(
    `UPDATE users SET full_name = $1, business_name = $2, legal_form = $3, address = $4, siret = $5,
       share_capital = $6, phone = $7, vat_regime = $8, vat_number = $9, default_vat_rate = $10,
       vat_on_debits = $11, payment_info = $12, legal_notes = $13
     WHERE id = $14
     RETURNING ${COLUMNS}`,
    [
      fullName, businessName, legalForm, address, siret, shareCapital, phone, vatRegime, vatNumber,
      defaultVatRate, vatOnDebits, paymentInfo, legalNotes, req.userId,
    ]
  );
  const row = result.rows[0];
  res.json({ profile: toProfile(row), missingFields: missingProfileFields(row) });
}));

module.exports = router;
