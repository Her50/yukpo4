-- =========================================================================
-- Migration: Social Unified Inbox
-- Inbox unifiée toutes plateformes + notifications escalades
-- =========================================================================

-- ─── Vue matérialisée de l'inbox (calculée depuis chatbot_threads + messages) ──
-- On stocke un résumé dans une table dédiée pour performance

CREATE TABLE IF NOT EXISTS social_inbox_summary (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_id INTEGER NOT NULL,
    thread_id INTEGER NOT NULL REFERENCES social_chatbot_threads(id) ON DELETE CASCADE,
    platform VARCHAR(30) NOT NULL,
    sender_name VARCHAR(255),
    sender_avatar_url TEXT,
    last_message_preview TEXT,
    last_message_at TIMESTAMPTZ,
    unread_count INTEGER NOT NULL DEFAULT 0,
    is_escalated BOOLEAN NOT NULL DEFAULT false,
    is_starred BOOLEAN NOT NULL DEFAULT false,
    label VARCHAR(50),                       -- order, complaint, question, vip
    assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_inbox_summary UNIQUE (user_id, thread_id)
);

CREATE INDEX IF NOT EXISTS idx_inbox_summary_user_service ON social_inbox_summary(user_id, service_id);
CREATE INDEX IF NOT EXISTS idx_inbox_summary_unread ON social_inbox_summary(user_id, unread_count DESC) WHERE unread_count > 0;
CREATE INDEX IF NOT EXISTS idx_inbox_summary_escalated ON social_inbox_summary(user_id, is_escalated) WHERE is_escalated = true;
CREATE INDEX IF NOT EXISTS idx_inbox_summary_last_message ON social_inbox_summary(user_id, last_message_at DESC);

-- ─── Notes internes (agent humain) sur les threads ──────────────────────────
CREATE TABLE IF NOT EXISTS social_inbox_notes (
    id SERIAL PRIMARY KEY,
    thread_id INTEGER NOT NULL REFERENCES social_chatbot_threads(id) ON DELETE CASCADE,
    author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    note TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inbox_notes_thread ON social_inbox_notes(thread_id);

-- ─── Événements d'escalade (historique) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS social_escalation_events (
    id SERIAL PRIMARY KEY,
    thread_id INTEGER NOT NULL REFERENCES social_chatbot_threads(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    trigger_message TEXT,                    -- message qui a déclenché l'escalade
    trigger_keyword VARCHAR(100),
    notification_sent BOOLEAN NOT NULL DEFAULT false,
    notification_channel VARCHAR(30),        -- whatsapp, sms, push
    resolved_at TIMESTAMPTZ,
    resolved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_escalations_user ON social_escalation_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_escalations_unresolved ON social_escalation_events(user_id) WHERE resolved_at IS NULL;

-- ─── Métriques agrégées inbox (pour dashboard) ───────────────────────────────
CREATE TABLE IF NOT EXISTS social_inbox_daily_metrics (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_id INTEGER NOT NULL,
    date DATE NOT NULL,
    platform VARCHAR(30) NOT NULL,
    total_conversations INTEGER NOT NULL DEFAULT 0,
    new_conversations INTEGER NOT NULL DEFAULT 0,
    bot_handled INTEGER NOT NULL DEFAULT 0,
    escalated INTEGER NOT NULL DEFAULT 0,
    avg_response_time_ms INTEGER,
    satisfaction_score NUMERIC(3,2),         -- 0.00 à 5.00 si feedback collecté
    total_messages_in INTEGER NOT NULL DEFAULT 0,
    total_messages_out INTEGER NOT NULL DEFAULT 0,
    ai_tokens_used BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_inbox_daily_metrics UNIQUE (user_id, service_id, date, platform)
);

CREATE INDEX IF NOT EXISTS idx_inbox_metrics_user_date ON social_inbox_daily_metrics(user_id, date DESC);

-- ─── Templates de réponses rapides (pour agents humains) ─────────────────────
CREATE TABLE IF NOT EXISTS social_quick_replies (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    shortcut VARCHAR(50) NOT NULL,           -- ex: /dispo, /horaires
    content TEXT NOT NULL,
    platforms TEXT[] DEFAULT ARRAY['messenger', 'instagram_dm', 'whatsapp'],
    usage_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_quick_reply UNIQUE (user_id, shortcut)
);

CREATE INDEX IF NOT EXISTS idx_quick_replies_user ON social_quick_replies(user_id);
