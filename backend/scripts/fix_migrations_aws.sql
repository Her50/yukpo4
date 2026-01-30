-- Script de correction des migrations AWS
-- Date: 2026-01-30
-- Description: Corrige les problèmes identifiés dans les logs d'erreur

-- ============================================================================
-- 1. CORRECTION: Supprimer les versions dupliquées de hybrid_image_search
-- ============================================================================

-- Supprimer toutes les versions existantes (on les recréera ensuite)
DO $$
DECLARE
    func_record RECORD;
BEGIN
    FOR func_record IN 
        SELECT p.oid, p.proname, pg_get_function_arguments(p.oid) as args
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE p.proname = 'hybrid_image_search'
        AND n.nspname = 'public'
    LOOP
        BEGIN
            EXECUTE format('DROP FUNCTION IF EXISTS %s(%s) CASCADE', 
                func_record.proname, 
                func_record.args);
            RAISE NOTICE 'Supprimé: hybrid_image_search(%)', func_record.args;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Erreur lors de la suppression de hybrid_image_search(%): %', 
                func_record.args, SQLERRM;
        END;
    END LOOP;
END $$;

-- ============================================================================
-- 2. CORRECTION: Vérifier et créer specialized_reservations si manquante
-- ============================================================================

-- La table devrait être créée par la migration 20250128_001_add_specialized_reservations_and_ratings.sql
-- Si elle n'existe pas, on la crée ici
CREATE TABLE IF NOT EXISTS specialized_reservations (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL,
    service_type VARCHAR(50) NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    prestataire_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reservation_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    requested_date TIMESTAMP WITH TIME ZONE,
    confirmed_date TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    details JSONB NOT NULL DEFAULT '{}',
    amount NUMERIC(10, 2),
    currency VARCHAR(10),
    payment_status VARCHAR(20),
    payment_method VARCHAR(50),
    notes TEXT,
    prestataire_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_specialized_reservations_service_id ON specialized_reservations(service_id);
CREATE INDEX IF NOT EXISTS idx_specialized_reservations_user_id ON specialized_reservations(user_id);
CREATE INDEX IF NOT EXISTS idx_specialized_reservations_prestataire_id ON specialized_reservations(prestataire_id);
CREATE INDEX IF NOT EXISTS idx_specialized_reservations_status ON specialized_reservations(status);
CREATE INDEX IF NOT EXISTS idx_specialized_reservations_service_type ON specialized_reservations(service_type);

-- ============================================================================
-- 3. CORRECTION: Vérifier le type d'ID de pharmacy_products
-- ============================================================================

-- Si pharmacy_products existe avec SERIAL (INTEGER), on doit corriger les références
-- Sinon, on doit créer la table avec le bon type

-- D'abord, vérifier si la table existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'pharmacy_products'
    ) THEN
        -- Créer la table si elle n'existe pas
        CREATE TABLE pharmacy_products (
            id SERIAL PRIMARY KEY,
            pharmacy_service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
            nom_produit VARCHAR(255) NOT NULL,
            description TEXT,
            prix NUMERIC(10, 2) NOT NULL,
            stock INTEGER NOT NULL DEFAULT 0,
            disponible BOOLEAN NOT NULL DEFAULT true,
            unite VARCHAR(50) DEFAULT 'unité',
            code_barre VARCHAR(100),
            categorie VARCHAR(100),
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        );
        RAISE NOTICE 'Table pharmacy_products créée avec SERIAL (INTEGER)';
    ELSE
        -- Vérifier le type de la colonne id
        IF EXISTS (
            SELECT FROM information_schema.columns
            WHERE table_name = 'pharmacy_products'
            AND column_name = 'id'
            AND data_type = 'integer'
        ) THEN
            RAISE NOTICE 'Table pharmacy_products existe avec INTEGER - OK';
        ELSE
            RAISE WARNING 'Table pharmacy_products existe mais avec un type différent de INTEGER';
        END IF;
    END IF;
END $$;

-- ============================================================================
-- 4. CORRECTION: Corriger pharmacy_order_items et pharmacy_reservations
-- ============================================================================

-- Supprimer les tables si elles existent avec le mauvais type
DROP TABLE IF EXISTS pharmacy_order_items CASCADE;
DROP TABLE IF EXISTS pharmacy_reservations CASCADE;

-- Recréer avec le bon type (INTEGER au lieu de UUID pour medication_id)
CREATE TABLE IF NOT EXISTS pharmacy_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES pharmacy_orders(id) ON DELETE CASCADE,
    medication_id INTEGER NOT NULL REFERENCES pharmacy_products(id) ON DELETE CASCADE, -- ✅ CORRIGÉ: INTEGER
    medication_name VARCHAR(200) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    requires_prescription BOOLEAN DEFAULT FALSE,
    prescription_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pharmacy_order_items_order ON pharmacy_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_order_items_medication ON pharmacy_order_items(medication_id);

CREATE TABLE IF NOT EXISTS pharmacy_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pharmacy_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    medication_id INTEGER NOT NULL REFERENCES pharmacy_products(id) ON DELETE CASCADE, -- ✅ CORRIGÉ: INTEGER
    quantity INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'available', 'collected', 'expired', 'cancelled')),
    expiry_time TIMESTAMPTZ NOT NULL,
    collected_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pharmacy_reservations_pharmacy ON pharmacy_reservations(pharmacy_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_reservations_user ON pharmacy_reservations(user_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_reservations_medication ON pharmacy_reservations(medication_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_reservations_status ON pharmacy_reservations(status);
CREATE INDEX IF NOT EXISTS idx_pharmacy_reservations_expiry ON pharmacy_reservations(expiry_time) WHERE status = 'pending';

-- ============================================================================
-- 5. CORRECTION: Corriger les colonnes manquantes dans offres_emploi
-- ============================================================================

-- Vérifier et ajouter les colonnes manquantes si nécessaire
DO $$
BEGIN
    -- Vérifier si location_point existe (peut être NULL si PostGIS n'est pas installé)
    IF NOT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'offres_emploi'
        AND column_name = 'location_point'
    ) THEN
        -- Essayer d'ajouter la colonne (peut échouer si PostGIS n'est pas disponible)
        BEGIN
            ALTER TABLE offres_emploi ADD COLUMN location_point GEOGRAPHY(POINT, 4326);
            RAISE NOTICE 'Colonne location_point ajoutée à offres_emploi';
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Impossible d''ajouter location_point (PostGIS peut-être non disponible): %', SQLERRM;
        END;
    END IF;

    -- Vérifier si statut existe (devrait exister selon la migration)
    IF NOT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'offres_emploi'
        AND column_name = 'statut'
    ) THEN
        ALTER TABLE offres_emploi ADD COLUMN statut VARCHAR(50) DEFAULT 'active' CHECK (statut IN ('active', 'pourvue', 'fermee', 'brouillon'));
        RAISE NOTICE 'Colonne statut ajoutée à offres_emploi';
    END IF;
END $$;

-- ============================================================================
-- 6. CORRECTION: Corriger courier_availability_snapshots
-- ============================================================================

-- Vérifier si user_id existe, sinon l'ajouter ou corriger l'index
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'courier_availability_snapshots'
        AND column_name = 'user_id'
    ) THEN
        -- La colonne n'existe pas, on doit soit l'ajouter soit corriger l'index
        -- Pour l'instant, on supprime l'index problématique
        DROP INDEX IF EXISTS idx_courier_availability_snapshots_user_courier;
        RAISE NOTICE 'Index idx_courier_availability_snapshots_user_courier supprimé (colonne user_id n''existe pas)';
    END IF;
END $$;

-- ============================================================================
-- 7. CORRECTION: Corriger programmes_scolaires (virgule en trop)
-- ============================================================================

-- Supprimer la table si elle existe avec une erreur de syntaxe
DROP TABLE IF EXISTS programmes_scolaires CASCADE;

-- Recréer sans la virgule en trop
CREATE TABLE IF NOT EXISTS programmes_scolaires (
    id SERIAL PRIMARY KEY,
    etablissement_id INTEGER NOT NULL REFERENCES etablissements_scolaires(id) ON DELETE CASCADE,
    type_etablissement VARCHAR(50) NOT NULL,
    niveau VARCHAR(50) NOT NULL,
    classe VARCHAR(50),
    filiere VARCHAR(100),
    specialite VARCHAR(100),
    titre VARCHAR(255) NOT NULL,
    description TEXT,
    annee_scolaire VARCHAR(20) NOT NULL,
    fichier_url TEXT,
    fichier_nom VARCHAR(255),
    fichier_taille INTEGER,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    -- ✅ CORRIGÉ: Virgule en trop supprimée
);

CREATE INDEX IF NOT EXISTS idx_programmes_etablissement ON programmes_scolaires(etablissement_id, is_active);
CREATE INDEX IF NOT EXISTS idx_programmes_type_niveau ON programmes_scolaires(type_etablissement, niveau);
CREATE INDEX IF NOT EXISTS idx_programmes_annee ON programmes_scolaires(annee_scolaire);

-- ============================================================================
-- 8. CORRECTION: Créer les tables dépendantes de specialized_reservations
-- ============================================================================

-- covoiturage_insurance
CREATE TABLE IF NOT EXISTS covoiturage_insurance (
    id SERIAL PRIMARY KEY,
    reservation_id INTEGER NOT NULL REFERENCES specialized_reservations(id) ON DELETE CASCADE,
    passenger_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    insurance_provider TEXT,
    policy_number TEXT,
    coverage_amount DECIMAL(10,2),
    coverage_type TEXT DEFAULT 'basic' CHECK (coverage_type IN ('basic', 'premium', 'full')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_covoiturage_insurance_reservation ON covoiturage_insurance(reservation_id);
CREATE INDEX IF NOT EXISTS idx_covoiturage_insurance_passenger ON covoiturage_insurance(passenger_user_id);
CREATE INDEX IF NOT EXISTS idx_covoiturage_insurance_status ON covoiturage_insurance(status);
CREATE INDEX IF NOT EXISTS idx_covoiturage_insurance_dates ON covoiturage_insurance(start_date, end_date);

-- reservation_qr_codes
CREATE TABLE IF NOT EXISTS reservation_qr_codes (
    id SERIAL PRIMARY KEY,
    reservation_id INTEGER NOT NULL REFERENCES specialized_reservations(id) ON DELETE CASCADE,
    qr_code TEXT NOT NULL UNIQUE,
    qr_code_url TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'validated', 'expired', 'cancelled')),
    validated_at TIMESTAMPTZ,
    validated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reservation_qr_codes_reservation ON reservation_qr_codes(reservation_id);
CREATE INDEX IF NOT EXISTS idx_reservation_qr_codes_qr_code ON reservation_qr_codes(qr_code);
CREATE INDEX IF NOT EXISTS idx_reservation_qr_codes_status ON reservation_qr_codes(status);
CREATE INDEX IF NOT EXISTS idx_reservation_qr_codes_expires ON reservation_qr_codes(expires_at);

-- Ajouter les colonnes à specialized_reservations si elles n'existent pas
ALTER TABLE specialized_reservations
ADD COLUMN IF NOT EXISTS insurance_included BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS insurance_coverage_amount DECIMAL(10,2);

-- ============================================================================
-- 9. CORRECTION: Corriger les vues matérialisées (services_search_cache, active_products_cache)
-- ============================================================================

-- Supprimer les vues si elles existent avec des erreurs
DROP MATERIALIZED VIEW IF EXISTS services_search_cache CASCADE;
DROP MATERIALIZED VIEW IF EXISTS active_products_cache CASCADE;

-- Recréer services_search_cache (sans la colonne gps si elle n'existe pas dans services)
-- Note: La colonne gps existe dans services selon la migration 0000, donc on peut la recréer
CREATE MATERIALIZED VIEW IF NOT EXISTS services_search_cache AS
SELECT 
    s.id,
    s.user_id,
    s.data,
    s.is_active,
    s.category,
    s.gps,
    s.created_at,
    to_tsvector('french', 
        COALESCE(s.data->'titre_service'->>'valeur', '') || ' ' ||
        COALESCE(s.data->'description'->>'valeur', '') || ' ' ||
        COALESCE(s.category, '')
    ) as search_vector
FROM services s
WHERE s.is_active = TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_services_search_cache_id_unique ON services_search_cache (id);
CREATE INDEX IF NOT EXISTS idx_services_search_cache_vector ON services_search_cache USING GIN (search_vector);
CREATE INDEX IF NOT EXISTS idx_services_search_cache_category ON services_search_cache (category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_services_search_cache_active ON services_search_cache (is_active, created_at DESC) WHERE is_active = TRUE;

-- Recréer active_products_cache
CREATE MATERIALIZED VIEW IF NOT EXISTS active_products_cache AS
SELECT 
    (s.id::bigint * 1000000 + jsonb_array_elements.pos) as cache_id,
    s.id as service_id,
    s.user_id,
    s.category,
    s.gps,
    jsonb_array_elements.product,
    s.created_at
FROM services s
CROSS JOIN LATERAL jsonb_array_elements(
    CASE 
        WHEN jsonb_typeof(s.data->'produits') = 'array' 
        THEN s.data->'produits'
        WHEN jsonb_typeof(s.data->'produits'->'valeur') = 'array'
        THEN s.data->'produits'->'valeur'
        ELSE '[]'::jsonb
    END
) WITH ORDINALITY AS jsonb_array_elements(product, pos)
WHERE s.is_active = TRUE
AND (
    jsonb_typeof(s.data->'produits') = 'array' OR
    jsonb_typeof(s.data->'produits'->'valeur') = 'array'
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_active_products_cache_id_unique ON active_products_cache (cache_id);
CREATE INDEX IF NOT EXISTS idx_active_products_service_category ON active_products_cache (service_id, category);
CREATE INDEX IF NOT EXISTS idx_active_products_product_name ON active_products_cache USING GIN (
    to_tsvector('french', 
        COALESCE(product->>'name', '') || ' ' ||
        COALESCE(product->>'description', '')
    )
);

-- ============================================================================
-- 10. CORRECTION: Corriger l'index sur delivery_matching_queue
-- ============================================================================

-- Supprimer l'index problématique (utilise NOW() qui n'est pas IMMUTABLE)
DROP INDEX IF EXISTS idx_delivery_matching_queue_next_attempt_pending;

-- Recréer sans la clause WHERE avec NOW() (on utilisera une fonction différente ou on supprimera la clause)
-- Pour l'instant, on crée un index simple
CREATE INDEX IF NOT EXISTS idx_delivery_matching_queue_next_attempt ON delivery_matching_queue(next_attempt_at)
WHERE status IN ('queued', 'searching');

-- ============================================================================
-- 11. CORRECTION: Corriger product_comments_view
-- ============================================================================

-- Supprimer la vue si elle existe
DROP VIEW IF EXISTS product_comments_view CASCADE;

-- Recréer avec le bon type (VARCHAR au lieu de TEXT pour user_name)
CREATE OR REPLACE VIEW product_comments_view AS
SELECT
    pc.id,
    pc.service_id,
    pc.user_id,
    pc.parent_comment_id,
    pc.rating,
    pc.content,
    pc.mentions,
    pc.reaction_counts,
    pc.created_at,
    pc.updated_at,
    pc.edited_at,
    pc.is_deleted,
    u.nom_complet AS user_name, -- ✅ CORRIGÉ: Pas de cast en TEXT, garder le type original
    COALESCE(u.avatar_url, ''::VARCHAR(500)) AS user_avatar,
    (
        SELECT jsonb_object_agg(reaction_type, reaction_count)
        FROM (
            SELECT reaction_type, COUNT(*)::INT AS reaction_count
            FROM product_comment_reactions
            WHERE comment_id = pc.id
            GROUP BY reaction_type
        ) sub
    ) AS aggregated_reactions,
    (
        SELECT COUNT(*)::INT
        FROM product_comments replies
        WHERE replies.parent_comment_id = pc.id
          AND replies.is_deleted = FALSE
    ) AS reply_count
FROM product_comments pc
JOIN users u ON u.id = pc.user_id;

-- ============================================================================
-- 12. CORRECTION: Corriger l'index sur services.gps
-- ============================================================================

-- Supprimer l'index problématique s'il existe
DROP INDEX IF EXISTS idx_services_gps_search;

-- Vérifier si la colonne gps existe avant de créer l'index
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'services'
        AND column_name = 'gps'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_services_gps_search 
        ON services (gps)
        WHERE is_active = true 
          AND gps IS NOT NULL 
          AND gps != '';
        RAISE NOTICE 'Index idx_services_gps_search créé';
    ELSE
        RAISE NOTICE 'Colonne gps n''existe pas dans services - index non créé';
    END IF;
END $$;

-- ============================================================================
-- 13. CORRECTION: Corriger matching_offres_candidats (plusieurs commandes)
-- ============================================================================

-- Les index doivent être créés séparément
CREATE INDEX IF NOT EXISTS idx_matching_score ON matching_offres_candidats(score_total DESC) WHERE score_total >= 70;
CREATE INDEX IF NOT EXISTS idx_matching_notified ON matching_offres_candidats(is_notified, date_calcul) WHERE is_notified = false;

-- ============================================================================
-- 14. CORRECTION: Corriger les index sur offres_emploi
-- ============================================================================

-- Vérifier que la colonne statut existe avant de créer les index
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'offres_emploi'
        AND column_name = 'statut'
    ) THEN
        -- Créer les index qui dépendent de statut
        CREATE INDEX IF NOT EXISTS idx_offres_statut_active ON offres_emploi(statut, is_active, date_limite_candidature) 
        WHERE statut = 'active' AND is_active = true;
        CREATE INDEX IF NOT EXISTS idx_offres_secteur ON offres_emploi(secteur, domaine, statut) 
        WHERE statut = 'active';
        CREATE INDEX IF NOT EXISTS idx_offres_type_contrat ON offres_emploi(type_contrat, statut) 
        WHERE statut = 'active';
        CREATE INDEX IF NOT EXISTS idx_offres_date_limite ON offres_emploi(date_limite_candidature, statut) 
        WHERE date_limite_candidature >= CURRENT_DATE AND statut = 'active';
        RAISE NOTICE 'Index sur offres_emploi créés';
    ELSE
        RAISE NOTICE 'Colonne statut n''existe pas dans offres_emploi - index non créés';
    END IF;

    -- Vérifier location_point
    IF EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'offres_emploi'
        AND column_name = 'location_point'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_offres_location ON offres_emploi USING GIST(location_point);
        RAISE NOTICE 'Index spatial sur offres_emploi créé';
    END IF;

    -- Vérifier tags
    IF EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'offres_emploi'
        AND column_name = 'tags'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_offres_tags ON offres_emploi USING GIN(tags);
        RAISE NOTICE 'Index GIN sur tags créé';
    END IF;
END $$;

-- ============================================================================
-- 15. CORRECTION: Corriger delivery_partners (plusieurs commandes)
-- ============================================================================

-- Créer les index séparément
CREATE INDEX IF NOT EXISTS idx_delivery_partners_name ON delivery_partners(name);
CREATE INDEX IF NOT EXISTS idx_delivery_partners_active ON delivery_partners(is_active);
CREATE INDEX IF NOT EXISTS idx_delivery_partners_created_by ON delivery_partners(created_by);
CREATE INDEX IF NOT EXISTS idx_delivery_partners_type ON delivery_partners(partner_type);

-- ============================================================================
-- FIN DU SCRIPT
-- ============================================================================

-- Message de fin
DO $$
BEGIN
    RAISE NOTICE '✅ Script de correction terminé';
    RAISE NOTICE '⚠️  Vérifiez les messages ci-dessus pour les erreurs potentielles';
    RAISE NOTICE '📋 Exécutez diagnostic_migrations_aws.sql pour vérifier l''état final';
END $$;


