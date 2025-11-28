# Guide : Docker en Développement vs Production

## 🖥️ Développement Local (Windows/Mac)

### Configuration Actuelle
- **Docker Desktop** : Application graphique pour Windows/Mac
- **Démarrage manuel** : Vous devez ouvrir Docker Desktop
- **Services** : Démarrent avec `docker-compose up -d`

### ⚙️ Configuration Auto-Start

#### Option 1 : Script Automatique (Recommandé)
```powershell
.\scripts\configurer_docker_auto_start.ps1
```

Ce script configure :
- ✅ Tâche planifiée Windows (démarrage au login)
- ✅ Raccourci dans le dossier de démarrage
- ✅ Instructions pour Docker Desktop Settings

#### Option 2 : Docker Desktop Settings
1. Ouvrir **Docker Desktop**
2. Aller dans **Settings** (⚙️) > **General**
3. Cocher **"Start Docker Desktop when you log in"**
4. Cliquer sur **"Apply & Restart"**

#### Option 3 : Tâche Planifiée Windows
1. Ouvrir **Planificateur de tâches** (Task Scheduler)
2. Créer une **tâche de base**
3. Déclencheur : **À la connexion**
4. Action : **Démarrer un programme** → `C:\Program Files\Docker\Docker\Docker Desktop.exe`

### 📝 Commandes Développement

```powershell
# Démarrer tous les services
docker-compose up -d

# Voir les logs
docker-compose logs -f

# Arrêter les services
docker-compose down

# Redémarrer un service
docker-compose restart livekit
```

---

## 🚀 Production (Serveur Linux)

### Configuration Production
En production, **Docker Desktop n'existe pas**. On utilise **Docker Engine** directement sur Linux.

### Installation Docker sur Linux

```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Démarrer Docker au boot
sudo systemctl enable docker
sudo systemctl start docker
```

### Docker Compose en Production

```bash
# Installer docker-compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# OU utiliser docker compose (nouvelle version intégrée)
docker compose version
```

### Auto-Start en Production

Docker démarre **automatiquement** au boot du serveur :

```bash
# Vérifier que Docker démarre au boot
sudo systemctl is-enabled docker
# Devrait afficher: enabled

# Si non activé
sudo systemctl enable docker
```

### Services avec Docker Compose

Créer un service systemd pour démarrer automatiquement vos services :

```bash
# Créer le fichier service
sudo nano /etc/systemd/system/yukpo-services.service
```

**Contenu :**
```ini
[Unit]
Description=Yukpo Services (Docker Compose)
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/yukpomnang2
ExecStart=/usr/local/bin/docker-compose up -d
ExecStop=/usr/local/bin/docker-compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
```

**Activer le service :**
```bash
sudo systemctl daemon-reload
sudo systemctl enable yukpo-services
sudo systemctl start yukpo-services
```

### 📝 Commandes Production

```bash
# Démarrer les services
docker-compose up -d

# Voir les logs
docker-compose logs -f livekit

# Redémarrer un service
docker-compose restart livekit

# Vérifier le statut
docker-compose ps

# Mettre à jour et redémarrer
docker-compose pull
docker-compose up -d
```

---

## 🔄 Comparaison Dev vs Prod

| Aspect | Développement | Production |
|--------|---------------|------------|
| **OS** | Windows/Mac | Linux |
| **Docker** | Docker Desktop | Docker Engine |
| **Interface** | Graphique | Ligne de commande |
| **Auto-start** | Optionnel (configurable) | Automatique (systemd) |
| **Démarrage** | Manuel ou au login | Au boot du serveur |
| **Services** | `docker-compose up -d` | `docker-compose up -d` + systemd |

---

## 🎯 Recommandations

### Développement
1. ✅ **Configurer auto-start** avec le script ou Docker Desktop Settings
2. ✅ **Docker Desktop démarre automatiquement** au login
3. ✅ **Services démarrent** avec `docker-compose up -d`

### Production
1. ✅ **Docker Engine** installé sur serveur Linux
2. ✅ **Docker démarre automatiquement** au boot (systemd)
3. ✅ **Services démarrent automatiquement** avec service systemd
4. ✅ **Monitoring** avec healthchecks et logs

---

## 📋 Checklist Production

- [ ] Docker Engine installé sur serveur Linux
- [ ] Docker démarre au boot (`systemctl enable docker`)
- [ ] Docker Compose installé
- [ ] Service systemd créé pour auto-start des services
- [ ] Healthchecks configurés dans docker-compose.yml
- [ ] Logs configurés (rotation, retention)
- [ ] Monitoring configuré (Prometheus, Grafana)
- [ ] Backup configuré pour volumes Docker
- [ ] Firewall configuré (ports 7880, 7881, etc.)
- [ ] SSL/TLS configuré pour HTTPS

---

## 🔧 Scripts Disponibles

### Développement
- `scripts/configurer_docker_auto_start.ps1` - Configure auto-start Windows
- `scripts/verifier_docker_et_demarrer.ps1` - Vérifie et démarre les services
- `scripts/restart_livekit.ps1` - Redémarre LiveKit

### Production (à créer sur serveur)
- `scripts/production/install_docker.sh` - Installe Docker sur Linux
- `scripts/production/setup_services.sh` - Configure systemd services
- `scripts/production/deploy.sh` - Déploie les services

---

**Date de création :** 2025-11-28

