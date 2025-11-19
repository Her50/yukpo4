#!/bin/bash
# Script de création automatique d'un dashboard Grafana pour Yukpo

GRAFANA_URL="http://localhost:3002"
GRAFANA_USER="admin"
GRAFANA_PASS="admin"

echo "📊 Création du dashboard Grafana pour Yukpo..."

# Attendre que Grafana soit prêt
for i in {1..10}; do
    if curl -s -f -u "$GRAFANA_USER:$GRAFANA_PASS" "$GRAFANA_URL/api/health" > /dev/null 2>&1; then
        break
    fi
    sleep 1
done

# Dashboard JSON pour Yukpo
DASHBOARD_JSON='{
  "dashboard": {
    "title": "Yukpo Backend - Monitoring",
    "tags": ["yukpo", "backend", "production"],
    "timezone": "browser",
    "schemaVersion": 16,
    "version": 0,
    "refresh": "30s",
    "panels": [
      {
        "id": 1,
        "title": "Backend Status",
        "type": "stat",
        "gridPos": {"h": 4, "w": 6, "x": 0, "y": 0},
        "targets": [
          {
            "expr": "up{job=\"yukpo-backend\"}",
            "refId": "A"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "color": {"mode": "thresholds"},
            "thresholds": {
              "mode": "absolute",
              "steps": [
                {"value": 0, "color": "red"},
                {"value": 1, "color": "green"}
              ]
            },
            "mappings": [
              {"type": "value", "options": {"0": {"text": "DOWN"}, "1": {"text": "UP"}}}
            ]
          }
        }
      },
      {
        "id": 2,
        "title": "Video Jobs Queued",
        "type": "graph",
        "gridPos": {"h": 8, "w": 12, "x": 6, "y": 0},
        "targets": [
          {
            "expr": "video_jobs_queued{job=\"yukpo-backend\"}",
            "refId": "A",
            "legendFormat": "Jobs en file"
          }
        ],
        "yaxes": [
          {"format": "short", "label": "Jobs"},
          {"format": "short"}
        ]
      },
      {
        "id": 3,
        "title": "Video Generation Duration (avg)",
        "type": "graph",
        "gridPos": {"h": 8, "w": 12, "x": 0, "y": 8},
        "targets": [
          {
            "expr": "video_generation_duration_ms_avg{job=\"yukpo-backend\"}",
            "refId": "A",
            "legendFormat": "Durée moyenne (ms)"
          }
        ],
        "yaxes": [
          {"format": "ms", "label": "Temps"},
          {"format": "short"}
        ]
      },
      {
        "id": 4,
        "title": "Pipeline Status",
        "type": "stat",
        "gridPos": {"h": 4, "w": 6, "x": 12, "y": 8},
        "targets": [
          {
            "expr": "pipeline_status{job=\"yukpo-backend\"}",
            "refId": "A"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "color": {"mode": "thresholds"},
            "thresholds": {
              "mode": "absolute",
              "steps": [
                {"value": 0, "color": "green", "text": "OK"},
                {"value": 1, "color": "yellow", "text": "DEGRADED"},
                {"value": 2, "color": "red", "text": "CRITICAL"}
              ]
            }
          }
        }
      },
      {
        "id": 5,
        "title": "Delivery Matching Success",
        "type": "graph",
        "gridPos": {"h": 8, "w": 12, "x": 0, "y": 16},
        "targets": [
          {
            "expr": "rate(delivery_matching_success_total{job=\"yukpo-backend\"}[5m])",
            "refId": "A",
            "legendFormat": "Matching réussi/sec"
          },
          {
            "expr": "rate(delivery_matching_failed_total{job=\"yukpo-backend\"}[5m])",
            "refId": "B",
            "legendFormat": "Matching échoué/sec"
          }
        ],
        "yaxes": [
          {"format": "ops", "label": "Taux"},
          {"format": "short"}
        ]
      },
      {
        "id": 6,
        "title": "WebSocket Connections",
        "type": "graph",
        "gridPos": {"h": 8, "w": 12, "x": 12, "y": 16},
        "targets": [
          {
            "expr": "delivery_ws_connections_current{job=\"yukpo-backend\"}",
            "refId": "A",
            "legendFormat": "Connexions actives"
          }
        ],
        "yaxes": [
          {"format": "short", "label": "Connexions"},
          {"format": "short"}
        ]
      },
      {
        "id": 7,
        "title": "HTTP Requests Rate",
        "type": "graph",
        "gridPos": {"h": 8, "w": 12, "x": 0, "y": 24},
        "targets": [
          {
            "expr": "rate(http_requests_total{job=\"yukpo-backend\"}[5m])",
            "refId": "A",
            "legendFormat": "{{method}} {{status}}"
          }
        ],
        "yaxes": [
          {"format": "ops", "label": "Requêtes/sec"},
          {"format": "short"}
        ]
      },
      {
        "id": 8,
        "title": "HTTP Request Duration (p95)",
        "type": "graph",
        "gridPos": {"h": 8, "w": 12, "x": 12, "y": 24},
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{job=\"yukpo-backend\"}[5m]))",
            "refId": "A",
            "legendFormat": "p95"
          },
          {
            "expr": "histogram_quantile(0.99, rate(http_request_duration_seconds_bucket{job=\"yukpo-backend\"}[5m]))",
            "refId": "B",
            "legendFormat": "p99"
          }
        ],
        "yaxes": [
          {"format": "s", "label": "Temps"},
          {"format": "short"}
        ]
      }
    ],
    "time": {
      "from": "now-1h",
      "to": "now"
    },
    "timepicker": {
      "refresh_intervals": ["10s", "30s", "1m", "5m", "15m", "30m", "1h", "2h", "1d"]
    }
  },
  "overwrite": false
}'

# Créer le dashboard
echo "📋 Création du dashboard..."
RESPONSE=$(curl -s -X POST \
    -u "$GRAFANA_USER:$GRAFANA_PASS" \
    -H "Content-Type: application/json" \
    -d "$DASHBOARD_JSON" \
    "$GRAFANA_URL/api/dashboards/db")

# Vérifier la réponse
if echo "$RESPONSE" | grep -q "\"status\":\"success\""; then
    DASHBOARD_URL=$(echo "$RESPONSE" | grep -o '"url":"[^"]*' | cut -d'"' -f4)
    DASHBOARD_ID=$(echo "$RESPONSE" | grep -o '"id":[0-9]*' | cut -d: -f2)
    echo "✅ Dashboard créé avec succès!"
    echo ""
    echo "📊 Dashboard ID: $DASHBOARD_ID"
    echo "🔗 URL: ${GRAFANA_URL}${DASHBOARD_URL}"
    echo ""
    echo "💡 Panels créés:"
    echo "   - Backend Status (UP/DOWN)"
    echo "   - Video Jobs Queued"
    echo "   - Video Generation Duration (avg)"
    echo "   - Pipeline Status"
    echo "   - Delivery Matching Success/Failed"
    echo "   - WebSocket Connections"
    echo "   - HTTP Requests Rate"
    echo "   - HTTP Request Duration (p95/p99)"
else
    echo "❌ Erreur lors de la création du dashboard"
    echo "$RESPONSE" | head -20
    exit 1
fi

echo ""
echo "✅ Configuration terminée!"

