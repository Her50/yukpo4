#!/bin/bash
# ✅ Phase 4: Script pour ajouter les panels Grafana via API

set -e

GRAFANA_URL="${GRAFANA_URL:-http://46.224.14.85:3002}"
GRAFANA_USER="${GRAFANA_USER:-admin}"
GRAFANA_PASSWORD="${GRAFANA_PASSWORD:-admin}"
DASHBOARD_UID="${DASHBOARD_UID:-bf4hhhohxp62ob}"

echo "📊 Ajout des panels de scalabilité au dashboard Grafana"
echo "=================================================="

# ✅ Authentification
echo "🔐 Authentification..."
AUTH_RESPONSE=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -d "{\"user\":\"$GRAFANA_USER\",\"password\":\"$GRAFANA_PASSWORD\"}" \
  "$GRAFANA_URL/login")

# ✅ Récupérer le dashboard actuel
echo "📥 Récupération du dashboard actuel..."
DASHBOARD_JSON=$(curl -s -u "$GRAFANA_USER:$GRAFANA_PASSWORD" \
  "$GRAFANA_URL/api/dashboards/uid/$DASHBOARD_UID")

# ✅ Lire les nouveaux panels
NEW_PANELS=$(cat backend/monitoring/grafana/dashboards/video-scalability-panels.json | jq '.panels')

# ✅ Fusionner les panels (nécessite jq)
if command -v jq &> /dev/null; then
    echo "🔧 Fusion des panels..."
    UPDATED_DASHBOARD=$(echo "$DASHBOARD_JSON" | jq --argjson new_panels "$NEW_PANELS" \
      '.dashboard.panels += $new_panels | .dashboard.version += 1')
    
    # ✅ Mettre à jour le dashboard
    echo "📤 Mise à jour du dashboard..."
    curl -X POST \
      -u "$GRAFANA_USER:$GRAFANA_PASSWORD" \
      -H "Content-Type: application/json" \
      -d "$UPDATED_DASHBOARD" \
      "$GRAFANA_URL/api/dashboards/db"
    
    echo ""
    echo "✅ Panels ajoutés avec succès!"
    echo "📊 Dashboard: $GRAFANA_URL/d/$DASHBOARD_UID/yukpo-backend-monitoring"
else
    echo "⚠️  jq non installé - ajout manuel requis"
    echo ""
    echo "📝 Instructions manuelles:"
    echo "1. Ouvrir Grafana: $GRAFANA_URL"
    echo "2. Aller au dashboard: $DASHBOARD_UID"
    echo "3. Cliquer 'Add panel' → 'Add visualization'"
    echo "4. Pour chaque panel dans video-scalability-panels.json:"
    echo "   - Copier la requête PromQL"
    echo "   - Configurer le type de visualisation"
    echo "   - Positionner le panel"
    echo "   - Sauvegarder"
fi

