const PDFDocument = require('pdfkit');
const { LEGAL_FORMS } = require('./legal');

const GRAY = '#555555';
const LEFT = 50;
const WIDTH = 495;

function formatDate(date) {
  return new Date(date).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' });
}

// Format français ("1 500,00 €"). Les espaces insécables sont remplacés par des espaces
// simples car la police standard des PDF ne sait pas les afficher.
function money(cents) {
  return (cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }).replace(/[  ]/g, ' ');
}

function formatSiret(siret) {
  const digits = String(siret).replace(/\s/g, '');
  return digits.length === 14 ? `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}` : siret;
}

function sellerBlock(seller) {
  const isEI = seller.legalForm === 'EI';
  const capital = seller.shareCapital ? String(seller.shareCapital).replace(/\s*€\s*$/, '') : null;
  const lines = [];

  if (isEI) {
    if (seller.tradeName) lines.push(seller.tradeName);
    lines.push(LEGAL_FORMS.EI);
  } else if (seller.legalForm && seller.legalForm !== 'AUTRE' && LEGAL_FORMS[seller.legalForm]) {
    lines.push(LEGAL_FORMS[seller.legalForm] + (capital ? ` au capital de ${capital} €` : ''));
  } else if (capital) {
    lines.push(`Capital social : ${capital} €`);
  }
  if (seller.address) lines.push(seller.address);
  if (seller.siret) lines.push(`SIRET : ${formatSiret(seller.siret)}`);
  if (seller.vatNumber) lines.push(`N° TVA intracommunautaire : ${seller.vatNumber}`);
  if (seller.phone) lines.push(`Tél. : ${seller.phone}`);
  if (seller.email) lines.push(seller.email);
  return { name: seller.name || seller.email, lines };
}

function clientBlock(client) {
  const lines = [];
  if (client.company) lines.push(`À l'attention de ${client.name}`);
  if (client.address) lines.push(client.address);
  if (client.siret) {
    const isSiren = client.siret.length === 9;
    lines.push(`${isSiren ? 'SIREN' : 'SIRET'} : ${isSiren ? client.siret.replace(/(\d{3})(?=\d)/g, '$1 ') : formatSiret(client.siret)}`);
  }
  if (client.email) lines.push(client.email);
  return { name: client.company || client.name, lines };
}

// Dessine un bloc (émetteur ou client) et renvoie la position verticale où il se termine.
function drawParty(doc, label, party, x, y, width) {
  doc.font('Helvetica').fontSize(8).fillColor(GRAY).text(label, x, y, { width });
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#000').text(party.name, x, doc.y + 2, { width });
  doc.font('Helvetica').fontSize(9.5).fillColor('#333');
  party.lines.forEach((line) => doc.text(line, x, doc.y + 1, { width }));
  return doc.y;
}

function ensureSpace(doc, height) {
  if (doc.y + height > doc.page.height - doc.page.margins.bottom) doc.addPage();
}

function generateInvoicePdf({ invoice, seller, client }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const rate = Number(invoice.vat_rate);
    const isSubject = seller.vatRegime === 'subject';
    const htCents = Math.round(Number(invoice.amount) * 100);
    const vatCents = Math.round((htCents * rate) / 100);
    const ttcCents = htCents + vatCents;

    // En-tête : titre et numéro à gauche, dates à droite
    doc.font('Helvetica-Bold').fontSize(22).fillColor('#000').text('FACTURE', LEFT, 50);
    doc.font('Helvetica').fontSize(10).fillColor(GRAY).text(`N° ${invoice.invoice_number}`, LEFT, 78);

    const dates = [`Date d'émission : ${formatDate(invoice.created_at)}`];
    if (invoice.service_date) dates.push(`Date de la prestation : ${formatDate(invoice.service_date)}`);
    dates.push(invoice.due_date ? `Date d'échéance : ${formatDate(invoice.due_date)}` : "Échéance : à réception de facture");
    doc.font('Helvetica').fontSize(10).fillColor('#000').text(dates.join('\n'), 300, 50, { width: 245, align: 'right' });

    // Émetteur et client
    const top = 130;
    const sellerBottom = drawParty(doc, 'ÉMETTEUR', sellerBlock(seller), LEFT, top, 230);
    const clientBottom = drawParty(doc, 'FACTURÉ À', clientBlock(client), 315, top, 230);

    doc.font('Helvetica').fontSize(9.5).fillColor('#333');
    doc.text("Nature de l'opération : prestation de services", LEFT, Math.max(sellerBottom, clientBottom) + 18, { width: WIDTH });

    // Tableau (une ligne : la prestation)
    const headerY = doc.y + 16;
    doc.rect(LEFT, headerY, WIDTH, 22).fill('#eeeeee');
    doc.fillColor('#000').font('Helvetica-Bold').fontSize(9);
    doc.text('Désignation', LEFT + 8, headerY + 7, { width: 260 });
    doc.text('Total HT', 320, headerY + 7, { width: 75, align: 'right' });
    doc.text('TVA', 400, headerY + 7, { width: 40, align: 'right' });
    doc.text('Total TTC', 445, headerY + 7, { width: 92, align: 'right' });

    const rowY = headerY + 32;
    doc.font('Helvetica-Bold').fontSize(10);
    const titleHeight = doc.heightOfString(invoice.title, { width: 260 });
    doc.text(invoice.title, LEFT + 8, rowY, { width: 260 });
    let rowBottom = rowY + titleHeight;
    if (invoice.description) {
      doc.font('Helvetica').fontSize(9).fillColor('#333');
      doc.text(invoice.description, LEFT + 8, rowBottom + 3, { width: 260 });
      rowBottom = doc.y;
    }
    doc.font('Helvetica').fontSize(10).fillColor('#000');
    doc.text(money(htCents), 320, rowY, { width: 75, align: 'right' });
    doc.text(isSubject ? `${String(rate).replace('.', ',')} %` : '—', 400, rowY, { width: 40, align: 'right' });
    doc.text(money(ttcCents), 445, rowY, { width: 92, align: 'right' });

    const lineY = rowBottom + 12;
    doc.moveTo(LEFT, lineY).lineTo(LEFT + WIDTH, lineY).strokeColor('#dddddd').stroke();

    // Totaux
    let y = lineY + 14;
    const totalRow = (label, value, bold) => {
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 12 : 10).fillColor('#000');
      doc.text(label, 330, y, { width: 110 });
      doc.text(value, 440, y, { width: 97, align: 'right' });
      y += bold ? 20 : 16;
    };
    totalRow('Total HT', money(htCents), false);
    if (isSubject) totalRow(`TVA (${String(rate).replace('.', ',')} %)`, money(vatCents), false);
    totalRow('Total TTC', money(ttcCents), true);

    // Mentions liées à la TVA
    doc.x = LEFT;
    doc.y = y + 4;
    doc.font('Helvetica').fontSize(9).fillColor('#333');
    if (!isSubject) doc.text('TVA non applicable, art. 293 B du CGI', LEFT, doc.y, { width: WIDTH });
    if (isSubject && seller.vatOnDebits) {
      doc.text("Option pour le paiement de la TVA d'après les débits.", LEFT, doc.y, { width: WIDTH });
    }

    // Conditions de paiement
    ensureSpace(doc, 120);
    doc.moveDown(1.2);
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#000').text('Conditions de paiement', LEFT, doc.y, { width: WIDTH });
    doc.font('Helvetica').fontSize(9).fillColor('#333');
    doc.text(
      invoice.due_date ? `Date d'échéance : ${formatDate(invoice.due_date)}.` : 'Paiement à réception de facture.',
      LEFT, doc.y + 2, { width: WIDTH }
    );
    doc.text('Escompte pour paiement anticipé : néant.', LEFT, doc.y, { width: WIDTH });
    doc.text(
      "Pénalités de retard : 3 fois le taux d'intérêt légal, exigibles sans rappel. " +
        'Indemnité forfaitaire pour frais de recouvrement en cas de retard de paiement (clients professionnels) : 40 €.',
      LEFT, doc.y, { width: WIDTH }
    );

    if (seller.paymentInfo) {
      ensureSpace(doc, 60);
      doc.moveDown(0.8);
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#000').text('Modalités de paiement', LEFT, doc.y, { width: WIDTH });
      doc.font('Helvetica').fontSize(9).fillColor('#333').text(seller.paymentInfo, LEFT, doc.y + 2, { width: WIDTH });
    }
    if (seller.legalNotes) {
      ensureSpace(doc, 50);
      doc.moveDown(0.8);
      doc.font('Helvetica').fontSize(8.5).fillColor(GRAY).text(seller.legalNotes, LEFT, doc.y, { width: WIDTH });
    }

    if (invoice.status === 'paid' && invoice.paid_at) {
      ensureSpace(doc, 30);
      doc.moveDown(1);
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#0a7a3f').text(`Facture acquittée le ${formatDate(invoice.paid_at)}`, LEFT, doc.y, {
        width: WIDTH,
      });
    }

    doc.end();
  });
}

module.exports = { generateInvoicePdf };
