import { useState } from 'react';

const EMPTY = { agreementId: '', clientId: '', title: '', description: '', amount: '', dueDate: '' };

export default function InvoiceForm({ clients, agreements, initialValues, onSubmit, onCancel }) {
  const isEditing = Boolean(initialValues);
  const [form, setForm] = useState(initialValues || EMPTY);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function handleAgreementChange(value) {
    if (!value) {
      setForm({ ...form, agreementId: '' });
      return;
    }
    const agreement = agreements.find((a) => String(a.id) === value);
    setForm({
      ...form,
      agreementId: value,
      clientId: agreement.client_id,
      title: agreement.title,
      description: agreement.description || '',
      amount: agreement.amount || '',
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await onSubmit(form);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="client-form" onSubmit={handleSubmit}>
      {error && <p className="error">{error}</p>}

      {!isEditing && agreements.length > 0 && (
        <label>
          Pré-remplir depuis un accord confirmé (optionnel)
          <select value={form.agreementId} onChange={(e) => handleAgreementChange(e.target.value)}>
            <option value="">-- Facture manuelle --</option>
            {agreements.map((a) => (
              <option key={a.id} value={a.id}>
                {a.client_name} — {a.title}
              </option>
            ))}
          </select>
        </label>
      )}

      {!isEditing && (
        <label>
          Client *
          <select
            required
            disabled={Boolean(form.agreementId)}
            value={form.clientId}
            onChange={(e) => setForm({ ...form, clientId: e.target.value })}
          >
            <option value="">-- Choisir un client --</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <label>
        Titre *
        <input
          type="text"
          required
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
      </label>
      <label>
        Description
        <textarea
          rows={3}
          value={form.description || ''}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
      </label>
      <label>
        Montant (€) *
        <input
          type="number"
          step="0.01"
          min="0"
          required
          value={form.amount || ''}
          onChange={(e) => setForm({ ...form, amount: e.target.value })}
        />
      </label>
      <label>
        Échéance de paiement
        <input
          type="date"
          value={form.dueDate ? form.dueDate.substring(0, 10) : ''}
          onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
        />
      </label>
      <div className="form-actions">
        <button type="submit" disabled={submitting}>
          {submitting ? 'Enregistrement...' : 'Enregistrer'}
        </button>
        <button type="button" className="secondary" onClick={onCancel}>
          Annuler
        </button>
      </div>
    </form>
  );
}
