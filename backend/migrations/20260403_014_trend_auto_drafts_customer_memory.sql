-- =========================================================================
-- Migration: Trend Auto Drafts + Customer Memory CRM + Social Analytics
-- =========================================================================

-- ─── Brouillons auto générés depuis tendances ─────────────────────────────────
CREATE TABLE IF NOT EXISTS trend_auto_drafts (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_id          INTEGER NOT NULL,
    region              VARCHAR(10) NOT NULL,
    topic               VARCHAR(500) NOT NULL,
    opportunity_score   NUMERIC(5,2) NOT NULL,

    -- Brouillons par plateforme
    draft_caption       TEXT,
    draft_instagram     TEXT,
    draft_facebook      TEXT,
    draft_tiktok        TEXT,
    draft_twitter       TEXT,
    draft_linkedin      TEXT,

    -- Statut
    status              VARCHAR(20) NOT NULL DEFAULT 'draft',
    -- draft | published | dismissed
    published_post_id   INTEGER REFERENCES social_ai_posts(id) ON DELETE SET NULL,
    dismissed_at        TIMESTAMPTZ,

    generated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trend_auto_drafts_user
    ON trend_auto_drafts(user_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_trend_auto_drafts_pending
    ON trend_auto_drafts(user_id, status)
    WHERE status = 'draft';

-- ─── Customer Memory CRM — mémoire persistante clients chatbot ────────────────
CREATE TABLE IF NOT EXISTS customer_memory (
    id                  BIGSERIAL PRIMARY KEY,
    user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_id          INTEGER NOT NULL,
    customer_external_id VARCHAR(200) NOT NULL, -- sender_id plateforme
    platform            VARCHAR(30) NOT NULL,

    -- Profil client déduit
    customer_name       VARCHAR(200),
    language_detected   VARCHAR(20),
    sentiment_overall   VARCHAR(20) DEFAULT 'neutral',
    -- positive | neutral | negative | vip

    -- Historique achats (résumé)
    total_orders        INTEGER DEFAULT 0,
    last_order_at       TIMESTAMPTZ,
    total_spent_fcfa    BIGINT DEFAULT 0,
    preferred_products  TEXT[],   -- produits commandés le plus souvent
    preferred_category  VARCHAR(100),

    -- Contexte conversationnel
    last_intent         VARCHAR(100),  -- dernière intention détectée
    open_issues         TEXT[],        -- problèmes non résolus
    follow_up_needed    BOOLEAN DEFAULT false,
    follow_up_note      TEXT,
    follow_up_at        TIMESTAMPTZ,

    -- Préférences
    preferred_language  VARCHAR(20),
    prefers_human       BOOLEAN DEFAULT false,  -- préfère un agent humain
    is_vip              BOOLEAN DEFAULT false,
    vip_reason          TEXT,

    -- Stats conversation
    conversation_count  INTEGER DEFAULT 0,
    escalation_count    INTEGER DEFAULT 0,
    last_seen_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    first_seen_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_customer_memory UNIQUE (user_id, service_id, platform, customer_external_id)
);

CREATE INDEX IF NOT EXISTS idx_customer_memory_user_platform
    ON customer_memory(user_id, service_id, platform, customer_external_id);
CREATE INDEX IF NOT EXISTS idx_customer_memory_follow_up
    ON customer_memory(user_id, follow_up_needed, follow_up_at)
    WHERE follow_up_needed = true;
CREATE INDEX IF NOT EXISTS idx_customer_memory_vip
    ON customer_memory(user_id, is_vip)
    WHERE is_vip = true;

-- ─── Social Analytics agrégés cross-plateformes ──────────────────────────────
CREATE TABLE IF NOT EXISTS social_post_analytics (
    id                  BIGSERIAL PRIMARY KEY,
    user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_id          INTEGER NOT NULL,
    post_id             INTEGER REFERENCES social_ai_posts(id) ON DELETE SET NULL,
    platform            VARCHAR(30) NOT NULL,
    external_post_id    VARCHAR(200),

    -- Métriques engagement
    impressions         BIGINT DEFAULT 0,
    reach               BIGINT DEFAULT 0,
    likes               BIGINT DEFAULT 0,
    comments            INTEGER DEFAULT 0,
    shares              INTEGER DEFAULT 0,
    saves               INTEGER DEFAULT 0,
    clicks              INTEGER DEFAULT 0,
    video_views         BIGINT DEFAULT 0,
    video_watch_rate    NUMERIC(5,2),  -- % vu jusqu'à la fin

    -- Business metrics
    link_clicks         INTEGER DEFAULT 0,
    profile_visits      INTEGER DEFAULT 0,
    orders_attributed   INTEGER DEFAULT 0,   -- commandes tracées depuis ce post
    revenue_attributed  BIGINT DEFAULT 0,    -- revenus en FCFA

    -- Scores calculés
    engagement_rate     NUMERIC(6,3),        -- (likes+comments+shares)/reach*100
    effectiveness_score NUMERIC(5,2),        -- score composite Yukpo 0-100

    -- Métadonnées
    published_at        TIMESTAMPTZ,
    synced_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_analytics_user_platform
    ON social_post_analytics(user_id, platform, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_analytics_service
    ON social_post_analytics(service_id, published_at DESC);

-- ─── Aggregats hebdomadaires cross-plateformes ────────────────────────────────
CREATE TABLE IF NOT EXISTS social_analytics_weekly (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_id          INTEGER NOT NULL,
    week_start          DATE NOT NULL,
    platform            VARCHAR(30) NOT NULL DEFAULT 'all',

    posts_published     INTEGER DEFAULT 0,
    total_impressions   BIGINT DEFAULT 0,
    total_reach         BIGINT DEFAULT 0,
    total_engagement    BIGINT DEFAULT 0,
    avg_engagement_rate NUMERIC(6,3),
    top_post_id         INTEGER REFERENCES social_ai_posts(id) ON DELETE SET NULL,
    top_post_score      NUMERIC(5,2),
    followers_gained    INTEGER DEFAULT 0,
    orders_attributed   INTEGER DEFAULT 0,
    revenue_attributed  BIGINT DEFAULT 0,

    computed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_analytics_weekly UNIQUE (user_id, service_id, week_start, platform)
);

CREATE INDEX IF NOT EXISTS idx_social_analytics_weekly_user
    ON social_analytics_weekly(user_id, week_start DESC);

-- ─── Abonnements TrendPulse B2B (API monétisée) ───────────────────────────────
CREATE TABLE IF NOT EXISTS trendpulse_b2b_subscriptions (
    id                  SERIAL PRIMARY KEY,
    subscriber_name     VARCHAR(200) NOT NULL,
    subscriber_email    VARCHAR(200) NOT NULL UNIQUE,
    api_key             VARCHAR(64) NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,

    -- Plan
    plan                VARCHAR(30) NOT NULL DEFAULT 'starter',
    -- starter | professional | enterprise
    monthly_price_usd   NUMERIC(10,2) NOT NULL DEFAULT 99.00,
    requests_per_month  INTEGER NOT NULL DEFAULT 1000,
    requests_used       INTEGER DEFAULT 0,
    regions_allowed     TEXT[] NOT NULL DEFAULT '{}',  -- vide = toutes
    categories_allowed  TEXT[] NOT NULL DEFAULT '{}',  -- vide = toutes

    -- Accès
    is_active           BOOLEAN NOT NULL DEFAULT true,
    expires_at          TIMESTAMPTZ,
    last_request_at     TIMESTAMPTZ,

    -- Billing
    stripe_customer_id  VARCHAR(100),
    stripe_sub_id       VARCHAR(100),

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_b2b_api_key ON trendpulse_b2b_subscriptions(api_key);

-- ─── Longform external publishing (WordPress, Mailchimp, Ghost) ───────────────
CREATE TABLE IF NOT EXISTS longform_publish_targets (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_id          INTEGER NOT NULL,

    platform            VARCHAR(30) NOT NULL,
    -- wordpress | mailchimp | ghost | medium | substack

    -- Credentials (chiffrés en production)
    site_url            TEXT,
    api_key             TEXT,
    username            TEXT,
    list_id             TEXT,        -- Mailchimp audience ID
    author_id           TEXT,        -- Ghost author ID

    is_active           BOOLEAN NOT NULL DEFAULT true,
    last_published_at   TIMESTAMPTZ,
    total_published     INTEGER DEFAULT 0,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_longform_target UNIQUE (user_id, service_id, platform)
);

-- ─── Connexions e-commerce (Shopify, WooCommerce, Jumia) ─────────────────────
CREATE TABLE IF NOT EXISTS ecommerce_connections (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_id          INTEGER NOT NULL,

    platform            VARCHAR(30) NOT NULL,
    -- shopify | woocommerce | jumia | konga | prestashop | magento

    shop_url            TEXT,
    api_key             TEXT,
    api_secret          TEXT,
    access_token        TEXT,
    store_id            VARCHAR(100),

    -- Stats sync
    last_sync_at        TIMESTAMPTZ,
    products_synced     INTEGER DEFAULT 0,
    orders_synced       INTEGER DEFAULT 0,
    is_active           BOOLEAN NOT NULL DEFAULT true,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_ecommerce_connection UNIQUE (user_id, service_id, platform)
);
