import { useState } from 'react';

const EMPTY = { clientId: '', title: '', description: '', amount: '' };

export default function AgreementForm({ clients, initialValues, onSubmit, onCancel }) {
  const [form, setForm] = useState(initialValues || EMPTY);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

  const isEditing = Boolean(initialValues);

  return (
    <form className="client-form" onSubmit={handleSubmit}>
      {error && <p className="error">{error}</p>}
      <label>
        Client *
        <select
          required
          disabled={isEditing}
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
      <label>
        Titre de la mission *
        <input
          type="text"
          required
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
      </label>
      <label>
        Description / conditions
        <textarea
          rows={4}
          value={form.description || ''}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
      </label>
      <label>
        Montant (€)
        <input
          type="number"
          step="0.01"
          min="0"
          value={form.amount || ''}
          onChange={(e) => setForm({ ...form, amount: e.target.value })}
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
