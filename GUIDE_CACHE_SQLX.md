# 📦 Guide du Cache SQLx

**Date** : 2026-02-16  
**Mode** : `SQLX_OFFLINE=true`

---

## 🔍 Comment ça fonctionne ?

### Avec `SQLX_OFFLINE=true`

1. **Pendant la compilation** :
   - Rust utilise le cache `.sqlx/` pour vérifier les requêtes SQL
   - Chaque requête doit avoir un fichier correspondant dans `.sqlx/`
   - Si une requête n'est pas dans le cache → **erreur de compilation**

2. **Au runtime** :
   - Le cache n'est **PAS utilisé**
   - L'application se connecte directement à la base de données
   - Les requêtes SQL sont exécutées normalement

### Avec `SQLX_OFFLINE=false`

1. **Pendant la compilation** :
   - Rust se connecte à la base de données pour vérifier les requêtes
   - Nécessite une connexion DB active pendant le build
   - Génère automatiquement le cache si absent

2. **Au runtime** :
   - Identique à `SQLX_OFFLINE=true`

---

## ✅ Quand régénérer le cache ?

### ⚠️ **OBLIGATOIRE** quand :

1. **Nouvelle requête SQL ajoutée** :
   ```rust
   // Nouvelle requête dans le code
   sqlx::query!("SELECT * FROM users WHERE id = $1", user_id)
   ```
   → Régénérer le cache

2. **Requête SQL modifiée** :
   ```rust
   // Modification d'une requête existante
   sqlx::query!("SELECT name, email FROM users WHERE id = $1", user_id)
   ```
   → Régénérer le cache

3. **Schéma de la base de données changé** :
   - Nouvelle table créée
   - Colonne ajoutée/supprimée
   - Index modifié
   → Régénérer le cache

4. **Migration SQL appliquée** :
   - Après `sqlx migrate run`
   → Régénérer le cache

### ✅ **PAS nécessaire** quand :

1. **Modification de logique métier** (pas de changement SQL)
2. **Modification de routes/controllers** (pas de changement SQL)
3. **Modification de tests** (pas de changement SQL)
4. **Déploiement uniquement** (cache déjà présent)

---

## 🔧 Comment régénérer le cache ?

### Méthode 1 : Script PowerShell (Recommandé)

```powershell
.\backend\generate-sqlx-cache.ps1
```

**Ou avec paramètres** :
```powershell
.\backend\generate-sqlx-cache.ps1 -DatabaseUrl "postgresql://..." -UserPassword "mot_de_passe"
```

### Méthode 2 : Commande manuelle

```bash
cd backend
$env:SQLX_OFFLINE = "false"
$env:DATABASE_URL = "postgresql://yukpo_user:mot_de_passe@/yukpo_db?host=/cloudsql/yukpo-project:europe-west1:yukpo-postgres"
cargo sqlx prepare --workspace -- --lib
$env:SQLX_OFFLINE = "true"
```

### Méthode 3 : Via Docker (si DB accessible)

```bash
docker run --rm \
  -v $(pwd):/app \
  -w /app/backend \
  -e DATABASE_URL="postgresql://..." \
  -e SQLX_OFFLINE=false \
  rust:latest \
  cargo sqlx prepare --workspace -- --lib
```

---

## 📋 Vérification du cache

### Vérifier si le cache est présent

```powershell
# Compter les fichiers dans .sqlx/
Get-ChildItem -Path "backend/.sqlx" -File | Measure-Object
```

**Attendu** : ~20-30 fichiers (selon le nombre de requêtes)

### Vérifier si une requête est dans le cache

```powershell
# Chercher un hash de requête spécifique
Get-ChildItem -Path "backend/.sqlx" -Filter "query-*.json"
```

### Vérifier les erreurs de compilation

Si vous voyez :
```
error: SQLX_OFFLINE=true but there is no cached data for this query
```

→ Le cache doit être régénéré

---

## 🚀 Workflow recommandé

### Développement local

1. **Modifier le code** (ajouter/modifier requêtes SQL)
2. **Régénérer le cache** :
   ```powershell
   .\backend\generate-sqlx-cache.ps1
   ```
3. **Compiler** :
   ```bash
   cargo build
   ```
4. **Tester** :
   ```bash
   cargo test
   ```

### Avant commit

1. **Vérifier que le cache est à jour** :
   ```bash
   cargo check
   ```
2. **Si erreurs** → Régénérer le cache
3. **Commit** le cache avec le code :
   ```bash
   git add backend/.sqlx/
   git commit -m "feat: add new query + update SQLx cache"
   ```

### Déploiement CI/CD

1. **Le cache est dans le repo** (commité)
2. **Build Docker** copie le cache :
   ```dockerfile
   COPY backend/.sqlx ./.sqlx
   ```
3. **Compilation** utilise le cache (pas besoin de DB)
4. **Runtime** se connecte à la DB (cache non utilisé)

---

## ⚠️ Problèmes courants

### Erreur : "no cached data for this query"

**Cause** : Nouvelle requête ajoutée sans régénérer le cache

**Solution** :
```powershell
.\backend\generate-sqlx-cache.ps1
```

### Erreur : "type annotations needed"

**Cause** : Cache obsolète ou requête modifiée

**Solution** :
```powershell
.\backend\generate-sqlx-cache.ps1
```

### Erreur : "password authentication failed" pendant `cargo sqlx prepare`

**Cause** : Mauvais mot de passe dans `DATABASE_URL`

**Solution** : Vérifier le mot de passe dans Cloud SQL et mettre à jour `DATABASE_URL`

---

## 📝 Résumé

| Situation | Cache nécessaire ? | Régénérer ? |
|-----------|-------------------|-------------|
| Nouvelle requête SQL | ✅ Oui | ✅ Oui |
| Modification requête | ✅ Oui | ✅ Oui |
| Migration appliquée | ✅ Oui | ✅ Oui |
| Modification logique (pas SQL) | ❌ Non | ❌ Non |
| Déploiement (cache présent) | ✅ Oui | ❌ Non |
| Runtime (exécution) | ❌ Non | ❌ Non |

---

## 🔗 Références

- **Documentation SQLx** : https://docs.rs/sqlx/latest/sqlx/
- **SQLx Offline Mode** : https://github.com/launchbadge/sqlx/blob/main/sqlx-cli/README.md#offline-mode
- **Script de génération** : `backend/generate-sqlx-cache.ps1`


