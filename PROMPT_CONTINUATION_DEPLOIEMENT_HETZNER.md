# 🚀 PROMPT COMPLET : Continuation Déploiement Hetzner - Prometheus/Grafana

## 📋 CONTEXTE DU PROJET

**Projet**: Yukpomnang  
**Backend**: Rust/Axum déployé sur **Render (cloud)**  
**Monitoring**: Prometheus + Grafana sur **Hetzner**  
**État actuel**: Configuration terminée, déploiement en cours

---

## 🔐 INFORMATIONS D'ACCÈS

### Serveur Hetzner
```
Host: 46.224.14.85
User: root
Mot de passe: [À fournir par l'utilisateur]
Port SSH: 22 (défaut)
```

### Backend Render (Cloud)
```
URL: https://yukpomnang.onrender.com
Health: https://yukpomnang.onrender.com/healthz
Metrics: https://yukpomnang.onrender.com/metrics
```

### Prometheus (Hetzner)
```
URL: http://46.224.14.85:9090
API: http://46.224.14.85:9090/api/v1/targets
Port interne: 9090
```

### Grafana (Hetzner)
```
URL: http://46.224.14.85:3002
Login: admin
Mot de passe: admin (⚠️ À changer en production)
Port interne: 3000 (exposé sur 3002)
```

### Base de données PostgreSQL (Render)
```
DATABASE_URL: postgresql://yukpo_db_user:88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4@dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com/yukpo_db
```

### Slack - Intégration Alertes (Déjà intégré dans le code)

**⚠️ IMPORTANT**: Le backend est déjà configuré pour envoyer des alertes Slack via webhooks.

**Variables d'environnement à configurer sur Render**:
```bash
# Alertes pipeline vidéo
PIPELINE_ALERT_WEBHOOK=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# Alertes SLA delivery
SLA_ALERT_WEBHOOK=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# Configuration SLA monitor (optionnel)
SLA_MONITOR_INTERVAL_SECONDS=300  # Par défaut: 5 minutes
SLA_MONITOR_LOOKBACK_MINUTES=30   # Par défaut: 30 minutes
```

**Fonctionnalités intégrées**:
- ✅ **Pipeline Health Worker** (`pipeline_health_worker.rs`): Envoie des alertes Slack automatiquement quand le pipeline vidéo change de statut (ok → degraded → critical) ou quand des jobs stale/échecs apparaissent
- ✅ **Delivery SLA Monitor** (`delivery_sla_monitor.rs`): Envoie des alertes Slack pour les livraisons en retard (SLA non respecté)

**Comment créer un webhook Slack**:
1. Aller sur https://api.slack.com/apps
2. Créer une nouvelle app pour votre workspace
3. Activer "Incoming Webhooks"
4. Créer un webhook pour le canal d'alertes (ex: `#yukpo-alerts`)
5. Copier l'URL du webhook (format: `https://hooks.slack.com/services/...`)
6. Ajouter comme variable d'environnement sur Render

**Connexions supplémentaires utiles**:
- **MongoDB** (historique interactions): Variable `MONGODB_URL` si utilisé
- **Redis** (cache): Variable `REDIS_URL` si utilisé
- **AWS S3/Wasabi** (stockage vidéos): Variables `AWS_*` ou `WASABI_*`
- **Expo Push Notifications**: Pour notifications mobile (déjà configuré)

---

## 📁 STRUCTURE DU PROJET SUR HETZNER

```
/opt/yukpo/
├── backend/               # Code Rust backend
├── frontend/              # Code React frontend
├── docker-compose.yml     # Configuration Docker Compose
├── prometheus.yml         # Configuration Prometheus (✅ déjà configuré pour Render)
├── nginx/                 # Configuration Nginx
└── config/                # Fichiers de configuration
```

**Répertoire de travail**: `/opt/yukpo`

---

## 🔑 CONFIGURATION SSH SANS MOT DE PASSE

**📚 Guide complet disponible**: Voir `GUIDE_SSH_SANS_MOT_DE_PASSE.md` pour les instructions détaillées.

### Méthode rapide

```powershell
# 1. Générer une clé SSH
ssh-keygen -t ed25519 -C "yukpo-hetzner" -f $HOME\.ssh\id_ed25519_hetzner

# 2. Afficher la clé publique (à copier)
cat $HOME\.ssh\id_ed25519_hetzner.pub

# 3. Se connecter à Hetzner et ajouter la clé
ssh root@46.224.14.85
mkdir -p ~/.ssh && chmod 700 ~/.ssh
echo "[COLLER LA CLÉ PUBLIQUE]" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
exit

# 4. Créer alias SSH (optionnel mais recommandé)
notepad $HOME\.ssh\config
# Ajouter:
# Host hetzner-yukpo
#     HostName 46.224.14.85
#     User root
#     IdentityFile ~/.ssh/id_ed25519_hetzner
#     StrictHostKeyChecking no

# 5. Tester
ssh hetzner-yukpo  # Maintenant sans mot de passe !
```

**Pour plus de détails et dépannage**: Consulter `GUIDE_SSH_SANS_MOT_DE_PASSE.md`

---

## ✅ COMMANDES À EXÉCUTER SUR HETZNER

### 1. Connexion au serveur

```bash
ssh root@46.224.14.85
# Entrer le mot de passe quand demandé
```

### 2. Vérifier le répertoire et mettre à jour le code

```bash
cd /opt/yukpo

# Vérifier que nous sommes au bon endroit
pwd
# Doit afficher: /opt/yukpo

# Mettre à jour le code depuis Git
git pull origin master

# Vérifier que prometheus.yml est bien à jour
cat prometheus.yml | grep -A 5 "yukpomnang.onrender.com"
# Doit afficher:
#     - 'yukpomnang.onrender.com'  # ✅ URL Render backend en production
```

### 3. Vérifier Docker et Docker Compose

```bash
# Vérifier Docker
docker --version

# Vérifier Docker Compose (v2)
docker compose version

# Si docker-compose v1 seulement, utiliser:
# docker-compose --version
```

### 4. Arrêter les anciens conteneurs (si existants)

```bash
cd /opt/yukpo

# Voir les conteneurs en cours
docker compose ps

# Arrêter Prometheus et Grafana (si déjà lancés)
docker compose stop prometheus grafana

# Supprimer les anciens conteneurs (optionnel, pour repartir proprement)
docker compose rm -f prometheus grafana
```

### 5. Vérifier la configuration prometheus.yml

```bash
cd /opt/yukpo

# Afficher le contenu complet
cat prometheus.yml

# Doit contenir:
# - scheme: https
# - targets: ['yukpomnang.onrender.com']
# - metrics_path: /metrics

# Vérifier que le fichier existe et est lisible
ls -la prometheus.yml
# Doit montrer: -rw-r--r-- ... prometheus.yml
```

### 6. Tester la connexion au backend Render

```bash
# Tester que le backend Render expose /metrics
curl -k https://yukpomnang.onrender.com/metrics | head -20

# Doit retourner des métriques au format Prometheus:
# # HELP video_jobs_queued Jobs en file d'attente
# # TYPE video_jobs_queued gauge
# video_jobs_queued 0
# ...
```

### 7. Lancer Prometheus et Grafana

```bash
cd /opt/yukpo

# Lancer uniquement Prometheus et Grafana
docker compose up -d prometheus grafana

# Vérifier qu'ils démarrent
docker compose ps prometheus grafana

# Doit afficher:
# NAME                    STATUS
# yukpo-prometheus-1      Up
# yukpo-grafana-1         Up
```

### 8. Vérifier les logs de démarrage

```bash
cd /opt/yukpo

# Logs Prometheus
docker compose logs prometheus | tail -30

# Doit montrer:
# level=info msg="Starting Prometheus" ...
# level=info msg="Completed loading of configuration file" ...

# Logs Grafana
docker compose logs grafana | tail -20

# Doit montrer:
# logger=settings msg="Config loaded from" ...
# logger=http.server msg="HTTP Server Listen" address=0.0.0.0:3000
```

### 9. Vérifier que Prometheus scrape le backend

```bash
# Attendre 10-15 secondes pour que Prometheus fasse un premier scrape
sleep 15

# Vérifier les targets via l'API Prometheus
curl -s http://localhost:9090/api/v1/targets | python3 -m json.tool | grep -A 15 "yukpo-backend"

# OU sans python (plus simple):
curl -s http://localhost:9090/api/v1/targets | grep -A 10 "yukpo-backend"

# Doit montrer:
# "health": "up"
# "labels": { "instance": "yukpo-backend-render", ... }
```

### 10. Vérifier dans l'interface Prometheus

```bash
# Accéder via navigateur (depuis votre machine):
# http://46.224.14.85:9090

# Dans Prometheus UI:
# 1. Aller dans Status → Targets
# 2. Vérifier que "yukpo-backend" est UP (fond vert)
# 3. Aller dans Graph et tester: up{job="yukpo-backend"}
```

### 11. Configurer Grafana

#### Via navigateur (depuis votre machine)
```
URL: http://46.224.14.85:3002
Login: admin
Mot de passe: admin
```

#### Configuration de la source de données Prometheus

1. **Se connecter à Grafana** (première fois, changement de mot de passe peut être demandé - cliquer "Skip")

2. **Ajouter Data Source Prometheus**:
   - Menu gauche: Configuration (⚙️) → Data sources
   - Cliquer "Add data source"
   - Sélectionner "Prometheus"

3. **Configuration Prometheus**:
   ```
   Name: Prometheus (ou Prometheus-Yukpo)
   URL: http://prometheus:9090
   Access: Server (default)
   ```
   - Cliquer "Save & Test"
   - Doit afficher: "Data source is working" ✅

#### Créer un dashboard de base

1. **Créer un dashboard**:
   - Menu gauche: Dashboards → New Dashboard
   - Cliquer "Add visualization"
   - Sélectionner la source "Prometheus"

2. **Requête de test**:
   ```
   Query: up{job="yukpo-backend"}
   ```
   - Doit afficher: `1` (si le scrape fonctionne)

3. **Autres métriques à tester**:
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

---

## 🔍 VÉRIFICATIONS ET DÉPANNAGE

### Vérifier que Prometheus fonctionne

```bash
# Sur Hetzner
curl http://localhost:9090/api/v1/status/config

# Vérifier les targets
curl http://localhost:9090/api/v1/targets | grep -i "health\|up\|down"

# Si problème: voir les logs
docker compose logs prometheus | grep -i error
```

### Vérifier que Grafana fonctionne

```bash
# Sur Hetzner
curl http://localhost:3002/api/health

# Doit retourner: {"database":"ok","version":"..."}

# Si problème: voir les logs
docker compose logs grafana | grep -i error
```

### Problèmes courants

#### 1. Prometheus ne peut pas scraper le backend Render

**Symptôme**: Target "down" dans Prometheus UI

**Solutions**:
```bash
# Vérifier manuellement que /metrics est accessible
curl -k https://yukpomnang.onrender.com/metrics | head -5

# Vérifier les logs Prometheus pour les erreurs
docker compose logs prometheus | grep -i "yukpo\|error\|failed"

# Vérifier la config prometheus.yml
docker compose exec prometheus cat /etc/prometheus/prometheus.yml
```

#### 2. Prometheus ne démarre pas

**Symptôme**: Container "Exited" ou erreur "no configuration file provided"

**Solutions**:
```bash
# Vérifier que prometheus.yml existe
ls -la /opt/yukpo/prometheus.yml

# Vérifier que le volume est bien monté
docker compose exec prometheus ls -la /etc/prometheus/

# Vérifier la syntaxe YAML
cat prometheus.yml | grep -v "^#" | grep -v "^$" # Voir sans commentaires
```

#### 3. Grafana ne peut pas se connecter à Prometheus

**Symptôme**: "Data source is not working" dans Grafana

**Solutions**:
```bash
# Vérifier que Prometheus est accessible depuis Grafana
docker compose exec grafana wget -O- http://prometheus:9090/api/v1/status/config

# Vérifier que les deux sont sur le même réseau Docker
docker network inspect yukpo_yukpo-network | grep -A 5 "prometheus\|grafana"
```

---

## 📊 CE QUI RESTE À FAIRE POUR COMPLÉTER LES MÉTRIQUES

### ✅ Déjà fait
- [x] Configuration prometheus.yml pour Render
- [x] Backend Render expose /metrics
- [x] Docker Compose configuré pour Prometheus/Grafana
- [x] Ports exposés (9090 Prometheus, 3002 Grafana)

### ⏳ À compléter

#### 1. Vérifier que tous les endpoints métriques sont accessibles

```bash
# Depuis Hetzner ou votre machine locale
curl -k https://yukpomnang.onrender.com/metrics
curl -k https://yukpomnang.onrender.com/internal/metrics/pipeline
curl -k https://yukpomnang.onrender.com/internal/metrics/preview
curl -k https://yukpomnang.onrender.com/metrics/delivery
```

**Si certains endpoints ne sont pas accessibles publiquement**, deux options:
- **Option A**: Configurer l'authentification Render pour protéger ces endpoints
- **Option B**: Scraper uniquement `/metrics` (qui devrait contenir toutes les métriques)

#### 2. Configurer Prometheus pour scraper plusieurs endpoints (si nécessaire)

Si les endpoints internes doivent être scraper, modifier `prometheus.yml`:

```yaml
scrape_configs:
  # Backend principal
  - job_name: 'yukpo-backend'
    metrics_path: /metrics
    scheme: https
    static_configs:
      - targets:
          - 'yukpomnang.onrender.com'

  # Pipeline vidéo (si accessible publiquement)
  - job_name: 'yukpo-pipeline'
    metrics_path: /internal/metrics/pipeline
    scheme: https
    static_configs:
      - targets:
          - 'yukpomnang.onrender.com'

  # Delivery metrics (si accessible publiquement)
  - job_name: 'yukpo-delivery'
    metrics_path: /metrics/delivery
    scheme: https
    static_configs:
      - targets:
          - 'yukpomnang.onrender.com'
```

#### 3. Créer les dashboards Grafana complets

Voir le fichier: `docs/metrics_grafana_video_delivery.md`

**Dashboards à créer**:
- **Dashboard Vidéo**: Jobs vidéo, durée génération, pipeline status, erreurs
- **Dashboard Delivery**: Matching, WebSocket connections, temps de réponse
- **Dashboard Système**: CPU, mémoire, uptime

**Métriques clés à monitorer**:

**Vidéo**:
```
video_jobs_queued
video_jobs_running
video_jobs_completed_last_24h
video_generation_duration_ms_avg
video_generation_duration_ms_p95
video_generation_duration_ms_p99
pipeline_status
pipeline_errors_total
```

**Delivery**:
```
delivery_matching_success_total
delivery_matching_failed_total
delivery_ws_connections_current
delivery_requests_total
delivery_completed_total
delivery_avg_response_time_ms
```

**Système**:
```
up{job="yukpo-backend"}
http_requests_total
http_request_duration_seconds
```

#### 4. Configurer les alertes Prometheus → Slack (optionnel mais recommandé)

**📢 IMPORTANT**: Le backend envoie déjà des alertes Slack directement via `PIPELINE_ALERT_WEBHOOK` et `SLA_ALERT_WEBHOOK`. Vous pouvez aussi configurer Prometheus pour envoyer des alertes Slack via Alertmanager.

**Option A: Utiliser les alertes Slack intégrées du backend** (Recommandé pour démarrage rapide)
- Déjà fonctionnel, juste configurer `PIPELINE_ALERT_WEBHOOK` et `SLA_ALERT_WEBHOOK` sur Render
- Alertes automatiques pour pipeline vidéo et SLA delivery

**Option B: Configurer Alertmanager pour Prometheus** (Pour alertes Grafana/Prometheus supplémentaires)

Créer un fichier `alert_rules.yml`:

```yaml
groups:
  - name: yukpo_alerts
    interval: 30s
    rules:
      - alert: BackendDown
        expr: up{job="yukpo-backend"} == 0
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Backend Render is down"

      - alert: HighVideoQueue
        expr: video_jobs_queued{job="yukpo-backend"} > 50
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "High number of queued video jobs"

      - alert: PipelineDegraded
        expr: pipeline_status{job="yukpo-backend"} > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Video pipeline is degraded or critical"
```

Puis modifier `prometheus.yml`:
```yaml
rule_files:
  - "alert_rules.yml"
```

Et monter le fichier dans docker-compose.yml:
```yaml
prometheus:
  volumes:
    - ./prometheus.yml:/etc/prometheus/prometheus.yml:ro
    - ./alert_rules.yml:/etc/prometheus/alert_rules.yml:ro
```

#### 5. Sécuriser l'accès (Production)

**Grafana**:
```bash
# Dans Grafana UI:
# Administration → Users → Change password pour admin
# Configuration → Preferences → Change password
```

**Prometheus** (si exposé publiquement):
- Configurer Nginx avec authentification basique
- Ou utiliser un VPN/tunnel SSH

**Exemple Nginx pour Prometheus** (dans `/opt/yukpo/nginx/prometheus.conf`):
```nginx
server {
    listen 9090;
    server_name 46.224.14.85;

    location / {
        auth_basic "Prometheus Access";
        auth_basic_user_file /etc/nginx/.htpasswd;
        proxy_pass http://prometheus:9090;
    }
}
```

#### 6. Configurer le reverse proxy Nginx (si nécessaire)

Si vous voulez exposer Grafana via un domaine:
```nginx
server {
    listen 80;
    server_name grafana.votre-domaine.com;

    location / {
        proxy_pass http://grafana:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## 📝 COMMANDES RAPIDES DE RÉFÉRENCE

### Sur Hetzner (à exécuter après connexion SSH)

```bash
# Se connecter
ssh root@46.224.14.85

# Aller au répertoire
cd /opt/yukpo

# Mettre à jour
git pull

# Vérifier la config
cat prometheus.yml | grep yukpomnang

# Lancer services
docker compose up -d prometheus grafana

# Vérifier l'état
docker compose ps prometheus grafana

# Voir les logs
docker compose logs -f prometheus
docker compose logs -f grafana

# Vérifier les targets Prometheus
curl http://localhost:9090/api/v1/targets | grep -A 10 yukpo

# Redémarrer si problème
docker compose restart prometheus grafana

# Arrêter
docker compose stop prometheus grafana
```

### Depuis votre machine locale

```bash
# Vérifier backend Render
curl https://yukpomnang.onrender.com/metrics | head -20

# Accéder à Prometheus
# Navigateur: http://46.224.14.85:9090

# Accéder à Grafana
# Navigateur: http://46.224.14.85:3002 (admin/admin)
```

---

## ✅ CHECKLIST FINALE

### Connexions et Accès
- [ ] SSH configuré (avec ou sans mot de passe - voir `GUIDE_SSH_SANS_MOT_DE_PASSE.md`)
- [ ] Accès au serveur Hetzner fonctionnel

### Déploiement Hetzner
- [ ] Code mis à jour sur Hetzner (`git pull`)
- [ ] prometheus.yml vérifié (contient `yukpomnang.onrender.com` avec `scheme: https`)
- [ ] Prometheus démarré et fonctionnel
- [ ] Grafana démarré et accessible
- [ ] Prometheus scrape le backend Render (target UP dans Prometheus UI)
- [ ] Grafana connecté à Prometheus (data source "Prometheus" configuré et testé)
- [ ] Dashboard de base créé dans Grafana
- [ ] Tous les endpoints métriques testés

### Alertes Slack (Intégrées dans le backend)
- [ ] Webhook Slack créé pour alertes pipeline (`PIPELINE_ALERT_WEBHOOK`)
- [ ] Webhook Slack créé pour alertes SLA delivery (`SLA_ALERT_WEBHOOK`)
- [ ] Variables d'environnement configurées sur Render
- [ ] Test d'alerte effectué (vérifier que les alertes arrivent dans Slack)
- [ ] Alertes Prometheus → Slack configurées (optionnel, via Alertmanager)

### Sécurité
- [ ] Mot de passe Grafana admin changé
- [ ] Accès Prometheus sécurisé (si exposé publiquement)
- [ ] Firewall Hetzner configuré (si nécessaire)

---

## 🎯 RÉSULTAT ATTENDU

Une fois tout configuré, vous devriez avoir:

1. **Prometheus** qui scrape automatiquement le backend Render toutes les 15 secondes
2. **Grafana** avec des dashboards montrant les métriques vidéo et delivery en temps réel
3. **Alertes** (si configurées) pour notifier en cas de problème

**Accès**:
- Prometheus: http://46.224.14.85:9090
- Grafana: http://46.224.14.85:3002

---

## 📚 RESSOURCES

- **Configuration Prometheus**: `/opt/yukpo/prometheus.yml`
- **Documentation métriques**: `/opt/yukpo/docs/metrics_grafana_video_delivery.md`
- **Docker Compose**: `/opt/yukpo/docker-compose.yml`
- **Backend Render**: https://yukpomnang.onrender.com
- **Guide SSH sans mot de passe**: `GUIDE_SSH_SANS_MOT_DE_PASSE.md`

## 📋 VARIABLES D'ENVIRONNEMENT IMPORTANTES

### Sur Render (Backend)

**Obligatoires**:
```bash
DATABASE_URL=postgresql://...
JWT_SECRET=...
```

**Monitoring & Alertes** (Recommandé):
```bash
PIPELINE_ALERT_WEBHOOK=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
SLA_ALERT_WEBHOOK=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

**Configuration SLA Monitor** (Optionnel):
```bash
SLA_MONITOR_INTERVAL_SECONDS=300  # Intervalle de vérification (défaut: 300s)
SLA_MONITOR_LOOKBACK_MINUTES=30   # Période de lookback (défaut: 30min)
```

### Sur Hetzner

Pas de variables d'environnement spécifiques nécessaires pour Prometheus/Grafana (tout dans docker-compose.yml et prometheus.yml).

---

**Ce prompt contient toutes les informations nécessaires pour continuer le déploiement dans une nouvelle session, y compris les alertes Slack intégrées.**

