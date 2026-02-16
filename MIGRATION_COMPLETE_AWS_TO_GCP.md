# 🔄 Migration Complète AWS → GCP - Variables d'Environnement

**Date**: 2026-02-16  
**Objectif**: Migrer toutes les variables d'environnement AWS vers GCP Cloud Run

---

## 📋 Variables Identifiées dans AWS

### 1. Secrets Manager (Sensibles)

| Variable AWS | Type | Variable GCP | Adaptation |
|--------------|------|--------------|------------|
| `DATABASE_URL` | Secret | `database-url` | ⚠️ Adapter pour Cloud SQL |
| `REDIS_URL` | Secret | `redis-url` | ⚠️ Adapter pour Cloud Memorystore |
| `JWT_SECRET` | Secret | `jwt-secret` | ✅ Direct |
| `MONGODB_URL` | Secret | `mongodb-url` | ✅ Direct |
| `ENABLE_AUTO_MIGRATIONS` | Secret | `enable-auto-migrations` | ✅ Direct |

### 2. SSM Parameter Store (Configuration)

| Variable AWS | Type | Variable GCP | Adaptation |
|--------------|------|--------------|------------|
| `S3_BUCKET` | SSM | `gcs-bucket` | ⚠️ Adapter nom bucket GCS |
| `S3_REGION` | SSM | `gcs-region` | ⚠️ Adapter région (eu-west-1 → europe-west1) |
| `S3_ACCESS_KEY` | SSM | `gcs-access-key` | ⚠️ Remplacer par Service Account JSON |
| `S3_SECRET_KEY` | SSM | `gcs-secret-key` | ⚠️ Remplacer par Service Account JSON |
| `UPLOAD_BASE_URL` | SSM | `upload-base-url` | ⚠️ Adapter URL (s3 → storage.googleapis.com) |
| `LAUNCH_PHASE_START_DATE` | SSM | `launch-phase-start-date` | ✅ Direct |

### 3. Variables d'Environnement Directes

| Variable | Valeur | Notes |
|----------|--------|-------|
| `APP_ENV` | `production` | ✅ |
| `RUST_LOG` | `info` | ✅ |
| `HOST` | `0.0.0.0` | ✅ |
| `CLOUD_RUN` | `true` | ✅ Spécifique GCP |
| `SQLX_OFFLINE` | `true` | ✅ |
| `ENABLE_AUTO_MIGRATIONS` | `true` | ✅ |

### 4. Variables GPU GCP (Nouvelles)

| Variable | Valeur | Description |
|----------|--------|-------------|
| `GPU_ENABLED` | `true` | Activer le service GPU GCP |
| `GPU_ENDPOINT` | `http://yukpo-gpu-workers:8080` | Endpoint des workers GPU |
| `GPU_ZONE` | `europe-west1-b` | Zone GCP pour instances GPU |
| `GPU_INSTANCE_NAME` | `yukpo-gpu-worker` | Nom de l'instance GPU |
| `GCP_PROJECT_ID` | `yukpo-project` | ID du projet GCP |
| `GPU_MONTHLY_BUDGET` | `100.0` | Budget mensuel GPU (€) |
| `GPU_SCALE_UP_THRESHOLD` | `70.0` | Seuil scale up (%) |
| `GPU_SCALE_DOWN_THRESHOLD` | `20.0` | Seuil scale down (%) |
| `GPU_MAX_INSTANCES` | `3` | Nombre max d'instances GPU |
| `GPU_MIN_INSTANCES` | `0` | Nombre min d'instances GPU |

---

## 🔧 Script de Migration

**Fichier**: `scripts/migrate-aws-to-gcp-env-vars.ps1`

**Usage**:
```powershell
.\scripts\migrate-aws-to-gcp-env-vars.ps1 `
  -AwsRegion "eu-west-1" `
  -AwsProjectName "yukpo" `
  -AwsEnvironment "production" `
  -GcpProjectId "yukpo-project" `
  -GcpRegion "europe-west1"
```

**Fonctionnalités**:
1. ✅ Récupère toutes les variables depuis AWS (Secrets Manager + SSM)
2. ✅ Adapte les valeurs pour GCP (régions, URLs, etc.)
3. ✅ Crée les secrets dans GCP Secret Manager
4. ✅ Configure les permissions pour le service account
5. ✅ Génère un fichier JSON de configuration
6. ✅ Affiche les commandes pour mettre à jour Cloud Run

---

## ⚠️ Adaptations Requises

### 1. DATABASE_URL

**AWS Format**:
```
postgresql://user:pass@rds-endpoint.eu-west-1.rds.amazonaws.com:5432/dbname
```

**GCP Format** (Cloud SQL):
```
postgresql://user:pass@/dbname?host=/cloudsql/project:region:instance
```

**Action**: Mettre à jour manuellement après migration

---

### 2. REDIS_URL

**AWS Format**:
```
redis://elasticache-endpoint.cache.amazonaws.com:6379
```

**GCP Format** (Cloud Memorystore):
```
redis://memorystore-endpoint:6379
```

**Action**: Créer Cloud Memorystore et mettre à jour l'URL

---

### 3. S3 → GCS (Google Cloud Storage)

**Variables à adapter**:
- `S3_BUCKET` → `GCS_BUCKET` (nom du bucket GCS)
- `S3_REGION` → `GCS_REGION` (région GCP)
- `S3_ACCESS_KEY` → **Supprimer** (GCS utilise Service Account)
- `S3_SECRET_KEY` → **Supprimer** (GCS utilise Service Account)
- `UPLOAD_BASE_URL` → Adapter URL (s3 → storage.googleapis.com)

**Action**:
1. Créer un bucket GCS
2. Créer un Service Account avec permissions Storage
3. Générer une clé JSON du Service Account
4. Stocker la clé JSON dans Secret Manager (si nécessaire)
5. Mettre à jour le code pour utiliser GCS SDK au lieu de S3 SDK

---

### 4. Variables GPU

**Vérification**: Les variables GPU sont déjà configurées dans le workflow ✅

**Variables GPU dans le code**:
- `backend/src/services/gpu_service.rs` → Utilise `GPU_ENABLED`, `GPU_ENDPOINT`, etc.
- `backend/src/config/production_config.rs` → Utilise `GPU_AVAILABLE` (local)

**Note**: 
- `GPU_ENABLED=true` → Active le service GPU GCP (instances distantes)
- `GPU_AVAILABLE=true` → Active le GPU local (dans le conteneur Cloud Run)

Pour production, utiliser `GPU_ENABLED=true` (instances GPU distantes avec scaling).

---

## 📋 Checklist de Migration

### Phase 1: Préparation
- [ ] Exécuter le script de migration (`migrate-aws-to-gcp-env-vars.ps1`)
- [ ] Vérifier que tous les secrets sont créés dans GCP Secret Manager
- [ ] Vérifier les permissions du service account

### Phase 2: Adaptation des Services
- [ ] Créer Cloud SQL instance et adapter `DATABASE_URL`
- [ ] Créer Cloud Memorystore et adapter `REDIS_URL`
- [ ] Créer bucket GCS et adapter les variables S3 → GCS
- [ ] Mettre à jour le code pour utiliser GCS SDK

### Phase 3: Configuration Cloud Run
- [ ] Mettre à jour Cloud Run avec toutes les variables
- [ ] Vérifier que les secrets sont bien référencés
- [ ] Tester le déploiement

### Phase 4: Vérification
- [ ] Vérifier les logs Cloud Run
- [ ] Tester la connexion à la base de données
- [ ] Tester la connexion à Redis
- [ ] Tester l'upload vers GCS
- [ ] Vérifier que le service GPU fonctionne

---

## 🚀 Commandes de Mise à Jour Cloud Run

Après exécution du script, utiliser la commande générée ou :

```bash
gcloud run services update yukpo-backend \
  --region=europe-west1 \
  --update-env-vars="APP_ENV=production,RUST_LOG=info,HOST=0.0.0.0,CLOUD_RUN=true,SQLX_OFFLINE=true,ENABLE_AUTO_MIGRATIONS=true,GPU_ENABLED=true,GPU_ENDPOINT=http://yukpo-gpu-workers:8080,GPU_ZONE=europe-west1-b,GPU_INSTANCE_NAME=yukpo-gpu-worker,GCP_PROJECT_ID=yukpo-project,GPU_MONTHLY_BUDGET=100.0,GPU_SCALE_UP_THRESHOLD=70.0,GPU_SCALE_DOWN_THRESHOLD=20.0,GPU_MAX_INSTANCES=3,GPU_MIN_INSTANCES=0" \
  --update-secrets="DATABASE_URL=database-url:latest,REDIS_URL=redis-url:latest,JWT_SECRET=jwt-secret:latest,MONGODB_URL=mongodb-url:latest,ENABLE_AUTO_MIGRATIONS=enable-auto-migrations:latest" \
  --project=yukpo-project
```

---

## ✅ Résultat Attendu

Après migration complète :
- ✅ Toutes les variables AWS migrées vers GCP
- ✅ Secrets stockés dans GCP Secret Manager
- ✅ Variables d'environnement dans Cloud Run
- ✅ Variables GPU configurées
- ✅ Services adaptés (Cloud SQL, Memorystore, GCS)

---

**📝 Note**: Le script génère un fichier `gcp-env-config.json` avec toute la configuration pour référence.

