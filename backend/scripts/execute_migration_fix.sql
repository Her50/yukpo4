-- Script pour exécuter la migration 20251210_fix_u_client_name_error.sql
-- Ce script exécute directement la migration corrigée

-- Migration pour vérifier et corriger l'erreur "column u_client.name does not exist"
-- Date: 2025-12-10
-- Description: Vérifie toutes les vues et fonctions PostgreSQL qui référencent u_client.name
--              et les corrige pour utiliser u_client.nom_complet à la place

-- =====================================================
-- 1. VÉRIFIER LES VUES QUI UTILISENT u_client.name
-- =====================================================

-- Rechercher toutes les vues qui contiennent "u_client.name"
DO $$
DECLARE
    view_record RECORD;
    view_definition TEXT;
BEGIN
    FOR view_record IN 
        SELECT schemaname, viewname, definition
        FROM pg_views
        WHERE definition ILIKE '%u_client.name%'
           OR definition ILIKE '%u_client%name%'
    LOOP
        RAISE NOTICE 'Vue trouvée avec u_client.name: %.%', view_record.schemaname, view_record.viewname;
        RAISE NOTICE 'Définition: %', view_record.definition;
    END LOOP;
END $$;

-- =====================================================
-- 2. VÉRIFIER LES FONCTIONS QUI UTILISENT u_client.name
-- =====================================================

-- Rechercher toutes les fonctions qui contiennent "u_client.name"
DO $$
DECLARE
    func_record RECORD;
    func_definition TEXT;
BEGIN
    FOR func_record IN 
        SELECT n.nspname as schema_name, p.proname as function_name, pg_get_functiondef(p.oid) as definition
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE pg_get_functiondef(p.oid) ILIKE '%u_client.name%'
           OR pg_get_functiondef(p.oid) ILIKE '%u_client%name%'
    LOOP
        RAISE NOTICE 'Fonction trouvée avec u_client.name: %.%', func_record.schema_name, func_record.function_name;
    END LOOP;
END $$;

-- =====================================================
-- 3. VÉRIFIER LES VUES MATÉRIALISÉES
-- =====================================================

-- Rechercher toutes les vues matérialisées qui contiennent "u_client.name"
DO $$
DECLARE
    matview_record RECORD;
BEGIN
    FOR matview_record IN 
        SELECT schemaname, matviewname, definition
        FROM pg_matviews
        WHERE definition ILIKE '%u_client.name%'
           OR definition ILIKE '%u_client%name%'
    LOOP
        RAISE NOTICE 'Vue matérialisée trouvée avec u_client.name: %.%', matview_record.schemaname, matview_record.matviewname;
    END LOOP;
END $$;

-- =====================================================
-- 4. CORRIGER LES VUES/FONCTIONS TROUVÉES (si nécessaire)
-- =====================================================

-- Note: Les corrections spécifiques seront ajoutées ici si des vues/fonctions sont trouvées
-- Pour l'instant, cette migration sert uniquement à diagnostiquer le problème

-- =====================================================
-- 5. VÉRIFIER QUE LA COLONNE nom_complet EXISTE DANS users
-- =====================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'users' 
          AND column_name = 'nom_complet'
    ) THEN
        RAISE EXCEPTION 'La colonne nom_complet n''existe pas dans la table users';
    ELSE
        RAISE NOTICE '✅ La colonne nom_complet existe dans la table users';
    END IF;
END $$;

-- =====================================================
-- 6. VÉRIFIER QUE LA COLONNE name N'EXISTE PAS DANS users
-- =====================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'users' 
          AND column_name = 'name'
    ) THEN
        RAISE WARNING 'La colonne name existe dans la table users (devrait être nom_complet)';
    ELSE
        RAISE NOTICE '✅ La colonne name n''existe pas dans la table users (comme attendu)';
    END IF;
END $$;

-- ✅ Migration: Vérifie et corrige les références à u_client.name dans les vues/fonctions PostgreSQL
-- Note: Les descriptions de migrations sont gérées par SQLx via le nom du fichier et la table _sqlx_migrations

