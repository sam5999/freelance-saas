import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import * as api from '../api';

function daysLeft(dateString) {
  const diffMs = new Date(dateString).getTime() - Date.now();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

export default function Subscribe() {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [redirecting, setRedirecting] = useState(false);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    api
      .getSubscriptionStatus()
      .then(setStatus)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleSubscribe() {
    setError('');
    setRedirecting(true);
    try {
      const data = await api.startCheckout();
      window.location.href = data.url;
    } catch (err) {
      setError(err.message);
      setRedirecting(false);
    }
  }

  async function handleManage() {
    setError('');
    try {
      const data = await api.openBillingPortal();
      window.location.href = data.url;
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <p className="muted centered">Chargement...</p>;

  const success = searchParams.get('success');
  const canceled = searchParams.get('canceled');

  return (
    <div className="page">
      <header>
        <h1>Abonnement</h1>
        <Link to="/dashboard">← Retour au tableau de bord</Link>
      </header>

      {success && <p className="info">Paiement en cours de confirmation. Ton accès sera activé dans quelques secondes.</p>}
      {canceled && <p className="muted">Paiement annulé.</p>}
      {error && <p className="error">{error}</p>}

      {status?.status === 'active' && (
        <div className="summary-card" style={{ maxWidth: 360 }}>
          <span className="muted">Statut</span>
          <strong>Abonnement actif ✓</strong>
          {status.currentPeriodEnd && (
            <span className="muted">Prochain renouvellement le {new Date(status.currentPeriodEnd).toLocaleDateString('fr-FR')}</span>
          )}
          <button onClick={handleManage} style={{ marginTop: 12 }}>
            Gérer mon abonnement
          </button>
        </div>
      )}

      {status?.status === 'trialing' && status.hasAccess && (
        <div className="summary-card" style={{ maxWidth: 360 }}>
          <span className="muted">Essai gratuit</span>
          <strong>{daysLeft(status.trialEndsAt)} jour(s) restant(s)</strong>
          <span className="muted">
            Se termine le {new Date(status.trialEndsAt).toLocaleDateString('fr-FR')}
          </span>
        </div>
      )}

      {status && !status.hasAccess && (
        <p className="error">Ton essai gratuit est terminé. Abonne-toi pour retrouver l'accès à l'application.</p>
      )}

      {status?.status !== 'active' && (
        <div className="client-form" style={{ marginTop: 16 }}>
          <h2 style={{ margin: 0 }}>20 € / mois</h2>
          <p className="muted">Facturation, clients, accords, factures PDF — sans engagement.</p>
          <button onClick={handleSubscribe} disabled={redirecting}>
            {redirecting ? 'Redirection...' : "S'abonner via Stripe"}
          </button>
        </div>
      )}
    </div>
  );
}
