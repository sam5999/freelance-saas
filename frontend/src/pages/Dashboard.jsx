import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const { user, logout } = useAuth();

  return (
    <div className="dashboard">
      <header>
        <h1>Tableau de bord</h1>
        <button onClick={logout}>Se déconnecter</button>
      </header>
      <p>Bienvenue {user?.fullName || user?.email} 👋</p>
      <nav className="dashboard-nav">
        <Link to="/clients">Mes clients</Link>
      </nav>
      <p className="muted">
        Les accords et factures arriveront ici dans les prochaines étapes.
      </p>
    </div>
  );
}
