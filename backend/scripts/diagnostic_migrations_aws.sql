-- Script de diagnostic et correction des migrations AWS
-- Date: 2026-01-30
-- Description: Vérifie l'état des tables et fonctions, identifie les problèmes

-- ============================================================================
-- 1. VÉRIFICATION DES TABLES CRITIQUES
-- ============================================================================

-- Vérifier si pharmacy_products existe et son type d'ID
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'pharmacy_products'
ORDER BY ordinal_position;

-- Vérifier si specialized_reservations existe
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'specialized_reservations'
) as specialized_reservations_exists;

-- Vérifier si offres_emploi existe et ses colonnes
SELECT 
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'offres_emploi'
AND column_name IN ('statut', 'status', 'location_point', 'tags', 'date_limite_candidature', 'entreprise_id')
ORDER BY column_name;

-- Vérifier si services a la colonne gps
SELECT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'services'
    AND column_name = 'gps'
) as services_gps_exists;

-- ============================================================================
-- 2. VÉRIFICATION DES FONCTIONS hybrid_image_search
-- ============================================================================

-- Lister toutes les versions de hybrid_image_search
SELECT 
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as arguments,
    pg_get_function_result(p.oid) as return_type,
    p.oid
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'hybrid_image_search'
AND n.nspname = 'public'
ORDER BY p.oid;

-- ============================================================================
-- 3. VÉRIFICATION DES TABLES MANQUANTES
-- ============================================================================

-- Vérifier toutes les tables référencées dans les erreurs
SELECT 
    table_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = t.table_name
        ) THEN 'EXISTS'
        ELSE 'MISSING'
    END as status
FROM (
    VALUES 
        ('pharmacy_order_items'),
        ('pharmacy_reservations'),
        ('pharmacy_products'),
        ('specialized_reservations'),
        ('programmes_scolaires'),
        ('covoiturage_insurance'),
        ('reservation_qr_codes'),
        ('services_search_cache'),
        ('active_products_cache'),
        ('offres_emploi')
) AS t(table_name)
ORDER BY table_name;

-- ============================================================================
-- 4. VÉRIFICATION DES CONTRAINTES DE CLÉ ÉTRANGÈRE
-- ============================================================================

-- Vérifier les contraintes FK qui échouent
SELECT 
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    tc.constraint_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
AND (
    (tc.table_name = 'pharmacy_order_items' AND kcu.column_name = 'medication_id')
    OR (tc.table_name = 'pharmacy_reservations' AND kcu.column_name = 'medication_id')
    OR (tc.table_name = 'covoiturage_insurance' AND kcu.column_name = 'reservation_id')
    OR (tc.table_name = 'reservation_qr_codes' AND kcu.column_name = 'reservation_id')
)
ORDER BY tc.table_name, kcu.column_name;






