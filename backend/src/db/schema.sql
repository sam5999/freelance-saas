-- Table des freelances (utilisateurs de l'application)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name VARCHAR(255),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  subscription_status VARCHAR(20) NOT NULL DEFAULT 'trialing', -- trialing | active | past_due | canceled
  trial_ends_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '14 days'),
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ajoute les colonnes d'abonnement si la table "users" existait déjà (avant l'étape 6)
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(20) NOT NULL DEFAULT 'trialing';
ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '14 days');
ALTER TABLE users ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ;

-- Table des clients de chaque freelance
CREATE TABLE IF NOT EXISTS clients (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  company VARCHAR(255),
  phone VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients(user_id);

-- Table des accords (missions proposées à un client, à confirmer par email)
CREATE TABLE IF NOT EXISTS agreements (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  amount NUMERIC(10,2),
  status VARCHAR(20) NOT NULL DEFAULT 'draft', -- draft | sent | confirmed
  confirmation_token TEXT UNIQUE,
  sent_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agreements_user_id ON agreements(user_id);
CREATE INDEX IF NOT EXISTS idx_agreements_client_id ON agreements(client_id);

-- Table des factures (manuelles ou issues d'un accord)
CREATE TABLE IF NOT EXISTS invoices (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  agreement_id INTEGER REFERENCES agreements(id) ON DELETE SET NULL,
  invoice_number VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  amount NUMERIC(10,2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending | paid
  due_date DATE,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, invoice_number)
);

CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices(client_id);

-- Mentions légales des factures
-- Identité légale du freelance (émetteur des factures)
ALTER TABLE users ADD COLUMN IF NOT EXISTS business_name VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS legal_form VARCHAR(20);        -- EI | EURL | SASU | SARL | SAS | AUTRE
ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS siret VARCHAR(14);
ALTER TABLE users ADD COLUMN IF NOT EXISTS share_capital VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS vat_regime VARCHAR(20);      -- franchise | subject
ALTER TABLE users ADD COLUMN IF NOT EXISTS vat_number VARCHAR(30);
ALTER TABLE users ADD COLUMN IF NOT EXISTS default_vat_rate NUMERIC(5,2) NOT NULL DEFAULT 20;
ALTER TABLE users ADD COLUMN IF NOT EXISTS vat_on_debits BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS payment_info TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS legal_notes TEXT;

-- Adresse et SIREN du client (obligatoires sur la facture)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS siret VARCHAR(14);

-- TVA, date de prestation, et copie figée de l'émetteur et du client au moment de l'émission
-- (une facture émise ne doit pas changer si le profil est modifié plus tard). "amount" = montant HT.
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS vat_rate NUMERIC(5,2) NOT NULL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS service_date DATE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS seller_info JSONB;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS client_info JSONB;
