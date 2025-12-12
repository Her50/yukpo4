# 🔍 Analyse du problème de performance - Création de service

## 📊 Problèmes identifiés

### 1. **Requête globale très lente** ⚠️
- **Endpoint** : `POST /api/ia/creation-service`
- **Temps de réponse** : **13.8 secondes** (inacceptable)
- **Seuil d'alerte** : > 1 seconde

### 2. **Requête SQL batch INSERT très lente** 🐌
- **Table** : `autocomplete_combinations`
- **Temps d'exécution** : **1.27 secondes** pour 500 lignes
- **Nombre de paramètres** : **> 4000 paramètres** (11 par ligne × 500 lignes)
- **Localisation** : `backend/src/services/background_combination_generator.rs::save_combinations_batch`

### 3. **Sauvegarde des seeds bloquante** ⏱️
- **Temps** : **528ms** pour sauvegarder 1 combinaison seed
- **Impact** : Bloque la réponse HTTP avant le lancement du background
- **Localisation** : `backend/src/services/autocomplete_combinations_service.rs::upsert_combination`

### 4. **Génération de combinaisons en arrière-plan** 🔄
- **Volume** : 1728 combinaisons générées
- **Batches** : 2 batches de 1000 combinaisons
- **Temps total** : ~3.9 secondes (en background, mais impacte la DB)

## 🔬 Analyse détaillée

### Requête INSERT problématique

```rust
// backend/src/services/background_combination_generator.rs:129-211
query_builder.push_values(
    unique_map.into_iter(),
    |mut b, (product_vector, (full_vector, duplicates))| {
        // 11 paramètres par ligne
        b.push_bind(session_id)
            .push_bind(product_vector)
            .push_bind(location_vector)
            .push_bind(full_vector)
            .push_bind(product_labels)
            .push_bind(location_labels)
            .push_bind(duplicates)
            .push_bind(false)
            .push_bind(0.0_f64)
            .push_bind(chrono::Utc::now())
            .push_bind(chrono::Utc::now());
    },
);
```

**Problème** : Avec 500 lignes, cela génère une requête SQL avec **5500 paramètres**, ce qui est :
- Très lent à parser pour PostgreSQL
- Très lent à exécuter
- Consomme beaucoup de mémoire

### Logs révélateurs

```
{"timestamp":"2025-12-12T16:44:19.579634Z","level":"WARN","fields":{
  "message":"slow statement: execution time exceeded alert threshold",
  "summary":"INSERT INTO autocomplete_combinations (session_id, …",
  "elapsed":"1.270482514s",
  "slow_threshold":"1s"
}}
```

```
{"timestamp":"2025-12-12T16:44:19.205281Z","level":"ERROR","fields":{
  "message":"🚨 [VerySlowRequest] POST /api/ia/creation-service -> 200 (13888 ms)"
}}
```

## ✅ Solutions proposées

### Solution 1 : Utiliser COPY FROM (Recommandé) 🚀

**Avantage** : 10-100x plus rapide que INSERT batch

```rust
// backend/src/services/background_combination_generator.rs

use sqlx::postgres::{PgCopyIn, PgRow};
use sqlx::Row;

async fn save_combinations_batch_copy(
    pool: &PgPool,
    combinations: &[Vec<String>],
    session_id: &str,
    product_labels: &[String],
    location_labels: &[String],
) -> Result<(), AppError> {
    // Préparer les données
    let mut unique_map: HashMap<Vec<String>, (Vec<String>, i32)> = HashMap::new();
    
    for combo in combinations {
        // ... même logique de déduplication ...
    }

    if unique_map.is_empty() {
        return Ok(());
    }

    // Utiliser COPY FROM pour insertion rapide
    let mut copy = pool
        .copy_in_raw(
            "COPY autocomplete_combinations \
             (session_id, product_vector, location_vector, full_vector, \
              product_labels, location_labels, usage_count, is_ai_preferred, \
              ai_confidence, created_at, updated_at) \
             FROM STDIN WITH (FORMAT binary)"
        )
        .await?;

    let now = chrono::Utc::now();
    
    for (product_vector, (full_vector, duplicates)) in unique_map {
        let location_vector = if !full_vector.is_empty() {
            let candidate = full_vector.last().cloned().unwrap_or_default();
            if candidate.trim().is_empty() {
                Vec::new()
            } else {
                vec![candidate]
            }
        } else {
            Vec::new()
        };

        // Écrire en format binary PostgreSQL
        copy.send(
            &[
                session_id.as_bytes(),
                &serde_json::to_vec(&product_vector)?,
                &serde_json::to_vec(&location_vector)?,
                &serde_json::to_vec(&full_vector)?,
                &serde_json::to_vec(&product_labels)?,
                &serde_json::to_vec(&location_labels)?,
                &duplicates.to_be_bytes(),
                &[if false { 1 } else { 0 }],
                &0.0_f64.to_be_bytes(),
                &now.timestamp().to_be_bytes(),
                &now.timestamp().to_be_bytes(),
            ]
        ).await?;
    }

    copy.finish().await?;
    
    // Gérer les conflits avec une requête UPDATE séparée si nécessaire
    Ok(())
}
```

**Performance attendue** : De 1.27s à **~50-100ms** pour 500 lignes

### Solution 2 : Réduire la taille des batches 📦

**Avantage** : Simple à implémenter, réduit la charge

```rust
// backend/src/services/background_combination_generator.rs:48
let batch_size = 100; // Au lieu de 1000
```

**Performance attendue** : De 1.27s à **~200-300ms** par batch (mais plus de batches)

### Solution 3 : Utiliser des transactions avec INSERT multiples plus petits 🔄

**Avantage** : Équilibre entre simplicité et performance

```rust
async fn save_combinations_batch_chunked(
    pool: &PgPool,
    combinations: &[Vec<String>],
    session_id: &str,
    product_labels: &[String],
    location_labels: &[String],
) -> Result<(), AppError> {
    // ... préparation unique_map ...
    
    let chunk_size = 50; // 50 lignes par INSERT
    let mut transaction = pool.begin().await?;
    
    for chunk in unique_map.chunks(chunk_size) {
        let mut query_builder = sqlx::QueryBuilder::new(
            "INSERT INTO autocomplete_combinations ... "
        );
        
        query_builder.push_values(chunk, |mut b, ...| {
            // ... bind values ...
        });
        
        query_builder
            .build()
            .execute(&mut *transaction)
            .await?;
    }
    
    transaction.commit().await?;
    Ok(())
}
```

**Performance attendue** : De 1.27s à **~300-500ms**

### Solution 4 : Optimiser la sauvegarde des seeds ⚡

**Problème actuel** : `upsert_combination` utilise une fonction PostgreSQL qui peut être lente

```rust
// backend/src/services/autocomplete_combinations_service.rs:139
let base_insert = sqlx::query(
    r#"
    SELECT upsert_autocomplete_combination(...) as id
    "#,
)
```

**Solution** : Utiliser INSERT ... ON CONFLICT directement

```rust
pub async fn upsert_combination_optimized(
    pool: &PgPool,
    // ... params ...
) -> Result<i32, AppError> {
    let result = sqlx::query(
        r#"
        INSERT INTO autocomplete_combinations 
        (session_id, product_vector, location_vector, full_vector, 
         product_labels, location_labels, usage_count, is_ai_preferred, 
         ai_confidence, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (product_vector) DO UPDATE SET
            session_id = EXCLUDED.session_id,
            location_vector = EXCLUDED.location_vector,
            full_vector = EXCLUDED.full_vector,
            product_labels = EXCLUDED.product_labels,
            location_labels = EXCLUDED.location_labels,
            usage_count = autocomplete_combinations.usage_count + 1,
            updated_at = EXCLUDED.updated_at,
            ai_confidence = GREATEST(autocomplete_combinations.ai_confidence, EXCLUDED.ai_confidence),
            is_ai_preferred = autocomplete_combinations.is_ai_preferred OR EXCLUDED.is_ai_preferred
        RETURNING id
        "#,
    )
    .bind(session_id)
    .bind(product_vector)
    // ... autres binds ...
    .fetch_one(pool)
    .await?;
    
    Ok(result.get("id"))
}
```

**Performance attendue** : De 528ms à **~50-100ms**

### Solution 5 : Désactiver temporairement la génération en background 🎯

**Pour tests rapides** : Ne pas générer toutes les combinaisons immédiatement

```rust
// backend/src/routers/router_yukpo.rs:1861
// Optionnel : désactiver la génération background pour tests
if std::env::var("DISABLE_BACKGROUND_COMBINATIONS").is_ok() {
    log::info!("[Background] Génération désactivée (variable d'environnement)");
} else {
    tokio::spawn(generate_all_combinations_background(
        state.clone(),
        data.clone(),
        session_id.clone(),
    ));
}
```

## 🎯 Plan d'action recommandé

### Phase 1 : Quick wins (1-2h)
1. ✅ Réduire batch_size de 1000 à 100
2. ✅ Optimiser `upsert_combination` avec INSERT direct
3. ✅ Ajouter index sur `product_vector` si manquant

### Phase 2 : Optimisation majeure (4-6h)
1. ✅ Implémenter COPY FROM pour insertions batch
2. ✅ Ajouter monitoring des requêtes lentes
3. ✅ Optimiser la requête ON CONFLICT

### Phase 3 : Optimisation avancée (optionnel)
1. ✅ Utiliser un worker séparé pour génération background
2. ✅ Implémenter un cache Redis pour combinaisons fréquentes
3. ✅ Lazy loading des combinaisons (générer à la demande)

## 📈 Résultats attendus

| Solution | Temps actuel | Temps cible | Amélioration |
|----------|--------------|-------------|--------------|
| Requête globale | 13.8s | < 2s | **85%** |
| INSERT batch (500) | 1.27s | < 100ms | **92%** |
| Upsert seed (1) | 528ms | < 100ms | **81%** |

## 🔍 Vérifications à faire

1. **Index sur `product_vector`** :
```sql
CREATE INDEX IF NOT EXISTS idx_autocomplete_product_vector 
ON autocomplete_combinations USING GIN (product_vector);
```

2. **Statistiques PostgreSQL** :
```sql
ANALYZE autocomplete_combinations;
```

3. **Configuration PostgreSQL** :
```sql
-- Vérifier work_mem, shared_buffers, etc.
SHOW work_mem;
SHOW shared_buffers;
```

## 📝 Notes importantes

- La génération de 1728 combinaisons est normale pour 9 dimensions avec plusieurs valeurs
- Le problème principal est la méthode d'insertion, pas le volume
- COPY FROM est la solution la plus performante mais nécessite plus de code
- Les solutions peuvent être combinées pour un effet optimal

