# 🚀 Instructions de Déploiement Prometheus/Grafana sur Hetzner

## ✅ État Actuel

- ✅ Configuration `prometheus.yml` vérifiée (contient l'URL Render)
- ✅ Configuration `docker-compose.yml` vérifiée
- ✅ Scripts de déploiement créés

## 📋 Prochaines Étapes

### Option 1: Déploiement Automatique (si SSH configuré)

Si vous avez configuré SSH sans mot de passe (voir `GUIDE_SSH_SANS_MOT_DE_PASSE.md`):

```powershell
# Exécuter le script de déploiement
.\deploy-hetzner-monitoring.ps1

# Répondre "o" quand demandé pour le déploiement automatique
```

### Option 2: Déploiement Manuel

#### Étape 1: Se connecter à Hetzner

```bash
ssh root@46.224.14.85
```

#### Étape 2: Aller au répertoire du projet

```bash
cd /opt/yukpo
```

#### Étape 3: Mettre à jour le code

```bash
git pull origin master
```

#### Étape 4: Vérifier la configuration Prometheus

```bash
cat prometheus.yml | grep yukpomnang
```

**Doit afficher**: `- 'yukpomnang.onrender.com'  # ✅ URL Render backend en production`

#### Étape 5: Arrêter les anciens conteneurs (si existants)

```bash
docker compose stop prometheus grafana
docker compose rm -f prometheus grafana
```

#### Étape 6: Lancer Prometheus et Grafana

```bash
docker compose up -d prometheus grafana
```

#### Étape 7: Vérifier l'état

```bash
docker compose ps prometheus grafana
```

**Doit afficher**:
```
NAME                    STATUS
yukpo-prometheus-1      Up
yukpo-grafana-1         Up
```

#### Étape 8: Voir les logs (optionnel)

```bash
# Logs Prometheus
docker compose logs -f prometheus

# Logs Grafana
docker compose logs -f grafana
```

#### Étape 9: Vérifier que Prometheus scrape le backend

Attendre 15 secondes, puis:

```bash
sleep 15
curl -s http://localhost:9090/api/v1/targets | grep -A 10 yukpo
```

**Doit afficher**:
```json
"health": "up",
"labels": {
  "instance": "yukpo-backend-render",
  "job": "yukpo-backend"
}
```

### Option 3: Utiliser le Script Bash

Depuis votre machine Windows:

```powershell
# Copier le script sur Hetzner
scp deploy-hetzner.sh root@46.224.14.85:/tmp/

# Se connecter et exécuter
ssh root@46.224.14.85 'bash /tmp/deploy-hetzner.sh'
```

## 🌐 Accès aux Interfaces

Une fois déployé:

- **Prometheus**: http://46.224.14.85:9090
- **Grafana**: http://46.224.14.85:3002
  - Login: `admin`
  - Mot de passe: `admin` (⚠️ À changer en production)

## 📊 Configuration Grafana

### 1. Ajouter la Source de Données Prometheus

1. Se connecter à Grafana (http://46.224.14.85:3002)
2. Menu gauche: **Configuration (⚙️)** → **Data sources**
3. Cliquer **Add data source**
4. Sélectionner **Prometheus**
5. Configuration:
   - **Name**: `Prometheus` (ou `Prometheus-Yukpo`)
   - **URL**: `http://prometheus:9090`
   - **Access**: `Server` (default)
6. Cliquer **Save & Test**
7. Doit afficher: **"Data source is working"** ✅

### 2. Créer un Dashboard de Base

1. Menu gauche: **Dashboards** → **New Dashboard**
2. Cliquer **Add visualization**
3. Sélectionner la source **Prometheus**
4. Requête de test:
   ```
   up{job="yukpo-backend"}
   ```
5. Doit afficher: `1` (si le scrape fonctionne)

### 3. Métriques à Tester

```
# Jobs vidéo en file d'attente
video_jobs_queued{job="yukpo-backend"}

# Durée moyenne de génération vidéo
video_generation_duration_ms_avg{job="yukpo-backend"}

# Status du pipeline
pipeline_status{job="yukpo-backend"}

# Métriques delivery
delivery_matching_success_total{job="yukpo-backend"}
```

## 🔍 Vérifications

### Vérifier Prometheus

```bash
# Sur Hetzner
curl http://localhost:9090/api/v1/status/config

# Vérifier les targets
curl http://localhost:9090/api/v1/targets | grep -i "health\|up\|down"
```

### Vérifier Grafana

```bash
# Sur Hetzner
curl http://localhost:3002/api/health

# Doit retourner: {"database":"ok","version":"..."}
```

## 🐛 Dépannage

### Prometheus ne peut pas scraper le backend

**Symptôme**: Target "down" dans Prometheus UI

**Solutions**:
```bash
# Vérifier manuellement que /metrics est accessible
curl -k https://yukpomnang.onrender.com/metrics | head -5

# Vérifier les logs Prometheus
docker compose logs prometheus | grep -i "yukpo\|error\|failed"
```

### Prometheus ne démarre pas

**Symptôme**: Container "Exited" ou erreur "no configuration file provided"

**Solutions**:
```bash
# Vérifier que prometheus.yml existe
ls -la /opt/yukpo/prometheus.yml

# Vérifier que le volume est bien monté
docker compose exec prometheus ls -la /etc/prometheus/
```

### Grafana ne peut pas se connecter à Prometheus

**Symptôme**: "Data source is not working" dans Grafana

**Solutions**:
```bash
# Vérifier que Prometheus est accessible depuis Grafana
docker compose exec grafana wget -O- http://prometheus:9090/api/v1/status/config
```

## 📝 Checklist

- [ ] Connexion SSH à Hetzner fonctionnelle
- [ ] Code mis à jour sur Hetzner (`git pull`)
- [ ] Prometheus démarré et fonctionnel
- [ ] Grafana démarré et accessible
- [ ] Prometheus scrape le backend Render (target UP)
- [ ] Grafana connecté à Prometheus (data source configuré)
- [ ] Dashboard de base créé dans Grafana
- [ ] Mot de passe Grafana admin changé (production)

## 🔐 Sécurité (Production)

### Changer le mot de passe Grafana

1. Se connecter à Grafana
2. Menu: **Administration** → **Users** → **admin**
3. Cliquer **Change password**

### Sécuriser Prometheus (si exposé publiquement)

Configurer Nginx avec authentification basique ou utiliser un VPN/tunnel SSH.

## 📚 Ressources

- **Configuration Prometheus**: `/opt/yukpo/prometheus.yml`
- **Docker Compose**: `/opt/yukpo/docker-compose.yml`
- **Backend Render**: https://yukpomnang.onrender.com
- **Guide SSH**: `GUIDE_SSH_SANS_MOT_DE_PASSE.md`
- **Prompt complet**: `PROMPT_CONTINUATION_DEPLOIEMENT_HETZNER.md`

