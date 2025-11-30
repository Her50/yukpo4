-- ============================================================
-- TEST PERFORMANCE APRÈS FIX
-- ============================================================

\timing on

\echo '=== TEST PERFORMANCE AVEC FONCTION CORRIGÉE ==='
\echo ''

\echo '1. "photographe" (sans GPS):'
SELECT COUNT(*) FROM search_services_gps_final('photographe', NULL, 50, 20);

\echo ''
\echo '2. "électricien" (sans GPS):'
SELECT COUNT(*) FROM search_services_gps_final('électricien', NULL, 50, 20);

\echo ''
\echo '3. "restaurant" (sans GPS):'
SELECT COUNT(*) FROM search_services_gps_final('restaurant', NULL, 50, 20);

\echo ''
\echo '4. "toyota rav4" (sans GPS):'
SELECT COUNT(*) FROM search_services_gps_final('toyota rav4', NULL, 50, 20);

\timing off

