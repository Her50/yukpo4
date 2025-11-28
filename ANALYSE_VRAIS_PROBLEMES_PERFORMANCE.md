# 🔍 Analyse des VRAIS Problèmes de Performance - Recherche

## ⚠️ PROBLÈMES CRITIQUES IDENTIFIÉS

### 1. **Appels API Google Maps SÉQUENTIELS** (CRITIQUE - ~10-15s pour 2-3 résultats)
**Fichier**: `native_search_service.rs:2257` et `geographic_matching_service.rs:154`

**Problème**:
- Appel API Google Maps Distance Matrix pour **CHAQUE résultat**
- Timeout de **5 secondes par appel**
- Même avec cache, le premier appel prend 5s
- Pour 2-3 résultats = **10-15 secondes minimum**

```rust
// ❌ PROBLÈME: Appel séquentiel pour chaque résultat
for result in results.iter_mut() {
    match geo_service.calculate_distance(user_loc, service_coords).await {
        // Timeout 5s par appel !
    }
}
```

**Impact**: **10-15 secondes** pour 2-3 résultats

---

### 2. **Requêtes SQL Google Places SÉQUENTIELLES** (CRITIQUE - ~1-2s pour 2-3 résultats)
**Fichier**: `native_search_service.rs:311` et `enrich_google_places.rs:31`

**Problème**:
- Requête SQL pour **CHAQUE résultat** (même en parallèle avec `join_all`)
- Pour 2-3 résultats = **2-3 requêtes SQL**
- Chaque requête prend ~200-500ms

```rust
// ❌ PROBLÈME: Requête SQL pour chaque résultat
let enrichment_results: Vec<_> = join_all(service_ids.iter().map(|&service_id| {
    // Requête SQL individuelle pour chaque service_id
    enrich_service_with_google_places_data(pool, service_id, &mut data).await
})).await;
```

**Impact**: **1-2 secondes** pour 2-3 résultats

---

### 3. **Pas de LIMIT précoce avant enrichissement** (MOYEN - ~500ms-1s)
**Fichier**: `native_search_service.rs:308`

**Problème**:
- On enrichit **TOUS les résultats** avant de limiter
- Si la recherche retourne 50 résultats, on enrichit les 50 même si on n'en retourne que 10

**Impact**: **500ms-1s** de traitement inutile

---

### 4. **Recherche SÉQUENTIELLE** (MOYEN - ~1-2s)
**Fichier**: `native_search_service.rs:262`

**Problème**:
- Si `fulltext_results.len() < max_results`, on fait `trigram_search`
- Si encore pas assez, on fait `keyword_search`
- **3 recherches séquentielles** au lieu d'une seule optimisée

```rust
// ❌ PROBLÈME: Recherche séquentielle
let fulltext_results = self.fulltext_search_with_gps(...).await?;

if fulltext_results.len() < self.config.max_results {
    let trigram_results = self.trigram_search_with_gps(...).await?;
    // ...
}

if fulltext_results.len() < self.config.max_results / 2 {
    let keyword_results = self.keyword_search_with_gps(...).await?;
    // ...
}
```

**Impact**: **1-2 secondes** supplémentaires

---

## 📊 TEMPS TOTAL ACTUEL (16.7s)

D'après les logs :
- **Recherche SQL**: ~2-3s (fulltext + trigram + keyword)
- **Enrichissement Google Places**: ~1-2s (requêtes SQL parallèles)
- **Enrichissement Google Maps**: **~10-15s** (appels API séquentiels) ⚠️ **LE PLUS LENT**
- **Traitement résultats**: ~500ms-1s
- **Total**: **~16.7 secondes**

---

## ✅ SOLUTIONS PROPOSÉES

### Solution 1: **Batch Google Maps API** (CRITIQUE - Gain: 10-15s → <1s)

**Problème**: Appels API séquentiels (1 appel = 5s timeout)

**Solution**: Utiliser Google Maps Distance Matrix API en **batch** (1 seul appel pour tous les résultats)

```rust
// ✅ SOLUTION: Batch API - 1 seul appel pour tous les résultats
pub async fn calculate_distances_batch(
    &self,
    origin: (f64, f64),
    destinations: Vec<(f64, f64)>,
) -> AppResult<Vec<DistanceResult>> {
    // Google Maps Distance Matrix supporte jusqu'à 25 destinations par requête
    let url = format!(
        "https://maps.googleapis.com/maps/api/distancematrix/json?origins={},{}&destinations={}&key={}",
        origin.0, origin.1,
        destinations.iter().map(|(lat, lng)| format!("{},{}", lat, lng)).collect::<Vec<_>>().join("|"),
        api_key
    );
    
    // 1 seul appel API au lieu de N appels
    // Temps: 5s → <1s pour 2-3 résultats
}
```

**Gain**: **10-15s → <1s** (réduction de 90%)

---

### Solution 2: **Requête SQL Batch pour Google Places** (CRITIQUE - Gain: 1-2s → <200ms)

**Problème**: N requêtes SQL pour N résultats

**Solution**: 1 seule requête SQL avec `IN` ou `ANY`

```rust
// ✅ SOLUTION: 1 seule requête SQL pour tous les résultats
pub async fn enrich_services_with_google_places_batch(
    pool: &PgPool,
    service_ids: &[i32],
    service_data_map: &mut HashMap<i32, Value>,
) -> Result<(), AppError> {
    // 1 seule requête SQL avec IN
    let rows = sqlx::query(
        r#"
        SELECT 
            service_id,
            jsonb_build_object(...) as google_place_data
        FROM google_places_data
        WHERE service_id = ANY($1)
        "#
    )
    .bind(service_ids)
    .fetch_all(pool)
    .await?;
    
    // Appliquer les résultats
    for row in rows {
        let service_id: i32 = row.get("service_id");
        // ...
    }
}
```

**Gain**: **1-2s → <200ms** (réduction de 80%)

---

### Solution 3: **LIMIT précoce avant enrichissement** (MOYEN - Gain: 500ms-1s)

**Problème**: On enrichit tous les résultats avant de limiter

**Solution**: Limiter les résultats AVANT enrichissement

```rust
// ✅ SOLUTION: Limiter AVANT enrichissement
let mut fulltext_results = self.fulltext_search_with_gps(...).await?;

// Limiter à max_results AVANT enrichissement
fulltext_results.truncate(self.config.max_results as usize);

// Ensuite enrichir seulement les résultats limités
let service_ids: Vec<i32> = fulltext_results.iter().map(|r| r.service_id).collect();
// ...
```

**Gain**: **500ms-1s** (réduction de 50%)

---

### Solution 4: **Recherche UNIFIÉE au lieu de séquentielle** (MOYEN - Gain: 1-2s)

**Problème**: 3 recherches séquentielles (fulltext → trigram → keyword)

**Solution**: 1 seule requête SQL avec UNION ALL et scoring combiné

```sql
-- ✅ SOLUTION: 1 seule requête avec UNION ALL
WITH search_results AS (
    -- Fulltext
    SELECT id, data, fulltext_score as score, 'fulltext' as method
    FROM services
    WHERE to_tsvector('french', ...) @@ plainto_tsquery('french', $1)
    
    UNION ALL
    
    -- Trigram
    SELECT id, data, similarity(...) as score, 'trigram' as method
    FROM services
    WHERE similarity(...) > 0.1
    
    UNION ALL
    
    -- Keyword
    SELECT id, data, keyword_score as score, 'keyword' as method
    FROM services
    WHERE ... ILIKE '%' || $1 || '%'
)
SELECT DISTINCT ON (id) id, data, MAX(score) as final_score
FROM search_results
GROUP BY id, data
ORDER BY final_score DESC
LIMIT $2;
```

**Gain**: **1-2s → <500ms** (réduction de 60%)

---

### Solution 5: **Désactiver enrichissement Google Maps par défaut** (RAPIDE - Gain: 10-15s)

**Problème**: Enrichissement Google Maps activé par défaut (très lent)

**Solution**: Désactiver par défaut, activer seulement si demandé explicitement

```rust
// ✅ SOLUTION: Enrichissement optionnel
pub async fn search(
    &self,
    query: &str,
    enrich_with_google_maps: bool, // Nouveau paramètre
    // ...
) -> AppResult<Vec<SearchResult>> {
    // ...
    
    // Enrichir seulement si demandé explicitement
    if enrich_with_google_maps {
        SearchResult::enrich_with_google_maps(...).await;
    }
}
```

**Gain**: **10-15s** (désactivation complète)

---

## 🎯 PLAN D'ACTION PRIORITAIRE

### Phase 1: Corrections Immédiates (Gain: 10-15s → <2s)
1. ✅ **Désactiver enrichissement Google Maps par défaut** (gain immédiat: 10-15s)
2. ✅ **Batch Google Maps API** (si activé, gain: 10-15s → <1s)
3. ✅ **Batch SQL Google Places** (gain: 1-2s → <200ms)

### Phase 2: Optimisations Moyennes (Gain: 2-3s → <1s)
4. ✅ **LIMIT précoce avant enrichissement** (gain: 500ms-1s)
5. ✅ **Recherche unifiée** (gain: 1-2s → <500ms)

---

## 📝 IMPLÉMENTATION RECOMMANDÉE

### Étape 1: Désactiver Google Maps (gain immédiat)
```rust
// Dans native_search_service.rs
// Remplacer tous les appels enrich_with_google_maps par optionnel
if let Some(geo_service) = geographic_matching {
    // Seulement si explicitement demandé
    if should_enrich_with_google_maps {
        SearchResult::enrich_with_google_maps(...).await;
    }
}
```

### Étape 2: Batch Google Maps API
```rust
// Dans geographic_matching_service.rs
pub async fn calculate_distances_batch(
    &self,
    origin: (f64, f64),
    destinations: Vec<(f64, f64)>,
) -> AppResult<Vec<DistanceResult>> {
    // Implémenter batch API
}
```

### Étape 3: Batch SQL Google Places
```rust
// Dans enrich_google_places.rs
pub async fn enrich_services_with_google_places_batch(
    pool: &PgPool,
    service_ids: &[i32],
) -> Result<HashMap<i32, Value>, AppError> {
    // 1 seule requête SQL avec IN
}
```

---

## 🎯 RÉSULTAT ATTENDU

**Avant**: 16.7 secondes
**Après Phase 1**: **<2 secondes** (désactivation Google Maps + batch)
**Après Phase 2**: **<1 seconde** (toutes optimisations)

**Réduction totale**: **94%** (16.7s → <1s)

