# ✅ Configuration Finale Prometheus - Backend Render

## 🎯 Configuration Appliquée

Le backend est déployé sur **Render (cloud)** : `https://yukpomnang.onrender.com`

### prometheus.yml
```yaml
scrape_configs:
  - job_name: 'yukpo-backend'
    metrics_path: /metrics
    scheme: https
    static_configs:
      - targets:
          - 'yukpomnang.onrender.com'  # ✅ Backend Render en production
        labels:
          instance: 'yukpo-backend-render'
          environment: 'production'
          deployment: 'cloud'
```

## ✅ Déploiement sur Hetzner

### 1. Mettre à jour le code
```bash
ssh root@46.224.14.85
cd /opt/yukpo
git pull
```

### 2. Vérifier prometheus.yml
```bash
cat /opt/yukpo/prometheus.yml
# Doit contenir : 'yukpomnang.onrender.com' avec scheme: https
```

### 3. Lancer Prometheus/Grafana
```bash
cd /opt/yukpo
docker-compose up -d prometheus grafana
```

### 4. Vérifier le scrape
```bash
# Vérifier que Prometheus peut scraper le backend Render
curl http://localhost:9090/api/v1/targets | grep -A 10 "yukpo-backend"

# Doit montrer : "health": "up"
```

### 5. Tester l'endpoint métriques Render
```bash
# Vérifier que le backend Render expose /metrics
curl https://yukpomnang.onrender.com/metrics | head -20
```

## 📊 Configuration Grafana

1. Accéder : `http://46.224.14.85:3002`
2. Login : `admin` / `admin`
3. Data source : `http://prometheus:9090`
4. Vérifier que les métriques du backend Render apparaissent

## ⚠️ Points d'Attention

1. **HTTPS** : Le backend Render utilise HTTPS, d'où `scheme: https`
2. **Endpoints internes** : `/internal/metrics/*` ne sont peut-être pas accessibles publiquement
3. **Endpoint public** : Seul `/metrics` est probablement accessible
4. **Sécurité** : Si `/internal/metrics/*` doit être protégé, utiliser l'authentification Render

## ✅ Tout est Configuré !

- ✅ prometheus.yml mis à jour pour Render
- ✅ URL backend identifiée : `yukpomnang.onrender.com`
- ✅ Configuration HTTPS appliquée
- ⏳ Prêt pour déploiement sur Hetzner

