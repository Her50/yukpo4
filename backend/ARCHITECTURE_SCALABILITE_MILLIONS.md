# 🚀 Architecture Scalabilité - Millions de Recherches Simultanées

## ⚠️ LIMITES ACTUELLES

### Configuration Actuelle
- **Pool DB** : 50 connexions max → **~50 recherches simultanées max**
- **Rate Limiting** : 100 requêtes/minute par IP → **Très limitant**
- **Architecture** : Monolithique, single instance
- **Cache** : Redis (optionnel, peut être indisponible)
- **Pas de queue system** : Toutes les requêtes sont traitées immédiatement
- **Pas de load balancing** : Une seule instance backend

### Calcul de Capacité Actuelle
```
50 connexions DB × 2-3s par recherche = ~16-25 recherches/seconde max
= ~1,000 recherches/minute max
= ~60,000 recherches/heure max
```

**❌ IMPOSSIBLE de gérer des millions de recherches simultanées avec cette configuration !**

---

## ✅ SOLUTION : Architecture Scalable

### 1. **HORIZONTAL SCALING** (Multi-instances)

#### Configuration Backend
```rust
// backend/src/main.rs - Configuration dynamique
let max_connections: u32 = env::var("DB_POOL_SIZE")
    .unwrap_or_else(|_| "100".to_string())  // ✅ Augmenté à 100 par instance
    .parse()
    .unwrap_or(100);

// ✅ NOUVEAU: Calculer pool size selon nombre d'instances
let instance_count: u32 = env::var("INSTANCE_COUNT")
    .unwrap_or_else(|_| "1".to_string())
    .parse()
    .unwrap_or(1);
    
let total_pool_size = max_connections * instance_count;
// Si 10 instances × 100 connexions = 1,000 connexions totales
```

#### Déploiement Multi-instances
```yaml
# render.yaml ou docker-compose
services:
  backend-1:
    image: yukpomnang-backend
    environment:
      - INSTANCE_COUNT=10
      - INSTANCE_ID=1
      - DB_POOL_SIZE=100
  backend-2:
    # ... même config avec INSTANCE_ID=2
  # ... jusqu'à backend-10
```

**Capacité avec 10 instances** :
- 10 instances × 100 connexions = **1,000 connexions DB**
- 1,000 connexions × 2-3s = **~300-500 recherches/seconde**
- = **~18,000-30,000 recherches/minute**
- = **~1M-1.8M recherches/heure**

---

### 2. **LOAD BALANCER** (Répartition de charge)

#### Configuration Nginx/Traefik
```nginx
# nginx.conf
upstream backend_pool {
    least_conn;  # Répartition par connexions actives
    server backend-1:8000;
    server backend-2:8000;
    server backend-3:8000;
    # ... jusqu'à backend-10
    
    # Health check
    keepalive 32;
}

server {
    location /api/search/direct {
        proxy_pass http://backend_pool;
        proxy_connect_timeout 5s;
        proxy_read_timeout 30s;
        proxy_send_timeout 30s;
        
        # Rate limiting au niveau load balancer
        limit_req zone=search_limit burst=50 nodelay;
    }
}
```

---

### 3. **QUEUE SYSTEM** (Gestion de pics)

#### Architecture avec Queue
```
Client → Load Balancer → Queue (RabbitMQ/Kafka) → Workers (10-100 instances)
```

#### Implémentation Rust
```rust
// backend/src/services/search_queue.rs
use lapin::{Connection, Channel, options::*, types::FieldTable};
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize)]
pub struct SearchRequest {
    pub query: String,
    pub user_id: Option<i32>,
    pub gps_zone: Option<String>,
    pub request_id: String,
}

pub struct SearchQueueService {
    channel: Channel,
}

impl SearchQueueService {
    pub async fn enqueue_search(&self, request: SearchRequest) -> AppResult<String> {
        // Publier dans la queue
        let payload = serde_json::to_vec(&request)?;
        self.channel
            .basic_publish(
                "search_exchange",
                "search.direct",
                BasicPublishOptions::default(),
                &payload,
                BasicProperties::default(),
            )
            .await?;
        
        Ok(request.request_id)
    }
    
    pub async fn process_search_worker(&self, pool: &PgPool) {
        // Worker qui consomme la queue
        let mut consumer = self.channel
            .basic_consume(
                "search_queue",
                "search_worker",
                BasicConsumeOptions::default(),
                FieldTable::default(),
            )
            .await?;
        
        while let Some(delivery) = consumer.next().await {
            let (channel, delivery) = delivery?;
            let request: SearchRequest = serde_json::from_slice(&delivery.data)?;
            
            // Traiter la recherche
            let result = rechercher_besoin_direct(...).await?;
            
            // Publier résultat dans queue de résultats
            channel.basic_ack(delivery.delivery_tag, BasicAckOptions::default()).await?;
        }
    }
}
```

**Avantages** :
- Découple les requêtes du traitement
- Permet de gérer des pics de millions de requêtes
- Workers scalables indépendamment
- Retry automatique en cas d'erreur

---

### 4. **CACHE AGRESSIF MULTI-NIVEAUX**

#### Niveau 1 : CDN (CloudFlare/AWS CloudFront)
```rust
// Cache au niveau CDN pour résultats populaires
// TTL: 5-10 minutes pour recherches fréquentes
```

#### Niveau 2 : Redis Cluster
```rust
// backend/src/services/cache_service.rs
// ✅ OPTIMISÉ: Redis Cluster pour cache distribué
pub struct CacheService {
    redis_cluster: Option<redis::cluster::ClusterClient>,
}

// Cache des résultats de recherche
// TTL: 10 minutes pour résultats, 1 heure pour autocomplete
```

#### Niveau 3 : Cache en mémoire (L1)
```rust
// Cache local dans chaque instance
// TTL: 1-2 minutes pour résultats très récents
```

**Stratégie de cache** :
```
1. Vérifier cache L1 (mémoire) → <1ms
2. Si miss, vérifier Redis Cluster → <5ms
3. Si miss, vérifier CDN → <20ms
4. Si miss, requête DB → 2-3s
```

**Taux de cache hit cible** : **80-90%** pour recherches populaires

---

### 5. **DATABASE READ REPLICAS**

#### Configuration PostgreSQL
```sql
-- Master (écriture)
-- Replica 1 (lecture)
-- Replica 2 (lecture)
-- Replica 3 (lecture)
```

#### Routing Rust
```rust
// backend/src/services/db_router.rs
pub struct DatabaseRouter {
    write_pool: PgPool,      // Master
    read_pools: Vec<PgPool>, // Replicas
}

impl DatabaseRouter {
    pub fn get_read_pool(&self) -> &PgPool {
        // Round-robin ou least connections
        &self.read_pools[rand::random::<usize>() % self.read_pools.len()]
    }
    
    pub fn get_write_pool(&self) -> &PgPool {
        &self.write_pool
    }
}
```

**Capacité avec 3 replicas** :
- 3 replicas × 100 connexions = **300 connexions lecture**
- Master : 50 connexions écriture
- **Total : 350 connexions** pour recherches

---

### 6. **RATE LIMITING INTELLIGENT**

#### Rate Limiting Multi-niveaux
```rust
// backend/src/middlewares/rate_limit.rs
// ✅ OPTIMISÉ: Rate limiting par utilisateur ET par IP

// Niveau 1: Par IP (déjà implémenté)
const RATE_LIMIT_IP: u32 = 100; // requêtes/minute

// ✅ NOUVEAU: Niveau 2: Par utilisateur authentifié
const RATE_LIMIT_USER: u32 = 500; // requêtes/minute pour utilisateurs premium

// ✅ NOUVEAU: Niveau 3: Burst allowance
const BURST_ALLOWANCE: u32 = 20; // 20 requêtes instantanées autorisées
```

#### Rate Limiting Distribué (Redis)
```rust
// Utiliser Redis pour rate limiting distribué entre instances
// Sliding window algorithm
let key = format!("rate_limit:{}:{}", user_id, timestamp_window);
let count: u32 = redis::cmd("INCR")
    .arg(&key)
    .query_async(&mut redis_conn)
    .await?;
    
if count == 1 {
    redis::cmd("EXPIRE").arg(&key).arg(60).query_async(&mut redis_conn).await?;
}
```

---

### 7. **CONNECTION POOLING INTELLIGENT**

#### PgBouncer (Connection Pooler)
```
Application (100 connexions) → PgBouncer → PostgreSQL (20 connexions réelles)
```

**Avantages** :
- Réduit le nombre de connexions réelles à PostgreSQL
- Permet plus de connexions applicatives
- Gestion automatique des connexions

#### Configuration
```toml
# pgbouncer.ini
[databases]
yukpo_db = host=postgresql-server port=5432 dbname=yukpo_db

[pgbouncer]
pool_mode = transaction
max_client_conn = 10000  # ✅ 10k connexions clients
default_pool_size = 100  # 100 connexions réelles à PostgreSQL
```

---

### 8. **MONITORING & AUTO-SCALING**

#### Métriques à surveiller
- Nombre de requêtes/seconde
- Temps de réponse moyen
- Taux d'erreur
- Utilisation CPU/RAM
- Connexions DB actives
- Taux de cache hit

#### Auto-scaling Rules
```yaml
# Kubernetes HPA ou Render Auto-scaling
rules:
  - metric: requests_per_second
    threshold: 1000
    action: scale_up
    min_instances: 5
    max_instances: 50
    
  - metric: response_time_ms
    threshold: 5000
    action: scale_up
    
  - metric: cpu_usage
    threshold: 70%
    action: scale_up
```

---

## 📊 CAPACITÉ FINALE AVEC TOUTES LES OPTIMISATIONS

### Configuration Optimale
- **10 instances backend** (chacune 100 connexions DB)
- **3 replicas PostgreSQL** (300 connexions lecture)
- **PgBouncer** (10k connexions clients → 100 connexions réelles)
- **Queue system** (RabbitMQ avec 50 workers)
- **Cache multi-niveaux** (80% cache hit rate)
- **Load balancer** (Nginx/Traefik)

### Calcul de Capacité
```
Sans cache (worst case):
- 300 connexions DB × 2-3s = ~100-150 recherches/seconde
- = ~6,000-9,000 recherches/minute
- = ~360k-540k recherches/heure

Avec 80% cache hit (realistic):
- 20% requêtes → DB (72k-108k/heure)
- 80% requêtes → Cache (<1ms)
- = ~1.8M-2.7M recherches/heure POSSIBLES

Avec queue system (burst handling):
- Queue peut bufferiser millions de requêtes
- Workers traitent à leur rythme
- = MILLIONS de recherches/heure possibles
```

---

## 🛠️ IMPLÉMENTATION PRIORITAIRE

### Phase 1 : Scalabilité Immédiate (1-2 semaines)
1. ✅ Augmenter pool DB à 100 par instance
2. ✅ Implémenter cache Redis agressif (TTL 10 min)
3. ✅ Configurer 3-5 instances backend
4. ✅ Load balancer (Nginx/Traefik)

### Phase 2 : Scalabilité Moyenne (1 mois)
5. ✅ Database read replicas (3 replicas)
6. ✅ PgBouncer pour connection pooling
7. ✅ Rate limiting intelligent (par user + IP)
8. ✅ Monitoring et alertes

### Phase 3 : Scalabilité Haute (2-3 mois)
9. ✅ Queue system (RabbitMQ/Kafka)
10. ✅ Workers scalables (50-100 workers)
11. ✅ CDN pour cache statique
12. ✅ Auto-scaling basé sur métriques

---

## ⚡ OPTIMISATIONS CRITIQUES POUR MILLIONS

### 1. Cache First Strategy
```rust
// backend/src/services/rechercher_besoin.rs
pub async fn rechercher_besoin_direct(...) -> AppResult<(Value, u32)> {
    // 1. Vérifier cache L1 (mémoire) - <1ms
    if let Some(cached) = memory_cache.get(&cache_key).await {
        return Ok(cached);
    }
    
    // 2. Vérifier cache Redis - <5ms
    if let Some(cached) = redis_cache.get(&cache_key).await? {
        memory_cache.set(&cache_key, &cached).await;
        return Ok(cached);
    }
    
    // 3. Vérifier cache CDN - <20ms
    if let Some(cached) = cdn_cache.get(&cache_key).await? {
        redis_cache.set(&cache_key, &cached).await?;
        memory_cache.set(&cache_key, &cached).await;
        return Ok(cached);
    }
    
    // 4. Requête DB seulement si cache miss - 2-3s
    let result = db_search(...).await?;
    
    // Mettre en cache à tous les niveaux
    cdn_cache.set(&cache_key, &result, Duration::from_secs(600)).await?;
    redis_cache.set(&cache_key, &result, Duration::from_secs(600)).await?;
    memory_cache.set(&cache_key, &result, Duration::from_secs(120)).await;
    
    Ok(result)
}
```

### 2. Materialized Views pour Recherches Populaires
```sql
-- Pré-calculer les résultats pour recherches fréquentes
CREATE MATERIALIZED VIEW search_results_cache AS
SELECT 
    search_query,
    results,
    created_at
FROM (
    -- Top 1000 recherches les plus fréquentes
    SELECT query as search_query, COUNT(*) as freq
    FROM search_history
    GROUP BY query
    ORDER BY freq DESC
    LIMIT 1000
) top_queries;

-- Rafraîchir toutes les heures
REFRESH MATERIALIZED VIEW CONCURRENTLY search_results_cache;
```

### 3. Search Result Pre-computation
```rust
// Background worker qui pré-calcule les résultats populaires
pub async fn precompute_popular_searches(pool: &PgPool) {
    let popular_queries = get_popular_queries(pool).await?;
    
    for query in popular_queries {
        let results = rechercher_besoin_direct(...).await?;
        cache_service.set_with_ttl(
            &format!("search:popular:{}", query),
            &results,
            Duration::from_secs(3600), // 1 heure
        ).await?;
    }
}
```

---

## 🎯 RÉSULTAT FINAL

### Avec TOUTES les optimisations :
- **Capacité théorique** : **10M+ recherches/heure**
- **Capacité réaliste (80% cache)** : **2-5M recherches/heure**
- **Burst handling (queue)** : **Millions de requêtes en queue**
- **Latence moyenne** : **<100ms** (avec cache), **2-3s** (sans cache)

### Architecture Finale
```
Internet
  ↓
CDN (CloudFlare) - Cache L1
  ↓
Load Balancer (Nginx) - 10 instances
  ↓
Backend Instances (10-50) - Chaque instance peut gérer 100-200 req/s
  ↓
Queue (RabbitMQ) - Buffer millions de requêtes
  ↓
Workers (50-100) - Traitement parallèle
  ↓
PgBouncer - Connection pooling intelligent
  ↓
PostgreSQL Cluster (1 Master + 3 Replicas)
  ↓
Redis Cluster - Cache distribué
```

---

## ✅ ACTIONS IMMÉDIATES

1. **Augmenter pool DB à 100** (déjà fait ✅)
2. **Configurer 3-5 instances backend** (à faire)
3. **Implémenter cache Redis agressif** (partiellement fait)
4. **Ajouter load balancer** (à faire)
5. **Monitoring des métriques** (à améliorer)

**Avec ces 5 actions, capacité actuelle : ~500k-1M recherches/heure**





