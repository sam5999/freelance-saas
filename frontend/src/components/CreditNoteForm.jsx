import { useState } from 'react';

// Formulaire de création d'un avoir sur une facture émise.
// "remainingHt" = montant HT encore créditable sur cette facture.
export default function CreditNoteForm({ invoice, remainingHt, onSubmit, onCancel }) {
  const [amount, setAmount] = useState(remainingHt.toFixed(2));
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await onSubmit({ amount, reason });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="client-form" onSubmit={handleSubmit}>
      <h2 style={{ margin: 0, fontSize: 18 }}>Avoir sur la facture {invoice.invoice_number}</h2>
      <p className="muted" style={{ margin: 0 }}>
        Un avoir est un document définitif : il ne pourra ni être modifié ni supprimé. Il annule la facture en
        totalité ou en partie.
      </p>
      {error && <p className="error">{error}</p>}
      <label>
        Montant HT à créditer (€), maximum {remainingHt.toFixed(2)} €
        <input
          type="number"
          step="0.01"
          min="0.01"
          max={remainingHt}
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </label>
      <label>
        Motif *
        <textarea
          rows={3}
          required
          maxLength={500}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </label>
      <div className="form-actions">
        <button type="submit" disabled={submitting}>
          {submitting ? 'Création...' : "Émettre l'avoir"}
        </button>
        <button type="button" className="secondary" onClick={onCancel}>
          Annuler
        </button>
      </div>
    </form>
  );
}
