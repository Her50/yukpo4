# 🔧 Correction Erreur "Empty Host" Cloud Run

**Date** : 2026-02-16  
**Erreur** : `Error: Configuration(EmptyHost)` lors du démarrage Cloud Run

---

## 🔍 Diagnostic

D'après les logs Cloud Run :
```
Error: Configuration(EmptyHost)
❌ ERREUR CRITIQUE: Impossible de se connecter à PostgreSQL après 3 tentatives: error with configuration: empty host
DATABASE_URL: postgresql://yukpo_user:MTeInD(Vw)b@/yukpo_db?host... (tronquée)
```

**Cause** : La `DATABASE_URL` dans le secret GitHub `GCP_DATABASE_URL` n'est pas au format correct pour Cloud SQL Unix socket.

---

## ✅ Solution

### 1. Format DATABASE_URL Correct pour Cloud SQL

Le format doit être :
```
postgresql://yukpo_user:MTeInD(Vw)b$C3Np479P@/yukpo_db?host=/cloudsql/yukpo-project:europe-west1:yukpo-postgres
```

**Important** :
- ✅ Format : `postgresql://user:password@/database?host=/cloudsql/PROJECT:REGION:INSTANCE`
- ✅ Pas de `host:port` après `@`
- ✅ Connection name : `yukpo-project:europe-west1:yukpo-postgres`
- ✅ Mot de passe : `MTeInD(Vw)b$C3Np479P` (échapper `$` si nécessaire)

### 2. Mettre à Jour le Secret GitHub

**Action requise** : Mettre à jour le secret `GCP_DATABASE_URL` dans GitHub :

1. Aller sur : https://github.com/Her50/yukpo4/settings/secrets/actions
2. Trouver `GCP_DATABASE_URL`
3. Mettre à jour avec :
   ```
   postgresql://yukpo_user:MTeInD(Vw)b$C3Np479P@/yukpo_db?host=/cloudsql/yukpo-project:europe-west1:yukpo-postgres
   ```

**Note** : Si le `$` cause des problèmes, échapper avec `\$` :
```
postgresql://yukpo_user:MTeInD(Vw)b\$C3Np479P@/yukpo_db?host=/cloudsql/yukpo-project:europe-west1:yukpo-postgres
```

### 3. Corrections Appliquées au Workflow

**Fichier** : `.github/workflows/gcp-deploy.yml`

**Changements** :
- ✅ Ajout de `CLOUD_RUN=true` (CRITIQUE pour connexion non-bloquante)
- ✅ Ajout de `PORT=8080`, `HOST=0.0.0.0`, `RUST_LOG=info`, `APP_ENV=production`
- ✅ Augmentation mémoire : `512Mi` → `1Gi`
- ✅ Augmentation CPU : `1` → `2`
- ✅ Augmentation timeout : `300` → `900` (15 minutes)
- ✅ Ajout `--startup-timeout 600` (10 minutes)
- ✅ Ajout `--cpu-throttling` et `--startup-cpu-boost`

---

## 📋 Vérifications

### 1. Vérifier le Format DATABASE_URL

```bash
# Vérifier que le secret contient le bon format
gcloud secrets versions access latest --secret="GCP_DATABASE_URL" --project=yukpo-project
```

### 2. Vérifier les Variables d'Environnement Cloud Run

```bash
gcloud run services describe yukpo-backend \
  --region=europe-west1 \
  --format="get(spec.template.spec.containers[0].env)" \
  --project=yukpo-project
```

**Doit contenir** :
- ✅ `CLOUD_RUN=true`
- ✅ `DATABASE_URL` avec format Unix socket
- ✅ `PORT=8080`
- ✅ `ENABLE_AUTO_MIGRATIONS=true`

### 3. Vérifier Cloud SQL Instance

```bash
gcloud run services describe yukpo-backend \
  --region=europe-west1 \
  --format="get(spec.template.spec.containers[0].cloudSqlInstances)" \
  --project=yukpo-project
```

**Doit contenir** :
- ✅ `yukpo-project:europe-west1:yukpo-postgres`

---

## 🚀 Prochaines Étapes

1. ✅ Mettre à jour le secret `GCP_DATABASE_URL` dans GitHub
2. ✅ Le workflow GitHub Actions va se déclencher automatiquement au prochain push
3. ✅ Le déploiement devrait maintenant réussir

---

## 🔗 Références

- [Format Cloud SQL Unix Socket](https://cloud.google.com/sql/docs/postgres/connect-run)
- [Code de parsing Cloud SQL](backend/src/main.rs:254-310)
- [Documentation Cloud Run Timeout](https://cloud.google.com/run/docs/configuring/timeouts)

