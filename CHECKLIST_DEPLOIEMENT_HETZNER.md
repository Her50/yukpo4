# ✅ Checklist Déploiement Hetzner - Grafana/Prometheus

## 🎯 État Actuel

- ✅ **Warnings Rust** : Corrigés (ToRadians supprimé, embedding vars utilisées)
- ✅ **Cache SQLx** : 321 fichiers (complet)
- ✅ **Build Docker** : Réussi (11m 46s)
- ✅ **Configuration Prometheus** : Prête (`backend:3001` dans Docker network)
- ✅ **Configuration Grafana** : Prête (port 3002, data source Prometheus)

## 📋 Checklist Déploiement

### Sur Windows (Local)
- [x] Corrections warnings commitées
- [x] Code pushé sur Git
- [x] Build local testé

### Sur Hetzner (46.224.14.85)

#### 1. Mise à jour du code
```bash
ssh root@46.224.14.85
cd /opt/yukpo
git pull
```

#### 2. Vérifier docker-compose.yml
- [ ] Backend configuré (port 3001)
- [ ] Prometheus configuré (port 9090, volume prometheus.yml)
- [ ] Grafana configuré (port 3002)
- [ ] Tous dans le réseau `yukpo-network`

#### 3. Vérifier prometheus.yml
- [ ] Target : `backend:3001` (correct pour Docker Compose)
- [ ] Metrics path : `/metrics`

**⚠️ IMPORTANT** : Si le backend est déployé ailleurs (Render/cloud), modifier :
```yaml
targets:
  - 'https://yukpo-backend.onrender.com'  # URL publique réelle
```

#### 4. Builder et lancer les services
```bash
cd /opt/yukpo/backend
docker build -f Dockerfile -t yukpo-backend:latest .

cd /opt/yukpo
docker-compose up -d backend prometheus grafana
```

#### 5. Vérifier que tout tourne
```bash
docker-compose ps
# Vérifier : backend (UP), prometheus (UP), grafana (UP)
```

#### 6. Tester les endpoints
```bash
# Backend health
curl http://localhost:3001/healthz

# Backend metrics
curl http://localhost:3001/metrics | head -20

# Prometheus targets (doit montrer yukpo-backend UP)
curl http://localhost:9090/api/v1/targets | grep -A 5 "yukpo-backend"

# Grafana health
curl http://localhost:3002/api/health
```

#### 7. Configurer Grafana
1. Accéder : `http://46.224.14.85:3002`
2. Login : `admin` / `admin` (⚠️ changer en prod)
3. Configuration → Data sources → Add Prometheus
   - URL : `http://prometheus:9090`
   - Save & Test
4. Créer dashboards (voir `docs/metrics_grafana_video_delivery.md`)

#### 8. Vérifier Prometheus Scrape
- [ ] Aller sur `http://46.224.14.85:9090/targets`
- [ ] Vérifier que `yukpo-backend` est **UP**
- [ ] Vérifier les métriques : `http://46.224.14.85:9090/graph?g0.expr=up`

## 🔧 Configuration Prometheus

**Si backend sur Hetzner (docker-compose) :**
```yaml
targets:
  - 'backend:3001'  # ✅ Correct - Docker network DNS
```

**Si backend sur cloud (Render/etc.) :**
```yaml
targets:
  - 'https://yukpo-backend.onrender.com'  # URL publique
scheme: https
```

## 🔐 Sécurité Production

- [ ] Changer mot de passe Grafana admin
- [ ] Configurer HTTPS (Let's Encrypt) si exposé publiquement
- [ ] Restreindre accès Prometheus (firewall ou auth)
- [ ] Configurer authentification pour `/internal/metrics/*`

## 📊 Métriques Disponibles

### Endpoints Backend
- `GET /metrics` - Toutes métriques (Prometheus format)
- `GET /internal/metrics/pipeline` - Pipeline vidéo
- `GET /internal/metrics/preview` - Preview studio
- `GET /metrics/delivery` - Métriques livraison

### Métriques Clés à Monitorer
- Vidéo : `video_jobs_queued`, `video_generation_duration_ms_avg`, `pipeline_status`
- Delivery : `delivery_matching_success_total`, `delivery_ws_connections_current`

## ✅ Tout est Prêt !

Le code est corrigé, la configuration est prête. Il reste juste à :
1. Pull sur Hetzner
2. Lancer docker-compose
3. Configurer Grafana

