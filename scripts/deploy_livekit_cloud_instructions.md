# Instructions : Déploiement LiveKit sur Serveur Cloud

## 🎯 Objectif

Déployer LiveKit automatiquement sur le serveur `46.224.14.85` depuis votre PC Windows.

---

## 📋 Méthode 1 : SSH (Si installé)

### Vérifier SSH
```powershell
ssh -V
```

### Si SSH est disponible
```powershell
.\scripts\deploy_livekit_cloud_auto.ps1
```

---

## 📋 Méthode 2 : WinSCP + PuTTY (Recommandé pour Windows)

### Étape 1 : Installer WinSCP et PuTTY
1. Télécharger WinSCP : https://winscp.net/
2. Installer WinSCP (inclut PuTTY)

### Étape 2 : Transférer le script
1. Ouvrir WinSCP
2. Se connecter à `46.224.14.85`
3. Transférer `scripts/deploy_livekit_cloud.sh` vers `/tmp/` sur le serveur

### Étape 3 : Exécuter via PuTTY
1. Ouvrir PuTTY
2. Se connecter à `46.224.14.85`
3. Exécuter :
   ```bash
   chmod +x /tmp/deploy_livekit_cloud.sh
   /tmp/deploy_livekit_cloud.sh
   ```

---

## 📋 Méthode 3 : PowerShell avec OpenSSH

### Installer OpenSSH Client (Windows 10/11)
```powershell
# En tant qu'administrateur
Add-WindowsCapability -Online -Name OpenSSH.Client~~~~0.0.1.0
```

### Puis exécuter
```powershell
.\scripts\deploy_livekit_cloud_auto.ps1
```

---

## 📋 Méthode 4 : Script Inline (Copier-Coller)

Si vous avez déjà accès SSH au serveur, copiez-collez ce script directement :

```bash
#!/bin/bash
set -e

# Configuration
LIVEKIT_IP="46.224.14.85"
LIVEKIT_PORT="7880"
API_KEY="APIPHE9xDv5RPaP"
API_SECRET="qVRL18gIk8W3Dp8V4Wu23I99t0XbZ5pM66D9i5MTTkE"
LIVEKIT_DIR="/opt/livekit"
LIVEKIT_CONFIG="$LIVEKIT_DIR/livekit.yaml"

# Installer Docker
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
fi

# Créer répertoire
sudo mkdir -p $LIVEKIT_DIR
sudo chown $USER:$USER $LIVEKIT_DIR

# Créer configuration
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
log_level: info
EOF

# Arrêter conteneur existant
docker stop livekit-server 2>/dev/null || true
docker rm livekit-server 2>/dev/null || true

# Ouvrir ports firewall
sudo ufw allow ${LIVEKIT_PORT}/tcp 2>/dev/null || true
sudo ufw allow 7881/tcp 2>/dev/null || true
sudo ufw allow 50000:60000/udp 2>/dev/null || true

# Démarrer LiveKit
docker run -d \
  --name livekit-server \
  --restart unless-stopped \
  -p ${LIVEKIT_PORT}:${LIVEKIT_PORT} \
  -p 7881:7881 \
  -p 50000-60000:50000-60000/udp \
  -v ${LIVEKIT_CONFIG}:/etc/livekit.yaml:ro \
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

echo "✅ LiveKit déployé sur http://${LIVEKIT_IP}:${LIVEKIT_PORT}/"
```

---

## 📋 Méthode 5 : Via Interface Web (Si disponible)

Si le serveur a une interface web (cPanel, Plesk, etc.) :
1. Utiliser le gestionnaire de fichiers
2. Transférer `scripts/deploy_livekit_cloud.sh`
3. Utiliser le terminal web pour exécuter

---

## ✅ Vérification

Après déploiement, tester :

```bash
# Depuis le serveur
curl http://localhost:7880/

# Depuis l'extérieur
curl http://46.224.14.85:7880/
```

---

## 🔧 Dépannage

### SSH non disponible
- Installer OpenSSH Client (Windows)
- Utiliser WinSCP + PuTTY
- Utiliser la méthode 4 (copier-coller)

### Erreur de connexion
- Vérifier les credentials SSH
- Vérifier que le serveur est accessible
- Vérifier le firewall

### Docker non installé
- Le script l'installera automatiquement
- Sinon : `curl -fsSL https://get.docker.com | sh`

---

**Date de création :** 2025-11-28

