# Pipeline Monitoring & Alerting

## Health Endpoint

- Endpoint: `GET /internal/health/pipeline`
- Fields:
  - `status`: `ok | degraded | critical`
  - `job_queue`: counts of queued/running/completed/failed jobs
  - `job_queue.stale_jobs`: jobs >30 min sans update
  - `analytics_overview`: synthèse 7 jours (peut être `null`)
  - `components`: disponibilité Remotion renderer & audio mastering

## Prometheus / Grafana

- Endpoint métrique natif: `GET /internal/metrics/pipeline` (format Prometheus).
- Exemple `curl http://backend.internal/internal/metrics/pipeline` → valeurs `pipeline_status`, `video_jobs_*`, etc.
- Pour environnement sans auth, sécuriser via réseau privé/ingress.

### Scraper Exemple (Prometheus YAML)

```
```
- Exemple complet dans `monitoring/prometheus/pipeline.yml` (à intégrer dans votre stack Prometheus).
- Variables d’environnement utiles documentées dans `backend/config/env.example` (`PIPELINE_ALERT_WEBHOOK`).
