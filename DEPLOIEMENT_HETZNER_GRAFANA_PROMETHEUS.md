# 🚀 Déploiement Hetzner - Grafana/Prometheus

## 📊 État Actuel

- ✅ **Backend Docker** : Build réussi (`yukpo-backend:latest`)
- ✅ **Cache SQLx** : 321 fichiers (complet)
- ⏳ **Déploiement Hetzner** : À faire
- ⏳ **Configuration Prometheus/Grafana** : À finaliser

## 🎯 Plan de Déploiement

### 1. Déployer le backend sur Hetzner

```bash
ssh root@46.224.14.85
cd /opt/yukpo/backend

# Vérifier que l'image Docker est bien présente
docker images | grep yukpo-backend

# Si nécessaire, reconstruire ou pull depuis registry
docker build -f Dockerfile -t yukpo-backend:latest .
```

### 2. Configurer docker-compose.yml sur Hetzner

Le `docker-compose.yml` doit inclure :
- ✅ Backend (port 3001)
- ✅ Prometheus (port 9090)
- ✅ Grafana (port 3002)
- ✅ Nginx reverse proxy (port 80/443)

Vérifier que le fichier `/opt/yukpo/docker-compose.yml` existe et est configuré.

### 3. Vérifier prometheus.yml

Le fichier `/opt/yukpo/prometheus.yml` doit scraper le backend :
```yaml
scrape_configs:
  - job_name: 'yukpo-backend'
    metrics_path: /metrics
    static_configs:
      - targets:
          - 'backend:3001'  # Dans le réseau Docker
```

### 4. Lancer les services

```bash
cd /opt/yukpo
docker-compose up -d
```

Vérifier les logs :
```bash
docker-compose logs -f backend prometheus grafana
```

### 5. Configurer Grafana

1. Accéder à Grafana : `http://46.224.14.85:3002`
   - User: `admin`
   - Password: `admin` (à changer en prod)

2. Ajouter Prometheus comme data source :
   - Configuration → Data sources → Add data source
   - URL: `http://prometheus:9090` (dans Docker network)
   - Save & Test

3. Créer les dashboards :
   - Vidéo pipeline (`/internal/metrics/pipeline`)
   - Delivery metrics (`/metrics/delivery`)
   - Preview studio (`/internal/metrics/preview`)

### 6. Configurer Nginx (Reverse Proxy)

Créer `/opt/yukpo/nginx/nginx.conf` pour exposer :
- Grafana : `http://46.224.14.85/grafana` → `http://grafana:3000`
- Prometheus : `http://46.224.14.85/prometheus` → `http://prometheus:9090`
- Backend API : `http://46.224.14.85/api` → `http://backend:3001`

### 7. Vérifier les métriques

```bash
# Backend metrics
curl http://localhost:3001/metrics

# Prometheus targets
curl http://localhost:9090/api/v1/targets

# Grafana health
curl http://localhost:3002/api/health
```

## 🔐 Sécurité (Production)

- [ ] Changer le mot de passe Grafana admin
- [ ] Configurer HTTPS (Let's Encrypt)
- [ ] Restreindre l'accès Prometheus (réseau interne uniquement)
- [ ] Configurer l'authentification pour `/internal/metrics/*`

## 📝 Métriques Disponibles

### Backend Endpoints

- `GET /metrics` - Toutes les métriques (Prometheus format)
- `GET /internal/metrics/pipeline` - Métriques pipeline vidéo
- `GET /internal/metrics/preview` - Métriques preview studio
- `GET /metrics/delivery` - Métriques livraison

### Métriques Clés

**Vidéo:**
- `video_jobs_queued`, `video_jobs_running`
- `video_generation_duration_ms_avg`
- `pipeline_status`

**Delivery:**
- `delivery_matching_started_total`
- `delivery_matching_success_total`
- `delivery_matching_failed_total`
- `delivery_ws_connections_current`

