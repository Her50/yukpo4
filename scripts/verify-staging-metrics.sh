#!/bin/bash
# ✅ Script pour vérifier les métriques en staging

set -e

BACKEND_URL="${BACKEND_URL:-http://localhost:3000}"
PROMETHEUS_URL="${PROMETHEUS_URL:-http://localhost:9090}"

echo "🔍 Vérification des métriques en staging"
echo "=================================================="
echo "Backend: $BACKEND_URL"
echo "Prometheus: $PROMETHEUS_URL"
echo ""

# ✅ Vérifier l'endpoint /metrics du backend
echo "1️⃣  Vérification endpoint /metrics..."
if curl -s -f "$BACKEND_URL/metrics/prometheus" > /dev/null; then
    echo "✅ Endpoint /metrics accessible"
    
    # ✅ Vérifier les métriques vidéo
    echo ""
    echo "2️⃣  Vérification métriques vidéo..."
    METRICS=$(curl -s "$BACKEND_URL/metrics/prometheus")
    
    METRICS_TO_CHECK=(
        "video_queue_length"
        "video_jobs_processed_total"
        "video_jobs_failed_total"
        "video_jobs_completed_total"
        "video_active_workers"
        "video_cache_hits"
        "video_cache_misses"
    )
    
    for metric in "${METRICS_TO_CHECK[@]}"; do
        if echo "$METRICS" | grep -q "$metric"; then
            echo "  ✅ $metric trouvé"
        else
            echo "  ⚠️  $metric NON trouvé"
        fi
    done
else
    echo "❌ Endpoint /metrics non accessible"
    exit 1
fi

# ✅ Vérifier Prometheus (si accessible)
if curl -s -f "$PROMETHEUS_URL/api/v1/query?query=up" > /dev/null 2>&1; then
    echo ""
    echo "3️⃣  Vérification Prometheus..."
    
    # ✅ Vérifier que le target est UP
    TARGETS=$(curl -s "$PROMETHEUS_URL/api/v1/targets" | jq -r '.data.activeTargets[] | select(.labels.job=="yukpo-backend") | .health' 2>/dev/null || echo "")
    if [ "$TARGETS" = "up" ]; then
        echo "  ✅ Target yukpo-backend est UP"
    else
        echo "  ⚠️  Target yukpo-backend n'est pas UP"
    fi
    
    # ✅ Vérifier les métriques dans Prometheus
    echo ""
    echo "4️⃣  Vérification métriques dans Prometheus..."
    for metric in "${METRICS_TO_CHECK[@]}"; do
        QUERY_RESULT=$(curl -s "$PROMETHEUS_URL/api/v1/query?query=$metric{job=\"yukpo-backend\"}" | jq -r '.data.result | length' 2>/dev/null || echo "0")
        if [ "$QUERY_RESULT" -gt 0 ]; then
            echo "  ✅ $metric collecté"
        else
            echo "  ⚠️  $metric non collecté"
        fi
    done
else
    echo ""
    echo "⚠️  Prometheus non accessible à $PROMETHEUS_URL"
fi

echo ""
echo "✅ Vérification terminée!"

