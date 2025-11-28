# Script simplifié pour générer les commandes de déploiement
# Usage: .\scripts\deploy_livekit_cloud_simple.ps1

Write-Host "=== GENERATION COMMANDES DEPLOIEMENT LIVEKIT ===" -ForegroundColor Cyan
Write-Host ""

$SERVER_IP = "46.224.14.85"
$SERVER_USER = Read-Host "Nom d'utilisateur SSH (ex: root, ubuntu, admin)"

Write-Host ""
Write-Host "=== COMMANDES A EXECUTER ===" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Transférer le script vers le serveur:" -ForegroundColor Cyan
Write-Host ""
Write-Host "   scp scripts/deploy_livekit_cloud.sh ${SERVER_USER}@${SERVER_IP}:/tmp/" -ForegroundColor White
Write-Host ""
Write-Host "2. Se connecter au serveur:" -ForegroundColor Cyan
Write-Host ""
Write-Host "   ssh ${SERVER_USER}@${SERVER_IP}" -ForegroundColor White
Write-Host ""
Write-Host "3. Sur le serveur, exécuter:" -ForegroundColor Cyan
Write-Host ""
Write-Host "   chmod +x /tmp/deploy_livekit_cloud.sh" -ForegroundColor White
Write-Host "   /tmp/deploy_livekit_cloud.sh" -ForegroundColor White
Write-Host ""
Write-Host "=== OU COPIER-COLLER CE SCRIPT DIRECTEMENT ===" -ForegroundColor Yellow
Write-Host ""

$inlineScript = @"
#!/bin/bash
set -e

LIVEKIT_IP="46.224.14.85"
LIVEKIT_PORT="7880"
API_KEY="APIPHE9xDv5RPaP"
API_SECRET="qVRL18gIk8W3Dp8V4Wu23I99t0XbZ5pM66D9i5MTTkE"
LIVEKIT_DIR="/opt/livekit"
LIVEKIT_CONFIG="`$LIVEKIT_DIR/livekit.yaml"

echo "=== DEPLOIEMENT LIVEKIT ==="

# Installer Docker
if ! command -v docker &> /dev/null; then
    echo "Installation Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker `$USER
fi

# Créer répertoire
sudo mkdir -p `$LIVEKIT_DIR
sudo chown `$USER:`$USER `$LIVEKIT_DIR

# Créer configuration
cat > `$LIVEKIT_CONFIG << 'EOF'
port: 7880
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
  APIPHE9xDv5RPaP: qVRL18gIk8W3Dp8V4Wu23I99t0XbZ5pM66D9i5MTTkE
log_level: info
EOF

# Arrêter conteneur existant
docker stop livekit-server 2>/dev/null || true
docker rm livekit-server 2>/dev/null || true

# Ouvrir ports firewall
sudo ufw allow 7880/tcp 2>/dev/null || true
sudo ufw allow 7881/tcp 2>/dev/null || true
sudo ufw allow 50000:60000/udp 2>/dev/null || true

# Démarrer LiveKit
docker run -d \
  --name livekit-server \
  --restart unless-stopped \
  -p 7880:7880 \
  -p 7881:7881 \
  -p 50000-60000:50000-60000/udp \
  -v `$LIVEKIT_CONFIG:/etc/livekit.yaml:ro \
  livekit/livekit-server:latest \
  --config /etc/livekit.yaml

# Créer service systemd
sudo tee /etc/systemd/system/livekit.service > /dev/null << 'EOFSERVICE'
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
EOFSERVICE

sudo systemctl daemon-reload
sudo systemctl enable livekit

echo "✅ LiveKit déployé sur http://46.224.14.85:7880/"
"@

Write-Host $inlineScript -ForegroundColor White
Write-Host ""
Write-Host "=== FIN ===" -ForegroundColor Green
Write-Host ""
Write-Host "Copiez le script ci-dessus et collez-le dans votre terminal SSH" -ForegroundColor Yellow

