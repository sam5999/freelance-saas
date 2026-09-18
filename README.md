# Accordly — Facturation & confirmation d'accords

Application pour freelances (domaine prévu : accordly.fr) : gestion clients, accords avec confirmation par email, factures PDF conformes et avoirs, tableau de bord, abonnement Stripe (20€/mois, essai 14 jours).

## Stack
- **Frontend** : React (Vite)
- **Backend** : Node.js + Express
- **Base de données** : PostgreSQL
- **Paiement** : Stripe (Checkout + webhooks)

## Structure
```
backend/   API Express (routes, connexion DB)
frontend/  Application React (Vite)
render.yaml  Description du déploiement sur Render
```

## Démarrer en local
```bash
cd backend && npm install && npm run migrate && npm run dev
```
```bash
cd frontend && npm install && npm run dev
```
Le serveur écoute sur http://localhost:4000 (vérifier avec /api/health), l'application sur http://localhost:5173.
Copier `backend/.env.example` en `backend/.env` et `frontend/.env.example` en `frontend/.env`, puis renseigner les valeurs.

## Base de données locale
- Base : `freelance_saas`
- Utilisateur applicatif : `freelance_app`
- Voir `backend/.env` pour la chaîne de connexion (fichier non versionné).
