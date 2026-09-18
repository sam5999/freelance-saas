import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from '../api';
import ClientForm from '../components/ClientForm';

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingClient, setEditingClient] = useState(null); // null = ajout, objet = édition

  useEffect(() => {
    loadClients();
  }, []);

  async function loadClients() {
    setLoading(true);
    try {
      const data = await api.listClients();
      setClients(data.clients);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function openAddForm() {
    setEditingClient(null);
    setShowForm(true);
  }

  function openEditForm(client) {
    setEditingClient(client);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingClient(null);
  }

  async function handleSubmit(values) {
    if (editingClient) {
      const data = await api.updateClient(editingClient.id, values);
      setClients((prev) => prev.map((c) => (c.id === editingClient.id ? data.client : c)));
    } else {
      const data = await api.createClient(values);
      setClients((prev) => [data.client, ...prev]);
    }
    closeForm();
  }

  async function handleDelete(client) {
    if (!window.confirm(`Supprimer ${client.name} ?`)) return;
    await api.deleteClient(client.id);
    setClients((prev) => prev.filter((c) => c.id !== client.id));
  }

  return (
    <div className="page">
      <header>
        <h1>Mes clients</h1>
        <Link to="/dashboard">← Retour au tableau de bord</Link>
      </header>

      {error && <p className="error">{error}</p>}

      {!showForm && <button onClick={openAddForm}>+ Ajouter un client</button>}

      {showForm && (
        <ClientForm
          initialValues={editingClient}
          onSubmit={handleSubmit}
          onCancel={closeForm}
        />
      )}

      {loading ? (
        <p className="muted">Chargement...</p>
      ) : clients.length === 0 ? (
        <p className="muted">Aucun client pour l'instant.</p>
      ) : (
        <table className="clients-table">
          <thead>
            <tr>
              <th>Nom</th>
              <th>Email</th>
              <th>Entreprise</th>
              <th>Téléphone</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {clients.map((client) => (
              <tr key={client.id}>
                <td>{client.name}</td>
                <td>{client.email}</td>
                <td>{client.company}</td>
                <td>{client.phone}</td>
                <td className="row-actions">
                  <button className="link" onClick={() => openEditForm(client)}>
                    Modifier
                  </button>
                  <button className="link danger" onClick={() => handleDelete(client)}>
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
