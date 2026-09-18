// Script à usage unique : crée le produit et le prix d'abonnement dans Stripe (mode test).
// Usage : node scripts/setup-stripe.js
require('dotenv').config();
const stripe = require('../src/stripe');

async function main() {
  const product = await stripe.products.create({ name: 'Abonnement Freelance SaaS' });
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: 2000,
    currency: 'eur',
    recurring: { interval: 'month' },
  });
  console.log('Produit :', product.id);
  console.log('Prix    :', price.id);
  console.log(`\nAjoute cette ligne dans backend/.env :\nSTRIPE_PRICE_ID=${price.id}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
