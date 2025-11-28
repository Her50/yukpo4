# Analyse Performance : Enrichissement Google Places

**Date**: 2025-11-28  
**Problème identifié**: Enrichissement Google Places séquentiel dans 5/6 méthodes de recherche

## Problème actuel

### Méthodes avec enrichissement SÉQUENTIEL ❌

1. **`search_specialized_services()`** (ligne ~799)
   ```rust
   for result in &mut specialized_results {
       enrich_service_with_google_places_data(...).await; // 1 requête SQL par résultat
   }
   ```

2. **`search_services_gps_final()`** (ligne ~897)
   ```rust
   for result in &mut results {
       enrich_service_with_google_places_data(...).await; // 1 requête SQL par résultat
   }
   ```

3. **`search_services_gps_final_with_moment()`** (ligne ~1004)
   ```rust
   enrich_service_with_google_places_data(...).await; // 1 requête SQL par résultat
   ```

4. **`search_services_trigram_gps_optimized()`** (ligne ~1524)
   ```rust
   enrich_service_with_google_places_data(...).await; // 1 requête SQL par résultat
   ```

5. **`search_services_keywords_gps_optimized()`** (ligne ~1747)
   ```rust
   enrich_service_with_google_places_data(...).await; // 1 requête SQL par résultat
   ```

### Méthode avec enrichissement PARALLÉLISÉ ✅

1. **`search_services_fulltext()`** (ligne ~310)
   ```rust
   // ✅ OPTIMISÉ 2025-11-28: Paralléliser l'enrichissement Google Places
   let enrichment_results: Vec<_> = join_all(service_ids.iter().map(|&service_id| {
       enrich_service_with_google_places_data(...).await
   })).await;
   ```

## Impact performance

### Scénario : 20 résultats de recherche

**Séquentiel (5 méthodes)** :
- 20 requêtes SQL × 30ms = **600ms** ⚠️

**Parallélisé (1 méthode)** :
- 20 requêtes SQL en parallèle = **~50ms** ✅

**Batch (optimal)** :
- 1 requête SQL avec `WHERE service_id IN (...)` = **~20ms** ✅✅

## Solution proposée

Créer une fonction batch qui récupère toutes les données Google Places en une seule requête SQL :

```rust
pub async fn enrich_services_batch_with_google_places_data(
    pool: &PgPool,
    service_ids: &[i32],
    services_data: &mut HashMap<i32, Value>,
) -> Result<(), AppError> {
    // 1. Extraire tous les place_id des services
    let mut service_place_map: HashMap<i32, String> = HashMap::new();
    for (service_id, service_data) in services_data.iter() {
        if let Some(place_id) = extract_place_id(service_data) {
            service_place_map.insert(*service_id, place_id);
        }
    }
    
    if service_place_map.is_empty() {
        return Ok(());
    }
    
    // 2. Requête SQL batch : récupérer toutes les données en une fois
    let place_ids: Vec<String> = service_place_map.values().cloned().collect();
    let service_ids_vec: Vec<i32> = service_place_map.keys().cloned().collect();
    
    let rows = sqlx::query(
        r#"
        SELECT 
            service_id,
            place_id,
            jsonb_build_object(
                'place_id', place_id,
                'display_name', display_name,
                'formatted_address', formatted_address,
                'rating', rating,
                'photos', photos,
                -- ... tous les champs
            ) as google_place_data
        FROM google_places_data
        WHERE service_id = ANY($1) AND place_id = ANY($2)
        "#
    )
    .bind(&service_ids_vec[..])
    .bind(&place_ids[..])
    .fetch_all(pool)
    .await?;
    
    // 3. Appliquer les enrichissements
    for row in rows {
        let service_id: i32 = row.get("service_id");
        let google_place_data: Value = row.get("google_place_data");
        
        if let Some(service_data) = services_data.get_mut(&service_id) {
            if let Some(data_obj) = service_data.as_object_mut() {
                data_obj.insert("google_place".to_string(), google_place_data);
            }
        }
    }
    
    Ok(())
}
```

## Bénéfices

- **Performance** : 600ms → 20ms (30x plus rapide)
- **Charge DB** : 20 requêtes → 1 requête
- **Scalabilité** : Fonctionne même avec 100+ résultats

