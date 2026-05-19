-- 2026-05-19 — Workflow Yukpo Librairie MVP1 : cascade rupture grossiste.
--
-- Permet à Yukpo Lib (ou un grossiste) de signaler la rupture d'articles,
-- puis de les libérer vers les libraires_proches (rayon 20 km) pendant 48h
-- avant de basculer en annule_rupture si personne ne prend. Voir
-- ARCHITECTURE_WORKFLOW_YUKPO_LIBRAIRIE.md §5.

-- ============================================================================
-- 1. EXTENSION ENUM livre_validation_statut
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'rupture_grossiste'
          AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'livre_validation_statut')
    ) THEN
        ALTER TYPE livre_validation_statut ADD VALUE 'rupture_grossiste';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'libere_libraires'
          AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'livre_validation_statut')
    ) THEN
        ALTER TYPE livre_validation_statut ADD VALUE 'libere_libraires';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'annule_rupture'
          AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'livre_validation_statut')
    ) THEN
        ALTER TYPE livre_validation_statut ADD VALUE 'annule_rupture';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'refuse_coursier'
          AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'livre_validation_statut')
    ) THEN
        ALTER TYPE livre_validation_statut ADD VALUE 'refuse_coursier';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'refuse_parent'
          AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'livre_validation_statut')
    ) THEN
        ALTER TYPE livre_validation_statut ADD VALUE 'refuse_parent';
    END IF;
END $$;

-- ============================================================================
-- 2. COLONNES libération sur commande_validations
-- ============================================================================
-- articles_libere = UUID[] des commande_livres_neufs.id libérés à cette
-- librairie. Une row = une (commande, librairie) éligible à valider un
-- sous-ensemble d'articles (et pas toute la commande comme avant).

ALTER TABLE commande_validations
    ADD COLUMN IF NOT EXISTS articles_libere UUID[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS timestamp_libere TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS expire_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_validations_expire_at
    ON commande_validations (expire_at)
    WHERE expire_at IS NOT NULL AND statut = 'en_cours';

-- ============================================================================
-- 3. TABLE grossistes (manuel pour MVP1, B2B API en MVP3)
-- ============================================================================

CREATE TABLE IF NOT EXISTS grossistes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nom TEXT NOT NULL,
    ville TEXT,
    telephone TEXT,
    whatsapp TEXT,
    email TEXT,
    specialites TEXT[] DEFAULT '{}',
    mode_integration TEXT NOT NULL DEFAULT 'manuel'
        CHECK (mode_integration IN ('manuel', 'api')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    api_endpoint TEXT,
    api_token_encrypted TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_grossistes_active ON grossistes(is_active) WHERE is_active;

-- ============================================================================
-- 4. LIEN commande_livres_neufs ↔ grossiste
-- ============================================================================

ALTER TABLE commande_livres_neufs
    ADD COLUMN IF NOT EXISTS grossiste_assigne_id UUID REFERENCES grossistes(id),
    ADD COLUMN IF NOT EXISTS commande_grossiste_envoyee_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS commande_grossiste_confirmee_at TIMESTAMPTZ;
