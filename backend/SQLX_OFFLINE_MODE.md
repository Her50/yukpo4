# SQLx Offline Mode - Guide de Configuration

## 🎯 Contexte

Le projet utilise **SQLx en mode offline** (`SQLX_OFFLINE=true`) pour permettre la compilation sans accès à une base de données PostgreSQL.

## 📋 Deux approches SQLx dans le code

### 1. `sqlx::query!()` - Macro avec vérification (Anciens contrôleurs)

```rust
// ✅ Utilisé dans: auth_controller, service_controller, payment_controller
let user = sqlx::query!(
    r#"SELECT id, email, password_hash FROM users WHERE email = $1"#,
    email
)
.fetch_optional(db)
.await?;
```

**Avantages** :
- ✅ Vérification des types à la compilation
- ✅ Auto-complétion des champs
- ✅ Détection d'erreurs SQL avant runtime

**Inconvénients** :
- ❌ Nécessite métadonnées dans `.sqlx/`
- ❌ Tables doivent exister en local

### 2. `sqlx::query()` - Fonction sans vérification (Nouveaux contrôleurs)

```rust
// ✅ Utilisé dans: service_team_controller, signalement_controller, conversation_controller
let rows = sqlx::query(
    "SELECT id, email FROM users WHERE email = $1"
)
.bind(email)
.fetch_all(pool)
.await?;

// Récupération manuelle des valeurs
let id = row.get::<i32, _>("id");
let email = row.get::<String, _>("email");
```

**Avantages** :
- ✅ Pas besoin de métadonnées
- ✅ Fonctionne même si tables n'existent pas en local
- ✅ Compatible avec mode offline

**Inconvénients** :
- ❌ Pas de vérification à la compilation
- ❌ Erreurs détectées au runtime
- ❌ Plus verbeux (`.bind()` et `.get()`)

## 🗂️ Structure des métadonnées

```
backend/.sqlx/
├── query-02345e5507701cae1fc6eb0f1571bea8f5d86ef7740235f8223422e6e3a19292.json
├── query-032e3082897d6db55afe3cf70f6537aa62f767263e85f109059d3922ff249f0e.json
└── ... (93 fichiers au total)
```

Chaque fichier contient :
- La requête SQL
- Les types des colonnes
- Les types des paramètres
- Les métadonnées PostgreSQL

## 🔧 Générer les métadonnées (quand les tables existent)

### Prérequis
```bash
# Installer sqlx-cli
cargo install sqlx-cli --no-default-features --features postgres
```

### Étapes

1. **Configurer DATABASE_URL**
```bash
# .env
DATABASE_URL=postgresql://user:password@localhost:5432/yukpomnang
```

2. **Appliquer les migrations**
```bash
cd backend
sqlx migrate run
```

3. **Générer les métadonnées**
```bash
cargo sqlx prepare --workspace
```

4. **Commit les fichiers générés**
```bash
git add .sqlx/
git commit -m "chore: update sqlx metadata"
```

## 🚀 Workflow de développement

### Ajouter une nouvelle fonctionnalité AVEC migration

```rust
// Option A: Si tables existent en local (PRÉFÉRÉ)
let user = sqlx::query!(
    r#"SELECT id, email FROM users WHERE id = $1"#,
    user_id
)
.fetch_one(pool)
.await?;

// Puis générer métadonnées:
// cargo sqlx prepare
```

```rust
// Option B: Si tables n'existent PAS en local
let row = sqlx::query(
    "SELECT id, email FROM users WHERE id = $1"
)
.bind(user_id)
.fetch_one(pool)
.await?;

let user_id = row.get::<i32, _>("id");
let email = row.get::<String, _>("email");
```

## 📦 Configuration Render (Production)

### render.yaml
```yaml
services:
  - type: web
    name: yukpomnang-backend
    env: rust
    buildCommand: chmod +x backend/build.sh && ./backend/build.sh
    envVars:
      - key: SQLX_OFFLINE
        value: true  # ✅ Mode offline activé
```

### backend/build.sh
```bash
#!/bin/bash
echo "Mode SQLx: OFFLINE (pas de vérification DB à la compilation)"
export SQLX_OFFLINE=true
cargo build --release
```

## 🔍 Debug des erreurs SQLx

### Erreur : "could not find query metadata"
```
error: SQLX_OFFLINE=true but no cached data for query
```

**Solution 1** : Utiliser `sqlx::query()` au lieu de `sqlx::query!()`
```rust
// ❌ Avant
let user = sqlx::query!("SELECT * FROM new_table")?;

// ✅ Après
let user = sqlx::query("SELECT * FROM new_table").fetch_one(pool).await?;
```

**Solution 2** : Générer les métadonnées
```bash
cargo sqlx prepare
git add .sqlx/
git commit -m "chore: add sqlx metadata for new queries"
```

### Erreur : "failed to resolve: could not find X in routes"
```
error[E0433]: failed to resolve: could not find `service_team_routes` in `routes`
```

**Cause** : Module commenté dans `mod.rs` mais utilisé dans le code

**Solution** :
```rust
// backend/src/routes/mod.rs
// Avant:
// pub mod service_team_routes; // ❌ Commenté

// Après:
pub mod service_team_routes; // ✅ Décommenté
```

## 📊 État actuel du projet

### Contrôleurs avec `sqlx::query!()` (93 métadonnées)
- ✅ `auth_controller.rs`
- ✅ `service_controller.rs`
- ✅ `payment_controller.rs`
- ✅ `user_controller.rs`
- ✅ `media_controller.rs`
- ✅ `webhook_controller.rs`
- ✅ `echange_controller.rs`
- ✅ `interaction_controller.rs`
- ✅ `intelligent_service_controller.rs`

### Contrôleurs avec `sqlx::query()` (pas de métadonnées nécessaires)
- ✅ `service_team_controller.rs` - **Tables à créer**
- ✅ `signalement_controller.rs` - **Tables créées**
- ✅ `conversation_controller.rs` - **Tables créées**
- ✅ `product_lifecycle_controller.rs` - **Tables créées**

## 🎯 Recommandations

### Pour les NOUVELLES fonctionnalités

1. **Si migration non appliquée en dev** :
   - Utiliser `sqlx::query()` (fonction)
   - Commit le code
   - Appliquer migration en production
   - Optionnel : migrer vers `sqlx::query!()` plus tard

2. **Si migration déjà appliquée en dev** :
   - Utiliser `sqlx::query!()` (macro)
   - Générer métadonnées avec `cargo sqlx prepare`
   - Commit code + métadonnées ensemble

### Pour les migrations MANQUANTES

```bash
# Sur Render (via Shell ou psql)
psql $DATABASE_URL < /opt/render/project/src/backend/migrations/20251020_create_service_team_management.sql
```

Puis optionnellement :
```bash
# En local
sqlx migrate run
cargo sqlx prepare
git add .sqlx/
git commit -m "chore: add metadata for service_team tables"
```

## 📚 Ressources

- [SQLx Documentation](https://docs.rs/sqlx/)
- [SQLx Offline Mode](https://github.com/launchbadge/sqlx/blob/main/sqlx-cli/README.md#enable-building-in-offline-mode)
- [Cargo SQLx Prepare](https://github.com/launchbadge/sqlx/blob/main/sqlx-cli/README.md#prepare)

## ✅ Checklist de déploiement

- [ ] Migrations SQL créées dans `backend/migrations/`
- [ ] Tables référencées dans contrôleurs utilisent `sqlx::query()` OU métadonnées générées
- [ ] `SQLX_OFFLINE=true` dans render.yaml
- [ ] Build local réussi avec `cargo build --release`
- [ ] Migrations appliquées en production
- [ ] Routes décommentées dans `mod.rs`
- [ ] Tests de build Render réussis

---

**Dernière mise à jour** : 2025-10-20  
**Version SQLx** : 0.8  
**Mode** : Offline activé

