# 🔍 Comparaison Variables d'Environnement : AWS vs Render

## 📋 Résumé Exécutif

**Problème identifié** : Plusieurs variables critiques manquantes dans AWS, notamment pour la connexion à la base de données PostgreSQL et les migrations automatiques.

---

## 🔴 Variables CRITIQUES Manquantes dans AWS

### 1. **`ENABLE_AUTO_MIGRATIONS`** ⚠️ **CRITIQUE**

**Render** : Non présent (mais probablement géré différemment)  
**AWS** : Présent via SSM Parameter Store (`arn:aws:ssm:us-east-1:846505724644:parameter/yukpomnang/production/ENABLE_AUTO_MIGRATIONS`)

**Action** : ✅ **Vérifier que la valeur dans SSM Parameter Store est `"true"`**

---

### 2. **`DATABASE_URL`** ⚠️ **CRITIQUE - PROBLÈME PRINCIPAL**

**Render** :
```
DATABASE_URL=postgresql://yukpo_db_user:88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4@dpg-d2t7ntbuibrs73eh9tvg-a/yukpo_db
```

**AWS** : Présent via SSM Parameter Store (`arn:aws:ssm:us-east-1:846505724644:parameter/yukpomnang/production/DATABASE_URL`)

**⚠️ PROBLÈME IDENTIFIÉ** :
- Le `DATABASE_URL` dans Render pointe vers une base de données Render (`dpg-d2t7ntbuibrs73eh9tvg-a`)
- Le `DATABASE_URL` dans AWS doit pointer vers la base de données **AWS RDS PostgreSQL**
- **La valeur dans SSM Parameter Store est probablement incorrecte ou pointe encore vers Render**

**Action** : ✅ **Vérifier et corriger le `DATABASE_URL` dans SSM Parameter Store pour pointer vers AWS RDS**

**Format attendu pour AWS RDS** :
```
postgresql://username:password@rds-endpoint.region.rds.amazonaws.com:5432/database_name
```

Exemple :
```
postgresql://yukpo_db_user:password@yukpomnang-db.xxxxx.us-east-1.rds.amazonaws.com:5432/yukpo_db
```

---

## 🟡 Variables Manquantes dans AWS (Non Critiques mais Importantes)

### Variables de Configuration Base de Données

| Variable | Render | AWS | Impact |
|----------|--------|-----|--------|
| `DATABASE_TIMEOUT` | `10` | ❌ Manquant | ⚠️ Moyen |
| `DATABASE_READ_REPLICA_URL` | (vide) | ❌ Manquant | ✅ Faible |
| `DB_ACQUIRE_TIMEOUT_SECS` | `15` | ❌ Manquant | ⚠️ Moyen |
| `DB_HEALTH_CHECK_INTERVAL_SECS` | `30` | ❌ Manquant | ⚠️ Moyen |
| `DB_POOL_MIN_SIZE` | `10` | ❌ Manquant | ⚠️ Moyen |
| `DB_POOL_SIZE` | `100` | ❌ Manquant | ⚠️ Moyen |
| `SQLX_OFFLINE` | `true` | ❌ Manquant | ✅ Faible |

### Variables GPU (Mentionnées par l'utilisateur)

| Variable | Render | AWS | Impact |
|----------|--------|-----|--------|
| `GPU_AVAILABLE` | `false` | ❌ Manquant | ⚠️ Moyen |
| `GPU_MEMORY_GB` | `16` | ❌ Manquant | ⚠️ Moyen |
| `GPU_TYPE` | `nvidia` | ❌ Manquant | ⚠️ Moyen |
| `CUDA_VISIBLE_DEVICES` | `0,1` | ❌ Manquant | ⚠️ Moyen |
| `NVIDIA_VISIBLE_DEVICES` | `all` | ❌ Manquant | ⚠️ Moyen |
| `VIDEO_RENDERER_ENABLE_GPU` | `true` | ❌ Manquant | ⚠️ Moyen |
| `BLENDER_USE_GPU` | `false` | ❌ Manquant | ✅ Faible |

### Variables de Configuration Application

| Variable | Render | AWS | Impact |
|----------|--------|-----|--------|
| `ENVIRONMENT` | `production` | ❌ Manquant | ⚠️ Moyen |
| `APP_ENV` | (non présent) | ✅ `production` | ✅ OK |
| `RUST_LOG` | `debug` | ✅ `info` | ⚠️ Différent |
| `LOG_FORMAT` | `json` | ❌ Manquant | ✅ Faible |
| `INSTANCE_ID` | `backend-1` | ❌ Manquant | ✅ Faible |

### Variables de Configuration API

| Variable | Render | AWS | Impact |
|----------|--------|-----|--------|
| `API_MAX_PAYLOAD_SIZE` | `10485760` | ❌ Manquant | ⚠️ Moyen |
| `API_RATE_LIMIT_PER_MINUTE` | `100` | ❌ Manquant | ⚠️ Moyen |
| `API_REQUEST_TIMEOUT` | `30` | ❌ Manquant | ⚠️ Moyen |
| `REQUEST_TIMEOUT` | `30` | ❌ Manquant | ⚠️ Moyen |
| `RATE_LIMIT_IP` | `200` | ❌ Manquant | ⚠️ Moyen |

### Variables de Configuration Redis

| Variable | Render | AWS | Impact |
|----------|--------|-----|--------|
| `REDIS_CLUSTER_NODES` | (vide) | ❌ Manquant | ✅ Faible |

**Note** : `REDIS_URL` est présent dans AWS via SSM Parameter Store ✅

### Variables de Configuration S3

| Variable | Render | AWS | Impact |
|----------|--------|-----|--------|
| `S3_ENDPOINT` | (vide) | ❌ Manquant | ✅ Faible |
| `S3_FORCE_PATH_STYLE` | `false` | ❌ Manquant | ✅ Faible |

**Note** : `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`, `S3_REGION` sont présents dans AWS via SSM ✅

### Variables de Configuration Email/SMS

| Variable | Render | AWS | Impact |
|----------|--------|-----|--------|
| `EMAIL_ENABLED` | `true` | ❌ Manquant | ⚠️ Moyen |
| `EMAIL_PROVIDER` | `sendgrid` | ❌ Manquant | ⚠️ Moyen |
| `SMS_ENABLED` | `true` | ❌ Manquant | ⚠️ Moyen |
| `SMS_PROVIDER` | `twilio` | ❌ Manquant | ⚠️ Moyen |
| `SENDGRID_FROM_EMAIL` | `noreply@yukpomnang.com` | ❌ Manquant | ⚠️ Moyen |
| `SENDGRID_FROM_NAME` | `Yukpomnang` | ❌ Manquant | ⚠️ Moyen |
| `TWILIO_ACCOUNT_SID` | `your_account_sid` | ❌ Manquant | ⚠️ Moyen |
| `TWILIO_FROM_NUMBER` | `+1234567890` | ❌ Manquant | ⚠️ Moyen |

**Note** : `SENDGRID_API_KEY` et `TWILIO_AUTH_TOKEN` sont présents dans AWS via SSM ✅

### Variables de Configuration Recherche

| Variable | Render | AWS | Impact |
|----------|--------|-----|--------|
| `SEARCH_DEFAULT_LANGUAGE` | `fr` | ❌ Manquant | ⚠️ Moyen |
| `SEARCH_DEFAULT_RADIUS_KM` | `20` | ❌ Manquant | ⚠️ Moyen |
| `SEARCH_MAX_RESULTS` | `50` | ❌ Manquant | ⚠️ Moyen |
| `SEARCH_TITLE_BOOST` | `2.0` | ❌ Manquant | ⚠️ Moyen |

### Variables de Configuration Cache

| Variable | Render | AWS | Impact |
|----------|--------|-----|--------|
| `CACHE_DEFAULT_TTL` | `3600` | ❌ Manquant | ⚠️ Moyen |
| `CACHE_TTL_SEARCH` | `600` | ❌ Manquant | ⚠️ Moyen |
| `SEMANTIC_CACHE_THRESHOLD` | `0.85` | ❌ Manquant | ⚠️ Moyen |

### Variables de Configuration Timeouts

| Variable | Render | AWS | Impact |
|----------|--------|-----|--------|
| `AI_REQUEST_TIMEOUT_SECONDS` | `120` | ❌ Manquant | ⚠️ Moyen |
| `AUDIO_SYNC_TIMEOUT_SECONDS` | `180` | ❌ Manquant | ⚠️ Moyen |
| `COLOR_GRADING_TIMEOUT_SECONDS` | `120` | ❌ Manquant | ⚠️ Moyen |
| `EMBEDDING_TIMEOUT_SECONDS` | `60` | ❌ Manquant | ⚠️ Moyen |
| `VIDEO_ANALYSIS_TIMEOUT_SECONDS` | `180` | ❌ Manquant | ⚠️ Moyen |
| `VIDEO_GENERATION_TIMEOUT_SECONDS` | `600` | ❌ Manquant | ⚠️ Moyen |
| `VIDEO_RENDERER_TIMEOUT_SECS` | `900` | ❌ Manquant | ⚠️ Moyen |

### Variables de Configuration Video Renderer

| Variable | Render | AWS | Impact |
|----------|--------|-----|--------|
| `VIDEO_RENDERER_PROJECT_ROOT` | `/srv/yukpo/video-renderer` | ❌ Manquant | ⚠️ Moyen |
| `VIDEO_RENDERER_SHARED_VOLUME` | `/srv/yukpo/jobs` | ❌ Manquant | ⚠️ Moyen |
| `VIDEO_RENDERER_RPC_URL` | `http://46.224.14.85:8088/render` | ❌ Manquant | ⚠️ Moyen |
| `VIDEO_RENDERER_MAX_RETRIES` | `2` | ❌ Manquant | ⚠️ Moyen |
| `RENDERER_S3_UPLOAD` | `true` | ❌ Manquant | ⚠️ Moyen |

**Note** : `VIDEO_RENDERER_RPC_TOKEN` est présent dans AWS via SSM ✅

### Variables de Configuration LiveKit

| Variable | Render | AWS | Impact |
|----------|--------|-----|--------|
| `LIVEKIT_API_URL` | `http://46.224.14.85:7880` | ❌ Manquant | ⚠️ Moyen |
| `LIVEKIT_WS_URL` | `ws://46.224.14.85:7880` | ❌ Manquant | ⚠️ Moyen |
| `LIVEKIT_HLS_URL` | `http://46.224.14.85:8080/live` | ❌ Manquant | ⚠️ Moyen |
| `LIVEKIT_INGRESS_MODE` | `rtmp` | ❌ Manquant | ⚠️ Moyen |
| `LIVEKIT_INGRESS_NAME` | `prod-ingress-1` | ❌ Manquant | ⚠️ Moyen |
| `LIVEKIT_INGRESS_REGION` | `eu-central` | ❌ Manquant | ⚠️ Moyen |
| `LIVEKIT_INGRESS_ROOM` | `live-events` | ❌ Manquant | ⚠️ Moyen |
| `LIVE_FALLBACK_ENABLED` | `true` | ❌ Manquant | ⚠️ Moyen |
| `LIVE_RECORDING_ENABLED` | `true` | ❌ Manquant | ⚠️ Moyen |

**Note** : `LIVEKIT_API_KEY` et `LIVEKIT_API_SECRET` sont présents dans AWS via SSM ✅

### Variables de Configuration Autres Services

| Variable | Render | AWS | Impact |
|----------|--------|-----|--------|
| `PUBLIC_BASE_URL` | `https://cdn.yukpomnang.com` | ❌ Manquant | ⚠️ Moyen |
| `UPLOAD_STORAGE_PATH` | `/var/data/uploads` | ❌ Manquant | ⚠️ Moyen |
| `ML_MODELS_DIR` | `models` | ❌ Manquant | ⚠️ Moyen |
| `ENABLE_AI_OPTIMIZATIONS` | `true` | ❌ Manquant | ⚠️ Moyen |
| `ENABLE_STAGING_DEMO_SEED` | `true` | ❌ Manquant | ✅ Faible |

---

## ✅ Variables Présentes dans AWS (via SSM Parameter Store)

- ✅ `DATABASE_URL` (mais valeur probablement incorrecte)
- ✅ `REDIS_URL`
- ✅ `JWT_SECRET`
- ✅ `OPENAI_API_KEY`
- ✅ `SORA_API_KEY`
- ✅ `LIVEKIT_API_SECRET`
- ✅ `S3_SECRET_KEY`
- ✅ `S3_ACCESS_KEY`
- ✅ `MONGODB_URL`
- ✅ `SENDGRID_API_KEY`
- ✅ `TWILIO_AUTH_TOKEN`
- ✅ `AUPHONIC_API_KEY`
- ✅ `VIDEO_RENDERER_RPC_TOKEN`
- ✅ `EMBEDDING_API_KEY`
- ✅ `YUKPO_API_KEY`
- ✅ `GOOGLE_MAPS_API_KEY`
- ✅ `GOOGLE_TRANSLATE_API_KEY`
- ✅ `PEXELS_API_KEY`
- ✅ `PIXABAY_API_KEY`
- ✅ `UNSPLASH_ACCESS_KEY`
- ✅ `OPENWEATHERMAP_API_KEY`
- ✅ `YOUTUBE_CLIENT_SECRET`
- ✅ `ENABLE_AUTO_MIGRATIONS`
- ✅ `S3_BUCKET`
- ✅ `S3_REGION`
- ✅ `UPLOAD_BASE_URL`

---

## 🎯 Actions Prioritaires

### 🔴 PRIORITÉ 1 : Corriger DATABASE_URL (CRITIQUE)

**Problème** : Le `DATABASE_URL` dans SSM Parameter Store pointe probablement vers Render au lieu d'AWS RDS.

**Action** :
1. **Trouver l'endpoint RDS** :
   - Console AWS → RDS → Databases
   - Sélectionner votre base de données PostgreSQL
   - Copier l'endpoint (ex: `yukpomnang-db.xxxxx.us-east-1.rds.amazonaws.com`)

2. **Construire le DATABASE_URL correct** :
   ```
   postgresql://yukpo_db_user:VOTRE_MOT_DE_PASSE@ENDPOINT_RDS:5432/yukpo_db
   ```

3. **Mettre à jour dans SSM Parameter Store** :
   - Console AWS → Systems Manager → Parameter Store
   - Sélectionner `/yukpomnang/production/DATABASE_URL`
   - Cliquer sur "Edit"
   - Mettre à jour la valeur avec le nouveau `DATABASE_URL`
   - Sauvegarder

4. **Redéployer le service ECS** pour que les changements prennent effet

### 🟡 PRIORITÉ 2 : Vérifier ENABLE_AUTO_MIGRATIONS

**Action** :
1. Console AWS → Systems Manager → Parameter Store
2. Sélectionner `/yukpomnang/production/ENABLE_AUTO_MIGRATIONS`
3. Vérifier que la valeur est `"true"` (sans guillemets dans SSM)
4. Si ce n'est pas le cas, mettre à jour à `true`

### 🟡 PRIORITÉ 3 : Ajouter Variables de Configuration Base de Données

**Action** : Ajouter dans SSM Parameter Store ou directement dans la Task Definition :

| Variable | Valeur Recommandée |
|---------|-------------------|
| `DATABASE_TIMEOUT` | `10` |
| `DB_ACQUIRE_TIMEOUT_SECS` | `15` |
| `DB_HEALTH_CHECK_INTERVAL_SECS` | `30` |
| `DB_POOL_MIN_SIZE` | `10` |
| `DB_POOL_SIZE` | `100` |

### 🟡 PRIORITÉ 4 : Ajouter Variables GPU (si nécessaire)

**Action** : Si vous utilisez GPU dans AWS, ajouter :

| Variable | Valeur Recommandée |
|---------|-------------------|
| `GPU_AVAILABLE` | `true` (si GPU disponible) |
| `GPU_MEMORY_GB` | `16` (selon votre instance) |
| `GPU_TYPE` | `nvidia` |
| `VIDEO_RENDERER_ENABLE_GPU` | `true` |

---

## 📝 Script pour Mettre à Jour SSM Parameter Store

### Via AWS CLI

```bash
# Mettre à jour DATABASE_URL
aws ssm put-parameter \
  --name "/yukpomnang/production/DATABASE_URL" \
  --value "postgresql://yukpo_db_user:password@rds-endpoint.us-east-1.rds.amazonaws.com:5432/yukpo_db" \
  --type "SecureString" \
  --overwrite

# Mettre à jour ENABLE_AUTO_MIGRATIONS
aws ssm put-parameter \
  --name "/yukpomnang/production/ENABLE_AUTO_MIGRATIONS" \
  --value "true" \
  --type "String" \
  --overwrite

# Ajouter DATABASE_TIMEOUT
aws ssm put-parameter \
  --name "/yukpomnang/production/DATABASE_TIMEOUT" \
  --value "10" \
  --type "String"

# Ajouter DB_POOL_SIZE
aws ssm put-parameter \
  --name "/yukpomnang/production/DB_POOL_SIZE" \
  --value "100" \
  --type "String"
```

### Via Console AWS

1. **Systems Manager** → **Parameter Store**
2. **Créer un paramètre** ou **Modifier un paramètre existant**
3. **Nom** : `/yukpomnang/production/VARIABLE_NAME`
4. **Type** : `String` (ou `SecureString` pour les secrets)
5. **Valeur** : La valeur de la variable
6. **Sauvegarder**

---

## 🔍 Comment Vérifier le DATABASE_URL Actuel

### Via AWS CLI

```bash
# Voir la valeur actuelle (⚠️ SENSIBLE)
aws ssm get-parameter \
  --name "/yukpomnang/production/DATABASE_URL" \
  --with-decryption \
  --query 'Parameter.Value' \
  --output text
```

### Via Console AWS

1. **Systems Manager** → **Parameter Store**
2. Rechercher `/yukpomnang/production/DATABASE_URL`
3. Cliquer sur le paramètre
4. Onglet **Value** → **Show** (pour voir la valeur)

---

## ✅ Checklist de Vérification

### Variables Critiques

- [ ] `DATABASE_URL` pointe vers AWS RDS (pas Render)
- [ ] `ENABLE_AUTO_MIGRATIONS` est défini à `true`
- [ ] `RUST_LOG` est défini (actuellement `info`, peut être changé en `debug` pour diagnostic)
- [ ] `PORT` est défini à `3001` ✅ (déjà présent)

### Variables de Configuration Base de Données

- [ ] `DATABASE_TIMEOUT` est défini
- [ ] `DB_POOL_SIZE` est défini
- [ ] `DB_POOL_MIN_SIZE` est défini

### Variables GPU (si nécessaire)

- [ ] `GPU_AVAILABLE` est défini
- [ ] `VIDEO_RENDERER_ENABLE_GPU` est défini

---

## 🆘 Diagnostic de Connexion Base de Données

### Test de Connexion depuis ECS Task

```bash
# Se connecter à une tâche ECS en cours
aws ecs execute-command \
  --cluster yukpomnang-cluster \
  --task <TASK_ID> \
  --container backend \
  --command "/bin/sh" \
  --interactive

# Dans le conteneur, tester la connexion
psql $DATABASE_URL -c "SELECT version();"
```

### Vérifier les Logs ECS

```bash
# Voir les logs récents
aws logs tail /ecs/yukpomnang-backend --follow

# Chercher les erreurs de connexion
aws logs tail /ecs/yukpomnang-backend --filter-pattern "database" --follow
```

---

**Date** : 2026-01-30  
**Statut** : ⚠️ **DATABASE_URL probablement incorrect - Action immédiate requise**

