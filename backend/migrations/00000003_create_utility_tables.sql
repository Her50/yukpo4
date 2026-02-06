-- Tables utilitaires pour le système

-- Table consultation_historique
CREATE TABLE IF NOT EXISTS consultation_historique (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table token_packs
CREATE TABLE IF NOT EXISTS token_packs (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    price BIGINT NOT NULL,
    tokens BIGINT NOT NULL
);

-- Table service_logs
CREATE TABLE IF NOT EXISTS service_logs (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action TEXT,
    reason TEXT,
    modification TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



