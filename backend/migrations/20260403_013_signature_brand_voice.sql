-- =========================================================================
-- Migration: Signature Yukpo + Brand Voice Training + Approbation contenu
-- =========================================================================

-- ─── Signature Yukpo configurable par partenaire ─────────────────────────────
ALTER TABLE social_ai_preferences
    ADD COLUMN IF NOT EXISTS yukpo_signature_enabled  BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS yukpo_signature_style    VARCHAR(20) NOT NULL DEFAULT 'hashtag',
    -- 'hashtag'  → ajoute #YukpoApp en fin de post
    -- 'text'     → ajoute "📲 Commandez sur Yukpo : {url}"
    -- 'subtle'   → ajoute "via @yukpoapp" en bas
    ADD COLUMN IF NOT EXISTS custom_signature_text    TEXT,
    -- Si renseigné, remplace le texte par défaut (le partenaire choisit sa formulation)
    ADD COLUMN IF NOT EXISTS brand_voice_examples     TEXT[],
    -- 5-20 exemples de posts écrits par le partenaire pour calibrer le style IA
    ADD COLUMN IF NOT EXISTS brand_voice_trained_at   TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS brand_voice_summary      TEXT;
    -- Résumé du style déduit par GPT-4o depuis les exemples

-- ─── Workflow approbation contenu ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS content_approval_queue (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_id          INTEGER NOT NULL,
    post_id             INTEGER REFERENCES social_ai_posts(id) ON DELETE SET NULL,

    -- Contenu proposé par IA
    platform            VARCHAR(30) NOT NULL,
    caption             TEXT NOT NULL,
    image_url           TEXT,
    scheduled_for       TIMESTAMPTZ,
    hashtags            TEXT[],

    -- Statut d'approbation
    status              VARCHAR(20) NOT NULL DEFAULT 'pending',
    -- pending | approved | rejected | modified
    reviewed_by         INTEGER REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at         TIMESTAMPTZ,
    reviewer_note       TEXT,
    modified_caption    TEXT,          -- si le manager modifie avant approbation

    -- Escalade (pour personnalités publiques)
    requires_approval   BOOLEAN NOT NULL DEFAULT false,
    urgency             VARCHAR(20) NOT NULL DEFAULT 'normal', -- normal | high | crisis
    auto_approve_after  TIMESTAMPTZ,  -- si NULL et pas de réponse → bloqué

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_approval_queue_user_status
    ON content_approval_queue(user_id, status);
CREATE INDEX IF NOT EXISTS idx_approval_queue_pending
    ON content_approval_queue(status, created_at)
    WHERE status = 'pending';

-- ─── Monitoring réputation / mentions ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reputation_mentions (
    id                  BIGSERIAL PRIMARY KEY,
    user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_id          INTEGER,

    platform            VARCHAR(30) NOT NULL, -- twitter, facebook, instagram, tiktok, news, reddit
    mention_id          VARCHAR(200),         -- ID externe du post/tweet/article
    author_name         VARCHAR(200),
    author_handle       VARCHAR(200),
    content             TEXT NOT NULL,
    url                 TEXT,

    -- Analyse sentiment
    sentiment           VARCHAR(20),          -- positive | neutral | negative | crisis
    sentiment_score     NUMERIC(4,3),         -- -1.0 à +1.0
    is_crisis           BOOLEAN NOT NULL DEFAULT false,
    crisis_level        INTEGER DEFAULT 0,    -- 0=aucun 1=faible 2=moyen 3=critique

    -- Engagement
    likes               INTEGER DEFAULT 0,
    shares              INTEGER DEFAULT 0,
    replies             INTEGER DEFAULT 0,
    reach_estimate      INTEGER DEFAULT 0,

    keywords_matched    TEXT[],               -- mots-clés qui ont déclenché la détection
    is_read             BOOLEAN NOT NULL DEFAULT false,
    is_handled          BOOLEAN NOT NULL DEFAULT false,
    handled_by          INTEGER REFERENCES users(id) ON DELETE SET NULL,
    handled_at          TIMESTAMPTZ,

    detected_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_reputation_user_platform
    ON reputation_mentions(user_id, platform, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_reputation_crisis
    ON reputation_mentions(user_id, is_crisis, detected_at DESC)
    WHERE is_crisis = true;
CREATE INDEX IF NOT EXISTS idx_reputation_unread
    ON reputation_mentions(user_id, is_read)
    WHERE is_read = false;

-- ─── Config monitoring par partenaire ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reputation_monitor_config (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_id          INTEGER NOT NULL,

    is_active           BOOLEAN NOT NULL DEFAULT true,
    monitor_platforms   TEXT[] NOT NULL DEFAULT '{twitter,facebook,instagram}',
    keywords            TEXT[] NOT NULL DEFAULT '{}', -- mots-clés à surveiller
    -- Ex: ["NomBoutique", "NomCEO", "#hashtag_marque"]

    -- Seuils alerte
    crisis_sentiment_threshold  NUMERIC(4,3) DEFAULT -0.6,
    crisis_reach_threshold      INTEGER DEFAULT 1000,
    alert_on_negative           BOOLEAN NOT NULL DEFAULT true,
    alert_on_positive           BOOLEAN NOT NULL DEFAULT false, -- pour amplifier les bons avis

    -- Notification
    notify_whatsapp     TEXT,   -- numéro WhatsApp du manager
    notify_email        TEXT,
    notify_in_app       BOOLEAN NOT NULL DEFAULT true,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_reputation_config UNIQUE (user_id, service_id)
);

-- ─── Gestion de crise ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crisis_events (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_id          INTEGER NOT NULL,

    title               VARCHAR(500) NOT NULL,
    description         TEXT,
    crisis_level        INTEGER NOT NULL DEFAULT 1,   -- 1=faible 2=modéré 3=critique
    status              VARCHAR(20) NOT NULL DEFAULT 'detected',
    -- detected | analyzing | responding | resolved | monitoring

    -- Déclencheur
    trigger_mention_id  BIGINT REFERENCES reputation_mentions(id) ON DELETE SET NULL,
    trigger_platform    VARCHAR(30),
    trigger_content     TEXT,

    -- Réponse IA proposée
    ai_response_draft   TEXT,
    ai_response_approved BOOLEAN DEFAULT false,
    ai_response_sent    BOOLEAN DEFAULT false,
    ai_response_sent_at TIMESTAMPTZ,

    -- Impact estimé
    mentions_count      INTEGER DEFAULT 0,
    negative_reach      INTEGER DEFAULT 0,

    detected_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at         TIMESTAMPTZ,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crisis_user_status
    ON crisis_events(user_id, status, detected_at DESC);

-- ─── Forecasting tendances ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trend_forecasts (
    id                  SERIAL PRIMARY KEY,
    region              VARCHAR(10) NOT NULL,
    topic               VARCHAR(500) NOT NULL,
    categories          TEXT[],

    -- Prévisions J+1 à J+7
    forecast_day1       NUMERIC(5,2),
    forecast_day3       NUMERIC(5,2),
    forecast_day7       NUMERIC(5,2),
    forecast_day14      NUMERIC(5,2),

    confidence          NUMERIC(4,3),         -- 0-1 : confiance du modèle
    trend_direction     VARCHAR(20),          -- rising | peak | declining | stable
    peak_expected_at    TIMESTAMPTZ,          -- quand le pic est prévu

    -- Données historiques utilisées pour le calcul
    data_points         INTEGER DEFAULT 0,
    last_score          NUMERIC(5,2),
    avg_score_7d        NUMERIC(5,2),
    avg_score_30d       NUMERIC(5,2),

    model_version       VARCHAR(20) DEFAULT 'v1_linear',
    computed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_trend_forecast UNIQUE (region, topic, computed_at::date)
);

CREATE INDEX IF NOT EXISTS idx_trend_forecasts_region_topic
    ON trend_forecasts(region, topic, computed_at DESC);
CREATE INDEX IF NOT EXISTS idx_trend_forecasts_rising
    ON trend_forecasts(region, forecast_day3 DESC)
    WHERE trend_direction IN ('rising', 'peak');

-- ─── Calendrier collaboratif ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS editorial_calendar_members (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_id  INTEGER NOT NULL,
    member_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role        VARCHAR(20) NOT NULL DEFAULT 'viewer',
    -- viewer | editor | approver | publisher
    invited_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,
    CONSTRAINT uq_editorial_member UNIQUE (service_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_editorial_members_service
    ON editorial_calendar_members(service_id);

-- ─── Abonnements webhook tendances ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trend_webhook_subscriptions (
    id                      SERIAL PRIMARY KEY,
    user_id                 INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    region                  VARCHAR(10) NOT NULL,
    min_opportunity_score   NUMERIC(5,2) NOT NULL DEFAULT 70.0,
    categories              TEXT[] DEFAULT '{}',
    webhook_url             TEXT,          -- URL externe à notifier (vide = notif in-app uniquement)
    last_notified_at        TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_trend_webhook UNIQUE (user_id, region)
);

CREATE INDEX IF NOT EXISTS idx_trend_webhooks_user ON trend_webhook_subscriptions(user_id);

-- ─── Contenu long format ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS longform_content (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_id      INTEGER NOT NULL,

    content_type    VARCHAR(30) NOT NULL,
    -- youtube_script | blog_article | newsletter | linkedin_article | podcast_outline
    title           VARCHAR(500),
    content         TEXT NOT NULL,
    language        VARCHAR(10) DEFAULT 'fr',
    word_count      INTEGER,
    estimated_duration_min INTEGER,   -- pour scripts vidéo/podcast

    -- Référence produit/tendance associée
    linked_product_id  INTEGER,
    linked_trend_topic VARCHAR(500),

    status          VARCHAR(20) NOT NULL DEFAULT 'draft',
    -- draft | review | approved | published
    published_url   TEXT,
    published_at    TIMESTAMPTZ,

    ai_model_used   VARCHAR(50),
    generation_prompt TEXT,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_longform_user_type
    ON longform_content(user_id, content_type, created_at DESC);
