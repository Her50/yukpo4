#!/bin/bash
# Script de déploiement LiveKit sur serveur cloud (46.224.14.85)
# Usage: ./scripts/deploy_livekit_cloud.sh
# À exécuter sur le serveur 46.224.14.85

set -e

echo "=== DEPLOIEMENT LIVEKIT CLOUD ==="
echo ""

# Configuration
LIVEKIT_IP="46.224.14.85"
LIVEKIT_PORT="7880"
API_KEY="APIPHE9xDv5RPaP"
API_SECRET="qVRL18gIk8W3Dp8V4Wu23I99t0XbZ5pM66D9i5MTTkE"
LIVEKIT_DIR="/opt/livekit"
LIVEKIT_CONFIG="$LIVEKIT_DIR/livekit.yaml"

# Vérifier que nous sommes sur le bon serveur
CURRENT_IP=$(curl -s ifconfig.me || curl -s ipinfo.io/ip || echo "unknown")
echo "IP actuelle: $CURRENT_IP"
if [ "$CURRENT_IP" != "$LIVEKIT_IP" ]; then
    echo "⚠️  ATTENTION: Vous n'êtes pas sur le serveur $LIVEKIT_IP"
    echo "   IP actuelle: $CURRENT_IP"
    read -p "Continuer quand même? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# 1. Installer Docker si nécessaire
echo "1. Vérification de Docker..."
if ! command -v docker &> /dev/null; then
    echo "   Installation de Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    echo "   ✅ Docker installé"
    echo "   ⚠️  Vous devrez peut-être vous reconnecter pour utiliser Docker sans sudo"
else
    echo "   ✅ Docker déjà installé: $(docker --version)"
fi

# 2. Créer le répertoire de configuration
echo ""
echo "2. Création du répertoire de configuration..."
sudo mkdir -p $LIVEKIT_DIR
sudo chown $USER:$USER $LIVEKIT_DIR

# 3. Créer la configuration LiveKit
echo ""
echo "3. Création de la configuration LiveKit..."
cat > $LIVEKIT_CONFIG << EOF
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
development: false
EOF

echo "   ✅ Configuration créée: $LIVEKIT_CONFIG"

# 4. Arrêter le conteneur existant s'il existe
echo ""
echo "4. Arrêt du conteneur existant (si présent)..."
if docker ps -a | grep -q livekit-server; then
    docker stop livekit-server 2>/dev/null || true
    docker rm livekit-server 2>/dev/null || true
    echo "   ✅ Conteneur existant supprimé"
fi

# 5. Ouvrir les ports dans le firewall
echo ""
echo "5. Configuration du firewall..."
if command -v ufw &> /dev/null; then
    sudo ufw allow ${LIVEKIT_PORT}/tcp
    sudo ufw allow 7881/tcp
    sudo ufw allow 50000:60000/udp
    echo "   ✅ Ports ouverts avec UFW"
elif command -v firewall-cmd &> /dev/null; then
    sudo firewall-cmd --permanent --add-port=${LIVEKIT_PORT}/tcp
    sudo firewall-cmd --permanent --add-port=7881/tcp
    sudo firewall-cmd --permanent --add-port=50000-60000/udp
    sudo firewall-cmd --reload
    echo "   ✅ Ports ouverts avec firewalld"
else
    echo "   ⚠️  Aucun gestionnaire de firewall détecté"
    echo "   Ouvrez manuellement les ports: ${LIVEKIT_PORT}/tcp, 7881/tcp, 50000-60000/udp"
fi

# 6. Démarrer LiveKit avec Docker
echo ""
echo "6. Démarrage de LiveKit..."
docker run -d \
  --name livekit-server \
  --restart unless-stopped \
  -p ${LIVEKIT_PORT}:${LIVEKIT_PORT} \
  -p 7881:7881 \
  -p 50000-60000:50000-60000/udp \
  -v ${LIVEKIT_CONFIG}:/etc/livekit.yaml:ro \
  livekit/livekit-server:latest \
  --config /etc/livekit.yaml

echo "   ✅ Conteneur LiveKit démarré"

# 7. Attendre le démarrage
echo ""
echo "7. Attente du démarrage (10 secondes)..."
sleep 10

# 8. Vérifier le statut
echo ""
echo "8. Vérification du statut..."
docker ps --filter "name=livekit-server" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# 9. Test de connexion
echo ""
echo "9. Test de connexion..."
sleep 2

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:${LIVEKIT_PORT}/ || echo "000")
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "404" ] || [ "$HTTP_CODE" = "405" ]; then
    echo "   ✅ LiveKit est accessible localement (HTTP $HTTP_CODE)"
else
    echo "   ⚠️  LiveKit ne répond pas encore (code: $HTTP_CODE)"
fi

# Test depuis l'extérieur
HTTP_CODE_EXT=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://${LIVEKIT_IP}:${LIVEKIT_PORT}/ || echo "000")
if [ "$HTTP_CODE_EXT" = "200" ] || [ "$HTTP_CODE_EXT" = "404" ] || [ "$HTTP_CODE_EXT" = "405" ]; then
    echo "   ✅ LiveKit est accessible depuis l'extérieur (HTTP $HTTP_CODE_EXT)"
else
    echo "   ⚠️  LiveKit n'est pas accessible depuis l'extérieur (code: $HTTP_CODE_EXT)"
    echo "      Vérifiez le firewall et les règles de sécurité"
fi

# 10. Créer le service systemd pour auto-start
echo ""
echo "10. Création du service systemd pour auto-start..."
sudo tee /etc/systemd/system/livekit.service > /dev/null << EOF
[Unit]
Description=LiveKit Server
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/usr/bin/docker start livekit-server
ExecStop=/usr/bin/docker stop livekit-server
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable livekit
echo "   ✅ Service systemd créé et activé"

# 11. Résumé
echo ""
echo "=== DEPLOIEMENT TERMINE ==="
echo ""
echo "LiveKit est déployé sur: http://${LIVEKIT_IP}:${LIVEKIT_PORT}/"
echo ""
echo "Commandes utiles:"
echo "  - Logs: docker logs -f livekit-server"
echo "  - Arrêter: docker stop livekit-server"
echo "  - Redémarrer: docker restart livekit-server"
echo "  - Statut: docker ps --filter name=livekit-server"
echo "  - Service: sudo systemctl status livekit"
echo ""
echo "Le backend Render se connectera automatiquement à cette URL lors du prochain démarrage."

