# 🔍 Vérification Déploiement Backend - Configuration Prometheus

## 📊 Configuration Actuelle

Le fichier `prometheus.yml` est configuré pour scraper `backend:3001` (Docker Compose sur Hetzner).

## ✅ Vérification à Faire

### Option 1 : Backend sur Hetzner (Docker Compose)

Si le backend tourne sur Hetzner via `docker-compose.yml` :

```bash
ssh root@46.224.14.85
cd /opt/yukpo
docker-compose ps
# Vérifier que le service "backend" est UP
```

Si le backend est UP → La configuration `backend:3001` est **correcte** ✅

### Option 2 : Backend sur Cloud (Render/autre)

Si le backend est déployé ailleurs (ex: Render) :

1. **Identifier l'URL du backend** :
   - Render : `https://yukpo-backend.onrender.com`
   - Autre : URL publique réelle

2. **Modifier prometheus.yml** :
   ```yaml
   static_configs:
     - targets:
         - 'https://yukpo-backend.onrender.com'  # URL réelle
       scheme: https
   ```

## 🔧 Comment Vérifier

### Sur Hetzner
```bash
# 1. Vérifier si backend tourne
docker ps | grep backend

# 2. Vérifier les métriques backend (si local)
curl http://localhost:3001/metrics

# 3. Vérifier Prometheus scrape
curl http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | select(.labels.job == "yukpo-backend")'
```

### Si Backend sur Cloud
```bash
# Tester l'endpoint métriques
curl https://votre-backend.onrender.com/metrics
```

## 📝 Configuration Recommandée

**Scénario A : Tout sur Hetzner (docker-compose)**
- Backend : `backend:3001` (réseau Docker)
- Prometheus : scrape `backend:3001` ✅ **Configuration actuelle**

**Scénario B : Backend cloud + Prometheus Hetzner**
- Backend : URL publique HTTPS
- Prometheus : scrape l'URL publique
- Modifier `prometheus.yml` avec l'URL réelle

## ✅ Action Immédiate

1. Vérifier où tourne le backend en production
2. Ajuster `prometheus.yml` si nécessaire
3. Tester le scrape Prometheus

