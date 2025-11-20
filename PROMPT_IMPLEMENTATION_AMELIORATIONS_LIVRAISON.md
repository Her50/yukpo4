# 🚀 Prompt d'Implémentation : Améliorations Workflow de Livraison

## 📋 Contexte

Ce prompt décrit l'implémentation complète des améliorations du workflow de livraison décrites dans le document **`ANALYSE_WORKFLOW_LIVRAISON_AMELIORATIONS.md`**.

Le système doit être implémenté dans :
- **Backend** : Rust avec Axum, SQLx, PostgreSQL
- **Mobile** : React Native avec TypeScript
- **Frontend** : React avec TypeScript

---

## 🎯 Objectifs

Implémenter les améliorations principales :

1. ✅ **Vérification disponibilité par jour + Suggestion produits similaires**
2. ✅ **Système de temps de préparation** (avec option disponibilité immédiate)
   - ✅ **Calcul dynamique par catégorie** : Durée par défaut calculée automatiquement depuis données historiques
3. ✅ **Validation prestataire avec workflow complet**
   - ✅ **Monitor timeout** : Annulation automatique si prestataire ne valide pas dans les délais
4. ✅ **Gestion stock en temps réel**
5. ✅ **Notifications intelligentes + Redirection automatique**
6. ✅ **Système de pénalités** : Débit automatique prestataire si produit indisponible signalé par coursier
7. ✅ **Métriques d'annulation** : Dashboard avec taux d'annulation, pénalités, indicateurs sur ProductCard

### Points Importants à Respecter

- **Disponibilité immédiate** : Le prestataire peut marquer un produit comme "disponible immédiatement" (pas de délai de préparation). Dans ce cas, le matching coursier démarre directement après validation.
- **Affichage lieux pickup** : Les lieux de pickup doivent toujours s'afficher en **adresse textuelle** (ex: "123 Rue de la Paix, Douala"), jamais en coordonnées GPS brutes, pour faciliter la compréhension par les utilisateurs.
- **Indicateurs dans ProductCard** : Tous les ProductCard (mobile ET frontend) doivent afficher des badges visuels indiquant la capacité de livraison rapide :
  - Badge "⚡ Livraison rapide" si disponibilité immédiate
  - Badge "⏱️ Prêt en X min" si délai de préparation
  - Badge "📅 Disponible [jours]" si jours spécifiques
  - **Badge "⚠️ Taux d'annulation"** si `cancellation_rate >= 10%` (rouge/orange/jaune selon le taux)
- **Dashboard & Analytics Prestataire** : Toutes les nouvelles métriques (délais préparation, produits rejetés, **annulations, pénalités**, etc.) doivent être intégrées dans le dashboard/analytics du prestataire avec graphiques et statistiques détaillées.
- **Durée de préparation dynamique** : Si `preparation_time_minutes` est NULL, utiliser valeur calculée automatiquement par catégorie depuis données historiques (médiane des temps observés).
- **Gestion timeout** : Si prestataire ne valide pas avant `validation_deadline`, commande automatiquement rejetée, annulation enregistrée, produits similaires recherchés, client notifié avec redirection.

---

## 📚 Référence Documentaire

**Document principal** : `ANALYSE_WORKFLOW_LIVRAISON_AMELIORATIONS.md`

Ce document contient :
- Analyse détaillée de chaque amélioration
- Schémas de workflow complets
- Code Rust de référence pour les services
- Migrations SQL proposées
- Plan d'implémentation par phases

**⚠️ IMPORTANT** : Consulter ce document avant de commencer l'implémentation pour comprendre l'architecture complète.

---

## 🗄️ PARTIE 1 : Migrations Base de Données

### Contraintes SQLx Mode Offline

**⚠️ CRITIQUE** : Le projet utilise SQLx en mode **OFFLINE**. Cela signifie :

1. **Toutes les migrations doivent être dans 2 endroits** :
   - Fichier SQL dans `backend/migrations/YYYYMMDD_NNN_description.sql`
   - Fonction dans `backend/src/migrations/auto_migrate.rs`

2. **Format de nom de migration** :
   ```
   YYYYMMDD_NNN_description.sql
   ```
   Exemple : `20250120_001_add_order_preparation_system.sql`

3. **Après création d'une migration** :
   ```bash
   # 1. Appliquer la migration
   cd backend
   sqlx migrate run
   
   # 2. Régénérer les métadonnées offline (CRITIQUE)
   cargo sqlx prepare
   
   # 3. Tester compilation offline
   export SQLX_OFFLINE=true  # Linux/Mac
   $env:SQLX_OFFLINE="true"  # PowerShell
   cargo build
   
   # 4. Commiter TOUT (migration + .sqlx/*.json)
   git add migrations/YYYYMMDD_NNN_description.sql
   git add .sqlx/*.json
   ```

4. **Pattern dans auto_migrate.rs** :
   - Utiliser `sqlx::query()` avec `CREATE TABLE IF NOT EXISTS`
   - Séparer chaque `CREATE INDEX` en un appel `sqlx::query()` distinct
   - Utiliser `run_delivery_step()` pour les migrations delivery (voir exemples existants)
   - Logger avec `info!()` et `error!()`

### Migrations à Créer

#### Migration 1 : Temps de préparation + Disponibilité par jour

**Fichier** : `backend/migrations/20250120_001_add_order_preparation_system.sql`

```sql
-- Migration: Système de temps de préparation et disponibilité par jour
-- Date: 2025-01-20
-- Description: Ajoute colonnes pour temps de préparation et jours de disponibilité

-- 1. Ajouter colonnes à product_delivery_config
ALTER TABLE product_delivery_config
ADD COLUMN IF NOT EXISTS preparation_time_minutes INTEGER,
-- NULL = utiliser valeur dynamique calculée par catégorie
-- Si défini, utilise cette valeur spécifique au produit
ADD COLUMN IF NOT EXISTS max_preparation_time_minutes INTEGER DEFAULT 60,
ADD COLUMN IF NOT EXISTS availability_days INTEGER[] DEFAULT ARRAY[0,1,2,3,4,5,6],
ADD COLUMN IF NOT EXISTS is_immediately_available BOOLEAN DEFAULT FALSE;
-- 0=dimanche, 1=lundi, ..., 6=samedi
-- is_immediately_available: TRUE = pas de délai de préparation, matching coursier immédiat

-- 1.1. Table pour stocker les durées de préparation observées par catégorie
CREATE TABLE IF NOT EXISTS category_preparation_stats (
    id SERIAL PRIMARY KEY,
    category VARCHAR(255) NOT NULL UNIQUE,
    avg_preparation_minutes NUMERIC(10,2) NOT NULL DEFAULT 5.0,
    median_preparation_minutes NUMERIC(10,2) NOT NULL DEFAULT 5.0,
    sample_count INTEGER NOT NULL DEFAULT 0,
    last_calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_category_preparation_stats_category 
ON category_preparation_stats(category);

-- 2. Index pour recherche par jours de disponibilité
CREATE INDEX IF NOT EXISTS idx_product_delivery_config_availability_days 
ON product_delivery_config USING GIN(availability_days);

-- 3. Table commandes avec workflow de préparation
CREATE TABLE IF NOT EXISTS product_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delivery_id UUID REFERENCES deliveries(id) ON DELETE CASCADE,
    service_id INTEGER NOT NULL REFERENCES services(id),
    product_index INTEGER NOT NULL,
    client_user_id INTEGER NOT NULL REFERENCES users(id),
    provider_user_id INTEGER NOT NULL REFERENCES users(id),
    status TEXT NOT NULL DEFAULT 'pending', 
    -- pending, validated, preparing, ready, courier_assigned, picked_up, delivered, cancelled, rejected
    preparation_time_minutes INTEGER,
    estimated_ready_at TIMESTAMPTZ,
    validated_at TIMESTAMPTZ,
    validated_by INTEGER REFERENCES users(id),
    rejected_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- 4. Index pour product_orders
CREATE INDEX IF NOT EXISTS idx_product_orders_status 
ON product_orders(status, created_at);

CREATE INDEX IF NOT EXISTS idx_product_orders_provider 
ON product_orders(provider_user_id, status);

CREATE INDEX IF NOT EXISTS idx_product_orders_delivery 
ON product_orders(delivery_id) WHERE delivery_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_product_orders_estimated_ready 
ON product_orders(estimated_ready_at) WHERE estimated_ready_at IS NOT NULL;

-- 3.1. Ajouter colonne validation_deadline à product_orders pour gérer les timeouts
ALTER TABLE product_orders
ADD COLUMN IF NOT EXISTS validation_deadline TIMESTAMPTZ;
-- Deadline pour que le prestataire valide la commande

CREATE INDEX IF NOT EXISTS idx_product_orders_validation_deadline 
ON product_orders(validation_deadline) 
WHERE status = 'pending' AND validation_deadline IS NOT NULL;

-- 3.2. Table pour enregistrer les annulations (timeout, rejet, etc.)
CREATE TABLE IF NOT EXISTS order_cancellations (
    id SERIAL PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES product_orders(id) ON DELETE CASCADE,
    provider_user_id INTEGER NOT NULL REFERENCES users(id),
    service_id INTEGER NOT NULL REFERENCES services(id),
    product_index INTEGER NOT NULL,
    cancellation_type VARCHAR(50) NOT NULL CHECK (cancellation_type IN ('timeout', 'rejected', 'provider_cancelled', 'courier_unavailable')),
    reason TEXT,
    cancelled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_cancellations_provider 
ON order_cancellations(provider_user_id, cancelled_at);

CREATE INDEX IF NOT EXISTS idx_order_cancellations_service_product 
ON order_cancellations(service_id, product_index, cancellation_type);

-- 3.3. Table pour calculer les statistiques d'annulation par produit
CREATE TABLE IF NOT EXISTS product_cancellation_stats (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    product_index INTEGER NOT NULL,
    total_orders INTEGER NOT NULL DEFAULT 0,
    total_cancellations INTEGER NOT NULL DEFAULT 0,
    cancellation_rate NUMERIC(5,2) NOT NULL DEFAULT 0.0, -- Pourcentage
    timeout_cancellations INTEGER NOT NULL DEFAULT 0,
    rejected_cancellations INTEGER NOT NULL DEFAULT 0,
    last_calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(service_id, product_index)
);

CREATE INDEX IF NOT EXISTS idx_product_cancellation_stats_rate 
ON product_cancellation_stats(cancellation_rate DESC);
```

**Fonction dans auto_migrate.rs** :

```rust
/// ✅ NOUVEAU : Système de temps de préparation et disponibilité par jour
pub async fn ensure_order_preparation_system(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification du système de préparation de commandes...");
    
    // 1. Ajouter colonnes à product_delivery_config
    sqlx::query(
        r#"
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'product_delivery_config' 
                AND column_name = 'preparation_time_minutes'
            ) THEN
                ALTER TABLE product_delivery_config
                ADD COLUMN preparation_time_minutes INTEGER,
                -- NULL = utiliser valeur dynamique calculée par catégorie
                ADD COLUMN max_preparation_time_minutes INTEGER DEFAULT 60,
                ADD COLUMN availability_days INTEGER[] DEFAULT ARRAY[0,1,2,3,4,5,6],
                ADD COLUMN is_immediately_available BOOLEAN DEFAULT FALSE;
            END IF;
        END
        $$;
        "#,
    )
    .execute(pool)
    .await?;
    
    // 2. Index pour availability_days
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_product_delivery_config_availability_days ON product_delivery_config USING GIN(availability_days)",
    )
    .execute(pool)
    .await?;
    
    // 3. Table product_orders
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS product_orders (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            delivery_id UUID REFERENCES deliveries(id) ON DELETE CASCADE,
            service_id INTEGER NOT NULL REFERENCES services(id),
            product_index INTEGER NOT NULL,
            client_user_id INTEGER NOT NULL REFERENCES users(id),
            provider_user_id INTEGER NOT NULL REFERENCES users(id),
            status TEXT NOT NULL DEFAULT 'pending',
            preparation_time_minutes INTEGER,
            estimated_ready_at TIMESTAMPTZ,
            validated_at TIMESTAMPTZ,
            validated_by INTEGER REFERENCES users(id),
            rejected_at TIMESTAMPTZ,
            rejection_reason TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            metadata JSONB DEFAULT '{}'::jsonb
        )
        "#,
    )
    .execute(pool)
    .await?;
    
    // 4. Index pour product_orders (séparés)
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_product_orders_status ON product_orders(status, created_at)",
    )
    .execute(pool)
    .await?;
    
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_product_orders_provider ON product_orders(provider_user_id, status)",
    )
    .execute(pool)
    .await?;
    
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_product_orders_delivery ON product_orders(delivery_id) WHERE delivery_id IS NOT NULL",
    )
    .execute(pool)
    .await?;
    
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_product_orders_estimated_ready ON product_orders(estimated_ready_at) WHERE estimated_ready_at IS NOT NULL",
    )
    .execute(pool)
    .await?;
    
    // 4.1. Ajouter colonne validation_deadline
    sqlx::query(
        "ALTER TABLE product_orders ADD COLUMN IF NOT EXISTS validation_deadline TIMESTAMPTZ"
    )
    .execute(pool)
    .await?;
    
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_product_orders_validation_deadline ON product_orders(validation_deadline) WHERE status = 'pending' AND validation_deadline IS NOT NULL"
    )
    .execute(pool)
    .await?;
    
    // 4.2. Table order_cancellations
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS order_cancellations (
            id SERIAL PRIMARY KEY,
            order_id UUID NOT NULL REFERENCES product_orders(id) ON DELETE CASCADE,
            provider_user_id INTEGER NOT NULL REFERENCES users(id),
            service_id INTEGER NOT NULL REFERENCES services(id),
            product_index INTEGER NOT NULL,
            cancellation_type VARCHAR(50) NOT NULL CHECK (cancellation_type IN ('timeout', 'rejected', 'provider_cancelled', 'courier_unavailable')),
            reason TEXT,
            cancelled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        "#
    )
    .execute(pool)
    .await?;
    
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_order_cancellations_provider ON order_cancellations(provider_user_id, cancelled_at)"
    )
    .execute(pool)
    .await?;
    
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_order_cancellations_service_product ON order_cancellations(service_id, product_index, cancellation_type)"
    )
    .execute(pool)
    .await?;
    
    // 4.3. Table product_cancellation_stats
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS product_cancellation_stats (
            id SERIAL PRIMARY KEY,
            service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
            product_index INTEGER NOT NULL,
            total_orders INTEGER NOT NULL DEFAULT 0,
            total_cancellations INTEGER NOT NULL DEFAULT 0,
            cancellation_rate NUMERIC(5,2) NOT NULL DEFAULT 0.0,
            timeout_cancellations INTEGER NOT NULL DEFAULT 0,
            rejected_cancellations INTEGER NOT NULL DEFAULT 0,
            last_calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE(service_id, product_index)
        )
        "#
    )
    .execute(pool)
    .await?;
    
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_product_cancellation_stats_rate ON product_cancellation_stats(cancellation_rate DESC)"
    )
    .execute(pool)
    .await?;
    
    Ok(())
}
```

**Ajouter dans `run_auto_migrations()`** :

```rust
// Dans la fonction run_auto_migrations(), après les autres migrations
match ensure_order_preparation_system(pool).await {
    Ok(_) => info!("✅ Migration auto: order preparation system OK"),
    Err(e) => error!("❌ Erreur migration auto order preparation: {}", e),
}
```

#### Migration 2 : Gestion Stock

**Fichier** : `backend/migrations/20250120_002_add_product_stock_management.sql`

```sql
-- Migration: Gestion de stock en temps réel
-- Date: 2025-01-20

-- 1. Table stock par lieu
CREATE TABLE IF NOT EXISTS product_stock_locations (
    id SERIAL PRIMARY KEY,
    product_delivery_config_id INTEGER NOT NULL REFERENCES product_delivery_config(id) ON DELETE CASCADE,
    storage_location_id INTEGER REFERENCES merchant_storage_locations(id),
    quantity_available INTEGER DEFAULT 0,
    quantity_reserved INTEGER DEFAULT 0,
    is_available BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by INTEGER REFERENCES users(id),
    UNIQUE(product_delivery_config_id, storage_location_id)
);

-- 2. Index pour product_stock_locations
CREATE INDEX IF NOT EXISTS idx_product_stock_locations_config 
ON product_stock_locations(product_delivery_config_id);

CREATE INDEX IF NOT EXISTS idx_product_stock_locations_available 
ON product_stock_locations(is_available, quantity_available) 
WHERE is_available = TRUE;

-- 3. Table réservations stock
CREATE TABLE IF NOT EXISTS stock_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES product_orders(id) ON DELETE CASCADE,
    stock_location_id INTEGER NOT NULL REFERENCES product_stock_locations(id),
    quantity INTEGER NOT NULL,
    reserved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    released_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL
);

-- 4. Index pour stock_reservations
CREATE INDEX IF NOT EXISTS idx_stock_reservations_order 
ON stock_reservations(order_id);

CREATE INDEX IF NOT EXISTS idx_stock_reservations_expires 
ON stock_reservations(expires_at) WHERE released_at IS NULL;
```

**Fonction dans auto_migrate.rs** (même pattern que ci-dessus)

---

## 🔧 PARTIE 2 : Backend (Rust)

### Structure des Services

Créer les services suivants dans `backend/src/services/` :

1. **`product_availability_service.rs`** - Vérification disponibilité + produits similaires
2. **`order_preparation_service.rs`** - Workflow de préparation
3. **`product_stock_service.rs`** - Gestion stock
4. **`smart_notification_service.rs`** - Notifications intelligentes
5. **`similar_products_service.rs`** - Recherche produits similaires
6. **`dynamic_preparation_time_service.rs`** - Calcul dynamique durée par catégorie (NOUVEAU)
7. **`order_timeout_monitor.rs`** - Monitor timeout validation commandes (NOUVEAU - dans tasks/)

### Patterns à Suivre

**1. Structure de service standard** :

```rust
use crate::core::types::{AppError, AppResult};
use sqlx::PgPool;
use chrono::{DateTime, Utc};

pub struct ProductAvailabilityService {
    pool: PgPool,
}

impl ProductAvailabilityService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
    
    // Méthodes publiques
}
```

**2. Gestion d'erreurs** :
- Utiliser `AppResult<T>` et `AppError`
- Logger avec `log::info!()`, `log::error!()`, `log::warn!()`

**3. Requêtes SQL** :
- Utiliser `sqlx::query()` avec bindings
- Préparer les requêtes pour mode offline (`cargo sqlx prepare`)

**4. Transactions** :
- Utiliser `pool.begin()` pour opérations multiples
- Commit/rollback appropriés

### Routes API à Créer/Modifier

Dans `backend/src/routes/delivery_routes.rs` :

1. **Modifier `create_client_order`** :
   - Vérifier disponibilité avant création
   - Retourner produits similaires si indisponible
   - **IMPORTANT** : Toujours retourner les adresses textuelles des lieux pickup, jamais les coordonnées GPS brutes

2. **Nouvelles routes** :
   - `POST /api/delivery/orders/:order_id/validate` - Prestataire valide
     - Si `is_immediately_available = TRUE`, passer directement à statut "Ready" et démarrer matching
   - `POST /api/delivery/orders/:order_id/reject` - Prestataire invalide
   - `GET /api/delivery/orders/:order_id/similar` - Produits similaires
   - `PUT /api/delivery/stock/:config_id` - Mettre à jour stock
   - `DELETE /api/delivery/stock/:config_id/location/:location_id` - Supprimer lieu stock
   - `GET /api/delivery/config/:config_id/pickup-locations` - Liste lieux pickup (retourner adresses, pas GPS)

3. **Routes Analytics Prestataire** (NOUVEAU) :
   - `GET /api/provider/:provider_id/analytics/orders` - Statistiques commandes
   - `GET /api/provider/:provider_id/analytics/preparation-time` - Métriques délais préparation
   - `GET /api/provider/:provider_id/analytics/rejections` - Analyse produits rejetés
   - `GET /api/provider/:provider_id/analytics/product-performance` - Performance par produit
   - `GET /api/provider/:provider_id/analytics/availability-stats` - Stats disponibilité immédiate
   - `GET /api/provider/:provider_id/analytics/dashboard` - Données complètes dashboard

### Intégration avec Services Existants

**Modifier `delivery_service.rs`** :
- Dans `enqueue_delivery_matching()`, vérifier si commande est "Ready"
- Ne pas démarrer matching si statut != Ready
- **IMPORTANT** : Si `is_immediately_available = TRUE`, démarrer matching immédiatement après validation (pas d'attente)

**Modifier routes de recherche produits** :
- Dans les routes qui retournent des produits (ex: `/api/search`, `/api/services`), inclure les données de `product_delivery_config` :
  - `is_immediately_available`
  - `preparation_time_minutes`
  - `availability_days`
- Ces données seront utilisées par les ProductCard pour afficher les badges

**Modifier `delivery_matching_worker.rs`** :
- Vérifier `estimated_ready_at` avant matching
- Attendre si commande pas encore prête

---

## 📱 PARTIE 3 : Mobile (React Native)

### Écrans à Créer/Modifier

1. **`ResultatBesoinScreen.tsx`** (MODIFIER - Déjà existe)
   - ✅ **Déjà implémenté** : Accepte `route.params.results` pour précharger des produits
   - ✅ **Déjà implémenté** : Accepte `route.params.searchQuery` pour préremplir la recherche
   - **Utilisation** : Navigation depuis notifications avec produits similaires préchargés
   - **Pas besoin de créer `SimilarProductsScreen`** : Réutiliser `ResultatBesoinScreen` avec paramètres

2. **`OrderStatusScreen.tsx`** (NOUVEAU)
   - Suivi commande avec statuts (Pending → Validated → Ready → etc.)
   - Notifications temps réel

3. **`ProviderOrderManagementScreen.tsx`** (NOUVEAU)
   - Liste commandes en attente
   - Actions : Valider / Invalider / Modifier stock
   - Notifications sonores nouvelles commandes

### Services API Mobile

Dans `mobile/src/services/` :

1. **`orderService.ts`** :
```typescript
export const orderService = {
  createOrder: async (orderData: CreateOrderPayload) => {
    // Créer commande avec vérification disponibilité
    // IMPORTANT: Les lieux pickup retournés doivent être en adresse textuelle
  },
  validateOrder: async (orderId: string, estimatedReadyAt?: Date) => {
    // Prestataire valide commande
    // Si is_immediately_available = true, estimatedReadyAt peut être null
  },
  rejectOrder: async (orderId: string, reason: string) => {
    // Prestataire invalide commande
  },
  getSimilarProducts: async (orderId: string) => {
    // Récupérer produits similaires
  },
  getPickupLocations: async (configId: number) => {
    // Récupérer lieux pickup (retourne adresses textuelles, pas GPS)
  },
};

2. **`productDeliveryService.ts`** (NOUVEAU) :
```typescript
export const productDeliveryService = {
  getDeliveryConfig: async (serviceId: number, productIndex: number) => {
    // Récupérer product_delivery_config pour un produit
    // Retourne : is_immediately_available, preparation_time_minutes, availability_days
  },
  formatAvailabilityDays: (days: number[]) => {
    // Formater les jours pour affichage (ex: [1,2,3,4,5] -> "Lun-Ven")
    // 0=dimanche, 1=lundi, ..., 6=samedi
  },
};
```

2. **`stockService.ts`** :
```typescript
export const stockService = {
  updateStock: async (configId: number, locationId: number, quantity: number) => {
    // Mettre à jour stock
  },
  removeStockLocation: async (configId: number, locationId: number) => {
    // Supprimer lieu stockage
  },
};
```

### Notifications Sonores

Dans `mobile/src/services/notificationService.ts` :

```typescript
import Sound from 'react-native-sound';

export const playNotificationSound = (type: 'order' | 'courier' | 'ready') => {
  const sounds = {
    order: require('../assets/sounds/order_notification.wav'),
    courier: require('../assets/sounds/courier_assigned.wav'),
    ready: require('../assets/sounds/order_ready.wav'),
  };
  
  const sound = new Sound(sounds[type], Sound.MAIN_BUNDLE, (error) => {
    if (!error) {
      sound.play();
    }
  });
};
```

### Redirection vers ResultatBesoinScreen avec Produits Préchargés

**⚠️ IMPORTANT** : `ResultatBesoinScreen` accepte déjà des paramètres de route pour précharger des produits. C'est techniquement possible et déjà implémenté !

**Solution technique** :

1. **Backend : Inclure produits similaires dans la notification**

```rust
// backend/src/services/smart_notification_service.rs
pub async fn notify_client_order_rejected_with_alternatives(
    &self,
    client_user_id: i32,
    order_id: Uuid,
    alternatives: Vec<AlternativeProduct>,
) -> AppResult<()> {
    // Construire le payload de notification avec produits préchargés
    let notification_data = json!({
        "type": "order_rejected_with_alternatives",
        "order_id": order_id,
        "alternatives": alternatives,  // ✅ Produits similaires déjà recherchés
        "redirect": {
            "screen": "ResultatBesoin",
            "params": {
                "results": alternatives,  // ✅ Produits à afficher directement
                "searchQuery": alternatives.first().map(|p| p.name.clone()).unwrap_or_default(),
                "type": "similar_products",
                "title": "Produits similaires disponibles"
            }
        }
    });

    // Envoyer notification push
    self.push_service.send_push_notification(
        client_user_id,
        "🔄 Produit non disponible",
        "Voici des alternatives disponibles",
        Some(notification_data),
    ).await?;

    Ok(())
}
```

2. **Mobile : Gestionnaire de notifications**

```typescript
// mobile/src/components/PushNotificationManager.tsx
import { useNavigation } from '@react-navigation/native';

// Dans le gestionnaire de notifications
const handleNotificationPress = (notification: any) => {
  const data = notification.data;
  
  if (data?.type === 'order_rejected_with_alternatives' && data?.redirect) {
    const { screen, params } = data.redirect;
    
    // ✅ Navigation vers ResultatBesoin avec produits préchargés
    navigation.navigate(screen, params);
    // params contient : { results: [...], searchQuery: "...", type: "similar_products" }
  }
};
```

3. **ResultatBesoinScreen : Utilisation des paramètres (DÉJÀ IMPLÉMENTÉ)**

```typescript
// mobile/src/screens/ResultatBesoinScreen.tsx
// ✅ DÉJÀ IMPLÉMENTÉ : Le screen accepte route.params.results
useEffect(() => {
  const params = route.params as any;
  
  if (params?.results) {
    // ✅ Produits déjà préchargés, pas besoin de recherche
    setResults(params.results);
    if (params.searchQuery) {
      setSearchQuery(params.searchQuery);
    }
  }
}, [route.params]);
```

**Workflow complet** :

1. **Prestataire rejette commande** → Backend cherche produits similaires
2. **Backend envoie notification** → Avec `alternatives` dans le payload
3. **Client clique notification** → `PushNotificationManager` intercepte
4. **Navigation automatique** → Vers `ResultatBesoin` avec `params.results = alternatives`
5. **ResultatBesoin affiche** → Produits déjà chargés, pas de recherche nécessaire

**Avantages** :
- ✅ Pas de recherche supplémentaire côté client
- ✅ Expérience fluide (produits affichés immédiatement)
- ✅ Réutilise l'infrastructure existante (`route.params`)
- ✅ Compatible avec deep linking pour notifications externes

### Navigation

Dans `mobile/src/navigation/` :

- ✅ **Pas besoin de route `SimilarProducts`** : Utiliser `ResultatBesoin` avec paramètres
- Ajouter route `OrderStatus` 
- Ajouter route `ProviderOrderManagement`

---

## 🖥️ PARTIE 4 : Frontend (React)

### Pages à Créer/Modifier

1. **`SimilarProductsPage.tsx`** (NOUVEAU)
   - Même logique que mobile mais pour web
   - Design responsive

2. **`OrderManagementPage.tsx`** (NOUVEAU)
   - Dashboard prestataire pour gérer commandes
   - Tableau avec filtres par statut
   - **Même fonctionnalités que mobile** : Statistiques, métriques, graphiques

3. **`ProductCard.tsx`** (MODIFIER)
   - **Même indicateurs que mobile** :
     - Badge "⚡ Livraison rapide" si `is_immediately_available = TRUE`
     - Badge "⏱️ Prêt en X min" si `preparation_time_minutes > 0`
     - Badge "📅 Disponible [jours]" si `availability_days` est défini
   - **Design responsive** : S'adapter aux différentes tailles d'écran
   - **Tooltip** : Au survol, afficher plus de détails (ex: "Disponible immédiatement - Livraison en moins de 30 min")

3. **`ProviderAnalyticsPage.tsx`** (MODIFIER/CRÉER)
   - **Analytics avancés** :
     - Statistiques détaillées sur délais de préparation
     - Analyse des produits rejetés (raisons, fréquences)
     - **Analyse annulations** :
       - Nombre total d'annulations (timeout, rejet prestataire, annulation prestataire, coursier indisponible)
       - Taux d'annulation par produit (pourcentage)
       - Raisons d'annulation les plus fréquentes
       - Évolution du taux d'annulation dans le temps
       - Produits avec taux d'annulation élevé (> 20%)
     - **Pénalités** :
       - Nombre de pénalités (produit indisponible signalé par coursier)
       - Montant total débité pour pénalités
       - Montant moyen par pénalité
       - Évolution des pénalités dans le temps
     - Performance par produit (temps préparation, taux validation, taux annulation)
     - Comparaison produits disponibles immédiatement vs avec délai
     - Impact des délais sur satisfaction client
   - **Rapports exportables** :
     - Export CSV/PDF des métriques
     - Rapports mensuels/hebdomadaires
   - **Recommandations** :
     - Suggestions d'optimisation des délais
     - Produits à marquer comme "disponibles immédiatement"
     - Identification des problèmes récurrents

### Services API Frontend

Dans `frontend/src/services/` :

- Même structure que mobile mais adapté pour web
- Utiliser `axios` ou `fetch` pour appels API

1. **`providerAnalyticsService.ts`** (NOUVEAU) :
```typescript
export const providerAnalyticsService = {
  getOrderStatistics: async (providerId: number, dateRange?: DateRange) => {
    // Statistiques commandes (pending, validated, rejected, etc.)
  },
  getPreparationTimeMetrics: async (providerId: number) => {
    // Métriques délais de préparation
    // Temps moyen, médian, par produit, etc.
  },
  getRejectionAnalytics: async (providerId: number) => {
    // Analyse des rejets (raisons, fréquences, tendances)
  },
  getCancellationAnalytics: async (providerId: number) => {
    // Analyse des annulations (timeout, rejet, etc.)
    // Taux d'annulation par produit, raisons, évolution
  },
  getPenaltiesAnalytics: async (providerId: number) => {
    // Analyse des pénalités (montant total, nombre, évolution)
  },
  getProductPerformance: async (providerId: number) => {
    // Performance par produit (temps préparation, taux validation)
  },
  getImmediateAvailabilityStats: async (providerId: number) => {
    // Stats produits disponibles immédiatement vs avec délai
  },
};

2. **`productDeliveryService.ts`** (NOUVEAU) :
```typescript
export const productDeliveryService = {
  getDeliveryConfig: async (serviceId: number, productIndex: number) => {
    // Récupérer product_delivery_config pour un produit
    // Retourne : is_immediately_available, preparation_time_minutes, availability_days
  },
  formatAvailabilityDays: (days: number[]) => {
    // Formater les jours pour affichage (ex: [1,2,3,4,5] -> "Lun-Ven")
    // 0=dimanche, 1=lundi, ..., 6=samedi
  },
};
```

---

## ✅ Checklist d'Implémentation

### Phase 1 : Migrations
- [ ] Créer migration 1 (temps préparation + disponibilité)
- [ ] Créer migration 2 (gestion stock)
- [ ] Ajouter fonctions dans `auto_migrate.rs`
- [ ] Tester migrations localement
- [ ] `cargo sqlx prepare` et tester compilation offline
- [ ] Commiter migrations + métadonnées

### Phase 2 : Backend Services
- [ ] Créer `ProductAvailabilityService`
- [ ] Créer `OrderPreparationService` (avec gestion `is_immediately_available`)
- [ ] Créer `ProductStockService`
- [ ] Créer `SmartNotificationService`
- [ ] Créer `SimilarProductsService`
- [ ] Créer `DynamicPreparationTimeService` (NOUVEAU)
  - [ ] Calculer statistiques par catégorie depuis données historiques
  - [ ] Mettre à jour `category_preparation_stats` toutes les 24h
  - [ ] Utiliser médiane pour valeur par défaut
  - [ ] Intégrer dans `OrderPreparationService` (si `preparation_time_minutes` NULL, utiliser valeur dynamique)
- [ ] Créer `OrderTimeoutMonitor` (NOUVEAU - dans tasks/)
  - [ ] Vérifier toutes les minutes les commandes avec `validation_deadline` expirée
  - [ ] Appeler `handle_validation_timeout` pour chaque commande expirée
  - [ ] Démarrer dans `main.rs` avec `tokio::spawn`
- [ ] Créer `ProviderAnalyticsService` (NOUVEAU)
  - [ ] Statistiques commandes par statut
  - [ ] Métriques délais de préparation
  - [ ] **Analyse annulations** :
    - [ ] Nombre total d'annulations (timeout, rejet, etc.)
    - [ ] Taux d'annulation par produit
    - [ ] Raisons d'annulation les plus fréquentes
    - [ ] Évolution du taux d'annulation dans le temps
  - [ ] **Pénalités** :
    - [ ] Nombre de pénalités (produit indisponible signalé par coursier)
    - [ ] Montant total débité pour pénalités
    - [ ] Montant moyen par pénalité
    - [ ] Évolution des pénalités dans le temps
  - [ ] Performance par produit
  - [ ] Comparaison disponibilité immédiate vs délai
- [ ] Modifier `DeliveryService` pour intégrer workflow
  - [ ] Gérer cas `is_immediately_available = TRUE` (matching immédiat)
- [ ] **Modifier routes de recherche produits** (IMPORTANT)
  - [ ] Inclure `product_delivery_config` dans les réponses (is_immediately_available, preparation_time_minutes, availability_days)
  - [ ] Routes concernées : `/api/search`, `/api/services`, `/api/products`, etc.
  - [ ] Créer route `GET /api/delivery/config/:service_id/:product_index` pour récupérer config d'un produit
  - [ ] Joindre `product_delivery_config` dans les requêtes de recherche pour éviter appels multiples
- [ ] Créer/modifier routes API
  - [ ] S'assurer que toutes les routes retournent adresses textuelles, pas GPS
  - [ ] Routes analytics prestataire : `/api/provider/analytics/*`
- [ ] Tests unitaires

### Phase 3 : Backend Routes
- [ ] Modifier `create_client_order` pour vérification disponibilité
- [ ] Créer routes validation/invalidation
- [ ] Créer routes gestion stock
- [ ] Créer route produits similaires
- [ ] Tests d'intégration

### Phase 4 : Mobile
- [ ] **Modifier `PushNotificationManager`** pour gérer redirection vers `ResultatBesoin` avec produits préchargés
  - [ ] Intercepter notifications de type `order_rejected_with_alternatives`
  - [ ] Extraire `redirect.params` et naviguer vers `ResultatBesoin` avec ces params
  - [ ] Tester avec notification réelle
- [ ] **Vérifier `ResultatBesoinScreen`** : S'assurer que `route.params.results` fonctionne correctement (déjà implémenté)
- [ ] Créer `OrderStatusScreen`
- [ ] Créer `ProviderOrderManagementScreen`
  - [ ] Ajouter checkbox "Disponible immédiatement"
  - [ ] Afficher lieux pickup en adresses textuelles uniquement
- [ ] Créer/Modifier `ProviderDashboardScreen`
  - [ ] Statistiques commandes (pending, validated, rejected, cancelled)
  - [ ] Métriques délais de préparation
  - [ ] **Analyse annulations** :
    - [ ] Nombre total d'annulations
    - [ ] Taux d'annulation par produit
    - [ ] Raisons d'annulation les plus fréquentes
    - [ ] Évolution du taux d'annulation
  - [ ] **Pénalités** :
    - [ ] Nombre de pénalités
    - [ ] Montant total débité
    - [ ] Évolution des pénalités
  - [ ] Graphiques et visualisations
  - [ ] Alertes et notifications
- [ ] **Modifier `ProductCard.tsx`** (IMPORTANT - Mobile)
  - [ ] Créer composant `DeliveryBadge` pour afficher les indicateurs
  - [ ] Récupérer `product_delivery_config` depuis l'API ou props
  - [ ] Récupérer `cancellation_rate` depuis `product_cancellation_stats` via API
  - [ ] Ajouter badge "⚡ Livraison rapide" si `is_immediately_available = TRUE`
  - [ ] Ajouter badge "⏱️ Prêt en X min" si `preparation_time_minutes > 0`
  - [ ] Ajouter badge "📅 Disponible [jours]" si `availability_days` est défini
  - [ ] **Ajouter badge "⚠️ Taux d'annulation"** (NOUVEAU)
    - [ ] Si `cancellation_rate >= 30%` : Badge rouge "⚠️ Annulations fréquentes (X%)"
    - [ ] Si `cancellation_rate >= 20%` : Badge orange "⚠️ Annulations modérées (X%)"
    - [ ] Si `cancellation_rate >= 10%` : Badge jaune "⚠️ Quelques annulations (X%)"
    - [ ] Si `cancellation_rate < 10%` : Ne pas afficher (ou badge vert "✅ Fiable" si < 5%)
    - [ ] Tooltip : "Taux d'annulation basé sur les commandes récentes"
    - [ ] Position : En haut à gauche du ProductCard
  - [ ] Implémenter logique de priorité d'affichage
  - [ ] Positionner les badges en haut à droite du card (sauf annulation en haut à gauche)
  - [ ] Style : Badges colorés avec icônes, taille adaptée mobile
  - [ ] Gérer les cas où les données ne sont pas disponibles
  - [ ] Tester avec différents produits (avec/sans config)
- [ ] Créer services API
  - [ ] Service analytics pour prestataire
- [ ] Implémenter notifications sonores
- [ ] Ajouter navigation
- [ ] **Vérifier affichage adresses** : Tous les lieux pickup affichés en texte, pas GPS
- [ ] Tests UI

### Phase 5 : Frontend
- [ ] Créer pages web équivalentes
- [ ] Créer/Modifier `ProviderAnalyticsPage`
  - [ ] Dashboard analytics complet
  - [ ] Statistiques délais de préparation
  - [ ] Analyse produits rejetés
  - [ ] Graphiques et rapports
  - [ ] Export de données
- [ ] **Modifier `ProductCard.tsx`** (IMPORTANT - Frontend)
  - [ ] Créer composant `DeliveryBadge` pour afficher les indicateurs
  - [ ] Récupérer `product_delivery_config` depuis l'API ou props
  - [ ] Récupérer `cancellation_rate` depuis `product_cancellation_stats` via API
  - [ ] Même indicateurs que mobile (badges livraison rapide)
  - [ ] **Ajouter badge "⚠️ Taux d'annulation"** (NOUVEAU - même logique que mobile)
  - [ ] Design responsive (mobile/tablette/desktop)
  - [ ] Tooltip au survol pour plus de détails
  - [ ] Animation subtile au survol
  - [ ] Accessibilité (contraste, taille de texte)
- [ ] Créer services API
  - [ ] `providerAnalyticsService.ts` avec toutes les métriques
- [ ] Tests UI

### Phase 6 : Monitor Timeout + Calcul Dynamique Durée (NOUVEAU)
- [ ] Créer `OrderTimeoutMonitor` dans `backend/src/tasks/`
  - [ ] Vérifier toutes les minutes les commandes avec `validation_deadline` expirée
  - [ ] Appeler `handle_validation_timeout` pour chaque commande expirée
  - [ ] Démarrer dans `main.rs` avec `tokio::spawn`
- [ ] Créer `DynamicPreparationTimeService`
  - [ ] Calculer statistiques par catégorie depuis données historiques
  - [ ] Mettre à jour `category_preparation_stats` toutes les 24h
  - [ ] Utiliser médiane pour valeur par défaut
- [ ] Intégrer calcul dynamique dans `OrderPreparationService`
  - [ ] Si `preparation_time_minutes` est NULL, utiliser valeur dynamique de la catégorie
- [ ] Créer tâche périodique pour recalculer stats catégories (cron quotidien)
- [ ] Créer tâche périodique pour recalculer `product_cancellation_stats` (cron quotidien)
  - [ ] Calculer taux d'annulation par produit
  - [ ] Mettre à jour `product_cancellation_stats`

### Phase 7 : Intégration
- [ ] Tests end-to-end
- [ ] Documentation API
- [ ] Documentation utilisateur

---

## 🎨 Conventions de Code

### Rust
- Utiliser `snake_case` pour fonctions/variables
- Utiliser `PascalCase` pour structs/enums
- Documenter avec `///` pour fonctions publiques
- Gérer erreurs avec `AppResult<T>`

### TypeScript/React
- Utiliser `camelCase` pour fonctions/variables
- Utiliser `PascalCase` pour composants
- Utiliser hooks personnalisés pour logique métier
- TypeScript strict mode

### SQL
- Utiliser `CREATE TABLE IF NOT EXISTS` pour idempotence
- Séparer chaque `CREATE INDEX` en requête distincte
- Utiliser `DO $$ ... $$` pour logique conditionnelle

---

## 📝 Notes Importantes

1. **Rétrocompatibilité** : Les produits existants sans config doivent avoir des valeurs par défaut
2. **Performance** : Index appropriés pour toutes les recherches
3. **UX** : Messages d'erreur clairs et redirections intelligentes
4. **Robustesse** : Gestion timeouts et cas d'erreur
5. **Généricité** : Pas de hardcoding, fonctionne pour tous types de produits
6. **Disponibilité immédiate** : 
   - Le prestataire peut marquer un produit comme `is_immediately_available = TRUE`
   - Dans ce cas, pas de délai de préparation, matching coursier démarre immédiatement après validation
   - L'interface doit permettre de cocher/décocher cette option
7. **Affichage lieux pickup** :
   - **TOUJOURS** afficher les lieux de pickup en adresse textuelle (ex: "123 Rue de la Paix, Douala")
   - **JAMAIS** afficher les coordonnées GPS brutes (ex: "4.0500, 9.7000") à l'utilisateur final
   - Les coordonnées GPS sont utilisées en interne pour calculs de distance, mais l'affichage doit être lisible
   - Si l'adresse n'est pas disponible, utiliser un geocoding inverse pour obtenir l'adresse depuis les coordonnées
8. **Dashboard & Analytics Prestataire** :
   - **CRITIQUE** : Toutes les nouvelles fonctionnalités doivent être intégrées dans le dashboard/analytics du prestataire
   - Le dashboard doit afficher :
     - Statistiques commandes (pending, validated, preparing, ready, rejected, etc.)
     - Métriques délais de préparation (moyen, médian, par produit, par jour)
     - Analyse produits rejetés (raisons, fréquences, tendances)
     - Performance par produit (temps préparation, taux validation)
     - Comparaison produits disponibles immédiatement vs avec délai
     - Graphiques et visualisations (timeline, répartition, évolution)
     - Alertes (commandes en attente, taux rejet élevé, stock faible)
     - Recommandations (optimisation délais, produits à marquer immédiatement disponibles)
   - Export de données (CSV/PDF) pour rapports
   - Disponible sur mobile ET web

9. **Indicateurs dans ProductCard** :
   - **CRITIQUE** : Tous les ProductCard (mobile ET frontend) doivent afficher des indicateurs visuels de capacité de livraison rapide
   - **Badges à afficher** :
     - **"⚡ Livraison rapide"** (badge vert) : Si `is_immediately_available = TRUE`
       - Tooltip : "Disponible immédiatement - Livraison en moins de 30 minutes"
     - **"⏱️ Prêt en X min"** (badge orange) : Si `preparation_time_minutes > 0`
       - Afficher le temps réel (ex: "Prêt en 15 min", "Prêt en 45 min")
       - Tooltip : "Temps de préparation estimé"
     - **"📅 Disponible [jours]"** (badge bleu) : Si `availability_days` est défini
       - Afficher les jours (ex: "Disponible Lun-Ven", "Disponible Mar, Jeu, Sam")
       - Tooltip : "Jours de disponibilité"
   - **Priorité d'affichage** :
     1. Si `is_immediately_available = TRUE` → Afficher uniquement badge "Livraison rapide"
     2. Sinon, si `preparation_time_minutes > 0` → Afficher badge "Prêt en X min"
     3. Si `availability_days` est défini → Afficher badge "Disponible [jours]"
   - **Position** : En haut à droite du card, visible mais non intrusif
   - **Design** : Badges colorés avec icônes, taille adaptée à l'écran

---

## 🔗 Références

- Document d'analyse : `ANALYSE_WORKFLOW_LIVRAISON_AMELIORATIONS.md`
- Guide migrations SQLx : `backend/GUIDE_MIGRATIONS_SQLX.md`
- Exemples migrations : `backend/migrations/20250127000001_create_product_delivery_config.sql`
- Exemples auto_migrate : `backend/src/migrations/auto_migrate.rs` (lignes 6450-6500)

---

**Date de création** : 2025-01-20  
**Version** : 1.0
