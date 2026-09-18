const express = require('express');
const pool = require('../db');
const requireAuth = require('../middleware/auth');
const asyncHandler = require('../asyncHandler');
const stripe = require('../stripe');
const { hasAccess } = require('../middleware/subscription');

const router = express.Router();
router.use(requireAuth);

router.get('/status', asyncHandler(async (req, res) => {
  const result = await pool.query(
    'SELECT subscription_status, trial_ends_at, current_period_end FROM users WHERE id = $1',
    [req.userId]
  );
  const user = result.rows[0];
  res.json({
    status: user.subscription_status,
    trialEndsAt: user.trial_ends_at,
    currentPeriodEnd: user.current_period_end,
    hasAccess: hasAccess(user),
  });
}));

router.post('/checkout', asyncHandler(async (req, res) => {
  const result = await pool.query('SELECT id, email, stripe_customer_id FROM users WHERE id = $1', [req.userId]);
  const user = result.rows[0];

  let customerId = user.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { userId: String(user.id) },
    });
    customerId = customer.id;
    await pool.query('UPDATE users SET stripe_customer_id = $1 WHERE id = $2', [customerId, user.id]);
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
    success_url: `${process.env.FRONTEND_URL}/subscribe?success=true`,
    cancel_url: `${process.env.FRONTEND_URL}/subscribe?canceled=true`,
    metadata: { userId: String(user.id) },
  });

  res.json({ url: session.url });
}));

router.post('/portal', asyncHandler(async (req, res) => {
  const result = await pool.query('SELECT stripe_customer_id FROM users WHERE id = $1', [req.userId]);
  const customerId = result.rows[0]?.stripe_customer_id;
  if (!customerId) {
    return res.status(400).json({ message: 'Aucun abonnement à gérer pour le moment' });
  }
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${process.env.FRONTEND_URL}/subscribe`,
  });
  res.json({ url: session.url });
}));

module.exports = router;
