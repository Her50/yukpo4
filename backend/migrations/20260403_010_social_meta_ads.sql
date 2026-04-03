-- =========================================================================
-- Migration: Meta Ads Automation
-- Campagnes publicitaires Facebook/Instagram/WhatsApp automatiques
-- =========================================================================

-- ─── Comptes publicitaires Meta liés ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS meta_ad_accounts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_id INTEGER NOT NULL,
    ad_account_id VARCHAR(100) NOT NULL,     -- act_XXXXXXXXXX
    ad_account_name VARCHAR(255),
    currency VARCHAR(10) NOT NULL DEFAULT 'XAF',
    timezone VARCHAR(50),
    account_status INTEGER,                  -- 1=active, 2=disabled, 3=unsettled
    spend_cap BIGINT,                        -- en centimes
    balance BIGINT,
    monthly_budget_fcfa BIGINT NOT NULL DEFAULT 0,
    monthly_spent_fcfa BIGINT NOT NULL DEFAULT 0,
    budget_reset_day INTEGER NOT NULL DEFAULT 1, -- jour du mois pour reset compteur
    pixel_id VARCHAR(100),                   -- Meta Pixel pour tracking conversions
    pixel_active BOOLEAN NOT NULL DEFAULT false,
    access_token TEXT NOT NULL,
    token_expires_at TIMESTAMPTZ,
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_meta_ad_account UNIQUE (user_id, ad_account_id)
);

CREATE INDEX IF NOT EXISTS idx_meta_ad_accounts_user ON meta_ad_accounts(user_id, service_id);

-- ─── Campagnes publicitaires ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS meta_ad_campaigns (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_id INTEGER NOT NULL,
    ad_account_id INTEGER NOT NULL REFERENCES meta_ad_accounts(id) ON DELETE CASCADE,
    external_campaign_id VARCHAR(100),       -- ID Meta côté API
    name VARCHAR(255) NOT NULL,
    objective VARCHAR(50) NOT NULL,          -- OUTCOME_TRAFFIC, OUTCOME_SALES, OUTCOME_AWARENESS
    campaign_type VARCHAR(50) NOT NULL,      -- manual, auto_promo, dynamic_product, click_to_whatsapp
    status VARCHAR(30) NOT NULL DEFAULT 'pending', -- pending, active, paused, completed, failed
    budget_daily_fcfa BIGINT,
    budget_total_fcfa BIGINT,
    spent_fcfa BIGINT NOT NULL DEFAULT 0,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    -- Performance
    impressions BIGINT NOT NULL DEFAULT 0,
    clicks BIGINT NOT NULL DEFAULT 0,
    conversions INTEGER NOT NULL DEFAULT 0,
    yukpo_orders INTEGER NOT NULL DEFAULT 0, -- commandes Yukpo tracées
    revenue_fcfa BIGINT NOT NULL DEFAULT 0,
    cpm_fcfa NUMERIC(10,2),                  -- coût pour mille impressions
    cpc_fcfa NUMERIC(10,2),                  -- coût par clic
    roas NUMERIC(6,2),                       -- return on ad spend
    -- Config
    trigger_type VARCHAR(50),                -- on_promo, scheduled, manual, catalog_change
    trigger_condition JSONB,                 -- {min_discount: 20, ...}
    target_product_ids INTEGER[],
    creative_config JSONB NOT NULL DEFAULT '{}',
    audience_config JSONB NOT NULL DEFAULT '{}',
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meta_campaigns_user_service ON meta_ad_campaigns(user_id, service_id);
CREATE INDEX IF NOT EXISTS idx_meta_campaigns_status ON meta_ad_campaigns(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_meta_campaigns_type ON meta_ad_campaigns(campaign_type);

-- ─── Ad Sets (audiences) ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS meta_ad_sets (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER NOT NULL REFERENCES meta_ad_campaigns(id) ON DELETE CASCADE,
    external_adset_id VARCHAR(100),
    name VARCHAR(255) NOT NULL,
    targeting JSONB NOT NULL DEFAULT '{}',   -- geo, age, interests, custom_audiences
    optimization_goal VARCHAR(50) NOT NULL DEFAULT 'LINK_CLICKS',
    billing_event VARCHAR(50) NOT NULL DEFAULT 'IMPRESSIONS',
    bid_amount BIGINT,                       -- bid en centimes
    status VARCHAR(30) NOT NULL DEFAULT 'active',
    impressions BIGINT NOT NULL DEFAULT 0,
    clicks BIGINT NOT NULL DEFAULT 0,
    spent_fcfa BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meta_adsets_campaign ON meta_ad_sets(campaign_id);

-- ─── Créatifs publicitaires ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS meta_ad_creatives (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER NOT NULL REFERENCES meta_ad_campaigns(id) ON DELETE CASCADE,
    external_creative_id VARCHAR(100),
    ad_format VARCHAR(30) NOT NULL,          -- single_image, carousel, video, catalog
    headline TEXT,
    body TEXT NOT NULL,
    call_to_action VARCHAR(50) NOT NULL DEFAULT 'SHOP_NOW',
    link_url TEXT,
    image_url TEXT,
    video_url TEXT,
    product_ids INTEGER[],                   -- pour Dynamic Product Ads
    catalog_id VARCHAR(100),                 -- pour catalog ads
    status VARCHAR(30) NOT NULL DEFAULT 'active',
    -- Performance créatif
    impressions BIGINT NOT NULL DEFAULT 0,
    clicks BIGINT NOT NULL DEFAULT 0,
    ctr NUMERIC(6,4),                        -- click-through rate
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meta_creatives_campaign ON meta_ad_creatives(campaign_id);

-- ─── Règles d'automatisation publicitaire ────────────────────────────────────
CREATE TABLE IF NOT EXISTS meta_ads_automation_rules (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_id INTEGER NOT NULL,
    ad_account_id INTEGER REFERENCES meta_ad_accounts(id) ON DELETE SET NULL,
    rule_name VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    -- Déclencheur
    trigger_event VARCHAR(50) NOT NULL,      -- new_promo, daily_schedule, low_stock, new_product
    trigger_config JSONB NOT NULL DEFAULT '{}',
    -- Action
    action_type VARCHAR(50) NOT NULL,        -- create_campaign, pause_campaign, increase_budget
    action_config JSONB NOT NULL DEFAULT '{}',
    -- Contraintes budget
    max_daily_budget_fcfa BIGINT NOT NULL DEFAULT 5000,
    max_monthly_budget_fcfa BIGINT NOT NULL DEFAULT 50000,
    last_triggered_at TIMESTAMPTZ,
    trigger_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meta_automation_rules_user ON meta_ads_automation_rules(user_id, service_id);
CREATE INDEX IF NOT EXISTS idx_meta_automation_rules_active ON meta_ads_automation_rules(is_active) WHERE is_active = true;

-- ─── Historique dépenses ads (pour reporting) ────────────────────────────────
CREATE TABLE IF NOT EXISTS meta_ads_spend_log (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ad_account_id INTEGER REFERENCES meta_ad_accounts(id) ON DELETE SET NULL,
    campaign_id INTEGER REFERENCES meta_ad_campaigns(id) ON DELETE SET NULL,
    date DATE NOT NULL,
    spend_fcfa BIGINT NOT NULL DEFAULT 0,
    impressions BIGINT NOT NULL DEFAULT 0,
    clicks BIGINT NOT NULL DEFAULT 0,
    conversions INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_ads_spend_log UNIQUE (campaign_id, date)
);

CREATE INDEX IF NOT EXISTS idx_meta_spend_log_user_date ON meta_ads_spend_log(user_id, date DESC);
