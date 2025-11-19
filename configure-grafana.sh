#!/bin/bash
# Script de configuration automatique de Grafana

GRAFANA_URL="http://localhost:3002"
GRAFANA_USER="admin"
GRAFANA_PASS="admin"
PROMETHEUS_URL="http://prometheus:9090"

echo "🔧 Configuration de Grafana..."

# Attendre que Grafana soit prêt
echo "⏳ Attente du démarrage de Grafana..."
for i in {1..30}; do
    if curl -s -f -u "$GRAFANA_USER:$GRAFANA_PASS" "$GRAFANA_URL/api/health" > /dev/null 2>&1; then
        echo "✅ Grafana est prêt"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ Grafana n'est pas accessible après 30 tentatives"
        exit 1
    fi
    sleep 2
done

# Créer la source de données Prometheus
echo "📊 Ajout de la source de données Prometheus..."
DS_RESPONSE=$(curl -s -X POST \
    -u "$GRAFANA_USER:$GRAFANA_PASS" \
    -H "Content-Type: application/json" \
    -d "{
        \"name\": \"Prometheus\",
        \"type\": \"prometheus\",
        \"url\": \"$PROMETHEUS_URL\",
        \"access\": \"proxy\",
        \"isDefault\": true,
        \"jsonData\": {
            \"httpMethod\": \"POST\"
        }
    }" \
    "$GRAFANA_URL/api/datasources")

# Vérifier si la source existe déjà
if echo "$DS_RESPONSE" | grep -q "already exists"; then
    echo "ℹ️  Source de données Prometheus existe déjà"
    # Mettre à jour la source existante
    DS_ID=$(curl -s -u "$GRAFANA_USER:$GRAFANA_PASS" "$GRAFANA_URL/api/datasources/name/Prometheus" | grep -o '"id":[0-9]*' | cut -d: -f2)
    if [ -n "$DS_ID" ]; then
        curl -s -X PUT \
            -u "$GRAFANA_USER:$GRAFANA_PASS" \
            -H "Content-Type: application/json" \
            -d "{
                \"name\": \"Prometheus\",
                \"type\": \"prometheus\",
                \"url\": \"$PROMETHEUS_URL\",
                \"access\": \"proxy\",
                \"isDefault\": true,
                \"jsonData\": {
                    \"httpMethod\": \"POST\"
                }
            }" \
            "$GRAFANA_URL/api/datasources/$DS_ID" > /dev/null
        echo "✅ Source de données Prometheus mise à jour"
    fi
elif echo "$DS_RESPONSE" | grep -q "\"id\""; then
    echo "✅ Source de données Prometheus créée"
else
    echo "❌ Erreur lors de la création de la source de données"
    echo "$DS_RESPONSE"
    exit 1
fi

# Tester la connexion
echo "🧪 Test de la connexion Prometheus..."
TEST_RESPONSE=$(curl -s -X POST \
    -u "$GRAFANA_USER:$GRAFANA_PASS" \
    -H "Content-Type: application/json" \
    -d "{\"datasource\":{\"type\":\"prometheus\"},\"expr\":\"up{job=\\\"yukpo-backend\\\"}\"}" \
    "$GRAFANA_URL/api/datasources/proxy/1/api/v1/query")

if echo "$TEST_RESPONSE" | grep -q "\"status\":\"success\""; then
    echo "✅ Connexion Prometheus testée avec succès"
else
    echo "⚠️  La connexion Prometheus pourrait avoir des problèmes"
    echo "$TEST_RESPONSE" | head -5
fi

echo ""
echo "✅ Configuration Grafana terminée!"
echo ""
echo "📊 Accès:"
echo "   URL: $GRAFANA_URL"
echo "   Login: $GRAFANA_USER"
echo "   Password: $GRAFANA_PASS"
echo ""
echo "💡 Prochaines étapes:"
echo "   1. Connectez-vous à Grafana"
echo "   2. Créez un dashboard: Dashboards → New Dashboard"
echo "   3. Ajoutez un panel avec la requête: up{job=\"yukpo-backend\"}"

