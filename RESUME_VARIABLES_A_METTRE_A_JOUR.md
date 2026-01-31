# 📋 Résumé : Variables à Mettre à Jour dans AWS

## 🔴 Problème Identifié

Le `DATABASE_URL` actuel pointe vers une **IP interne** (`172.31.32.166`) au lieu de l'**endpoint RDS public**.

**Actuel** :
```
postgresql://***:***@172.31.32.166:5432/postgres
```

**Attendu** :
```
postgresql://yukpo_db_user:***@yukpomnang-db.cy3e2i84qr8y.us-east-1.rds.amazonaws.com:5432/postgres?sslmode=require
```

## ✅ Variables Déjà Présentes

- ✅ `ENABLE_AUTO_MIGRATIONS` = `true`
- ✅ `GPU_AVAILABLE` = `true`

## ❌ Variables à Créer/Mettre à Jour

### Critiques (Base de données)
- ❌ `DATABASE_URL` → **À CORRIGER** (IP interne → endpoint RDS public)
- ❌ `DATABASE_TIMEOUT` → À créer
- ❌ `DB_POOL_SIZE` → À créer
- ❌ `DB_POOL_MIN_SIZE` → À créer
- ❌ `DB_ACQUIRE_TIMEOUT_SECS` → À créer
- ❌ `DB_HEALTH_CHECK_INTERVAL_SECS` → À créer
- ❌ `SQLX_OFFLINE` → À créer

### GPU
- ✅ `GPU_AVAILABLE` = `true` (déjà présent)
- ❌ `GPU_MEMORY_GB` → À créer
- ❌ `GPU_TYPE` → À créer
- ❌ `CUDA_VISIBLE_DEVICES` → À créer
- ❌ `NVIDIA_VISIBLE_DEVICES` → À créer
- ❌ `VIDEO_RENDERER_ENABLE_GPU` → À créer
- ❌ `BLENDER_USE_GPU` → À créer

### Configuration Application
- ❌ `ENVIRONMENT` → À créer
- ❌ `RUST_LOG` → À créer (actuellement dans Task Definition directement)
- ❌ `LOG_FORMAT` → À créer
- ❌ `INSTANCE_ID` → À créer

### Configuration API
- ❌ `API_MAX_PAYLOAD_SIZE` → À créer
- ❌ `API_RATE_LIMIT_PER_MINUTE` → À créer
- ❌ `API_REQUEST_TIMEOUT` → À créer
- ❌ `REQUEST_TIMEOUT` → À créer
- ❌ `RATE_LIMIT_IP` → À créer

### Cache
- ❌ `CACHE_DEFAULT_TTL` → À créer
- ❌ `CACHE_TTL_SEARCH` → À créer
- ❌ `SEMANTIC_CACHE_THRESHOLD` → À créer

### Recherche
- ❌ `SEARCH_DEFAULT_LANGUAGE` → À créer
- ❌ `SEARCH_DEFAULT_RADIUS_KM` → À créer
- ❌ `SEARCH_MAX_RESULTS` → À créer
- ❌ `SEARCH_TITLE_BOOST` → À créer

### Timeouts
- ❌ `AI_REQUEST_TIMEOUT_SECONDS` → À créer
- ❌ `AUDIO_SYNC_TIMEOUT_SECONDS` → À créer
- ❌ `COLOR_GRADING_TIMEOUT_SECONDS` → À créer
- ❌ `EMBEDDING_TIMEOUT_SECONDS` → À créer
- ❌ `VIDEO_ANALYSIS_TIMEOUT_SECONDS` → À créer
- ❌ `VIDEO_GENERATION_TIMEOUT_SECONDS` → À créer
- ❌ `VIDEO_RENDERER_TIMEOUT_SECS` → À créer

### Email/SMS
- ❌ `EMAIL_ENABLED` → À créer
- ❌ `EMAIL_PROVIDER` → À créer
- ❌ `SMS_ENABLED` → À créer
- ❌ `SMS_PROVIDER` → À créer
- ❌ `SENDGRID_FROM_EMAIL` → À créer
- ❌ `SENDGRID_FROM_NAME` → À créer

### Video Renderer
- ❌ `VIDEO_RENDERER_PROJECT_ROOT` → À créer
- ❌ `VIDEO_RENDERER_SHARED_VOLUME` → À créer
- ❌ `VIDEO_RENDERER_RPC_URL` → À créer
- ❌ `VIDEO_RENDERER_MAX_RETRIES` → À créer
- ❌ `RENDERER_S3_UPLOAD` → À créer

### LiveKit
- ❌ `LIVEKIT_API_URL` → À créer
- ❌ `LIVEKIT_WS_URL` → À créer
- ❌ `LIVEKIT_HLS_URL` → À créer
- ❌ `LIVEKIT_INGRESS_MODE` → À créer
- ❌ `LIVEKIT_INGRESS_NAME` → À créer
- ❌ `LIVEKIT_INGRESS_REGION` → À créer
- ❌ `LIVEKIT_INGRESS_ROOM` → À créer
- ❌ `LIVE_FALLBACK_ENABLED` → À créer
- ❌ `LIVE_RECORDING_ENABLED` → À créer

### Autres Services
- ❌ `PUBLIC_BASE_URL` → À créer
- ❌ `UPLOAD_STORAGE_PATH` → À créer
- ❌ `ML_MODELS_DIR` → À créer
- ❌ `ENABLE_AI_OPTIMIZATIONS` → À créer
- ❌ `ENABLE_STAGING_DEMO_SEED` → À créer

### S3
- ❌ `S3_ENDPOINT` → À créer
- ❌ `S3_FORCE_PATH_STYLE` → À créer

## 🚀 Action Requise

**Exécuter le script** pour mettre à jour toutes les variables :

```powershell
.\scripts\update_all_env_variables_aws.ps1 -DbPassword "VOTRE_MOT_DE_PASSE"
```

Le script va :
1. ✅ Corriger le `DATABASE_URL` avec le bon endpoint RDS
2. ✅ Créer toutes les variables manquantes
3. ✅ Mettre à jour les variables existantes si nécessaire

---

**Date** : 2026-01-30  
**Statut** : ⚠️ **Action requise - Script prêt à être exécuté**

