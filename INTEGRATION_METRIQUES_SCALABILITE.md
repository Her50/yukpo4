# ✅ Intégration des Métriques de Scalabilité dans les Dashboards Existants

## 📊 Dashboards Existants

### 1. Dashboard Principal : "Yukpo Backend - Monitoring"
- **ID**: `bf4hhhohxp62ob`
- **URL**: http://46.224.14.85:3002/d/bf4hhhohxp62ob/yukpo-backend-monitoring
- **Documentation**: `DASHBOARD_GRAFANA_YUKPO.md`

### 2. Dashboard UX : "Métriques UX - Yukpomnang"
- **Fichier**: `backend/monitoring/grafana/dashboards/ux-metrics.json`
- **Focus**: Métriques UX (scrolls, recherches, etc.)

## ✅ Nouveaux Panels de Scalabilité

Les nouveaux panels de scalabilité ont été créés dans :
- **Fichier**: `backend/monitoring/grafana/dashboards/video-scalability-panels.json`

### Panels à Ajouter au Dashboard Principal

1. **Video Queue Length** (ID: 100)
   - Métrique: `video_queue_length{job="yukpo-backend"}`
   - Alerte: > 10,000 pendant 5min

2. **Jobs Processed Rate** (ID: 101)
   - Métrique: `rate(video_jobs_processed_total{job="yukpo-backend"}[5m])`

3. **Job Duration (p95)** (ID: 102)
   - Métrique: `histogram_quantile(0.95, rate(video_job_duration_seconds_bucket{job="yukpo-backend"}[5m]))`

4. **Error Rate** (ID: 103)
   - Métrique: `rate(video_jobs_failed_total[5m]) / rate(video_jobs_processed_total[5m])`
   - Alerte: > 1% pendant 5min

5. **Active Workers** (ID: 104)
   - Métrique: `video_active_workers{job="yukpo-backend"}`

6. **Cache Hit Rate** (ID: 105)
   - Métrique: `rate(video_cache_hits[5m]) / (rate(video_cache_hits[5m]) + rate(video_cache_misses[5m]))`

## 🔧 Comment Ajouter les Panels

### Option 1 : Via l'Interface Grafana

1. Se connecter à Grafana: http://46.224.14.85:3002
2. Ouvrir le dashboard "Yukpo Backend - Monitoring"
3. Cliquer sur "Add panel" → "Add visualization"
4. Pour chaque panel :
   - Copier la requête PromQL depuis `video-scalability-panels.json`
   - Configurer le type de visualisation
   - Positionner le panel
   - Sauvegarder

### Option 2 : Via l'API Grafana

```bash
# 1. Exporter le dashboard actuel
curl -u admin:admin \
  http://46.224.14.85:3002/api/dashboards/uid/bf4hhhohxp62ob > dashboard-current.json

# 2. Fusionner les nouveaux panels
# (Utiliser un script Python ou Node.js pour fusionner les JSON)

# 3. Importer le dashboard mis à jour
curl -X POST \
  -u admin:admin \
  -H "Content-Type: application/json" \
  -d @dashboard-updated.json \
  http://46.224.14.85:3002/api/dashboards/db
```

## 📝 Métriques Disponibles

### Métriques Existantes (déjà dans le dashboard)
- `video_jobs_queued{job="yukpo-backend"}`
- `video_jobs_running{job="yukpo-backend"}`
- `video_jobs_completed_last_24h{job="yukpo-backend"}`
- `video_generation_duration_ms_avg{job="yukpo-backend"}`
- `pipeline_status{job="yukpo-backend"}`

### Nouvelles Métriques de Scalabilité (à exposer)
- `video_queue_length` - Longueur de la queue
- `video_jobs_processed_total` - Total de jobs traités
- `video_jobs_failed_total` - Total de jobs échoués
- `video_job_duration_seconds` - Durée des jobs (histogram)
- `video_active_workers` - Workers actifs
- `video_cache_hits` - Cache hits
- `video_cache_misses` - Cache misses

## ✅ Checklist d'Intégration

- [x] Panels créés dans `video-scalability-panels.json`
- [ ] Métriques exposées par `prometheus_metrics.rs`
- [ ] Panels ajoutés au dashboard principal via Grafana UI
- [ ] Alertes configurées
- [ ] Documentation mise à jour

## 📚 Références

- Dashboard principal: `DASHBOARD_GRAFANA_YUKPO.md`
- Métriques vidéo: `docs/metrics_grafana_video_delivery.md`
- Configuration Prometheus: `backend/monitoring/prometheus.yml`
- Alertes: `backend/monitoring/prometheus_alerts.yml`

