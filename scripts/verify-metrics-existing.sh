#!/bin/bash
# ✅ Script pour vérifier les métriques avec les variables existantes de l'application

set -e

# ✅ Utiliser les variables d'environnement existantes si disponibles
BACKEND_URL="${BACKEND_URL:-${VITE_API_BASE_URL:-http://localhost:3000}}"
PROMETHEUS_URL="${PROMETHEUS_URL:-http://localhost:9090}"

# ✅ Si déployé sur Render, utiliser l'URL Render
if [ -z "$BACKEND_URL" ] || [ "$BACKEND_URL" = "http://localhost:3000" ]; then
    # Essayer de détecter l'URL Render depuis les variables d'environnement
    if [ -n "$RENDER_SERVICE_URL" ]; then
        BACKEND_URL="$RENDER_SERVICE_URL"
    elif [ -n "$RENDER_EXTERNAL_URL" ]; then
        BACKEND_URL="$RENDER_EXTERNAL_URL"
    else
        # URL par défaut Render (à adapter)
        BACKEND_URL="${BACKEND_URL:-https://yukpomnang.onrender.com}"
    fi
fi

echo "🔍 Vérification des métriques avec variables existantes"
echo "=================================================="
echo "Backend URL: $BACKEND_URL"
echo "Prometheus URL: $PROMETHEUS_URL"
echo ""

# ✅ Vérifier l'endpoint /metrics/prometheus
echo "1️⃣  Vérification endpoint /metrics/prometheus..."
METRICS_ENDPOINT="$BACKEND_URL/metrics/prometheus"

if curl -s -f "$METRICS_ENDPOINT" > /dev/null 2>&1; then
    echo "✅ Endpoint /metrics/prometheus accessible"
    
    # ✅ Vérifier les métriques vidéo
    echo ""
    echo "2️⃣  Vérification métriques vidéo..."
    METRICS=$(curl -s "$METRICS_ENDPOINT")
    
    METRICS_TO_CHECK=(
        "video_queue_length"
        "video_jobs_processed_total"
        "video_jobs_failed_total"
        "video_jobs_completed_total"
        "video_active_workers"
        "video_cache_hits"
        "video_cache_misses"
        "video_job_duration_seconds"
    )
    
    FOUND=0
    MISSING=0
    
    for metric in "${METRICS_TO_CHECK[@]}"; do
        if echo "$METRICS" | grep -q "$metric"; then
            echo "  ✅ $metric trouvé"
            FOUND=$((FOUND + 1))
        else
            echo "  ⚠️  $metric NON trouvé"
            MISSING=$((MISSING + 1))
        fi
    done
    
    echo ""
    echo "📊 Résumé: $FOUND trouvés, $MISSING manquants"
    
    # ✅ Vérifier le label job="yukpo-backend"
    echo ""
    echo "3️⃣  Vérification label job=\"yukpo-backend\"..."
    if echo "$METRICS" | grep -q 'job="yukpo-backend"'; then
        echo "  ✅ Label job=\"yukpo-backend\" présent"
    else
        echo "  ⚠️  Label job=\"yukpo-backend\" NON trouvé"
    fi
    
else
    echo "❌ Endpoint /metrics/prometheus non accessible à $METRICS_ENDPOINT"
    echo ""
    echo "💡 Vérifications:"
    echo "  - Le backend est-il démarré ?"
    echo "  - L'URL est-elle correcte ?"
    echo "  - Le port est-il accessible ?"
    exit 1
fi

# ✅ Vérifier Prometheus (si accessible)
if curl -s -f "$PROMETHEUS_URL/api/v1/query?query=up" > /dev/null 2>&1; then
    echo ""
    echo "4️⃣  Vérification Prometheus..."
    
    # ✅ Vérifier que le target est UP
    TARGETS=$(curl -s "$PROMETHEUS_URL/api/v1/targets" 2>/dev/null | jq -r '.data.activeTargets[] | select(.labels.job=="yukpo-backend") | .health' 2>/dev/null || echo "")
    if [ "$TARGETS" = "up" ]; then
        echo "  ✅ Target yukpo-backend est UP"
    else
        echo "  ⚠️  Target yukpo-backend n'est pas UP (ou non configuré)"
    fi
else
    echo ""
    echo "⚠️  Prometheus non accessible à $PROMETHEUS_URL"
    echo "   (Normal si Prometheus n'est pas déployé localement)"
fi

echo ""
echo "✅ Vérification terminée!"

