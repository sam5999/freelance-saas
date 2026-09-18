const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'onboarding@resend.dev';

async function sendAgreementConfirmationEmail({ to, freelanceName, clientName, title, amount, confirmUrl }) {
  const subject = `${freelanceName} vous demande de confirmer : ${title}`;
  const amountLine = amount ? `<p><strong>Montant :</strong> ${amount} €</p>` : '';
  const html = `
    <p>Bonjour ${clientName},</p>
    <p>${freelanceName} vous propose l'accord suivant :</p>
    <h3>${title}</h3>
    ${amountLine}
    <p>Merci de cliquer sur le lien ci-dessous pour confirmer votre accord :</p>
    <p><a href="${confirmUrl}">${confirmUrl}</a></p>
  `;

  if (!RESEND_API_KEY) {
    console.log('--- [MODE SIMULATION - aucun service email configuré] ---');
    console.log(`Destinataire : ${to}`);
    console.log(`Sujet : ${subject}`);
    console.log(`Lien de confirmation : ${confirmUrl}`);
    console.log('-----------------------------------------------------------');
    return { simulated: true };
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: EMAIL_FROM, to, subject, html }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Échec de l'envoi de l'email : ${errText}`);
  }
  return res.json();
}

module.exports = { sendAgreementConfirmationEmail };
