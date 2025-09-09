-- Crée la table `users`
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL,
    is_provider BOOLEAN NOT NULL DEFAULT FALSE,
    tokens_balance BIGINT NOT NULL DEFAULT 0,
    token_price_user DOUBLE PRECISION NOT NULL,
    token_price_provider DOUBLE PRECISION NOT NULL,
    commission_pct REAL NOT NULL,
    preferred_lang TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Crée la table `services` avec lien vers `users`
CREATE TABLE IF NOT EXISTS services (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    data JSONB NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    auto_deactivate_at TIMESTAMPTZ,
    last_reactivated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Crée la table `media`
CREATE TABLE IF NOT EXISTS media (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    path TEXT NOT NULL,
    uploaded_at TIMESTAMP DEFAULT NOW()
);

-- Crée la table `consultation_historique`
CREATE TABLE IF NOT EXISTS consultation_historique (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);