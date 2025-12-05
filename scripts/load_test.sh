#!/bin/bash
# ✅ Phase 5: Script de test de charge pour millions de créations vidéo

set -e

API_URL="${API_URL:-http://localhost:3000}"
CONCURRENT_USERS="${CONCURRENT_USERS:-1000}"
REQUESTS_PER_USER="${REQUESTS_PER_USER:-100}"
TOTAL_REQUESTS=$((CONCURRENT_USERS * REQUESTS_PER_USER))

echo "🚀 Phase 5: Test de charge - Yukpomnang Video Generation"
echo "=================================================="
echo "API URL: $API_URL"
echo "Concurrent Users: $CONCURRENT_USERS"
echo "Requests per User: $REQUESTS_PER_USER"
echo "Total Requests: $TOTAL_REQUESTS"
echo ""

# ✅ Test 1: Création de sessions studio
echo "📊 Test 1: Création de sessions studio..."
ab -n $TOTAL_REQUESTS -c $CONCURRENT_USERS \
   -p test_data/session_payload.json \
   -T application/json \
   -H "Authorization: Bearer $AUTH_TOKEN" \
   "$API_URL/api/studio/sessions" > results/sessions_test.log

# ✅ Test 2: Génération de storyboard
echo "📊 Test 2: Génération de storyboard..."
ab -n $TOTAL_REQUESTS -c $CONCURRENT_USERS \
   -p test_data/storyboard_payload.json \
   -T application/json \
   -H "Authorization: Bearer $AUTH_TOKEN" \
   "$API_URL/api/studio/sessions/{session_id}/storyboard" > results/storyboard_test.log

# ✅ Test 3: Génération de preview
echo "📊 Test 3: Génération de preview..."
ab -n $TOTAL_REQUESTS -c $CONCURRENT_USERS \
   -H "Authorization: Bearer $AUTH_TOKEN" \
   "$API_URL/api/studio/sessions/{session_id}/preview" > results/preview_test.log

# ✅ Test 4: Queue de jobs vidéo
echo "📊 Test 4: Enqueue de jobs vidéo..."
for i in $(seq 1 $CONCURRENT_USERS); do
    curl -X POST "$API_URL/api/media/product/1/0/generate-video" \
         -H "Authorization: Bearer $AUTH_TOKEN" \
         -H "Content-Type: application/json" \
         -d @test_data/video_job_payload.json &
done
wait

# ✅ Analyse des résultats
echo ""
echo "📈 Analyse des résultats..."
echo "=================================================="

# ✅ Latence moyenne
echo "Latence moyenne (sessions):"
grep "Time per request" results/sessions_test.log | head -1

echo "Latence moyenne (storyboard):"
grep "Time per request" results/storyboard_test.log | head -1

echo "Latence moyenne (preview):"
grep "Time per request" results/preview_test.log | head -1

# ✅ Taux d'erreur
echo ""
echo "Taux d'erreur (sessions):"
grep "Failed requests" results/sessions_test.log

echo "Taux d'erreur (storyboard):"
grep "Failed requests" results/storyboard_test.log

echo "Taux d'erreur (preview):"
grep "Failed requests" results/preview_test.log

# ✅ Throughput
echo ""
echo "Throughput (req/sec):"
grep "Requests per second" results/*.log

echo ""
echo "✅ Tests de charge terminés!"
echo "Résultats détaillés dans: results/"

