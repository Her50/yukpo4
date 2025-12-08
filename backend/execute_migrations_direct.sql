-- Script pour exécuter les migrations directement sur la base de données
-- Même si elles sont déjà dans auto_migrate, ce script les exécute directement

-- ============================================================================
-- 1. Migration: pharmacy_products
-- ============================================================================
\echo '📝 Exécution de 20250128_002_add_pharmacy_products.sql...'
\i migrations/20250128_002_add_pharmacy_products.sql

-- ============================================================================
-- 2. Migration: pharmacy_advanced_tables
-- ============================================================================
\echo '📝 Exécution de 20250127_create_pharmacy_advanced_tables.sql...'
\i migrations/20250127_create_pharmacy_advanced_tables.sql

-- ============================================================================
-- 3. Migration: search_history
-- ============================================================================
\echo '📝 Exécution de 20250128_create_search_history_and_saved_searches.sql...'
\i migrations/20250128_create_search_history_and_saved_searches.sql

-- ============================================================================
-- 4. Migration: bourse_livre_advanced_tables
-- ============================================================================
\echo '📝 Exécution de 20250127_create_bourse_livre_advanced_tables.sql...'
\i migrations/20250127_create_bourse_livre_advanced_tables.sql

-- ============================================================================
-- 5. Migration: orientation_scolaire_advanced_tables
-- ============================================================================
\echo '📝 Exécution de 20250127_create_orientation_scolaire_advanced_tables.sql...'
\i migrations/20250127_create_orientation_scolaire_advanced_tables.sql

-- ============================================================================
-- 6. Migration: offres_emploi_advanced_tables
-- ============================================================================
\echo '📝 Exécution de 20250127_create_offres_emploi_advanced_tables.sql...'
\i migrations/20250127_create_offres_emploi_advanced_tables.sql

\echo '✅ Toutes les migrations ont été exécutées'

