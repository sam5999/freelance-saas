import { useState } from 'react';

const VAT_RATES = [20, 10, 5.5, 2.1, 8.5, 1.05];

function formatRate(rate) {
  return String(rate).replace('.', ',');
}

export default function InvoiceForm({ clients, agreements, profile, initialValues, onSubmit, onCancel }) {
  const isEditing = Boolean(initialValues);
  // Le taux de TVA n'est proposé que si le freelance est assujetti à la TVA.
  const showVat = profile?.vatRegime === 'subject';
  const defaultRate = profile?.defaultVatRate ?? 20;
  const [form, setForm] = useState(() => {
    if (initialValues) {
      // Un brouillon créé avant un changement de régime peut avoir un taux qui n'est plus proposé.
      const rate = VAT_RATES.includes(Number(initialValues.vatRate)) ? Number(initialValues.vatRate) : defaultRate;
      return { ...initialValues, vatRate: rate };
    }
    return {
      agreementId: '',
      clientId: '',
      title: '',
      description: '',
      amount: '',
      vatRate: defaultRate,
      serviceDate: '',
      dueDate: '',
    };
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const ht = Number(form.amount) || 0;
  const rate = showVat ? Number(form.vatRate) : 0;
  const ttc = Math.round(ht * (1 + rate / 100) * 100) / 100;

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
        Désignation de la prestation *
        <input
          type="text"
          required
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
      </label>
      <label>
        Détail (optionnel)
        <textarea
          rows={3}
          value={form.description || ''}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
      </label>
      <label>
        Montant HT (€) *
        <input
          type="number"
          step="0.01"
          min="0.01"
          required
          value={form.amount || ''}
          onChange={(e) => setForm({ ...form, amount: e.target.value })}
        />
      </label>

      {showVat && (
        <label>
          Taux de TVA
          <select value={form.vatRate} onChange={(e) => setForm({ ...form, vatRate: Number(e.target.value) })}>
            {VAT_RATES.map((r) => (
              <option key={r} value={r}>
                {formatRate(r)} %
              </option>
            ))}
          </select>
        </label>
      )}

      <p className="muted" style={{ margin: 0 }}>
        {showVat ? `Total TTC : ${ttc.toFixed(2)} €` : `Total : ${ttc.toFixed(2)} € (TVA non applicable)`}
      </p>

      <label>
        Date de la prestation (si différente de la date d'émission)
        <input
          type="date"
          value={form.serviceDate || ''}
          onChange={(e) => setForm({ ...form, serviceDate: e.target.value })}
        />
      </label>
      <label>
        Date d'échéance de paiement
        <input
          type="date"
          value={form.dueDate || ''}
          onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
        />
      </label>
      <div className="form-actions">
        <button type="submit" disabled={submitting}>
          {submitting ? 'Enregistrement...' : 'Enregistrer le brouillon'}
        </button>
        <button type="button" className="secondary" onClick={onCancel}>
          Annuler
        </button>
      </div>
    </form>
  );
}
