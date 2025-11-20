# Analyse du Workflow de Livraison - Améliorations Proposées

## 📋 Résumé Exécutif

Cette analyse examine le workflow actuel de livraison et propose des améliorations pour répondre aux besoins identifiés concernant :
1. La gestion de la disponibilité par jour de la semaine
2. Le temps de préparation des produits
3. La validation de commande par le prestataire
4. Les notifications intelligentes
5. La redirection automatique vers produits similaires

---

## 🔍 État Actuel du Système

### ✅ Ce qui existe déjà

1. **Système de planification horaire** (`DeliveryScheduleService`)
   - Gestion des créneaux horaires par jour de la semaine
   - Calcul de créneaux acceptables pour pickup/delivery
   - Support de flexibilité client

2. **Configuration produit** (`ProductDeliveryConfig`)
   - `pickup_availability_schedule` : JSONB avec planning par jour
   - Support des lieux de stockage multiples
   - Configuration par produit

3. **Matching coursier**
   - File d'attente `delivery_matching_queue`
   - Worker asynchrone `DeliveryMatchingWorker`
   - Priorisation et retry automatique

4. **Recherche avec planification** (`SchedulingSearchService`)
   - Disponible pour pharmacies/hôpitaux
   - Vérification disponibilité en temps réel

### ❌ Ce qui manque

1. **Vérification disponibilité par jour lors de la recherche**
   - Le système vérifie les horaires mais pas si le produit est disponible le jour demandé
   - Pas de suggestion automatique de produits similaires disponibles

2. **Temps de préparation**
   - Aucun système de délai de préparation
   - Le matching coursier démarre immédiatement après création commande

3. **Validation prestataire**
   - Pas de workflow de validation/invalidation de commande
   - Pas de gestion de stock en temps réel

4. **Notifications intelligentes**
   - Pas de notifications sonores
   - Pas de notifications pour validation commande
   - Pas de notifications pour acceptation coursier

5. **Redirection produits similaires**
   - Pas de système automatique de fallback

---

## 🎯 Améliorations Proposées

### 1. Vérification Disponibilité par Jour + Suggestion Produits Similaires

#### Problème
Un client commande un produit le mercredi alors qu'il n'est disponible que lundi/vendredi. Le système devrait :
- Détecter l'indisponibilité
- Proposer automatiquement d'autres prestataires avec le même produit disponible ce jour

#### Solution

**A. Améliorer la recherche de produits**

```rust
// backend/src/services/product_availability_service.rs (NOUVEAU)
pub struct ProductAvailabilityService {
    pool: PgPool,
}

impl ProductAvailabilityService {
    /// Vérifie si un produit est disponible à une date/heure donnée
    pub async fn check_product_availability(
        &self,
        service_id: i32,
        product_index: i32,
        requested_datetime: DateTime<Utc>,
    ) -> AppResult<ProductAvailabilityResult> {
        // 1. Récupérer la config du produit
        // 2. Vérifier le jour de la semaine
        // 3. Vérifier les créneaux horaires
        // 4. Vérifier le stock (si applicable)
    }

    /// Trouve des produits similaires disponibles
    pub async fn find_similar_available_products(
        &self,
        product_query: &str,
        requested_datetime: DateTime<Utc>,
        user_lat: Option<f64>,
        user_lng: Option<f64>,
        max_distance_km: f64,
    ) -> AppResult<Vec<SimilarProductResult>> {
        // 1. Recherche sémantique de produits similaires
        // 2. Filtrer par disponibilité au jour/heure demandé
        // 3. Trier par pertinence + distance
    }
}
```

**B. Modifier la route de commande**

```rust
// backend/src/routes/delivery_routes.rs
async fn create_client_order(
    // ... params
) -> AppResult<Json<OrderResponse>> {
    // 1. Vérifier disponibilité produit
    let availability = availability_service
        .check_product_availability(
            payload.service_id,
            payload.product_index,
            Utc::now(), // ou datetime demandée
        )
        .await?;

    if !availability.is_available {
        // 2. Chercher produits similaires disponibles
        let similar_products = availability_service
            .find_similar_available_products(
                &product_name,
                Utc::now(),
                user_lat,
                user_lng,
                50.0,
            )
            .await?;

        // 3. Retourner erreur avec suggestions
        return Err(AppError::BadRequest(json!({
            "code": "PRODUCT_NOT_AVAILABLE_TODAY",
            "message": format!(
                "Ce produit n'est pas disponible {}. Voici des alternatives disponibles :",
                availability.unavailable_reason
            ),
            "similar_products": similar_products,
            "redirect_to": "/resultat-besoin?query=" + &product_name,
        })));
    }

    // 4. Continuer avec la commande normale
    // ...
}
```

**C. Migration base de données**

```sql
-- Ajouter colonne pour stocker disponibilité par jour
ALTER TABLE product_delivery_config 
ADD COLUMN IF NOT EXISTS availability_days INTEGER[] DEFAULT ARRAY[0,1,2,3,4,5,6]; 
-- 0=dimanche, 1=lundi, ..., 6=samedi

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_product_delivery_config_availability_days 
ON product_delivery_config USING GIN(availability_days);
```

---

### 2. Système de Temps de Préparation

#### Problème
Le matching coursier démarre immédiatement, mais le produit n'est pas prêt. Le coursier arrive et doit attendre.

#### Solution

**A. Ajouter temps de préparation à la config produit**

```sql
-- Migration
ALTER TABLE product_delivery_config
ADD COLUMN IF NOT EXISTS preparation_time_minutes INTEGER;
-- NULL = utiliser valeur dynamique calculée par catégorie
-- Si défini, utilise cette valeur spécifique au produit

ALTER TABLE product_delivery_config
ADD COLUMN IF NOT EXISTS max_preparation_time_minutes INTEGER DEFAULT 60;

ALTER TABLE product_delivery_config
ADD COLUMN IF NOT EXISTS is_immediately_available BOOLEAN DEFAULT FALSE;
-- Si TRUE, pas de délai de préparation, matching coursier immédiat après validation

-- Table pour stocker les durées de préparation observées par catégorie
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
```

**A.1. Calcul dynamique de la durée par défaut par catégorie**

```rust
// backend/src/services/dynamic_preparation_time_service.rs (NOUVEAU)
pub struct DynamicPreparationTimeService {
    pool: PgPool,
}

impl DynamicPreparationTimeService {
    /// Calcule la durée de préparation par défaut pour une catégorie
    pub async fn get_default_preparation_time(
        &self,
        category: &str,
    ) -> AppResult<i32> {
        // 1. Vérifier si une valeur existe en cache (table category_preparation_stats)
        let cached = sqlx::query_as!(
            CategoryPrepStats,
            r#"
            SELECT 
                category,
                avg_preparation_minutes,
                median_preparation_minutes,
                sample_count,
                last_calculated_at
            FROM category_preparation_stats
            WHERE category = $1
            AND last_calculated_at > NOW() - INTERVAL '24 hours'
            "#,
            category
        )
        .fetch_optional(&self.pool)
        .await?;

        if let Some(stats) = cached {
            // Utiliser la médiane (plus robuste que la moyenne)
            return Ok(stats.median_preparation_minutes as i32);
        }

        // 2. Calculer depuis les données historiques
        let calculated = self.calculate_category_stats(category).await?;
        
        // 3. Mettre à jour le cache
        self.update_category_stats(category, &calculated).await?;

        Ok(calculated.median_minutes)
    }

    /// Calcule les statistiques de préparation pour une catégorie
    async fn calculate_category_stats(
        &self,
        category: &str,
    ) -> AppResult<CategoryStats> {
        // Récupérer toutes les commandes validées de cette catégorie
        let orders = sqlx::query_as!(
            OrderPrepTime,
            r#"
            SELECT 
                po.id,
                po.preparation_time_minutes,
                EXTRACT(EPOCH FROM (po.validated_at - po.created_at)) / 60.0 as validation_delay_minutes,
                EXTRACT(EPOCH FROM (po.estimated_ready_at - po.validated_at)) / 60.0 as actual_prep_minutes
            FROM product_orders po
            JOIN services s ON s.id = po.service_id
            WHERE s.category = $1
            AND po.status IN ('ready', 'picked_up', 'delivered')
            AND po.validated_at IS NOT NULL
            AND po.estimated_ready_at IS NOT NULL
            AND po.created_at > NOW() - INTERVAL '90 days'
            ORDER BY po.created_at DESC
            LIMIT 1000
            "#,
            category
        )
        .fetch_all(&self.pool)
        .await?;

        if orders.is_empty() {
            // Pas de données : utiliser valeur par défaut de 5 minutes
            return Ok(CategoryStats {
                avg_minutes: 5.0,
                median_minutes: 5,
                sample_count: 0,
            });
        }

        // Calculer moyenne et médiane
        let mut prep_times: Vec<f64> = orders
            .iter()
            .filter_map(|o| {
                // Utiliser actual_prep_minutes si disponible, sinon preparation_time_minutes
                o.actual_prep_minutes
                    .or_else(|| o.preparation_time_minutes.map(|m| m as f64))
            })
            .collect();

        prep_times.sort_by(|a, b| a.partial_cmp(b).unwrap());

        let avg = prep_times.iter().sum::<f64>() / prep_times.len() as f64;
        let median = if prep_times.is_empty() {
            5.0
        } else {
            let mid = prep_times.len() / 2;
            if prep_times.len() % 2 == 0 {
                (prep_times[mid - 1] + prep_times[mid]) / 2.0
            } else {
                prep_times[mid]
            }
        };

        Ok(CategoryStats {
            avg_minutes: avg,
            median_minutes: median.round() as i32,
            sample_count: prep_times.len(),
        })
    }

    /// Met à jour les statistiques en cache
    async fn update_category_stats(
        &self,
        category: &str,
        stats: &CategoryStats,
    ) -> AppResult<()> {
        sqlx::query!(
            r#"
            INSERT INTO category_preparation_stats (
                category, avg_preparation_minutes, median_preparation_minutes, 
                sample_count, last_calculated_at, updated_at
            ) VALUES ($1, $2, $3, $4, NOW(), NOW())
            ON CONFLICT (category) DO UPDATE SET
                avg_preparation_minutes = EXCLUDED.avg_preparation_minutes,
                median_preparation_minutes = EXCLUDED.median_preparation_minutes,
                sample_count = EXCLUDED.sample_count,
                last_calculated_at = NOW(),
                updated_at = NOW()
            "#,
            category,
            stats.avg_minutes,
            stats.median_minutes as f64,
            stats.sample_count as i32,
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }
}
```

**B. Nouveau statut de commande**

```rust
// backend/src/models/delivery_model.rs
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum OrderStatus {
    Pending,           // Commande créée, en attente validation prestataire
    Validated,         // Prestataire a validé, préparation en cours
    Preparing,         // Préparation en cours
    Ready,             // Prêt pour pickup, matching coursier peut démarrer
    CourierAssigned,   // Coursier assigné
    PickedUp,          // Coursier a récupéré
    InTransit,         // En transit
    Delivered,         // Livré
    Cancelled,         // Annulé
    Rejected,          // Rejeté par prestataire
}
```

**C. Workflow avec temps de préparation**

```rust
// backend/src/services/order_preparation_service.rs (NOUVEAU)
pub struct OrderPreparationService {
    pool: PgPool,
}

impl OrderPreparationService {
    /// Crée une commande avec workflow de préparation
    pub async fn create_order_with_preparation(
        &self,
        order_params: CreateOrderParams,
    ) -> AppResult<OrderSummary> {
        // 1. Créer la commande avec statut Pending
        let order = self.create_order(order_params).await?;

        // 2. Récupérer temps de préparation
        let prep_time = self.get_preparation_time(
            order.service_id,
            order.product_index,
        ).await?;

        // 3. Calculer deadline de validation
        let validation_deadline = Utc::now() + Duration::minutes(prep_time.max_preparation_time);

        // 4. Envoyer notification au prestataire
        self.notify_provider_new_order(&order, prep_time).await?;

        // 5. Programmer timeout si pas de réponse
        self.schedule_validation_timeout(order.id, validation_deadline).await?;

        // 6. Envoyer notification au client
        self.notify_client_order_placed(&order, prep_time).await?;

        Ok(order)
    }

    /// Prestataire valide la commande
    pub async fn validate_order(
        &self,
        order_id: Uuid,
        provider_user_id: i32,
        estimated_ready_at: Option<DateTime<Utc>>,
    ) -> AppResult<()> {
        // 1. Récupérer config produit pour vérifier is_immediately_available
        // 2. Mettre à jour statut à Validated
        // 3. Si is_immediately_available = TRUE :
        //    - Passer directement à statut "Ready"
        //    - estimated_ready_at = NOW()
        //    - Démarrer matching coursier immédiatement
        // 4. Sinon :
        //    - Si estimated_ready_at fourni, l'utiliser
        //    - Sinon, calculer avec preparation_time_minutes
        //    - Programmer démarrage matching coursier à estimated_ready_at
        // 5. Notifier client
    }

    /// Prestataire invalide la commande
    pub async fn reject_order(
        &self,
        order_id: Uuid,
        provider_user_id: i32,
        reason: String,
    ) -> AppResult<()> {
        // 1. Mettre à jour statut à Rejected
        // 2. Chercher produits similaires
        // 3. Notifier client avec redirection
        // 4. Annuler la livraison associée
    }

    /// Timeout si prestataire ne répond pas
    pub async fn handle_validation_timeout(
        &self,
        order_id: Uuid,
    ) -> AppResult<()> {
        // 1. Récupérer la commande
        let order = self.get_order(order_id).await?;
        
        // 2. Mettre à jour statut à Rejected (timeout)
        sqlx::query!(
            r#"
            UPDATE product_orders
            SET 
                status = 'rejected',
                rejected_at = NOW(),
                rejection_reason = 'Timeout : Prestataire n''a pas validé la commande dans les délais',
                updated_at = NOW()
            WHERE id = $1
            "#,
            order_id
        )
        .execute(&self.pool)
        .await?;

        // 3. Enregistrer l'annulation pour analytics
        sqlx::query!(
            r#"
            INSERT INTO order_cancellations (
                order_id, provider_user_id, service_id, product_index,
                cancellation_type, reason, cancelled_at
            ) VALUES ($1, $2, $3, $4, 'timeout', 'Timeout validation', NOW())
            "#,
            order_id,
            order.provider_user_id,
            order.service_id,
            order.product_index,
        )
        .execute(&self.pool)
        .await?;

        // 4. Chercher produits similaires
        let alternatives = self.find_similar_products(&order).await?;

        // 5. Notifier client avec redirection vers produits similaires
        self.notify_client_order_timeout(order.client_user_id, order_id, alternatives).await?;

        // 6. Annuler la livraison associée si elle existe
        if let Some(delivery_id) = order.delivery_id {
            self.cancel_delivery(delivery_id, "Commande rejetée par timeout").await?;
        }

        Ok(())
    }
}
```

**D. Modifier le matching coursier**

```rust
// backend/src/services/delivery_service.rs
pub async fn enqueue_delivery_matching(
    &self,
    summary: &DeliverySummary,
) -> AppResult<()> {
    // Vérifier si la commande est prête
    if let Some(order_id) = summary.metadata.get("order_id") {
        let order_status = self.get_order_status(order_id).await?;
        
        if order_status != OrderStatus::Ready {
            // Ne pas démarrer le matching, attendre que la commande soit prête
            return Ok(());
        }
    }

    // Continuer avec le matching normal
    // ...
}
```

---

### 3. Gestion Stock en Temps Réel

#### Solution

**A. Table de stock par lieu**

```sql
-- Migration
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

CREATE INDEX IF NOT EXISTS idx_product_stock_locations_config 
ON product_stock_locations(product_delivery_config_id);

CREATE INDEX IF NOT EXISTS idx_product_stock_locations_available 
ON product_stock_locations(is_available, quantity_available) 
WHERE is_available = TRUE;
```

**B. Service de gestion stock**

```rust
// backend/src/services/product_stock_service.rs (NOUVEAU)
pub struct ProductStockService {
    pool: PgPool,
}

impl ProductStockService {
    /// Réserve du stock pour une commande
    pub async fn reserve_stock(
        &self,
        product_config_id: i32,
        storage_location_id: Option<i32>,
        quantity: i32,
    ) -> AppResult<StockReservation> {
        // Transaction pour réserver le stock
    }

    /// Libère une réservation
    pub async fn release_reservation(
        &self,
        reservation_id: Uuid,
    ) -> AppResult<()> {
        // Libérer le stock réservé
    }

    /// Met à jour le stock (prestataire)
    pub async fn update_stock(
        &self,
        product_config_id: i32,
        storage_location_id: Option<i32>,
        new_quantity: i32,
        user_id: i32,
    ) -> AppResult<()> {
        // Mettre à jour le stock disponible
    }

    /// Supprime un lieu de stockage
    pub async fn remove_stock_location(
        &self,
        product_config_id: i32,
        storage_location_id: i32,
        user_id: i32,
    ) -> AppResult<()> {
        // Marquer comme indisponible
        // Si commandes en cours, les notifier
    }
}
```

---

### 4. Notifications Intelligentes

#### Solution

**A. Service de notifications enrichi**

```rust
// backend/src/services/smart_notification_service.rs (NOUVEAU)
pub struct SmartNotificationService {
    pool: PgPool,
    push_service: Arc<PushNotificationService>,
}

impl SmartNotificationService {
    /// Notification sonore pour nouvelle commande (prestataire)
    pub async fn notify_provider_new_order(
        &self,
        order_id: Uuid,
        provider_user_id: i32,
        product_name: &str,
    ) -> AppResult<()> {
        // 1. Push notification avec son
        self.push_service.send_push_notification(
            provider_user_id,
            "🔔 Nouvelle commande",
            format!("Nouvelle commande : {}", product_name),
            Some(json!({
                "type": "new_order",
                "order_id": order_id,
                "sound": "order_notification.wav",
                "priority": "high",
                "vibrate": true,
            })),
        ).await?;

        // 2. Notifier tous les administrateurs du produit
        let admins = self.get_product_admins(order_id).await?;
        for admin_id in admins {
            self.push_service.send_push_notification(
                admin_id,
                "🔔 Nouvelle commande",
                format!("Nouvelle commande : {}", product_name),
                Some(json!({
                    "type": "new_order",
                    "order_id": order_id,
                    "sound": "order_notification.wav",
                })),
            ).await?;
        }

        Ok(())
    }

    /// Notification client : coursier accepté
    pub async fn notify_client_courier_assigned(
        &self,
        delivery_id: Uuid,
        client_user_id: i32,
        courier_name: &str,
    ) -> AppResult<()> {
        self.push_service.send_push_notification(
            client_user_id,
            "✅ Coursier assigné",
            format!("{} va livrer votre commande", courier_name),
            Some(json!({
                "type": "courier_assigned",
                "delivery_id": delivery_id,
                "courier_name": courier_name,
            })),
        ).await?;
    }

    /// Notification client : temps de préparation
    pub async fn notify_client_preparation_time(
        &self,
        order_id: Uuid,
        client_user_id: i32,
        preparation_minutes: i32,
    ) -> AppResult<()> {
        self.push_service.send_push_notification(
            client_user_id,
            "⏱️ Préparation en cours",
            format!("Votre commande sera prête dans {} minutes", preparation_minutes),
            Some(json!({
                "type": "preparation_time",
                "order_id": order_id,
                "preparation_minutes": preparation_minutes,
            })),
        ).await?;
    }
}
```

**B. Configuration notifications sonores (mobile)**

```typescript
// mobile/src/services/notificationService.ts
export const playNotificationSound = (type: 'order' | 'courier' | 'ready') => {
  const sounds = {
    order: require('../assets/sounds/order_notification.wav'),
    courier: require('../assets/sounds/courier_assigned.wav'),
    ready: require('../assets/sounds/order_ready.wav'),
  };
  
  // Utiliser expo-av ou react-native-sound
  Sound.play(sounds[type]);
};
```

---

### 5. Redirection Automatique Produits Similaires

#### Solution

**A. Service de recherche produits similaires**

```rust
// backend/src/services/similar_products_service.rs (NOUVEAU)
pub struct SimilarProductsService {
    pool: PgPool,
    search_service: Arc<NativeSearchService>,
}

impl SimilarProductsService {
    /// Trouve produits similaires disponibles
    pub async fn find_available_alternatives(
        &self,
        original_product: &ProductInfo,
        requested_datetime: DateTime<Utc>,
        user_lat: Option<f64>,
        user_lng: Option<f64>,
    ) -> AppResult<Vec<AlternativeProduct>> {
        // 1. Extraction caractéristiques produit original
        let keywords = self.extract_product_keywords(original_product).await?;

        // 2. Recherche sémantique
        let candidates = self.search_service
            .search_services(keywords, user_lat, user_lng, 50.0)
            .await?;

        // 3. Filtrer par disponibilité au jour/heure
        let available = self.filter_by_availability(
            candidates,
            requested_datetime,
        ).await?;

        // 4. Trier par pertinence + distance
        Ok(available)
    }
}
```

**B. Route de redirection**

```rust
// backend/src/routes/delivery_routes.rs
async fn handle_order_rejection(
    order_id: Uuid,
    reason: String,
) -> AppResult<Json<RejectionResponse>> {
    // 1. Récupérer infos produit original
    let original_product = get_order_product(order_id).await?;

    // 2. Chercher alternatives
    let alternatives = similar_products_service
        .find_available_alternatives(
            &original_product,
            Utc::now(),
            user_lat,
            user_lng,
        )
        .await?;

    // 3. Retourner réponse avec redirection
    Ok(Json(json!({
        "order_id": order_id,
        "status": "rejected",
        "reason": reason,
        "alternatives": alternatives,
        "redirect_url": format!(
            "/resultat-besoin?query={}&similar_to={}",
            urlencoding::encode(&original_product.name),
            order_id
        ),
    })))
}
```

**C. Redirection vers ResultatBesoinScreen avec produits préchargés**

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
    // 1. Construire le payload de notification avec produits préchargés
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

    // 2. Envoyer notification push
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

4. **Alternative : Deep Linking (pour notifications externes)**

```typescript
// mobile/src/config/linking.ts
const linking = {
  prefixes: ['yukpomnang://', 'https://yukpomnang.com'],
  config: {
    screens: {
      ResultatBesoin: {
        path: 'resultat-besoin',
        parse: {
          results: (value: string) => {
            // Décoder les produits depuis l'URL (base64 ou JSON)
            try {
              return JSON.parse(decodeURIComponent(value));
            } catch {
              return [];
            }
          },
          searchQuery: (value: string) => decodeURIComponent(value),
        },
      },
    },
  },
};
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

**C. Frontend : Page produits similaires (alternative si besoin d'un screen dédié)**

```typescript
// mobile/src/screens/SimilarProductsScreen.tsx
export const SimilarProductsScreen = ({ route }) => {
  const { originalProduct, alternatives } = route.params;

  return (
    <View>
      <Text>Produit non disponible</Text>
      <Text>Voici des alternatives disponibles :</Text>
      {alternatives.map(product => (
        <ProductCard key={product.id} product={product} />
      ))}
    </View>
  );
};
```

---

## 📊 Schéma de Workflow Complet

```
1. CLIENT COMMANDE
   ↓
2. VÉRIFICATION DISPONIBILITÉ
   ├─ Disponible ? → Continuer
   └─ Indisponible ? → Retourner produits similaires + redirection
   ↓
3. CRÉATION COMMANDE (statut: Pending)
   ↓
4. NOTIFICATION PRESTATAIRE (sonore)
   ├─ Notification tous admins produit
   └─ Deadline validation = maintenant + max_preparation_time
   ↓
5. NOTIFICATION CLIENT
   └─ "Commande reçue, préparation estimée: X minutes"
   ↓
6. PRESTATAIRE RÉPOND
   ├─ VALIDE
   │  ├─ Statut → Validated
   │  ├─ estimated_ready_at calculé
   │  ├─ Notification client
   │  └─ Programmer matching coursier à estimated_ready_at
   │
   ├─ INVALIDE
   │  ├─ Statut → Rejected
   │  ├─ Chercher produits similaires
   │  ├─ Notification client avec alternatives
   │  └─ Redirection automatique
   │
   └─ MODIFIE STOCK/LIEUX
      ├─ Mettre à jour stock
      └─ Si stock insuffisant → Invalider commande
   ↓
7. TIMEOUT (si pas de réponse avant validation_deadline)
   ├─ Monitor détecte timeout (tâche périodique)
   ├─ Statut → Rejected (timeout)
   ├─ Enregistrer annulation dans order_cancellations
   ├─ Mettre à jour product_cancellation_stats
   ├─ Chercher produits similaires
   └─ Redirection client avec notification
   ↓
8. PRÉPARATION EN COURS
   ├─ Statut → Preparing
   └─ Notification client (optionnelle)
   ↓
9. PRÊT POUR PICKUP
   ├─ Statut → Ready
   ├─ Notification client
   └─ DÉMARRER MATCHING COURSIER
   ↓
10. COURSIER ACCEPTE
    ├─ Statut → CourierAssigned
    └─ NOTIFICATION CLIENT (coursier assigné)
    ↓
11. PICKUP → IN TRANSIT → DELIVERED
```

---

## 🗄️ Modifications Base de Données

```sql
-- 1. Ajouter colonnes temps de préparation
ALTER TABLE product_delivery_config
ADD COLUMN IF NOT EXISTS preparation_time_minutes INTEGER DEFAULT 5,
-- Durée par défaut : 5 minutes (au lieu de 0)
ADD COLUMN IF NOT EXISTS max_preparation_time_minutes INTEGER DEFAULT 60,
ADD COLUMN IF NOT EXISTS availability_days INTEGER[] DEFAULT ARRAY[0,1,2,3,4,5,6];

-- 2. Table stock
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

-- 3. Table commandes avec statut
CREATE TABLE IF NOT EXISTS product_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delivery_id UUID REFERENCES deliveries(id) ON DELETE CASCADE,
    service_id INTEGER NOT NULL REFERENCES services(id),
    product_index INTEGER NOT NULL,
    client_user_id INTEGER NOT NULL REFERENCES users(id),
    provider_user_id INTEGER NOT NULL REFERENCES users(id),
    status TEXT NOT NULL DEFAULT 'pending', -- pending, validated, preparing, ready, courier_assigned, picked_up, delivered, cancelled, rejected
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

CREATE INDEX IF NOT EXISTS idx_product_orders_status 
ON product_orders(status, created_at);

CREATE INDEX IF NOT EXISTS idx_product_orders_provider 
ON product_orders(provider_user_id, status);

-- 4. Table réservations stock
CREATE TABLE IF NOT EXISTS stock_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES product_orders(id) ON DELETE CASCADE,
    stock_location_id INTEGER NOT NULL REFERENCES product_stock_locations(id),
    quantity INTEGER NOT NULL,
    reserved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    released_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_stock_reservations_order 
ON stock_reservations(order_id);

CREATE INDEX IF NOT EXISTS idx_stock_reservations_expires 
ON stock_reservations(expires_at) WHERE released_at IS NULL;

-- 5. Table pour enregistrer les annulations (timeout, rejet, etc.)
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

-- 6. Table pour calculer les statistiques d'annulation par produit
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

-- 7. Ajouter colonne validation_deadline à product_orders pour gérer les timeouts
ALTER TABLE product_orders
ADD COLUMN IF NOT EXISTS validation_deadline TIMESTAMPTZ;
-- Deadline pour que le prestataire valide la commande

CREATE INDEX IF NOT EXISTS idx_product_orders_validation_deadline 
ON product_orders(validation_deadline) 
WHERE status = 'pending' AND validation_deadline IS NOT NULL;
```

---

## 🚀 Plan d'Implémentation

### Phase 1 : Disponibilité par jour + Produits similaires (2-3 jours)
1. Créer `ProductAvailabilityService`
2. Modifier recherche produits pour vérifier jour
3. Implémenter recherche produits similaires
4. Modifier route commande pour retourner alternatives

### Phase 2 : Temps de préparation (3-4 jours)
1. Ajouter colonnes BDD
2. Créer `OrderPreparationService`
3. Modifier workflow commande
4. Modifier matching coursier pour attendre "Ready"

### Phase 3 : Gestion stock (2-3 jours)
1. Créer tables stock
2. Créer `ProductStockService`
3. Intégrer dans workflow commande
4. API pour prestataire de gérer stock

### Phase 4 : Notifications (2 jours)
1. Créer `SmartNotificationService`
2. Ajouter sons notifications (mobile)
3. Intégrer dans workflow

### Phase 5 : Redirection automatique (1-2 jours)
1. Créer `SimilarProductsService`
2. Page frontend produits similaires
3. Intégrer dans workflow rejet

### Phase 6 : Monitor de Timeout + Calcul Dynamique Durée (2-3 jours)
1. Créer `OrderTimeoutMonitor` (tâche périodique)
   - Vérifier toutes les minutes les commandes avec `validation_deadline` expirée
   - Appeler `handle_validation_timeout` pour chaque commande expirée
   - Code de référence :

```rust
// backend/src/tasks/order_timeout_monitor.rs (NOUVEAU)
use chrono::Utc;
use log::{error, info};
use sqlx::PgPool;
use std::sync::Arc;
use tokio::time::{interval, Duration as TokioDuration};
use uuid::Uuid;

use crate::services::order_preparation_service::OrderPreparationService;

/// Monitor périodique pour gérer les timeouts de validation de commandes
pub async fn start_order_timeout_monitor(
    pool: PgPool,
    preparation_service: Arc<OrderPreparationService>,
) {
    info!("🚀 Démarrage du monitor de timeout pour les commandes...");

    let mut interval_timer = interval(TokioDuration::from_secs(60)); // Vérifier toutes les minutes

    loop {
        interval_timer.tick().await;

        if let Err(e) = check_order_validation_timeouts(&pool, &preparation_service).await {
            error!("❌ Erreur lors de la vérification des timeouts de commandes: {}", e);
        }
    }
}

async fn check_order_validation_timeouts(
    pool: &PgPool,
    preparation_service: &OrderPreparationService,
) -> Result<(), sqlx::Error> {
    // Récupérer les commandes en attente avec deadline expirée
    let expired_orders = sqlx::query!(
        r#"
        SELECT id
        FROM product_orders
        WHERE status = 'pending'
        AND validation_deadline IS NOT NULL
        AND validation_deadline <= NOW()
        LIMIT 50
        "#,
    )
    .fetch_all(pool)
    .await?;

    for order in expired_orders {
        info!(
            "⏰ Commande {} a expiré (deadline: validation non effectuée)",
            order.id
        );

        // Appeler le service pour gérer le timeout
        if let Err(e) = preparation_service.handle_validation_timeout(order.id).await {
            error!(
                "❌ Erreur lors du traitement du timeout pour commande {}: {:?}",
                order.id, e
            );
        } else {
            info!("✅ Timeout traité avec succès pour commande {}", order.id);
        }
    }

    Ok(())
}
```

2. Créer `DynamicPreparationTimeService`
   - Calculer statistiques par catégorie depuis données historiques
   - Mettre à jour `category_preparation_stats` toutes les 24h
   - Utiliser médiane pour valeur par défaut
3. Intégrer calcul dynamique dans `OrderPreparationService`
   - Si `preparation_time_minutes` est NULL, utiliser valeur dynamique de la catégorie
4. Tâche périodique pour recalculer stats catégories (cron quotidien)

### Phase 7 : Dashboard & Analytics Prestataire (3-4 jours)
1. Créer `ProviderAnalyticsService` (backend)
2. Routes API analytics (`/api/provider/:id/analytics/*`)
3. Dashboard mobile (`ProviderDashboardScreen`)
4. Dashboard web (`ProviderAnalyticsPage`)
5. Métriques :
   - Statistiques commandes par statut
   - Délais de préparation (moyen, médian, par produit)
   - **Analyse annulations** :
     - Nombre total d'annulations (timeout, rejet, etc.)
     - Taux d'annulation par produit
     - Raisons d'annulation les plus fréquentes
     - Évolution du taux d'annulation dans le temps
     - **Pénalités** : Montant total débité pour pénalités (produit indisponible signalé par coursier)
   - Performance par produit
   - Comparaison disponibilité immédiate vs délai
6. Graphiques et visualisations :
   - Timeline des commandes par statut
   - Répartition des raisons de rejet/annulation
   - Taux d'annulation par produit (graphique en barres)
   - Évolution du taux d'annulation (courbe temporelle)
   - Temps de préparation par jour de la semaine
   - Évolution des métriques dans le temps
7. Export de données (CSV/PDF)

---

## 📝 Notes Importantes

1. **Pas de hardcoding** : Tous les produits sont gérés de manière générique
2. **Rétrocompatibilité** : Les produits existants sans config auront des valeurs par défaut
3. **Performance** : Index appropriés pour recherches rapides
4. **UX** : Notifications claires et redirections intelligentes
5. **Robustesse** : Gestion timeouts et cas d'erreur
6. **Disponibilité immédiate** : 
   - Le prestataire peut marquer un produit comme `is_immediately_available = TRUE`
   - Dans ce cas, pas de délai de préparation, le matching coursier démarre immédiatement après validation
   - L'interface doit permettre de cocher/décocher cette option lors de la configuration du produit
7. **Affichage lieux pickup** :
   - **TOUJOURS** afficher les lieux de pickup en adresse textuelle (ex: "123 Rue de la Paix, Douala")
   - **JAMAIS** afficher les coordonnées GPS brutes (ex: "4.0500, 9.7000") à l'utilisateur final
   - Les coordonnées GPS sont utilisées en interne pour calculs de distance, mais l'affichage doit être lisible
   - Si l'adresse n'est pas disponible, utiliser un geocoding inverse pour obtenir l'adresse depuis les coordonnées
8. **Dashboard & Analytics Prestataire** :
   - **IMPORTANT** : Toutes les nouvelles métriques doivent être intégrées dans le dashboard/analytics du prestataire
   - Statistiques à afficher :
     - Nombre de commandes par statut (pending, validated, preparing, ready, rejected, cancelled, etc.)
     - Temps moyen/médian de préparation par produit
     - Taux de validation vs rejet
     - **Annulations** :
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
     - Performance des produits (temps préparation, taux validation, taux annulation)
     - Comparaison produits disponibles immédiatement vs avec délai
     - Impact des délais sur satisfaction client
   - Graphiques et visualisations :
     - Timeline des commandes par statut
     - Répartition des raisons de rejet
     - Temps de préparation par jour de la semaine
     - Évolution des métriques dans le temps
   - Alertes et recommandations :
     - Commandes en attente depuis trop longtemps
     - Produits avec taux de rejet élevé
     - Suggestions d'optimisation des délais
     - Produits à marquer comme "disponibles immédiatement"
   - Export de données :
     - CSV/PDF des métriques
     - Rapports mensuels/hebdomadaires

9. **Indicateurs visuels dans ProductCard** :
   - **CRITIQUE** : Tous les ProductCard (mobile ET frontend) doivent afficher des indicateurs de capacité de livraison rapide
   - **Badges à implémenter** :
     - **"⚡ Livraison rapide"** (badge vert) : Si `is_immediately_available = TRUE`
       - Indique que le produit est disponible immédiatement, pas de délai de préparation
       - Texte : "⚡ Livraison rapide" ou "⚡ Disponible immédiatement"
       - Tooltip : "Disponible immédiatement - Livraison en moins de 30 minutes"
       - Couleur : Vert (#10B981 ou similaire)
     - **"⏱️ Prêt en X min"** (badge orange) : Si `preparation_time_minutes > 0`
       - Affiche le temps réel de préparation (ex: "⏱️ Prêt en 15 min", "⏱️ Prêt en 45 min")
       - Tooltip : "Temps de préparation estimé"
       - Couleur : Orange (#F59E0B ou similaire)
     - **"📅 Disponible [jours]"** (badge bleu) : Si `availability_days` est défini
       - Affiche les jours de disponibilité avec formatage intelligent :
         - Si jours consécutifs : "📅 Disponible Lun-Ven"
         - Si jours spécifiques : "📅 Disponible Mar, Jeu, Sam"
         - Si un seul jour : "📅 Disponible Lundi"
       - Tooltip : "Jours de disponibilité"
       - Couleur : Bleu (#3B82F6 ou similaire)
     - **"⚠️ Taux d'annulation"** (badge rouge/orange) : Si `cancellation_rate > 10%`
       - Affiche le taux d'annulation du produit
       - **Logique d'affichage** :
         - Si `cancellation_rate >= 30%` : Badge rouge "⚠️ Annulations fréquentes (X%)"
         - Si `cancellation_rate >= 20%` : Badge orange "⚠️ Annulations modérées (X%)"
         - Si `cancellation_rate >= 10%` : Badge jaune "⚠️ Quelques annulations (X%)"
         - Si `cancellation_rate < 10%` : Ne pas afficher (ou badge vert "✅ Fiable" si < 5%)
       - Tooltip : "Taux d'annulation basé sur les commandes récentes. Un taux élevé peut indiquer des problèmes de disponibilité."
       - Couleur : Rouge (#EF4444) si >= 30%, Orange (#F59E0B) si >= 20%, Jaune (#EAB308) si >= 10%
       - **Position** : En haut à gauche du ProductCard, visible mais discret
       - **Données** : Récupérer depuis `product_cancellation_stats` via API
   - **Logique d'affichage** :
     1. Si `is_immediately_available = TRUE` → Afficher uniquement badge "⚡ Livraison rapide" (priorité absolue)
     2. Sinon, si `preparation_time_minutes > 0` → Afficher badge "⏱️ Prêt en X min"
     3. Si `availability_days` est défini ET différent de tous les jours → Afficher badge "📅 Disponible [jours]"
   - **Position** : En haut à droite du ProductCard, visible mais non intrusif
   - **Design** : 
     - Badges colorés avec icônes appropriées
     - Taille adaptée à l'écran (mobile vs desktop)
     - Animation subtile au survol (frontend uniquement)
     - Accessible (contraste, taille de texte)
     - Style cohérent avec le design system existant
   - **Données à récupérer** :
     - Lors de l'affichage d'un produit, récupérer `product_delivery_config` associé
     - Endpoint : `GET /api/delivery/config/:service_id/:product_index`
     - Ou inclure dans la réponse des routes de recherche produits
     - Extraire `is_immediately_available`, `preparation_time_minutes`, `availability_days`
     - Afficher les badges en fonction de ces données
   - **Formatage des jours** :
     - Fonction utilitaire pour convertir `[0,1,2,3,4,5,6]` en texte lisible
     - Mapping : 0=dimanche, 1=lundi, 2=mardi, 3=mercredi, 4=jeudi, 5=vendredi, 6=samedi
     - Détecter plages consécutives pour format compact (ex: "Lun-Ven")

---

### 6. Système de Pénalité Automatique pour Prestataires

#### Problème
Lorsqu'un coursier arrive sur les lieux de pickup et constate que le produit est indisponible, le prestataire doit être sanctionné pour garantir la qualité du service et éviter les déplacements inutiles des coursiers.

#### Solution

**A. Signalement d'indisponibilité par le coursier**

```rust
// backend/src/services/courier_report_service.rs (NOUVEAU)
pub struct CourierReportService {
    pool: PgPool,
    delivery_service: Arc<DeliveryService>,
    payment_service: Arc<DeliveryPaymentService>,
}

impl CourierReportService {
    /// Coursier signale que le produit est indisponible à l'arrivée
    pub async fn report_product_unavailable(
        &self,
        delivery_id: Uuid,
        courier_user_id: i32,
        reason: String,
        evidence_photo_url: Option<String>,
    ) -> AppResult<UnavailabilityReport> {
        // 1. Vérifier que le coursier est bien assigné à cette livraison
        let delivery = self.verify_courier_assignment(delivery_id, courier_user_id).await?;
        
        // 2. Vérifier que la livraison est en statut "EnRoutePickup" ou "ArrivedAtPickup"
        if delivery.status != DeliveryStatus::EnRoutePickup 
            && delivery.status != DeliveryStatus::ArrivedAtPickup {
            return Err(AppError::BadRequest(
                "Le coursier ne peut signaler l'indisponibilité qu'à l'arrivée sur les lieux".into()
            ));
        }

        // 3. Récupérer le montant de la livraison à débiter
        let delivery_cost_cents = delivery.delivery_cost_cents;
        let provider_user_id = delivery.provider_user_id;

        // 4. Débiter automatiquement le prestataire
        let debit_result = self.debit_provider_for_unavailability(
            provider_user_id,
            delivery_id,
            delivery_cost_cents,
            &reason,
        ).await?;

        // 5. Enregistrer le signalement
        let report = sqlx::query_as!(
            UnavailabilityReport,
            r#"
            INSERT INTO courier_unavailability_reports (
                delivery_id,
                courier_user_id,
                provider_user_id,
                reason,
                evidence_photo_url,
                delivery_cost_debited_cents,
                reported_at
            ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
            RETURNING *
            "#,
            delivery_id,
            courier_user_id,
            provider_user_id,
            reason,
            evidence_photo_url,
            delivery_cost_cents,
        )
        .fetch_one(&self.pool)
        .await?;

        // 6. Mettre à jour le statut de la livraison
        self.delivery_service
            .update_delivery_status(
                delivery_id,
                DeliveryStatus::Cancelled,
                Some("Produit indisponible signalé par coursier".to_string()),
            )
            .await?;

        // 7. Notifier le prestataire
        self.notify_provider_penalty(provider_user_id, delivery_id, delivery_cost_cents).await?;

        // 8. Notifier le client
        self.notify_client_product_unavailable(delivery.client_user_id, delivery_id).await?;

        // 9. Chercher produits similaires pour le client
        let alternatives = self.find_alternatives_for_client(delivery_id).await?;

        Ok(report)
    }

    /// Débite automatiquement le prestataire
    async fn debit_provider_for_unavailability(
        &self,
        provider_user_id: i32,
        delivery_id: Uuid,
        amount_cents: i64,
        reason: &str,
    ) -> AppResult<()> {
        // Utiliser le service de paiement pour débiter le wallet du prestataire
        self.payment_service
            .debit_provider_wallet(
                provider_user_id,
                delivery_id,
                amount_cents,
                format!("Pénalité : Produit indisponible - {}", reason),
            )
            .await?;

        Ok(())
    }
}
```

**B. Extension du service de paiement**

```rust
// backend/src/services/delivery_payment_service.rs
impl DeliveryPaymentService {
    /// Débite le wallet du prestataire (pour pénalités)
    pub async fn debit_provider_wallet(
        &self,
        provider_user_id: i32,
        delivery_id: Uuid,
        amount_cents: i64,
        reason: String,
    ) -> AppResult<()> {
        // 1. Vérifier le solde du prestataire
        let balance = if let Some(ref delivery_service) = self.delivery_service {
            delivery_service.get_wallet_balance(provider_user_id).await?
        } else {
            return Err(AppError::Internal("DeliveryService non disponible".into()));
        };

        if balance < amount_cents {
            // Si solde insuffisant, enregistrer la dette
            self.record_provider_debt(provider_user_id, delivery_id, amount_cents, &reason).await?;
            return Err(AppError::BadRequest(
                format!("Solde insuffisant pour pénalité. Dette enregistrée : {} XAF", amount_cents / 100)
            ));
        }

        // 2. Débiter le wallet
        if let Some(ref delivery_service) = self.delivery_service {
            delivery_service.debit_wallet_for_delivery(
                provider_user_id,
                delivery_id,
                amount_cents,
                Some(reason),
            ).await?;
        }

        // 3. Enregistrer la transaction de pénalité
        sqlx::query!(
            r#"
            INSERT INTO provider_penalties (
                provider_user_id,
                delivery_id,
                amount_cents,
                reason,
                debited_at
            ) VALUES ($1, $2, $3, $4, NOW())
            "#,
            provider_user_id,
            delivery_id,
            amount_cents,
            reason,
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }
}
```

**C. Migration SQL**

```sql
-- Table pour enregistrer les signalements d'indisponibilité
CREATE TABLE IF NOT EXISTS courier_unavailability_reports (
    id SERIAL PRIMARY KEY,
    delivery_id UUID NOT NULL REFERENCES delivery_requests(id) ON DELETE CASCADE,
    courier_user_id INTEGER NOT NULL REFERENCES users(id),
    provider_user_id INTEGER NOT NULL REFERENCES users(id),
    reason TEXT NOT NULL,
    evidence_photo_url TEXT,
    delivery_cost_debited_cents BIGINT NOT NULL,
    reported_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table pour enregistrer les pénalités
CREATE TABLE IF NOT EXISTS provider_penalties (
    id SERIAL PRIMARY KEY,
    provider_user_id INTEGER NOT NULL REFERENCES users(id),
    delivery_id UUID NOT NULL REFERENCES delivery_requests(id) ON DELETE CASCADE,
    amount_cents BIGINT NOT NULL,
    reason TEXT NOT NULL,
    debited_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table pour enregistrer les dettes si solde insuffisant
CREATE TABLE IF NOT EXISTS provider_debts (
    id SERIAL PRIMARY KEY,
    provider_user_id INTEGER NOT NULL REFERENCES users(id),
    delivery_id UUID NOT NULL REFERENCES delivery_requests(id) ON DELETE CASCADE,
    amount_cents BIGINT NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    paid_at TIMESTAMPTZ
);

-- Index pour analytics
CREATE INDEX IF NOT EXISTS idx_unavailability_reports_provider 
    ON courier_unavailability_reports(provider_user_id, reported_at);
CREATE INDEX IF NOT EXISTS idx_provider_penalties_provider 
    ON provider_penalties(provider_user_id, debited_at);
CREATE INDEX IF NOT EXISTS idx_provider_debts_provider 
    ON provider_debts(provider_user_id, status);
```

**D. Route API**

```rust
// backend/src/routes/delivery_routes.rs
async fn report_product_unavailable(
    Extension(courier): Extension<AuthenticatedUser>,
    Path(delivery_id): Path<Uuid>,
    Json(payload): Json<ReportUnavailabilityPayload>,
) -> AppResult<Json<UnavailabilityReportResponse>> {
    let report = courier_report_service
        .report_product_unavailable(
            delivery_id,
            courier.id,
            payload.reason,
            payload.evidence_photo_url,
        )
        .await?;

    Ok(Json(UnavailabilityReportResponse {
        report_id: report.id,
        delivery_id,
        amount_debited_cents: report.delivery_cost_debited_cents,
        message: "Pénalité appliquée au prestataire".to_string(),
    }))
}
```

**E. Intégration dans le dashboard prestataire**

Les pénalités doivent être affichées dans le dashboard/analytics du prestataire :
- Nombre total de pénalités
- Montant total débité
- Raisons les plus fréquentes
- Graphique d'évolution des pénalités
- Alertes si taux de pénalité élevé

**F. Workflow complet**

1. **Coursier arrive sur les lieux** → Statut livraison : `ArrivedAtPickup`
2. **Coursier constate indisponibilité** → Appelle API `POST /api/delivery/{id}/report-unavailable`
3. **Système vérifie** → Coursier assigné, statut correct
4. **Débit automatique** → Montant livraison débité du wallet prestataire
5. **Enregistrement** → Signalement et pénalité enregistrés en base
6. **Notifications** → Prestataire et client notifiés
7. **Redirection client** → Produits similaires proposés automatiquement
8. **Annulation livraison** → Statut passé à `Cancelled`

---

## ✅ Conclusion

Ces améliorations transformeront le workflow de livraison en un système intelligent qui :
- ✅ Détecte l'indisponibilité et propose des alternatives
- ✅ Gère le temps de préparation avant matching coursier
- ✅ Permet validation/invalidation par prestataire
- ✅ Gère le stock en temps réel
- ✅ Notifie intelligemment tous les acteurs
- ✅ Redirige automatiquement vers produits similaires
- ✅ **Sanctionne automatiquement les prestataires en cas d'indisponibilité constatée par le coursier**

Le système reste générique et fonctionne pour tous types de produits, pas seulement la restauration.

