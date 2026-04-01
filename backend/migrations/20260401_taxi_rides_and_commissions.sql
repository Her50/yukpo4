-- ============================================================================
-- Migration : table taxi_rides (flow accept/refuse + tarification) +
--             table commissions_yukpo (traçabilité revenus plateforme)
-- ============================================================================

-- Table centrale des courses taxi
CREATE TABLE IF NOT EXISTS taxi_rides (
    id                      SERIAL PRIMARY KEY,
    user_id                 INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    taxi_id                 INTEGER NOT NULL REFERENCES taxis_ville(id) ON DELETE CASCADE,

    -- Itinéraire
    pickup_address          TEXT NOT NULL,
    pickup_lat              DOUBLE PRECISION,
    pickup_lon              DOUBLE PRECISION,
    dest_address            TEXT NOT NULL,
    dest_lat                DOUBLE PRECISION,
    dest_lon                DOUBLE PRECISION,

    -- Véhicule & estimation
    vehicle_type            VARCHAR(20) DEFAULT 'standard',  -- standard | confort | van | moto
    distance_km             DOUBLE PRECISION,
    duree_estimee_min       DOUBLE PRECISION,
    tarif_estime            DOUBLE PRECISION,               -- calculé à la demande
    tarif_final             DOUBLE PRECISION,               -- confirmé à la fin

    -- Commission
    commission_pct          DOUBLE PRECISION DEFAULT 0.15,
    commission_yukpo        DOUBLE PRECISION,               -- prélevé par la plateforme
    reversement_chauffeur   DOUBLE PRECISION,               -- net chauffeur

    -- Paiement
    methode_paiement        VARCHAR(30),   -- mtn_money | orange_money | carte | especes
    transaction_id          VARCHAR(100),

    -- Cycle de vie
    statut                  VARCHAR(20) NOT NULL DEFAULT 'pending',
    -- pending → accepted | refused
    -- accepted → completed | cancelled
    notes                   TEXT,
    refusal_reason          TEXT,

    -- Timestamps
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    accepted_at             TIMESTAMPTZ,
    refused_at              TIMESTAMPTZ,
    completed_at            TIMESTAMPTZ,
    cancelled_at            TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_taxi_rides_user    ON taxi_rides(user_id);
CREATE INDEX IF NOT EXISTS idx_taxi_rides_taxi    ON taxi_rides(taxi_id);
CREATE INDEX IF NOT EXISTS idx_taxi_rides_statut  ON taxi_rides(statut);
CREATE INDEX IF NOT EXISTS idx_taxi_rides_created ON taxi_rides(created_at DESC);

-- ============================================================================
-- Table de traçabilité des commissions Yukpo (multi-service)
-- Pattern unifié : livres (5%) + taxi (15%) + covoiturage (8%) + bus (3%) + livraison (20%)
-- ============================================================================

CREATE TABLE IF NOT EXISTS commissions_yukpo (
    id                      SERIAL PRIMARY KEY,
    service_type            VARCHAR(30) NOT NULL,
    -- taxi | covoiturage | bus | livraison | livre | pharmacie | hotel | ...

    reference_id            INTEGER,       -- ride_id | reservation_id | booking_id | ...
    reference_uuid          UUID,          -- pour les services avec UUID

    montant_total           DOUBLE PRECISION NOT NULL,
    commission_pct          DOUBLE PRECISION NOT NULL,
    montant_commission      DOUBLE PRECISION NOT NULL,
    reversement_prestataire DOUBLE PRECISION NOT NULL,

    methode_paiement        VARCHAR(30),
    transaction_id          VARCHAR(100),

    statut                  VARCHAR(20) DEFAULT 'paid',
    -- paid | pending | reversed (remboursement)

    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reversed_at             TIMESTAMPTZ,
    notes                   TEXT
);

CREATE INDEX IF NOT EXISTS idx_commissions_service  ON commissions_yukpo(service_type);
CREATE INDEX IF NOT EXISTS idx_commissions_ref      ON commissions_yukpo(reference_id);
CREATE INDEX IF NOT EXISTS idx_commissions_created  ON commissions_yukpo(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_commissions_statut   ON commissions_yukpo(statut);

-- Vue agrégée pour le dashboard revenus Yukpo
CREATE OR REPLACE VIEW v_revenus_yukpo AS
SELECT
    service_type,
    DATE_TRUNC('day', created_at)   AS jour,
    COUNT(*)                         AS nb_transactions,
    SUM(montant_total)               AS volume_total,
    SUM(montant_commission)          AS revenu_yukpo,
    SUM(reversement_prestataire)     AS reversement_total,
    AVG(commission_pct)              AS taux_moyen
FROM commissions_yukpo
WHERE statut = 'paid'
GROUP BY service_type, DATE_TRUNC('day', created_at);
