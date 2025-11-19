# 📊 Status Déploiement Hetzner - Prometheus/Grafana

## ✅ Configuration Complétée

### 1. **prometheus.yml** ✅
- Configuré pour scraper le backend Render
- URL: `https://yukpomnang.onrender.com/metrics`
- Scheme: `https`

### 2. **Backend Render** ✅
- Endpoint `/metrics` accessible et fonctionnel
- Métriques exposées correctement

### 3. **Déploiement Hetzner** ⏳
- Fichiers poussés sur Git
- Serveur Hetzner doit faire `git pull` pour récupérer la config

## 📋 Commandes de Vérification

```bash
# 1. Se connecter à Hetzner
ssh root@46.224.14.85

# 2. Aller dans le répertoire
cd /opt/yukpo

# 3. Mettre à jour (si pas fait)
git pull

# 4. Vérifier prometheus.yml
cat prometheus.yml | grep yukpomnang

# 5. Lancer Prometheus et Grafana
docker compose up -d prometheus grafana

# 6. Vérifier l'état
docker compose ps prometheus grafana

# 7. Voir les logs
docker compose logs prometheus | tail -20

# 8. Tester Prometheus
curl http://localhost:9090/api/v1/targets

# 9. Accéder à Grafana
# http://46.224.14.85:3002
# Login: admin / admin
```

## ⚠️ Si Prometheus ne démarre pas

Vérifier que le fichier existe bien :
```bash
cd /opt/yukpo
ls -la prometheus.yml
cat prometheus.yml
```

## ✅ Checklist

- [x] prometheus.yml configuré pour Render
- [x] Code poussé sur Git
- [ ] Serveur Hetzner: `git pull` exécuté
- [ ] Prometheus démarré et fonctionnel
- [ ] Grafana démarré et accessible
- [ ] Scrape du backend Render actif
- [ ] Dashboards Grafana configurés

## 🎯 Prochaines Étapes

1. **Sur Hetzner** : Exécuter `git pull` pour récupérer la nouvelle config
2. **Relancer** : `docker compose up -d prometheus grafana`
3. **Vérifier** : `curl http://localhost:9090/api/v1/targets` doit montrer le backend
4. **Configurer Grafana** : Ajouter la source de données Prometheus et créer les dashboards

## 📊 URLs d'Accès

- **Prometheus UI**: http://46.224.14.85:9090
- **Grafana UI**: http://46.224.14.85:3002 (admin/admin)
- **Backend Metrics**: https://yukpomnang.onrender.com/metrics

