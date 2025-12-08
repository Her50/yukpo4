-- Script pour exécuter toutes les migrations directement
-- À exécuter avec: psql "postgresql://yukpo_db_user:88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4@dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com/yukpo_db" -f run_all_migrations.sql

\echo '🔧 Exécution des migrations directement sur la base de données...'
\echo ''

-- Migration 1: pharmacy_products
\echo '📝 Exécution de pharmacy_products...'
\i migrations/20250128_002_add_pharmacy_products.sql

-- Migration 2: pharmacy_advanced_tables  
\echo '📝 Exécution de pharmacy_advanced_tables...'
\i migrations/20250127_create_pharmacy_advanced_tables.sql

-- Migration 3: search_history
\echo '📝 Exécution de search_history...'
\i migrations/20250128_create_search_history_and_saved_searches.sql

-- Migration 4: bourse_livre_advanced_tables
\echo '📝 Exécution de bourse_livre_advanced_tables...'
\i migrations/20250127_create_bourse_livre_advanced_tables.sql

-- Migration 5: orientation_scolaire_advanced_tables
\echo '📝 Exécution de orientation_scolaire_advanced_tables...'
\i migrations/20250127_create_orientation_scolaire_advanced_tables.sql

-- Migration 6: offres_emploi_advanced_tables
\echo '📝 Exécution de offres_emploi_advanced_tables...'
\i migrations/20250127_create_offres_emploi_advanced_tables.sql

\echo ''
\echo '✅ Toutes les migrations ont été exécutées'

