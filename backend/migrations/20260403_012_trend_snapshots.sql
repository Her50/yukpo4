-- =========================================================================
-- Migration: TrendPulse — Snapshots historiques des tendances
-- Permet : "en hausse depuis 3 jours", graphes d'évolution, alertes
-- =========================================================================

CREATE TABLE IF NOT EXISTS trend_snapshots (
    id BIGSERIAL PRIMARY KEY,
    region VARCHAR(10) NOT NULL,           -- CM, SN, CI, NG, ALL
    period VARCHAR(10) NOT NULL,           -- 24h, 7d, 30d
    topic TEXT NOT NULL,
    social_score NUMERIC(5,2) NOT NULL DEFAULT 0,
    commerce_score NUMERIC(5,2) NOT NULL DEFAULT 0,
    opportunity_score NUMERIC(5,2) NOT NULL DEFAULT 0,
    momentum_pct NUMERIC(6,2) NOT NULL DEFAULT 0,
    categories TEXT[] NOT NULL DEFAULT '{}',
    sources TEXT[] NOT NULL DEFAULT '{}',
    snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Comparaison avec snapshot précédent (calculé à l'insert)
    prev_opportunity_score NUMERIC(5,2),
    score_delta NUMERIC(5,2) GENERATED ALWAYS AS (
        CASE WHEN prev_opportunity_score IS NOT NULL
             THEN opportunity_score - prev_opportunity_score
             ELSE NULL
        END
    ) STORED
);

-- Index pour requêtes historiques rapides
CREATE INDEX IF NOT EXISTS idx_trend_snapshots_region_topic ON trend_snapshots(region, topic, snapshot_at DESC);
CREATE INDEX IF NOT EXISTS idx_trend_snapshots_snapshot_at ON trend_snapshots(snapshot_at DESC);
CREATE INDEX IF NOT EXISTS idx_trend_snapshots_opportunity ON trend_snapshots(opportunity_score DESC) WHERE opportunity_score >= 70;

-- Vue matérialisée : tendances en hausse sur 3 jours consécutifs
CREATE OR REPLACE VIEW trend_rising_3days AS
SELECT
    region,
    topic,
    MAX(opportunity_score) as peak_score,
    MIN(opportunity_score) as floor_score,
    AVG(score_delta) as avg_daily_delta,
    COUNT(*) as snapshot_count,
    MAX(snapshot_at) as last_seen_at
FROM trend_snapshots
WHERE snapshot_at >= NOW() - INTERVAL '3 days'
  AND score_delta > 0
GROUP BY region, topic
HAVING COUNT(*) >= 2
   AND AVG(score_delta) > 3.0
ORDER BY avg_daily_delta DESC;

-- Table des alertes TrendPulse déjà envoyées (évite les doublons)
CREATE TABLE IF NOT EXISTS trend_alerts_sent (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    topic TEXT NOT NULL,
    region VARCHAR(10) NOT NULL,
    opportunity_score NUMERIC(5,2) NOT NULL,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Pas deux alertes sur le même topic pour le même user dans les 24h
    CONSTRAINT uq_trend_alert_24h UNIQUE (user_id, topic, region)
);

-- Index pour nettoyage des vieilles alertes
CREATE INDEX IF NOT EXISTS idx_trend_alerts_sent_at ON trend_alerts_sent(sent_at DESC);

COMMENT ON TABLE trend_snapshots IS 'Historique horaire des scores TrendPulse par région. Permet le calcul de momentum multi-jours.';
COMMENT ON TABLE trend_alerts_sent IS 'Trace des alertes push TrendPulse envoyées. Évite les doublons dans les 24h.';
