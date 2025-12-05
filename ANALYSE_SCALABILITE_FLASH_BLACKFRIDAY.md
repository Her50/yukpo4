# Analyse Scalabilité & UX - Flash Sales & Black Friday

## 📊 Vue d'ensemble

Ce document analyse les pages de gestion des **flash sales des prestataires** et du **Black Friday** pour identifier les problèmes de scalabilité et proposer des améliorations pour une expérience utilisateur unique, capable de gérer des millions d'interactions simultanées.

---

## 🔴 PROBLÈMES IDENTIFIÉS

### 1. Flash Sales (`live_flash_sale_service.rs`)

#### ❌ Problèmes de Scalabilité

1. **Goulot d'étranglement avec `FOR UPDATE` (ligne 185)**
   - Chaque réservation verrouille la ligne en base de données
   - Avec des milliers de requêtes simultanées → deadlocks et timeouts
   - Pas de queue pour gérer les pics de trafic

2. **Requêtes SQL multiples par réservation**
   - 3-4 requêtes SQL par réservation (SELECT, SUM, INSERT/UPDATE)
   - Pas de cache Redis pour le stock disponible
   - Calcul du stock total à chaque fois (ligne 242-251)

3. **Notifications synchrones**
   - Les notifications sont envoyées de manière synchrone (ligne 144-161)
   - Peuvent ralentir considérablement les réservations

4. **Pas de rate limiting spécifique**
   - Un utilisateur peut spammer les réservations
   - Pas de protection contre les bots

5. **Pas de cache pour les listes de flash sales**
   - `list_flash_sales` fait des requêtes complexes à chaque appel
   - Pas de mise en cache des résumés

#### ❌ Problèmes UX

1. **Feedback utilisateur insuffisant**
   - Pas d'indication en temps réel du stock restant
   - Pas de file d'attente visible pour les utilisateurs
   - Messages d'erreur génériques

2. **Pas de pré-réservation**
   - Impossible de "réserver" avant le début de la vente
   - Pas de système de wishlist pour les flash sales

---

### 2. Black Friday (`global_promo_service.rs`)

#### ❌ Problèmes de Scalabilité

1. **Requête catalogue très lourde (ligne 411-593)**
   - `COUNT(*) OVER()` sur toutes les entrées (ligne 461)
   - JOINs multiples sans index optimisés
   - Pas de cache Redis pour le catalogue
   - Pagination avec OFFSET (lente sur grandes tables)

2. **Notifications en boucle (ligne 1306-1335)**
   - Notifie TOUS les prestataires en boucle séquentielle
   - Avec 10,000 prestataires → 10,000 requêtes DB + 10,000 push notifications
   - Bloque le thread pendant plusieurs minutes

3. **Pas de cache pour les prix promotionnels**
   - `get_real_product_price` fait une requête SQL à chaque appel (ligne 850-867)
   - Pas de mise en cache des promotions actives

4. **Requête de recherche non optimisée (ligne 497-513)**
   - `ILIKE` sur plusieurs colonnes sans index full-text
   - Recherche dans `snapshot::text` (très lent)

#### ❌ Problèmes UX

1. **Catalogue lent à charger**
   - Pas de lazy loading ou pagination infinie
   - Pas de préchargement des images

2. **Pas de filtres avancés**
   - Filtres limités (highlighted_only, availability, status)
   - Pas de filtres par catégorie, prix, localisation

3. **Pas de recommandations personnalisées**
   - Catalogue identique pour tous les utilisateurs
   - Pas d'algorithmes de recommandation

---

## ✅ SOLUTIONS PROPOSÉES

### 🚀 Architecture de Scalabilité Horizontale

#### 1. Cache Redis Multi-Niveaux

```rust
// Structure de cache proposée
pub struct FlashSaleCache {
    redis: RedisClient,
}

impl FlashSaleCache {
    // Cache du stock disponible (mis à jour toutes les 100ms)
    async fn get_available_stock(&self, flash_sale_id: Uuid) -> Option<i32> {
        // Key: "flash_sale:stock:{id}"
        // TTL: 1 seconde (très court pour cohérence)
    }
    
    // Cache des résumés de flash sales (TTL: 5 secondes)
    async fn get_flash_sale_summary(&self, flash_sale_id: Uuid) -> Option<LiveFlashSaleSummary> {
        // Key: "flash_sale:summary:{id}"
    }
    
    // Cache du catalogue Black Friday (TTL: 30 secondes)
    async fn get_catalog_page(&self, query: &GlobalPromoCatalogQuery) -> Option<GlobalPromoCatalogPage> {
        // Key: "global_promo:catalog:{hash_query}"
    }
}
```

#### 2. Queue de Réservations (Redis Streams ou BullMQ)

```rust
// Architecture proposée
pub struct FlashSaleReservationQueue {
    redis: RedisClient,
}

impl FlashSaleReservationQueue {
    // Ajouter une réservation à la queue
    async fn enqueue_reservation(
        &self,
        flash_sale_id: Uuid,
        user_id: i32,
        quantity: i32,
    ) -> AppResult<String> {
        // Utiliser Redis Streams pour garantir l'ordre
        // Retourner immédiatement un ticket ID
    }
    
    // Worker qui traite les réservations
    async fn process_reservations_worker(&self, pool: &PgPool) {
        // Traiter les réservations par batch
        // Mettre à jour le cache Redis après chaque batch
    }
}
```

#### 3. Rate Limiting Intelligent

```rust
// Rate limiting par utilisateur et par flash sale
pub struct FlashSaleRateLimiter {
    redis: RedisClient,
}

impl FlashSaleRateLimiter {
    // Limite: 5 réservations par minute par utilisateur
    // Limite: 1 réservation toutes les 2 secondes par flash sale
    async fn check_rate_limit(
        &self,
        user_id: i32,
        flash_sale_id: Uuid,
    ) -> AppResult<()> {
        // Utiliser Redis avec sliding window
    }
}
```

#### 4. Optimisation Base de Données

**Index proposés :**

```sql
-- Pour flash sales
CREATE INDEX CONCURRENTLY idx_flash_sales_status_start 
ON live_flash_sales(status, start_at) 
WHERE status IN ('scheduled', 'live');

CREATE INDEX CONCURRENTLY idx_flash_reservations_sale_user 
ON live_flash_sale_reservations(flash_sale_id, user_id);

-- Pour Black Friday
CREATE INDEX CONCURRENTLY idx_global_promo_entries_event_status 
ON global_promo_entries(event_id, status) 
WHERE status IN ('approved', 'published');

CREATE INDEX CONCURRENTLY idx_global_promo_products_highlighted_priority 
ON global_promo_products(highlighted DESC, priority_score DESC);

-- Index full-text pour recherche
CREATE INDEX CONCURRENTLY idx_global_promo_events_search 
ON global_promo_events USING gin(to_tsvector('french', display_name || ' ' || theme));
```

**Vue matérialisée pour le catalogue :**

```sql
CREATE MATERIALIZED VIEW global_promo_catalog_cache AS
SELECT
    e.*,
    ev.*,
    gp.*,
    COUNT(*) OVER() AS total_count
FROM global_promo_entries e
JOIN global_promo_events ev ON ev.id = e.event_id
LEFT JOIN global_promo_products gp ON gp.promo_entry_id = e.id
WHERE ev.status IN ('scheduled', 'live')
  AND e.status IN ('approved', 'published')
  AND ev.ends_at >= NOW();

CREATE UNIQUE INDEX ON global_promo_catalog_cache(id);
CREATE INDEX ON global_promo_catalog_cache(highlighted DESC, priority_score DESC);

-- Refresh toutes les 30 secondes
REFRESH MATERIALIZED VIEW CONCURRENTLY global_promo_catalog_cache;
```

#### 5. Notifications Asynchrones avec Queue

```rust
// Au lieu de notifier en boucle (ligne 1306)
// Utiliser une queue Redis pour les notifications
pub async fn notify_all_prestataires_async(
    pool: &PgPool,
    redis: &RedisClient,
    event: &GlobalPromoEvent,
) -> AppResult<()> {
    // 1. Récupérer la liste des prestataires (une seule requête)
    let prestataires = get_prestataires_list(pool).await?;
    
    // 2. Ajouter les notifications à une queue Redis
    for prestataire_id in prestataires {
        redis.lpush(
            "notifications:global_promo",
            &json!({
                "user_id": prestataire_id,
                "event_id": event.id,
                "title": format!("🔥 Nouveau Black Friday : {}", event.display_name),
                // ...
            })
        ).await?;
    }
    
    // 3. Worker séparé qui traite les notifications par batch
    Ok(())
}
```

---

### 🎨 Améliorations UX

#### 1. Flash Sales - Expérience Temps Réel

**WebSocket pour mises à jour en temps réel :**

```rust
// Émettre les mises à jour de stock via WebSocket
pub async fn broadcast_stock_update(
    state: &AppState,
    flash_sale_id: Uuid,
    available_stock: i32,
) {
    // Via Redis pub/sub
    state.redis.publish(
        &format!("flash_sale:{}:stock", flash_sale_id),
        &json!({ "available_stock": available_stock })
    ).await;
}
```

**Frontend :**
- Compteur de stock en temps réel
- Barre de progression du stock vendu
- File d'attente avec position estimée
- Notifications push pour début/fin de vente

#### 2. Black Friday - Catalogue Optimisé

**Pagination avec cursor (au lieu d'OFFSET) :**

```rust
pub async fn list_active_catalog_cursor(
    pool: &PgPool,
    query: GlobalPromoCatalogQuery,
    cursor: Option<String>, // Base64 encoded (id, priority_score)
) -> AppResult<GlobalPromoCatalogPage> {
    // Utiliser WHERE id > cursor_id au lieu de OFFSET
    // Beaucoup plus rapide pour les grandes tables
}
```

**Lazy loading des images :**
- Charger les images en basse résolution d'abord
- Charger en haute résolution au scroll
- Utiliser CDN avec cache

**Filtres avancés :**
- Par catégorie de service
- Par fourchette de prix
- Par localisation (services proches)
- Par disponibilité (online/live/both)

**Recommandations personnalisées :**
- Basées sur l'historique d'achat
- Basées sur les services suivis
- Basées sur la localisation

#### 3. Système de Wishlist pour Flash Sales

```rust
// Permettre aux utilisateurs de "souhaiter" des flash sales
pub async fn add_to_flash_sale_wishlist(
    pool: &PgPool,
    user_id: i32,
    flash_sale_id: Uuid,
) -> AppResult<()> {
    // Notifier l'utilisateur 5 minutes avant le début
    // Notifier au début de la vente
}
```

---

## 📈 MÉTRIQUES DE PERFORMANCE CIBLES

### Flash Sales
- **Réservations/seconde** : 10,000+ (avec queue)
- **Latence réservation** : < 100ms (retour immédiat du ticket)
- **Traitement queue** : < 5 secondes (95e percentile)
- **Cache hit rate** : > 95%

### Black Friday
- **Chargement catalogue** : < 500ms (première page)
- **Recherche** : < 200ms
- **Notifications** : Traitement asynchrone, < 1 minute pour 10,000 prestataires
- **Cache hit rate** : > 90%

---

## 🔧 IMPLÉMENTATION PRIORITAIRE

### Phase 1 : Cache Redis (Urgent)
1. ✅ Cache du stock disponible pour flash sales
2. ✅ Cache des résumés de flash sales
3. ✅ Cache du catalogue Black Friday
4. ✅ Cache des prix promotionnels

### Phase 2 : Queue de Réservations (Urgent)
1. ✅ Implémenter Redis Streams pour les réservations
2. ✅ Worker de traitement par batch
3. ✅ Système de tickets pour les utilisateurs

### Phase 3 : Optimisations DB (Important)
1. ✅ Créer les index proposés
2. ✅ Créer la vue matérialisée pour le catalogue
3. ✅ Migrer vers pagination cursor

### Phase 4 : Notifications Asynchrones (Important)
1. ✅ Queue Redis pour notifications Black Friday
2. ✅ Worker de notifications par batch
3. ✅ Retry automatique en cas d'échec

### Phase 5 : Améliorations UX (Nice to have)
1. ✅ WebSocket pour mises à jour temps réel
2. ✅ Système de wishlist
3. ✅ Recommandations personnalisées

---

## 🚨 POINTS D'ATTENTION

1. **Cohérence des données** : Le cache Redis doit être invalidé rapidement lors des mises à jour
2. **Gestion des erreurs** : Que faire si Redis est down ? Fallback vers DB directe
3. **Monitoring** : Métriques sur la queue, cache hit rate, latences
4. **Tests de charge** : Tester avec des millions de requêtes simultanées
5. **Rollback plan** : Possibilité de désactiver le cache rapidement en cas de problème

---

## 📝 FICHIERS À MODIFIER

### Backend
- `backend/src/services/live_flash_sale_service.rs` - Ajouter cache et queue
- `backend/src/services/global_promo_service.rs` - Optimiser requêtes et cache
- `backend/src/utils/redis_helper.rs` - Ajouter helpers pour cache
- `backend/src/tasks/flash_sale_queue_worker.rs` - Nouveau worker
- `backend/src/tasks/notification_queue_worker.rs` - Nouveau worker
- `backend/migrations/XXXX_optimize_flash_blackfriday.sql` - Nouveaux index

### Frontend (si applicable)
- Ajouter WebSocket pour mises à jour temps réel
- Implémenter lazy loading pour le catalogue
- Ajouter système de wishlist

---

## 🎯 CONCLUSION

Les pages de flash sales et Black Friday nécessitent des optimisations majeures pour gérer des millions d'interactions simultanées. Les solutions proposées (cache Redis, queues, optimisations DB) permettront de :

1. **Scaler horizontalement** : Ajouter des instances sans problème
2. **Réduire la charge DB** : Cache et queues réduisent les requêtes
3. **Améliorer l'UX** : Temps réel, feedback immédiat, recommandations
4. **Gérer les pics** : Queues permettent d'absorber les pics de trafic

**Priorité** : Implémenter Phase 1 et 2 en premier (cache + queue) pour une amélioration immédiate de la scalabilité.



