# 🔍 Pourquoi les erreurs apparaissent la nuit dans Git mais pas lors des builds locaux ?

## 📋 Le Problème

Vous observez que :
- ✅ Les builds locaux (`cargo build`, `cargo clippy`) fonctionnent sans erreur
- ❌ Les builds CI/CD (GitHub Actions) détectent des erreurs toutes les nuits à 2h du matin
- 🤔 Pourquoi cette différence ?

## 🔎 Analyse du Workflow CI

D'après `.github/workflows/ci.yml`, le workflow s'exécute :
- **Toutes les nuits à 2h du matin** : `cron: "0 2 * * *"`
- **Sur des environnements propres** : Ubuntu + Windows (pas de cache local)
- **Avec des flags stricts** : `cargo clippy --all-targets -- -D warnings`

### Différences Clés entre Local et CI

| Aspect | Build Local | Build CI/CD |
|--------|-------------|-------------|
| **Clippy** | `cargo clippy` (warnings seulement) | `cargo clippy --all-targets -- -D warnings` (warnings = erreurs) |
| **SQLx** | Peut utiliser `.sqlx/` ou `sqlx-data.json` si présents | `SQLX_OFFLINE=true` mais vérifie les fichiers |
| **Base de données** | Peut être accessible localement | Pas accessible (utilise `DATABASE_URL_OFFLINE`) |
| **Environnement** | Cache Rust, fichiers préparés | Environnement propre, pas de cache |
| **Formatage** | `cargo fmt` peut être ignoré | `cargo fmt --check` strict |

## 🎯 Causes Principales

### 1. **Clippy Strict Mode (`-D warnings`)**

Le CI utilise `-- -D warnings` qui **traite tous les warnings comme des erreurs** :

```yaml
- name: Cargo clippy
  run: cargo clippy --all-targets -- -D warnings
```

**Localement**, vous exécutez probablement :
```bash
cargo clippy  # Affiche les warnings mais ne bloque pas
```

**Solution** : Exécuter localement avec les mêmes flags :
```bash
cd backend
cargo clippy --all-targets -- -D warnings
```

### 2. **SQLx Offline Mode**

Le CI utilise `SQLX_OFFLINE=true` mais **vérifie quand même** si les fichiers de métadonnées existent :

```yaml
env:
  SQLX_OFFLINE: "true"
  DATABASE_URL: ${{ secrets.DATABASE_URL_OFFLINE }}
```

**Problème** : Si `sqlx-data.json` ou `.sqlx/` n'existent pas, sqlx essaie quand même de vérifier les requêtes.

**Solution** : Générer les fichiers sqlx préparés :
```bash
cd backend
# Avec une base de données accessible
export DATABASE_URL="postgres://user:pass@localhost/yukpomnang"
cargo sqlx prepare -- --lib
# Puis commiter sqlx-data.json ou .sqlx/
```

### 3. **Formatage Automatique**

Le workflow CI exécute `cargo fmt` toutes les nuits et **crée un commit automatique** si des changements sont détectés :

```yaml
- name: Format Rust code (auto-fix on schedule)
  if: github.event_name == 'schedule'
  run: |
    cargo fmt
    if ! git diff --exit-code; then
      git commit -m "chore: formatage automatique du code Rust [skip ci]"
      git push
    fi
```

**Solution** : Formater le code avant de commiter :
```bash
cd backend
cargo fmt
```

### 4. **Environnement Propre**

Le CI s'exécute sur des **environnements propres** sans cache ni fichiers préparés, ce qui peut révéler des problèmes cachés par le cache local.

## ✅ Solutions Recommandées

### Solution 1 : Aligner les Builds Locaux avec CI

Créer un script `scripts/check-ci-local.sh` :

```bash
#!/bin/bash
set -e

cd backend

echo "🔍 Vérification formatage..."
cargo fmt -- --check

echo "🔍 Vérification clippy (strict)..."
cargo clippy --all-targets -- -D warnings

echo "🔍 Vérification build..."
cargo build --release --locked

echo "✅ Toutes les vérifications CI passent localement !"
```

### Solution 2 : Pré-commit Hooks

Installer des hooks Git pour vérifier avant chaque commit :

```bash
# Installer pre-commit
pip install pre-commit

# Créer .pre-commit-config.yaml
```

### Solution 3 : Générer sqlx-data.json

Générer et commiter les fichiers sqlx préparés :

```bash
cd backend
# Avec DATABASE_URL configuré
cargo sqlx prepare -- --lib
git add sqlx-data.json .sqlx/
git commit -m "chore: ajouter métadonnées sqlx préparées"
```

### Solution 4 : Script de Vérification Locale

Créer `scripts/check-before-push.sh` :

```bash
#!/bin/bash
set -e

echo "🔍 Vérification avant push..."

cd backend

# Formatage
echo "📝 Vérification formatage..."
cargo fmt -- --check || {
    echo "❌ Formatage incorrect. Exécutez: cargo fmt"
    exit 1
}

# Clippy strict
echo "🔍 Vérification clippy (strict)..."
cargo clippy --all-targets -- -D warnings || {
    echo "❌ Erreurs clippy détectées"
    exit 1
}

# Build
echo "🔨 Vérification build..."
cargo build --release --locked || {
    echo "❌ Erreurs de build détectées"
    exit 1
}

echo "✅ Toutes les vérifications passent !"
```

## 🚀 Actions Immédiates

1. **Vérifier localement avec les mêmes flags que CI** :
   ```bash
   cd backend
   cargo clippy --all-targets -- -D warnings
   ```

2. **Formater le code** :
   ```bash
   cd backend
   cargo fmt
   ```

3. **Générer sqlx-data.json** (si base accessible) :
   ```bash
   cd backend
   cargo sqlx prepare -- --lib
   git add sqlx-data.json
   ```

4. **Vérifier les erreurs sqlx** :
   - Si la base n'est pas accessible, c'est normal que sqlx échoue
   - Utiliser `SQLX_OFFLINE=true` et commiter `sqlx-data.json`

## 📝 Note sur les Erreurs SQLx

Les erreurs sqlx (`error communicating with database`) sont **normales** si :
- La base de données n'est pas accessible à la compilation
- Les fichiers `sqlx-data.json` ou `.sqlx/` n'existent pas

**Solution** : Utiliser le mode offline de sqlx :
```bash
export SQLX_OFFLINE=true
cargo build
```

Ou générer les métadonnées :
```bash
cargo sqlx prepare -- --lib
```

## 🎯 Résumé

Les erreurs apparaissent la nuit car :
1. Le CI utilise des **flags stricts** (`-D warnings`)
2. Le CI s'exécute sur des **environnements propres**
3. Le CI vérifie le **formatage automatiquement**
4. Le CI peut manquer les **fichiers sqlx préparés**

**Solution** : Aligner les builds locaux avec le CI en utilisant les mêmes flags et vérifications.

