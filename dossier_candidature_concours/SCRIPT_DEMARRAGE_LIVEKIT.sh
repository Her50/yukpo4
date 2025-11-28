#!/bin/bash
# Script de démarrage automatique LiveKit
# Usage: ./script_demarrage_livekit.sh

set -e

echo "🚀 Démarrage du serveur LiveKit..."

# Configuration
LIVEKIT_IP="46.224.14.85"
LIVEKIT_PORT="7880"
API_KEY="APIPHE9xDv5RPaP"
API_SECRET="qVRL18gIk8W3Dp8V4Wu23I99t0XbZ5pM66D9i5MTTkE"

# Vérifier si Docker est installé
if command -v docker &> /dev/null; then
    echo "✅ Docker détecté"
    USE_DOCKER=true
else
    echo "⚠️ Docker non détecté, utilisation de l'installation native"
    USE_DOCKER=false
fi

# Créer le fichier de configuration
echo "📝 Création du fichier de configuration..."
cat > livekit.yaml << EOF
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
  ${API_KEY}: ${API_SECRET}
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
EOF

# Ouvrir les ports dans le firewall
echo "🔥 Configuration du firewall..."
if command -v ufw &> /dev/null; then
    sudo ufw allow ${LIVEKIT_PORT}/tcp
    sudo ufw allow 7881/tcp
    sudo ufw allow 50000:60000/udp
    echo "✅ Ports ouverts avec UFW"
elif command -v firewall-cmd &> /dev/null; then
    sudo firewall-cmd --permanent --add-port=${LIVEKIT_PORT}/tcp
    sudo firewall-cmd --permanent --add-port=7881/tcp
    sudo firewall-cmd --permanent --add-port=50000-60000/udp
    sudo firewall-cmd --reload
    echo "✅ Ports ouverts avec firewalld"
else
    echo "⚠️ Aucun gestionnaire de firewall détecté, ouvrez manuellement les ports:"
    echo "   - ${LIVEKIT_PORT}/tcp"
    echo "   - 7881/tcp"
    echo "   - 50000-60000/udp"
fi

# Démarrer LiveKit
if [ "$USE_DOCKER" = true ]; then
    echo "🐳 Démarrage avec Docker..."
    
    # Arrêter le conteneur existant s'il existe
    if docker ps -a | grep -q livekit-server; then
        echo "🛑 Arrêt du conteneur existant..."
        docker stop livekit-server 2>/dev/null || true
        docker rm livekit-server 2>/dev/null || true
    fi
    
    # Démarrer le nouveau conteneur
    docker run -d \
      --name livekit-server \
      --restart unless-stopped \
      -p ${LIVEKIT_PORT}:${LIVEKIT_PORT} \
      -p 7881:7881 \
      -p 50000-60000:50000-60000/udp \
      -v $(pwd)/livekit.yaml:/etc/livekit.yaml \
      livekit/livekit-server:latest \
      --config /etc/livekit.yaml \
      --dev
    
    echo "✅ LiveKit démarré avec Docker"
    echo "📊 Vérification..."
    sleep 2
    docker ps | grep livekit-server
else
    echo "📦 Installation native..."
    
    # Télécharger LiveKit si nécessaire
    if [ ! -f "livekit-server" ]; then
        echo "⬇️ Téléchargement de LiveKit..."
        wget -q https://github.com/livekit/livekit/releases/latest/download/livekit-server_linux_amd64.tar.gz
        tar -xzf livekit-server_linux_amd64.tar.gz
        chmod +x livekit-server
    fi
    
    # Arrêter le processus existant s'il existe
    if pgrep -f livekit-server > /dev/null; then
        echo "🛑 Arrêt du processus existant..."
        pkill -f livekit-server
        sleep 2
    fi
    
    # Démarrer LiveKit
    echo "🚀 Démarrage de LiveKit..."
    nohup ./livekit-server --config livekit.yaml --dev > livekit.log 2>&1 &
    
    echo "✅ LiveKit démarré"
    echo "📊 Vérification..."
    sleep 2
    ps aux | grep livekit-server | grep -v grep
fi

# Test de connexion
echo "🔍 Test de connexion..."
sleep 3

if curl -s -o /dev/null -w "%{http_code}" http://${LIVEKIT_IP}:${LIVEKIT_PORT}/ | grep -q "200\|404\|405"; then
    echo "✅ Serveur LiveKit accessible sur http://${LIVEKIT_IP}:${LIVEKIT_PORT}/"
else
    echo "⚠️ Le serveur ne répond pas encore, vérifiez les logs:"
    if [ "$USE_DOCKER" = true ]; then
        docker logs livekit-server --tail 20
    else
        tail -20 livekit.log
    fi
fi

echo ""
echo "✅ Démarrage terminé !"
echo "📝 Commandes utiles:"
if [ "$USE_DOCKER" = true ]; then
    echo "   - Logs: docker logs -f livekit-server"
    echo "   - Arrêter: docker stop livekit-server"
    echo "   - Redémarrer: docker restart livekit-server"
else
    echo "   - Logs: tail -f livekit.log"
    echo "   - Arrêter: pkill -f livekit-server"
fi
echo "   - Test: curl -v http://${LIVEKIT_IP}:${LIVEKIT_PORT}/"

