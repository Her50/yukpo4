# 📋 Ordre d'Exécution des Migrations

## 🎯 Vue d'Ensemble

Les migrations sont exécutées **automatiquement au démarrage de l'application** dans un ordre précis :

```
1. Connexion PostgreSQL
2. Migrations SQLx standard (tables principales)
3. Migrations auto (tables complémentaires + fonctions)
4. Reste de l'initialisation
```

---

## 📍 Code dans `main.rs`

### Phase 1 : Connexion à PostgreSQL (lignes 64-77)

```rust
log::info!("🔌 Connexion à la base de données PostgreSQL...");
let pg_pool = PgPoolOptions::new()
    .max_connections(10)
    .connect(&db_url)
    .await?;
log::info!("✅ Connexion PostgreSQL établie");
```

**Moment** : Dès le démarrage, avant toute migration

---

### Phase 2 : Migrations SQLx Standard (lignes 79-93)

```rust
// 🔄 Exécuter les migrations SQLx standard au démarrage
log::info!("🚀 Application des migrations SQLx standard...");
match sqlx::migrate!("./migrations").run(&pg_pool).await {
    Ok(_) => {
        log::info!("✅ Migrations SQLx standard appliquées avec succès");
        check_index_migration(&pg_pool).await;
    }
    Err(e) => {
        log::error!("❌ Erreur lors de l'application des migrations SQLx standard: {}", e);
        log::warn!("⚠️ Continuation du démarrage malgré l'erreur de migration");
    }
}
```

**Moment** : **Immédiatement après la connexion PostgreSQL**

**Ce qui est exécuté** :
- Toutes les migrations dans `backend/migrations/*.sql`
- Exécutées dans l'ordre chronologique (par nom de fichier)
- Créent les **tables principales** :
  - `users`, `services`, `media` (dans `0000_create_all_tables.sql`)
  - `payment_transactions`, `token_transactions` (dans `20241201_create_payment_tables.sql`)
  - `conversations`, `chat_messages` (dans `20251018_create_chat_tables.sql`)
  - `notifications` (dans `20251017001_create_notifications_table.sql`)
  - Etc.

**Comment ça marche** :
- SQLx lit tous les fichiers `.sql` dans `backend/migrations/`
- Les exécute dans l'ordre alphabétique/chronologique
- Enregistre les migrations appliquées dans la table `_sqlx_migrations`
- Ne réexécute pas les migrations déjà appliquées

---

### Phase 3 : Migrations Auto (ligne 95-96)

```rust
// 🔄 Exécuter les migrations automatiques au démarrage
yukpomnang_backend::migrations::auto_migrate::run_auto_migrations(&pg_pool).await;
```

**Moment** : **Après les migrations SQLx standard**

**Ce qui est exécuté** :
- Fonctions dans `backend/src/migrations/auto_migrate.rs`
- Créent des **tables complémentaires** :
  - `media_engagement`, `media_distribution`
  - `live_flash_sales`
  - `african_locations`
  - Etc.
- Créent des **fonctions PostgreSQL** :
  - `search_services_gps_final`
  - `hybrid_image_search`
  - `is_pharmacy_on_duty`
  - `get_active_products`
  - Etc.
- Créent des **index** :
  - `idx_services_search_optimized` (corrigé)
  - Index géographiques
  - Etc.

**Pourquoi deux systèmes** :
- **SQLx migrations** : Pour les changements de schéma versionnés (tables principales)
- **Auto migrations** : Pour les fonctions critiques et tables complémentaires qui doivent toujours exister

---

## 🔄 Ordre Chronologique Complet

```
1. Application démarre
   ↓
2. Connexion PostgreSQL
   ↓
3. sqlx::migrate!("./migrations").run()
   ├─ 0000_create_all_tables.sql (users, services, media, etc.)
   ├─ 20241201_create_payment_tables.sql
   ├─ 20251018_create_chat_tables.sql
   ├─ 20251017001_create_notifications_table.sql
   ├─ 20251123_filter_active_products_in_search_gps_final.sql
   ├─ 20251125_fix_idx_services_search_optimized.sql
   └─ ... (toutes les autres migrations)
   ↓
4. run_auto_migrations()
   ├─ ensure_media_analytics_tables() → media_engagement, media_distribution
   ├─ ensure_gps_helper_functions() → get_best_gps_for_service, etc.
   ├─ ensure_search_services_gps_final() → search_services_gps_final
   ├─ ensure_hybrid_image_search() → hybrid_image_search
   ├─ ensure_scheduling_search_functions() → is_pharmacy_on_duty, etc.
   └─ ... (toutes les autres fonctions ensure_*)
   ↓
5. Connexion MongoDB
   ↓
6. Connexion Redis
   ↓
7. Initialisation des services
   ↓
8. Démarrage du serveur HTTP
```

---

## ⚠️ Points Importants

### 1. Les tables sont créées AVANT les fonctions

Les migrations SQLx créent d'abord les tables (`users`, `services`, `media`, etc.), puis les migrations auto créent les fonctions qui utilisent ces tables.

### 2. Idempotence

- **SQLx migrations** : Utilisent `CREATE TABLE IF NOT EXISTS` et sont trackées dans `_sqlx_migrations`
- **Auto migrations** : Utilisent `CREATE OR REPLACE FUNCTION` et `CREATE TABLE IF NOT EXISTS`

### 3. Gestion des Erreurs

- Si une migration SQLx échoue, l'application continue quand même (ligne 91)
- Si une migration auto échoue, elle est loggée mais l'application continue

### 4. Ordre des Migrations SQLx

Les migrations SQLx sont exécutées dans l'ordre alphabétique/chronologique du nom de fichier :
- `0000_create_all_tables.sql` → Exécutée en premier
- `20241201_create_payment_tables.sql` → Exécutée après
- `20251125_fix_idx_services_search_optimized.sql` → Exécutée en dernier (par date)

---

## 📊 Exemple Concret

### Migration SQLx : `20251018_create_chat_tables.sql`

```sql
CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES users(id),
    ...
);
```

**Exécutée** : Phase 2 (migrations SQLx standard)
**Moment** : Après `0000_create_all_tables.sql` (car `20251018` > `0000`)
**Résultat** : Table `conversations` créée

---

### Migration Auto : `ensure_search_services_gps_final()`

```rust
pub async fn ensure_search_services_gps_final(pool: &PgPool) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        CREATE OR REPLACE FUNCTION search_services_gps_final(...)
        ...
        "#
    )
    .execute(pool)
    .await?;
}
```

**Exécutée** : Phase 3 (migrations auto)
**Moment** : Après toutes les migrations SQLx
**Résultat** : Fonction `search_services_gps_final` créée

---

## 🎯 Résumé

| Type | Moment | Contenu | Exemples |
|------|--------|---------|----------|
| **SQLx Migrations** | Phase 2 (après connexion) | Tables principales, schéma de base | `users`, `services`, `conversations`, `notifications` |
| **Auto Migrations** | Phase 3 (après SQLx) | Tables complémentaires, fonctions, index | `media_engagement`, `search_services_gps_final`, `hybrid_image_search` |

**Toutes les migrations sont exécutées automatiquement au démarrage de l'application !** ✅

