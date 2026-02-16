# 🎯 Guide : Éviter la Confusion entre les Bases de Données GCP

**Date**: 2026-02-16  
**Objectif**: Guide pratique pour éviter de confondre les bases de données

---

## 🚨 Problème Identifié

Il existe une confusion entre :
- **Instance Cloud SQL** : `yukpo-postgres` (avec tiret)
- **Base de données** : `yukpo_postgres` (avec underscore) ✅ **À UTILISER**
- **Base de données ancienne** : `yukpo_db` (avec underscore) ⚠️ **À VÉRIFIER**

---

## ✅ Solution : Convention de Nommage

### Règle d'Or

```
Instance Cloud SQL  →  yukpo-postgres  (avec TIRET)
Base de données     →  yukpo_postgres  (avec UNDERSCORE)
```

### Exemples Corrects

```bash
# ✅ CORRECT
Instance: yukpo-postgres
Base: yukpo_postgres
DATABASE_URL: postgresql://user:pass@host:port/yukpo_postgres

# ❌ INCORRECT (ne pas utiliser)
Base: yukpo-postgres  # ❌ Tiret au lieu d'underscore
Base: yukpo_db         # ❌ Nom différent
```

---

## 🔍 Comment Vérifier Rapidement

### 1. Script Automatique (Recommandé)

```powershell
.\scripts\verifier-bases-donnees-gcp.ps1
```

Le script va :
- ✅ Lister toutes les bases dans l'instance
- ✅ Identifier `yukpo_postgres` (base principale)
- ✅ Identifier `yukpo_db` (base ancienne)
- ✅ Vérifier votre DATABASE_URL si fournie

### 2. Commande gcloud

```bash
gcloud sql databases list \
  --instance=yukpo-postgres \
  --project=yukpo-project
```

### 3. Vérification dans le Code

**Chercher dans les fichiers** :
```powershell
# Chercher les références à yukpo_db (ancienne base)
grep -r "yukpo_db" backend/ --exclude-dir=target

# Chercher les références à yukpo_postgres (base correcte)
grep -r "yukpo_postgres" backend/ --exclude-dir=target
```

---

## 📋 Checklist Avant Chaque Opération

### Avant de Générer le Cache SQLx

- [ ] Vérifier que DATABASE_URL pointe vers `yukpo_postgres`
- [ ] Vérifier la connexion : `cargo sqlx database create`
- [ ] Générer le cache : `cargo sqlx prepare --workspace -- --lib`

### Avant un Déploiement

- [ ] Vérifier `GCP_DATABASE_URL` (GitHub Secret) → doit contenir `yukpo_postgres`
- [ ] Vérifier les variables d'environnement Cloud Run
- [ ] Tester la connexion en local

### Avant une Migration

- [ ] Identifier la base cible : `yukpo_postgres` ✅
- [ ] Sauvegarder la base avant migration
- [ ] Vérifier que les scripts pointent vers la bonne base

---

## 🛠️ Outils Pratiques

### 1. Script de Vérification

```powershell
# Vérifier toutes les bases
.\scripts\verifier-bases-donnees-gcp.ps1

# Avec DATABASE_URL
$env:DATABASE_URL = "postgresql://..."
.\scripts\verifier-bases-donnees-gcp.ps1 -DatabaseUrl $env:DATABASE_URL
```

### 2. Alias PowerShell (Optionnel)

Ajouter dans votre `$PROFILE` :

```powershell
# Alias pour vérifier les bases
function Check-YukpoDatabases {
    .\scripts\verifier-bases-donnees-gcp.ps1
}

# Alias pour générer le cache SQLx
function Generate-SqlxCache {
    cd backend
    .\generate-sqlx-cache.ps1
}
```

### 3. Template DATABASE_URL

```bash
# Template pour yukpo_postgres (base principale)
postgresql://yukpo_user:PASSWORD@34.79.199.41:5432/yukpo_postgres?sslmode=require

# Template Unix socket
postgresql://yukpo_user:PASSWORD@/yukpo_postgres?host=/cloudsql/yukpo-project:europe-west1:yukpo-postgres
```

---

## 📝 Documentation à Mettre à Jour

Fichiers qui mentionnent `yukpo_db` (à vérifier/mettre à jour) :

- [ ] `MIGRATION_CLOUD_SQL_FINALE.md`
- [ ] `VERIFICATION_FINALE_CLOUD_SQL.md`
- [ ] `backend/src/bin/verify_indexes.rs` (valeur par défaut)
- [ ] `backend/cleanup_ghost_embeddings.rs` (valeur par défaut)
- [ ] `backend/check_services.rs` (valeur par défaut)
- [ ] Autres fichiers de configuration

**Action** : Remplacer `yukpo_db` par `yukpo_postgres` dans ces fichiers.

---

## 🎯 Règles à Suivre

### ✅ À FAIRE

1. **Toujours utiliser `yukpo_postgres`** comme nom de base
2. **Vérifier avant chaque opération** avec le script
3. **Documenter les changements** dans les commits
4. **Utiliser des constantes** dans le code Rust

### ❌ À ÉVITER

1. ❌ Ne pas utiliser `yukpo_db` (base ancienne)
2. ❌ Ne pas confondre instance (`yukpo-postgres`) et base (`yukpo_postgres`)
3. ❌ Ne pas hardcoder les noms de base dans le code
4. ❌ Ne pas oublier de vérifier avant un déploiement

---

## 🔧 Exemple d'Implémentation dans le Code

### Fichier de Configuration

```rust
// backend/src/config/database.rs

pub const DATABASE_NAME: &str = "yukpo_postgres";
pub const INSTANCE_NAME: &str = "yukpo-postgres";
pub const CONNECTION_NAME: &str = "yukpo-project:europe-west1:yukpo-postgres";

pub fn build_database_url(
    user: &str,
    password: &str,
    host: &str,
    port: u16,
) -> String {
    format!(
        "postgresql://{}:{}@{}:{}/{}?sslmode=require",
        user, password, host, port, DATABASE_NAME
    )
}
```

### Utilisation

```rust
// backend/src/main.rs
use crate::config::database::{DATABASE_NAME, build_database_url};

let db_url = env::var("DATABASE_URL")
    .unwrap_or_else(|_| {
        // Fallback avec la bonne base
        build_database_url("yukpo_user", "password", "34.79.199.41", 5432)
    });

// Vérification
assert!(db_url.contains(DATABASE_NAME), 
    "DATABASE_URL must point to {}", DATABASE_NAME);
```

---

## 📊 Tableau Récapitulatif

| Élément | Nom | Format | Exemple | Statut |
|---------|-----|--------|---------|--------|
| **Instance** | `yukpo-postgres` | Tiret | `yukpo-postgres` | ✅ Active |
| **Base principale** | `yukpo_postgres` | Underscore | `yukpo_postgres` | ✅ À utiliser |
| **Base ancienne** | `yukpo_db` | Underscore | `yukpo_db` | ⚠️ À vérifier |
| **Utilisateur** | `yukpo_user` | Underscore | `yukpo_user` | ✅ Actif |

---

## 🚀 Actions Immédiates

1. **Exécuter le script de vérification** :
   ```powershell
   .\scripts\verifier-bases-donnees-gcp.ps1
   ```

2. **Vérifier votre DATABASE_URL** :
   ```powershell
   $env:DATABASE_URL  # Doit contenir yukpo_postgres
   ```

3. **Mettre à jour la documentation** si nécessaire

4. **Générer le cache SQLx** avec la bonne base :
   ```powershell
   cd backend
   .\generate-sqlx-cache.ps1
   ```

---

**Rappel** : Toujours utiliser `yukpo_postgres` (avec underscore) comme nom de base de données ! ✅

