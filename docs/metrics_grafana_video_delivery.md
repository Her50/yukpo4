### 1. Endpoints Prometheus exposés par Yukpo

- **Vidéo / pipeline**
  - `GET /internal/metrics/pipeline`  
    - Statut global: `pipeline_status` (0=ok,1=degraded,2=critical).  
    - Jobs vidéo: `video_jobs_queued`, `video_jobs_running`, `video_jobs_completed_last_24h`, `video_jobs_failed_last_24h`, `video_jobs_stale_total`.  
    - Analytics: `video_generated_last_days`, `video_total_views_last_days`, `video_total_shares_last_days`, `video_average_quality_score`.  
    - Latence moyenne: `video_generation_duration_ms_avg` (toutes étapes confondues).

- **Preview studio**
  - `GET /internal/metrics/preview`  
    - Exposé par `PreviewMonitoring::render_prometheus()` (sessions de preview, erreurs, latences internes).

- **Delivery**
  - `GET /metrics/delivery`  
    - Wallet & dropoff:  
      - `delivery_recipient_dropoff_events_total`  
      - `delivery_wallet_debit_events_total`, `delivery_wallet_refund_events_total`  
      - `delivery_wallet_debit_amount_cents_total`, `delivery_wallet_refund_amount_cents_total`  
    - Matching:  
      - `delivery_matching_started_total`, `delivery_matching_success_total`, `delivery_matching_failed_total`  
      - `delivery_matching_attempt_duration_ms_avg`  
      - `delivery_matching_queue_depth`  
    - WebSocket delivery:  
      - `delivery_ws_connections_current`  
      - `delivery_ws_messages_sent_total`  
      - `delivery_ws_errors_total`

- **Endpoint global**
  - `GET /metrics`  
    - Concatène: pipeline vidéo, preview studio, sous-ensemble des métriques delivery.

### 2. Exemple de configuration Prometheus (scrape config)

```yaml
scrape_configs:
  - job_name: 'yukpo-backend'
    metrics_path: /metrics
    static_configs:
      - targets:
          - 'yukpo-backend:8080'   # ou host:port réel (Docker, Kubernetes, etc.)
    relabel_configs:
      - source_labels: [__address__]
        target_label: instance
        replacement: 'yukpo-backend'
```

> **Note**: en environnement staging/prod, vous pouvez garder `/internal/metrics/*` accessibles uniquement depuis le réseau interne, et exposer `/metrics` via un reverse-proxy (NGINX, Traefik, Ingress) protégé.

### 3. Création de la data source Grafana

1. Dans Grafana, aller dans **Configuration → Data sources → Add data source**.  
2. Choisir **Prometheus**.  
3. Renseigner l’URL: par exemple `http://prometheus:9090` (ou l’URL managée, type Grafana Cloud / Render / OVH).  
4. Sauvegarder & tester.

### 4. Graphes recommandés pour la vidéo

- **Volume & file de jobs**
  - Panel 1: *Jobs en file / en cours*  
    - `video_jobs_queued` (gauge)  
    - `video_jobs_running` (gauge)
  - Panel 2: *Jobs complétés / échoués (24h)*  
    - `video_jobs_completed_last_24h`  
    - `video_jobs_failed_last_24h`

- **Latence de génération**
  - Panel 3: *Durée moyenne de génération vidéo*  
    - `video_generation_duration_ms_avg`  
    - Unité: ms → convertir en secondes dans le panel si besoin (`/ 1000`).
  - Panel 4: *Statut pipeline*  
    - `pipeline_status` (visualisation en single stat ou gauge).

- **Performance business vidéo**
  - Panel 5: *Vidéos générées (N derniers jours)*  
    - `video_generated_last_days{days="7"}`  
  - Panel 6: *Vues et partages*  
    - `video_total_views_last_days{days="7"}`  
    - `video_total_shares_last_days{days="7"}`

### 5. Graphes recommandés pour le delivery

- **Matching**
  - Panel 7: *Matching started / success / failed*  
    - `rate(delivery_matching_started_total[5m])`  
    - `rate(delivery_matching_success_total[5m])`  
    - `rate(delivery_matching_failed_total[5m])`
  - Panel 8: *Latence moyenne des tentatives de matching*  
    - `delivery_matching_attempt_duration_ms_avg`
  - Panel 9: *Profondeur de file*  
    - `delivery_matching_queue_depth`

- **WebSocket delivery**
  - Panel 10: *Connexions WS actives*  
    - `delivery_ws_connections_current`
  - Panel 11: *Messages / erreurs WS*  
    - `rate(delivery_ws_messages_sent_total[5m])`  
    - `rate(delivery_ws_errors_total[5m])`

### 6. SLO et alertes de base

- **SLO vidéo**
  - Objectif: 95 % des vidéos générées en moins de **5 minutes**.  
  - Approximé via la moyenne: `video_generation_duration_ms_avg < 300000`.  
  - Alerte PromQL:  
    ```promql
    video_generation_duration_ms_avg > 300000
    ```
    sur plus de `10m`.

- **SLO delivery – matching**
  - Objectif: latence moyenne de matching `< 60s`, queue raisonnable.  
  - Alerte latence:  
    ```promql
    delivery_matching_attempt_duration_ms_avg > 60000
    ```
  - Alerte queue:  
    ```promql
    delivery_matching_queue_depth > 50
    ```

- **SLO WebSocket**
  - Objectif: très peu d’erreurs WS par minute.  
  - Alerte:  
    ```promql
    rate(delivery_ws_errors_total[5m]) > 5
    ```

### 7. Connexion de Yukpo à Prometheus / Grafana (résumé infra)

- **Backend Yukpo**  
  - Expose déjà `/metrics`, `/internal/metrics/pipeline`, `/metrics/delivery`.  
  - Vérifier que la variable d’environnement `RUST_LOG` est réglée (ex: `info`) et que le service écoute sur un port stable (ex: 8080).

- **Prometheus**
  - Déployer Prometheus (Docker compose ou Kubernetes).  
  - Ajouter la `scrape_config` ci-dessus dans `prometheus.yml`.  
  - Démarrer Prometheus et vérifier que le job `yukpo-backend` est en **UP**.

- **Grafana**
  - Ajouter la data source Prometheus.  
  - Créer un dashboard `Yukpo – Vidéo & Delivery` avec les panels décrits ci-dessus.  
  - Configurer les alertes sur les panels critiques (latence vidéo, latence matching, erreurs WS, queue depth).


