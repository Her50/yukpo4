# 📋 Résumé : Adaptation Variables AWS → GCP

**Date** : 2026-02-14  
**Objectif** : Récupérer toutes les variables AWS et les adapter pour GCP

---

## ✅ VARIABLES RÉCUPÉRÉES

**Le script récupère automatiquement** :
- ✅ **Variables directes** depuis ECS Task Definition
- ✅ **Secrets depuis SSM Parameter Store** (tous les paramètres `/yukpo/*`, `/yukpomnang/*`, `/yukpo4/*`)
- ✅ **Secrets depuis Secrets Manager** (avec parsing JSON si nécessaire)
- ✅ **Variable LAUNCH_PHASE_START_DATE** (période gratuite 3 mois) ✅

**Total** : Toutes les variables (environ une centaine)

---

## 🔄 VARIABLES ADAPTÉES AWS → GCP

### 1. DATABASE_URL (PostgreSQL)
- **AWS** : `postgresql://user:pass@rds-endpoint:5432/db`
- **GCP** : `postgresql://user:pass@cloud-sql-ip:5432/db?sslmode=require`
- ✅ **Adapté automatiquement** vers Cloud SQL

### 2. REDIS_URL
- **AWS** : `redis://elasticache-endpoint:6379`
- **GCP** : `redis://cloud-memorystore-ip:6379`
- ⚠️ **Note** : Cloud Memorystore doit être créé manuellement

### 3. S3_BUCKET
- **AWS** : `yukpo-bucket`
- **GCP** : `yukpo-project-yukpo-bucket` (préfixé avec Project ID)
- ✅ **Adapté automatiquement**

### 4. S3_REGION
- **AWS** : `eu-west-1`
- **GCP** : `europe-west1` (région GCP)
- ✅ **Adapté automatiquement**

### 5. S3_ACCESS_KEY / S3_SECRET_KEY
- **AWS** : Credentials AWS
- **GCP** : Credentials Cloud Storage (à configurer)
- ⚠️ **Note** : À configurer avec Service Account Cloud Storage

### 6. UPLOAD_BASE_URL
- **AWS** : `https://bucket.s3.amazonaws.com`
- **GCP** : `https://bucket.storage.googleapis.com`
- ✅ **Adapté automatiquement**

### 7. WEBSOCKET_URL
- **AWS** : `wss://api.yukpomnang.com/ws`
- **GCP** : `wss://yukpo-backend-yukpo-project.a.run.app/ws`
- ✅ **Adapté automatiquement** vers Cloud Run

### 8. WEBRTC_URL
- **AWS** : `https://api.yukpomnang.com/webrtc`
- **GCP** : `https://yukpo-backend-yukpo-project.a.run.app/webrtc`
- ✅ **Adapté automatiquement** vers Cloud Run

### 9. API_URL
- **AWS** : `https://api.yukpomnang.com`
- **GCP** : `https://yukpo-backend-yukpo-project.a.run.app`
- ✅ **Adapté automatiquement** vers Cloud Run

### 10. LAUNCH_PHASE_START_DATE
- **AWS** : `2026-02-10T00:00:00Z` (depuis SSM)
- **GCP** : **Récupérée et conservée** ✅
- ✅ **Variable importante pour la période gratuite (3 mois)**

---

## 📋 VARIABLES CONSERVÉES (Sans Modification)

**Ces variables sont récupérées et conservées telles quelles** :
- ✅ `LAUNCH_PHASE_START_DATE` (période gratuite)
- ✅ `JWT_SECRET`
- ✅ `ENABLE_AUTO_MIGRATIONS`
- ✅ `SQLX_OFFLINE`
- ✅ `RUST_LOG`
- ✅ `ENVIRONMENT`
- ✅ `ALLOWED_ORIGINS`
- ✅ Toutes les autres variables non liées à AWS

---

## 🔧 CONFIGURATION DANS CLOUD RUN

**Toutes les variables sont configurées automatiquement** :
- ✅ Via le workflow GitHub Actions
- ✅ Toutes les variables sont passées à Cloud Run
- ✅ Format : `--set-env-vars VAR1=value1,VAR2=value2,...`

---

## 📊 RÉSUMÉ

| Type de Variable | Récupération | Adaptation | Configuration |
|------------------|--------------|------------|---------------|
| **Variables directes** | ✅ Oui | ✅ Si nécessaire | ✅ Cloud Run |
| **SSM Parameters** | ✅ Oui | ✅ Si nécessaire | ✅ Cloud Run |
| **Secrets Manager** | ✅ Oui | ✅ Si nécessaire | ✅ Cloud Run |
| **LAUNCH_PHASE_START_DATE** | ✅ Oui | ✅ Conservée | ✅ Cloud Run |
| **DATABASE_URL** | ✅ Oui | ✅ Cloud SQL | ✅ Cloud Run |
| **REDIS_URL** | ✅ Oui | ⚠️ À adapter | ✅ Cloud Run |
| **S3 URLs** | ✅ Oui | ✅ Cloud Storage | ✅ Cloud Run |
| **WebSocket/WebRTC** | ✅ Oui | ✅ Cloud Run | ✅ Cloud Run |

---

## ✅ RÉSULTAT

**Après exécution du script** :
- ✅ **Toutes les variables récupérées** depuis AWS (environ une centaine)
- ✅ **Variables adaptées** pour GCP (URLs, endpoints, etc.)
- ✅ **LAUNCH_PHASE_START_DATE** récupérée et conservée
- ✅ **Variables configurées** dans Cloud Run
- ✅ **Variables configurées** dans GitHub Secrets

---

**Date** : 2026-02-14  
**Statut** : Script mis à jour - Récupération complète et adaptation automatique

