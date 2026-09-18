const pool = require('../db');

function hasAccess(user) {
  if (user.subscription_status === 'active') return true;
  if (user.subscription_status === 'trialing' && new Date(user.trial_ends_at) > new Date()) return true;
  return false;
}

async function requireSubscription(req, res, next) {
  const result = await pool.query('SELECT subscription_status, trial_ends_at FROM users WHERE id = $1', [
    req.userId,
  ]);
  const user = result.rows[0];
  if (!user || !hasAccess(user)) {
    return res.status(402).json({
      message: "Ton essai gratuit est terminé. Abonne-toi pour continuer à utiliser l'application.",
      code: 'SUBSCRIPTION_REQUIRED',
    });
  }
  next();
}

module.exports = { requireSubscription, hasAccess };
