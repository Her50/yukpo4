#!/bin/bash
# Script de création des dashboards Grafana complets pour Yukpo

GRAFANA_URL="http://localhost:3002"
GRAFANA_USER="admin"
GRAFANA_PASS="${GRAFANA_PASSWORD:-admin}"

echo "Creation des dashboards Grafana complets pour Yukpo..."
echo ""

# Attendre que Grafana soit prêt
for i in {1..10}; do
    if curl -s -f -u "$GRAFANA_USER:$GRAFANA_PASS" "$GRAFANA_URL/api/health" > /dev/null 2>&1; then
        break
    fi
    sleep 1
done

# Dashboard Vidéo Complet
echo "Creation du dashboard Video complet..."
VIDEO_DASHBOARD='{
  "dashboard": {
    "title": "Yukpo - Dashboard Video Complet",
    "tags": ["yukpo", "video", "production"],
    "timezone": "browser",
    "refresh": "30s",
    "panels": [
      {
        "id": 1,
        "title": "Jobs Video en File",
        "type": "graph",
        "gridPos": {"h": 8, "w": 12, "x": 0, "y": 0},
        "targets": [{"expr": "video_jobs_queued{job=\"yukpo-backend\"}", "refId": "A", "legendFormat": "En file"}]
      },
      {
        "id": 2,
        "title": "Jobs Video en Cours",
        "type": "graph",
        "gridPos": {"h": 8, "w": 12, "x": 12, "y": 0},
        "targets": [{"expr": "video_jobs_running{job=\"yukpo-backend\"}", "refId": "A", "legendFormat": "En cours"}]
      },
      {
        "id": 3,
        "title": "Jobs Completes (24h)",
        "type": "stat",
        "gridPos": {"h": 4, "w": 8, "x": 0, "y": 8},
        "targets": [{"expr": "video_jobs_completed_last_24h{job=\"yukpo-backend\"}", "refId": "A"}]
      },
      {
        "id": 4,
        "title": "Pipeline Status",
        "type": "stat",
        "gridPos": {"h": 4, "w": 8, "x": 8, "y": 8},
        "targets": [{"expr": "pipeline_status{job=\"yukpo-backend\"}", "refId": "A"}],
        "fieldConfig": {
          "defaults": {
            "color": {"mode": "thresholds"},
            "thresholds": {
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
        "title": "Duree Generation (avg)",
        "type": "graph",
        "gridPos": {"h": 8, "w": 12, "x": 0, "y": 12},
        "targets": [{"expr": "video_generation_duration_ms_avg{job=\"yukpo-backend\"}", "refId": "A", "legendFormat": "Moyenne"}]
      },
      {
        "id": 6,
        "title": "Duree Generation (p95/p99)",
        "type": "graph",
        "gridPos": {"h": 8, "w": 12, "x": 12, "y": 12},
        "targets": [
          {"expr": "video_generation_duration_ms_p95{job=\"yukpo-backend\"}", "refId": "A", "legendFormat": "p95"},
          {"expr": "video_generation_duration_ms_p99{job=\"yukpo-backend\"}", "refId": "B", "legendFormat": "p99"}
        ]
      },
      {
        "id": 7,
        "title": "Erreurs Pipeline",
        "type": "graph",
        "gridPos": {"h": 8, "w": 12, "x": 0, "y": 20},
        "targets": [{"expr": "rate(pipeline_errors_total{job=\"yukpo-backend\"}[5m])", "refId": "A", "legendFormat": "Erreurs/sec"}]
      }
    ],
    "time": {"from": "now-1h", "to": "now"}
  },
  "overwrite": false
}'

curl -s -X POST \
    -u "$GRAFANA_USER:$GRAFANA_PASS" \
    -H "Content-Type: application/json" \
    -d "$VIDEO_DASHBOARD" \
    "$GRAFANA_URL/api/dashboards/db" > /dev/null

if [ $? -eq 0 ]; then
    echo "OK Dashboard Video cree"
else
    echo "ERREUR lors de la creation du dashboard Video"
fi

# Dashboard Delivery Complet
echo "Creation du dashboard Delivery complet..."
DELIVERY_DASHBOARD='{
  "dashboard": {
    "title": "Yukpo - Dashboard Delivery Complet",
    "tags": ["yukpo", "delivery", "production"],
    "timezone": "browser",
    "refresh": "30s",
    "panels": [
      {
        "id": 1,
        "title": "Matching Success Rate",
        "type": "graph",
        "gridPos": {"h": 8, "w": 12, "x": 0, "y": 0},
        "targets": [
          {"expr": "rate(delivery_matching_success_total{job=\"yukpo-backend\"}[5m])", "refId": "A", "legendFormat": "Reussi"},
          {"expr": "rate(delivery_matching_failed_total{job=\"yukpo-backend\"}[5m])", "refId": "B", "legendFormat": "Echoue"}
        ]
      },
      {
        "id": 2,
        "title": "WebSocket Connections",
        "type": "graph",
        "gridPos": {"h": 8, "w": 12, "x": 12, "y": 0},
        "targets": [{"expr": "delivery_ws_connections_current{job=\"yukpo-backend\"}", "refId": "A", "legendFormat": "Connexions"}]
      },
      {
        "id": 3,
        "title": "Temps Reponse Moyen",
        "type": "graph",
        "gridPos": {"h": 8, "w": 12, "x": 0, "y": 8},
        "targets": [{"expr": "delivery_avg_response_time_ms{job=\"yukpo-backend\"}", "refId": "A", "legendFormat": "Temps (ms)"}]
      },
      {
        "id": 4,
        "title": "Requetes Total",
        "type": "graph",
        "gridPos": {"h": 8, "w": 12, "x": 12, "y": 8},
        "targets": [
          {"expr": "rate(delivery_requests_total{job=\"yukpo-backend\"}[5m])", "refId": "A", "legendFormat": "Requetes/sec"},
          {"expr": "rate(delivery_completed_total{job=\"yukpo-backend\"}[5m])", "refId": "B", "legendFormat": "Completees/sec"}
        ]
      }
    ],
    "time": {"from": "now-1h", "to": "now"}
  },
  "overwrite": false
}'

curl -s -X POST \
    -u "$GRAFANA_USER:$GRAFANA_PASS" \
    -H "Content-Type: application/json" \
    -d "$DELIVERY_DASHBOARD" \
    "$GRAFANA_URL/api/dashboards/db" > /dev/null

if [ $? -eq 0 ]; then
    echo "OK Dashboard Delivery cree"
else
    echo "ERREUR lors de la creation du dashboard Delivery"
fi

# Dashboard Système
echo "Creation du dashboard Systeme..."
SYSTEM_DASHBOARD='{
  "dashboard": {
    "title": "Yukpo - Dashboard Systeme",
    "tags": ["yukpo", "system", "production"],
    "timezone": "browser",
    "refresh": "30s",
    "panels": [
      {
        "id": 1,
        "title": "Backend Status",
        "type": "stat",
        "gridPos": {"h": 4, "w": 6, "x": 0, "y": 0},
        "targets": [{"expr": "up{job=\"yukpo-backend\"}", "refId": "A"}],
        "fieldConfig": {
          "defaults": {
            "color": {"mode": "thresholds"},
            "thresholds": {
              "steps": [
                {"value": 0, "color": "red", "text": "DOWN"},
                {"value": 1, "color": "green", "text": "UP"}
              ]
            }
          }
        }
      },
      {
        "id": 2,
        "title": "HTTP Requests Rate",
        "type": "graph",
        "gridPos": {"h": 8, "w": 12, "x": 6, "y": 0},
        "targets": [{"expr": "rate(http_requests_total{job=\"yukpo-backend\"}[5m])", "refId": "A", "legendFormat": "{{method}} {{status}}"}]
      },
      {
        "id": 3,
        "title": "HTTP Request Duration (p95/p99)",
        "type": "graph",
        "gridPos": {"h": 8, "w": 12, "x": 0, "y": 8},
        "targets": [
          {"expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{job=\"yukpo-backend\"}[5m]))", "refId": "A", "legendFormat": "p95"},
          {"expr": "histogram_quantile(0.99, rate(http_request_duration_seconds_bucket{job=\"yukpo-backend\"}[5m]))", "refId": "B", "legendFormat": "p99"}
        ]
      }
    ],
    "time": {"from": "now-1h", "to": "now"}
  },
  "overwrite": false
}'

curl -s -X POST \
    -u "$GRAFANA_USER:$GRAFANA_PASS" \
    -H "Content-Type: application/json" \
    -d "$SYSTEM_DASHBOARD" \
    "$GRAFANA_URL/api/dashboards/db" > /dev/null

if [ $? -eq 0 ]; then
    echo "OK Dashboard Systeme cree"
else
    echo "ERREUR lors de la creation du dashboard Systeme"
fi

echo ""
echo "Creation des dashboards terminee!"
echo ""
echo "Acces Grafana: http://46.224.14.85:3002"
echo "Login: $GRAFANA_USER"

