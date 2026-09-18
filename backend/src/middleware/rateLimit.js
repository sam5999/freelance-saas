const rateLimit = require('express-rate-limit');

const tooMany = { message: 'Trop de tentatives, réessaie dans quelques minutes.' };

// Seules les tentatives échouées comptent : un vrai utilisateur qui se connecte
// normalement n'est jamais bloqué, mais deviner un mot de passe devient impraticable.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: tooMany,
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: tooMany,
});

module.exports = { loginLimiter, registerLimiter };
