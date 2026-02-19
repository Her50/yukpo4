-- ============================================================================
-- VÉRIFICATION DES MIGRATIONS MANUELLES
-- Date: 2026-02-14
-- Objectif: Vérifier que toutes les migrations ont été exécutées correctement
-- ============================================================================

-- ============================================================================
-- 1. COMPTER LES TABLES
-- ============================================================================
SELECT 
    'Tables totales' as type,
    COUNT(*) as count
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE';

-- ============================================================================
-- 2. VÉRIFIER LES INDEX DUPLIQUÉS
-- ============================================================================
SELECT 
    'Index dupliqués' as type,
    indexname,
    COUNT(*) as count
FROM pg_indexes 
WHERE schemaname = 'public' 
GROUP BY indexname 
HAVING COUNT(*) > 1;

-- ============================================================================
-- 3. VÉRIFIER LES FONCTIONS
-- ============================================================================
SELECT 
    'Fonctions totales' as type,
    COUNT(*) as count
FROM information_schema.routines 
WHERE routine_schema = 'public';

-- ============================================================================
-- 4. VÉRIFIER LES VUES MATÉRIALISÉES
-- ============================================================================
SELECT 
    'Vues matérialisées' as type,
    COUNT(*) as count
FROM pg_matviews 
WHERE schemaname = 'public';

-- ============================================================================
-- 5. VÉRIFIER LES TABLES CRITIQUES MENTIONNÉES DANS LE LOG 58
-- ============================================================================
SELECT 
    'Tables critiques' as type,
    table_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = t.table_name
        ) THEN '✅ Existe'
        ELSE '❌ Manquante'
    END as status
FROM (
    VALUES 
        ('property_views'),
        ('property_shares'),
        ('family_profiles'),
        ('recipes'),
        ('menu_plans'),
        ('planned_meals'),
        ('recipe_favorites'),
        ('shopping_lists'),
        ('shopping_list_items'),
        ('nutrition_analytics'),
        ('plugin_marketplace'),
        ('livres_scolaires'),
        ('troc_livres_scolaires'),
        ('chaines_troc_livres'),
        ('offres_emploi'),
        ('profils_candidats'),
        ('candidatures'),
        ('matching_offres_candidats'),
        ('alertes_emploi'),
        ('statistiques_offres'),
        ('etablissements_scolaires'),
        ('delivery_chat_messages'),
        ('delivery_gamification_stats'),
        ('delivery_badges'),
        ('delivery_points_history'),
        ('delivery_product_suggestions'),
        ('user_documents'),
        ('covoiturage_insurance'),
        ('reservation_qr_codes'),
        ('loyalty_transactions'),
        ('loyalty_rewards'),
        ('chat_support_sessions'),
        ('chat_support_messages'),
        ('bus_ticket_ratings'),
        ('videos'),
        ('user_preferences'),
        ('video_generation_metrics'),
        ('rate_limit_tracking'),
        ('message_reactions')
) AS t(table_name);

-- ============================================================================
-- 6. VÉRIFIER LES INDEX CRITIQUES
-- ============================================================================
SELECT 
    'Index critiques' as type,
    indexname,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE schemaname = 'public' 
            AND indexname = i.indexname
        ) THEN '✅ Existe'
        ELSE '❌ Manquant'
    END as status
FROM (
    VALUES 
        ('idx_offres_date_limite'),
        ('idx_property_views_user_id'),
        ('idx_delivery_chat_messages_delivery_id'),
        ('idx_videos_user_id'),
        ('idx_user_preferences_user_id')
) AS i(indexname);

-- ============================================================================
-- 7. VÉRIFIER LES FONCTIONS CRITIQUES
-- ============================================================================
SELECT 
    'Fonctions critiques' as type,
    routine_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.routines 
            WHERE routine_schema = 'public' 
            AND routine_name = f.routine_name
        ) THEN '✅ Existe'
        ELSE '❌ Manquante'
    END as status
FROM (
    VALUES 
        ('run_audio_cache_cleanup'),
        ('update_user_documents_updated_at'),
        ('refresh_services_search_optimized')
) AS f(routine_name);

-- ============================================================================
-- 8. RÉSUMÉ DES ERREURS POTENTIELLES
-- ============================================================================
SELECT 
    'Résumé' as type,
    'Tables manquantes' as category,
    COUNT(*) as count
FROM (
    VALUES 
        ('property_views'),
        ('property_shares'),
        ('family_profiles'),
        ('recipes'),
        ('menu_plans'),
        ('planned_meals'),
        ('recipe_favorites'),
        ('shopping_lists'),
        ('shopping_list_items'),
        ('nutrition_analytics'),
        ('plugin_marketplace'),
        ('livres_scolaires'),
        ('troc_livres_scolaires'),
        ('chaines_troc_livres'),
        ('offres_emploi'),
        ('profils_candidats'),
        ('candidatures'),
        ('matching_offres_candidats'),
        ('alertes_emploi'),
        ('statistiques_offres'),
        ('etablissements_scolaires'),
        ('delivery_chat_messages'),
        ('delivery_gamification_stats'),
        ('delivery_badges'),
        ('delivery_points_history'),
        ('delivery_product_suggestions'),
        ('user_documents'),
        ('covoiturage_insurance'),
        ('reservation_qr_codes'),
        ('loyalty_transactions'),
        ('loyalty_rewards'),
        ('chat_support_sessions'),
        ('chat_support_messages'),
        ('bus_ticket_ratings'),
        ('videos'),
        ('user_preferences'),
        ('video_generation_metrics'),
        ('rate_limit_tracking'),
        ('message_reactions')
) AS t(table_name)
WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = t.table_name
);



