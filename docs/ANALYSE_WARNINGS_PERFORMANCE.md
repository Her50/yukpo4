# 📊 Analyse des Warnings de Performance

## 🔍 Résumé des Problèmes Identifiés

### 1. ⚠️ Requêtes SQL Lentes (>1s)

#### A. Requête `SELECT deliveries` avec calculs géographiques
**Problème** : La requête `get_delivery_summary` effectue de nombreux calculs `ST_Y()` et `ST_X()` sur plusieurs colonnes géographiques (pickup_location, dropoff_location, recipient_dropoff_override, store_location, return_pickup_location, return_dropoff_location).

**Temps d'exécution** : 1.0s - 1.9s

**Fichier** : `backend/src/services/delivery_repository.rs` (ligne ~1936)

**Solution recommandée** :
1. **Créer des colonnes calculées** : Ajouter des colonnes `pickup_lat`, `pickup_lng`, `dropoff_lat`, `dropoff_lng` dans la table `deliveries` et les mettre à jour via trigger lors de l'insertion/modification.
2. **Indexer les colonnes géographiques** : Vérifier que les index GIST sont présents et optimisés.
3. **Cache Redis** : Mettre en cache les résultats pour les deliveries fréquemment consultées.

#### B. Requête `UPDATE delivery_matching_queue`
**Problème** : Les mises à jour de la queue de matching sont lentes (1.0s - 1.5s).

**Solution recommandée** :
1. **Index sur `delivery_id`** : S'assurer qu'un index unique existe sur `delivery_id`.
2. **Batch updates** : Grouper les mises à jour quand possible.
3. **Optimiser la clause WHERE** : Vérifier que l'index est utilisé.

#### C. Requête `SELECT courier_availability_snapshots`
**Problème** : Calculs de distance `ST_Distance` avec `LEFT JOIN LATERAL` sont coûteux (1.0s - 1.2s).

**Solution recommandée** :
1. **Index spatial** : Vérifier l'index GIST sur `cas.location`.
2. **Limiter la fenêtre temporelle** : Réduire l'intervalle `NOW() - INTERVAL '30 minutes'` si possible.
3. **Matérialiser les résultats** : Créer une vue matérialisée pour les coursiers disponibles.

#### D. Requête `SELECT 1` (Health checks)
**Problème** : Les health checks prennent plus de 1 seconde, indiquant un problème de pool de connexions.

**Solution recommandée** :
1. **Augmenter le pool de connexions** : Vérifier la configuration `max_connections` dans `PgPoolOptions`.
2. **Optimiser les connexions** : Réduire `idle_in_transaction_session_timeout`.
3. **Health check simplifié** : Utiliser une connexion dédiée pour les health checks.

### 2. 🚨 Endpoint Feature Flags Manquant (404)

**Problème** : L'application mobile essaie d'accéder à `/api/feature-flags` mais l'endpoint n'existe pas.

**Fichier concerné** : `mobile/src/contexts/FeatureFlagContext.tsx` (probablement)

**Solution** : Créer l'endpoint dans `backend/src/routes/feature_flags_routes.rs`

```rust
// backend/src/routes/feature_flags_routes.rs
use axum::{routing::get, Router, Json};
use std::sync::Arc;
use crate::config::feature_flags::FeatureFlagService;
use crate::state::AppState;

pub async fn get_feature_flags(
    State(state): State<Arc<AppState>>,
) -> Json<serde_json::Value> {
    let flags = FeatureFlagService::from_env();
    Json(serde_json::json!({
        "gpu_worker": flags.is_enabled_key("gpu_worker"),
        "connectors_livekit": flags.is_enabled_key("connectors_livekit"),
        "delivery_v2": flags.is_enabled_key("delivery_v2"),
        "global_promos": flags.is_enabled_key("global_promos"),
    }))
}

pub fn feature_flags_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .route("/api/feature-flags", get(get_feature_flags))
}
```

Puis ajouter dans `backend/src/lib.rs` :
```rust
let feature_flags = feature_flags_routes(state.clone());
// ... dans build_app
.merge(feature_flags)
```

### 3. 🖼️ Logos de Paiement Manquants (Orange, MTN)

**Problème** : Les logos Orange et MTN ne se chargent pas depuis Wikipedia, causant des warnings.

**Fichier** : `mobile/src/components/PaymentMethodSelector.tsx` (lignes 139, 172)

**Solution** : Utiliser des logos locaux ou des emojis par défaut

```typescript
// Option 1: Utiliser des emojis directement (plus fiable)
<Text style={styles.paymentTypeIcon}>📱</Text>

// Option 2: Utiliser des assets locaux
import MTNLogo from '../../assets/logos/mtn.png';
import OrangeLogo from '../../assets/logos/orange.png';

// Option 3: Utiliser un CDN plus fiable
source={{ uri: 'https://cdn.yukpomnang.com/logos/mtn.png' }}
```

### 4. 🐌 Requête HTTP Lente : POST /api/search/direct

**Problème** : La requête prend 3224ms (3.2 secondes).

**Solution recommandée** :
1. **Optimiser la requête SQL** : Vérifier les index sur `services` et `service_products`.
2. **Cache Redis** : Mettre en cache les résultats de recherche fréquents.
3. **Pagination** : Limiter le nombre de résultats retournés.
4. **Index full-text** : Vérifier que les index `tsvector` sont à jour.

## 📋 Plan d'Action Prioritaire

### Priorité 1 (Critique - Impact Performance)
1. ✅ Créer endpoint feature flags (404)
2. ✅ Optimiser requête `get_delivery_summary` (ajouter colonnes calculées)
3. ✅ Optimiser pool de connexions PostgreSQL

### Priorité 2 (Important - Amélioration UX)
4. ✅ Corriger logos de paiement (fallback emoji)
5. ✅ Optimiser requête `courier_availability_snapshots`
6. ✅ Optimiser requête `/api/search/direct`

### Priorité 3 (Amélioration Continue)
7. ✅ Ajouter cache Redis pour deliveries fréquentes
8. ✅ Créer vue matérialisée pour coursiers disponibles
9. ✅ Monitoring des requêtes lentes

## 🔧 Migrations SQL Recommandées

```sql
-- 1. Ajouter colonnes calculées pour éviter ST_Y/ST_X à chaque requête
ALTER TABLE deliveries 
ADD COLUMN IF NOT EXISTS pickup_lat FLOAT,
ADD COLUMN IF NOT EXISTS pickup_lng FLOAT,
ADD COLUMN IF NOT EXISTS dropoff_lat FLOAT,
ADD COLUMN IF NOT EXISTS dropoff_lng FLOAT,
ADD COLUMN IF NOT EXISTS store_lat FLOAT,
ADD COLUMN IF NOT EXISTS store_lng FLOAT;

-- 2. Créer trigger pour mettre à jour automatiquement
CREATE OR REPLACE FUNCTION update_delivery_coordinates()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.pickup_location IS NOT NULL THEN
        NEW.pickup_lat := ST_Y(NEW.pickup_location::geometry);
        NEW.pickup_lng := ST_X(NEW.pickup_location::geometry);
    END IF;
    IF NEW.dropoff_location IS NOT NULL THEN
        NEW.dropoff_lat := ST_Y(NEW.dropoff_location::geometry);
        NEW.dropoff_lng := ST_X(NEW.dropoff_location::geometry);
    END IF;
    IF NEW.store_location IS NOT NULL THEN
        NEW.store_lat := ST_Y(NEW.store_location::geometry);
        NEW.store_lng := ST_X(NEW.store_location::geometry);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER delivery_coordinates_trigger
BEFORE INSERT OR UPDATE OF pickup_location, dropoff_location, store_location
ON deliveries
FOR EACH ROW
EXECUTE FUNCTION update_delivery_coordinates();

-- 3. Index pour delivery_matching_queue
CREATE INDEX IF NOT EXISTS idx_delivery_matching_queue_delivery_id 
ON delivery_matching_queue(delivery_id);

-- 4. Index spatial pour courier_availability_snapshots
CREATE INDEX IF NOT EXISTS idx_courier_availability_location_gist 
ON courier_availability_snapshots USING GIST(location);

-- 5. Index pour optimiser les recherches
CREATE INDEX IF NOT EXISTS idx_courier_availability_online_captured 
ON courier_availability_snapshots(is_online, captured_at) 
WHERE is_online = TRUE;
```

## 📈 Métriques à Surveiller

- Temps d'exécution des requêtes `get_delivery_summary` (objectif: <200ms)
- Temps d'exécution des requêtes `courier_availability_snapshots` (objectif: <300ms)
- Taux d'erreur 404 sur `/api/feature-flags` (objectif: 0%)
- Temps de réponse `/api/search/direct` (objectif: <1s)






