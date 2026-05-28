-- =============================================================================
-- Migration : auth simplifiée par téléphone + PIN 4 chiffres
-- =============================================================================
-- Date    : 2026-05-26
-- Contexte: l'inscription email+password complique l'usage pour les parents
--           camerounais (pas d'email, mot de passe oublié). On bascule sur
--           téléphone + PIN 4 chiffres comme méthode primaire.
--
-- Sécurité :
--   * PIN stocké en bcrypt (même qualité que password_hash)
--   * Rate-limit : 5 essais / 15 min via `failed_pin_attempts` + lockout
--     temporaire (`pin_locked_until`)
--   * Index UNIQUE partiel sur phone : empêche 2 comptes même numéro
--   * Email/password restent supportés (legacy + admin) → tous deux nullable
--
-- Idempotence : ALTER TABLE ... IF NOT EXISTS / DO blocks pour ré-exécutions.
-- =============================================================================

-- 1. Ajoute pin_hash + rate-limit columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_pin_attempts INT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_locked_until TIMESTAMPTZ;

-- 2. Rend email + password_hash NULLABLE pour les comptes phone-only
DO $$ BEGIN
    IF (SELECT is_nullable FROM information_schema.columns
        WHERE table_name='users' AND column_name='email') = 'NO' THEN
        ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
    END IF;
    IF (SELECT is_nullable FROM information_schema.columns
        WHERE table_name='users' AND column_name='password_hash') = 'NO' THEN
        ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
    END IF;
END $$;

-- 3. Contrainte UNIQUE sur phone (partielle pour permettre NULL côté legacy).
--    Si quelqu'un d'autre tente de créer un compte avec un numéro déjà utilisé,
--    INSERT plante → backend renvoie 409 Conflict.
DO $$ BEGIN
    -- Supprime l'ancien index non-unique si présent (créé en migration antérieure).
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='idx_users_phone'
               AND tablename='users') THEN
        DROP INDEX idx_users_phone;
    END IF;
    -- Index unique partiel : NULL accepté, mais 2 mêmes numéros = conflit.
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='users_phone_unique'
                   AND tablename='users') THEN
        CREATE UNIQUE INDEX users_phone_unique ON users (phone)
            WHERE phone IS NOT NULL;
    END IF;
END $$;

-- 4. Contrainte : au moins une méthode d'auth complète sur le compte.
--    NOT VALID : on ne re-valide pas les rows existants (certains legacy
--    peuvent être incomplets), mais les nouvelles INSERTs doivent matcher.
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name='users' AND constraint_name='users_auth_method_check'
    ) THEN
        ALTER TABLE users ADD CONSTRAINT users_auth_method_check CHECK (
            (email IS NOT NULL AND password_hash IS NOT NULL) OR
            (phone IS NOT NULL AND pin_hash IS NOT NULL)
        ) NOT VALID;
    END IF;
END $$;

-- 5. Helper SQL : normalise un numéro de téléphone (retire espaces, tirets,
--    parenthèses, points, garde le + initial). Utilisé pour matcher des
--    saisies équivalentes ("+237 6 95 12 34 56" == "+237695123456").
CREATE OR REPLACE FUNCTION normalize_phone(p TEXT) RETURNS TEXT AS $$
    SELECT CASE
        WHEN p IS NULL OR p = '' THEN NULL
        ELSE regexp_replace(p, '[^0-9+]', '', 'g')
    END
$$ LANGUAGE SQL IMMUTABLE;

-- Note: on ne normalise PAS automatiquement les phones existants pour ne pas
-- créer de conflit sur l'index unique si plusieurs users ont saisi le même
-- numéro avec des formats différents. À traiter manuellement si besoin.

-- 6. Vérification finale
DO $$
DECLARE
    nb_users INTEGER;
    nb_with_phone INTEGER;
    nb_with_pin INTEGER;
BEGIN
    SELECT COUNT(*) INTO nb_users FROM users;
    SELECT COUNT(*) INTO nb_with_phone FROM users WHERE phone IS NOT NULL;
    SELECT COUNT(*) INTO nb_with_pin FROM users WHERE pin_hash IS NOT NULL;
    RAISE NOTICE '[auth-phone-pin] users total: %, avec phone: %, avec pin: %',
        nb_users, nb_with_phone, nb_with_pin;
END $$;
