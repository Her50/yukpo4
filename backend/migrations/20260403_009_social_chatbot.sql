-- =========================================================================
-- Migration: Social AI Chatbot — Community Manager IA
-- Conversations Messenger / Instagram DM / WhatsApp Business
-- =========================================================================

-- ─── Threads de conversation (une conversation = un utilisateur final × plateforme) ──
CREATE TABLE IF NOT EXISTS social_chatbot_threads (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,  -- partenaire Yukpo
    service_id INTEGER NOT NULL,
    platform VARCHAR(30) NOT NULL,           -- messenger, instagram_dm, whatsapp
    external_sender_id VARCHAR(255) NOT NULL, -- PSID Facebook, IG user ID, WA phone number
    sender_name VARCHAR(255),
    sender_phone VARCHAR(50),
    status VARCHAR(30) NOT NULL DEFAULT 'bot', -- bot, escalated, closed
    escalation_reason TEXT,
    total_messages INTEGER NOT NULL DEFAULT 0,
    bot_messages INTEGER NOT NULL DEFAULT 0,
    human_messages INTEGER NOT NULL DEFAULT 0,
    last_message_at TIMESTAMPTZ,
    last_bot_response_at TIMESTAMPTZ,
    avg_response_ms INTEGER,                 -- latence moyenne des réponses bot
    sentiment VARCHAR(20) DEFAULT 'neutral', -- positive, negative, neutral (analyse IA)
    tags TEXT[],                             -- order_inquiry, complaint, product_question, etc.
    linked_order_id INTEGER,                 -- si conversation liée à une commande
    linked_product_id INTEGER,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_chatbot_thread UNIQUE (user_id, platform, external_sender_id)
);

CREATE INDEX IF NOT EXISTS idx_chatbot_threads_user_service ON social_chatbot_threads(user_id, service_id);
CREATE INDEX IF NOT EXISTS idx_chatbot_threads_platform ON social_chatbot_threads(platform);
CREATE INDEX IF NOT EXISTS idx_chatbot_threads_status ON social_chatbot_threads(status) WHERE status != 'closed';
CREATE INDEX IF NOT EXISTS idx_chatbot_threads_last_message ON social_chatbot_threads(last_message_at DESC);

-- ─── Messages individuels ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS social_chatbot_messages (
    id BIGSERIAL PRIMARY KEY,
    thread_id INTEGER NOT NULL REFERENCES social_chatbot_threads(id) ON DELETE CASCADE,
    direction VARCHAR(10) NOT NULL,          -- inbound (client → bot), outbound (bot → client)
    sender_type VARCHAR(20) NOT NULL,        -- customer, bot, human_agent
    content TEXT NOT NULL,
    content_type VARCHAR(30) NOT NULL DEFAULT 'text', -- text, image, product_card, quick_reply
    external_message_id VARCHAR(255),        -- ID message côté Meta
    is_read BOOLEAN NOT NULL DEFAULT false,
    ai_model_used VARCHAR(50),               -- gpt-4o, claude-sonnet-4-6
    ai_tokens_used INTEGER,
    response_time_ms INTEGER,
    context_snapshot JSONB,                  -- snapshot du contexte assemblé pour l'IA
    delivered BOOLEAN NOT NULL DEFAULT false,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chatbot_messages_thread ON social_chatbot_messages(thread_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chatbot_messages_unread ON social_chatbot_messages(thread_id) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_chatbot_messages_direction ON social_chatbot_messages(direction, created_at DESC);

-- ─── Queue de messages entrants à traiter ───────────────────────────────────
CREATE TABLE IF NOT EXISTS social_chatbot_queue (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_id INTEGER NOT NULL,
    platform VARCHAR(30) NOT NULL,
    external_sender_id VARCHAR(255) NOT NULL,
    sender_name VARCHAR(255),
    raw_message TEXT NOT NULL,
    raw_payload JSONB NOT NULL DEFAULT '{}', -- payload complet du webhook
    page_id VARCHAR(255),                    -- page Facebook/IG qui a reçu le message
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, processing, done, failed
    attempt INTEGER NOT NULL DEFAULT 0,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_chatbot_queue_pending ON social_chatbot_queue(status, created_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_chatbot_queue_user ON social_chatbot_queue(user_id, service_id);

-- ─── Configuration bot par partenaire ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS social_chatbot_config (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_id INTEGER NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    bot_name VARCHAR(100) NOT NULL DEFAULT 'Assistant',
    welcome_message TEXT,
    away_message TEXT,                       -- hors horaires ouverture
    escalation_trigger_words TEXT[] DEFAULT ARRAY['responsable', 'plainte', 'remboursement', 'arnaque'],
    escalation_notification_phone VARCHAR(50), -- notifier le gérant si escalade
    business_hours JSONB NOT NULL DEFAULT '{"mon":{"open":"08:00","close":"20:00"},"tue":{"open":"08:00","close":"20:00"},"wed":{"open":"08:00","close":"20:00"},"thu":{"open":"08:00","close":"20:00"},"fri":{"open":"08:00","close":"20:00"},"sat":{"open":"08:00","close":"18:00"}}',
    auto_suggest_products BOOLEAN NOT NULL DEFAULT true,
    include_product_links BOOLEAN NOT NULL DEFAULT true,
    max_ai_tokens_per_response INTEGER NOT NULL DEFAULT 400,
    language VARCHAR(10) NOT NULL DEFAULT 'fr',
    reply_delay_ms INTEGER NOT NULL DEFAULT 1500, -- délai réaliste (paraît humain)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_chatbot_config UNIQUE (user_id, service_id)
);

-- ─── Webhooks Meta enregistrés ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS social_webhook_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform VARCHAR(30) NOT NULL,           -- messenger, instagram_dm, whatsapp
    page_id VARCHAR(255) NOT NULL,
    page_access_token TEXT,
    verify_token VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT true,
    subscribed_fields TEXT[] DEFAULT ARRAY['messages', 'messaging_postbacks'],
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_webhook_subscription UNIQUE (user_id, platform, page_id)
);
