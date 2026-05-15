-- Phase C (2026-05-15) : Allergies & contre-indications déclarées par le
-- patient.
--
-- Logique :
--   Le patient déclare une fois ses allergies (pénicilline, AINS, sulfamides,
--   aspirine, iode…) et conditions (grossesse, allaitement, asthme, G6PD…).
--   À chaque alerte RFQ, le backend croise les médicaments demandés avec ces
--   déclarations et expose un drapeau côté pharmacien dans get_my_pharmacy_alerts.
--   Drapeau rouge → le pharmacien voit immédiatement « ⚠️ Pénicilline déclarée
--   par le patient — Amoxicilline contre-indiquée », il peut refuser ou proposer
--   une alternative.
--
-- Sécurité juridique : on ne fait que retransmettre une déclaration du patient,
-- pas un diagnostic. La décision de dispense reste au pharmacien.

CREATE TABLE IF NOT EXISTS patient_allergies (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- Type :
    --   'allergy'    : allergie médicamenteuse (pénicilline, sulfamides…)
    --   'condition'  : condition physiologique (grossesse, allaitement, G6PD…)
    --   'intolerance': intolérance ou effet indésirable connu (aspirine,
    --                  lactose, gluten — pas une allergie stricto sensu mais
    --                  on les flagge pareil pour la sécurité)
    kind VARCHAR(20) NOT NULL CHECK (kind IN ('allergy', 'condition', 'intolerance')),
    -- Libellé normalisé. On utilise une liste prédéfinie côté backend pour
    -- pouvoir matcher contre les bases d'allergènes (cf. helper
    -- match_medication_against_allergies). Si "other", `note` doit être renseigné.
    label VARCHAR(80) NOT NULL,
    -- Note libre du patient (ex : "Œdème de Quincke en 2024 sur Augmentin")
    note TEXT,
    -- Sévérité auto-déclarée par le patient. Affichée en couleur dans le
    -- bandeau pharmacien (rouge=severe, orange=moderate, jaune=mild).
    severity VARCHAR(20) NOT NULL DEFAULT 'moderate'
        CHECK (severity IN ('mild', 'moderate', 'severe')),
    -- Date de déclaration (informatif). On garde aussi updated_at pour le tri.
    declared_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Pas de doublon (label,user_id) sauf si "other" + note différente.
    -- On simplifie : unique sur (user_id, kind, label) — pour "other"
    -- l'utilisateur devra déclarer plusieurs "other" avec notes distinctes,
    -- on autorisera via un suffixe "other:xxx" côté API si besoin futur.
    UNIQUE (user_id, kind, label)
);

CREATE INDEX IF NOT EXISTS idx_patient_allergies_user
    ON patient_allergies (user_id, kind);
