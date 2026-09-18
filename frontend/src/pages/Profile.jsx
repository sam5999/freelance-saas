import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from '../api';

const LEGAL_FORMS = [
  { value: 'EI', label: 'Entrepreneur individuel / micro-entrepreneur (EI)' },
  { value: 'EURL', label: 'EURL' },
  { value: 'SASU', label: 'SASU' },
  { value: 'SARL', label: 'SARL' },
  { value: 'SAS', label: 'SAS' },
  { value: 'AUTRE', label: 'Autre société' },
];
const FORMS_WITH_CAPITAL = ['EURL', 'SASU', 'SARL', 'SAS'];
const VAT_RATES = [20, 10, 5.5, 2.1, 8.5, 1.05];

export default function Profile() {
  const [form, setForm] = useState(null);
  const [missing, setMissing] = useState([]);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .getProfile()
      .then((data) => {
        setForm(data.profile);
        setMissing(data.missingFields);
      })
      .catch((err) => setError(err.message));
  }, []);

  function update(field, value) {
    setSaved(false);
    setForm({ ...form, [field]: value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaved(false);
    setSaving(true);
    try {
      const data = await api.updateProfile(form);
      setForm(data.profile);
      setMissing(data.missingFields);
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!form) {
    return error ? <p className="error centered">{error}</p> : <p className="muted centered">Chargement...</p>;
  }

  const isEI = form.legalForm === 'EI';
  const needsCapital = FORMS_WITH_CAPITAL.includes(form.legalForm);
  const isSubject = form.vatRegime === 'subject';

  return (
    <div className="page">
      <header>
        <h1>Mon profil</h1>
        <Link to="/dashboard">← Retour au tableau de bord</Link>
      </header>

      <p className="muted">
        Ces informations apparaissent sur tes factures : la loi impose de les y faire figurer.
      </p>

      {missing.length > 0 ? (
        <p className="error">À compléter pour pouvoir émettre des factures : {missing.join(', ')}.</p>
      ) : (
        <p className="info">Profil complet : tu peux émettre des factures conformes.</p>
      )}

      <form className="client-form" style={{ maxWidth: 480 }} onSubmit={handleSubmit}>
        {error && <p className="error">{error}</p>}
        {saved && <p className="info">Profil enregistré.</p>}

        <label>
          Forme juridique *
          <select value={form.legalForm || ''} onChange={(e) => update('legalForm', e.target.value)}>
            <option value="">-- Choisir --</option>
            {LEGAL_FORMS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          Nom complet (prénom et nom) {isEI ? '*' : ''}
          <input type="text" value={form.fullName || ''} onChange={(e) => update('fullName', e.target.value)} />
        </label>

        <label>
          {isEI || !form.legalForm ? 'Nom commercial (facultatif)' : 'Dénomination sociale *'}
          <input type="text" value={form.businessName || ''} onChange={(e) => update('businessName', e.target.value)} />
        </label>

        {needsCapital && (
          <label>
            Capital social (en €) *
            <input type="text" value={form.shareCapital || ''} onChange={(e) => update('shareCapital', e.target.value)} />
          </label>
        )}

        <label>
          Adresse (siège ou domicile professionnel) *
          <textarea rows={3} value={form.address || ''} onChange={(e) => update('address', e.target.value)} />
        </label>

        <label>
          SIRET (14 chiffres) *
          <input type="text" inputMode="numeric" value={form.siret || ''} onChange={(e) => update('siret', e.target.value)} />
        </label>

        <label>
          Téléphone
          <input type="tel" value={form.phone || ''} onChange={(e) => update('phone', e.target.value)} />
        </label>

        <fieldset className="radio-group">
          <legend>Régime de TVA *</legend>
          <label className="inline-label">
            <input
              type="radio"
              name="vatRegime"
              checked={form.vatRegime === 'franchise'}
              onChange={() => update('vatRegime', 'franchise')}
            />
            Franchise en base (TVA non applicable, art. 293 B du CGI)
          </label>
          <label className="inline-label">
            <input
              type="radio"
              name="vatRegime"
              checked={form.vatRegime === 'subject'}
              onChange={() => update('vatRegime', 'subject')}
            />
            Assujetti à la TVA
          </label>
        </fieldset>

        {isSubject && (
          <>
            <label>
              Numéro de TVA intracommunautaire * (ex. FR12345678901)
              <input type="text" value={form.vatNumber || ''} onChange={(e) => update('vatNumber', e.target.value)} />
            </label>
            <label>
              Taux de TVA par défaut
              <select value={form.defaultVatRate} onChange={(e) => update('defaultVatRate', Number(e.target.value))}>
                {VAT_RATES.map((r) => (
                  <option key={r} value={r}>
                    {String(r).replace('.', ',')} %
                  </option>
                ))}
              </select>
            </label>
            <label className="inline-label">
              <input
                type="checkbox"
                checked={Boolean(form.vatOnDebits)}
                onChange={(e) => update('vatOnDebits', e.target.checked)}
              />
              J'ai opté pour le paiement de la TVA d'après les débits
            </label>
          </>
        )}

        <label>
          Modalités de paiement (IBAN, etc.)
          <textarea rows={3} value={form.paymentInfo || ''} onChange={(e) => update('paymentInfo', e.target.value)} />
        </label>

        <label>
          Autres mentions (RCS, assurance professionnelle pour les artisans…)
          <textarea rows={3} value={form.legalNotes || ''} onChange={(e) => update('legalNotes', e.target.value)} />
        </label>

        <div className="form-actions">
          <button type="submit" disabled={saving}>
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </div>
  );
}
