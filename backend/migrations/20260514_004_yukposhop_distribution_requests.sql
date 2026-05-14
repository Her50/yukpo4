-- Piste 4 — Queue dédiée pour les demandes de distribution sociale venant
-- de YukpoShop (via le bridge HMAC). Un worker Rust pickera ces lignes
-- en status='pending' et invoquera la logique social_distribution réelle
-- avec le rust_user_id correspondant.
--
-- Pourquoi pas réutiliser service_distribution_queue existante :
-- elle est partagée avec d'autres callers et son schema risque de bouger ;
-- mieux vaut isoler les requêtes bridge dans leur propre table pour
-- audit + retry indépendant.

CREATE TABLE IF NOT EXISTS yukposhop_distribution_requests (
    id                 BIGSERIAL PRIMARY KEY,
    rust_service_id    INTEGER      NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    rust_user_id       INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    external_id        VARCHAR(120) NOT NULL,    -- id côté YukpoShop
    platform           VARCHAR(40)  NOT NULL,    -- facebook | instagram | whatsapp | tiktok | youtube
    message_template   TEXT,                     -- caption custom (optionnel)
    status             VARCHAR(20)  NOT NULL DEFAULT 'pending',
                                                 -- pending | processing | done | failed | retry
    last_error         TEXT,
    attempts           INTEGER      NOT NULL DEFAULT 0,
    processed_at       TIMESTAMPTZ,
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_yukposhop_dist_status_pending
    ON yukposhop_distribution_requests(status, created_at)
    WHERE status IN ('pending', 'retry');

CREATE INDEX IF NOT EXISTS idx_yukposhop_dist_user
    ON yukposhop_distribution_requests(rust_user_id);

CREATE INDEX IF NOT EXISTS idx_yukposhop_dist_service
    ON yukposhop_distribution_requests(rust_service_id);
