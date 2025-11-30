-- ============================================================
-- TEST DE PERFORMANCE - Conditions réelles du code
-- ============================================================
-- Simule exactement les appels du code Rust
-- Termes: photographe, électricien, restaurant, toyota rav4
-- ============================================================

\timing on

\echo ''
\echo '════════════════════════════════════════════════════════════════'
\echo '  TEST DE PERFORMANCE - Conditions réelles du code'
\echo '════════════════════════════════════════════════════════════════'
\echo ''

-- Coordonnées GPS réelles (Douala, Cameroun - comme dans le code)
\set gps_douala '4.0301206,9.818945'

\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo 'TEST 1: "photographe" (sans GPS) - max_results=20'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

SELECT COUNT(*) as resultats FROM search_services_gps_final('photographe', NULL, 50, 20);

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo 'TEST 2: "photographe" (avec GPS Douala, rayon=50km, max=20)'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

SELECT COUNT(*) as resultats FROM search_services_gps_final('photographe', :'gps_douala', 50, 20);

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo 'TEST 3: "électricien" (sans GPS) - max_results=20'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

SELECT COUNT(*) as resultats FROM search_services_gps_final('électricien', NULL, 50, 20);

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo 'TEST 4: "électricien" (avec GPS Douala, rayon=50km, max=20)'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

SELECT COUNT(*) as resultats FROM search_services_gps_final('électricien', :'gps_douala', 50, 20);

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo 'TEST 5: "restaurant" (sans GPS) - max_results=20'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

SELECT COUNT(*) as resultats FROM search_services_gps_final('restaurant', NULL, 50, 20);

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo 'TEST 6: "restaurant" (avec GPS Douala, rayon=50km, max=20)'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

SELECT COUNT(*) as resultats FROM search_services_gps_final('restaurant', :'gps_douala', 50, 20);

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo 'TEST 7: "toyota rav4" (sans GPS) - max_results=20'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

SELECT COUNT(*) as resultats FROM search_services_gps_final('toyota rav4', NULL, 50, 20);

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo 'TEST 8: "toyota rav4" (avec GPS Douala, rayon=50km, max=20)'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

SELECT COUNT(*) as resultats FROM search_services_gps_final('toyota rav4', :'gps_douala', 50, 20);

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo 'TEST 9: "toyota" (sans GPS) - Recherche partielle'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

SELECT COUNT(*) as resultats FROM search_services_gps_final('toyota', NULL, 50, 20);

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo 'TEST 10: "rav4" (sans GPS) - Recherche partielle'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

SELECT COUNT(*) as resultats FROM search_services_gps_final('rav4', NULL, 50, 20);

\echo ''
\echo '════════════════════════════════════════════════════════════════'
\echo '  TESTS TERMINÉS'
\echo '════════════════════════════════════════════════════════════════'

\timing off
