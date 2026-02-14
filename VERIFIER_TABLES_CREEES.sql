-- ============================================================================
-- VÉRIFICATION DES TABLES CRÉÉES
-- Date: 2026-02-14
-- Objectif: Vérifier que les tables critiques sont créées
-- ============================================================================

-- 1. Compter le nombre total de tables
SELECT 
    'Total tables' as type,
    COUNT(*) as count
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE';

-- 2. Vérifier les tables critiques mentionnées dans le Log 58
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

-- 3. Résumé : Compter les tables existantes vs manquantes
SELECT 
    'Résumé' as type,
    COUNT(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = t.table_name
    )) as tables_existantes,
    COUNT(*) FILTER (WHERE NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = t.table_name
    )) as tables_manquantes,
    COUNT(*) as total
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

-- 4. Vérifier les colonnes corrigées
SELECT 
    'Colonnes corrigées' as type,
    'live_session_analytics.last_synced_at' as colonne,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'live_session_analytics' 
            AND column_name = 'last_synced_at'
        ) THEN '✅ Existe'
        ELSE '❌ Manquante'
    END as status
UNION ALL
SELECT 
    'Colonnes corrigées' as type,
    'global_promo_products.highlighted' as colonne,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'global_promo_products' 
            AND column_name = 'highlighted'
        ) THEN '✅ Existe'
        ELSE '❌ Manquante'
    END as status;

-- 5. Vérifier l'index corrigé
SELECT 
    'Index corrigé' as type,
    indexname,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE indexname = 'idx_offres_date_limite'
        ) THEN '✅ Existe'
        ELSE '❌ Manquant'
    END as status,
    indexdef
FROM pg_indexes 
WHERE indexname = 'idx_offres_date_limite';

-- 6. Vérifier la vue matérialisée corrigée
SELECT 
    'Vue matérialisée' as type,
    matviewname,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_matviews 
            WHERE matviewname = 'hashtag_stats_materialized'
        ) THEN '✅ Existe'
        ELSE '❌ Manquante'
    END as status,
    ispopulated
FROM pg_matviews 
WHERE matviewname = 'hashtag_stats_materialized';

