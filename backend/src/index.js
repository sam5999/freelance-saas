require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const pool = require('./db');
const authRoutes = require('./routes/auth');
const clientsRoutes = require('./routes/clients');
const agreementsRoutes = require('./routes/agreements');
const agreementsPublicRoutes = require('./routes/agreementsPublic');
const invoicesRoutes = require('./routes/invoices');
const dashboardRoutes = require('./routes/dashboard');

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRoutes);
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
