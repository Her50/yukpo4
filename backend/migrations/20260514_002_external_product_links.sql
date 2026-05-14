-- Piste 1 — Table pivot pour idempotency YukpoShop -> services Rust
-- Permet d'upsert un produit YukpoShop dans la table services en utilisant
-- (source_app, external_id) comme clé unique (idempotent retry-safe).

CREATE TABLE IF NOT EXISTS external_product_links (
    id              BIGSERIAL PRIMARY KEY,
    source_app      VARCHAR(40)  NOT NULL,
    external_id     VARCHAR(120) NOT NULL,
    rust_service_id INTEGER      NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    rust_user_id    INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    payload_jsonb   JSONB        NOT NULL,
    schema_version  INTEGER      NOT NULL DEFAULT 1,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (source_app, external_id)
);

CREATE INDEX IF NOT EXISTS idx_external_product_links_service_id
    ON external_product_links(rust_service_id);

CREATE INDEX IF NOT EXISTS idx_external_product_links_user_id
    ON external_product_links(rust_user_id);
