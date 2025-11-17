# 📊 Configuration Prometheus pour Production

## 🎯 Question : Où est déployé le backend en production ?

### Option A : Backend déployé sur Hetzner (même serveur que Prometheus)

Si le backend tourne sur le même serveur Hetzner que Prometheus via Docker Compose :

```yaml
# prometheus.yml (dans Docker network)
scrape_configs:
  - job_name: 'yukpo-backend'
    metrics_path: /metrics
    static_configs:
      - targets:
          - 'backend:3001'  # ✅ Hostname Docker dans le même réseau
```

### Option B : Backend déployé ailleurs (Cloud/Render/autre serveur)

Si le backend est déployé sur un autre service (Render, autre serveur Hetzner, etc.) :

```yaml
# prometheus.yml (URL publique ou interne)
scrape_configs:
  - job_name: 'yukpo-backend'
    metrics_path: /metrics
    static_configs:
      - targets:
          - 'https://yukpo-backend.onrender.com'  # URL publique
          # OU
          - 'http://46.224.14.85:3001'  # IP publique Hetzner
          # OU
          - 'http://yukpo-backend.internal:3001'  # URL interne (si même réseau)
    scheme: https  # Si HTTPS
    tls_config:
      insecure_skip_verify: true  # Seulement si cert auto-signé
```

## 🔍 Vérification

Pour identifier où est le backend en production :

```bash
# 1. Vérifier si backend tourne sur Hetzner
ssh root@46.224.14.85
docker-compose ps

# 2. Vérifier les métriques disponibles
curl http://localhost:3001/metrics  # Si backend local
# OU
curl https://yukpo-backend.onrender.com/metrics  # Si backend cloud

# 3. Vérifier la configuration actuelle
cat /opt/yukpo/prometheus.yml
```

## ✅ Configuration Recommandée

**Si backend sur Hetzner (docker-compose) :**
- Prometheus scrape `backend:3001` (réseau Docker)
- ✅ Déjà configuré dans prometheus.yml actuel

**Si backend dans le cloud (Render/autre) :**
- Prometheus scrape l'URL publique HTTPS
- Ajuster prometheus.yml avec l'URL réelle

## 📝 À Faire

1. [ ] Identifier où est le backend en production
2. [ ] Ajuster prometheus.yml avec le bon endpoint
3. [ ] Tester : `curl http://prometheus:9090/api/v1/targets`
4. [ ] Vérifier que le job `yukpo-backend` est **UP** dans Prometheus

