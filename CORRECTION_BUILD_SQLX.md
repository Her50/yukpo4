# 🔧 Correction Erreurs Build SQLx

**Date**: 2026-02-16  
**Problème**: Build Docker échoue avec erreurs SQLx cache manquant

---

## ❌ Erreurs de Build

```
error: `SQLX_OFFLINE=true` but there is no cached data for this query
  --> src/services/prestataire_service.rs:24:18
```

**Cause**: Le répertoire `.sqlx/` est vide (0 fichiers). SQLx ne peut pas compiler les requêtes en mode offline.

---

## ✅ Solution

### 1. Générer le Cache SQLx

**Base de données**: `yukpo_postgres` (confirmé par l'utilisateur)

**Option A: Script automatique** (recommandé)
```powershell
cd backend
.\generate-sqlx-cache.ps1
```

Le script vous demandera la DATABASE_URL si elle n'est pas définie.

**Option B: Manuel**
```powershell
cd backend
$env:SQLX_OFFLINE = "false"
$env:DATABASE_URL = "postgresql://USER:PASSWORD@HOST:PORT/yukpo_postgres?sslmode=require"
cargo sqlx prepare --workspace -- --lib
```

### 2. Format DATABASE_URL

**Pour GCP Cloud SQL (IP publique)**:
```
postgresql://yukpo_user:PASSWORD@34.79.199.41:5432/yukpo_postgres?sslmode=require
```

**Pour GCP Cloud SQL (Unix socket)**:
```
postgresql://yukpo_user:PASSWORD@/yukpo_postgres?host=/cloudsql/yukpo-project:europe-west1:yukpo-postgres
```

### 3. Vérifier le Cache Généré

```powershell
cd backend
Get-ChildItem -Path .sqlx -Recurse -File | Measure-Object | Select-Object -ExpandProperty Count
```

**Attendu**: > 200 fichiers

### 4. Commiter le Cache

```powershell
git add backend/.sqlx/
git commit -m "chore: update SQLx cache for yukpo_postgres database"
```

### 5. Vérifier le Dockerfile

Le `Dockerfile.cloud.optimized` copie déjà `.sqlx` avant le code source (ligne 34):
```dockerfile
COPY .sqlx ./.sqlx
```

✅ **Le Dockerfile est correct**, il faut juste générer le cache.

---

## 📋 Checklist

- [ ] DATABASE_URL configurée avec base `yukpo_postgres`
- [ ] Cache SQLx généré (`cargo sqlx prepare`)
- [ ] Cache contient > 200 fichiers
- [ ] Cache committé dans Git
- [ ] Build Docker testé localement (optionnel)

---

## 🔍 Vérification Base de Données

**Nom de la base**: `yukpo_postgres` ✅ (confirmé par l'utilisateur)

**Instance Cloud SQL**: `yukpo-postgres`
- IP Publique: `34.79.199.41`
- Connection Name: `yukpo-project:europe-west1:yukpo-postgres`

**Utilisateur**: À confirmer (`yukpo_user` ou `yukpo_admin`)

**Mot de passe**: À fournir par l'utilisateur

---

## 🚀 Après Génération du Cache

1. **Vérifier**:
   ```powershell
   cd backend
   (Get-ChildItem -Path .sqlx -Recurse -File).Count
   ```

2. **Commiter**:
   ```powershell
   git add backend/.sqlx/
   git commit -m "chore: regenerate SQLx cache for yukpo_postgres"
   git push
   ```

3. **Le build Docker devrait maintenant fonctionner** ✅

---

**Note**: Le cache SQLx doit être généré avec une connexion active à la base de données. Si vous n'avez pas accès à la base, vous pouvez :
- Utiliser une base locale pour générer le cache
- Ou demander à quelqu'un avec accès de générer le cache

