-- Migration: YukpoLibrairie — Super libraire natif prioritaire
-- Date: 2026-04-01
-- Description: Introduit le concept de "super libraire" (YukpoLibrairie) qui reçoit
--              toutes les commandes en priorité avant les librairies géolocalisées.
--              Un worker surveille le timeout ; si expiré sans validation complète,
--              la commande est libérée au réseau de libraires partenaires habituels.

-- ============================================================================
-- 1. CHAMPS SUPER LIBRAIRIE SUR librairie_partners
-- ============================================================================

ALTER TABLE librairie_partners
    ADD COLUMN IF NOT EXISTS est_super_librairie BOOLEAN NOT NULL DEFAULT false;

-- Délai de validation accordé au super libraire (en secondes, défaut 15 min = 900s)
ALTER TABLE librairie_partners
    ADD COLUMN IF NOT EXISTS delai_validation_super_librairie_s INTEGER NOT NULL DEFAULT 900;

-- Index unique : un seul super libraire actif à la fois
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_super_librairie_actif
    ON librairie_partners(est_super_librairie)
    WHERE est_super_librairie = true AND est_actif = true AND statut = 'actif';

-- ============================================================================
-- 2. CHAMPS TIMEOUT SUR commandes_mixtes
-- ============================================================================

-- Timestamp d'expiration du délai du super libraire pour cette commande
ALTER TABLE commandes_mixtes
    ADD COLUMN IF NOT EXISTS super_librairie_timeout_at TIMESTAMPTZ;

-- ID du super libraire qui a reçu la commande en premier (pour audit)
ALTER TABLE commandes_mixtes
    ADD COLUMN IF NOT EXISTS super_librairie_id UUID;

-- Indique si le fallback vers les librairies proches a déjà été déclenché
ALTER TABLE commandes_mixtes
    ADD COLUMN IF NOT EXISTS super_librairie_fallback_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_commandes_super_timeout
    ON commandes_mixtes(super_librairie_timeout_at)
    WHERE super_librairie_timeout_at IS NOT NULL
      AND super_librairie_fallback_at IS NULL;

-- ============================================================================
-- 3. NOUVEAU STATUT commande_statut
-- ============================================================================
-- PostgreSQL ne permet pas d'ajouter une valeur ENUM directement dans une migration idempotente
-- On utilise un DO $$ BEGIN ... END $$ pour l'idempotence.

DO $$
BEGIN
    -- Ajouter 'envoyee_super_librairie' à l'enum commande_statut si absent
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'envoyee_super_librairie'
          AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'commande_statut')
    ) THEN
        ALTER TYPE commande_statut ADD VALUE 'envoyee_super_librairie' AFTER 'validation_budget';
    END IF;
END $$;

-- ============================================================================
-- 4. TABLE audit log super libraire (optionnel mais utile pour traçabilité)
-- ============================================================================

CREATE TABLE IF NOT EXISTS super_librairie_audit_log (
    id          SERIAL PRIMARY KEY,
    commande_id UUID        NOT NULL,
    evenement   TEXT        NOT NULL, -- 'routee', 'validee_partielle', 'validee_complete', 'timeout_fallback'
    details     JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sl_audit_commande
    ON super_librairie_audit_log(commande_id, created_at DESC);

-- ============================================================================
-- 5. BOOTSTRAP : créer le compte utilisateur YukpoLibrairie si absent
-- ============================================================================

-- On s'appuie sur un email unique pour garantir l'idempotence.
-- Le mot de passe est un hash bcrypt de "CHANGE_ME_AT_FIRST_BOOT" — à changer en prod via /admin.
DO $$
DECLARE
    v_user_id   INTEGER;
    v_lib_id    UUID;
BEGIN
    -- Vérifier si l'utilisateur existe déjà
    SELECT id INTO v_user_id
    FROM users
    WHERE email = 'super@yukpolibrairie.app'
    LIMIT 1;

    IF v_user_id IS NULL THEN
        INSERT INTO users (
            nom, email, phone, password_hash,
            role, is_active, created_at, updated_at
        )
        VALUES (
            'YukpoLibrairie',
            'super@yukpolibrairie.app',
            '+237000000000',
            '$2b$12$PLACEHOLDER_HASH_CHANGE_AT_FIRST_BOOT', -- ← remplacer avant prod
            'partenaire',
            true,
            NOW(),
            NOW()
        )
        RETURNING id INTO v_user_id;

        RAISE NOTICE 'Utilisateur YukpoLibrairie créé avec id=%', v_user_id;
    ELSE
        RAISE NOTICE 'Utilisateur YukpoLibrairie déjà existant (id=%)', v_user_id;
    END IF;

    -- Vérifier si le partenaire librairie existe déjà
    SELECT id INTO v_lib_id
    FROM librairie_partners
    WHERE est_super_librairie = true
    LIMIT 1;

    IF v_lib_id IS NULL THEN
        INSERT INTO librairie_partners (
            user_id,
            nom,
            email,
            telephone,
            gps,                              -- Centre géographique symbolique (Yaoundé)
            ville,
            quartier,
            rayon_service_km,                 -- Illimité en pratique (9999 km)
            statut,
            rating,
            temps_moyen_validation,
            commission_app,
            est_actif,
            est_super_librairie,
            delai_validation_super_librairie_s,
            horaires_ouverture,
            created_at,
            updated_at
        )
        VALUES (
            v_user_id,
            'YukpoLibrairie',
            'super@yukpolibrairie.app',
            '+237000000000',
            '3.8667,11.5167',                 -- Yaoundé (centre opérationnel)
            'Yaoundé',
            'National',
            9999,                             -- Pas de limite géographique
            'actif',
            5.0,                              -- Note parfaite par défaut
            5,                               -- 5 min temps moyen validation
            0.0500,                          -- 5% commission standard
            true,
            true,                            -- est_super_librairie = TRUE
            900,                             -- 15 minutes de délai
            '00:00-24:00',                  -- Disponible 24h/24
            NOW(),
            NOW()
        )
        RETURNING id INTO v_lib_id;

        RAISE NOTICE 'YukpoLibrairie partenaire créé avec id=%', v_lib_id;
    ELSE
        RAISE NOTICE 'YukpoLibrairie partenaire déjà existant (id=%)', v_lib_id;
    END IF;
END $$;

-- ============================================================================
-- COMMENTAIRES
-- ============================================================================

COMMENT ON COLUMN librairie_partners.est_super_librairie IS
    'Vrai uniquement pour YukpoLibrairie — reçoit toutes les commandes en priorité, sans filtre géographique';
COMMENT ON COLUMN librairie_partners.delai_validation_super_librairie_s IS
    'Délai accordé au super libraire pour valider (secondes). Passé ce délai, le worker déclenche le broadcast aux librairies proches.';
COMMENT ON COLUMN commandes_mixtes.super_librairie_timeout_at IS
    'Timestamp d''expiration du délai super libraire. Si NULL ou passé sans fallback → déclenche broadcast normal.';
COMMENT ON COLUMN commandes_mixtes.super_librairie_fallback_at IS
    'Renseigné dès que le fallback vers les librairies proches est déclenché (timeout ou libération manuelle).';
COMMENT ON TABLE super_librairie_audit_log IS
    'Traçabilité des événements liés au super libraire : routage, validation, timeout, fallback.';
