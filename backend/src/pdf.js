const PDFDocument = require('pdfkit');

function formatDate(date) {
  return new Date(date).toLocaleDateString('fr-FR');
}

function generateInvoicePdf({ invoice, client, freelance }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(20).text('FACTURE', { align: 'right' });
    doc.fontSize(10).fillColor('#555').text(invoice.invoice_number, { align: 'right' });
    doc.fillColor('#000');
    doc.moveDown(2);

    doc.fontSize(12).text(freelance.full_name || freelance.email);
    doc.fontSize(10).fillColor('#555').text(freelance.email);
    doc.fillColor('#000');
    doc.moveDown();

    doc.fontSize(11).text('Facturé à :');
    doc.fontSize(12).text(client.name);
    if (client.company) doc.fontSize(10).fillColor('#555').text(client.company);
    if (client.email) doc.fontSize(10).fillColor('#555').text(client.email);
    doc.fillColor('#000');
    doc.moveDown();

    doc.fontSize(10).text(`Date d'émission : ${formatDate(invoice.created_at)}`);
    if (invoice.due_date) {
      doc.text(`Échéance : ${formatDate(invoice.due_date)}`);
    }
    doc.moveDown(2);

    doc.fontSize(14).text(invoice.title);
    if (invoice.description) {
      doc.moveDown(0.5);
      doc.fontSize(11).fillColor('#333').text(invoice.description);
      doc.fillColor('#000');
    }
    doc.moveDown(2);

    const amount = Number(invoice.amount).toFixed(2);
    doc.fontSize(16).text(`Total : ${amount} €`, { align: 'right' });

    doc.moveDown(2);
    doc.fontSize(9).fillColor('#888').text(
      invoice.status === 'paid' ? `Payée le ${formatDate(invoice.paid_at)}` : 'En attente de paiement',
      { align: 'right' }
    );

    doc.end();
  });
}

module.exports = { generateInvoicePdf };
