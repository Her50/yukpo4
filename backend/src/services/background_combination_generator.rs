// Service de génération de combinaisons en arrière-plan
use std::sync::Arc;
use std::time::{Duration, Instant};
use sqlx::PgPool;
use crate::core::types::AppError;
use crate::state::AppState;
use super::exhaustive_combination_generator::ExhaustiveCombinationGenerator;
use super::autocomplete_combinations_service;

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
    let product_labels = generator.dimensions[..generator.dimensions.len()-1].to_vec();
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
        ).await?;
        
        // Mettre à jour la progression dans Redis
        if let Some(ref redis_client) = state.redis_client {
            let current = (i + 1) * batch_size.min(all_combinations.len() - i * batch_size);
            update_progress(
                redis_client,
                &session_id,
                current,
                all_combinations.len(),
            ).await.ok(); // Ignorer erreurs Redis
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
    if let Some(ref redis_client) = state.redis_client {
        mark_generation_completed(redis_client, &session_id).await.ok();
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
          ai_confidence, created_at, updated_at) "
    );
    
    query_builder.push_values(combinations, |mut b, combo| {
        // Séparer product_vector et location_vector
        let product_vector = if combo.len() > 1 {
            combo[..combo.len()-1].to_vec()
        } else {
            vec![]
        };
        
        let location_vector = if !combo.is_empty() {
            vec![combo.last().unwrap().clone()]
        } else {
            vec![String::new()]
        };
        
        b.push_bind(session_id)
         .push_bind(&product_vector)
         .push_bind(&location_vector)
         .push_bind(combo)
         .push_bind(product_labels)
         .push_bind(location_labels)
         .push_bind(0_i32)  // usage_count
         .push_bind(false)  // is_ai_preferred
         .push_bind(0.0_f32)  // ai_confidence
         .push_bind(chrono::Utc::now())
         .push_bind(chrono::Utc::now());
    });
    
    query_builder.build()
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
    let mut conn = redis_client.get_async_connection().await
        .map_err(|e| AppError::Internal(format!("Erreur Redis: {}", e)))?;
    
    let key = format!("combination_progress:{}", session_id);
    
    let progress = serde_json::json!({
        "status": "in_progress",
        "current": current,
        "total": total,
        "percentage": (current as f64 / total as f64) * 100.0,
        "updated_at": chrono::Utc::now().to_rfc3339(),
    });
    
    let _: () = redis::cmd("SET")
        .arg(&key)
        .arg(progress.to_string())
        .arg("EX")
        .arg(3600) // Expire après 1h
        .query_async(&mut conn)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur Redis SET: {}", e)))?;
    
    Ok(())
}

/// Marquer la génération comme terminée
async fn mark_generation_completed(
    redis_client: &redis::Client,
    session_id: &str,
) -> Result<(), AppError> {
    let mut conn = redis_client.get_async_connection().await
        .map_err(|e| AppError::Internal(format!("Erreur Redis: {}", e)))?;
    
    let key = format!("combination_progress:{}", session_id);
    
    let progress = serde_json::json!({
        "status": "completed",
        "updated_at": chrono::Utc::now().to_rfc3339(),
    });
    
    let _: () = redis::cmd("SET")
        .arg(&key)
        .arg(progress.to_string())
        .arg("EX")
        .arg(7200) // Garde 2h après complétion
        .query_async(&mut conn)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur Redis SET: {}", e)))?;
    
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

