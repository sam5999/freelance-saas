import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from '../api';
import AgreementForm from '../components/AgreementForm';

const STATUS_LABELS = {
  draft: 'Brouillon',
  sent: 'Envoyé',
  confirmed: 'Confirmé',
};

export default function Agreements() {
  const [agreements, setAgreements] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingAgreement, setEditingAgreement] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [actionMessage, setActionMessage] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [agreementsData, clientsData] = await Promise.all([api.listAgreements(), api.listClients()]);
      setAgreements(agreementsData.agreements);
      setClients(clientsData.clients);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function openAddForm() {
    setEditingAgreement(null);
    setShowForm(true);
  }

  function openEditForm(agreement) {
    setEditingAgreement({
      clientId: agreement.client_id,
      title: agreement.title,
      description: agreement.description,
      amount: agreement.amount,
    });
    setEditingId(agreement.id);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingAgreement(null);
    setEditingId(null);
  }

  async function handleSubmit(values) {
    if (editingId) {
      const data = await api.updateAgreement(editingId, values);
      setAgreements((prev) => prev.map((a) => (a.id === editingId ? { ...a, ...data.agreement } : a)));
    } else {
      await api.createAgreement(values);
      await loadData();
    }
    closeForm();
  }

  async function handleDelete(agreement) {
    if (!window.confirm(`Supprimer l'accord "${agreement.title}" ?`)) return;
    await api.deleteAgreement(agreement.id);
    setAgreements((prev) => prev.filter((a) => a.id !== agreement.id));
  }

  async function handleSend(agreement) {
    setActionMessage('');
    try {
      const data = await api.sendAgreement(agreement.id);
      setAgreements((prev) => prev.map((a) => (a.id === agreement.id ? { ...a, ...data.agreement } : a)));
      setActionMessage(`Email de confirmation envoyé pour "${agreement.title}".`);
    } catch (err) {
      setError(err.message);
    }
  }

  function copyLink(agreement) {
    const url = `${window.location.origin}/confirm/${agreement.confirmation_token}`;
    navigator.clipboard.writeText(url);
    setActionMessage('Lien copié dans le presse-papier.');
  }

  return (
    <div className="page">
      <header>
        <h1>Mes accords</h1>
        <Link to="/dashboard">← Retour au tableau de bord</Link>
      </header>

      {error && <p className="error">{error}</p>}
      {actionMessage && <p className="info">{actionMessage}</p>}

      {!showForm && clients.length === 0 && !loading && (
        <p className="muted">
          Ajoute d'abord un <Link to="/clients">client</Link> pour pouvoir créer un accord.
        </p>
      )}

      {!showForm && clients.length > 0 && <button onClick={openAddForm}>+ Nouvel accord</button>}

      {showForm && (
        <AgreementForm
          clients={clients}
          initialValues={editingAgreement}
          onSubmit={handleSubmit}
          onCancel={closeForm}
        />
      )}

      {loading ? (
        <p className="muted">Chargement...</p>
      ) : agreements.length === 0 ? (
        <p className="muted">Aucun accord pour l'instant.</p>
      ) : (
        <table className="clients-table">
          <thead>
            <tr>
              <th>Client</th>
              <th>Titre</th>
              <th>Montant</th>
              <th>Statut</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {agreements.map((agreement) => (
              <tr key={agreement.id}>
                <td>{agreement.client_name}</td>
                <td>{agreement.title}</td>
                <td>{agreement.amount ? `${agreement.amount} €` : '—'}</td>
                <td>
                  <span className={`badge badge-${agreement.status}`}>{STATUS_LABELS[agreement.status]}</span>
                </td>
                <td className="row-actions">
                  {agreement.status === 'draft' && (
                    <>
                      <button className="link" onClick={() => openEditForm(agreement)}>
                        Modifier
                      </button>
                      <button className="link" onClick={() => handleSend(agreement)}>
                        Envoyer au client
                      </button>
                    </>
                  )}
                  {agreement.status === 'sent' && (
                    <button className="link" onClick={() => handleSend(agreement)}>
                      Renvoyer l'email
                    </button>
                  )}
                  {agreement.status !== 'draft' && (
                    <button className="link" onClick={() => copyLink(agreement)}>
                      Copier le lien
                    </button>
                  )}
                  <button className="link danger" onClick={() => handleDelete(agreement)}>
                    Supprimer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
