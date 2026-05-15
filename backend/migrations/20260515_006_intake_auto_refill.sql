-- Phase C4 (2026-05-15) : Renouvellement chronique automatique.
--
-- Pour les traitements chroniques (hypertension, diabète, asthme,
-- contraception…), le patient active "renouvellement auto" sur son rappel
-- de prise. Le worker chronic_refill_worker crée automatiquement une nouvelle
-- alerte RFQ à intervalle régulier (28j par défaut = mensuel).
--
-- Bénéfices :
-- - Patient : zéro charge mentale sur les traitements vitaux.
-- - Pharmacie : revenus récurrents prévisibles, fidélisation forte (la
--   pharmacie où le dernier retrait a eu lieu reste prioritaire — exploite
--   B3 customer_history pour les pharmacies de garde / loyauté).

ALTER TABLE medication_intake_reminders
    ADD COLUMN IF NOT EXISTS auto_refill BOOLEAN NOT NULL DEFAULT FALSE,
    -- Intervalle entre 2 renouvellements automatiques (en jours).
    -- Défaut 28 = équivalent mensuel (1 boîte de 28 cp = 1 mois courant).
    ADD COLUMN IF NOT EXISTS refill_interval_days INTEGER NOT NULL DEFAULT 28
        CHECK (refill_interval_days BETWEEN 1 AND 365),
    -- Combien de jours avant rupture estimée on émet la RFQ.
    -- Défaut 3 jours = laisse au patient le temps d'aller chercher.
    ADD COLUMN IF NOT EXISTS refill_lead_days INTEGER NOT NULL DEFAULT 3
        CHECK (refill_lead_days BETWEEN 0 AND 14),
    -- Quand sera émise la prochaine alerte RFQ automatique.
    -- NULL = pas encore programmé (auto_refill vient juste d'être activé,
    -- on le calculera au premier passage du worker).
    ADD COLUMN IF NOT EXISTS next_refill_at TIMESTAMPTZ,
    -- Référence à la dernière alerte RFQ créée par ce mécanisme (traçabilité).
    ADD COLUMN IF NOT EXISTS last_refill_alert_id BIGINT
        REFERENCES medication_alerts(id) ON DELETE SET NULL;

-- Index pour le scan du worker (uniquement les rappels actifs avec
-- auto_refill activé et dont l'échéance est dépassée).
CREATE INDEX IF NOT EXISTS idx_intake_reminders_refill_due
    ON medication_intake_reminders (next_refill_at)
    WHERE auto_refill = TRUE AND is_active = TRUE;
