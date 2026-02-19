# 🔧 Adaptations Complètes Variables pour GCP

**Date**: 2026-02-18  
**Objectif**: Documenter toutes les adaptations nécessaires pour GCP

---

## ✅ Adaptations Critiques

### 1. DATABASE_URL - Cloud SQL

**Format AWS (Render)**:
```
postgresql://yukpo_db_user:88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4@dpg-d2t7ntbuibrs73eh9tvg-a/yukpo_db
```

**Format GCP (Cloud SQL Unix socket)**:
```
postgresql://yukpo_user:PASSWORD@/yukpo_db?host=/cloudsql/yukpo-project:europe-west1:yukpo-postgres
```

**Connection Name**: `yukpo-project:europe-west1:yukpo-postgres`

---

### 2. REDIS_URL - Memorystore

**Format AWS (Upstash)**:
```
rediss://default:ASMJAAImcDIxMmNlMGQ2Y2VmODE0NWU3OTA2ZWE2NThmOTIwNWZiZnAyODk2OQ@quiet-crawdad-8969.upstash.io:6379
```

**Format GCP (Memorystore)**:
```
redis://10.128.102.19:6379/0
```

**Instance**: `yukpo-redis`  
**IP Privée**: `10.128.102.19:6379`

---

### 3. GPU - Système GCP avec Scaling Automatique

**Variables GPU GCP** (remplace GPU local):
```bash
GPU_ENABLED=true
GPU_ENDPOINT=http://yukpo-gpu-workers:8080
GPU_ZONE=europe-west1-b
GPU_INSTANCE_NAME=yukpo-gpu-worker
GCP_PROJECT_ID=yukpo-project
GPU_MONTHLY_BUDGET=100.0
GPU_SCALE_UP_THRESHOLD=70.0
GPU_SCALE_DOWN_THRESHOLD=20.0
GPU_SCALE_DOWN_COOLDOWN=300
GPU_REQUEST_TIMEOUT=60
GPU_MAX_INSTANCES=3
GPU_MIN_INSTANCES=0
GPU_AVAILABLE=false  # Pas de GPU local dans Cloud Run
```

**Note**: GCP gère automatiquement le scaling des instances GPU.

---

### 4. CDN - Cloud CDN GCP

**Format AWS (Cloudflare)**:
```
UPLOAD_BASE_URL=https://cdn.yukpomnang.com
PUBLIC_BASE_URL=https://cdn.yukpomnang.com
```

**Format GCP (Cloud CDN)**:
```
UPLOAD_BASE_URL=http://34.54.117.97
PUBLIC_BASE_URL=http://34.54.117.97
```

**IP Cloud CDN**: `34.54.117.97`

---

### 5. GCS - Cloud Storage (remplace S3)

**Variables S3 AWS**:
```bash
S3_BUCKET=yukpomnang-media-prod
S3_REGION=us-east-1
S3_ACCESS_KEY=[REDACTED]
S3_SECRET_KEY=[REDACTED]
S3_ENDPOINT=
S3_FORCE_PATH_STYLE=false
```

**Variables GCS GCP**:
```bash
S3_BUCKET=yukpo-project-yukpo-backend-media  # Nom du bucket GCS
S3_REGION=europe-west1
S3_ENDPOINT=https://storage.googleapis.com
S3_FORCE_PATH_STYLE=false
S3_ACCESS_KEY=<Service Account Email>  # ⚠️ À remplacer
S3_SECRET_KEY=<Service Account JSON Key>  # ⚠️ À remplacer
```

**Note**: `S3_ACCESS_KEY` et `S3_SECRET_KEY` doivent être remplacés par les credentials du Service Account GCS.

---

### 6. Pool DB - Réduit pour éviter saturation

**Variables critiques**:
```bash
DB_POOL_SIZE=10  # Réduit de 100 à 10
DB_POOL_MIN_SIZE=2  # Réduit de 10 à 2
DB_ACQUIRE_TIMEOUT_SECS=30  # Augmenté de 15 à 30
```

---

### 7. LAUNCH_PHASE_START_DATE - Période Gratuite

**Variable critique**:
```bash
LAUNCH_PHASE_START_DATE=2026-02-10T00:00:00Z
```

**Description**: Détermine la période de 3 mois gratuits pour les prestataires.

---

### 8. WebSocket/WebRTC - LiveKit

**Variables conservées** (serveur externe):
```bash
LIVEKIT_API_URL=http://46.224.14.85:7880
LIVEKIT_HLS_URL=http://46.224.14.85:8080/live
LIVEKIT_WS_URL=ws://46.224.14.85:7880
LIVEKIT_INGRESS_MODE=rtmp
LIVEKIT_INGRESS_NAME=prod-ingress-1
LIVEKIT_INGRESS_REGION=eu-central
LIVEKIT_INGRESS_ROOM=live-events
```

**Note**: LiveKit utilise un serveur externe. Pour GCP natif, il faudrait déployer LiveKit sur Cloud Run ou GKE.

---

## 📋 Variables d'Environnement Complètes pour GCP

### Variables Critiques (À adapter)

| Variable | Valeur AWS | Valeur GCP |
|----------|------------|------------|
| `DATABASE_URL` | Render PostgreSQL | Cloud SQL Unix socket |
| `REDIS_URL` | Upstash Redis | Memorystore `redis://10.128.102.19:6379/0` |
| `DB_POOL_SIZE` | 100 | 10 |
| `DB_POOL_MIN_SIZE` | 10 | 2 |
| `UPLOAD_BASE_URL` | `https://cdn.yukpomnang.com` | `http://34.54.117.97` |
| `PUBLIC_BASE_URL` | `https://cdn.yukpomnang.com` | `http://34.54.117.97` |
| `S3_BUCKET` | `yukpomnang-media-prod` | `yukpo-project-yukpo-backend-media` |
| `S3_REGION` | `us-east-1` | `europe-west1` |
| `S3_ENDPOINT` | (vide) | `https://storage.googleapis.com` |
| `GPU_ENABLED` | `false` | `true` |
| `GPU_ENDPOINT` | (N/A) | `http://yukpo-gpu-workers:8080` |
| `GPU_AVAILABLE` | `true` | `false` |
| `LAUNCH_PHASE_START_DATE` | (variable) | `2026-02-10T00:00:00Z` |

### Variables Spécifiques GCP

```bash
CLOUD_RUN=true
ENVIRONMENT=production
APP_ENV=production
HOST=0.0.0.0
PORT=8080
RUST_LOG=info
LOG_FORMAT=json
SQLX_OFFLINE=true
ENABLE_AUTO_MIGRATIONS=true
GCP_PROJECT_ID=yukpo-project
```

---

## 🚀 Commandes de Mise à Jour

### 1. Mettre à Jour DATABASE_URL

```bash
# Récupérer le mot de passe depuis le secret existant
DB_PASSWORD=$(gcloud secrets versions access latest --secret=database-url --project=yukpo-project | grep -oP 'postgresql://[^:]+:\K[^@]+')

# Créer/mettre à jour le secret
echo -n "postgresql://yukpo_user:${DB_PASSWORD}@/yukpo_db?host=/cloudsql/yukpo-project:europe-west1:yukpo-postgres" | \
  gcloud secrets create database-url --data-file=- --replication-policy=automatic --project=yukpo-project
```

### 2. Mettre à Jour REDIS_URL

```bash
echo -n "redis://10.128.102.19:6379/0" | \
  gcloud secrets create redis-url --data-file=- --replication-policy=automatic --project=yukpo-project
```

### 3. Mettre à Jour Cloud Run

```bash
gcloud run services update yukpo-backend \
  --region=europe-west1 \
  --project=yukpo-project \
  --update-env-vars="DB_POOL_SIZE=10,DB_POOL_MIN_SIZE=2,DB_ACQUIRE_TIMEOUT_SECS=30,LAUNCH_PHASE_START_DATE=2026-02-10T00:00:00Z,CLOUD_RUN=true,GPU_ENABLED=true,GPU_ENDPOINT=http://yukpo-gpu-workers:8080,GPU_ZONE=europe-west1-b,GPU_INSTANCE_NAME=yukpo-gpu-worker,GCP_PROJECT_ID=yukpo-project,GPU_MONTHLY_BUDGET=100.0,GPU_SCALE_UP_THRESHOLD=70.0,GPU_SCALE_DOWN_THRESHOLD=20.0,GPU_MAX_INSTANCES=3,GPU_MIN_INSTANCES=0,GPU_AVAILABLE=false,UPLOAD_BASE_URL=http://34.54.117.97,PUBLIC_BASE_URL=http://34.54.117.97,S3_BUCKET=yukpo-project-yukpo-backend-media,S3_REGION=europe-west1,S3_ENDPOINT=https://storage.googleapis.com"
```

---

## ✅ Checklist Complète

- [ ] DATABASE_URL adaptée pour Cloud SQL Unix socket
- [ ] REDIS_URL adaptée pour Memorystore
- [ ] DB_POOL_SIZE réduit à 10
- [ ] DB_POOL_MIN_SIZE réduit à 2
- [ ] GPU_ENABLED=true avec endpoint GCP
- [ ] GPU_AVAILABLE=false (pas de GPU local)
- [ ] UPLOAD_BASE_URL pointant vers Cloud CDN
- [ ] PUBLIC_BASE_URL pointant vers Cloud CDN
- [ ] S3_BUCKET adapté pour GCS
- [ ] S3_REGION adapté pour europe-west1
- [ ] S3_ENDPOINT configuré pour storage.googleapis.com
- [ ] LAUNCH_PHASE_START_DATE configurée
- [ ] Tous les secrets créés dans Secret Manager
- [ ] Cloud Run mis à jour avec toutes les variables

---

## 🔗 Ressources

- [Documentation Cloud SQL](https://cloud.google.com/sql/docs/postgres/connect-run)
- [Documentation Memorystore](https://cloud.google.com/memorystore/docs/redis)
- [Documentation Cloud CDN](https://cloud.google.com/cdn/docs)
- [Documentation Cloud Storage](https://cloud.google.com/storage/docs)


