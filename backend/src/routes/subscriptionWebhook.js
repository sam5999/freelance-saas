const express = require('express');
const pool = require('../db');
const asyncHandler = require('../asyncHandler');
const stripe = require('../stripe');

const router = express.Router();

async function updateFromSubscription(subscription) {
  // Dans les versions récentes de l'API Stripe, la fin de période est sur chaque ligne (item).
  const periodEnd = subscription.items?.data?.[0]?.current_period_end ?? subscription.current_period_end ?? null;
  await pool.query(
    `UPDATE users SET stripe_subscription_id = $1, subscription_status = $2,
       current_period_end = CASE WHEN $3::bigint IS NULL THEN NULL ELSE to_timestamp($3::bigint) END
     WHERE stripe_customer_id = $4`,
    [subscription.id, subscription.status, periodEnd, subscription.customer]
  );
}

// express.raw() est appliqué à cette route dans index.js, avant express.json(),
// car Stripe a besoin du corps brut (non modifié) pour vérifier la signature.
router.post('/', asyncHandler(async (req, res) => {
  const signature = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Signature de webhook Stripe invalide :', err.message);
    return res.status(400).send('Signature invalide');
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      if (session.subscription) {
        const subscription = await stripe.subscriptions.retrieve(session.subscription);
        await updateFromSubscription(subscription);
      }
      break;
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      await updateFromSubscription(event.data.object);
      break;
    }
    default:
      break;
  }

  res.json({ received: true });
}));

module.exports = router;
