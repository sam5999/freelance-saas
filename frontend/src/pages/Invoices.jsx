import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from '../api';
import InvoiceForm from '../components/InvoiceForm';

export default function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [agreements, setAgreements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [invoicesData, clientsData, agreementsData] = await Promise.all([
        api.listInvoices(),
        api.listClients(),
        api.listAgreements(),
      ]);
      setInvoices(invoicesData.invoices);
      setClients(clientsData.clients);
      setAgreements(agreementsData.agreements.filter((a) => a.status === 'confirmed'));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function openAddForm() {
    setEditingInvoice(null);
    setEditingId(null);
    setShowForm(true);
  }

  function openEditForm(invoice) {
    setEditingInvoice({
      title: invoice.title,
      description: invoice.description,
      amount: invoice.amount,
      dueDate: invoice.due_date,
    });
    setEditingId(invoice.id);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingInvoice(null);
    setEditingId(null);
  }

  async function handleSubmit(values) {
    if (editingId) {
      const data = await api.updateInvoice(editingId, values);
      setInvoices((prev) => prev.map((i) => (i.id === editingId ? { ...i, ...data.invoice } : i)));
    } else {
      await api.createInvoice(values);
      await loadData();
    }
    closeForm();
  }

  async function handleDelete(invoice) {
    if (!window.confirm(`Supprimer la facture ${invoice.invoice_number} ?`)) return;
    await api.deleteInvoice(invoice.id);
    setInvoices((prev) => prev.filter((i) => i.id !== invoice.id));
  }

  async function togglePaid(invoice) {
    const data =
      invoice.status === 'paid' ? await api.markInvoicePending(invoice.id) : await api.markInvoicePaid(invoice.id);
    setInvoices((prev) => prev.map((i) => (i.id === invoice.id ? { ...i, ...data.invoice } : i)));
  }

  const pending = invoices.filter((i) => i.status === 'pending');
  const paid = invoices.filter((i) => i.status === 'paid');
  const pendingTotal = pending.reduce((sum, i) => sum + Number(i.amount), 0);
  const paidTotal = paid.reduce((sum, i) => sum + Number(i.amount), 0);

  return (
    <div className="page">
      <header>
        <h1>Mes factures</h1>
        <Link to="/dashboard">← Retour au tableau de bord</Link>
      </header>

      {error && <p className="error">{error}</p>}

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

      {!showForm && clients.length > 0 && <button onClick={openAddForm}>+ Nouvelle facture</button>}

      {showForm && (
        <InvoiceForm
          clients={clients}
          agreements={agreements}
          initialValues={editingInvoice}
          onSubmit={handleSubmit}
          onCancel={closeForm}
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
              <th>Titre</th>
              <th>Montant</th>
              <th>Statut</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => (
              <tr key={invoice.id}>
                <td>{invoice.invoice_number}</td>
                <td>{invoice.client_name}</td>
                <td>{invoice.title}</td>
                <td>{Number(invoice.amount).toFixed(2)} €</td>
                <td>
                  <span className={`badge badge-${invoice.status === 'paid' ? 'confirmed' : 'sent'}`}>
                    {invoice.status === 'paid' ? 'Payée' : 'En attente'}
                  </span>
                </td>
                <td className="row-actions">
                  <a className="link" href={api.invoicePdfUrl(invoice.id)} target="_blank" rel="noreferrer">
                    PDF
                  </a>
                  {invoice.status === 'pending' && (
                    <button className="link" onClick={() => openEditForm(invoice)}>
                      Modifier
                    </button>
                  )}
                  <button className="link" onClick={() => togglePaid(invoice)}>
                    {invoice.status === 'paid' ? 'Marquer en attente' : 'Marquer payée'}
                  </button>
                  <button className="link danger" onClick={() => handleDelete(invoice)}>
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
