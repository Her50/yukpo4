// Service de génération de combinaisons en arrière-plan
use super::exhaustive_combination_generator::ExhaustiveCombinationGenerator;
use crate::core::types::AppError;
use crate::state::AppState;
use sqlx::PgPool;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
// use super::autocomplete_combinations_service;

/// Génération de toutes les combinaisons en background
pub async fn generate_all_combinations_background(
    state: Arc<AppState>,
    ai_response: serde_json::Value,
    session_id: String,
) -> Result<(), AppError> {
    log::info!(
        "[Background] 🚀 Démarrage génération pour session {}",
        session_id
    );

    let start_time = Instant::now();

    // 1. Créer le générateur
    let generator = ExhaustiveCombinationGenerator::from_ia_response(&ai_response)?;
    let estimated_total = generator.estimate_total_combinations();

    log::info!(
        "[Background] Estimation: {} combinaisons à générer",
        estimated_total
    );

    // 2. Générer TOUTES les combinaisons
    let all_combinations = generator.generate_all_valid_combinations();

    let generation_time = start_time.elapsed();
    log::info!(
        "[Background] ✅ {} combinaisons générées en {:?}",
        all_combinations.len(),
        generation_time
    );

    // 3. Extraire les labels (dimensions)
    let product_labels = generator.dimensions[..generator.dimensions.len() - 1].to_vec();
    let location_labels = vec!["lieu".to_string()];

    // 4. Sauvegarder par BATCHES
    let batch_size = 1000;
    let total_batches = (all_combinations.len() + batch_size - 1) / batch_size;

    log::info!(
        "[Background] Sauvegarde en {} batches de {} combinaisons",
        total_batches,
        batch_size
    );

    for (i, chunk) in all_combinations.chunks(batch_size).enumerate() {
        // Sauvegarder le batch
        save_combinations_batch(
            &state.pg,
            chunk,
            &session_id,
            &product_labels,
            &location_labels,
        )
        .await?;

        // Mettre à jour la progression dans Redis
        {
            let current = (i + 1) * batch_size.min(all_combinations.len() - i * batch_size);
            update_progress(
                &state.redis_client,
                &session_id,
                current,
                all_combinations.len(),
            )
            .await
            .ok(); // Ignorer erreurs Redis
        }

        // Log progression
        if i % 10 == 0 || i == total_batches - 1 {
            log::info!(
                "[Background] Progression: {}/{} batches ({:.1}%) - {} combinaisons sauvegardées",
                i + 1,
                total_batches,
                ((i + 1) as f64 / total_batches as f64) * 100.0,
                (i + 1) * batch_size.min(all_combinations.len())
            );
        }

        // Petite pause pour ne pas surcharger la DB
        if i < total_batches - 1 {
            tokio::time::sleep(Duration::from_millis(10)).await;
        }
    }

    // 5. Marquer comme terminé
    {
        mark_generation_completed(&state.redis_client, &session_id)
            .await
            .ok();
    }

    let total_time = start_time.elapsed();
    log::info!(
        "[Background] ✅ Génération COMPLÈTE en {:?} pour session {}",
        total_time,
        session_id
    );
    log::info!(
        "[Background] Stats: {} combinaisons, {:.0} comb/s",
        all_combinations.len(),
        all_combinations.len() as f64 / total_time.as_secs_f64()
    );

    Ok(())
}

/// Sauvegarder un batch de combinaisons
async fn save_combinations_batch(
    pool: &PgPool,
    combinations: &[Vec<String>],
    session_id: &str,
    product_labels: &[String],
    location_labels: &[String],
) -> Result<(), AppError> {
    // Construire query bulk insert
    let mut query_builder = sqlx::QueryBuilder::new(
        "INSERT INTO autocomplete_combinations 
         (session_id, product_vector, location_vector, full_vector, 
          product_labels, location_labels, usage_count, is_ai_preferred, 
          ai_confidence, created_at, updated_at) ",
    );

    let mut unique_map: HashMap<Vec<String>, (Vec<String>, i32)> = HashMap::new();

    for combo in combinations {
        let product_key = if combo.len() > 1 {
            combo[..combo.len() - 1].to_vec()
        } else {
            Vec::new()
        };

        unique_map
            .entry(product_key)
            .and_modify(|(stored_combo, count)| {
                *count += 1;
                let stored_location = stored_combo.last().map(|s| s.trim()).unwrap_or_default();
                let candidate_location = combo.last().map(|s| s.trim()).unwrap_or_default();

                // Remplacer si la combinaison stockée est vide ou n'a pas de localisation utile
                if stored_combo.is_empty()
                    || (stored_location.is_empty() && !candidate_location.is_empty())
                {
                    *stored_combo = combo.clone();
                }
            })
            .or_insert_with(|| (combo.clone(), 1));
    }

    if unique_map.is_empty() {
        return Ok(());
    }

    query_builder.push_values(
        unique_map.into_iter(),
        |mut b, (product_vector, (full_vector, duplicates))| {
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

            b.push_bind(session_id)
                .push_bind(product_vector) // Pas de &, on donne ownership
                .push_bind(location_vector) // Pas de &, on donne ownership
                .push_bind(full_vector)
                .push_bind(product_labels)
                .push_bind(location_labels)
                .push_bind(duplicates) // usage_count initial = occurrences dans le batch
                .push_bind(false) // is_ai_preferred
                .push_bind(0.0_f64) // ai_confidence
                .push_bind(chrono::Utc::now())
                .push_bind(chrono::Utc::now());
        },
    );

    query_builder.push(
        " ON CONFLICT ON CONSTRAINT unique_product_vector DO UPDATE SET \
            session_id = EXCLUDED.session_id, \
            location_vector = EXCLUDED.location_vector, \
            full_vector = EXCLUDED.full_vector, \
            product_labels = EXCLUDED.product_labels, \
            location_labels = EXCLUDED.location_labels, \
            usage_count = autocomplete_combinations.usage_count + 1, \
            updated_at = EXCLUDED.updated_at, \
            ai_confidence = GREATEST(autocomplete_combinations.ai_confidence, EXCLUDED.ai_confidence), \
            is_ai_preferred = autocomplete_combinations.is_ai_preferred OR EXCLUDED.is_ai_preferred"
    );

    query_builder
        .build()
        .execute(pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur sauvegarde batch: {}", e)))?;

    Ok(())
}

/// Mettre à jour la progression dans Redis
async fn update_progress(
    redis_client: &redis::Client,
    session_id: &str,
    current: usize,
    total: usize,
) -> Result<(), AppError> {
    // ✅ CORRIGÉ: Utiliser le helper Redis avec retry automatique
    use crate::utils::redis_helper;

    let key = format!("combination_progress:{}", session_id);

    let progress = serde_json::json!({
        "status": "in_progress",
        "current": current,
        "total": total,
        "percentage": (current as f64 / total as f64) * 100.0,
        "updated_at": chrono::Utc::now().to_rfc3339(),
    });

    redis_helper::set_with_retry(redis_client, &key, &progress.to_string(), Some(3600))
        .await
        .map_err(|e| AppError::Internal(format!("Erreur Redis SET (après retry): {}", e)))?;

    Ok(())
}

/// Marquer la génération comme terminée
async fn mark_generation_completed(
    redis_client: &redis::Client,
    session_id: &str,
) -> Result<(), AppError> {
    // ✅ CORRIGÉ: Utiliser le helper Redis avec retry automatique
    use crate::utils::redis_helper;

    let key = format!("combination_progress:{}", session_id);

    let progress = serde_json::json!({
        "status": "completed",
        "updated_at": chrono::Utc::now().to_rfc3339(),
    });

    redis_helper::set_with_retry(redis_client, &key, &progress.to_string(), Some(7200))
        .await
        .map_err(|e| AppError::Internal(format!("Erreur Redis SET (après retry): {}", e)))?;

    Ok(())
}

/// Estimer le temps de génération restant
pub fn estimate_generation_time(estimated_total: usize) -> u64 {
    // Estimation basée sur benchmarks
    // ~10000 combinaisons/seconde pour génération + sauvegarde
    let rate = 10000.0;
    let seconds = (estimated_total as f64 / rate).ceil() as u64;
    seconds.max(1)
}
