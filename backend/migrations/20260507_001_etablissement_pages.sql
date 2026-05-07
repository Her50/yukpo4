-- ============================================================================
-- Migration : Pages Officielles Établissements (CMS multi-blocs)
-- Date : 2026-05-07
-- ============================================================================
-- Objectif : permettre à chaque établissement scolaire d'avoir une page
-- publique unique (URL: /ecole/{slug}) avec 10 blocs éditables :
--   inscription, transport, cantine, perisco, internat, uniforme,
--   calendrier, annonces, contacts, laureats
-- + connexion automatique avec la Bourse du Livre via etablissement_id partagé.
-- ============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Extension de la table etablissements_scolaires (existante)
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE etablissements_scolaires
    ADD COLUMN IF NOT EXISTS slug TEXT,
    ADD COLUMN IF NOT EXISTS logo_url TEXT,
    ADD COLUMN IF NOT EXISTS banniere_url TEXT,
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS gerant_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS page_status TEXT NOT NULL DEFAULT 'draft'
        CHECK (page_status IN ('draft', 'pending', 'published', 'suspended')),
    ADD COLUMN IF NOT EXISTS page_published_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS qr_code_url TEXT,
    ADD COLUMN IF NOT EXISTS stats_views_30d INTEGER NOT NULL DEFAULT 0;

-- Index unique sur slug (uniquement quand publié, pour autoriser brouillons multiples)
CREATE UNIQUE INDEX IF NOT EXISTS idx_etablissements_slug_unique
    ON etablissements_scolaires(slug)
    WHERE slug IS NOT NULL;

-- Index recherche par gérant (pour le portail admin)
CREATE INDEX IF NOT EXISTS idx_etablissements_gerant
    ON etablissements_scolaires(gerant_user_id)
    WHERE gerant_user_id IS NOT NULL;

-- Index recherche pg_trgm sur le nom (pour autocomplete)
CREATE INDEX IF NOT EXISTS idx_etablissements_nom_trgm
    ON etablissements_scolaires
    USING GIN (nom_etablissement gin_trgm_ops);

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Table CMS unifiée des blocs de la page établissement
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS etablissement_blocs (
    id              SERIAL PRIMARY KEY,
    etablissement_id INTEGER NOT NULL REFERENCES etablissements_scolaires(id) ON DELETE CASCADE,
    type_bloc       TEXT NOT NULL CHECK (type_bloc IN (
        'inscription', 'transport', 'cantine', 'perisco', 'internat',
        'uniforme', 'calendrier', 'annonces', 'contacts', 'laureats'
    )),
    titre           TEXT,
    contenu_json    JSONB NOT NULL DEFAULT '{}'::jsonb,
    medias_urls     TEXT[] DEFAULT ARRAY[]::TEXT[],
    position        INTEGER NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    published_at    TIMESTAMPTZ,
    created_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
    updated_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(etablissement_id, type_bloc)
);

CREATE INDEX IF NOT EXISTS idx_etab_blocs_etab_active
    ON etablissement_blocs(etablissement_id, is_active, position);

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Table audit log des modifications de blocs
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS etablissement_blocs_audit (
    id              BIGSERIAL PRIMARY KEY,
    etablissement_id INTEGER NOT NULL,
    type_bloc       TEXT NOT NULL,
    action          TEXT NOT NULL CHECK (action IN ('create', 'update', 'publish', 'unpublish', 'delete')),
    user_id         INTEGER REFERENCES users(id) ON DELETE SET NULL,
    diff_json       JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_etab_audit_etab_date
    ON etablissement_blocs_audit(etablissement_id, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Table annonces (tableau d'affichage timeline)
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS etablissement_annonces (
    id              SERIAL PRIMARY KEY,
    etablissement_id INTEGER NOT NULL REFERENCES etablissements_scolaires(id) ON DELETE CASCADE,
    titre           TEXT NOT NULL,
    contenu         TEXT NOT NULL,
    image_url       TEXT,
    is_pinned       BOOLEAN NOT NULL DEFAULT false,
    published_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ,
    created_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_etab_annonces_etab_date
    ON etablissement_annonces(etablissement_id, published_at DESC);

-- ─────────────────────────────────────────────────────────────────────────
-- 5. Table événements (calendrier scolaire)
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS etablissement_evenements (
    id              SERIAL PRIMARY KEY,
    etablissement_id INTEGER NOT NULL REFERENCES etablissements_scolaires(id) ON DELETE CASCADE,
    titre           TEXT NOT NULL,
    description     TEXT,
    type_event      TEXT CHECK (type_event IN ('examen', 'reunion', 'vacances', 'sortie', 'fete', 'rentree', 'autre')),
    date_debut      TIMESTAMPTZ NOT NULL,
    date_fin        TIMESTAMPTZ,
    classe_concernee TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_etab_evenements_etab_date
    ON etablissement_evenements(etablissement_id, date_debut)
    WHERE is_active = true;

-- ─────────────────────────────────────────────────────────────────────────
-- 6. Table statistiques d'usage de la page (pour le dashboard école)
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS etablissement_visites (
    etablissement_id INTEGER NOT NULL REFERENCES etablissements_scolaires(id) ON DELETE CASCADE,
    date            DATE NOT NULL,
    visites         INTEGER NOT NULL DEFAULT 0,
    visiteurs_unq   INTEGER NOT NULL DEFAULT 0,
    clics_commande  INTEGER NOT NULL DEFAULT 0,
    clics_infos     INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (etablissement_id, date)
);

CREATE INDEX IF NOT EXISTS idx_etab_visites_date
    ON etablissement_visites(date DESC);

-- ─────────────────────────────────────────────────────────────────────────
-- 7. Génération automatique de slugs pour les établissements existants
-- ─────────────────────────────────────────────────────────────────────────
-- Fonction utilitaire de slugification
CREATE OR REPLACE FUNCTION etab_slugify(input TEXT) RETURNS TEXT AS $$
BEGIN
    RETURN lower(
        regexp_replace(
            regexp_replace(
                unaccent(coalesce(input, '')),
                '[^a-zA-Z0-9]+', '-', 'g'
            ),
            '(^-+|-+$)', '', 'g'
        )
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Backfill des slugs pour les établissements existants (avec id pour unicité)
UPDATE etablissements_scolaires
SET slug = etab_slugify(nom_etablissement) || '-' || id::text
WHERE slug IS NULL;

COMMIT;

-- ============================================================================
-- Notes :
-- - Le slug est généré automatiquement à partir du nom + id pour garantir
--   l'unicité même en cas d'écoles homonymes.
-- - Les pages restent en statut 'draft' tant que le gérant ne demande pas
--   la publication. Modération YUKPO ('pending' → 'published').
-- - Le bloc liste_scolaire n'est pas dans etablissement_blocs : il provient
--   directement de la table programmes_scolaires (filtrée par etablissement_id).
-- ============================================================================
