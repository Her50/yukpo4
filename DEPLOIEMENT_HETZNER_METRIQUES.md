# 🚀 Guide de Déploiement Métriques sur Hetzner

## 📋 Prérequis

- Accès SSH au serveur Hetzner (46.224.14.85)
- Docker et Docker Compose installés sur Hetzner
- Webhook Slack configuré (voir `GUIDE_CONFIGURATION_SLACK_WEBHOOKS.md`)

## 🎯 Méthode 1 : Déploiement Automatique (Recommandé)

### Étape 1 : Rendre le script exécutable

```bash
chmod +x scripts/deploy-hetzner-monitoring.sh
```

### Étape 2 : Exécuter le script

```bash
./scripts/deploy-hetzner-monitoring.sh
```

Le script va :
- ✅ Vérifier les fichiers locaux
- ✅ Se connecter à Hetzner
- ✅ Créer les répertoires nécessaires
- ✅ Copier tous les fichiers de configuration
- ✅ Configurer la variable SLACK_WEBHOOK_URL
- ✅ Redémarrer les services

## 🎯 Méthode 2 : Déploiement Manuel

### Étape 1 : Se connecter à Hetzner

```bash
ssh root@46.224.14.85
```

### Étape 2 : Créer les répertoires

```bash
cd /opt/yukpo
mkdir -p backend/monitoring/grafana/dashboards
mkdir -p backend/monitoring/grafana/datasources
```

### Étape 3 : Copier les fichiers depuis votre machine locale

**Depuis votre machine locale** (dans le répertoire du projet) :

```bash
# AlertManager
scp backend/monitoring/alertmanager.yml root@46.224.14.85:/opt/yukpo/backend/monitoring/

# Prometheus
scp backend/monitoring/prometheus.yml root@46.224.14.85:/opt/yukpo/backend/monitoring/
scp backend/monitoring/prometheus_alerts.yml root@46.224.14.85:/opt/yukpo/backend/monitoring/

# Grafana
scp -r backend/monitoring/grafana/dashboards root@46.224.14.85:/opt/yukpo/backend/monitoring/grafana/
scp -r backend/monitoring/grafana/datasources root@46.224.14.85:/opt/yukpo/backend/monitoring/grafana/

# Docker Compose (si pas déjà présent)
scp backend/docker-compose.cloud.yml root@46.224.14.85:/opt/yukpo/backend/
```

### Étape 4 : Configurer la variable d'environnement Slack

**Sur Hetzner** :

```bash
cd /opt/yukpo/backend

# Créer ou éditer le fichier .env
nano .env

# Ajouter la ligne suivante (remplacer par votre webhook Slack)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

### Étape 5 : Vérifier docker-compose.cloud.yml

Assurez-vous que le fichier `docker-compose.cloud.yml` contient bien :

```yaml
  alertmanager:
    environment:
      - SLACK_WEBHOOK_URL=${SLACK_WEBHOOK_URL:-}
    volumes:
      - ./monitoring/alertmanager.yml:/etc/alertmanager/alertmanager.yml:ro
      - ./monitoring/prometheus_alerts.yml:/etc/prometheus/alerts.yml:ro
```

### Étape 6 : Démarrer/Redémarrer les services

```bash
cd /opt/yukpo/backend

# Si les services existent déjà, les arrêter
docker-compose -f docker-compose.cloud.yml stop prometheus alertmanager grafana

# Démarrer les services
docker-compose -f docker-compose.cloud.yml up -d prometheus alertmanager grafana

# Vérifier le statut
docker ps --filter "name=prometheus\|alertmanager\|grafana"
```

## ✅ Vérifications Post-Déploiement

### 1. Vérifier Prometheus

```bash
# Accéder à Prometheus
curl http://localhost:9090/-/healthy

# Vérifier les targets
# Ouvrir dans le navigateur: http://46.224.14.85:9090/targets
# Le target "yukpo-backend" doit être "UP"
```

### 2. Vérifier AlertManager

```bash
# Accéder à AlertManager
curl http://localhost:9093/-/healthy

# Vérifier la configuration
# Ouvrir dans le navigateur: http://46.224.14.85:9093
# Vérifier que la configuration Slack est chargée
```

### 3. Vérifier Grafana

```bash
# Accéder à Grafana
curl http://localhost:3000/api/health

# Ouvrir dans le navigateur: http://46.224.14.85:3000
# Login: admin / admin
# Vérifier que le dashboard "Métriques UX" est présent
```

### 4. Vérifier les métriques

```bash
# Depuis Prometheus, rechercher une métrique
# Exemple: product_carousel_scrolls_total
# URL: http://46.224.14.85:9090/graph?g0.expr=product_carousel_scrolls_total
```

### 5. Tester une alerte

Pour tester qu'une alerte arrive dans Slack :

```bash
# Depuis Prometheus, créer une alerte de test
# Ou modifier temporairement un seuil dans prometheus_alerts.yml
# Vérifier que l'alerte arrive dans le canal Slack configuré
```

## 🔧 Dépannage

### Les conteneurs ne démarrent pas

```bash
# Vérifier les logs
docker logs prometheus
docker logs alertmanager
docker logs grafana

# Vérifier les permissions des fichiers
ls -la /opt/yukpo/backend/monitoring/

# Vérifier que les fichiers existent
ls -la /opt/yukpo/backend/monitoring/alertmanager.yml
ls -la /opt/yukpo/backend/monitoring/prometheus.yml
ls -la /opt/yukpo/backend/monitoring/prometheus_alerts.yml
```

### Prometheus ne scrape pas le backend

```bash
# Vérifier que le backend est accessible
curl https://yukpomnang.onrender.com/metrics

# Vérifier la configuration Prometheus
docker exec prometheus cat /etc/prometheus/prometheus.yml

# Vérifier les targets dans Prometheus UI
# http://46.224.14.85:9090/targets
```

### AlertManager n'envoie pas d'alertes Slack

```bash
# Vérifier la configuration
docker exec alertmanager cat /etc/alertmanager/alertmanager.yml

# Vérifier la variable d'environnement
docker exec alertmanager env | grep SLACK

# Vérifier les logs
docker logs alertmanager | grep -i slack

# Tester le webhook manuellement
curl -X POST YOUR_SLACK_WEBHOOK_URL -d '{"text":"test"}'
```

### Grafana ne charge pas les dashboards

```bash
# Vérifier que les fichiers sont montés
docker exec grafana ls -la /etc/grafana/provisioning/dashboards/
docker exec grafana ls -la /etc/grafana/provisioning/datasources/

# Vérifier les logs
docker logs grafana | grep -i dashboard

# Redémarrer Grafana
docker-compose -f docker-compose.cloud.yml restart grafana
```

## 📊 Structure des Fichiers sur Hetzner

```
/opt/yukpo/
├── backend/
│   ├── docker-compose.cloud.yml
│   ├── .env (contient SLACK_WEBHOOK_URL)
│   └── monitoring/
│       ├── alertmanager.yml
│       ├── prometheus.yml
│       ├── prometheus_alerts.yml
│       └── grafana/
│           ├── dashboards/
│           │   └── ux-metrics.json
│           └── datasources/
│               └── prometheus.yml
```

## 🔄 Mise à Jour

Pour mettre à jour la configuration :

```bash
# Méthode automatique
./scripts/deploy-hetzner-monitoring.sh

# Méthode manuelle
# 1. Copier les nouveaux fichiers (comme à l'étape 3)
# 2. Redémarrer les services:
cd /opt/yukpo/backend
docker-compose -f docker-compose.cloud.yml restart prometheus alertmanager grafana
```

## 📚 Ressources

- **Guide configuration Slack** : `GUIDE_CONFIGURATION_SLACK_WEBHOOKS.md`
- **Documentation intégration** : `INTEGRATION_METRIQUES_GRAFANA_SLACK.md`
- **Récapitulatif** : `RECAP_INTEGRATION_METRIQUES_COMPLETE.md`

---

**Document créé le** : 2025-01-17  
**Dernière mise à jour** : 2025-01-17  
**Auteur** : Équipe Technique Yukpomnang


