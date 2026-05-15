-- Phase B2 (2026-05-15) : préparation anticipée pharmacie + rappels de prise.
--
-- B2.1 : préparation anticipée (click & collect pharmacie)
--   Quand un pharmacien répond favorablement à une alerte RFQ, il peut
--   préparer physiquement les médicaments à l'avance. Un QR de retrait
--   unique est généré côté patient ; le pharmacien le scanne au moment du
--   retrait pour valider et marquer la sortie de stock.
--
-- B2.2 : rappels de prise (intake reminders)
--   Patient peut configurer des rappels (cron simple) pour ses médicaments
--   en cours. Un worker tokio scan toutes les minutes et envoie push web.

-- B2.1 — Colonnes additionnelles sur pharmacy_responses pour le retrait
ALTER TABLE pharmacy_responses
    ADD COLUMN IF NOT EXISTS prepared_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS pickup_qr_code VARCHAR(64),
    ADD COLUMN IF NOT EXISTS picked_up_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pharmacy_responses_pickup_qr
    ON pharmacy_responses (pickup_qr_code)
    WHERE pickup_qr_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pharmacy_responses_prepared
    ON pharmacy_responses (pharmacy_id, prepared_at DESC)
    WHERE prepared_at IS NOT NULL AND picked_up_at IS NULL;

-- B2.2 — Table des rappels de prise. Format JSONB pour souplesse sur la
-- planification (rappel toutes les 6h, ou à 8h/13h/20h, ou cron custom).
CREATE TABLE IF NOT EXISTS medication_intake_reminders (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- Nom usuel du médicament (libre, fourni par le patient à la création)
    medication_name VARCHAR(255) NOT NULL,
    -- Dosage / posologie indicative (texte libre, ex : "1 comprimé matin/soir")
    posology TEXT,
    -- Heures précises de prise dans la journée (format "HH:MM") :
    -- ex ["08:00", "13:00", "20:00"]. Le worker scan toutes les minutes
    -- et envoie une push si l'heure courante (timezone user) matche.
    times_of_day JSONB NOT NULL DEFAULT '[]',
    -- Date de fin (cure courte) — NULL = rappel permanent.
    end_at DATE,
    -- Timezone du patient (défaut Africa/Douala). Sert au worker pour
    -- comparer l'heure locale avec times_of_day.
    timezone VARCHAR(64) NOT NULL DEFAULT 'Africa/Douala',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    -- Dernière fois où un rappel a été envoyé (anti-doublon dans la minute)
    last_sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_intake_reminders_user_active
    ON medication_intake_reminders (user_id, is_active)
    WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_intake_reminders_active_scan
    ON medication_intake_reminders (is_active, end_at)
    WHERE is_active = TRUE;
