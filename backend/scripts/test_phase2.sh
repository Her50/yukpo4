#!/bin/bash
# Script de test pour Phase 2 optimisations

echo "🧪 Tests Phase 2 - Optimisations Livraison"
echo "=========================================="

# Configuration
DB_URL="${DATABASE_URL:-postgresql://yukpo_db_user:88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4@dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com/yukpo_db}"
API_URL="${API_URL:-http://localhost:3001}"

echo ""
echo "1️⃣ Test: Fonctions SQL Phase 2"
echo "-------------------------------"
psql "$DB_URL" -c "SELECT proname FROM pg_proc WHERE proname IN ('archive_old_deliveries', 'create_future_delivery_partitions');" -t

echo ""
echo "2️⃣ Test: Partitions créées"
echo "-------------------------"
psql "$DB_URL" -c "SELECT tablename FROM pg_tables WHERE tablename LIKE 'deliveries_%' ORDER BY tablename;" -t

echo ""
echo "3️⃣ Test: Table d'archive"
echo "-----------------------"
psql "$DB_URL" -c "SELECT COUNT(*) as archived_count FROM deliveries_archive;" -t

echo ""
echo "4️⃣ Test: Index optimisés"
echo "------------------------"
psql "$DB_URL" -c "SELECT indexname FROM pg_indexes WHERE tablename = 'deliveries' AND indexname LIKE '%active%';" -t

echo ""
echo "5️⃣ Test: Fonction find_nearby_couriers"
echo "--------------------------------------"
psql "$DB_URL" -c "SELECT proname FROM pg_proc WHERE proname = 'find_nearby_couriers';" -t

echo ""
echo "✅ Tests terminés"

