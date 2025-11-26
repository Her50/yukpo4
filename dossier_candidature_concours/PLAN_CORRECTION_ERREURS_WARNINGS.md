# Plan de Correction des Erreurs et Warnings - Backend Yukpomnang

**Date d'analyse**: 2025-11-26  
**Source**: `logbackend1.md` (1481 lignes de logs de production)

## 📊 Résumé Exécutif

### Erreurs Critiques Identifiées

1. **Erreurs HTTP 500** : Endpoint `/api/services/{id}/media` (récurrent)
2. **Erreurs HTTP 400** : Endpoint `/api/media/product/{id}/{index}/generate-video` (récurrent)
3. **Erreurs de connexion PostgreSQL** : Connexions TLS fermées prématurément
4. **Crashes PostgreSQL** : "terminating connection because of crash of another server process"
5. **Requêtes SQL lentes** : Plusieurs requêtes dépassent le seuil d'alerte (1s)
6. **Acquisition de connexion lente** : Pool de connexions saturé (>2s)

### Warnings Identifiés

1. **SimilarProducts** : Caractéristiques non trouvées (fallback utilisé)
2. **Recherche full-text** : Échecs avec fallback SQL
3. **Requêtes lentes** : Plusieurs SELECT DISTINCT dépassent 3-4 secondes

---

## 🔴 PRIORITÉ 1 : Erreurs HTTP 500 - Endpoint Media

### Problème
L'endpoint `GET /api/services/{id}/media` retourne systématiquement 500 avec un temps de réponse très court (0-2ms), indiquant une erreur immédiate.

### Analyse du Code
```rust
// backend/src/controllers/media_controller.rs:188-206
pub async fn get_service_media(
    AxumPath(service_id): AxumPath<i32>,
    Extension(pool): Extension<PgPool>,
) -> AppResult<Json<Vec<MediaItem>>> {
    let rows = match sqlx::query_as::<_, MediaItem>(
        r#"SELECT id, service_id, type, path, uploaded_at FROM media WHERE service_id = $1 ORDER BY uploaded_at DESC"#
    )
    .bind(service_id)
    .fetch_all(&pool)
    .await {
        Ok(r) => r,
        Err(e) => {
            error!("[get_service_media] Query error: {e:?}");
            return Err(AppError::from(e));
        }
    };
    Ok(Json(rows))
}
```

### Causes Probables

1. **Type `MediaItem` incompatible** : Le mapping SQL vers Rust peut échouer si :
   - `uploaded_at` est NULL dans la DB mais non-Option dans le struct
   - Types de colonnes ne correspondent pas
   - Colonnes manquantes ou supplémentaires

2. **Connexion DB fermée** : Les erreurs TLS indiquent des connexions fermées prématurément

3. **Pool de connexions saturé** : Les warnings "acquired connection, but time to acquire exceeded" suggèrent un pool insuffisant

### Solutions

#### Action 1.1 : Vérifier et corriger le struct MediaItem
```rust
// Vérifier backend/src/models/media_model.rs ou équivalent
// S'assurer que tous les champs sont Option<> si NULL possible
#[derive(sqlx::FromRow, Serialize)]
pub struct MediaItem {
    pub id: i32,
    pub service_id: i32,
    pub r#type: String,  // type est un mot-clé Rust, utiliser r#type
    pub path: String,
    pub uploaded_at: Option<chrono::NaiveDateTime>,  // Option si NULL possible
}
```

#### Action 1.2 : Ajouter gestion d'erreur détaillée
```rust
pub async fn get_service_media(
    AxumPath(service_id): AxumPath<i32>,
    Extension(pool): Extension<PgPool>,
) -> AppResult<Json<Vec<MediaItem>>> {
    info!("[get_service_media] Called for service_id={}", service_id);
    
    // Vérifier d'abord si le service existe
    let service_exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM services WHERE id = $1)"
    )
    .bind(service_id)
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        error!("[get_service_media] Erreur vérification service: {e:?}");
        AppError::Database(format!("Erreur vérification service: {}", e))
    })?;

    if !service_exists {
        warn!("[get_service_media] Service {} n'existe pas", service_id);
        return Ok(Json(vec![]));  // Retourner liste vide au lieu d'erreur
    }

    let rows = sqlx::query_as::<_, MediaItem>(
        r#"SELECT id, service_id, type, path, uploaded_at FROM media WHERE service_id = $1 ORDER BY uploaded_at DESC"#
    )
    .bind(service_id)
    .fetch_all(&pool)
    .await
    .map_err(|e| {
        error!("[get_service_media] Query error pour service_id={}: {e:?}", service_id);
        // Log détaillé pour debugging
        if let sqlx::Error::RowNotFound = e {
            AppError::NotFound(format!("Aucun média trouvé pour service {}", service_id))
        } else {
            AppError::Database(format!("Erreur base de données: {}", e))
        }
    })?;

    info!("[get_service_media] {} médias trouvés pour service_id={}", rows.len(), service_id);
    Ok(Json(rows))
}
```

#### Action 1.3 : Ajouter retry logic pour connexions DB
```rust
use sqlx::postgres::PgPoolOptions;

// Dans main.rs ou config, augmenter les timeouts et ajouter retry
let pool = PgPoolOptions::new()
    .max_connections(20)  // Augmenter de 10 à 20
    .acquire_timeout(Duration::from_secs(10))  // Augmenter timeout
    .idle_timeout(Duration::from_secs(600))
    .max_lifetime(Duration::from_secs(1800))
    .test_before_acquire(true)  // Tester connexion avant utilisation
    .connect(&db_url)
    .await?;
```

---

## 🟠 PRIORITÉ 2 : Erreurs HTTP 400 - Génération Vidéo

### Problème
L'endpoint `POST /api/media/product/{id}/{index}/generate-video` retourne 400 avec message "Validation préventive des prérequis".

### Analyse du Code
```rust
// backend/src/controllers/product_video_controller.rs:42
validate_video_generation_prerequisites(&state, service_id, product_index, &payload).await?;
```

La validation échoue probablement dans `validate_video_generation_prerequisites` qui vérifie :
- Médias sélectionnés
- Images du produit
- Médias du service
- Assets de publicité

### Causes Probables

1. **Aucun média disponible** : Le service n'a pas d'images pour générer la vidéo
2. **Erreur de requête SQL** : Les requêtes de validation échouent
3. **Message d'erreur non informatif** : L'utilisateur ne sait pas pourquoi la validation échoue

### Solutions

#### Action 2.1 : Améliorer les messages d'erreur de validation
```rust
// backend/src/services/video_generation_service.rs:460-480
pub async fn validate_video_generation_prerequisites(
    state: &Arc<AppState>,
    service_id: i32,
    product_index: i32,
    payload: &VideoGenerationPayload,
) -> AppResult<()> {
    info!(
        "[VideoGeneration] Validation préventive des prérequis - service_id={}, product_index={}",
        service_id, product_index
    );

    let use_product_gallery = payload.use_product_gallery.unwrap_or(true);
    let use_service_mediatech = payload.use_service_mediatech.unwrap_or(true);
    let include_publicite_assets = payload.include_publicite_assets.unwrap_or(true);

    let mut has_images = false;
    let mut missing_sources = Vec::new();

    // ... validation code existant ...

    if !has_images {
        let error_msg = format!(
            "Aucune image disponible pour générer la vidéo. \
            Vérifications effectuées: \
            médias sélectionnés={}, \
            galerie produit={}, \
            médiathèque service={}, \
            assets publicité={}",
            payload.selected_media_ids.is_some(),
            use_product_gallery,
            use_service_mediatech,
            include_publicite_assets
        );
        
        warn!("[VideoGeneration] Validation échouée: {}", error_msg);
        return Err(AppError::BadRequest(error_msg));
    }

    Ok(())
}
```

#### Action 2.2 : Ajouter endpoint de diagnostic
```rust
// Nouveau endpoint pour vérifier les prérequis sans générer
pub async fn check_video_prerequisites(
    State(state): State<Arc<AppState>>,
    Path((service_id, product_index)): Path<(i32, i32)>,
) -> AppResult<Json<serde_json::Value>> {
    // Retourner un JSON détaillé avec les médias disponibles
    // pour aider le frontend à comprendre pourquoi la génération échoue
}
```

---

## 🟡 PRIORITÉ 3 : Problèmes de Connexion PostgreSQL

### Problème
Erreurs récurrentes :
- `peer closed connection without sending TLS close_notify`
- `terminating connection because of crash of another server process`
- `acquired connection, but time to acquire exceeded slow threshold`

### Causes Probables

1. **Pool de connexions insuffisant** : 10 connexions max peut être trop peu sous charge
2. **Connexions non nettoyées** : Connexions qui restent ouvertes trop longtemps
3. **Timeout trop court** : 2 secondes pour acquérir une connexion peut être insuffisant
4. **Problèmes réseau** : Connexions Render DB instables

### Solutions

#### Action 3.1 : Optimiser la configuration du pool
```rust
// backend/src/main.rs ou config
let pool = PgPoolOptions::new()
    .max_connections(20)  // Augmenter de 10 à 20
    .min_connections(5)   // Maintenir un minimum de connexions actives
    .acquire_timeout(Duration::from_secs(10))  // Augmenter de 2s à 10s
    .idle_timeout(Duration::from_secs(600))    // 10 minutes
    .max_lifetime(Duration::from_secs(1800))    // 30 minutes max par connexion
    .test_before_acquire(true)  // Tester avant utilisation
    .after_connect(|conn, _meta| {
        Box::pin(async move {
            // Configurer la connexion
            sqlx::query("SET statement_timeout = '30s'")
                .execute(&mut *conn)
                .await?;
            Ok(())
        })
    })
    .connect(&db_url)
    .await?;
```

#### Action 3.2 : Ajouter retry logic avec backoff exponentiel
```rust
// Créer un helper pour requêtes avec retry
pub async fn query_with_retry<F, T>(
    pool: &PgPool,
    mut query_fn: F,
    max_retries: u32,
) -> AppResult<T>
where
    F: FnMut(&PgPool) -> BoxFuture<'_, Result<T, sqlx::Error>>,
{
    let mut retries = 0;
    loop {
        match query_fn(pool).await {
            Ok(result) => return Ok(result),
            Err(e) => {
                if retries >= max_retries {
                    return Err(AppError::from(e));
                }
                
                // Vérifier si c'est une erreur de connexion récupérable
                if is_recoverable_connection_error(&e) {
                    let delay = Duration::from_millis(100 * 2_u64.pow(retries));
                    warn!("[DB Retry] Tentative {} après {}ms: {}", retries + 1, delay.as_millis(), e);
                    tokio::time::sleep(delay).await;
                    retries += 1;
                } else {
                    return Err(AppError::from(e));
                }
            }
        }
    }
}

fn is_recoverable_connection_error(e: &sqlx::Error) -> bool {
    matches!(
        e,
        sqlx::Error::PoolClosed
            | sqlx::Error::PoolTimedOut
            | sqlx::Error::Io(_)
    ) || e.to_string().contains("TLS close_notify")
        || e.to_string().contains("crash of another server process")
}
```

#### Action 3.3 : Monitoring des connexions
```rust
// Ajouter des métriques pour surveiller le pool
pub struct PoolMetrics {
    pub active_connections: usize,
    pub idle_connections: usize,
    pub waiting_requests: usize,
}

pub async fn get_pool_metrics(pool: &PgPool) -> PoolMetrics {
    PoolMetrics {
        active_connections: pool.size(),
        idle_connections: pool.num_idle(),
        waiting_requests: 0,  // SQLx ne fournit pas cette métrique directement
    }
}
```

---

## 🟢 PRIORITÉ 4 : Requêtes SQL Lentes

### Problème
Plusieurs requêtes dépassent le seuil d'alerte (1s) :
- `SELECT DISTINCT s.id, s.data, ...` : 3.7s
- `SELECT DISTINCT ON (s.id) ...` : >1s
- Requêtes de recherche full-text complexes

### Solutions

#### Action 4.1 : Ajouter des index manquants
```sql
-- Index pour recherche full-text
CREATE INDEX IF NOT EXISTS idx_services_fts_titre 
ON services USING gin(to_tsvector('french', COALESCE(data->'titre_service'->>'valeur', '')));

CREATE INDEX IF NOT EXISTS idx_services_fts_description 
ON services USING gin(to_tsvector('french', COALESCE(data->'description'->>'valeur', '')));

CREATE INDEX IF NOT EXISTS idx_services_fts_category 
ON services USING gin(to_tsvector('french', COALESCE(data->'category'->>'valeur', '')));

-- Index pour media
CREATE INDEX IF NOT EXISTS idx_media_service_id ON media(service_id);
CREATE INDEX IF NOT EXISTS idx_media_product_index ON media(service_id, product_index) WHERE product_index IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_media_type ON media(service_id, type);
```

#### Action 4.2 : Optimiser les requêtes de recherche
```rust
// Limiter les résultats et utiliser LIMIT
// Ajouter EXPLAIN ANALYZE dans les logs pour identifier les goulots d'étranglement
```

#### Action 4.3 : Mise en cache des résultats de recherche
```rust
// Utiliser Redis pour mettre en cache les résultats de recherche fréquents
// TTL de 5-10 minutes selon la fréquence de mise à jour
```

---

## 🔵 PRIORITÉ 5 : Warnings SimilarProducts

### Problème
```
[SimilarProducts] Caractéristiques non trouvées pour service_id=14, product_index=0
[SimilarProducts] Utilisation du fallback
```

### Solutions

#### Action 5.1 : Améliorer le logging pour comprendre pourquoi
```rust
// backend/src/services/similar_products_service.rs:128
warn!(
    "[SimilarProducts] Caractéristiques non trouvées pour service_id={}, product_index={}. \
    Vérification: service existe={}, produit existe={}, caractéristiques extraites={}",
    service_id,
    product_index,
    service_exists,
    product_exists,
    characteristics_extracted
);
```

#### Action 5.2 : Vérifier la structure des données
```rust
// S'assurer que les caractéristiques sont correctement extraites du JSON
// Ajouter validation et transformation si nécessaire
```

---

## 📋 Plan d'Implémentation

### Phase 1 : Corrections Critiques (Semaine 1)
- [ ] **Jour 1-2** : Corriger `get_service_media` (Action 1.1, 1.2)
- [ ] **Jour 3** : Améliorer messages d'erreur génération vidéo (Action 2.1)
- [ ] **Jour 4-5** : Optimiser pool de connexions (Action 3.1, 3.2)

### Phase 2 : Optimisations (Semaine 2)
- [ ] **Jour 1-2** : Ajouter index SQL (Action 4.1)
- [ ] **Jour 3-4** : Optimiser requêtes lentes (Action 4.2)
- [ ] **Jour 5** : Implémenter retry logic (Action 3.2)

### Phase 3 : Améliorations (Semaine 3)
- [ ] **Jour 1-2** : Monitoring et métriques (Action 3.3)
- [ ] **Jour 3** : Mise en cache recherche (Action 4.3)
- [ ] **Jour 4-5** : Corrections SimilarProducts (Action 5.1, 5.2)

---

## 🧪 Tests à Effectuer

### Tests Unitaires
- [ ] Test `get_service_media` avec service inexistant
- [ ] Test `get_service_media` avec service sans médias
- [ ] Test `get_service_media` avec types de médias variés
- [ ] Test validation prérequis vidéo avec différents scénarios

### Tests d'Intégration
- [ ] Test pool de connexions sous charge (100 requêtes simultanées)
- [ ] Test retry logic avec connexions fermées
- [ ] Test performance requêtes avec nouveaux index

### Tests de Charge
- [ ] Test avec 50+ requêtes simultanées sur `/api/services/{id}/media`
- [ ] Test génération vidéo avec 10+ jobs simultanés
- [ ] Monitoring des métriques de pool pendant les tests

---

## 📊 Métriques de Succès

### Avant Corrections
- ❌ Taux d'erreur 500 sur `/api/services/{id}/media` : ~30%
- ❌ Taux d'erreur 400 sur génération vidéo : ~40%
- ❌ Requêtes SQL lentes (>1s) : ~15%
- ❌ Connexions DB fermées prématurément : ~5%

### Objectifs Après Corrections
- ✅ Taux d'erreur 500 : <1%
- ✅ Taux d'erreur 400 : <5% (avec messages clairs)
- ✅ Requêtes SQL lentes : <2%
- ✅ Connexions DB stables : >99%

---

## 🔍 Monitoring Recommandé

### Alertes à Configurer
1. **Taux d'erreur 500 > 5%** sur 5 minutes
2. **Temps d'acquisition connexion > 5s** sur 1 minute
3. **Requêtes SQL > 2s** sur 10 minutes
4. **Pool de connexions saturé (>80%)** sur 5 minutes

### Dashboards
- Graphique taux d'erreur par endpoint
- Graphique temps de réponse par endpoint
- Graphique utilisation pool de connexions
- Graphique requêtes SQL lentes par type

---

## 📝 Notes Techniques

### Environnement
- **Backend** : Rust + Axum + SQLx
- **Base de données** : PostgreSQL sur Render (pgvector, imgsmlr)
- **Pool de connexions** : SQLx PgPool

### Dépendances à Vérifier
- Version SQLx compatible avec retry logic
- Configuration Render DB (timeouts, max connections)
- Variables d'environnement pour pool size

---

## ✅ Checklist de Validation

Avant de déployer les corrections :

- [ ] Tous les tests unitaires passent
- [ ] Tests d'intégration passent
- [ ] Tests de charge validés
- [ ] Code review effectué
- [ ] Documentation mise à jour
- [ ] Métriques de monitoring configurées
- [ ] Rollback plan préparé
- [ ] Déploiement en staging testé

---

**Prochaines Étapes** : Commencer par la Phase 1, Action 1.1 (correction struct MediaItem)

