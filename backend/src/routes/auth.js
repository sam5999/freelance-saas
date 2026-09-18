const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const requireAuth = require('../middleware/auth');
const asyncHandler = require('../asyncHandler');

const router = express.Router();

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax',
  secure: false, // à mettre à true une fois en production (HTTPS)
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 jours
};

function makeToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

router.post('/register', async (req, res) => {
  const { email, password, fullName } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email et mot de passe requis' });
  }
  if (password.length < 8) {
    return res.status(400).json({ message: 'Le mot de passe doit faire au moins 8 caractères' });
  }

  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ message: 'Un compte existe déjà avec cet email' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (email, password_hash, full_name) VALUES ($1, $2, $3) RETURNING id, email, full_name',
      [email, passwordHash, fullName || null]
    );
    const user = result.rows[0];

    const token = makeToken(user.id);
    res.cookie('token', token, COOKIE_OPTIONS);
    res.status(201).json({ user: { id: user.id, email: user.email, fullName: user.full_name } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email et mot de passe requis' });
  }

  try {
    const result = await pool.query('SELECT id, email, full_name, password_hash FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
    }

    const token = makeToken(user.id);
    res.cookie('token', token, COOKIE_OPTIONS);
    res.json({ user: { id: user.id, email: user.email, fullName: user.full_name } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('token', COOKIE_OPTIONS);
  res.status(204).send();
});

router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const result = await pool.query('SELECT id, email, full_name FROM users WHERE id = $1', [req.userId]);
  const user = result.rows[0];
  if (!user) {
    return res.status(404).json({ message: 'Utilisateur introuvable' });
  }
  res.json({ user: { id: user.id, email: user.email, fullName: user.full_name } });
}));

module.exports = router;
