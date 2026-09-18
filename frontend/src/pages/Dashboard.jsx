import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import * as api from '../api';

function daysLeft(dateString) {
  const diffMs = new Date(dateString).getTime() - Date.now();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [summary, setSummary] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .getDashboardSummary()
      .then(setSummary)
      .catch((err) => setError(err.message));
    api.getSubscriptionStatus().then(setSubscription).catch(() => {});
  }, []);

  return (
    <div className="dashboard">
      <header>
        <h1>Tableau de bord</h1>
        <button onClick={logout}>Se déconnecter</button>
      </header>
      <p>Bienvenue {user?.fullName || user?.email} 👋</p>

      {subscription?.status === 'trialing' && (
        <p className="info">
          Essai gratuit : {daysLeft(subscription.trialEndsAt)} jour(s) restant(s) —{' '}
          <Link to="/subscribe">s'abonner maintenant</Link>
        </p>
      )}

      <nav className="dashboard-nav">
        <Link to="/clients">Mes clients</Link>
        <Link to="/agreements">Mes accords</Link>
        <Link to="/invoices">Mes factures</Link>
        <Link to="/subscribe">Abonnement</Link>
      </nav>

      {error && <p className="error">{error}</p>}

      {summary && (
        <div className="summary-row">
          <div className="summary-card">
            <span className="muted">Clients</span>
            <strong>{summary.clientsCount}</strong>
          </div>
          <div className="summary-card">
            <span className="muted">Accords confirmés</span>
            <strong>{summary.agreements.confirmed}</strong>
            <span className="muted">
              {summary.agreements.sent} en attente de confirmation · {summary.agreements.draft} brouillon(s)
            </span>
          </div>
          <div className="summary-card">
            <span className="muted">Factures en attente</span>
            <strong>{summary.invoices.pending.total.toFixed(2)} €</strong>
            <span className="muted">{summary.invoices.pending.count} facture(s)</span>
          </div>
          <div className="summary-card">
            <span className="muted">Factures payées</span>
            <strong>{summary.invoices.paid.total.toFixed(2)} €</strong>
            <span className="muted">{summary.invoices.paid.count} facture(s)</span>
          </div>
        </div>
      )}
    </div>
  );
}
