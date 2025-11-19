#!/bin/bash
set -e

HETZNER_PATH="/opt/yukpo"
HETZNER_IP="46.224.14.85"

cd "$HETZNER_PATH"

echo "📋 Mise à jour du code..."
git pull origin master
echo "✅ Code mis à jour"
echo ""

echo "📋 Arrêt des anciens conteneurs..."
docker compose stop prometheus grafana 2>/dev/null || true
docker compose rm -f prometheus grafana 2>/dev/null || true
echo "✅ Anciens conteneurs arrêtés"
echo ""

echo "📋 Vérification de la configuration..."
if ! grep -q "yukpomnang.onrender.com" prometheus.yml; then
    echo "❌ Configuration incorrecte: prometheus.yml ne contient pas l'URL Render"
    exit 1
fi
echo "✅ Configuration OK"
echo ""

echo "📋 Démarrage de Prometheus et Grafana..."
docker compose up -d prometheus grafana
echo "✅ Services démarrés"
echo ""

echo "📋 Attente du démarrage (15 secondes)..."
sleep 15
echo ""

echo "📋 Vérification de l'état..."
docker compose ps prometheus grafana
echo ""

echo "📋 Vérification des targets Prometheus..."
if curl -s http://localhost:9090/api/v1/targets | grep -A 10 yukpo > /dev/null; then
    echo "✅ Target Prometheus trouvé"
    curl -s http://localhost:9090/api/v1/targets | grep -A 10 yukpo
else
    echo "⚠️  Aucun target trouvé (peut prendre quelques secondes)"
fi
echo ""

echo "✅ Déploiement terminé!"
echo ""
echo "Accès:"
echo "  - Prometheus: http://$HETZNER_IP:9090"
echo "  - Grafana: http://$HETZNER_IP:3002 (admin/admin)"

