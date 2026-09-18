require('dotenv').config();

// En production, on préfère un serveur qui refuse de démarrer plutôt qu'un serveur
// qui tourne à moitié configuré (paiements ou emails qui échouent en silence).
if (process.env.NODE_ENV === 'production') {
  const required = [
    'DATABASE_URL',
    'JWT_SECRET',
    'FRONTEND_URL',
    'STRIPE_SECRET_KEY',
    'STRIPE_PRICE_ID',
    'STRIPE_WEBHOOK_SECRET',
    'RESEND_API_KEY',
    'EMAIL_FROM',
  ];
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    console.error(`Variables d'environnement manquantes : ${missing.join(', ')}`);
    process.exit(1);
  }
}

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const pool = require('./db');
const authRoutes = require('./routes/auth');
const clientsRoutes = require('./routes/clients');
const agreementsRoutes = require('./routes/agreements');
const agreementsPublicRoutes = require('./routes/agreementsPublic');
const invoicesRoutes = require('./routes/invoices');
const dashboardRoutes = require('./routes/dashboard');
const profileRoutes = require('./routes/profile');
const subscriptionRoutes = require('./routes/subscription');
const subscriptionWebhookRoutes = require('./routes/subscriptionWebhook');

const app = express();

// L'hébergeur place un proxy devant le serveur : sans ça, tous les visiteurs
// auraient la même adresse IP aux yeux du limiteur de tentatives.
app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));

// Le webhook Stripe a besoin du corps de requête brut (non transformé en JSON)
// pour pouvoir vérifier la signature. Il doit donc être branché AVANT express.json().
app.use('/api/subscription/webhook', express.raw({ type: 'application/json' }), subscriptionWebhookRoutes);

app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/clients', clientsRoutes);
app.use('/api/agreements', agreementsRoutes);
app.use('/api/public/agreements', agreementsPublicRoutes);
app.use('/api/invoices', invoicesRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.get('/api/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() AS now');
    res.json({ status: 'ok', dbTime: result.rows[0].now });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Filet de sécurité final : si une route plante pour une raison imprévue,
// on répond avec une erreur propre au lieu de faire tomber tout le serveur.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'Erreur serveur' });
});

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Backend démarré sur http://localhost:${port}`);
});
