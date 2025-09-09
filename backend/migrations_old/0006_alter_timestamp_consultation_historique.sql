-- Add migration script here
-- Migration : Convertir "timestamp" en timestamptz dans consultation_historique

ALTER TABLE consultation_historique
ALTER COLUMN "timestamp" TYPE timestamptz
USING "timestamp" AT TIME ZONE 'UTC';

ALTER TABLE consultation_historique
ALTER COLUMN "timestamp" SET NOT NULL;
