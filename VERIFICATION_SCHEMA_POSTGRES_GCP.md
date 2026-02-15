# ✅ Vérification Schema PostgreSQL GCP

**Date**: 2026-02-15  
**Statut**: ⚠️ **Vérification nécessaire**

---

## ✅ Migrations SQLx sur Cloud Run - Activées via Variable d'Environnement

**Le code permet maintenant l'exécution des migrations SQLx sur Cloud Run via une variable d'environnement.**

Dans `backend/src/main.rs` (ligne ~596) :
```rust
let enable_sqlx_migrations = env::var("ENABLE_SQLX_MIGRATIONS")
    .unwrap_or_else(|_| "false".to_string())
    .parse::<bool>()
    .unwrap_or(false);

let should_run_sqlx_migrations = !is_cloud_run || enable_sqlx_migrations;

if should_run_sqlx_migrations {
    // Migrations SQLx standard
    sqlx::migrate!("./migrations").run(&pg_pool).await
}
```

**Pour activer les migrations SQLx sur Cloud Run, définissez `ENABLE_SQLX_MIGRATIONS=true`.**

---

## ✅ Migrations Automatiques

Les **migrations automatiques** (définies dans `auto_migrate.rs`) s'exécutent sur Cloud Run si :
- `ENABLE_AUTO_MIGRATIONS=true` est configuré
- Les tables de base (`users`, `services`) existent déjà

---

## 🔧 Solutions pour Exécuter les Migrations SQLx

### Option 1 : Exécution Manuelle via psql (Recommandé)

1. **Se connecter à Cloud SQL** :
```bash
gcloud sql connect yukpo-postgres --user=yukpo_user --database=yukpo_db --project=yukpo-project
```

2. **Exécuter le script de vérification** :
```sql
\i scripts/verifier-schema-postgres-sql.sql
```

3. **Si des tables manquent, exécuter les migrations SQLx** :
   - Les migrations sont dans `backend/migrations/`
   - Exécutez-les dans l'ordre numérique (00000001, 00000002, etc.)

### Option 2 : Activer via Variable d'Environnement (✅ Implémenté)

**Le code a été modifié pour permettre l'exécution des migrations SQLx sur Cloud Run.**

Pour activer, ajoutez la variable d'environnement dans Cloud Run :
```bash
gcloud run services update yukpo-backend \
  --region=europe-west1 \
  --update-env-vars="ENABLE_SQLX_MIGRATIONS=true" \
  --project=yukpo-project
```

**Comportement** :
- Si `ENABLE_SQLX_MIGRATIONS=true` : Les migrations SQLx s'exécutent sur Cloud Run
- Si `ENABLE_SQLX_MIGRATIONS=false` ou non défini : Les migrations SQLx sont désactivées sur Cloud Run (comportement par défaut)
- En développement local : Les migrations SQLx s'exécutent toujours (indépendamment de la variable)

### Option 3 : Job Cloud Run pour Migrations

Créer un job Cloud Run qui exécute les migrations avant le déploiement du service principal.

---

## 📋 Scripts de Vérification

### Script SQL Complet

Le script `scripts/verifier-schema-postgres-sql.sql` vérifie :
- ✅ **Tables** : Liste toutes les tables et vérifie les tables critiques
- ✅ **Index** : Liste tous les index par table
- ✅ **Fonctions** : Liste toutes les fonctions PostgreSQL
- ✅ **Migrations SQLx** : Vérifie la table `_sqlx_migrations` et les migrations appliquées
- ✅ **Extensions** : Vérifie les extensions PostgreSQL (pgvector, postgis, etc.)

### Script PowerShell

Le script `scripts/verifier-schema-postgres-gcp-complet.ps1` :
- Fournit les instructions de connexion
- Vérifie les logs Cloud Run pour les migrations

---

## 🔍 Tables Critiques Attendues

- `users` - Utilisateurs
- `services` - Services
- `deliveries` - Livraisons
- `orders` - Commandes
- `products` - Produits
- `couriers` - Livreurs
- `ratings` - Avis
- `notifications` - Notifications
- `video_jobs` - Jobs vidéo
- `audio_jobs` - Jobs audio
- `story_templates` - Templates d'histoires
- `commerce_connectors` - Connecteurs e-commerce
- `feature_flags` - Feature flags

---

## 🔍 Extensions Critiques Attendues

- `pgvector` - Vecteurs pour recherche sémantique
- `postgis` - Géolocalisation
- `unaccent` - Recherche sans accents
- `imgsmlr` - Recherche d'images similaires
- `uuid-ossp` - Génération UUID

---

## 📊 Vérification Rapide

### Via psql

```sql
-- Vérifier les tables
SELECT COUNT(*) FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

-- Vérifier les migrations
SELECT COUNT(*) FROM _sqlx_migrations;

-- Vérifier les extensions
SELECT extname FROM pg_extension;
```

---

## ✅ Checklist

- [ ] **Connexion Cloud SQL** : Testée
- [ ] **Tables principales** : Vérifiées (users, services, etc.)
- [ ] **Index** : Vérifiés
- [ ] **Fonctions** : Vérifiées
- [ ] **Migrations SQLx** : Vérifiées (table `_sqlx_migrations`)
- [ ] **Extensions** : Vérifiées (pgvector, postgis, etc.)
- [ ] **Migrations automatiques** : Activées (`ENABLE_AUTO_MIGRATIONS=true`)

---

## 🚀 Prochaines Étapes

1. **Se connecter à Cloud SQL** et exécuter le script de vérification
2. **Si des tables manquent**, exécuter les migrations SQLx manuellement
3. **Vérifier que toutes les tables, index et fonctions sont créés**
4. **Optionnel** : Modifier le code pour exécuter les migrations SQLx sur Cloud Run

---

**⚠️ IMPORTANT** : Les migrations SQLx doivent être exécutées au moins une fois pour créer les tables de base. Les migrations automatiques ne peuvent fonctionner que si les tables de base existent déjà.

