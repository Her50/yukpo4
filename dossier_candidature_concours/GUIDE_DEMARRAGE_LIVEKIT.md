# Guide Démarrage Serveur LiveKit 🚀

## Date
2025-11-28

---

## 📋 INFORMATIONS SERVEUR

**IP :** `46.224.14.85`  
**Port :** `7880`  
**API Key :** `APIPHE9xDv5RPaP`  
**API Secret :** `qVRL18gIk8W3Dp8V4Wu23I99t0XbZ5pM66D9i5MTTkE`

---

## 🐳 MÉTHODE 1 : Docker (Recommandé)

### Installation Docker

```bash
# Vérifier si Docker est installé
docker --version

# Si non installé, installer Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
```

### Démarrage LiveKit avec Docker

```bash
# Créer un fichier de configuration
cat > livekit.yaml << EOF
port: 7880
rtc:
  tcp_port: 7881
  port_range_start: 50000
  port_range_end: 60000
  use_external_ip: true
keys:
  APIPHE9xDv5RPaP: qVRL18gIk8W3Dp8V4Wu23I99t0XbZ5pM66D9i5MTTkE
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
EOF

# Démarrer LiveKit avec Docker
docker run -d \
  --name livekit-server \
  -p 7880:7880 \
  -p 7881:7881 \
  -p 50000-60000:50000-60000/udp \
  -v $(pwd)/livekit.yaml:/etc/livekit.yaml \
  livekit/livekit-server:latest \
  --config /etc/livekit.yaml \
  --dev
```

### Vérification

```bash
# Vérifier que le conteneur est démarré
docker ps | grep livekit

# Vérifier les logs
docker logs livekit-server

# Tester la connexion
curl -v http://46.224.14.85:7880/
```

---

## 📦 MÉTHODE 2 : Installation Native

### Téléchargement et Installation

```bash
# Télécharger LiveKit Server
curl -sSL https://github.com/livekit/livekit/releases/latest/download/livekit-server_linux_amd64.tar.gz | tar -xz

# Ou utiliser wget
wget https://github.com/livekit/livekit/releases/latest/download/livekit-server_linux_amd64.tar.gz
tar -xzf livekit-server_linux_amd64.tar.gz

# Rendre exécutable
chmod +x livekit-server
```

### Configuration

```bash
# Créer le fichier de configuration
cat > livekit.yaml << EOF
port: 7880
rtc:
  tcp_port: 7881
  port_range_start: 50000
  port_range_end: 60000
  use_external_ip: true
keys:
  APIPHE9xDv5RPaP: qVRL18gIk8W3Dp8V4Wu23I99t0XbZ5pM66D9i5MTTkE
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
EOF
```

### Démarrage

```bash
# Démarrer LiveKit
./livekit-server --config livekit.yaml --dev

# Ou en arrière-plan
nohup ./livekit-server --config livekit.yaml --dev > livekit.log 2>&1 &
```

---

## 🔧 MÉTHODE 3 : Systemd Service (Recommandé pour Production)

### Créer le Service Systemd

```bash
# Créer le fichier de service
sudo nano /etc/systemd/system/livekit.service
```

**Contenu du fichier :**

```ini
[Unit]
Description=LiveKit Server
After=network.target

[Service]
Type=simple
User=livekit
WorkingDirectory=/opt/livekit
ExecStart=/opt/livekit/livekit-server --config /etc/livekit/livekit.yaml
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

### Configuration et Démarrage

```bash
# Créer le répertoire de configuration
sudo mkdir -p /etc/livekit
sudo cp livekit.yaml /etc/livekit/

# Créer l'utilisateur
sudo useradd -r -s /bin/false livekit
sudo mkdir -p /opt/livekit
sudo cp livekit-server /opt/livekit/
sudo chown -R livekit:livekit /opt/livekit

# Recharger systemd
sudo systemctl daemon-reload

# Démarrer le service
sudo systemctl start livekit

# Activer au démarrage
sudo systemctl enable livekit

# Vérifier le statut
sudo systemctl status livekit
```

---

## 🔥 MÉTHODE 4 : Firewall Configuration

### Ouvrir les Ports Nécessaires

```bash
# UFW (Ubuntu/Debian)
sudo ufw allow 7880/tcp
sudo ufw allow 7881/tcp
sudo ufw allow 50000:60000/udp

# iptables
sudo iptables -A INPUT -p tcp --dport 7880 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 7881 -j ACCEPT
sudo iptables -A INPUT -p udp --dport 50000:60000 -j ACCEPT

# Sauvegarder les règles iptables
sudo iptables-save > /etc/iptables/rules.v4
```

---

## ✅ VÉRIFICATION

### Test de Connexion

```bash
# Test TCP
telnet 46.224.14.85 7880
# ou
nc -zv 46.224.14.85 7880

# Test HTTP
curl -v http://46.224.14.85:7880/

# Test API LiveKit
curl -X POST http://46.224.14.85:7880/twirp/livekit.RoomService/ListRooms \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Vérification Processus

```bash
# Vérifier si LiveKit est en cours d'exécution
ps aux | grep livekit

# Vérifier les ports ouverts
sudo netstat -tlnp | grep 7880
# ou
sudo ss -tlnp | grep 7880

# Vérifier avec Docker
docker ps | grep livekit
```

---

## 📝 CONFIGURATION COMPLÈTE

### Fichier `livekit.yaml` Complet

```yaml
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
```

---

## 🚨 DÉPANNAGE

### Problème : Port Déjà Utilisé

```bash
# Vérifier quel processus utilise le port
sudo lsof -i :7880
# ou
sudo netstat -tlnp | grep 7880

# Tuer le processus si nécessaire
sudo kill -9 <PID>
```

### Problème : Permission Refusée

```bash
# Vérifier les permissions
ls -la livekit-server

# Donner les permissions d'exécution
chmod +x livekit-server
```

### Problème : Firewall Bloquant

```bash
# Vérifier le firewall
sudo ufw status
# ou
sudo iptables -L -n

# Ouvrir les ports (voir section Firewall ci-dessus)
```

### Problème : Connexion Refusée

```bash
# Vérifier que le serveur écoute sur toutes les interfaces
# Dans livekit.yaml, utiliser:
bind_addresses:
  - "0.0.0.0"

# Vérifier les logs
docker logs livekit-server
# ou
journalctl -u livekit -f
```

---

## 📊 COMMANDES UTILES

### Gestion du Service

```bash
# Démarrer
sudo systemctl start livekit

# Arrêter
sudo systemctl stop livekit

# Redémarrer
sudo systemctl restart livekit

# Statut
sudo systemctl status livekit

# Logs
sudo journalctl -u livekit -f
```

### Gestion Docker

```bash
# Démarrer
docker start livekit-server

# Arrêter
docker stop livekit-server

# Redémarrer
docker restart livekit-server

# Logs
docker logs -f livekit-server

# Supprimer
docker rm -f livekit-server
```

---

## ✅ CHECKLIST DE DÉMARRAGE

- [ ] LiveKit installé (Docker ou binaire)
- [ ] Fichier `livekit.yaml` configuré avec les bonnes clés
- [ ] Ports ouverts dans le firewall (7880, 7881, 50000-60000/udp)
- [ ] Serveur démarré (Docker, systemd, ou manuel)
- [ ] Test de connexion réussi (`curl http://46.224.14.85:7880/`)
- [ ] Logs vérifiés (pas d'erreurs)
- [ ] Service configuré pour démarrer automatiquement (systemd)

---

## 🎯 RÉSUMÉ

### Méthode Recommandée : Docker

```bash
# 1. Créer la configuration
cat > livekit.yaml << EOF
port: 7880
keys:
  APIPHE9xDv5RPaP: qVRL18gIk8W3Dp8V4Wu23I99t0XbZ5pM66D9i5MTTkE
EOF

# 2. Démarrer avec Docker
docker run -d \
  --name livekit-server \
  -p 7880:7880 \
  -p 7881:7881 \
  -p 50000-60000:50000-60000/udp \
  -v $(pwd)/livekit.yaml:/etc/livekit.yaml \
  livekit/livekit-server:latest \
  --config /etc/livekit.yaml \
  --dev

# 3. Vérifier
docker ps | grep livekit
curl -v http://46.224.14.85:7880/
```

---

**Date de création :** 2025-11-28  
**Dernière mise à jour :** 2025-11-28

