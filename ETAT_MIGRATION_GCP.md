# État de la Migration AWS → GCP

**Date**: 2026-02-16  
**Statut**: En cours

---

## ✅ Ce qui est déjà fait

### 1. Variables GPU configurées dans Cloud Run
- ✅ `GPU_ENABLED=true`
- ✅ `GPU_ENDPOINT=http://yukpo-gpu-workers:8080`
- ✅ `GPU_ZONE=europe-west1-b`
- ✅ `GPU_INSTANCE_NAME=yukpo-gpu-worker`
- ✅ `GCP_PROJECT_ID=yukpo-project`
- ✅ `GPU_MONTHLY_BUDGET=100.0`
- ✅ `GPU_SCALE_UP_THRESHOLD=70.0`
- ✅ `GPU_SCALE_DOWN_THRESHOLD=20.0`
- ✅ `GPU_MAX_INSTANCES=3`
- ✅ `GPU_MIN_INSTANCES=0`

### 2. Variables d'environnement de base
- ✅ `CLOUD_RUN=true`
- ✅ `ENABLE_AUTO_MIGRATIONS=true`
- ✅ `SQLX_OFFLINE=true`
- ✅ `HOST=0.0.0.0`
- ✅ `RUST_LOG=info`
- ✅ `APP_ENV=production`

### 3. Secrets GCP
- ✅ `jwt-secret` - Créé et référencé dans Cloud Run

---

## ⏳ À faire

### 1. Créer les secrets manquants dans GCP Secret Manager

**Service Account**: `github-actions@yukpo-project.iam.gserviceaccount.com`

#### Secret: `database-url`
```bash
# Récupérer la valeur depuis AWS ou GitHub Secrets
# Puis créer le secret:
echo -n "VOTRE_DATABASE_URL_ICI" | gcloud secrets create database-url \
  --data-file=- \
  --replication-policy=automatic \
  --project=yukpo-project

# Donner accès au service account
gcloud secrets add-iam-policy-binding database-url \
  --member=serviceAccount:github-actions@yukpo-project.iam.gserviceaccount.com \
  --role=roles/secretmanager.secretAccessor \
  --project=yukpo-project
```

#### Secret: `redis-url`
```bash
echo -n "VOTRE_REDIS_URL_ICI" | gcloud secrets create redis-url \
  --data-file=- \
  --replication-policy=automatic \
  --project=yukpo-project

gcloud secrets add-iam-policy-binding redis-url \
  --member=serviceAccount:github-actions@yukpo-project.iam.gserviceaccount.com \
  --role=roles/secretmanager.secretAccessor \
  --project=yukpo-project
```

#### Secret: `mongodb-url`
```bash
echo -n "VOTRE_MONGODB_URL_ICI" | gcloud secrets create mongodb-url \
  --data-file=- \
  --replication-policy=automatic \
  --project=yukpo-project

gcloud secrets add-iam-policy-binding mongodb-url \
  --member=serviceAccount:github-actions@yukpo-project.iam.gserviceaccount.com \
  --role=roles/secretmanager.secretAccessor \
  --project=yukpo-project
```

### 2. Mettre à jour Cloud Run pour référencer tous les secrets

```bash
gcloud run services update yukpo-backend \
  --region=europe-west1 \
  --update-secrets="JWT_SECRET=jwt-secret:latest,DATABASE_URL=database-url:latest,REDIS_URL=redis-url:latest,MONGODB_URL=mongodb-url:latest" \
  --project=yukpo-project
```

---

## 📋 Récupération des valeurs depuis AWS

Si vous avez accès à AWS, vous pouvez récupérer les valeurs avec :

```bash
# DATABASE_URL depuis Secrets Manager
aws secretsmanager get-secret-value \
  --secret-id "arn:aws:secretsmanager:eu-west-1:ACCOUNT_ID:secret:yukpo/backend/secrets-XXXXX" \
  --query "SecretString" \
  --output text | jq -r '.DATABASE_URL'

# REDIS_URL depuis Secrets Manager
aws secretsmanager get-secret-value \
  --secret-id "arn:aws:secretsmanager:eu-west-1:ACCOUNT_ID:secret:yukpo/backend/secrets-XXXXX" \
  --query "SecretString" \
  --output text | jq -r '.REDIS_URL'

# MONGODB_URL depuis Secrets Manager
aws secretsmanager get-secret-value \
  --secret-id "arn:aws:secretsmanager:eu-west-1:ACCOUNT_ID:secret:yukpo/backend/secrets-XXXXX" \
  --query "SecretString" \
  --output text | jq -r '.MONGODB_URL'
```

---

## 🔍 Vérification

Après création des secrets, vérifier :

```bash
# Lister tous les secrets
gcloud secrets list --project=yukpo-project

# Vérifier les secrets référencés dans Cloud Run
gcloud run services describe yukpo-backend \
  --region=europe-west1 \
  --project=yukpo-project \
  --format="value(spec.template.spec.containers[0].env[].valueFrom.secretKeyRef.name)"
```

---

## ✅ Résultat attendu

Après migration complète :
- ✅ Tous les secrets créés dans GCP Secret Manager
- ✅ Tous les secrets référencés dans Cloud Run
- ✅ Variables GPU configurées
- ✅ Variables d'environnement de base configurées

