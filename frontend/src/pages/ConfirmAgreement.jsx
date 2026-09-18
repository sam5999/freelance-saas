import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import * as api from '../api';

export default function ConfirmAgreement() {
  const { token } = useParams();
  const [agreement, setAgreement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    api
      .getPublicAgreement(token)
      .then((data) => setAgreement(data.agreement))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleConfirm() {
    setConfirming(true);
    setError('');
    try {
      await api.confirmPublicAgreement(token);
      setAgreement((prev) => ({ ...prev, status: 'confirmed' }));
    } catch (err) {
      setError(err.message);
    } finally {
      setConfirming(false);
    }
  }

  if (loading) return <p className="muted centered">Chargement...</p>;
  if (error) return <p className="error centered">{error}</p>;
  if (!agreement) return null;

  return (
    <div className="confirm-page">
      <div className="confirm-card">
        <h1>{agreement.title}</h1>
        <p className="muted">
          Proposé par {agreement.freelance_name} à {agreement.client_name}
        </p>
        {agreement.description && <p>{agreement.description}</p>}
        {agreement.amount && (
          <p>
            <strong>Montant :</strong> {agreement.amount} €
          </p>
        )}

        {agreement.status === 'confirmed' ? (
          <p className="success">✓ Cet accord a été confirmé.</p>
        ) : (
          <button onClick={handleConfirm} disabled={confirming}>
            {confirming ? 'Confirmation...' : "Je confirme cet accord"}
          </button>
        )}
      </div>
    </div>
  );
}
