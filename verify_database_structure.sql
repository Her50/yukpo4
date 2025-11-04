-- ===================================================================
-- SCRIPT DE DIAGNOSTIC COMPLET - Base de données Yukpomnang
-- Date: 2025-11-04
-- ===================================================================

\echo '🔍 ========== DIAGNOSTIC BASE DE DONNÉES =========='
\echo ''

-- 1. Vérifier si la table autocomplete_combinations existe
\echo '1️⃣ Vérification table autocomplete_combinations...'
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public'
            AND table_name = 'autocomplete_combinations'
        ) 
        THEN '✅ Table autocomplete_combinations EXISTE' 
        ELSE '❌ Table autocomplete_combinations MANQUANTE' 
    END as status;

\echo ''
\echo '2️⃣ Liste des colonnes de autocomplete_combinations...'
SELECT 
    column_name, 
    data_type,
    CASE WHEN is_nullable = 'YES' THEN 'NULL' ELSE 'NOT NULL' END as nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'autocomplete_combinations'
ORDER BY ordinal_position;

\echo ''
\echo '3️⃣ Vérification colonne product_labels...'
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public'
            AND table_name = 'autocomplete_combinations' 
            AND column_name = 'product_labels'
        ) 
        THEN '✅ Colonne product_labels EXISTE' 
        ELSE '❌ Colonne product_labels MANQUANTE - MIGRATION REQUISE !' 
    END as product_labels_status;

\echo ''
\echo '4️⃣ Statistiques de la table...'
SELECT 
    COUNT(*) as total_rows,
    COUNT(CASE WHEN usage_count >= 2 THEN 1 END) as produits_populaires,
    COUNT(CASE WHEN is_ai_preferred = TRUE THEN 1 END) as preferes_ia,
    MAX(usage_count) as max_usage_count,
    MIN(created_at) as premiere_entree,
    MAX(created_at) as derniere_entree
FROM autocomplete_combinations;

\echo ''
\echo '5️⃣ Top 5 produits les plus populaires...'
SELECT 
    id,
    product_vector,
    product_labels,
    usage_count,
    prix,
    has_variant,
    variant_dimension,
    TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI') as created
FROM autocomplete_combinations
WHERE usage_count >= 2
ORDER BY usage_count DESC
LIMIT 5;

\echo ''
\echo '6️⃣ Vérification index GIN sur product_vector...'
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'autocomplete_combinations'
AND indexname LIKE '%product_vector%';

\echo ''
\echo '7️⃣ Vérification migrations appliquées...'
SELECT 
    version,
    description,
    installed_on,
    success
FROM _sqlx_migrations
WHERE description LIKE '%autocomplete%'
OR description LIKE '%product_labels%'
OR description LIKE '%missing_columns%'
ORDER BY installed_on DESC
LIMIT 10;

\echo ''
\echo '✅ ========== FIN DU DIAGNOSTIC =========='

