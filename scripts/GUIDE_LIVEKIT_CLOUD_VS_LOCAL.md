# Guide : LiveKit Local vs Cloud (Production)

## 🎯 Situation Actuelle

- **Backend** : Déployé sur **Render** (cloud)
- **LiveKit** : Doit être accessible depuis le cloud
- **Configuration actuelle** : LiveKit configuré pour `localhost:7880` (développement local)

---

## 🔍 Problème Identifié

Votre backend sur Render essaie de se connecter à LiveKit sur `46.224.14.85:7880`, mais :
- LiveKit n'est pas démarré sur ce serveur
- LiveKit est configuré pour tourner en local (`localhost`)

---

## 📋 Solutions

### Option 1 : LiveKit sur le Serveur 46.224.14.85 (Recommandé)

LiveKit doit être **déployé et démarré sur le serveur** `46.224.14.85`, pas en local.

#### Configuration Requise

1. **SSH sur le serveur 46.224.14.85**
2. **Installer Docker** sur le serveur Linux
3. **Démarrer LiveKit** avec la bonne configuration
4. **Ouvrir les ports** dans le firewall (7880, 7881, 50000-60000/udp)

#### Script de Déploiement Cloud

```bash
# Sur le serveur 46.224.14.85
# 1. Installer Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 2. Créer la configuration LiveKit
cat > /opt/livekit/livekit.yaml << EOF
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

# 3. Démarrer LiveKit avec Docker
docker run -d \
  --name livekit-server \
  --restart unless-stopped \
  -p 7880:7880 \
  -p 7881:7881 \
  -p 50000-60000:50000-60000/udp \
  -v /opt/livekit/livekit.yaml:/etc/livekit.yaml:ro \
  livekit/livekit-server:latest \
  --config /etc/livekit.yaml \
  --dev

# 4. Ouvrir les ports dans le firewall
sudo ufw allow 7880/tcp
sudo ufw allow 7881/tcp
sudo ufw allow 50000:60000/udp
```

#### Service Systemd pour Auto-Start

```bash
# Créer /etc/systemd/system/livekit.service
sudo nano /etc/systemd/system/livekit.service
```

**Contenu :**
```ini
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
```

**Activer :**
```bash
sudo systemctl daemon-reload
sudo systemctl enable livekit
sudo systemctl start livekit
```

---

### Option 2 : LiveKit comme Service Render (Alternative)

Si vous voulez déployer LiveKit sur Render :

1. **Créer un nouveau service Render** (Web Service)
2. **Utiliser l'image Docker** : `livekit/livekit-server:latest`
3. **Configurer les variables d'environnement**
4. **Ouvrir les ports** nécessaires

**Limitation** : Render peut avoir des limitations pour les ports UDP nécessaires à WebRTC.

---

### Option 3 : LiveKit Cloud (Service Managé)

Utiliser **LiveKit Cloud** (service managé) :
- Pas besoin de gérer le serveur
- Configuration automatique
- Scaling automatique
- Payant mais simplifie la gestion

---

## 🔧 Configuration Backend (Render)

Votre backend sur Render doit avoir ces variables d'environnement :

```bash
LIVEKIT_API_URL=http://46.224.14.85:7880
LIVEKIT_WS_URL=ws://46.224.14.85:7880
LIVEKIT_API_KEY=APIPHE9xDv5RPaP
LIVEKIT_API_SECRET=qVRL18gIk8W3Dp8V4Wu23I99t0XbZ5pM66D9i5MTTkE
```

**Vérifier sur Render :**
1. Aller sur votre service backend
2. **Environment** > Vérifier les variables `LIVEKIT_*`
3. S'assurer que `LIVEKIT_API_URL` pointe vers `http://46.224.14.85:7880`

---

## 📊 Comparaison Local vs Cloud

| Aspect | Local (Dev) | Cloud (Prod) |
|--------|-------------|--------------|
| **URL LiveKit** | `http://localhost:7880` | `http://46.224.14.85:7880` |
| **Où démarrer** | Votre PC Windows | Serveur Linux 46.224.14.85 |
| **Docker** | Docker Desktop | Docker Engine |
| **Accès** | Local uniquement | Public (IP publique) |
| **Firewall** | Pas nécessaire | Ports à ouvrir |

---

## ✅ Checklist Déploiement Cloud

- [ ] SSH accessible sur 46.224.14.85
- [ ] Docker installé sur le serveur
- [ ] Configuration LiveKit créée (`livekit.yaml`)
- [ ] Conteneur LiveKit démarré
- [ ] Ports ouverts dans le firewall (7880, 7881, 50000-60000/udp)
- [ ] Service systemd créé pour auto-start
- [ ] Variables d'environnement configurées sur Render
- [ ] Test de connexion depuis le backend Render

---

## 🧪 Test de Connexion

### Depuis le Backend Render

Le backend effectuera automatiquement un diagnostic lors du prochain démarrage.

### Test Manuel

```bash
# Depuis le serveur 46.224.14.85
curl http://localhost:7880/

# Depuis l'extérieur
curl http://46.224.14.85:7880/
```

---

## 📝 Scripts Créés

1. **`scripts/GUIDE_LIVEKIT_CLOUD_VS_LOCAL.md`** (ce fichier)
2. **`scripts/deploy_livekit_cloud.sh`** (à créer pour déploiement automatique)

---

## 🚀 Prochaines Étapes

1. **SSH sur 46.224.14.85**
2. **Installer Docker** (si pas déjà fait)
3. **Déployer LiveKit** avec la configuration correcte
4. **Vérifier** que le backend Render peut se connecter
5. **Configurer auto-start** avec systemd

---

**Résumé :** LiveKit doit être déployé sur le serveur **46.224.14.85**, pas en local. Le backend Render se connectera à cette IP publique.

