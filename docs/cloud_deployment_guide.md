## Guide Déploiement Cloud – Pipeline Vidéo Immersive Yukpo

### 1. Prérequis & composants
- **Backend Rust (Axum + SQLx)** : expose API `/api/media/...`, `/estimate-video`, `/generate-video`.
- **Worker Remotion (Node/TypeScript)** : se trouve dans `video-renderer/`, rendu GPU optionnel.
- **Base de données** : PostgreSQL + extensions `pgvector`, `imgsmlr`. Prévoir Redis pour cache b-roll.
- **Stockage objets** : S3/MinIO pour master vidéo, assets intermédiaires.
- **Surcouche monitoring** : Prometheus/Sentry recommandés.

### 2. Variables d’environnement
Référence complète : `docs/video_pipeline_env.md`.

Checklist à appliquer :
1. Copier `backend/env_template.txt` → `.env` (backend) et renseigner les secrets.
2. Copier `backend/env_example.txt` pour les environnements prod (adapter taux de change, GPU, clés premium).
3. Exporter les variables worker (`VIDEO_RENDERER_*`) et audio (`PREMIUM_AUDIO_*`) dans vos secrets manager (Vault, AWS SM, Doppler, etc.).

### 3. Containers & images

#### Backend Rust
- Dockerfile existant (`backend/Dockerfile`). Construire avec `--build-arg ENVIRONMENT=production`.
- Healthcheck : exposer endpoint `GET /health` (si absent, utiliser `GET /api/status` ou en créer un léger).
- Ports : 8001 (configurable via `HOST`/`PORT`).
- Configurer variables requises via `.env` ou secrets manager monté.

#### Worker Remotion (GPU recommandé)
Créer une image `yukpo-remotion-worker` :
```Dockerfile
FROM nvidia/cuda:12.2.0-base-ubuntu22.04
WORKDIR /app
RUN apt-get update && apt-get install -y chromium ffmpeg wget && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build
ENV VIDEO_RENDERER_ENABLE_GPU=true \
    VIDEO_RENDERER_NODE_BIN=node \
    VIDEO_RENDERER_PROJECT_ROOT=/app
CMD ["node", "dist/cli/render-worker.js", "--help"]
```
- Ajouter `--runtime=nvidia` (Docker) ou `nvidia.com/gpu: 1` (Kubernetes).
- Monter volume `/tmp/remotion-chrome` si vous fixez `VIDEO_RENDERER_BROWSER_DOWNLOAD_DIR`.

### 4. Docker Compose (staging rapide)
```yaml
services:
  backend:
    build: ./backend
    env_file: ./backend/.env
    ports:
      - "8001:8001"
    depends_on:
      - postgres
      - redis
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8001/health"]
      interval: 30s
      timeout: 5s
      retries: 3
  remotion-worker:
    image: yukpo-remotion-worker:latest
    env_file: ./backend/.env
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: yukpomnang
      POSTGRES_USER: yukpo
      POSTGRES_PASSWORD: change_me
    volumes:
      - pgdata:/var/lib/postgresql/data
  redis:
    image: redis:7
volumes:
  pgdata:
```

### 5. Kubernetes (production)
- Utiliser secrets Kubernetes pour toutes variables sensibles.
- Exemple de Deployment backend (extrait) :
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: yukpo-backend
spec:
  replicas: 2
  template:
    spec:
      containers:
        - name: backend
          image: ghcr.io/your-org/yukpo-backend:latest
          envFrom:
            - secretRef:
                name: yukpo-backend-secrets
          ports:
            - containerPort: 8001
          readinessProbe:
            httpGet:
              path: /health
              port: 8001
            initialDelaySeconds: 5
            periodSeconds: 15
          livenessProbe:
            httpGet:
              path: /health
              port: 8001
            initialDelaySeconds: 30
            periodSeconds: 30
```
- Worker Remotion : planifier en Job/CronJob ou Deployment `replicas: 1`. Ajouter tolérance GPU.
  - Image recommandée : `video-renderer/Dockerfile` (basée `nvidia/cuda:12`). Monter un volume `/app/renders` partagé.
  - Exemple job : `docker run --gpus all -e JOB_FILE=/jobs/timeline.json -e OUTPUT_DIR=/jobs/result …`.
- Configurer Ingress/LoadBalancer (TLS) pour `/api`.

### 6. Migrations & base de données
- Utiliser `backend/src/migrations/auto_migrate.rs` ou `sqlx migrate run` au démarrage.
- Vérifier tables `token_usage_logs`, `immersive_jobs`, colonnes `tokens_balance`.
- Préparer scripts seed minimal pour tests video (services de démonstration).

### 7. Observabilité & logs
- Enregistrer logs via `RUST_LOG=info` et `LOG_FORMAT=json` (si support ajouté).
- Activer metrics Prometheus (middleware?) ou exporter via sidecar.
- Inscrire Remotion worker logs (temps rendu, warnings) dans Stackdriver/CloudWatch.
- Activer Sentry DSN (si disponible) pour pipeline IA.

### 8. Healthchecks recommandés
- Backend :
  - `GET /health` → vérifier connexion Postgres et Redis.
  - `GET /api/media/analytics/overview?days=1` (auth) pour valider SQL.
- Remotion worker :
  - Script `npm run render:sample` périodique (Cron) pour s'assurer que Chromium & GPU fonctionnent.
  - Vérifier présence `video-renderer/dist/` avant job réel (CI/CD doit exécuter `npm run build`).
- Services externes :
  - `RUNWAY_API_URL`, `PIKA_API_URL`, `PREMIUM_AUDIO_ENDPOINT` → tests ping via script `curl` + log.

### 9. Sécurité & secrets
- JWT : stocker `JWT_SECRET` dans secret manager (rotation trimestrielle).
- API Keys IA : OpenAI, Dolby, Runway → secrets chiffrés (KMS).
- Stockage (S3/MinIO) : utiliser credentials via IAM (pas en clair dans env).
- Configurer CORS (`backend/src/config/cloud_architecture.rs`) avant mise en prod.

### 10. CI/CD & automatisation
- Pipeline build (GitHub Actions, GitLab CI, etc.) :
  1. Backend : lint + tests Rust (`cargo fmt -- --check`, `cargo test`).
  2. Frontend web : `npm ci`, `npm run lint:check`, `npm run test`, `npm run build`.
  3. Mobile Expo : `npm ci`, `npm run test` (unitaires). Les jobs Detox/Maestro se lancent sur runners dédiés (AVD ou Mac).
  4. Vérifier SQLx offline (`cargo sqlx prepare` si activé).
  5. `video-renderer`: `npm ci`, `npm run build`, `docker build -f video-renderer/Dockerfile -t <registry>/yukpo/video-renderer:tag .`.
  6. Pousser image GPU vers registry.
- Déploiement :
  - Staging → smoke test (`POST /estimate-video` sur service test).
  - Production → déploiement progressive (RollingUpdate) avec rollback plan.

### 11. Vérifications post-déploiement
- Tester route `/estimate-video` → doit utiliser `CostEstimator::estimate_video_generation_cost_only`.
- Lancer une génération réelle (avec budget suffisant) → valider progression, upload final.
- Consulter dashboard analytics (VideoAnalyticsOverview) pour vérifier agrégations.
- Valider accessibilité UX mobile (contrast, voiceover) sur build Expo (tests E2E planifiés).

### 12. Documentation & maintenance
- Mettre à jour `docs/video_monitoring_checklist.md` et `docs/immersive_video_execution_plan.md` lors de tout changement d’infra.
- Tenir un journal des taux de change (USD→FCFA/EUR) et planifier leur mise à jour automatique (cron backend ou script externe).
- Synchroniser avec équipe mobile : deep links, WebSocket progress, translations FR/EN.

