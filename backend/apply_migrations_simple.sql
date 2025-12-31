-- Script SQL pour appliquer les migrations 2025-01-01
-- Usage: psql $DATABASE_URL -f backend/apply_migrations_simple.sql

\echo '🔍 Application migration 1: Alignement search_services_gps_final...'
\i backend/migrations/20250101_ALIGN_SEARCH_GPS_FINAL_WITH_KEYWORD_SEARCH.sql

\echo '🔍 Application migration 2: Optimisation hybrid_image_search...'
\i backend/migrations/20250101_OPTIMIZE_HYBRID_IMAGE_SEARCH_WITH_UNACCENT_SIMILARITY.sql

\echo '✅ Toutes les migrations appliquées!'

