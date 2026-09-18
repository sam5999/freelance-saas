import { useState } from 'react';

const EMPTY = { name: '', email: '', company: '', phone: '' };

export default function ClientForm({ initialValues, onSubmit, onCancel }) {
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

  return (
    <form className="client-form" onSubmit={handleSubmit}>
      {error && <p className="error">{error}</p>}
      <label>
        Nom *
        <input
          type="text"
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
      </label>
      <label>
        Email
        <input
          type="email"
          value={form.email || ''}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
      </label>
      <label>
        Entreprise
        <input
          type="text"
          value={form.company || ''}
          onChange={(e) => setForm({ ...form, company: e.target.value })}
        />
      </label>
      <label>
        Téléphone
        <input
          type="tel"
          value={form.phone || ''}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
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
