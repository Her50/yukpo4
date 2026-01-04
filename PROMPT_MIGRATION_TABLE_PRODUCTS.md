# PROMPT MIGRATION COMPLÈTE : Table Products Séparée

## 🎯 CONTEXTE DU PROJET

**Projet** : Yukpomnang - Plateforme de services et produits
**Stack** : Backend Rust (Axum, SQLx, PostgreSQL), Frontend React/TypeScript, Mobile React Native
**Base de données** : PostgreSQL avec extensions pgvector et imgsmlr
**Hébergement** : Render.com (PostgreSQL + Backend)

## ❌ PROBLÈME ACTUEL

Les produits sont stockés dans `services.data->'produits'->'valeur'` (JSONB). Cela cause :

1. **Performance dégradée** : UPDATE JSONB volumineux prend 30-60s pour ajouter un produit à un service existant
2. **Goulot d'étranglement** : La fonction PostgreSQL `add_product_to_service_jsonb_v2` doit réécrire tout le JSONB (1-5 MB) à chaque ajout
3. **Limites de scalabilité** : Impossible d'avoir des milliers de produits par service (limite taille JSONB)
4. **Recherches lentes** : `jsonb_array_elements(produits)` est lent pour les services avec beaucoup de produits
5. **Erreurs TLS** : Connexions DB longues causent des erreurs "peer closed connection" sur Render

**Impact** : L'ajout d'un produit prend 30-60s malgré la queue asynchrone, car le traitement en arrière-plan reste lent.

## ✅ SOLUTION PROPOSÉE

Créer une table `products` séparée pour stocker les produits au lieu du JSONB dans `services.data`.

**Bénéfices attendus** :
- Ajout produit : 30-60s → < 1s (amélioration ~60x)
- Recherche produits : 200-500ms → 50-100ms (amélioration ~4x)
- Scalabilité : Support de milliers de produits par service
- Maintenabilité : Code plus simple, requêtes SQL standard

## 📋 STRUCTURE DE LA TABLE PROPOSÉE

```sql
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    product_index INTEGER NOT NULL, -- Position dans l'ordre d'affichage (0, 1, 2, ...)
    product_data JSONB NOT NULL, -- Toutes les données du produit (nom, prix, description, type, etc.)
    
    -- Métadonnées générées pour performance (colonnes calculées)
    product_name TEXT GENERATED ALWAYS AS (
        COALESCE(
            product_data->'nom'->>'valeur',
            product_data->>'nom',
            product_data->'nom_produit'->>'valeur',
            product_data->>'nom_produit',
            'Produit sans nom'
        )
    ) STORED,
    
    product_type TEXT GENERATED ALWAYS AS (
        COALESCE(
            product_data->'type'->>'valeur',
            product_data->>'type',
            'autre'
        )
    ) STORED,
    
    product_price NUMERIC GENERATED ALWAYS AS (
        CASE 
            WHEN product_data->'prix'->'valeur'->>'montant' IS NOT NULL 
            THEN (product_data->'prix'->'valeur'->>'montant')::NUMERIC
            WHEN product_data->'prix'->>'montant' IS NOT NULL 
            THEN (product_data->'prix'->>'montant')::NUMERIC
            WHEN product_data->>'prix' IS NOT NULL 
            THEN (product_data->>'prix')::NUMERIC
            ELSE NULL
        END
    ) STORED,
    
    -- Statut et cycle de vie
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    auto_deactivate_at TIMESTAMPTZ,
    
    -- Contrainte unique pour éviter les doublons
    UNIQUE(service_id, product_index)
);

-- Index pour performance
CREATE INDEX idx_products_service_id ON products(service_id);
CREATE INDEX idx_products_active ON products(is_active) WHERE is_active = true;
CREATE INDEX idx_products_type ON products(product_type);
CREATE INDEX idx_products_name_gin ON products USING GIN(to_tsvector('french', product_name));
CREATE INDEX idx_products_data_gin ON products USING GIN(product_data);
CREATE INDEX idx_products_service_index ON products(service_id, product_index);
```

## 🚀 MIGRATION EN 5 PHASES

### PHASE 1 : Création Table + Écriture Double (1 semaine)

**Objectif** : Créer la table `products` et écrire dans JSONB ET table (compatibilité totale)

#### 1.1 Créer la migration SQL (fichier + auto_migrate.rs)

**⚠️ IMPORTANT** : Les migrations doivent être créées dans DEUX endroits :
1. **Fichier SQL** : `backend/migrations/20260103_create_products_table.sql` (pour sqlx migrate)
2. **Fonction auto_migrate** : `backend/src/migrations/auto_migrate.rs` (pour exécution automatique au démarrage)

**Fichier SQL** : `backend/migrations/20260103_create_products_table.sql`

```sql
-- Migration: Table products séparée pour améliorer les performances
-- Date: 2026-01-03
-- Objectif: Résoudre les problèmes de performance lors de l'ajout de produits

-- Créer la table products
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    product_index INTEGER NOT NULL,
    product_data JSONB NOT NULL,
    
    -- Métadonnées générées
    product_name TEXT GENERATED ALWAYS AS (
        COALESCE(
            product_data->'nom'->>'valeur',
            product_data->>'nom',
            product_data->'nom_produit'->>'valeur',
            product_data->>'nom_produit',
            'Produit sans nom'
        )
    ) STORED,
    
    product_type TEXT GENERATED ALWAYS AS (
        COALESCE(
            product_data->'type'->>'valeur',
            product_data->>'type',
            'autre'
        )
    ) STORED,
    
    product_price NUMERIC GENERATED ALWAYS AS (
        CASE 
            WHEN product_data->'prix'->'valeur'->>'montant' IS NOT NULL 
            THEN (product_data->'prix'->'valeur'->>'montant')::NUMERIC
            WHEN product_data->'prix'->>'montant' IS NOT NULL 
            THEN (product_data->'prix'->>'montant')::NUMERIC
            WHEN product_data->>'prix' IS NOT NULL 
            THEN (product_data->>'prix')::NUMERIC
            ELSE NULL
        END
    ) STORED,
    
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    auto_deactivate_at TIMESTAMPTZ,
    
    UNIQUE(service_id, product_index)
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_products_service_id ON products(service_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_products_type ON products(product_type);
CREATE INDEX IF NOT EXISTS idx_products_name_gin ON products USING GIN(to_tsvector('french', product_name));
CREATE INDEX IF NOT EXISTS idx_products_data_gin ON products USING GIN(product_data);
CREATE INDEX IF NOT EXISTS idx_products_service_index ON products(service_id, product_index);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at DESC);

-- Trigger pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_products_updated_at();

COMMENT ON TABLE products IS 'Table séparée pour les produits. Améliore les performances d''ajout et de recherche par rapport au JSONB dans services.data';
COMMENT ON COLUMN products.product_index IS 'Position du produit dans l''ordre d''affichage (0, 1, 2, ...). Doit être unique par service.';
COMMENT ON COLUMN products.product_data IS 'Toutes les données du produit au format JSONB (nom, prix, description, type, images, etc.)';
```

**Fonction auto_migrate** : `backend/src/migrations/auto_migrate.rs`

**Ajouter** une nouvelle fonction `ensure_products_table` :

```rust
/// Vérifie et crée la table products si elle n'existe pas
pub async fn ensure_products_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification de la table products...");
    
    // Vérifier si la table existe
    let table_exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'products')"
    )
    .fetch_one(pool)
    .await?;
    
    if table_exists {
        info!("✅ Table products déjà présente");
        
        // Vérifier et ajouter les colonnes manquantes si nécessaire
        // (pour migrations incrémentales)
        // ...
    } else {
        warn!("⚠️ Table products manquante, création en cours...");
        
        // Créer la table products (copier le SQL de la migration)
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS products (
                id SERIAL PRIMARY KEY,
                service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
                product_index INTEGER NOT NULL,
                product_data JSONB NOT NULL,
                
                -- Métadonnées générées
                product_name TEXT GENERATED ALWAYS AS (
                    COALESCE(
                        product_data->'nom'->>'valeur',
                        product_data->>'nom',
                        product_data->'nom_produit'->>'valeur',
                        product_data->>'nom_produit',
                        'Produit sans nom'
                    )
                ) STORED,
                
                product_type TEXT GENERATED ALWAYS AS (
                    COALESCE(
                        product_data->'type'->>'valeur',
                        product_data->>'type',
                        'autre'
                    )
                ) STORED,
                
                product_price NUMERIC GENERATED ALWAYS AS (
                    CASE 
                        WHEN product_data->'prix'->'valeur'->>'montant' IS NOT NULL 
                        THEN (product_data->'prix'->'valeur'->>'montant')::NUMERIC
                        WHEN product_data->'prix'->>'montant' IS NOT NULL 
                        THEN (product_data->'prix'->>'montant')::NUMERIC
                        WHEN product_data->>'prix' IS NOT NULL 
                        THEN (product_data->>'prix')::NUMERIC
                        ELSE NULL
                    END
                ) STORED,
                
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW(),
                auto_deactivate_at TIMESTAMPTZ,
                
                UNIQUE(service_id, product_index)
            )
            "#,
        )
        .execute(pool)
        .await?;
        
        // Créer les index
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_products_service_id ON products(service_id)")
            .execute(pool).await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active) WHERE is_active = true")
            .execute(pool).await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_products_type ON products(product_type)")
            .execute(pool).await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_products_name_gin ON products USING GIN(to_tsvector('french', product_name))")
            .execute(pool).await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_products_data_gin ON products USING GIN(product_data)")
            .execute(pool).await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_products_service_index ON products(service_id, product_index)")
            .execute(pool).await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at DESC)")
            .execute(pool).await?;
        
        // Créer le trigger pour updated_at
        sqlx::query(
            r#"
            CREATE OR REPLACE FUNCTION update_products_updated_at()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = NOW();
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql
            "#
        )
        .execute(pool)
        .await?;
        
        sqlx::query(
            r#"
            CREATE TRIGGER trg_products_updated_at
                BEFORE UPDATE ON products
                FOR EACH ROW
                EXECUTE FUNCTION update_products_updated_at()
            "#
        )
        .execute(pool)
        .await?;
        
        info!("✅ Table products créée avec succès !");
    }
    
    Ok(())
}
```

**Appeler la fonction dans `run_all_auto_migrations`** (ligne ~7780) :

```rust
// Migration X: Table products (✅ 2026-01-03)
match ensure_products_table(pool).await {
    Ok(_) => info!("✅ Migration auto: products table OK"),
    Err(e) => error!("❌ Erreur migration auto products: {}", e),
}
```

#### 1.2 Créer le service ProductsService (Backend)

**Fichier** : `backend/src/services/products_service.rs`

**À créer complètement** avec les méthodes :
- `new(pool: Arc<PgPool>) -> Self`
- `create_product(service_id, product_index, product_data) -> AppResult<Product>`
- `get_product(service_id, product_index) -> AppResult<Option<Product>>`
- `get_products_by_service(service_id) -> AppResult<Vec<Product>>`
- `update_product(service_id, product_index, product_data) -> AppResult<Product>`
- `delete_product(service_id, product_index) -> AppResult<()>`
- `reindex_products(service_id) -> AppResult<()>` (pour réindexer après suppression)

**Structure Product** :
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Product {
    pub id: i32,
    pub service_id: i32,
    pub product_index: i32,
    pub product_data: Value,
    pub product_name: String,
    pub product_type: String,
    pub product_price: Option<f64>,
    pub is_active: bool,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
    pub auto_deactivate_at: Option<chrono::DateTime<chrono::Utc>>,
}
```

#### 1.3 Modifier creer_service.rs pour écriture double

**Fichier** : `backend/src/services/creer_service.rs`

**Localisation** : Après la création du service et insertion des produits dans JSONB (ligne ~2130, après `tx.commit()`)

**Modification** :
```rust
// ✅ PHASE 1: Écriture double (JSONB + table products)
use crate::services::products_service::ProductsService;
let products_service = ProductsService::new(Arc::new(pool.clone()));

if let Some(produits_array) = produits_array_mut(&mut data_obj) {
    for (product_index, produit_value) in produits_array.iter().enumerate() {
        // Nettoyer les médias du produit (seront dans table media)
        let mut produit_cleaned = produit_value.clone();
        let mut removed_count = 0;
        clean_media_recursive_final(&mut produit_cleaned, &mut removed_count);
        
        // Créer le produit dans la table séparée
        match products_service.create_product(
            service_id,
            product_index as i32,
            &produit_cleaned,
        ).await {
            Ok(_) => {
                log::info!(
                    "[creer_service] ✅ Produit {} créé dans table products (service_id: {})",
                    product_index,
                    service_id
                );
            }
            Err(e) => {
                log::warn!(
                    "[creer_service] ⚠️ Erreur création produit {} dans table products: {} (JSONB créé quand même)",
                    product_index,
                    e
                );
                // Ne pas échouer, le JSONB est déjà créé
            }
        }
    }
}
```

#### 1.4 Modifier product_addition_controller.rs pour écriture double

**Fichier** : `backend/src/controllers/product_addition_controller.rs`

**Fonction** : `process_product_creation` (ligne ~33-88)

**Localisation** : Après l'appel à `add_product_to_service_jsonb_v2` (ligne ~66)

**Modification** :
```rust
// ✅ PHASE 1: Écriture double (JSONB + table products)
use crate::services::products_service::ProductsService;
let products_service = ProductsService::new(pool.clone());

// Créer aussi dans la table products
match products_service.create_product(
    service_id,
    product_index,
    &product_data_cleaned,
).await {
    Ok(_) => {
        log::info!(
            "[process_product_creation] ✅ Produit {} créé dans table products (service_id: {})",
            product_index,
            service_id
        );
    }
    Err(e) => {
        log::warn!(
            "[process_product_creation] ⚠️ Erreur création produit dans table products: {} (JSONB créé quand même)",
            e
        );
        // Ne pas échouer, le JSONB est déjà créé
    }
}
```

#### 1.5 Ajouter ProductsService au AppState

**Fichier** : `backend/src/state.rs`

**Modification** :
```rust
// Dans la structure AppState
pub struct AppState {
    // ... autres champs existants
    pub products_service: Arc<ProductsService>,
}

// Dans la fonction de création de AppState
use crate::services::products_service::ProductsService;
let products_service = Arc::new(ProductsService::new(Arc::new(pg.clone())));

// Ajouter dans le retour
AppState {
    // ... autres champs
    products_service,
}
```

#### 1.6 Ajouter le module dans mod.rs

**Fichier** : `backend/src/services/mod.rs`

**Modification** :
```rust
pub mod products_service; // ✅ NOUVEAU 2026-01-03: Service pour table products séparée
```

#### 1.7 Modifier save_autocomplete_combination pour utiliser product_id de la table products

**Fichier** : `backend/src/services/creer_service.rs`

**Fonction** : `save_autocomplete_combination` (ligne ~5237)

**Modification** : Après la création du produit dans la table `products`, utiliser le `product_id` (id de la table products) au lieu de l'index JSONB

**Localisation** : Dans la fonction `save_autocomplete_combination`, après avoir extrait les produits (ligne ~5258)

**Modification** :
```rust
// ✅ PHASE 1: Utiliser product_id de la table products pour autocomplete_characteristics
use crate::services::products_service::ProductsService;
let products_service = ProductsService::new(Arc::new(pool.clone()));

// Pour chaque produit dans le service
if let Some(produits_array) = produits_array_mut(&mut data_obj) {
    for (product_index, produit_value) in produits_array.iter().enumerate() {
        // Récupérer le product_id depuis la table products
        let product_id = match products_service.get_product(service_id, product_index as i32).await {
            Ok(Some(product)) => Some(product.id.to_string()),
            Ok(None) => {
                log::warn!(
                    "[save_autocomplete_combination] Produit {} non trouvé dans table products, utilisation de l'index JSONB",
                    product_index
                );
                // Fallback : utiliser l'index JSONB comme product_id (compatibilité)
                Some(format!("{}_{}", service_id, product_index))
            }
            Err(e) => {
                log::warn!(
                    "[save_autocomplete_combination] Erreur récupération product_id: {} (utilisation index JSONB)",
                    e
                );
                Some(format!("{}_{}", service_id, product_index))
            }
        };
        
        // Utiliser product_id dans la sauvegarde autocomplete_characteristics
        // (remplacer les références à product_index par product_id)
        // ...
    }
}
```

**Note** : La table `autocomplete_characteristics` a une colonne `product_id TEXT` qui doit référencer l'`id` de la table `products` (format string).

#### 1.8 Modifier product_addition_controller.rs pour autocomplete_characteristics

**Fichier** : `backend/src/controllers/product_addition_controller.rs`

**Fonction** : `process_product_creation` (ligne ~33-88)

**Modification** : Après la création du produit dans la table `products`, mettre à jour `autocomplete_characteristics` avec le nouveau `product_id`

**Localisation** : Après l'appel à `products_service.create_product` (ligne ~271)

**Modification** :
```rust
// ✅ PHASE 1: Mettre à jour autocomplete_characteristics avec product_id
match products_service.create_product(service_id, product_index, &product_data_cleaned).await {
    Ok(product) => {
        log::info!(
            "[process_product_creation] ✅ Produit {} créé dans table products (id: {})",
            product_index,
            product.id
        );
        
        // Mettre à jour autocomplete_characteristics avec le product_id
        // (appeler save_autocomplete_combination ou mettre à jour directement)
        // ...
    }
    // ...
}
```

#### 1.9 Tests Phase 1

**Vérifications à faire** :
1. Créer un service avec produits → Vérifier que les produits sont dans JSONB ET table `products`
2. Ajouter un produit à un service existant → Vérifier écriture double
3. Vérifier l'intégrité : 
   ```sql
   SELECT 
       s.id,
       jsonb_array_length(s.data->'produits'->'valeur') as produits_jsonb,
       COUNT(p.id) as produits_table
   FROM services s
   LEFT JOIN products p ON p.service_id = s.id
   WHERE s.data->'produits'->'valeur' IS NOT NULL
   GROUP BY s.id
   HAVING jsonb_array_length(s.data->'produits'->'valeur') != COUNT(p.id);
   ```
   Cette requête doit retourner 0 lignes (tous les produits doivent être dans les deux endroits)
4. Vérifier que `autocomplete_characteristics.product_id` référence bien les `products.id` :
   ```sql
   SELECT 
       ac.id,
       ac.service_id,
       ac.product_id,
       p.id as product_table_id,
       CASE 
           WHEN ac.product_id::INTEGER = p.id THEN '✅ OK'
           ELSE '❌ DIFFÉRENCE'
       END as status
   FROM autocomplete_characteristics ac
   LEFT JOIN products p ON p.id = ac.product_id::INTEGER
   WHERE ac.is_real_product = TRUE
   AND ac.identifiant_base = 'produits'
   AND ac.product_id IS NOT NULL
   AND ac.product_id::INTEGER != p.id;
   ```
   Cette requête doit retourner 0 lignes après migration

---

### PHASE 2 : Migration des Données Existantes (3-5 jours)

**Objectif** : Migrer tous les produits existants depuis JSONB vers la table `products`

#### 2.1 Créer le script de migration SQL (fichier + auto_migrate.rs)

**⚠️ IMPORTANT** : Les migrations doivent être créées dans DEUX endroits :
1. **Fichier SQL** : `backend/migrations/20260104_migrate_existing_products.sql` (pour sqlx migrate)
2. **Fonction auto_migrate** : `backend/src/migrations/auto_migrate.rs` (pour exécution automatique au démarrage)

**Fichier SQL** : `backend/migrations/20260104_migrate_existing_products.sql`

```sql
-- Migration des produits existants depuis services.data->'produits'->'valeur' vers table products
-- Cette migration peut être exécutée en plusieurs fois (par lots)

-- Fonction pour migrer un lot de services
CREATE OR REPLACE FUNCTION migrate_products_batch(batch_size INTEGER DEFAULT 100)
RETURNS TABLE(
    services_processed INTEGER,
    products_migrated INTEGER,
    errors_count INTEGER
) AS $$
DECLARE
    service_record RECORD;
    produit_value JSONB;
    produit_index INTEGER;
    produits_count INTEGER;
    total_migrated INTEGER := 0;
    total_services INTEGER := 0;
    error_count INTEGER := 0;
BEGIN
    -- Migrer par lots
    FOR service_record IN 
        SELECT id, data 
        FROM services 
        WHERE is_active = true
        AND data->'produits'->'valeur' IS NOT NULL
        AND jsonb_typeof(data->'produits'->'valeur') = 'array'
        AND jsonb_array_length(data->'produits'->'valeur') > 0
        AND id NOT IN (SELECT DISTINCT service_id FROM products)
        ORDER BY id
        LIMIT batch_size
    LOOP
        BEGIN
            total_services := total_services + 1;
            produits_count := 0;
            
            -- Extraire chaque produit
            FOR produit_index IN 0..jsonb_array_length(service_record.data->'produits'->'valeur') - 1
            LOOP
                produit_value := service_record.data->'produits'->'valeur'->produit_index;
                
                -- Insérer dans table products (IGNORE si existe déjà)
                INSERT INTO products (service_id, product_index, product_data)
                VALUES (service_record.id, produit_index, produit_value)
                ON CONFLICT (service_id, product_index) DO NOTHING;
                
                produits_count := produits_count + 1;
                total_migrated := total_migrated + 1;
            END LOOP;
            
            RAISE NOTICE 'Service %: % produits migrés', service_record.id, produits_count;
        EXCEPTION WHEN OTHERS THEN
            error_count := error_count + 1;
            RAISE WARNING 'Erreur migration service %: %', service_record.id, SQLERRM;
        END;
    END LOOP;
    
    RETURN QUERY SELECT total_services, total_migrated, error_count;
END;
$$ LANGUAGE plpgsql;

-- Exécuter la migration par lots
-- Répéter jusqu'à ce que services_processed = 0
SELECT * FROM migrate_products_batch(100);
```

**Fonction auto_migrate** : `backend/src/migrations/auto_migrate.rs`

**Ajouter** une nouvelle fonction `migrate_existing_products_to_table` :

```rust
/// Migre les produits existants depuis services.data->'produits'->'valeur' vers table products
/// Cette fonction peut être exécutée plusieurs fois (idempotente)
pub async fn migrate_existing_products_to_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Migration des produits existants vers table products...");
    
    // Vérifier si la table products existe
    let table_exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'products')"
    )
    .fetch_one(pool)
    .await?;
    
    if !table_exists {
        warn!("⚠️ Table products n'existe pas, création nécessaire avant migration");
        return Ok(()); // La table sera créée par ensure_products_table
    }
    
    // Créer la fonction de migration batch si elle n'existe pas
    sqlx::query(
        r#"
        CREATE OR REPLACE FUNCTION migrate_products_batch(batch_size INTEGER DEFAULT 100)
        RETURNS TABLE(
            services_processed INTEGER,
            products_migrated INTEGER,
            errors_count INTEGER
        ) AS $$
        DECLARE
            service_record RECORD;
            produit_value JSONB;
            produit_index INTEGER;
            produits_count INTEGER;
            total_migrated INTEGER := 0;
            total_services INTEGER := 0;
            error_count INTEGER := 0;
        BEGIN
            FOR service_record IN 
                SELECT id, data 
                FROM services 
                WHERE is_active = true
                AND data->'produits'->'valeur' IS NOT NULL
                AND jsonb_typeof(data->'produits'->'valeur') = 'array'
                AND jsonb_array_length(data->'produits'->'valeur') > 0
                AND id NOT IN (SELECT DISTINCT service_id FROM products)
                ORDER BY id
                LIMIT batch_size
            LOOP
                BEGIN
                    total_services := total_services + 1;
                    produits_count := 0;
                    
                    FOR produit_index IN 0..jsonb_array_length(service_record.data->'produits'->'valeur') - 1
                    LOOP
                        produit_value := service_record.data->'produits'->'valeur'->produit_index;
                        
                        INSERT INTO products (service_id, product_index, product_data)
                        VALUES (service_record.id, produit_index, produit_value)
                        ON CONFLICT (service_id, product_index) DO NOTHING;
                        
                        produits_count := produits_count + 1;
                        total_migrated := total_migrated + 1;
                    END LOOP;
                    
                    RAISE NOTICE 'Service %: % produits migrés', service_record.id, produits_count;
                EXCEPTION WHEN OTHERS THEN
                    error_count := error_count + 1;
                    RAISE WARNING 'Erreur migration service %: %', service_record.id, SQLERRM;
                END;
            END LOOP;
            
            RETURN QUERY SELECT total_services, total_migrated, error_count;
        END;
        $$ LANGUAGE plpgsql
        "#
    )
    .execute(pool)
    .await?;
    
    // Exécuter la migration par lots jusqu'à ce qu'il n'y ait plus de services à migrer
    let mut total_services_processed = 0;
    let mut total_products_migrated = 0;
    let mut total_errors = 0;
    let mut batch_count = 0;
    const MAX_BATCHES: i32 = 1000; // Limite de sécurité
    
    loop {
        batch_count += 1;
        if batch_count > MAX_BATCHES {
            warn!("⚠️ Limite de batches atteinte ({}), arrêt de la migration", MAX_BATCHES);
            break;
        }
        
        let result: (i64, i64, i64) = sqlx::query_as(
            "SELECT * FROM migrate_products_batch(100)"
        )
        .fetch_one(pool)
        .await?;
        
        let (services_processed, products_migrated, errors_count) = result;
        total_services_processed += services_processed;
        total_products_migrated += products_migrated;
        total_errors += errors_count;
        
        info!(
            "📦 Batch {}: {} services, {} produits migrés, {} erreurs",
            batch_count, services_processed, products_migrated, errors_count
        );
        
        if services_processed == 0 {
            break; // Plus de services à migrer
        }
    }
    
    info!(
        "✅ Migration produits terminée: {} services, {} produits migrés, {} erreurs",
        total_services_processed, total_products_migrated, total_errors
    );
    
    Ok(())
}
```

**Appeler la fonction dans `run_all_auto_migrations`** (après `ensure_products_table`) :

```rust
// Migration des produits existants (✅ 2026-01-04)
match migrate_existing_products_to_table(pool).await {
    Ok(_) => info!("✅ Migration auto: produits existants migrés OK"),
    Err(e) => error!("❌ Erreur migration auto produits existants: {}", e),
}
```

#### 2.2 Créer un script Rust pour migration batch

**Fichier** : `backend/src/bin/migrate_products.rs`

**Créer complètement** avec :
- Fonction `migrate_batch` qui migre 100 services à la fois
- Boucle principale qui continue jusqu'à ce qu'il n'y ait plus de services à migrer
- Logs détaillés du progrès
- Gestion d'erreurs robuste

#### 2.3 Vérification de l'intégrité

**Script SQL** :

```sql
-- Vérifier que tous les produits sont migrés
SELECT 
    s.id as service_id,
    jsonb_array_length(s.data->'produits'->'valeur') as produits_jsonb,
    COUNT(p.id) as produits_table,
    CASE 
        WHEN jsonb_array_length(s.data->'produits'->'valeur') = COUNT(p.id) THEN '✅ OK'
        ELSE '❌ DIFFÉRENCE'
    END as status
FROM services s
LEFT JOIN products p ON p.service_id = s.id
WHERE s.is_active = true
AND s.data->'produits'->'valeur' IS NOT NULL
AND jsonb_typeof(s.data->'produits'->'valeur') = 'array'
AND jsonb_array_length(s.data->'produits'->'valeur') > 0
GROUP BY s.id
HAVING jsonb_array_length(s.data->'produits'->'valeur') != COUNT(p.id)
ORDER BY s.id;
```

**Cette requête doit retourner 0 lignes après migration complète**

#### 2.4 Migrer product_id dans autocomplete_characteristics (fichier + auto_migrate.rs)

**⚠️ IMPORTANT** : Les migrations doivent être créées dans DEUX endroits :
1. **Fichier SQL** : `backend/migrations/20260104_migrate_autocomplete_product_ids.sql` (pour sqlx migrate)
2. **Fonction auto_migrate** : `backend/src/migrations/auto_migrate.rs` (pour exécution automatique au démarrage)

**Fichier SQL** : `backend/migrations/20260104_migrate_autocomplete_product_ids.sql`

**Ajouter** : Fonction pour migrer les `product_id` dans `autocomplete_characteristics`

```sql
-- Fonction pour migrer product_id dans autocomplete_characteristics
CREATE OR REPLACE FUNCTION migrate_autocomplete_product_ids()
RETURNS TABLE(
    autocomplete_updated INTEGER,
    errors_count INTEGER
) AS $$
DECLARE
    ac_record RECORD;
    product_record RECORD;
    updated_count INTEGER := 0;
    error_count INTEGER := 0;
BEGIN
    -- Pour chaque entrée autocomplete_characteristics avec product_id manquant ou incorrect
    FOR ac_record IN 
        SELECT 
            ac.id,
            ac.service_id,
            ac.product_id,
            -- Extraire product_index depuis product_id (format: "service_id_product_index")
            SPLIT_PART(ac.product_id, '_', 2)::INTEGER as product_index
        FROM autocomplete_characteristics ac
        WHERE ac.is_real_product = TRUE
        AND ac.identifiant_base = 'produits'
        AND (
            ac.product_id IS NULL
            OR ac.product_id::INTEGER NOT IN (SELECT id FROM products)
        )
    LOOP
        BEGIN
            -- Trouver le product_id correspondant dans la table products
            SELECT id INTO product_record
            FROM products
            WHERE service_id = ac_record.service_id
            AND product_index = ac_record.product_index
            LIMIT 1;
            
            IF product_record.id IS NOT NULL THEN
                -- Mettre à jour autocomplete_characteristics avec le product_id correct
                UPDATE autocomplete_characteristics
                SET product_id = product_record.id::TEXT
                WHERE id = ac_record.id;
                
                updated_count := updated_count + 1;
            ELSE
                error_count := error_count + 1;
                RAISE WARNING 'Produit non trouvé pour service_id=% product_index=%', 
                    ac_record.service_id, ac_record.product_index;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            error_count := error_count + 1;
            RAISE WARNING 'Erreur migration autocomplete id=%: %', ac_record.id, SQLERRM;
        END;
    END LOOP;
    
    RETURN QUERY SELECT updated_count, error_count;
END;
$$ LANGUAGE plpgsql;

-- Exécuter la migration
SELECT * FROM migrate_autocomplete_product_ids();
```

**Fonction auto_migrate** : `backend/src/migrations/auto_migrate.rs`

**Ajouter** une nouvelle fonction `migrate_autocomplete_product_ids` :

```rust
/// Migre les product_id dans autocomplete_characteristics pour référencer la table products
pub async fn migrate_autocomplete_product_ids(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Migration des product_id dans autocomplete_characteristics...");
    
    // Créer la fonction de migration si elle n'existe pas
    sqlx::query(
        r#"
        CREATE OR REPLACE FUNCTION migrate_autocomplete_product_ids()
        RETURNS TABLE(
            autocomplete_updated INTEGER,
            errors_count INTEGER
        ) AS $$
        DECLARE
            ac_record RECORD;
            product_record RECORD;
            updated_count INTEGER := 0;
            error_count INTEGER := 0;
        BEGIN
            FOR ac_record IN 
                SELECT 
                    ac.id,
                    ac.service_id,
                    ac.product_id,
                    SPLIT_PART(ac.product_id, '_', 2)::INTEGER as product_index
                FROM autocomplete_characteristics ac
                WHERE ac.is_real_product = TRUE
                AND ac.identifiant_base = 'produits'
                AND (
                    ac.product_id IS NULL
                    OR ac.product_id::INTEGER NOT IN (SELECT id FROM products)
                )
            LOOP
                BEGIN
                    SELECT id INTO product_record
                    FROM products
                    WHERE service_id = ac_record.service_id
                    AND product_index = ac_record.product_index
                    LIMIT 1;
                    
                    IF product_record.id IS NOT NULL THEN
                        UPDATE autocomplete_characteristics
                        SET product_id = product_record.id::TEXT
                        WHERE id = ac_record.id;
                        
                        updated_count := updated_count + 1;
                    ELSE
                        error_count := error_count + 1;
                        RAISE WARNING 'Produit non trouvé pour service_id=% product_index=%', 
                            ac_record.service_id, ac_record.product_index;
                    END IF;
                EXCEPTION WHEN OTHERS THEN
                    error_count := error_count + 1;
                    RAISE WARNING 'Erreur migration autocomplete id=%: %', ac_record.id, SQLERRM;
                END;
            END LOOP;
            
            RETURN QUERY SELECT updated_count, error_count;
        END;
        $$ LANGUAGE plpgsql
        "#
    )
    .execute(pool)
    .await?;
    
    // Exécuter la migration
    let result: (i64, i64) = sqlx::query_as(
        "SELECT * FROM migrate_autocomplete_product_ids()"
    )
    .fetch_one(pool)
    .await?;
    
    let (updated_count, error_count) = result;
    info!(
        "✅ Migration autocomplete_product_ids terminée: {} mis à jour, {} erreurs",
        updated_count, error_count
    );
    
    Ok(())
}
```

**Appeler la fonction dans `run_all_auto_migrations`** (après `migrate_existing_products_to_table`) :

```rust
// Migration des product_id dans autocomplete_characteristics (✅ 2026-01-04)
match migrate_autocomplete_product_ids(pool).await {
    Ok(_) => info!("✅ Migration auto: autocomplete_product_ids OK"),
    Err(e) => error!("❌ Erreur migration auto autocomplete_product_ids: {}", e),
}
```

#### 2.5 Tests Phase 2

1. Exécuter le script de migration
2. Vérifier l'intégrité avec la requête SQL ci-dessus
3. Vérifier quelques services manuellement
4. Compter le total : `SELECT COUNT(*) FROM products;` doit correspondre au nombre total de produits dans JSONB
5. Vérifier que tous les `autocomplete_characteristics.product_id` référencent bien les `products.id` :
   ```sql
   SELECT COUNT(*) 
   FROM autocomplete_characteristics ac
   INNER JOIN products p ON p.id = ac.product_id::INTEGER
   WHERE ac.is_real_product = TRUE
   AND ac.identifiant_base = 'produits';
   ```
   Ce nombre doit correspondre au nombre d'entrées dans `autocomplete_characteristics` pour les produits

---

### PHASE 3 : Lecture depuis Table (Backend) (1 semaine)

**Objectif** : Modifier les recherches et récupérations pour lire depuis la table `products` au lieu de JSONB

#### 3.1 Créer les endpoints API Products

**Fichier** : `backend/src/controllers/products_controller.rs` (NOUVEAU)

**Endpoints à créer** :
```rust
// GET /api/services/{service_id}/products
// Retourne tous les produits d'un service (depuis table products)

// GET /api/services/{service_id}/products/{product_index}
// Retourne un produit spécifique (depuis table products)

// PATCH /api/services/{service_id}/products/{product_index}
// Met à jour un produit (table products + JSONB pour compatibilité)

// DELETE /api/services/{service_id}/products/{product_index}
// Supprime un produit (table products + JSONB pour compatibilité)

// GET /api/products?user_id={user_id}
// Retourne tous les produits d'un utilisateur (pour MesProduits)
```

#### 3.2 Modifier native_search_service.rs

**Fichier** : `backend/src/services/native_search_service.rs`

**Modification** : Remplacer les requêtes avec `jsonb_array_elements(produits)` par des JOIN sur table `products`

**Avant** :
```sql
FROM services s,
LATERAL jsonb_array_elements(
    CASE 
        WHEN jsonb_typeof(s.data->'produits') = 'array' 
        THEN s.data->'produits'
        ELSE '[]'::jsonb
    END
) AS product
```

**Après** :
```sql
FROM services s
INNER JOIN products p ON p.service_id = s.id AND p.is_active = true
WHERE to_tsvector('french', p.product_name) @@ plainto_tsquery('french', $1)
```

#### 3.3 Modifier rechercher_besoin.rs

**Fichier** : `backend/src/services/rechercher_besoin.rs`

**Modification** : Utiliser la table `products` pour la recherche full-text

**Ligne ~118-128** : Remplacer `extract_product_search_text(produits)` par recherche directe sur `products.product_name`

#### 3.4 Modifier scheduling_search_service.rs

**Fichier** : `backend/src/services/scheduling_search_service.rs`

**Modification** : Remplacer `jsonb_array_elements(produits)` par JOIN sur `products`

**Ligne ~219-225** : Modifier la requête SQL

#### 3.5 Modifier image_search_service.rs

**Fichier** : `backend/src/services/image_search_service.rs`

**Modification** : Utiliser la table `products` pour récupérer les produits

**Ligne ~180-186** : Remplacer `jsonb_array_elements(produits)` par JOIN sur `products`

#### 3.6 Modifier video_generation_service.rs

**Fichier** : `backend/src/services/video_generation_service.rs`

**Modification** : Récupérer le produit depuis la table `products` au lieu de JSONB

**Ligne ~300-310** : Remplacer l'accès JSONB par `products_service.get_product(service_id, product_index)`

#### 3.7 Modifier delivery_service.rs

**Fichier** : `backend/src/services/delivery_service.rs`

**Modification** : Récupérer les produits depuis la table `products` pour la configuration de livraison

#### 3.8 Ajouter les routes Products

**Fichier** : `backend/src/routes/products_management.rs`

**Modification** : Ajouter les nouvelles routes pour les endpoints Products

**Ou créer** : `backend/src/routes/products_routes.rs` (NOUVEAU)

```rust
// Routes pour gestion produits
router
    .route("/api/services/:service_id/products", get(get_products_by_service).post(create_product))
    .route("/api/services/:service_id/products/:product_index", get(get_product).patch(update_product).delete(delete_product))
    .route("/api/products", get(get_products_by_user));
```

#### 3.9 Modifier autocomplete_client_service.rs pour utiliser table products

**Fichier** : `backend/src/services/autocomplete_client_service.rs`

**Fonction** : `search_product_suggestions` (ligne ~25)

**Modification** : Remplacer l'accès à `services.data->'produits'` par JOIN sur table `products`

**Ligne ~40-88** : Modifier la requête SQL pour utiliser la table `products` :

**Avant** :
```sql
FROM autocomplete_characteristics ac
INNER JOIN services s ON s.id = ac.service_id
WHERE 
    ac.is_real_product = TRUE
    AND s.is_active = TRUE
    AND ac.identifiant_base = 'produits'
    -- Extraire données produit depuis service.data
    (s.data->'produits'->>'prix')::FLOAT as prix,
    s.data->'produits'->>'devise' as devise,
```

**Après** :
```sql
FROM autocomplete_characteristics ac
INNER JOIN services s ON s.id = ac.service_id
INNER JOIN products p ON p.id = ac.product_id::INTEGER AND p.service_id = ac.service_id
WHERE 
    ac.is_real_product = TRUE
    AND s.is_active = TRUE
    AND p.is_active = TRUE
    AND ac.identifiant_base = 'produits'
    -- Extraire données produit depuis table products
    p.product_price as prix,
    p.product_data->'prix'->'valeur'->>'devise' as devise,
    -- has_variant depuis product_data
    COALESCE((p.product_data->>'has_variant')::BOOLEAN, FALSE) as has_variant,
    p.product_data->>'variant_dimension' as variant_dimension,
```

#### 3.10 Modifier native_search_service.rs pour autocomplete_characteristics

**Fichier** : `backend/src/services/native_search_service.rs`

**Fonction** : Recherches utilisant `autocomplete_characteristics` (ligne ~445, ~568, ~1119)

**Modification** : Ajouter JOIN sur table `products` pour récupérer les données produit

**Ligne ~445** : Modifier la requête pour utiliser `products` :
```sql
FROM autocomplete_characteristics ac
INNER JOIN products p ON p.id = ac.product_id::INTEGER AND p.service_id = ac.service_id
INNER JOIN services s ON s.id = ac.service_id
WHERE 
    ac.is_real_product = TRUE
    AND p.is_active = TRUE
    AND s.is_active = TRUE
    -- Utiliser p.product_name au lieu d'extraire depuis JSONB
```

**Ligne ~568** : Même modification

**Ligne ~1119-1283** : Même modification pour les recherches avec score

#### 3.11 Tests Phase 3

1. Tester la recherche de produits → Vérifier que les résultats viennent de la table `products`
2. Tester l'affichage d'un produit → Vérifier que les données viennent de la table
3. Tester les suggestions autocomplete → Vérifier que `autocomplete_client_service` fonctionne avec la table `products`
4. Comparer les performances avant/après
5. Vérifier que tous les endpoints fonctionnent
6. Vérifier que les recherches utilisant `autocomplete_characteristics` fonctionnent correctement

---

### PHASE 4 : Migration Frontend/Mobile (1 semaine)

**Objectif** : Modifier les composants frontend/mobile pour utiliser les nouveaux endpoints API

#### 4.1 Créer le service Products (Frontend)

**Fichier** : `frontend/src/services/productsService.ts` (NOUVEAU)

```typescript
import { apiGet, apiPost, apiPatch, apiDelete } from './api';

export const productsService = {
  // Récupérer tous les produits d'un service
  getProductsByService: async (serviceId: number) => {
    return apiGet(`/api/services/${serviceId}/products`);
  },

  // Récupérer un produit spécifique
  getProduct: async (serviceId: number, productIndex: number) => {
    return apiGet(`/api/services/${serviceId}/products/${productIndex}`);
  },

  // Créer un produit (utilise déjà la queue)
  createProduct: async (serviceId: number, productData: any) => {
    return apiPost(`/api/services/${serviceId}/products`, {
      user_id: /* récupérer depuis auth */,
      product_data: productData
    });
  },

  // Mettre à jour un produit
  updateProduct: async (serviceId: number, productIndex: number, productData: any) => {
    return apiPatch(`/api/services/${serviceId}/products/${productIndex}`, productData);
  },

  // Supprimer un produit
  deleteProduct: async (serviceId: number, productIndex: number) => {
    return apiDelete(`/api/services/${serviceId}/products/${productIndex}`);
  },

  // Récupérer tous les produits d'un utilisateur (pour MesProduits)
  getProductsByUser: async (userId: number) => {
    return apiGet(`/api/products?user_id=${userId}`);
  },
};
```

#### 4.2 Créer le service Products (Mobile)

**Fichier** : `mobile/src/services/productsService.ts` (NOUVEAU)

**Même structure que frontend** mais avec les imports mobile

#### 4.3 Modifier ProductCard (Frontend)

**Fichier** : `frontend/src/components/products/ProductCard.tsx`

**Modification** : Le produit peut maintenant venir directement de l'API (pas besoin d'extraire depuis `service.data.produits`)

**Ligne ~74-77** : Simplifier l'extraction du `productIndex` (peut venir directement du produit)

#### 4.4 Modifier ProductCard (Mobile)

**Fichier** : `mobile/src/components/ProductCard.tsx`

**Même modification que frontend**

#### 4.5 Modifier MesServicesScreen (Mobile)

**Fichier** : `mobile/src/screens/MesServicesScreen.tsx`

**Modification** : Au lieu d'extraire les produits depuis `service.data.produits`, utiliser l'API

**Ligne ~180-200** : Remplacer `extractProduits` par appel API `productsService.getProductsByService(service.id)`

#### 4.6 Modifier MesProduitsScreen (Mobile)

**Fichier** : `mobile/src/screens/MesProduitsScreen.tsx`

**Modification** : Utiliser `productsService.getProductsByUser(userId)` au lieu d'extraire depuis tous les services

#### 4.7 Modifier MesProduits (Frontend)

**Fichier** : `frontend/src/pages/dashboard/MesProduits.tsx`

**Même modification que mobile**

#### 4.8 Modifier ResultatBesoinScreen (Mobile)

**Fichier** : `mobile/src/screens/ResultatBesoinScreen.tsx`

**Modification** : Les produits viennent déjà de la table via l'API de recherche (backend modifié en Phase 3)

**Vérification** : S'assurer que les produits sont bien affichés

#### 4.9 Modifier ResultatBesoin (Frontend)

**Fichier** : `frontend/src/pages/ResultatBesoin.tsx`

**Même vérification que mobile**

#### 4.10 Modifier FormulaireYukpoIntelligentScreen (Mobile)

**Fichier** : `mobile/src/screens/FormulaireYukpoIntelligentScreen.tsx`

**Modification** : Lors du chargement d'un service existant, récupérer les produits depuis l'API

**Ligne ~1214-1250** : Ajouter appel à `productsService.getProductsByService(serviceId)` après chargement du service

#### 4.11 Modifier FormulaireYukpoIntelligent (Frontend)

**Fichier** : `frontend/src/pages/FormulaireYukpoIntelligent.tsx`

**Même modification que mobile**

#### 4.12 Modifier ProductVideoCreationModal (Mobile)

**Fichier** : `mobile/src/components/ProductVideoCreationModal.tsx`

**Modification** : Récupérer le produit depuis l'API au lieu de `service.data.produits[productIndex]`

#### 4.13 Modifier ProductDeliveryConfigModal (Mobile + Frontend)

**Fichiers** :
- `mobile/src/components/delivery/ProductDeliveryConfigModal.tsx`
- `frontend/src/components/delivery/ProductDeliveryConfigModal.tsx`

**Modification** : Récupérer le produit depuis l'API

#### 4.14 Modifier ImmersiveVideoWizard (Frontend)

**Fichier** : `frontend/src/pages/video/ImmersiveVideoWizard.tsx`

**Ligne ~954** : Remplacer extraction depuis `service.data.produits` par appel API

#### 4.15 Tests Phase 4

1. Tester l'affichage des produits dans MesServices → Vérifier que les produits s'affichent correctement
2. Tester la recherche → Vérifier que les produits sont affichés dans les résultats
3. Tester la création de vidéo produit → Vérifier que le produit est récupéré correctement
4. Tester la configuration de livraison → Vérifier que le produit est accessible

---

### PHASE 5 : Nettoyage et Optimisation Finale (3-5 jours)

**Objectif** : Supprimer les écritures JSONB, nettoyer le code, optimiser

#### 5.1 Supprimer les écritures JSONB (optionnel)

**Décision** : Garder JSONB en lecture seule pour compatibilité ou supprimer complètement ?

**Si suppression** :
- Modifier `creer_service.rs` : Ne plus écrire dans JSONB
- Modifier `product_addition_controller.rs` : Ne plus utiliser `add_product_to_service_jsonb_v2`
- Supprimer la fonction PostgreSQL `add_product_to_service_jsonb_v2`

#### 5.2 Créer une fonction helper pour compatibilité

**Fichier** : `backend/src/services/products_service.rs`

**Ajouter** :
```rust
/// Récupère les produits et les formate comme l'ancien format JSONB (pour compatibilité)
pub async fn get_products_as_jsonb_format(
    &self,
    service_id: i32,
) -> AppResult<Value> {
    let products = self.get_products_by_service(service_id).await?;
    
    let produits_array: Vec<Value> = products
        .into_iter()
        .map(|p| p.product_data)
        .collect();
    
    Ok(json!({
        "type_donnee": "autocomplete",
        "valeur": produits_array,
        "separateur": ",",
        "sous_caracteristiques": {},
        "filtrable": true,
        "origine_champs": "formulaire"
    }))
}
```

#### 5.3 Optimiser les requêtes de recherche

**Créer une vue matérialisée** pour les recherches fréquentes :

```sql
CREATE MATERIALIZED VIEW products_search_cache AS
SELECT 
    p.id,
    p.service_id,
    p.product_index,
    p.product_name,
    p.product_type,
    p.product_price,
    p.is_active,
    s.user_id,
    s.is_active as service_active,
    to_tsvector('french', p.product_name) as search_vector
FROM products p
INNER JOIN services s ON s.id = p.service_id
WHERE p.is_active = true AND s.is_active = true;

CREATE INDEX idx_products_search_cache_vector ON products_search_cache USING GIN(search_vector);

-- Rafraîchir périodiquement
REFRESH MATERIALIZED VIEW CONCURRENTLY products_search_cache;
```

#### 5.4 Nettoyer le code obsolète

**Rechercher et supprimer** :
- Toutes les fonctions qui utilisent `jsonb_array_elements(produits)` sans fallback
- Les commentaires obsolètes
- Le code mort lié à l'ancien système JSONB

#### 5.5 Documentation

**Créer** : `backend/docs/PRODUCTS_TABLE_MIGRATION.md`

**Contenu** :
- Architecture de la table `products`
- Guide d'utilisation de `ProductsService`
- Patterns d'accès recommandés
- Migration des données existantes

#### 5.6 Tests Phase 5

1. Tests de performance : Comparer avant/après
2. Tests d'intégrité : Vérifier que toutes les données sont correctes
3. Tests de régression : Vérifier que toutes les fonctionnalités fonctionnent
4. Tests de charge : Vérifier les performances sous charge

---

## 📊 CHECKLIST DE VALIDATION

### Phase 1 ✅
- [ ] Migration SQL créée (`backend/migrations/20260103_create_products_table.sql`)
- [ ] Fonction `ensure_products_table` créée dans `auto_migrate.rs`
- [ ] Fonction `ensure_products_table` appelée dans `run_all_auto_migrations`
- [ ] Migration SQL appliquée manuellement (optionnel, auto_migrate le fait automatiquement)
- [ ] Table `products` créée avec tous les index
- [ ] `ProductsService` créé avec toutes les méthodes
- [ ] `creer_service.rs` écrit dans JSONB ET table
- [ ] `product_addition_controller.rs` écrit dans JSONB ET table
- [ ] `save_autocomplete_combination` modifié pour utiliser `product_id` de table `products`
- [ ] `product_addition_controller.rs` modifié pour mettre à jour `autocomplete_characteristics` avec `product_id`
- [ ] `ProductsService` ajouté au `AppState`
- [ ] Tests : Vérifier écriture double
- [ ] Tests : Vérifier que `autocomplete_characteristics.product_id` référence bien `products.id`

### Phase 2 ✅
- [ ] Script de migration SQL créé (`backend/migrations/20260104_migrate_existing_products.sql`)
- [ ] Fonction `migrate_existing_products_to_table` créée dans `auto_migrate.rs`
- [ ] Fonction `migrate_existing_products_to_table` appelée dans `run_all_auto_migrations`
- [ ] Script de migration SQL créé pour `autocomplete_product_ids` (`backend/migrations/20260104_migrate_autocomplete_product_ids.sql`)
- [ ] Fonction `migrate_autocomplete_product_ids` créée dans `auto_migrate.rs`
- [ ] Fonction `migrate_autocomplete_product_ids` appelée dans `run_all_auto_migrations`
- [ ] Migration des données existantes exécutée (automatiquement au démarrage)
- [ ] Migration des `product_id` dans `autocomplete_characteristics` exécutée (automatiquement au démarrage)
- [ ] Vérification d'intégrité : 0 différences
- [ ] Tests : Tous les produits migrés
- [ ] Tests : Tous les `autocomplete_characteristics.product_id` référencent bien `products.id`

### Phase 3 ✅
- [ ] Endpoints API Products créés
- [ ] `native_search_service.rs` modifié
- [ ] `rechercher_besoin.rs` modifié
- [ ] `scheduling_search_service.rs` modifié
- [ ] `image_search_service.rs` modifié
- [ ] `video_generation_service.rs` modifié
- [ ] `delivery_service.rs` modifié
- [ ] `autocomplete_client_service.rs` modifié pour utiliser table `products`
- [ ] `native_search_service.rs` modifié pour utiliser table `products` dans les recherches avec `autocomplete_characteristics`
- [ ] Routes Products ajoutées
- [ ] Tests : Recherches fonctionnent depuis table
- [ ] Tests : Suggestions autocomplete fonctionnent avec table `products`

### Phase 4 ✅
- [ ] `productsService.ts` créé (frontend)
- [ ] `productsService.ts` créé (mobile)
- [ ] `ProductCard` modifié (frontend + mobile)
- [ ] `MesServicesScreen` modifié (mobile)
- [ ] `MesProduitsScreen` modifié (mobile)
- [ ] `MesProduits` modifié (frontend)
- [ ] `ResultatBesoinScreen` modifié (mobile)
- [ ] `ResultatBesoin` modifié (frontend)
- [ ] `FormulaireYukpoIntelligentScreen` modifié (mobile)
- [ ] `FormulaireYukpoIntelligent` modifié (frontend)
- [ ] `ProductVideoCreationModal` modifié (mobile)
- [ ] `ProductDeliveryConfigModal` modifié (mobile + frontend)
- [ ] `GlobalDeliveryConfigModal` modifié (mobile)
- [ ] `ProductManagerMobile` modifié (mobile)
- [ ] `ServiceProductSelector` modifié (mobile)
- [ ] `ShoppingProductPicker` modifié (mobile)
- [ ] `SuggestedProducts` modifié (mobile)
- [ ] `ProductDeliveryZonesSelector` modifié (mobile + frontend)
- [ ] `ShoppingBasketCard` modifié (mobile)
- [ ] `ShoppingItemsList` modifié (frontend)
- [ ] `ProductPricing` modifié (frontend)
- [ ] `ProductGrid` modifié (frontend)
- [ ] `ProductListManager` modifié (frontend)
- [ ] `ProductReactivationModal` modifié (frontend)
- [ ] `CreatePublicitePage` modifié (frontend)
- [ ] `CreatePubliciteScreen` modifié (mobile)
- [ ] `GlobalPromoManager` modifié (frontend)
- [ ] `ProductShowcase` modifié (frontend - Remotion)
- [ ] `ImmersiveVideoWizard` modifié (frontend)
- [ ] Tous les hooks utilisant les produits modifiés
- [ ] Tous les services utilisant les produits modifiés
- [ ] Tous les utils utilisant les produits modifiés
- [ ] Tests : Tous les écrans fonctionnent

### Phase 5 ✅
- [ ] Décision prise : Garder ou supprimer JSONB
- [ ] Code obsolète nettoyé
- [ ] Vue matérialisée créée (optionnel)
- [ ] Documentation créée
- [ ] Tests de performance : Amélioration confirmée
- [ ] Tests de régression : Toutes fonctionnalités OK

---

## 🔍 POINTS D'ATTENTION CRITIQUES

### 1. Compatibilité avec autocomplete_characteristics

**Fichier** : `backend/src/services/creer_service.rs`, `backend/src/services/autocomplete_client_service.rs`, `backend/src/services/native_search_service.rs`

**Vérifier** : 
- La table `autocomplete_characteristics` a une colonne `product_id TEXT` qui doit référencer l'`id` de la table `products`
- Après migration, tous les `product_id` doivent être valides (référencer des `products.id` existants)
- Les recherches utilisant `autocomplete_characteristics` doivent JOIN sur `products` pour récupérer les données produit

### 2. Compatibilité avec products_lifecycle

**Fichier** : `backend/src/controllers/product_lifecycle_controller.rs`

**Vérifier** : La table `products_lifecycle` utilise `service_id` et `product_index`. S'assurer que la migration préserve ces références.

### 3. Compatibilité avec media.product_index

**Vérifier** : La table `media` a une colonne `product_index`. S'assurer que les références restent valides après migration.

### 4. Compatibilité avec video_generation_jobs

**Vérifier** : Les jobs de génération vidéo utilisent `product_index`. S'assurer que la migration ne casse pas ces références.

### 4. Ordre des produits (product_index)

**Critique** : Le `product_index` doit être préservé exactement. Un produit à l'index 0 dans JSONB doit être à l'index 0 dans la table.

### 5. Format des données produit

**Vérifier** : Le format `product_data` JSONB doit être identique à celui dans `services.data->'produits'->'valeur'[index]`

---

## 🚨 ROLLBACK PLAN

En cas de problème, plan de rollback :

1. **Phase 1-2** : Les données JSONB sont toujours là, on peut supprimer la table `products` et continuer avec JSONB
2. **Phase 3** : Ajouter un fallback JSONB dans les recherches si la table `products` est vide
3. **Phase 4** : Les composants peuvent avoir un fallback vers l'ancien format
4. **Phase 5** : Pas de rollback possible, mais les phases précédentes sont stables

---

## 📈 MÉTRIQUES DE SUCCÈS

### Performance
- ✅ Ajout produit : < 1s (au lieu de 30-60s)
- ✅ Recherche produits : < 100ms (au lieu de 200-500ms)
- ✅ Affichage MesProduits : < 500ms (au lieu de 1-2s)

### Intégrité
- ✅ 100% des produits migrés
- ✅ 0 différences entre JSONB et table (Phase 1-2)
- ✅ Toutes les fonctionnalités fonctionnent

### Code
- ✅ Réduction du code complexe JSONB
- ✅ Requêtes SQL standard
- ✅ Meilleure maintenabilité

---

## 🎯 INSTRUCTIONS FINALES

1. **Commencer par Phase 1** : Créer la table et l'écriture double
2. **Tester chaque phase** avant de passer à la suivante
3. **Valider l'intégrité** à chaque étape
4. **Documenter les changements** au fur et à mesure
5. **Surveiller les performances** après chaque phase

**Durée totale estimée** : 3-4 semaines
**Fichiers impactés** : ~150 fichiers
**Complexité** : Moyenne (migration progressive possible)

---

## 📝 NOTES IMPORTANTES

- **Ne pas supprimer le JSONB immédiatement** : Garder pour compatibilité pendant la transition
- **Tester en environnement de staging** avant production
- **Faire des backups** avant chaque phase
- **Monitorer les logs** pour détecter les problèmes
- **Valider avec les utilisateurs** que tout fonctionne correctement

---

**Ce prompt doit être utilisé dans une session dédiée pour implémenter la migration complète en suivant les 5 phases dans l'ordre.**

