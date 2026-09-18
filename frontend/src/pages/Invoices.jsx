import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from '../api';
import InvoiceForm from '../components/InvoiceForm';
import CreditNoteForm from '../components/CreditNoteForm';

function statusBadge(row) {
  if (row.type === 'credit_note') return { className: 'badge-credit', label: 'Avoir' };
  if (row.status === 'draft') return { className: 'badge-draft', label: 'Brouillon' };
  if (row.cancelled) return { className: 'badge-cancelled', label: 'Annulée' };
  if (row.status === 'paid') return { className: 'badge-confirmed', label: 'Payée' };
  return { className: 'badge-sent', label: 'En attente' };
}

export default function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [agreements, setAgreements] = useState([]);
  const [profile, setProfile] = useState(null);
  const [missingFields, setMissingFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [creditFor, setCreditFor] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [invoicesData, clientsData, agreementsData, profileData] = await Promise.all([
        api.listInvoices(),
        api.listClients(),
        api.listAgreements(),
        api.getProfile(),
      ]);
      setInvoices(invoicesData.invoices);
      setClients(clientsData.clients);
      setAgreements(agreementsData.agreements.filter((a) => a.status === 'confirmed'));
      setProfile(profileData.profile);
      setMissingFields(profileData.missingFields);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Exécute une action, affiche l'erreur éventuelle, puis recharge la liste.
  async function run(action, successMessage) {
    setError('');
    setMessage('');
    try {
      await action();
      await loadData();
      if (successMessage) setMessage(successMessage);
    } catch (err) {
      setError(err.message);
    }
  }

  function openAddForm() {
    setEditingInvoice(null);
    setEditingId(null);
    setCreditFor(null);
    setShowForm(true);
  }

  function openEditForm(invoice) {
    setEditingInvoice({
      title: invoice.title,
      description: invoice.description,
      amount: invoice.amount,
      vatRate: Number(invoice.vat_rate),
      serviceDate: invoice.service_date,
      dueDate: invoice.due_date,
    });
    setEditingId(invoice.id);
    setCreditFor(null);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingInvoice(null);
    setEditingId(null);
  }

  async function handleSubmit(values) {
    if (editingId) {
      await api.updateInvoice(editingId, values);
    } else {
      await api.createInvoice(values);
    }
    await loadData();
    closeForm();
  }

  function handleDelete(invoice) {
    if (!window.confirm('Supprimer ce brouillon ?')) return;
    run(() => api.deleteInvoice(invoice.id));
  }

  function handleIssue(invoice) {
    const ok = window.confirm(
      'Émettre cette facture ?\n\nUn numéro définitif lui sera attribué. Elle ne pourra plus être modifiée ni supprimée : ' +
        'en cas d\'erreur, il faudra créer un avoir.'
    );
    if (!ok) return;
    run(() => api.issueInvoice(invoice.id), 'Facture émise.');
  }

  function togglePaid(invoice) {
    run(() => (invoice.status === 'paid' ? api.markInvoicePending(invoice.id) : api.markInvoicePaid(invoice.id)));
  }

  async function handleCreditNote(values) {
    await api.createCreditNote(creditFor.id, values);
    await loadData();
    setCreditFor(null);
    setMessage('Avoir émis.');
  }

  function openCreditForm(invoice) {
    setError('');
    setMessage('');
    closeForm();
    setCreditFor(invoice);
  }

  // Factures émises encore dues ou encaissées (les annulées et les avoirs sont exclus).
  const live = invoices.filter((i) => i.type === 'invoice' && i.status !== 'draft' && !i.cancelled);
  const pending = live.filter((i) => i.status === 'pending');
  const paid = live.filter((i) => i.status === 'paid');
  const pendingTotal = pending.reduce((sum, i) => sum + Number(i.net_ttc), 0);
  const paidTotal = paid.reduce((sum, i) => sum + Number(i.net_ttc), 0);

  return (
    <div className="page">
      <header>
        <h1>Mes factures</h1>
        <Link to="/dashboard">← Retour au tableau de bord</Link>
      </header>

      {error && <p className="error">{error}</p>}
      {message && <p className="info">{message}</p>}

      {!loading && (
        <div className="summary-row">
          <div className="summary-card">
            <span className="muted">En attente</span>
            <strong>{pendingTotal.toFixed(2)} €</strong>
            <span className="muted">{pending.length} facture(s)</span>
          </div>
          <div className="summary-card">
            <span className="muted">Payées</span>
            <strong>{paidTotal.toFixed(2)} €</strong>
            <span className="muted">{paid.length} facture(s)</span>
          </div>
        </div>
      )}

      {!showForm && clients.length === 0 && !loading && (
        <p className="muted">
          Ajoute d'abord un <Link to="/clients">client</Link> pour pouvoir créer une facture.
        </p>
      )}

      {!loading && missingFields.length > 0 && (
        <p className="error">
          Tu peux préparer des brouillons, mais pour émettre une facture conforme il faut d'abord compléter{' '}
          <Link to="/profile">ton profil</Link> : {missingFields.join(', ')}.
        </p>
      )}

      {!showForm && !creditFor && clients.length > 0 && <button onClick={openAddForm}>+ Nouvelle facture</button>}

      {showForm && (
        <InvoiceForm
          clients={clients}
          agreements={agreements}
          profile={profile}
          initialValues={editingInvoice}
          onSubmit={handleSubmit}
          onCancel={closeForm}
        />
      )}

      {creditFor && (
        <CreditNoteForm
          invoice={creditFor}
          remainingHt={Number(creditFor.amount) - Number(creditFor.credited_ht)}
          onSubmit={handleCreditNote}
          onCancel={() => setCreditFor(null)}
        />
      )}

      {loading ? (
        <p className="muted">Chargement...</p>
      ) : invoices.length === 0 ? (
        <p className="muted">Aucune facture pour l'instant.</p>
      ) : (
        <table className="clients-table">
          <thead>
            <tr>
              <th>Numéro</th>
              <th>Client</th>
              <th>Désignation</th>
              <th>Total TTC</th>
              <th>Statut</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => {
              const badge = statusBadge(invoice);
              const isCredit = invoice.type === 'credit_note';
              const isDraft = invoice.status === 'draft';
              const remainingHt = Number(invoice.amount) - Number(invoice.credited_ht);
              return (
                <tr key={invoice.id}>
                  <td>{invoice.invoice_number || '—'}</td>
                  <td>{invoice.client_name}</td>
                  <td>{invoice.title}</td>
                  <td>
                    {isCredit ? '-' : ''}
                    {Number(invoice.total_ttc).toFixed(2)} €
                  </td>
                  <td>
                    <span className={`badge ${badge.className}`}>{badge.label}</span>
                    {!isCredit && !isDraft && !invoice.cancelled && Number(invoice.credited_ht) > 0 && (
                      <div className="muted" style={{ fontSize: 12 }}>
                        Avoirs : -{Number(invoice.credited_ht).toFixed(2)} € HT
                      </div>
                    )}
                  </td>
                  <td className="row-actions">
                    {isDraft ? (
                      <>
                        <button className="link" onClick={() => openEditForm(invoice)}>
                          Modifier
                        </button>
                        <button className="link" onClick={() => handleIssue(invoice)}>
                          Émettre
                        </button>
                        <button className="link danger" onClick={() => handleDelete(invoice)}>
                          Supprimer
                        </button>
                      </>
                    ) : (
                      <>
                        <a className="link" href={api.invoicePdfUrl(invoice.id)} target="_blank" rel="noreferrer">
                          PDF
                        </a>
                        {!isCredit && !invoice.cancelled && (
                          <button className="link" onClick={() => togglePaid(invoice)}>
                            {invoice.status === 'paid' ? 'Marquer en attente' : 'Marquer payée'}
                          </button>
                        )}
                        {!isCredit && remainingHt > 0 && (
                          <button className="link danger" onClick={() => openCreditForm(invoice)}>
                            Créer un avoir
                          </button>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
