# 📚 Clarification : Bases de Données GCP Cloud SQL

**Date**: 2026-02-16  
**Objectif**: Éviter la confusion entre les différentes bases de données

---

## 🗄️ Instance Cloud SQL

**Instance unique** : `yukpo-postgres`
- **Nom** : `yukpo-postgres`
- **Version** : PostgreSQL 15
- **Région** : `europe-west1-d`
- **IP Publique** : `34.79.199.41`
- **Connection Name** : `yukpo-project:europe-west1:yukpo-postgres`
- **Statut** : ✅ RUNNABLE

---

## 📊 Bases de Données dans l'Instance

L'instance Cloud SQL `yukpo-postgres` peut contenir **plusieurs bases de données**. Voici les bases identifiées :

### 1. 🟢 `yukpo_postgres` - BASE PRINCIPALE (ACTUELLE)

**Statut** : ✅ **BASE ACTIVE - À UTILISER**

**Utilisation** :
- Base de données principale pour l'application Yukpomnang
- Utilisée pour le cache SQLx
- Base de production

**DATABASE_URL Format** :
```bash
# Format IP Publique
postgresql://yukpo_user:PASSWORD@34.79.199.41:5432/yukpo_postgres?sslmode=require

# Format Unix Socket (recommandé)
postgresql://yukpo_user:PASSWORD@/yukpo_postgres?host=/cloudsql/yukpo-project:europe-west1:yukpo-postgres
```

**Variables d'environnement** :
- `DATABASE_URL` → doit pointer vers `yukpo_postgres`
- `GCP_DATABASE_URL` (GitHub Secret) → doit pointer vers `yukpo_postgres`

**Où l'utiliser** :
- ✅ Backend Rust (production)
- ✅ Cache SQLx (`cargo sqlx prepare`)
- ✅ Migrations SQLx

---

### 2. 🟡 `yukpo_db` - BASE ANCIENNE (OBSOLÈTE ?)

**Statut** : ⚠️ **BASE ANCIENNE - À VÉRIFIER**

**Utilisation** :
- Base de données créée initialement
- Peut être obsolète ou utilisée pour des tests

**DATABASE_URL Format** :
```bash
# Format IP Publique
postgresql://yukpo_user:PASSWORD@34.79.199.41:5432/yukpo_db?sslmode=require

# Format Unix Socket
postgresql://yukpo_user:PASSWORD@/yukpo_db?host=/cloudsql/yukpo-project:europe-west1:yukpo-postgres
```

**Où elle apparaît** :
- Documentation ancienne
- Scripts de migration
- Configuration initiale

**Action requise** :
- ⚠️ Vérifier si cette base est encore utilisée
- ⚠️ Si obsolète, documenter et éventuellement supprimer

---

## 🔍 Comment Vérifier les Bases de Données

### Option 1: Via gcloud CLI

```bash
# Lister toutes les bases de données dans l'instance
gcloud sql databases list \
  --instance=yukpo-postgres \
  --project=yukpo-project
```

### Option 2: Via psql

```bash
# Se connecter à l'instance
psql -h 34.79.199.41 -U yukpo_user -d postgres

# Lister les bases de données
\l

# Vérifier la taille de chaque base
SELECT 
    datname,
    pg_size_pretty(pg_database_size(datname)) as size
FROM pg_database
WHERE datname IN ('yukpo_postgres', 'yukpo_db')
ORDER BY datname;
```

### Option 3: Via Backend Rust

```rust
// Dans le backend, exécuter :
SELECT datname FROM pg_database 
WHERE datname IN ('yukpo_postgres', 'yukpo_db');
```

---

## ✅ Recommandations pour Éviter la Confusion

### 1. Standardiser sur `yukpo_postgres`

**Action** : Utiliser **uniquement** `yukpo_postgres` comme base de données principale.

**Avantages** :
- Nom clair et explicite
- Évite la confusion avec l'instance `yukpo-postgres`
- Facilite la maintenance

### 2. Documenter dans le Code

**Ajouter des commentaires** dans les fichiers de configuration :

```rust
// backend/src/main.rs
// DATABASE_URL doit pointer vers la base 'yukpo_postgres' dans l'instance Cloud SQL 'yukpo-postgres'
// Format: postgresql://user:pass@host:port/yukpo_postgres?sslmode=require
let db_url = env::var("DATABASE_URL")
    .expect("DATABASE_URL must point to yukpo_postgres database");
```

### 3. Créer un Alias/Constante

**Dans le code Rust** :

```rust
// backend/src/config/database.rs
pub const DATABASE_NAME: &str = "yukpo_postgres";
pub const INSTANCE_NAME: &str = "yukpo-postgres";
pub const CONNECTION_NAME: &str = "yukpo-project:europe-west1:yukpo-postgres";
```

### 4. Mettre à Jour la Documentation

**Fichiers à mettre à jour** :
- ✅ `CORRECTION_BUILD_SQLX.md` → utilise `yukpo_postgres` ✅
- ⚠️ `MIGRATION_CLOUD_SQL_FINALE.md` → mentionne `yukpo_db` (à mettre à jour)
- ⚠️ `VERIFICATION_FINALE_CLOUD_SQL.md` → mentionne `yukpo_db` (à mettre à jour)
- ⚠️ Autres fichiers de documentation

### 5. Renommer ou Supprimer `yukpo_db`

**Si `yukpo_db` est obsolète** :

```bash
# Option A: Renommer pour clarifier
psql -h 34.79.199.41 -U yukpo_user -d postgres -c \
  "ALTER DATABASE yukpo_db RENAME TO yukpo_db_old_backup;"

# Option B: Supprimer (ATTENTION: sauvegarder d'abord!)
# psql -h 34.79.199.41 -U yukpo_user -d postgres -c \
#   "DROP DATABASE yukpo_db;"
```

---

## 📋 Checklist de Vérification

### Étape 1: Identifier les Bases Existantes

- [ ] Lister toutes les bases dans l'instance `yukpo-postgres`
- [ ] Vérifier la taille de chaque base
- [ ] Vérifier la dernière utilisation de chaque base

### Étape 2: Standardiser la Configuration

- [ ] Mettre à jour `DATABASE_URL` pour utiliser `yukpo_postgres`
- [ ] Mettre à jour `GCP_DATABASE_URL` (GitHub Secret)
- [ ] Mettre à jour tous les scripts de déploiement
- [ ] Mettre à jour la documentation

### Étape 3: Nettoyer (si nécessaire)

- [ ] Sauvegarder `yukpo_db` si elle contient des données importantes
- [ ] Renommer ou supprimer `yukpo_db` si obsolète
- [ ] Documenter la décision

---

## 🎯 Convention de Nommage Recommandée

### Instance Cloud SQL
- **Nom** : `yukpo-postgres` (avec tiret)
- **Type** : Instance Cloud SQL PostgreSQL

### Base de Données
- **Nom** : `yukpo_postgres` (avec underscore)
- **Type** : Base de données PostgreSQL dans l'instance

### Utilisateur
- **Nom** : `yukpo_user`
- **Rôle** : Utilisateur principal de la base

### Format DATABASE_URL
```bash
# Format recommandé (Unix socket)
postgresql://yukpo_user:PASSWORD@/yukpo_postgres?host=/cloudsql/yukpo-project:europe-west1:yukpo-postgres

# Format alternatif (IP publique)
postgresql://yukpo_user:PASSWORD@34.79.199.41:5432/yukpo_postgres?sslmode=require
```

---

## 📝 Résumé

| Élément | Nom | Type | Statut |
|---------|-----|------|--------|
| **Instance Cloud SQL** | `yukpo-postgres` | Instance GCP | ✅ Active |
| **Base de données principale** | `yukpo_postgres` | Base PostgreSQL | ✅ À utiliser |
| **Base de données ancienne** | `yukpo_db` | Base PostgreSQL | ⚠️ À vérifier |
| **Utilisateur** | `yukpo_user` | Utilisateur PostgreSQL | ✅ Actif |

---

## 🚀 Actions Immédiates

1. **Vérifier les bases existantes** :
   ```bash
   gcloud sql databases list --instance=yukpo-postgres --project=yukpo-project
   ```

2. **Standardiser sur `yukpo_postgres`** dans tous les fichiers de configuration

3. **Mettre à jour la documentation** pour refléter la base correcte

4. **Générer le cache SQLx** avec la bonne base :
   ```powershell
   $env:DATABASE_URL = "postgresql://yukpo_user:PASSWORD@34.79.199.41:5432/yukpo_postgres?sslmode=require"
   cargo sqlx prepare --workspace -- --lib
   ```

---

**Date de mise à jour** : 2026-02-16  
**Dernière vérification** : À faire

