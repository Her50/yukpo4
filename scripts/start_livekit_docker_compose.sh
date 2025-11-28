#!/bin/bash
# Script de démarrage LiveKit avec docker-compose
# Usage: ./scripts/start_livekit_docker_compose.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CONFIG_DIR="$PROJECT_ROOT/config"
LIVEKIT_CONFIG="$CONFIG_DIR/livekit.yaml"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.livekit.yml"

# Configuration
LIVEKIT_PORT="${LIVEKIT_PORT:-7880}"
LIVEKIT_API_KEY="${LIVEKIT_API_KEY:-APIPHE9xDv5RPaP}"
LIVEKIT_API_SECRET="${LIVEKIT_API_SECRET:-qVRL18gIk8W3Dp8V4Wu23I99t0XbZ5pM66D9i5MTTkE}"

echo "🚀 Démarrage LiveKit avec docker-compose..."

# Créer le répertoire config
mkdir -p "$CONFIG_DIR"

# Créer la configuration
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

# Vérifier docker-compose
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ docker-compose n'est pas installé"
    exit 1
fi

# Utiliser docker compose (nouvelle version) ou docker-compose (ancienne)
if docker compose version &> /dev/null; then
    COMPOSE_CMD="docker compose"
else
    COMPOSE_CMD="docker-compose"
fi

# Arrêter les services existants
echo "🛑 Arrêt des services existants..."
cd "$SCRIPT_DIR"
$COMPOSE_CMD -f docker-compose.livekit.yml down 2>/dev/null || true

# Ouvrir les ports dans le firewall
if command -v ufw &> /dev/null; then
    echo "🔥 Configuration du firewall..."
    sudo ufw allow ${LIVEKIT_PORT}/tcp 2>/dev/null || true
    sudo ufw allow 7881/tcp 2>/dev/null || true
    sudo ufw allow 50000:60000/udp 2>/dev/null || true
fi

# Démarrer les services
echo "🐳 Démarrage des services..."
$COMPOSE_CMD -f docker-compose.livekit.yml up -d

# Attendre le démarrage
echo "⏳ Attente du démarrage (5 secondes)..."
sleep 5

# Vérifier le statut
echo "📊 Statut des services..."
$COMPOSE_CMD -f docker-compose.livekit.yml ps

# Test de connexion
echo "🔍 Test de connexion..."
sleep 2
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://46.224.14.85:${LIVEKIT_PORT}/ || echo "000")

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "404" ] || [ "$HTTP_CODE" = "405" ]; then
    echo "✅ Serveur LiveKit accessible !"
else
    echo "⚠️ Le serveur ne répond pas encore (code: $HTTP_CODE)"
    echo "📋 Logs:"
    $COMPOSE_CMD -f docker-compose.livekit.yml logs --tail 20
fi

echo ""
echo "✅ Démarrage terminé !"
echo "📝 Commandes utiles:"
echo "   - Logs: $COMPOSE_CMD -f docker-compose.livekit.yml logs -f"
echo "   - Arrêter: $COMPOSE_CMD -f docker-compose.livekit.yml down"
echo "   - Redémarrer: $COMPOSE_CMD -f docker-compose.livekit.yml restart"
echo "   - Statut: $COMPOSE_CMD -f docker-compose.livekit.yml ps"

