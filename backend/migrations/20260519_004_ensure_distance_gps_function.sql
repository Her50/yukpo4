-- 2026-05-19 — Garantit que la fonction SQL distance_gps existe en DB.
--
-- Contexte : la fonction est définie dans
-- backend/src/migrations/create_librairie_network_tables.sql (dossier
-- `src/migrations/` côté Rust, PAS dans le dossier `migrations/` lu par
-- sqlx::migrate!()). Résultat : la fonction n'est créée qu'en code via
-- auto_migrate.rs OU jamais.
--
-- Sim 15 staging a révélé l'absence — le POST /super-librairie/liberer-
-- articles retournait 500 "function distance_gps does not exist".
--
-- Idempotent via CREATE OR REPLACE. Formule Haversine standard, distance
-- en km entre 2 points GPS.

CREATE OR REPLACE FUNCTION distance_gps(lat1 FLOAT, lon1 FLOAT, lat2 FLOAT, lon2 FLOAT)
RETURNS FLOAT AS $$
DECLARE
    R FLOAT := 6371; -- rayon Terre en km
    dlat FLOAT;
    dlon FLOAT;
    a FLOAT;
    c FLOAT;
BEGIN
    dlat := radians(lat2 - lat1);
    dlon := radians(lon2 - lon1);
    a := sin(dlat/2) * sin(dlat/2) + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon/2) * sin(dlon/2);
    c := 2 * atan2(sqrt(a), sqrt(1-a));
    RETURN R * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
