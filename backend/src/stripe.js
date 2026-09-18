const Stripe = require('stripe');

// Une fausse clé en attendant que STRIPE_SECRET_KEY soit configurée dans .env,
// pour que le serveur démarre même sans compte Stripe branché encore.
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');

module.exports = stripe;
