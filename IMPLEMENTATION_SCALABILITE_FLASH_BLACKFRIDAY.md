# Implémentation - Scalabilité Flash Sales & Black Friday

## 📦 Structure des nouveaux fichiers

### 1. Service de Cache Redis pour Flash Sales

**Fichier : `backend/src/services/flash_sale_cache.rs`**

```rust
use std::sync::Arc;
use redis::Client as RedisClient;
use uuid::Uuid;
use serde::{Deserialize, Serialize};
use crate::core::types::{AppError, AppResult};
use crate::models::live_model::LiveFlashSaleSummary;

const FLASH_SALE_STOCK_TTL: u64 = 1; // 1 seconde (très court pour cohérence)
const FLASH_SALE_SUMMARY_TTL: u64 = 5; // 5 secondes
const FLASH_SALE_LIST_TTL: u64 = 10; // 10 secondes

pub struct FlashSaleCache {
    redis: Arc<RedisClient>,
}

impl FlashSaleCache {
    pub fn new(redis: Arc<RedisClient>) -> Self {
        Self { redis }
    }

    /// Cache le stock disponible d'une flash sale
    pub async fn set_available_stock(
        &self,
        flash_sale_id: Uuid,
        available_stock: i32,
    ) -> AppResult<()> {
        let mut conn = self.redis.get_async_connection().await
            .map_err(|e| AppError::Internal(format!("Redis connection failed: {}", e)))?;
        
        let key = format!("flash_sale:stock:{}", flash_sale_id);
        redis::cmd("SET")
            .arg(&key)
            .arg(available_stock)
            .arg("EX")
            .arg(FLASH_SALE_STOCK_TTL)
            .query_async(&mut conn)
            .await
            .map_err(|e| AppError::Internal(format!("Redis SET failed: {}", e)))?;
        
        Ok(())
    }

    /// Récupère le stock disponible depuis le cache
    pub async fn get_available_stock(
        &self,
        flash_sale_id: Uuid,
    ) -> AppResult<Option<i32>> {
        let mut conn = self.redis.get_async_connection().await
            .map_err(|e| AppError::Internal(format!("Redis connection failed: {}", e)))?;
        
        let key = format!("flash_sale:stock:{}", flash_sale_id);
        let stock: Option<i32> = redis::cmd("GET")
            .arg(&key)
            .query_async(&mut conn)
            .await
            .map_err(|e| AppError::Internal(format!("Redis GET failed: {}", e)))?;
        
        Ok(stock)
    }

    /// Incrémente le stock réservé dans le cache (atomique)
    pub async fn increment_reserved_stock(
        &self,
        flash_sale_id: Uuid,
        quantity: i32,
    ) -> AppResult<i32> {
        let mut conn = self.redis.get_async_connection().await
            .map_err(|e| AppError::Internal(format!("Redis connection failed: {}", e)))?;
        
        let key = format!("flash_sale:stock:{}", flash_sale_id);
        let new_value: i32 = redis::cmd("DECRBY")
            .arg(&key)
            .arg(quantity)
            .query_async(&mut conn)
            .await
            .map_err(|e| AppError::Internal(format!("Redis DECRBY failed: {}", e)))?;
        
        Ok(new_value)
    }

    /// Cache un résumé de flash sale
    pub async fn set_flash_sale_summary(
        &self,
        flash_sale_id: Uuid,
        summary: &LiveFlashSaleSummary,
    ) -> AppResult<()> {
        let mut conn = self.redis.get_async_connection().await
            .map_err(|e| AppError::Internal(format!("Redis connection failed: {}", e)))?;
        
        let key = format!("flash_sale:summary:{}", flash_sale_id);
        let json = serde_json::to_string(summary)
            .map_err(|e| AppError::Internal(format!("Serialization failed: {}", e)))?;
        
        redis::cmd("SET")
            .arg(&key)
            .arg(json)
            .arg("EX")
            .arg(FLASH_SALE_SUMMARY_TTL)
            .query_async(&mut conn)
            .await
            .map_err(|e| AppError::Internal(format!("Redis SET failed: {}", e)))?;
        
        Ok(())
    }

    /// Récupère un résumé depuis le cache
    pub async fn get_flash_sale_summary(
        &self,
        flash_sale_id: Uuid,
    ) -> AppResult<Option<LiveFlashSaleSummary>> {
        let mut conn = self.redis.get_async_connection().await
            .map_err(|e| AppError::Internal(format!("Redis connection failed: {}", e)))?;
        
        let key = format!("flash_sale:summary:{}", flash_sale_id);
        let json: Option<String> = redis::cmd("GET")
            .arg(&key)
            .query_async(&mut conn)
            .await
            .map_err(|e| AppError::Internal(format!("Redis GET failed: {}", e)))?;
        
        if let Some(json_str) = json {
            let summary: LiveFlashSaleSummary = serde_json::from_str(&json_str)
                .map_err(|e| AppError::Internal(format!("Deserialization failed: {}", e)))?;
            Ok(Some(summary))
        } else {
            Ok(None)
        }
    }

    /// Invalide le cache d'une flash sale
    pub async fn invalidate_flash_sale(
        &self,
        flash_sale_id: Uuid,
    ) -> AppResult<()> {
        let mut conn = self.redis.get_async_connection().await
            .map_err(|e| AppError::Internal(format!("Redis connection failed: {}", e)))?;
        
        let pattern = format!("flash_sale:*:{}", flash_sale_id);
        // Note: DEL avec pattern nécessite SCAN dans production
        // Pour simplifier, on supprime les clés connues
        let keys = vec![
            format!("flash_sale:stock:{}", flash_sale_id),
            format!("flash_sale:summary:{}", flash_sale_id),
        ];
        
        if !keys.is_empty() {
            redis::cmd("DEL")
                .arg(keys)
                .query_async(&mut conn)
                .await
                .map_err(|e| AppError::Internal(format!("Redis DEL failed: {}", e)))?;
        }
        
        Ok(())
    }
}
```

### 2. Queue de Réservations avec Redis Streams

**Fichier : `backend/src/services/flash_sale_queue.rs`**

```rust
use std::sync::Arc;
use redis::Client as RedisClient;
use uuid::Uuid;
use serde::{Deserialize, Serialize};
use crate::core::types::{AppError, AppResult};

#[derive(Debug, Serialize, Deserialize)]
pub struct FlashSaleReservationRequest {
    pub flash_sale_id: Uuid,
    pub user_id: i32,
    pub quantity: i32,
    pub requested_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FlashSaleReservationTicket {
    pub ticket_id: String,
    pub flash_sale_id: Uuid,
    pub status: String, // "pending", "processing", "completed", "failed"
    pub estimated_wait_time_seconds: Option<u64>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

pub struct FlashSaleReservationQueue {
    redis: Arc<RedisClient>,
    stream_name: String,
}

impl FlashSaleReservationQueue {
    pub fn new(redis: Arc<RedisClient>) -> Self {
        Self {
            redis,
            stream_name: "flash_sale:reservations".to_string(),
        }
    }

    /// Ajoute une réservation à la queue (retourne immédiatement un ticket)
    pub async fn enqueue_reservation(
        &self,
        request: FlashSaleReservationRequest,
    ) -> AppResult<FlashSaleReservationTicket> {
        let mut conn = self.redis.get_async_connection().await
            .map_err(|e| AppError::Internal(format!("Redis connection failed: {}", e)))?;
        
        let ticket_id = uuid::Uuid::new_v4().to_string();
        let request_json = serde_json::to_string(&request)
            .map_err(|e| AppError::Internal(format!("Serialization failed: {}", e)))?;
        
        // Ajouter à Redis Streams
        let message_id: String = redis::cmd("XADD")
            .arg(&self.stream_name)
            .arg("*") // Auto-generate message ID
            .arg("ticket_id")
            .arg(&ticket_id)
            .arg("request")
            .arg(&request_json)
            .query_async(&mut conn)
            .await
            .map_err(|e| AppError::Internal(format!("Redis XADD failed: {}", e)))?;
        
        // Créer le ticket
        let ticket = FlashSaleReservationTicket {
            ticket_id: ticket_id.clone(),
            flash_sale_id: request.flash_sale_id,
            status: "pending".to_string(),
            estimated_wait_time_seconds: Some(5), // Estimation basique
            created_at: chrono::Utc::now(),
        };
        
        // Stocker le ticket dans Redis (pour consultation)
        let ticket_key = format!("flash_sale:ticket:{}", ticket_id);
        let ticket_json = serde_json::to_string(&ticket)
            .map_err(|e| AppError::Internal(format!("Serialization failed: {}", e)))?;
        
        redis::cmd("SET")
            .arg(&ticket_key)
            .arg(&ticket_json)
            .arg("EX")
            .arg(300) // 5 minutes TTL
            .query_async(&mut conn)
            .await
            .map_err(|e| AppError::Internal(format!("Redis SET failed: {}", e)))?;
        
        Ok(ticket)
    }

    /// Récupère le statut d'un ticket
    pub async fn get_ticket_status(
        &self,
        ticket_id: &str,
    ) -> AppResult<Option<FlashSaleReservationTicket>> {
        let mut conn = self.redis.get_async_connection().await
            .map_err(|e| AppError::Internal(format!("Redis connection failed: {}", e)))?;
        
        let ticket_key = format!("flash_sale:ticket:{}", ticket_id);
        let ticket_json: Option<String> = redis::cmd("GET")
            .arg(&ticket_key)
            .query_async(&mut conn)
            .await
            .map_err(|e| AppError::Internal(format!("Redis GET failed: {}", e)))?;
        
        if let Some(json) = ticket_json {
            let ticket: FlashSaleReservationTicket = serde_json::from_str(&json)
                .map_err(|e| AppError::Internal(format!("Deserialization failed: {}", e)))?;
            Ok(Some(ticket))
        } else {
            Ok(None)
        }
    }
}
```

### 3. Worker de Traitement des Réservations

**Fichier : `backend/src/tasks/flash_sale_queue_worker.rs`**

```rust
use std::sync::Arc;
use redis::Client as RedisClient;
use sqlx::PgPool;
use crate::core::types::AppResult;
use crate::services::{
    flash_sale_queue::FlashSaleReservationRequest,
    flash_sale_cache::FlashSaleCache,
    live_flash_sale_service::LiveFlashSaleService,
};

const BATCH_SIZE: usize = 100;
const POLL_INTERVAL_MS: u64 = 100; // 100ms entre les polls

pub struct FlashSaleQueueWorker {
    redis: Arc<RedisClient>,
    pool: Arc<PgPool>,
    cache: FlashSaleCache,
    stream_name: String,
    consumer_group: String,
    consumer_name: String,
}

impl FlashSaleQueueWorker {
    pub fn new(
        redis: Arc<RedisClient>,
        pool: Arc<PgPool>,
        cache: FlashSaleCache,
    ) -> Self {
        Self {
            redis,
            pool,
            cache,
            stream_name: "flash_sale:reservations".to_string(),
            consumer_group: "reservation_workers".to_string(),
            consumer_name: format!("worker_{}", uuid::Uuid::new_v4()),
        }
    }

    pub async fn start(&self) -> AppResult<()> {
        // Créer le consumer group si nécessaire
        self.ensure_consumer_group().await?;
        
        log::info!("🚀 Flash Sale Queue Worker démarré: {}", self.consumer_name);
        
        loop {
            if let Err(e) = self.process_batch().await {
                log::error!("Erreur traitement batch: {:?}", e);
                tokio::time::sleep(tokio::time::Duration::from_millis(1000)).await;
            } else {
                tokio::time::sleep(tokio::time::Duration::from_millis(POLL_INTERVAL_MS)).await;
            }
        }
    }

    async fn ensure_consumer_group(&self) -> AppResult<()> {
        let mut conn = self.redis.get_async_connection().await
            .map_err(|e| crate::core::types::AppError::Internal(format!("Redis connection failed: {}", e)))?;
        
        // XGROUP CREATE avec MKSTREAM si nécessaire
        let _: Result<(), _> = redis::cmd("XGROUP")
            .arg("CREATE")
            .arg(&self.stream_name)
            .arg(&self.consumer_group)
            .arg("0")
            .arg("MKSTREAM")
            .query_async(&mut conn)
            .await;
        
        // Ignorer l'erreur si le groupe existe déjà
        Ok(())
    }

    async fn process_batch(&self) -> AppResult<()> {
        let mut conn = self.redis.get_async_connection().await
            .map_err(|e| crate::core::types::AppError::Internal(format!("Redis connection failed: {}", e)))?;
        
        // Lire un batch de messages depuis le stream
        let messages: Vec<(String, Vec<(String, String)>)> = redis::cmd("XREADGROUP")
            .arg("GROUP")
            .arg(&self.consumer_group)
            .arg(&self.consumer_name)
            .arg("COUNT")
            .arg(BATCH_SIZE)
            .arg("BLOCK")
            .arg(1000) // 1 seconde de timeout
            .arg("STREAMS")
            .arg(&self.stream_name)
            .arg(">") // Lire les nouveaux messages
            .query_async(&mut conn)
            .await
            .map_err(|e| crate::core::types::AppError::Internal(format!("Redis XREADGROUP failed: {}", e)))?;
        
        if messages.is_empty() {
            return Ok(());
        }
        
        let (_, message_list) = &messages[0];
        let mut processed = 0;
        let mut failed = 0;
        
        for (message_id, fields) in message_list {
            // Parser les champs du message
            let mut ticket_id = None;
            let mut request_json = None;
            
            for i in (0..fields.len()).step_by(2) {
                if i + 1 < fields.len() {
                    let key = &fields[i];
                    let value = &fields[i + 1];
                    
                    if key == "ticket_id" {
                        ticket_id = Some(value.clone());
                    } else if key == "request" {
                        request_json = Some(value.clone());
                    }
                }
            }
            
            if let (Some(ticket_id), Some(request_json)) = (ticket_id, request_json) {
                match self.process_reservation(&ticket_id, &request_json).await {
                    Ok(_) => {
                        // ACK le message
                        self.ack_message(message_id).await?;
                        processed += 1;
                    }
                    Err(e) => {
                        log::error!("Erreur traitement réservation {}: {:?}", ticket_id, e);
                        failed += 1;
                        // Ne pas ACK, le message sera retraité
                    }
                }
            }
        }
        
        if processed > 0 || failed > 0 {
            log::info!("Batch traité: {} succès, {} échecs", processed, failed);
        }
        
        Ok(())
    }

    async fn process_reservation(
        &self,
        ticket_id: &str,
        request_json: &str,
    ) -> AppResult<()> {
        // Parser la requête
        let request: FlashSaleReservationRequest = serde_json::from_str(request_json)
            .map_err(|e| crate::core::types::AppError::Internal(format!("Deserialization failed: {}", e)))?;
        
        // Mettre à jour le statut du ticket
        self.update_ticket_status(ticket_id, "processing").await?;
        
        // Vérifier le stock dans le cache (fast path)
        if let Some(available_stock) = self.cache.get_available_stock(request.flash_sale_id).await? {
            if available_stock < request.quantity {
                self.update_ticket_status(ticket_id, "failed").await?;
                return Err(crate::core::types::AppError::BadRequest(
                    "Stock insuffisant".into()
                ));
            }
        }
        
        // Traiter la réservation dans la DB (avec transaction)
        match LiveFlashSaleService::reserve_slot(
            &self.pool,
            request.flash_sale_id,
            request.user_id,
            request.quantity,
        ).await {
            Ok(summary) => {
                // Mettre à jour le cache
                self.cache.set_available_stock(
                    request.flash_sale_id,
                    (summary.stock_target as i64 - summary.reserved_quantity) as i32,
                ).await?;
                
                self.cache.set_flash_sale_summary(request.flash_sale_id, &summary).await?;
                
                // Mettre à jour le statut du ticket
                self.update_ticket_status(ticket_id, "completed").await?;
                
                Ok(())
            }
            Err(e) => {
                self.update_ticket_status(ticket_id, "failed").await?;
                Err(e)
            }
        }
    }

    async fn update_ticket_status(&self, ticket_id: &str, status: &str) -> AppResult<()> {
        let mut conn = self.redis.get_async_connection().await
            .map_err(|e| crate::core::types::AppError::Internal(format!("Redis connection failed: {}", e)))?;
        
        let ticket_key = format!("flash_sale:ticket:{}", ticket_id);
        let ticket_json: Option<String> = redis::cmd("GET")
            .arg(&ticket_key)
            .query_async(&mut conn)
            .await
            .map_err(|e| crate::core::types::AppError::Internal(format!("Redis GET failed: {}", e)))?;
        
        if let Some(mut json) = ticket_json {
            // Mettre à jour le statut dans le JSON
            let mut ticket: serde_json::Value = serde_json::from_str(&json)
                .map_err(|e| crate::core::types::AppError::Internal(format!("Deserialization failed: {}", e)))?;
            ticket["status"] = serde_json::Value::String(status.to_string());
            
            json = serde_json::to_string(&ticket)
                .map_err(|e| crate::core::types::AppError::Internal(format!("Serialization failed: {}", e)))?;
            
            redis::cmd("SET")
                .arg(&ticket_key)
                .arg(&json)
                .arg("EX")
                .arg(300)
                .query_async(&mut conn)
                .await
                .map_err(|e| crate::core::types::AppError::Internal(format!("Redis SET failed: {}", e)))?;
        }
        
        Ok(())
    }

    async fn ack_message(&self, message_id: &str) -> AppResult<()> {
        let mut conn = self.redis.get_async_connection().await
            .map_err(|e| crate::core::types::AppError::Internal(format!("Redis connection failed: {}", e)))?;
        
        redis::cmd("XACK")
            .arg(&self.stream_name)
            .arg(&self.consumer_group)
            .arg(message_id)
            .query_async(&mut conn)
            .await
            .map_err(|e| crate::core::types::AppError::Internal(format!("Redis XACK failed: {}", e)))?;
        
        Ok(())
    }
}
```

### 4. Cache pour Black Friday Catalogue

**Fichier : `backend/src/services/global_promo_cache.rs`**

```rust
use std::sync::Arc;
use redis::Client as RedisClient;
use serde::{Deserialize, Serialize};
use crate::core::types::{AppError, AppResult};
use crate::models::global_promo_model::GlobalPromoCatalogPage;

const CATALOG_CACHE_TTL: u64 = 30; // 30 secondes
const PRICE_CACHE_TTL: u64 = 60; // 1 minute

pub struct GlobalPromoCache {
    redis: Arc<RedisClient>,
}

impl GlobalPromoCache {
    pub fn new(redis: Arc<RedisClient>) -> Self {
        Self { redis }
    }

    /// Génère une clé de cache pour une requête de catalogue
    fn catalog_cache_key(&self, query: &crate::models::global_promo_model::GlobalPromoCatalogQuery) -> String {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};
        
        let mut hasher = DefaultHasher::new();
        query.hash(&mut hasher);
        let hash = hasher.finish();
        
        format!("global_promo:catalog:{}", hash)
    }

    /// Cache une page de catalogue
    pub async fn set_catalog_page(
        &self,
        query: &crate::models::global_promo_model::GlobalPromoCatalogQuery,
        page: &GlobalPromoCatalogPage,
    ) -> AppResult<()> {
        let mut conn = self.redis.get_async_connection().await
            .map_err(|e| AppError::Internal(format!("Redis connection failed: {}", e)))?;
        
        let key = self.catalog_cache_key(query);
        let json = serde_json::to_string(page)
            .map_err(|e| AppError::Internal(format!("Serialization failed: {}", e)))?;
        
        redis::cmd("SET")
            .arg(&key)
            .arg(&json)
            .arg("EX")
            .arg(CATALOG_CACHE_TTL)
            .query_async(&mut conn)
            .await
            .map_err(|e| AppError::Internal(format!("Redis SET failed: {}", e)))?;
        
        Ok(())
    }

    /// Récupère une page de catalogue depuis le cache
    pub async fn get_catalog_page(
        &self,
        query: &crate::models::global_promo_model::GlobalPromoCatalogQuery,
    ) -> AppResult<Option<GlobalPromoCatalogPage>> {
        let mut conn = self.redis.get_async_connection().await
            .map_err(|e| AppError::Internal(format!("Redis connection failed: {}", e)))?;
        
        let key = self.catalog_cache_key(query);
        let json: Option<String> = redis::cmd("GET")
            .arg(&key)
            .query_async(&mut conn)
            .await
            .map_err(|e| AppError::Internal(format!("Redis GET failed: {}", e)))?;
        
        if let Some(json_str) = json {
            let page: GlobalPromoCatalogPage = serde_json::from_str(&json_str)
                .map_err(|e| AppError::Internal(format!("Deserialization failed: {}", e)))?;
            Ok(Some(page))
        } else {
            Ok(None)
        }
    }

    /// Cache un prix promotionnel
    pub async fn set_promo_price(
        &self,
        service_id: i32,
        promo_price: f64,
    ) -> AppResult<()> {
        let mut conn = self.redis.get_async_connection().await
            .map_err(|e| AppError::Internal(format!("Redis connection failed: {}", e)))?;
        
        let key = format!("global_promo:price:{}", service_id);
        redis::cmd("SET")
            .arg(&key)
            .arg(promo_price.to_string())
            .arg("EX")
            .arg(PRICE_CACHE_TTL)
            .query_async(&mut conn)
            .await
            .map_err(|e| AppError::Internal(format!("Redis SET failed: {}", e)))?;
        
        Ok(())
    }

    /// Récupère un prix promotionnel depuis le cache
    pub async fn get_promo_price(
        &self,
        service_id: i32,
    ) -> AppResult<Option<f64>> {
        let mut conn = self.redis.get_async_connection().await
            .map_err(|e| AppError::Internal(format!("Redis connection failed: {}", e)))?;
        
        let key = format!("global_promo:price:{}", service_id);
        let price_str: Option<String> = redis::cmd("GET")
            .arg(&key)
            .query_async(&mut conn)
            .await
            .map_err(|e| AppError::Internal(format!("Redis GET failed: {}", e)))?;
        
        if let Some(str) = price_str {
            let price: f64 = str.parse()
                .map_err(|e| AppError::Internal(format!("Parse failed: {}", e)))?;
            Ok(Some(price))
        } else {
            Ok(None)
        }
    }

    /// Invalide le cache d'un événement
    pub async fn invalidate_event(&self, event_id: uuid::Uuid) -> AppResult<()> {
        let mut conn = self.redis.get_async_connection().await
            .map_err(|e| AppError::Internal(format!("Redis connection failed: {}", e)))?;
        
        // Supprimer toutes les clés de catalogue (pattern matching)
        // Note: En production, utiliser SCAN pour éviter de bloquer Redis
        let pattern = "global_promo:catalog:*";
        let keys: Vec<String> = redis::cmd("KEYS")
            .arg(pattern)
            .query_async(&mut conn)
            .await
            .map_err(|e| AppError::Internal(format!("Redis KEYS failed: {}", e)))?;
        
        if !keys.is_empty() {
            redis::cmd("DEL")
                .arg(keys)
                .query_async(&mut conn)
                .await
                .map_err(|e| AppError::Internal(format!("Redis DEL failed: {}", e)))?;
        }
        
        Ok(())
    }
}
```

### 5. Migration SQL pour les Index

**Fichier : `backend/migrations/XXXX_optimize_flash_blackfriday.sql`**

```sql
-- Index pour flash sales
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_flash_sales_status_start 
ON live_flash_sales(status, start_at) 
WHERE status IN ('scheduled', 'live');

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_flash_reservations_sale_user 
ON live_flash_sale_reservations(flash_sale_id, user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_flash_reservations_sale_quantity 
ON live_flash_sale_reservations(flash_sale_id, quantity);

-- Index pour Black Friday
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_global_promo_entries_event_status 
ON global_promo_entries(event_id, status) 
WHERE status IN ('approved', 'published');

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_global_promo_entries_service 
ON global_promo_entries(service_id) 
WHERE status IN ('approved', 'published');

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_global_promo_products_highlighted_priority 
ON global_promo_products(highlighted DESC, priority_score DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_global_promo_events_status_dates 
ON global_promo_events(status, starts_at, ends_at) 
WHERE status IN ('scheduled', 'live');

-- Index full-text pour recherche (si PostgreSQL >= 12)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_global_promo_events_search 
ON global_promo_events USING gin(to_tsvector('french', display_name || ' ' || COALESCE(theme, '')));

-- Vue matérialisée pour le catalogue (refresh toutes les 30 secondes)
CREATE MATERIALIZED VIEW IF NOT EXISTS global_promo_catalog_cache AS
SELECT
    e.id AS entry_id,
    e.event_id,
    e.service_id,
    e.discount_percentage,
    e.promo_price_cfa,
    e.stock_cap,
    e.availability,
    e.status AS entry_status,
    ev.id AS event_id_alias,
    ev.slug AS event_slug,
    ev.theme AS event_theme,
    ev.display_name AS event_display_name,
    ev.starts_at AS event_starts_at,
    ev.ends_at AS event_ends_at,
    ev.status AS event_status,
    gp.id AS product_id,
    gp.priority_score AS product_priority_score,
    gp.highlighted AS product_highlighted,
    gp.snapshot AS product_snapshot
FROM global_promo_entries e
JOIN global_promo_events ev ON ev.id = e.event_id
LEFT JOIN global_promo_products gp ON gp.promo_entry_id = e.id
WHERE ev.status IN ('scheduled', 'live')
  AND e.status IN ('approved', 'published')
  AND ev.ends_at >= NOW();

CREATE UNIQUE INDEX ON global_promo_catalog_cache(entry_id);
CREATE INDEX ON global_promo_catalog_cache(product_highlighted DESC, product_priority_score DESC);
CREATE INDEX ON global_promo_catalog_cache(event_starts_at);
CREATE INDEX ON global_promo_catalog_cache(event_ends_at);
```

### 6. Intégration dans main.rs

**Modifications dans `backend/src/main.rs` :**

```rust
// Après la création de app_state
use crate::services::flash_sale_cache::FlashSaleCache;
use crate::services::flash_sale_queue::FlashSaleReservationQueue;
use crate::services::global_promo_cache::GlobalPromoCache;
use crate::tasks::flash_sale_queue_worker::FlashSaleQueueWorker;

// Créer les services de cache
let flash_sale_cache = FlashSaleCache::new(redis_client.clone());
let global_promo_cache = GlobalPromoCache::new(redis_client.clone());
let flash_sale_queue = FlashSaleReservationQueue::new(redis_client.clone());

// Démarrer le worker de queue
let queue_worker = FlashSaleQueueWorker::new(
    redis_client.clone(),
    app_state.pg.clone(),
    flash_sale_cache.clone(),
);
tokio::spawn(async move {
    if let Err(e) = queue_worker.start().await {
        log::error!("Flash sale queue worker error: {:?}", e);
    }
});

// Ajouter les caches à AppState (modifier AppState si nécessaire)
// Ou utiliser Arc pour les partager
```

---

## 🎯 Prochaines Étapes

1. **Tester les services de cache** avec des tests unitaires
2. **Déployer les migrations SQL** en production
3. **Intégrer les caches** dans les services existants
4. **Monitorer les performances** avec des métriques
5. **Ajuster les TTL** selon les besoins réels

---

## 📊 Métriques à Surveiller

- Cache hit rate (objectif: > 90%)
- Latence des réservations (objectif: < 100ms)
- Taille de la queue (alerte si > 10,000)
- Temps de traitement moyen (objectif: < 5s)
- Erreurs de cache (alerte si > 1%)




