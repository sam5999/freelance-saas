// Règles liées aux mentions légales des factures (France).

// Taux de TVA acceptés : métropole (20, 10, 5,5, 2,1) et DOM (8,5, 1,05).
const VAT_RATES = [20, 10, 5.5, 2.1, 8.5, 1.05];

const LEGAL_FORMS = {
  EI: 'Entrepreneur individuel (EI)',
  EURL: 'EURL',
  SASU: 'SASU',
  SARL: 'SARL',
  SAS: 'SAS',
  AUTRE: 'Autre société',
};

// Formes de société pour lesquelles le capital social est obligatoire sur la facture.
const FORMS_WITH_CAPITAL = ['EURL', 'SASU', 'SARL', 'SAS'];

// Liste des informations manquantes pour pouvoir émettre une facture conforme.
// "user" = ligne de la table users.
function missingProfileFields(user) {
  const missing = [];
  const isEI = user.legal_form === 'EI';

  if (!user.legal_form) missing.push('forme juridique');
  if (isEI && !user.full_name) missing.push('nom complet');
  if (user.legal_form && !isEI && !user.business_name) missing.push('dénomination sociale');
  if (!user.address) missing.push('adresse');
  if (!user.siret) missing.push('SIRET');
  if (FORMS_WITH_CAPITAL.includes(user.legal_form) && !user.share_capital) missing.push('capital social');
  if (!user.vat_regime) missing.push('régime de TVA');
  if (user.vat_regime === 'subject' && !user.vat_number) missing.push('numéro de TVA intracommunautaire');

  return missing;
}

// Copie figée de l'émetteur, enregistrée avec la facture au moment de sa création.
function buildSellerSnapshot(user) {
  const isEI = user.legal_form === 'EI';
  return {
    name: isEI ? user.full_name : user.business_name,
    tradeName: isEI ? user.business_name || null : null,
    legalForm: user.legal_form,
    shareCapital: user.share_capital || null,
    address: user.address,
    siret: user.siret,
    phone: user.phone || null,
    email: user.email,
    vatRegime: user.vat_regime,
    vatNumber: user.vat_regime === 'subject' ? user.vat_number : null,
    vatOnDebits: user.vat_regime === 'subject' ? Boolean(user.vat_on_debits) : false,
    paymentInfo: user.payment_info || null,
    legalNotes: user.legal_notes || null,
  };
}

function buildClientSnapshot(client) {
  return {
    name: client.name,
    company: client.company || null,
    email: client.email || null,
    address: client.address,
    siret: client.siret || null,
  };
}

module.exports = {
  VAT_RATES,
  LEGAL_FORMS,
  FORMS_WITH_CAPITAL,
  missingProfileFields,
  buildSellerSnapshot,
  buildClientSnapshot,
};
