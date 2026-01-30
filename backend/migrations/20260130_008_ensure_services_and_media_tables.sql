-- Migration CRITIQUE: Garantir que les tables services et media existent
-- Date: 2026-01-30
-- Description: Crée explicitement les tables services et media si elles n'existent pas
--              Ces tables sont critiques pour le fonctionnement de l'application
-- =====================================================

-- =====================================================
-- CRITIQUE: Créer la table services si elle n'existe pas
-- =====================================================
-- Problème: services dépend de users (clé étrangère), donc si users n'existe pas, services ne peut pas être créée
-- Solution: Créer services APRÈS users (qui est créée par la migration 007)
DO $$
BEGIN
    -- Vérifier si la table services existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'services'
    ) THEN
        -- Vérifier d'abord que users existe (sinon on ne peut pas créer services)
        IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'users'
        ) THEN
            RAISE NOTICE '🔧 Création de la table services...';
            
            -- Créer la table services avec toutes les colonnes nécessaires
            CREATE TABLE services (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                data JSONB NOT NULL,
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                auto_deactivate_at TIMESTAMPTZ,
                last_reactivated_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                is_tarissable BOOLEAN,
                vitesse_tarissement VARCHAR(255),
                active_days INTEGER,
                category VARCHAR(255),
                specialized_type VARCHAR(50),
                last_alert_sent_at TIMESTAMP,
                gps VARCHAR(255),
                location_point GEOMETRY(POINT, 4326)
            );
            
            -- Créer les index essentiels
            CREATE INDEX IF NOT EXISTS idx_services_user_id ON services(user_id);
            CREATE INDEX IF NOT EXISTS idx_services_is_active ON services(is_active);
            CREATE INDEX IF NOT EXISTS idx_services_category ON services(category) WHERE category IS NOT NULL;
            CREATE INDEX IF NOT EXISTS idx_services_created_at ON services(created_at DESC);
            
            RAISE NOTICE '✅ Table services créée avec succès';
        ELSE
            RAISE WARNING '⚠️ Table users n''existe pas, impossible de créer services (dépendance)';
        END IF;
    ELSE
        RAISE NOTICE 'ℹ️ Table services existe déjà';
        
        -- Ajouter la colonne location_point si elle n'existe pas
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'services' 
            AND column_name = 'location_point'
        ) THEN
            ALTER TABLE services ADD COLUMN location_point GEOMETRY(POINT, 4326);
            RAISE NOTICE '✅ Colonne location_point ajoutée à services';
        END IF;
    END IF;
END $$;

-- =====================================================
-- CRITIQUE: Créer la table media si elle n'existe pas
-- =====================================================
-- Problème: media dépend de services (clé étrangère), donc si services n'existe pas, media ne peut pas être créée
-- Solution: Créer media APRÈS services
DO $$
BEGIN
    -- Vérifier si la table media existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'media'
    ) THEN
        -- Vérifier d'abord que services existe (sinon on ne peut pas créer media)
        IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'services'
        ) THEN
            RAISE NOTICE '🔧 Création de la table media...';
            
            -- Créer la table media avec toutes les colonnes nécessaires
            CREATE TABLE media (
                id SERIAL PRIMARY KEY,
                service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
                product_id TEXT,
                product_index INTEGER,
                type TEXT NOT NULL,
                path TEXT NOT NULL,
                uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                media_type TEXT,
                file_size BIGINT,
                file_format TEXT,
                is_main_image BOOLEAN NOT NULL DEFAULT FALSE,
                display_order INTEGER NOT NULL DEFAULT 0,
                ai_description TEXT,
                ai_tags TEXT[],
                ai_category VARCHAR(100),
                ai_metadata JSONB,
                ai_analyzed_at TIMESTAMPTZ,
                ai_model_used VARCHAR(100),
                ai_confidence DOUBLE PRECISION
            );
            
            -- Contrainte sur media_type
            ALTER TABLE media ADD CONSTRAINT media_type_check 
                CHECK (media_type IS NULL OR media_type IN ('image', 'video', 'audio'));
            
            -- Créer les index essentiels
            CREATE INDEX IF NOT EXISTS idx_media_service_id ON media(service_id);
            CREATE INDEX IF NOT EXISTS idx_media_product_id ON media(product_id) WHERE product_id IS NOT NULL;
            CREATE INDEX IF NOT EXISTS idx_media_type ON media(type);
            CREATE INDEX IF NOT EXISTS idx_media_uploaded_at ON media(uploaded_at DESC);
            
            RAISE NOTICE '✅ Table media créée avec succès';
        ELSE
            RAISE WARNING '⚠️ Table services n''existe pas, impossible de créer media (dépendance)';
        END IF;
    ELSE
        RAISE NOTICE 'ℹ️ Table media existe déjà';
    END IF;
END $$;

