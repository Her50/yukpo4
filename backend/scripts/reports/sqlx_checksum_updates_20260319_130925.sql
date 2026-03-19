-- SQLx checksum normalization (SAFE) - generated 2026-03-19T13:09:31
BEGIN;
CREATE TABLE IF NOT EXISTS _sqlx_migrations_checksum_backup (
    backup_id BIGSERIAL PRIMARY KEY,
    backup_ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    version BIGINT NOT NULL,
    description TEXT,
    checksum BYTEA,
    success BOOLEAN
);
COMMIT;
