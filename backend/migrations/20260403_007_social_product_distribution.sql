-- Migration: Distribution produits multi-canaux sociaux
-- Tables pour: jobs de distribution, règles d'automatisation, historique

-- Jobs de distribution produit (par opposition à media_distribution qui gère les vidéos)
CREATE TABLE IF NOT EXISTS product_distribution_jobs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    platform VARCHAR(50) NOT NULL,             -- facebook, instagram, whatsapp, google_shopping
    caption TEXT,
    product_url TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'queued', -- queued, processing, completed, failed
    external_post_id VARCHAR(255),             -- ID du post sur la plateforme externe
    clicks_back BIGINT NOT NULL DEFAULT 0,     -- Clics retour vers Yukpo trackés
    error_message TEXT,
    attempt INTEGER NOT NULL DEFAULT 0,
    scheduled_for TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prod_dist_jobs_user_service
    ON product_distribution_jobs(user_id, service_id);
CREATE INDEX IF NOT EXISTS idx_prod_dist_jobs_status_scheduled
    ON product_distribution_jobs(status, scheduled_for)
    WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS idx_prod_dist_jobs_platform
    ON product_distribution_jobs(platform);

-- Règles d'automatisation par partenaire/service
CREATE TABLE IF NOT EXISTS distribution_rules (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_id INTEGER NOT NULL,
    rules JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_distribution_rules UNIQUE (user_id, service_id)
);

CREATE INDEX IF NOT EXISTS idx_distribution_rules_user
    ON distribution_rules(user_id);

-- Tracking UTM retour: quand un client clique sur un lien distribué et revient dans Yukpo
CREATE TABLE IF NOT EXISTS distribution_click_tracking (
    id SERIAL PRIMARY KEY,
    product_distribution_job_id INTEGER REFERENCES product_distribution_jobs(id) ON DELETE SET NULL,
    platform VARCHAR(50),
    product_id INTEGER,
    service_id INTEGER,
    user_agent TEXT,
    ip_hash VARCHAR(64),   -- hash de l'IP pour analytics sans stocker l'IP brute
    clicked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dist_click_job ON distribution_click_tracking(product_distribution_job_id);
CREATE INDEX IF NOT EXISTS idx_dist_click_service ON distribution_click_tracking(service_id, clicked_at);
