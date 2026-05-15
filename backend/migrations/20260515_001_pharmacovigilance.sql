-- Pharmacovigilance : signalements d'effets indésirables ou problèmes liés
-- à un médicament, faits par le pharmacien partenaire.
--
-- Cas d'usage :
--   - Patient revient avec un effet indésirable inattendu
--   - Lot de médicament suspect (qualité, contrefaçon)
--   - Interaction non documentée observée
--
-- À terme, ces signalements pourront être agrégés et transmis aux autorités
-- (ANSM-CM / MINSANTE) pour une surveillance épidémiologique. Pour cette
-- itération MVP : stockage en base + reporting analytique côté Yukpo.

CREATE TABLE IF NOT EXISTS pharmacovigilance_reports (
    id BIGSERIAL PRIMARY KEY,
    pharmacy_id INTEGER REFERENCES pharmacies(id) ON DELETE SET NULL,
    pharmacy_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- Médicament concerné
    medication_name VARCHAR(255) NOT NULL,
    medication_dosage VARCHAR(100),
    medication_batch VARCHAR(100),
    medication_manufacturer VARCHAR(255),
    -- Patient (anonymisé : pas de nom complet conservé sauf si pharmacien l'ajoute)
    patient_age_range VARCHAR(20), -- "0-12", "13-18", "19-40", "41-60", "60+"
    patient_gender VARCHAR(10),    -- "M", "F", "other", "unknown"
    -- Description de l'incident
    side_effects TEXT NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'moderate',
    onset_date DATE,
    -- Suivi : a-t-il été signalé aux autorités sanitaires ? (par le pharmacien)
    reported_to_authority BOOLEAN NOT NULL DEFAULT FALSE,
    authority_reference VARCHAR(100), -- N° de rapport ANSM-CM / MINSANTE
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT pharmacovigilance_severity_check
        CHECK (severity IN ('minor', 'moderate', 'serious', 'life_threatening'))
);

CREATE INDEX IF NOT EXISTS idx_pharmacovigilance_pharmacy
    ON pharmacovigilance_reports (pharmacy_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pharmacovigilance_medication
    ON pharmacovigilance_reports (lower(medication_name), created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pharmacovigilance_severity
    ON pharmacovigilance_reports (severity, created_at DESC)
    WHERE severity IN ('serious', 'life_threatening');
