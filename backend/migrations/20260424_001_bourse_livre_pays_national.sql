-- Migration : Support multi-pays + programmes nationaux pour Bourse du Livre
-- Date : 2026-04-24
--
-- Phase 1 :
--  * ajoute `pays` (code ISO-2) à `etablissements_scolaires` et `programmes_scolaires`
--  * ajoute `is_national` à `etablissements_scolaires` pour la liste-programme-national fallback
--  * contrainte d'unicité logique sur programmes (etablissement_id, classe, annee_scolaire)
--  * seed d'un établissement "national" par pays supporté

BEGIN;

-- 1) Colonne pays sur etablissements_scolaires (TEXT — accepte ISO-2 "CM" ou nom complet)
ALTER TABLE etablissements_scolaires
    ADD COLUMN IF NOT EXISTS pays TEXT;

UPDATE etablissements_scolaires SET pays = 'CM' WHERE pays IS NULL;

ALTER TABLE etablissements_scolaires
    ALTER COLUMN pays SET DEFAULT 'CM',
    ALTER COLUMN pays SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_etablissements_pays ON etablissements_scolaires(pays, is_active);
CREATE INDEX IF NOT EXISTS idx_etablissements_pays_ville ON etablissements_scolaires(pays, ville, is_active);

-- 2) is_national sur etablissements_scolaires
ALTER TABLE etablissements_scolaires
    ADD COLUMN IF NOT EXISTS is_national BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_etablissements_national ON etablissements_scolaires(pays, is_national) WHERE is_national = true;

-- 3) Colonne pays sur programmes_scolaires (déjà TEXT depuis 00000189 — idempotent)
ALTER TABLE programmes_scolaires
    ADD COLUMN IF NOT EXISTS pays TEXT;

UPDATE programmes_scolaires SET pays = 'CM' WHERE pays IS NULL OR pays = '';

CREATE INDEX IF NOT EXISTS idx_programmes_pays ON programmes_scolaires(pays, niveau, classe) WHERE is_active = true;

-- 4) Index unique logique pour upsert idempotent (etablissement_id, classe, annee_scolaire)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_programmes_etab_classe_annee
    ON programmes_scolaires(etablissement_id, classe, annee_scolaire)
    WHERE is_active = true AND classe IS NOT NULL;

-- 5) Seed : un établissement "national" par pays — sert de fallback quand
-- l'utilisateur n'a pas choisi d'école (programme officiel du ministère).
-- Note : service_id et user_id sont NOT NULL → on utilise le premier admin,
-- donc ce seed est conditionnel à la présence d'au moins un utilisateur.
DO $$
DECLARE
    admin_user_id INTEGER;
    admin_service_id INTEGER;
    pays_code TEXT;
    pays_nom TEXT;
    pays_list TEXT[][] := ARRAY[
        ARRAY['CM', 'Cameroun'],
        ARRAY['CI', 'Côte d''Ivoire'],
        ARRAY['SN', 'Sénégal'],
        ARRAY['GA', 'Gabon'],
        ARRAY['CG', 'Congo'],
        ARRAY['CD', 'République démocratique du Congo'],
        ARRAY['BJ', 'Bénin'],
        ARRAY['TG', 'Togo'],
        ARRAY['BF', 'Burkina Faso'],
        ARRAY['ML', 'Mali'],
        ARRAY['NE', 'Niger'],
        ARRAY['NG', 'Nigeria'],
        ARRAY['GH', 'Ghana']
    ];
    i INTEGER;
BEGIN
    SELECT id INTO admin_user_id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1;
    IF admin_user_id IS NULL THEN
        SELECT id INTO admin_user_id FROM users ORDER BY id LIMIT 1;
    END IF;

    IF admin_user_id IS NULL THEN
        RAISE NOTICE 'Pas d''utilisateur existant — seed national skip';
        RETURN;
    END IF;

    -- Chercher ou créer un service "placeholder" pour les national
    SELECT id INTO admin_service_id FROM services
        WHERE user_id = admin_user_id AND category = 'orientation_scolaire'
        ORDER BY id LIMIT 1;

    IF admin_service_id IS NULL THEN
        INSERT INTO services (user_id, category, data, is_active)
        VALUES (admin_user_id, 'orientation_scolaire',
                '{"titre_service":{"type_donnee":"string","valeur":"Programmes nationaux"}}'::jsonb,
                true)
        RETURNING id INTO admin_service_id;
    END IF;

    FOR i IN 1..array_length(pays_list, 1) LOOP
        pays_code := pays_list[i][1];
        pays_nom := pays_list[i][2];

        INSERT INTO etablissements_scolaires
            (service_id, user_id, nom_etablissement, type_etablissement,
             ville, pays, is_national, is_active, is_verified)
        SELECT admin_service_id, admin_user_id,
               'Programme national — ' || pays_nom,
               'secondaire', '-', pays_code, true, true, true
        WHERE NOT EXISTS (
            SELECT 1 FROM etablissements_scolaires
            WHERE pays = pays_code AND is_national = true
        );
    END LOOP;
END $$;

COMMIT;
