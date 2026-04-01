-- Fix: ajouter une colonne typée cancellation_deadline_hours dans agences_voyage
-- Context: la valeur était stockée dans services.data JSON (fragile, non indexable, non contraignable).
-- La colonne typée permet une validation SQL directe et des requêtes simples.

ALTER TABLE agences_voyage
    ADD COLUMN IF NOT EXISTS cancellation_deadline_hours INTEGER
        NOT NULL DEFAULT 24
        CHECK (cancellation_deadline_hours >= 0 AND cancellation_deadline_hours <= 168);

COMMENT ON COLUMN agences_voyage.cancellation_deadline_hours IS
    'Délai minimum (en heures) avant le départ pour annuler sans pénalité. '
    'Plage valide: 0-168 h (0 = annulation toujours refusée si paiement confirmé). '
    'Valeur par défaut : 24 h.';

-- Rétro-remplissage depuis services.data->>'cancellation_deadline_hours' si présent
UPDATE agences_voyage av
SET cancellation_deadline_hours = CAST(
    s.data->>'cancellation_deadline_hours' AS INTEGER
)
FROM services s
WHERE s.id = av.service_id
  AND s.data ? 'cancellation_deadline_hours'
  AND (s.data->>'cancellation_deadline_hours') ~ '^\d+$'
  AND CAST(s.data->>'cancellation_deadline_hours' AS INTEGER) BETWEEN 0 AND 168;
