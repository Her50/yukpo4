-- Phase C2 (2026-05-15) : Surplus B2B entre pharmacies.
--
-- Logique :
--   Une pharmacie A en surstock proche péremption propose à une pharmacie B
--   voisine. Légalement autorisé entre confrères (déjà pratiqué hors-app
--   par WhatsApp). On formalise l'échange via Yukpo pour réduire la perte
--   péremption et améliorer la disponibilité régionale.
--
-- Workflow :
--   1) Pharmacie A déclare un surplus (médicament, quantité, expiry, prix).
--   2) Le surplus est visible aux pharmacies dans un rayon (défaut 50 km)
--      qui consultent l'onglet "Garde" du dashboard.
--   3) Pharmacie B clique "Réclamer" → status passe à "claimed", on stocke
--      qui a réclamé. Les deux pharmacies se contactent ensuite hors-app
--      pour finaliser le transfert physique (la plateforme ne gère pas le
--      paiement B2B pour ce MVP).

CREATE TABLE IF NOT EXISTS pharmacy_surplus (
    id BIGSERIAL PRIMARY KEY,
    pharmacy_id INTEGER NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
    -- Pharmacien qui a créé l'annonce (traçabilité)
    created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    -- Médicament concerné
    medication_name VARCHAR(255) NOT NULL,
    dosage VARCHAR(80),
    -- Quantité disponible (en unités logiques : boîtes, flacons…)
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    quantity_unit VARCHAR(40) NOT NULL DEFAULT 'boite',
    -- Lot et péremption — obligation MINSANTE pour traçabilité B2B.
    batch_number VARCHAR(80),
    expiry_date DATE NOT NULL,
    -- Prix unitaire proposé (FCFA). Souvent < prix harmonisé MINSANTE pour
    -- inciter le confrère à racheter (récupération partielle vs perte totale).
    unit_price_xaf DOUBLE PRECISION,
    -- Note libre du vendeur (ex : "stock surévalué, je propose -30%")
    note TEXT,
    -- Statut :
    --   open    : visible, réclamable
    --   claimed : un confrère a cliqué "réclamer" → contact en cours
    --   sold    : transfert finalisé (annonce inactive)
    --   expired : péremption atteinte ou retiré
    status VARCHAR(20) NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'claimed', 'sold', 'expired')),
    -- Qui a réclamé (NULL si pas encore réclamé)
    claimed_by_pharmacy_id INTEGER REFERENCES pharmacies(id) ON DELETE SET NULL,
    claimed_at TIMESTAMPTZ,
    -- Quand l'annonce expire automatiquement (par défaut 30 jours après création
    -- ou la date de péremption, le plus court). Le worker (cf. nightly_jobs)
    -- bascule en 'expired' au-delà.
    auto_expire_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Recherche par zone géographique (la pharmacie source a un gps,
-- on filtre par distance dans la requête applicative).
CREATE INDEX IF NOT EXISTS idx_pharmacy_surplus_open
    ON pharmacy_surplus (status, expiry_date)
    WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_pharmacy_surplus_pharmacy
    ON pharmacy_surplus (pharmacy_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pharmacy_surplus_medication
    ON pharmacy_surplus (lower(medication_name))
    WHERE status = 'open';
