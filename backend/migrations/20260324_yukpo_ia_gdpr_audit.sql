-- Journal d’audit RGPD YukpoIA (export JSON, suppression données) — idempotent
-- À appliquer avec apply_sql_gcp_cloudsql.ps1 si besoin manuel GCP

CREATE TABLE IF NOT EXISTS yukpo_ia_gdpr_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(32) NOT NULL CHECK (action IN ('export', 'delete')),
    client_ip VARCHAR(64),
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_yukpo_ia_gdpr_audit_user ON yukpo_ia_gdpr_audit(user_id, created_at DESC);
