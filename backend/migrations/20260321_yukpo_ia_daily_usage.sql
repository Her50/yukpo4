-- Quota journalier YukpoIA (unités alignées sur la facturation tokens côté app)
CREATE TABLE IF NOT EXISTS yukpo_ia_daily_usage (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    usage_date DATE NOT NULL,
    free_token_units_consumed BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, usage_date)
);

CREATE INDEX IF NOT EXISTS idx_yukpo_ia_daily_usage_date
    ON yukpo_ia_daily_usage(usage_date);

COMMENT ON TABLE yukpo_ia_daily_usage IS 'Compteur par jour (UTC) des unités gratuites YukpoIA consommées par utilisateur';
