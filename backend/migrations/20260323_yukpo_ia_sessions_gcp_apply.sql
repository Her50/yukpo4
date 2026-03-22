-- YukpoIA sessions — application manuelle GCP / Cloud SQL (idempotent)
-- Aligné sur ensure_yukpo_ia_sessions_tables + colonne préférences RGPD.
-- Usage: .\scripts\apply_sql_gcp_cloudsql.ps1 -SqlPath "migrations\20260323_yukpo_ia_sessions_gcp_apply.sql"

CREATE TABLE IF NOT EXISTS yukpo_ia_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200),
    context_screen VARCHAR(100),
    context_type VARCHAR(50),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    summary TEXT,
    message_count INTEGER NOT NULL DEFAULT 0,
    total_tokens_used BIGINT NOT NULL DEFAULT 0,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS yukpo_ia_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES yukpo_ia_sessions(id) ON DELETE CASCADE,
    role VARCHAR(10) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
    tokens_used INTEGER,
    model_used VARCHAR(50),
    billing JSONB,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS yukpo_ia_user_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    memory_key VARCHAR(100) NOT NULL,
    memory_value TEXT NOT NULL,
    source_session_id UUID REFERENCES yukpo_ia_sessions(id) ON DELETE SET NULL,
    confidence REAL NOT NULL DEFAULT 0.8,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, memory_key)
);

CREATE INDEX IF NOT EXISTS idx_yukpo_ia_sessions_user ON yukpo_ia_sessions(user_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_yukpo_ia_sessions_active ON yukpo_ia_sessions(user_id, is_archived, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_yukpo_ia_messages_session ON yukpo_ia_messages(session_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_yukpo_ia_user_memory_user ON yukpo_ia_user_memory(user_id, updated_at DESC);

ALTER TABLE users ADD COLUMN IF NOT EXISTS yukpo_ia_long_term_memory_enabled BOOLEAN NOT NULL DEFAULT TRUE;

-- Consentement explicite (horodatage) pour activer la mémoire long terme ; NULL = pas encore accepté.
ALTER TABLE users ADD COLUMN IF NOT EXISTS yukpo_ia_long_term_memory_consent_at TIMESTAMPTZ;

COMMENT ON COLUMN users.yukpo_ia_long_term_memory_enabled IS 'Si false: pas de chargement / extraction mémoire long terme YukpoIA (faits cross-session).';
COMMENT ON COLUMN users.yukpo_ia_long_term_memory_consent_at IS 'Date du consentement explicite pour la mémoire long terme YukpoIA.';

-- Optionnel (comptes déjà en production avec mémoire activée) : décommenter UNE FOIS pour accorder rétroactivement le consentement.
-- UPDATE users SET yukpo_ia_long_term_memory_consent_at = NOW()
-- WHERE yukpo_ia_long_term_memory_consent_at IS NULL AND yukpo_ia_long_term_memory_enabled = TRUE;
