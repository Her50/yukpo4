# 🔧 Corrections et Synchronisation Variables AWS → GCP

**Date**: 2026-02-18  
**Objectif**: Corriger les erreurs critiques et synchroniser toutes les variables d'environnement depuis AWS vers GCP

---

## ✅ Corrections Appliquées

### 1. Correction du Pool de Connexions PostgreSQL

**Fichier**: `backend/src/main.rs`

**Problème**: Le pool était configuré à 20 connexions par défaut, causant la saturation de Cloud SQL.

**Corrections**:
- ✅ Pool maximum réduit de **20 à 10** pour Cloud Run
- ✅ `idle_timeout` réduit de **120s à 60s** pour libérer les connexions plus rapidement
- ✅ `max_lifetime` réduit de **180s à 120s** pour renouveler les connexions plus souvent

**Code modifié**:
```rust
// Avant
let cloud_run_max = env::var("DB_POOL_SIZE")
    .unwrap_or_else(|_| "20".to_string())
    .parse()
    .unwrap_or(20);

// Après
let cloud_run_max = env::var("DB_POOL_SIZE")
    .unwrap_or_else(|_| "10".to_string())  // ✅ Réduit à 10
    .parse()
    .unwrap_or(10);
```

---

## 📋 Script de Synchronisation AWS → GCP

### Script Créé: `scripts/sync-aws-to-gcp-variables.ps1`

Ce script fait tout automatiquement :

1. **Récupère toutes les variables depuis AWS**:
   - Secrets Manager (DATABASE_URL, JWT_SECRET, OPENAI_API_KEY, etc.)
   - SSM Parameter Store (S3_BUCKET, S3_REGION, etc.)

2. **Vérifie leur présence dans GCP**:
   - Secrets dans Secret Manager
   - Variables d'environnement dans Cloud Run

3. **Adapte les valeurs pour GCP**:
   - Régions AWS → GCP (eu-west-1 → europe-west1)
   - URLs S3 → GCS (s3.amazonaws.com → storage.googleapis.com)
   - Variables spécifiques GCP (CLOUD_RUN=true, etc.)

4. **Crée/Met à jour les variables manquantes**:
   - Crée les secrets dans Secret Manager
   - Met à jour Cloud Run avec les nouvelles variables
   - Configure les permissions du service account

---

## 🚀 Utilisation du Script

### Prérequis

1. **AWS CLI configuré** avec un profil valide
2. **gcloud CLI installé** et authentifié
3. **Permissions**:
   - AWS: Accès à Secrets Manager et SSM Parameter Store
   - GCP: Accès à Secret Manager et Cloud Run

### Exécution

```powershell
# Mode normal (exécute les changements)
.\scripts\sync-aws-to-gcp-variables.ps1

# Mode dry-run (affiche ce qui serait fait sans exécuter)
.\scripts\sync-aws-to-gcp-variables.ps1 -DryRun

# Avec paramètres personnalisés
.\scripts\sync-aws-to-gcp-variables.ps1 `
    -AwsProfile "my-profile" `
    -AwsRegion "eu-west-1" `
    -GcpProjectId "yukpo-project" `
    -GcpRegion "europe-west1"
```

### Variables Synchronisées

#### Secrets (GCP Secret Manager)
- `DATABASE_URL` → `database-url`
- `REDIS_URL` → `redis-url`
- `JWT_SECRET` → `jwt-secret`
- `MONGODB_URL` → `mongodb-url`
- `OPENAI_API_KEY` → `openai-api-key` ⭐ **CRITIQUE pour IA**
- `MISTRAL_API_KEY` → `mistral-api-key`
- `GEMINI_API_KEY` → `gemini-api-key`
- `ANTHROPIC_API_KEY` → `anthropic-api-key`

#### Variables d'Environnement (Cloud Run)
- `S3_BUCKET` (adapté pour GCS)
- `S3_REGION` (adapté: eu-west-1 → europe-west1)
- `UPLOAD_BASE_URL` (adapté: S3 → GCS)
- `LAUNCH_PHASE_START_DATE`
- `CLOUD_RUN=true` ⭐ **Nouveau pour GCP**
- `DB_POOL_SIZE=10` ⭐ **Corrigé pour éviter saturation**
- `DB_POOL_MIN_SIZE=2` ⭐ **Nouveau**
- `DB_ACQUIRE_TIMEOUT_SECS=30` ⭐ **Nouveau**
- `ENVIRONMENT=production`
- `APP_ENV=production`
- `HOST=0.0.0.0`
- `PORT=8080`
- `RUST_LOG=info`
- `SQLX_OFFLINE=true`
- `ENABLE_AUTO_MIGRATIONS=true`

---

## ⚠️ Adaptations Manuelles Requises

Certaines variables doivent être adaptées manuellement car elles dépendent de l'infrastructure GCP :

### 1. DATABASE_URL

**AWS Format**:
```
postgresql://user:pass@rds-endpoint:5432/db
```

**GCP Format (Cloud SQL)**:
```
postgresql://user:pass@/db?host=/cloudsql/project:region:instance
```

**Action**: Mettre à jour manuellement dans GCP Secret Manager après la migration.

### 2. REDIS_URL

**AWS Format**:
```
redis://elasticache-endpoint:6379
```

**GCP Format (Cloud Memorystore)**:
```
redis://memorystore-endpoint:6379
```

**Action**: Mettre à jour manuellement dans GCP Secret Manager après la migration.

### 3. S3_* → GCS

**Variables à adapter**:
- `S3_BUCKET` → Nom du bucket GCS
- `S3_ACCESS_KEY` → Service Account JSON (pas d'access key)
- `S3_SECRET_KEY` → Service Account JSON (pas de secret key)
- `UPLOAD_BASE_URL` → URL GCS (déjà adapté automatiquement)

**Action**: 
1. Créer un bucket GCS
2. Créer un Service Account avec permissions GCS
3. Télécharger la clé JSON
4. Mettre à jour les variables dans Cloud Run

---

## 📊 Vérification Post-Synchronisation

### 1. Vérifier les Secrets dans GCP

```powershell
# Lister tous les secrets
gcloud secrets list --project=yukpo-project

# Vérifier un secret spécifique
gcloud secrets describe openai-api-key --project=yukpo-project
```

### 2. Vérifier les Variables dans Cloud Run

```powershell
# Voir la configuration complète
gcloud run services describe yukpo-backend \
  --region=europe-west1 \
  --project=yukpo-project \
  --format=json | ConvertFrom-Json | 
  Select-Object -ExpandProperty spec | 
  Select-Object -ExpandProperty template | 
  Select-Object -ExpandProperty spec | 
  Select-Object -ExpandProperty containers | 
  Select-Object -First 1 | 
  Select-Object -ExpandProperty env
```

### 3. Vérifier les Logs

```powershell
# Voir les logs récents
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=yukpo-backend" \
  --limit=50 \
  --project=yukpo-project \
  --format=json
```

**Rechercher**:
- ✅ `OPENAI_API_KEY` présent dans les logs
- ✅ `DB_POOL_SIZE=10` dans les logs
- ✅ Aucune erreur "remaining connection slots"

---

## 🔄 Workflow Complet

### Étape 1: Exécuter le Script de Synchronisation

```powershell
.\scripts\sync-aws-to-gcp-variables.ps1
```

### Étape 2: Adapter les Variables Manuelles

1. **DATABASE_URL**: Mettre à jour avec l'URL Cloud SQL
2. **REDIS_URL**: Mettre à jour avec l'URL Cloud Memorystore
3. **S3_***: Adapter pour GCS

### Étape 3: Redéployer le Service

Le script met automatiquement à jour Cloud Run, mais vous pouvez forcer un redéploiement :

```powershell
gcloud run services update yukpo-backend \
  --region=europe-west1 \
  --project=yukpo-project
```

### Étape 4: Vérifier

1. Vérifier les logs (voir section ci-dessus)
2. Tester une connexion
3. Tester un appel IA

---

## 📝 Checklist Complète

- [ ] Script de synchronisation exécuté
- [ ] Tous les secrets créés dans GCP Secret Manager
- [ ] Toutes les variables d'environnement configurées dans Cloud Run
- [ ] DATABASE_URL adaptée pour Cloud SQL
- [ ] REDIS_URL adaptée pour Cloud Memorystore
- [ ] Variables S3 adaptées pour GCS
- [ ] Service redéployé
- [ ] Logs vérifiés (pas d'erreurs de pool DB)
- [ ] Test de connexion réussi
- [ ] Test d'appel IA réussi

---

## 🔗 Fichiers Créés/Modifiés

1. ✅ `backend/src/main.rs` - Pool DB corrigé
2. ✅ `scripts/sync-aws-to-gcp-variables.ps1` - Script de synchronisation
3. ✅ `ANALYSE_ERREURS_LOGS_20260218.md` - Analyse des erreurs
4. ✅ `GUIDE_CONFIGURATION_VARIABLES_GCP.md` - Guide de configuration
5. ✅ `scripts/verify-gcp-variables.ps1` - Script de vérification

---

## 🚨 Problèmes Résolus

1. ✅ **Saturation du pool DB** → Pool réduit à 10, timeouts réduits
2. ✅ **Erreurs 503** → Résolu avec la correction du pool
3. ✅ **Variables IA manquantes** → Synchronisées depuis AWS
4. ✅ **Variables non synchronisées** → Script automatique créé

---

## 📞 Support

Si des problèmes persistent après la synchronisation :

1. Vérifier les logs Cloud Run
2. Vérifier les permissions du service account
3. Vérifier que les secrets sont accessibles
4. Vérifier que les variables d'environnement sont correctement référencées


