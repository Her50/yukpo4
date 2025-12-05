#!/bin/bash
# ✅ Phase 4: Vérification que Prometheus collecte les nouvelles métriques

set -e

PROMETHEUS_URL="${PROMETHEUS_URL:-http://localhost:9090}"
BACKEND_URL="${BACKEND_URL:-http://localhost:3000}"

echo "🔍 Vérification des métriques Prometheus"
echo "=================================================="

# ✅ Liste des métriques à vérifier
METRICS=(
    "video_queue_length"
    "video_jobs_processed_total"
    "video_jobs_failed_total"
    "video_jobs_completed_total"
    "video_active_workers"
    "video_cache_hits"
    "video_cache_misses"
    "video_job_duration_seconds_bucket"
)

# ✅ Vérifier que le backend expose /metrics
echo "1️⃣  Vérification endpoint /metrics du backend..."
if curl -s -f "$BACKEND_URL/metrics" > /dev/null; then
    echo "✅ Endpoint /metrics accessible"
    
    # ✅ Vérifier les métriques dans la réponse
    METRICS_RESPONSE=$(curl -s "$BACKEND_URL/metrics")
    for metric in "${METRICS[@]}"; do
        if echo "$METRICS_RESPONSE" | grep -q "$metric"; then
            echo "  ✅ $metric trouvé"
        else
            echo "  ⚠️  $metric NON trouvé"
        fi
    done
else
    echo "❌ Endpoint /metrics non accessible"
    exit 1
fi

# ✅ Vérifier que Prometheus scrape le backend
echo ""
echo "2️⃣  Vérification que Prometheus scrape le backend..."
if curl -s -f "$PROMETHEUS_URL/api/v1/targets" > /dev/null; then
    TARGETS=$(curl -s "$PROMETHEUS_URL/api/v1/targets" | jq -r '.data.activeTargets[] | select(.labels.job=="yukpo-backend") | .health')
    if [ "$TARGETS" = "up" ]; then
        echo "✅ Target yukpo-backend est UP"
    else
        echo "⚠️  Target yukpo-backend n'est pas UP (health: $TARGETS)"
    fi
else
    echo "⚠️  Prometheus non accessible à $PROMETHEUS_URL"
fi

# ✅ Vérifier les métriques dans Prometheus
echo ""
echo "3️⃣  Vérification des métriques dans Prometheus..."
for metric in "${METRICS[@]}"; do
    QUERY_RESULT=$(curl -s "$PROMETHEUS_URL/api/v1/query?query=$metric{job=\"yukpo-backend\"}" | jq -r '.data.result | length')
    if [ "$QUERY_RESULT" -gt 0 ]; then
        echo "  ✅ $metric collecté ($QUERY_RESULT série(s))"
    else
        echo "  ⚠️  $metric non collecté"
    fi
done

echo ""
echo "✅ Vérification terminée!"
echo ""
echo "📊 Pour voir toutes les métriques:"
echo "   curl $BACKEND_URL/metrics | grep video_"
echo ""
echo "📊 Pour interroger Prometheus:"
echo "   curl '$PROMETHEUS_URL/api/v1/query?query=video_queue_length{job=\"yukpo-backend\"}'"

