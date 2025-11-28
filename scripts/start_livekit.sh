#!/bin/bash
# Script de démarrage automatique LiveKit avec Docker
# Usage: ./scripts/start_livekit.sh

set -e

echo "🚀 Démarrage automatique du serveur LiveKit..."

# Configuration depuis les variables d'environnement ou valeurs par défaut
LIVEKIT_IP="${LIVEKIT_IP:-46.224.14.85}"
LIVEKIT_PORT="${LIVEKIT_PORT:-7880}"
LIVEKIT_API_KEY="${LIVEKIT_API_KEY:-APIPHE9xDv5RPaP}"
LIVEKIT_API_SECRET="${LIVEKIT_API_SECRET:-qVRL18gIk8W3Dp8V4Wu23I99t0XbZ5pM66D9i5MTTkE}"

# Répertoire de travail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CONFIG_DIR="$PROJECT_ROOT/config"
LIVEKIT_CONFIG="$CONFIG_DIR/livekit.yaml"

# Créer le répertoire config s'il n'existe pas
mkdir -p "$CONFIG_DIR"

# Créer le fichier de configuration
echo "📝 Création du fichier de configuration..."
cat > "$LIVEKIT_CONFIG" << EOF
port: ${LIVEKIT_PORT}
bind_addresses:
  - "0.0.0.0"
rtc:
  tcp_port: 7881
  port_range_start: 50000
  port_range_end: 60000
  use_external_ip: true
  stun_servers:
    - stun:stun.l.google.com:19302
keys:
  ${LIVEKIT_API_KEY}: ${LIVEKIT_API_SECRET}
redis:
  address: ""
  username: ""
  password: ""
turn:
  enabled: true
  domain: ""
  tls_port: 5349
  udp_port: 3478
  external_tls: false
  external_udp: false
  relay_port_range_start: 50000
  relay_port_range_end: 60000
log_level: info
development: true
EOF

echo "✅ Configuration créée: $LIVEKIT_CONFIG"

# Vérifier si Docker est installé
if ! command -v docker &> /dev/null; then
    echo "❌ Docker n'est pas installé. Installation..."
    curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
    sudo sh /tmp/get-docker.sh
    sudo usermod -aG docker $USER
    echo "✅ Docker installé. Vous devrez peut-être vous reconnecter pour utiliser Docker sans sudo."
fi

# Arrêter le conteneur existant s'il existe
if docker ps -a | grep -q livekit-server; then
    echo "🛑 Arrêt du conteneur existant..."
    docker stop livekit-server 2>/dev/null || true
    docker rm livekit-server 2>/dev/null || true
fi

# Ouvrir les ports dans le firewall (si UFW est disponible)
if command -v ufw &> /dev/null; then
    echo "🔥 Configuration du firewall (UFW)..."
    sudo ufw allow ${LIVEKIT_PORT}/tcp 2>/dev/null || true
    sudo ufw allow 7881/tcp 2>/dev/null || true
    sudo ufw allow 50000:60000/udp 2>/dev/null || true
    echo "✅ Ports configurés dans UFW"
fi

# Démarrer LiveKit avec Docker
echo "🐳 Démarrage de LiveKit avec Docker..."
docker run -d \
  --name livekit-server \
  --restart unless-stopped \
  -p ${LIVEKIT_PORT}:${LIVEKIT_PORT} \
  -p 7881:7881 \
  -p 50000-60000:50000-60000/udp \
  -v "$LIVEKIT_CONFIG:/etc/livekit.yaml:ro" \
  livekit/livekit-server:latest \
  --config /etc/livekit.yaml \
  --dev

echo "✅ Conteneur LiveKit démarré"

# Attendre que le serveur démarre
echo "⏳ Attente du démarrage du serveur (5 secondes)..."
sleep 5

# Vérifier le statut
echo "📊 Vérification du statut..."
if docker ps | grep -q livekit-server; then
    echo "✅ Conteneur LiveKit en cours d'exécution"
    docker ps | grep livekit-server
else
    echo "❌ Le conteneur n'est pas en cours d'exécution. Vérifiez les logs:"
    docker logs livekit-server
    exit 1
fi

# Test de connexion
echo "🔍 Test de connexion..."
sleep 2

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://${LIVEKIT_IP}:${LIVEKIT_PORT}/ || echo "000")

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "404" ] || [ "$HTTP_CODE" = "405" ]; then
    echo "✅ Serveur LiveKit accessible sur http://${LIVEKIT_IP}:${LIVEKIT_PORT}/"
    echo "✅ Le backend détectera automatiquement le serveur lors du prochain diagnostic"
else
    echo "⚠️ Le serveur ne répond pas encore (code: $HTTP_CODE)"
    echo "📋 Vérifiez les logs:"
    docker logs livekit-server --tail 20
    echo ""
    echo "💡 Le serveur peut prendre quelques secondes supplémentaires pour démarrer complètement"
fi

echo ""
echo "✅ Démarrage terminé !"
echo ""
echo "📝 Commandes utiles:"
echo "   - Logs: docker logs -f livekit-server"
echo "   - Arrêter: docker stop livekit-server"
echo "   - Redémarrer: docker restart livekit-server"
echo "   - Statut: docker ps | grep livekit"
echo "   - Test: curl -v http://${LIVEKIT_IP}:${LIVEKIT_PORT}/"
echo ""
echo "🔍 Le backend effectuera automatiquement un diagnostic dans les prochaines minutes"

