# Freelance SaaS — Facturation & confirmation d'accords

Application pour freelances : gestion clients, accords avec confirmation par email, factures PDF, tableau de bord, abonnement Stripe (20€/mois, essai 14 jours).

## Stack
- **Frontend** : React (Vite)
- **Backend** : Node.js + Express
- **Base de données** : PostgreSQL
- **Paiement** : Stripe (Checkout + webhooks)

## Structure
```
backend/   API Express (routes, connexion DB)
frontend/  Application React (à venir)
```

## Démarrer le backend en local
```bash
cd backend
npm install
npm run dev
```
Le serveur écoute sur http://localhost:4000 — vérifier avec http://localhost:4000/api/health.

## Base de données locale
- Base : `freelance_saas`
- Utilisateur applicatif : `freelance_app`
- Voir `backend/.env` pour la chaîne de connexion (fichier non versionné).
