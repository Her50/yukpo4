# 📊 Statut Déploiement Hetzner - Métriques

## ✅ Ce qui a été fait

1. **Fichiers copiés avec succès** :
   - ✅ `alertmanager.yml` → `/opt/yukpo/backend/monitoring/`
   - ✅ `prometheus.yml` → `/opt/yukpo/backend/monitoring/`
   - ✅ `prometheus_alerts.yml` → `/opt/yukpo/backend/monitoring/`
   - ✅ Dashboards Grafana → `/opt/yukpo/backend/monitoring/grafana/`

2. **Variable d'environnement configurée** :
   - ✅ `SLACK_WEBHOOK_URL` ajoutée dans `/opt/yukpo/backend/.env`

3. **Conteneurs existants** :
   - ✅ `yukpo-prometheus-1` : UP (port 9090)
   - ✅ `yukpo-grafana-1` : UP (port 3002)
   - ❌ `yukpo-alertmanager` : N'existe pas encore

## ❌ Problèmes identifiés

1. **Docker Compose v1** : Version ancienne avec bug `ssl_version`
   - Solution : Utiliser `docker compose` (v2) ou `docker` directement

2. **Noms de conteneurs** : Les conteneurs existants ont des noms différents
   - `yukpo-prometheus-1` au lieu de `prometheus`
   - `yukpo-grafana-1` au lieu de `grafana`

3. **AlertManager** : N'a pas été créé car docker-compose a échoué

## 🔧 Actions à faire maintenant

### Option 1 : Utiliser Docker directement (plus simple)

```bash
ssh root@46.224.14.85

# 1. Démarrer AlertManager
cd /opt/yukpo/backend
source .env
docker run -d \
  --name yukpo-alertmanager \
  --network yukpo_monitoring-network \
  -p 9093:9093 \
  -v $(pwd)/monitoring/alertmanager.yml:/etc/alertmanager/alertmanager.yml:ro \
  -e SLACK_WEBHOOK_URL=$SLACK_WEBHOOK_URL \
  prom/alertmanager:latest \
  --config.file=/etc/alertmanager/alertmanager.yml \
  --storage.path=/alertmanager

# 2. Redémarrer Prometheus pour charger les nouvelles règles
docker restart yukpo-prometheus-1

# 3. Redémarrer Grafana pour charger les dashboards
docker restart yukpo-grafana-1
```

### Option 2 : Créer un réseau Docker et relier les conteneurs

```bash
ssh root@46.224.14.85

# Créer le réseau si nécessaire
docker network create monitoring-network 2>/dev/null || true

# Relier les conteneurs existants au réseau
docker network connect monitoring-network yukpo-prometheus-1 2>/dev/null || true
docker network connect monitoring-network yukpo-grafana-1 2>/dev/null || true

# Démarrer AlertManager
cd /opt/yukpo/backend
source .env
docker run -d \
  --name yukpo-alertmanager \
  --network monitoring-network \
  -p 9093:9093 \
  -v $(pwd)/monitoring/alertmanager.yml:/etc/alertmanager/alertmanager.yml:ro \
  -e SLACK_WEBHOOK_URL=$SLACK_WEBHOOK_URL \
  prom/alertmanager:latest \
  --config.file=/etc/alertmanager/alertmanager.yml \
  --storage.path=/alertmanager
```

## 📋 Vérifications après déploiement

1. **Prometheus** : http://46.224.14.85:9090
   - Vérifier `/targets` → `yukpo-backend` doit être UP
   - Vérifier `/alerts` → Les règles d'alertes doivent être chargées

2. **AlertManager** : http://46.224.14.85:9093
   - Vérifier la configuration Slack

3. **Grafana** : http://46.224.14.85:3002
   - Login: admin/admin
   - Vérifier le dashboard "Métriques UX"

---

**Prochaine étape** : Exécuter les commandes ci-dessus pour finaliser le déploiement


