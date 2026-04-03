-- =========================================================================
-- Migration: Social AI Content Engine
-- Génération IA de contenu, scheduler, A/B testing, posts planifiés
-- =========================================================================

-- ─── Table des posts générés/planifiés ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS social_ai_posts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_id INTEGER NOT NULL,
    platform VARCHAR(50) NOT NULL,           -- facebook, instagram, whatsapp, youtube
    product_id INTEGER,                       -- null = post générique
    content_type VARCHAR(50) NOT NULL DEFAULT 'product', -- product, promo, story, carousel, reel
    caption TEXT NOT NULL,
    caption_variant_b TEXT,                  -- variante A/B
    hashtags TEXT[],
    image_url TEXT,
    link_url TEXT,
    scheduled_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    status VARCHAR(30) NOT NULL DEFAULT 'draft', -- draft, scheduled, publishing, published, failed, cancelled
    external_post_id VARCHAR(255),
    tone VARCHAR(30) NOT NULL DEFAULT 'professional', -- professional, casual, promotional, urgent
    language VARCHAR(10) NOT NULL DEFAULT 'fr',
    ab_winner VARCHAR(1),                    -- 'A' ou 'B' (déterminé par engagement après 24h)
    engagement_a INTEGER NOT NULL DEFAULT 0,
    engagement_b INTEGER NOT NULL DEFAULT 0,
    ai_model VARCHAR(50) DEFAULT 'gpt-4o',
    generation_prompt TEXT,                  -- prompt envoyé à l'IA (pour debug/audit)
    error_message TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_ai_posts_user_service ON social_ai_posts(user_id, service_id);
CREATE INDEX IF NOT EXISTS idx_social_ai_posts_status_scheduled ON social_ai_posts(status, scheduled_at) WHERE status IN ('scheduled', 'draft');
CREATE INDEX IF NOT EXISTS idx_social_ai_posts_platform ON social_ai_posts(platform);
CREATE INDEX IF NOT EXISTS idx_social_ai_posts_published_at ON social_ai_posts(published_at DESC) WHERE published_at IS NOT NULL;

-- ─── Préférences de contenu par partenaire ───────────────────────────────────
CREATE TABLE IF NOT EXISTS social_ai_preferences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_id INTEGER NOT NULL,
    default_tone VARCHAR(30) NOT NULL DEFAULT 'professional',
    default_language VARCHAR(10) NOT NULL DEFAULT 'fr',
    brand_voice TEXT,                        -- description de la voix de marque
    forbidden_words TEXT[],                  -- mots à éviter
    always_include TEXT[],                   -- éléments toujours présents (ex: numéro de tél)
    default_hashtags TEXT[],
    post_template TEXT,                      -- template personnalisé avec {variables}
    auto_ab_test BOOLEAN NOT NULL DEFAULT true,
    best_posting_hours INTEGER[] DEFAULT ARRAY[8, 12, 18], -- heures optimales
    platforms_active JSONB NOT NULL DEFAULT '{}', -- {facebook: true, instagram: true, ...}
    max_posts_per_day INTEGER NOT NULL DEFAULT 5,
    sector VARCHAR(50),                      -- supermarket, electronics, clothing, pharmacy
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_social_ai_preferences UNIQUE (user_id, service_id)
);

-- ─── Analytics des posts publiés ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS social_ai_post_analytics (
    id SERIAL PRIMARY KEY,
    post_id INTEGER NOT NULL REFERENCES social_ai_posts(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL,
    impressions BIGINT NOT NULL DEFAULT 0,
    reach BIGINT NOT NULL DEFAULT 0,
    likes INTEGER NOT NULL DEFAULT 0,
    comments INTEGER NOT NULL DEFAULT 0,
    shares INTEGER NOT NULL DEFAULT 0,
    clicks INTEGER NOT NULL DEFAULT 0,
    yukpo_conversions INTEGER NOT NULL DEFAULT 0, -- commandes générées depuis ce post
    revenue_fcfa BIGINT NOT NULL DEFAULT 0,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_post_analytics UNIQUE (post_id)
);

CREATE INDEX IF NOT EXISTS idx_social_ai_analytics_post ON social_ai_post_analytics(post_id);
