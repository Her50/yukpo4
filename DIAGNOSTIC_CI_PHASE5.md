# 🔍 Diagnostic CI - Phase 5 Yukpo - Jobs Backend Rust Échoués

## 📋 Résumé du problème

**Dépôt CI** : `Her50/yukpo4`  
**Workflow** : Phase 5 de Yukpo CI  
**Jobs échoués** :
- ❌ Backend Rust (Windows-latest) - **Annulé**
- ❌ Backend Rust (ubuntu-latest) - **Échec**

## 🔎 Causes probables

### 1. **Cache SQLx manquant ou obsolète** ⚠️ CRITIQUE

Le projet utilise `SQLX_OFFLINE=true` mais le cache `.sqlx/` pourrait être :
- ❌ Absent du dépôt CI
- ❌ Non commité dans le repo
- ❌ Obsolète (requêtes SQL modifiées sans régénération)

**Symptômes** :
```
error: SQLX_OFFLINE=true but no cached data for query
error: could not find query metadata
```

### 2. **Variables d'environnement manquantes**

Le workflow CI pourrait manquer :
- `SQLX_OFFLINE=true`
- `DATABASE_URL` (même si offline, certaines vérifications peuvent l'exiger)
- Variables de build Rust (`RUSTFLAGS`, etc.)

### 3. **Dépendances système manquantes**

Sur Windows et Ubuntu, il peut manquer :
- `libpq-dev` / `libpq` (PostgreSQL)
- `pkg-config`
- `libssl-dev` / `openssl`
- `clang` / `build-essential`

### 4. **Timeouts ou limites de ressources**

- Compilation Rust trop longue
- Mémoire insuffisante
- Disque plein

### 5. **Problèmes de permissions ou de sécurité**

- Permissions d'écriture insuffisantes
- Restrictions de sécurité GitHub Actions

## ✅ Solutions recommandées

### Solution 1 : Vérifier et régénérer le cache SQLx

#### Étape 1 : Vérifier localement

```bash
cd backend

# Vérifier si .sqlx existe
if [ -d ".sqlx" ]; then
    echo "✅ Cache .sqlx présent"
    find .sqlx -type f | wc -l
else
    echo "❌ Cache .sqlx manquant"
fi
```

#### Étape 2 : Régénérer le cache (si base de données disponible)

```bash
cd backend

# 1. S'assurer que DATABASE_URL est configuré
export DATABASE_URL="postgresql://user:password@host:5432/dbname"

# 2. Appliquer toutes les migrations
sqlx migrate run

# 3. Régénérer le cache SQLx
cargo sqlx prepare --workspace

# 4. Vérifier que les fichiers sont créés
ls -la .sqlx/ | head -20
```

#### Étape 3 : Commiter le cache dans le repo CI

```bash
# Dans le dépôt Her50/yukpo4
git add backend/.sqlx/
git commit -m "chore: update sqlx cache for Phase 5"
git push
```

### Solution 2 : Créer/Corriger le workflow GitHub Actions

Créer ou mettre à jour `.github/workflows/ci-phase5.yml` :

```yaml
name: Phase 5 de Yukpo CI

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

env:
  SQLX_OFFLINE: true
  CARGO_TERM_COLOR: always

jobs:
  backend-windows:
    name: Interface de sécurité / Backend de Yukpo Phase 5 (Rust)
    runs-on: windows-latest
    timeout-minutes: 30
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Install Rust
        uses: actions-rs/toolchain@v1
        with:
          toolchain: stable
          override: true
          components: rustfmt, clippy
      
      - name: Install PostgreSQL dependencies (Windows)
        run: |
          choco install postgresql --version=15.0 -y
          $env:Path += ";C:\Program Files\PostgreSQL\15\bin"
      
      - name: Verify SQLx cache
        working-directory: backend
        run: |
          if (Test-Path ".sqlx") {
            Write-Host "✅ Cache .sqlx présent"
            $count = (Get-ChildItem -Path ".sqlx" -Recurse -File).Count
            Write-Host "Nombre de fichiers: $count"
          } else {
            Write-Host "❌ ERREUR: Cache .sqlx manquant!"
            exit 1
          }
      
      - name: Build backend
        working-directory: backend
        run: |
          $env:SQLX_OFFLINE = "true"
          cargo build --release
      
      - name: Run tests
        working-directory: backend
        run: |
          $env:SQLX_OFFLINE = "true"
          cargo test --release --lib

  backend-ubuntu:
    name: Interface de sécurité / Backend de la phase 5 de Yukpo (Rust)
    runs-on: ubuntu-latest
    timeout-minutes: 30
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Install Rust
        uses: actions-rs/toolchain@v1
        with:
          toolchain: stable
          override: true
          components: rustfmt, clippy
      
      - name: Install system dependencies
        run: |
          sudo apt-get update
          sudo apt-get install -y \
            pkg-config \
            libssl-dev \
            libpq-dev \
            clang \
            build-essential
      
      - name: Verify SQLx cache
        working-directory: backend
        run: |
          if [ -d ".sqlx" ]; then
            echo "✅ Cache .sqlx présent"
            echo "Nombre de fichiers: $(find .sqlx -type f | wc -l)"
          else
            echo "❌ ERREUR: Cache .sqlx manquant!"
            exit 1
          fi
      
      - name: Build backend
        working-directory: backend
        env:
          SQLX_OFFLINE: true
        run: |
          cargo build --release
      
      - name: Run tests
        working-directory: backend
        env:
          SQLX_OFFLINE: true
        run: |
          cargo test --release --lib
      
      - name: Run clippy
        working-directory: backend
        run: |
          cargo clippy --release -- -D warnings
```

### Solution 3 : Script de vérification pré-CI

Créer `backend/scripts/verify-ci-readiness.sh` :

```bash
#!/bin/bash
# Script de vérification avant commit CI

set -e

echo "=== Vérification préparation CI ==="

# 1. Vérifier cache SQLx
if [ ! -d ".sqlx" ]; then
    echo "❌ ERREUR: Répertoire .sqlx manquant!"
    echo "   Exécutez: cargo sqlx prepare --workspace"
    exit 1
fi

CACHE_COUNT=$(find .sqlx -type f | wc -l)
if [ "$CACHE_COUNT" -eq 0 ]; then
    echo "❌ ERREUR: Cache .sqlx vide!"
    echo "   Exécutez: cargo sqlx prepare --workspace"
    exit 1
fi

echo "✅ Cache SQLx présent ($CACHE_COUNT fichiers)"

# 2. Vérifier compilation offline
echo "Test compilation offline..."
export SQLX_OFFLINE=true
if cargo check --quiet; then
    echo "✅ Compilation offline réussie"
else
    echo "❌ ERREUR: Compilation offline échoue!"
    echo "   Régénérez le cache: cargo sqlx prepare --workspace"
    exit 1
fi

# 3. Vérifier que .sqlx est dans .gitignore (ne devrait PAS l'être pour CI)
if grep -q "^\.sqlx$" .gitignore 2>/dev/null; then
    echo "⚠️  WARNING: .sqlx est dans .gitignore"
    echo "   Pour CI, .sqlx doit être commité"
fi

echo "=== Vérification terminée ==="
```

### Solution 4 : Alternative - Utiliser sqlx::query() au lieu de sqlx::query!()

Si le cache SQLx pose problème, convertir les macros `query!()` en `query()` :

**Avant** (nécessite cache) :
```rust
let user = sqlx::query!(
    "SELECT id, email FROM users WHERE id = $1",
    user_id
)
.fetch_one(pool)
.await?;
```

**Après** (pas besoin de cache) :
```rust
let row = sqlx::query(
    "SELECT id, email FROM users WHERE id = $1"
)
.bind(user_id)
.fetch_one(pool)
.await?;

let id: i32 = row.get("id");
let email: String = row.get("email");
```

## 🔧 Actions immédiates

### Pour le dépôt CI (Her50/yukpo4)

1. **Vérifier la présence de `.sqlx/` dans le repo**
   ```bash
   cd backend
   git ls-files .sqlx/
   ```

2. **Si absent, régénérer et commiter**
   ```bash
   # Sur machine avec accès DB
   cd backend
   export DATABASE_URL="..."
   sqlx migrate run
   cargo sqlx prepare --workspace
   git add .sqlx/
   git commit -m "chore: add sqlx cache for CI"
   git push
   ```

3. **Vérifier le workflow CI**
   - S'assurer que `SQLX_OFFLINE=true` est défini
   - Vérifier que les dépendances système sont installées
   - Augmenter le timeout si nécessaire

### Pour ce dépôt local (yukpomnang2)

1. **Vérifier l'état du cache SQLx**
   ```bash
   cd backend
   if [ -d ".sqlx" ]; then
       echo "Cache présent: $(find .sqlx -type f | wc -l) fichiers"
   else
       echo "Cache manquant - régénération nécessaire"
   fi
   ```

2. **Si besoin, régénérer localement**
   ```bash
   # Avec accès à la base Render
   export DATABASE_URL="postgresql://yukpo_db_user:88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4@dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com/yukpo_db"
   cd backend
   cargo sqlx prepare --workspace
   ```

## 📝 Checklist de résolution

- [ ] Vérifier présence de `.sqlx/` dans le dépôt CI
- [ ] Régénérer le cache SQLx si nécessaire
- [ ] Commiter le cache dans le repo CI
- [ ] Vérifier/corriger le workflow GitHub Actions
- [ ] S'assurer que `SQLX_OFFLINE=true` est défini dans le workflow
- [ ] Vérifier installation des dépendances système (libpq, openssl, etc.)
- [ ] Tester la compilation offline localement
- [ ] Augmenter timeout si compilation trop longue
- [ ] Vérifier les logs d'erreur détaillés dans GitHub Actions

## 🔗 Ressources

- [Documentation SQLx Offline Mode](https://github.com/launchbadge/sqlx/blob/main/FAQ.md#how-can-i-use-sqlx-without-a-database)
- [GitHub Actions Rust Setup](https://github.com/actions-rs/toolchain)
- [Guide SQLx du projet](./backend/SQLX_OFFLINE_MODE.md)

---

**Date** : 2025-01-12  
**Statut** : En attente de correction dans le dépôt CI

