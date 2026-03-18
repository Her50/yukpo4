// 🔧 Script de migration pour réindexer les produits existants dans autocomplete_characteristics
// Ce script trouve les produits dans services.data qui ne sont pas dans autocomplete_characteristics
// et les indexe pour qu'ils soient trouvables dans la recherche

use sqlx::PgPool;
use serde_json::Value;
use crate::services::creer_service::save_autocomplete_combination;
use crate::core::types::AppError;

/// Réindexer tous les produits existants qui ne sont pas dans autocomplete_characteristics
pub async fn reindex_existing_products(pool: &PgPool) -> Result<usize, AppError> {
    use crate::utils::log::{log_info, log_error};
    
    log_info("[REINDEX_PRODUITS] Début réindexation des produits existants...");
    
    // Trouver tous les services avec produits mais non indexés
    let services_with_products = sqlx::query(
        r#"
        SELECT DISTINCT s.id, s.data
        FROM services s
        WHERE s.is_active = true
        AND s.data->'produits' IS NOT NULL
        AND jsonb_typeof(s.data->'produits'->'valeur') = 'array'
        AND jsonb_array_length(s.data->'produits'->'valeur') > 0
        AND NOT EXISTS (
            SELECT 1 FROM autocomplete_characteristics ac
            WHERE ac.service_id = s.id
            AND ac.identifiant_base = 'produits'
            AND ac.is_real_product = TRUE
        )
        ORDER BY s.id
        "#
    )
    .fetch_all(pool)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur récupération services: {}", e)))?;
    
    log_info(&format!(
        "[REINDEX_PRODUITS] {} services avec produits non indexés trouvés",
        services_with_products.len()
    ));
    
    let mut success_count = 0;
    let mut error_count = 0;
    
    for row in &services_with_products {
        let service_id: i32 = row.try_get("id").unwrap_or(0);
        let data: Value = row.try_get("data").unwrap_or(Value::Null);
        
        match save_autocomplete_combination(pool, service_id, &data).await {
            Ok(_) => {
                success_count += 1;
                if success_count % 10 == 0 {
                    log_info(&format!(
                        "[REINDEX_PRODUITS] Progression: {} services indexés...",
                        success_count
                    ));
                }
            }
            Err(e) => {
                error_count += 1;
                log_error(&format!(
                    "[REINDEX_PRODUITS] Erreur indexation service {}: {}",
                    service_id, e
                ));
            }
        }
    }
    
    log_info(&format!(
        "[REINDEX_PRODUITS] ✅ Réindexation terminée: {} succès, {} erreurs",
        success_count, error_count
    ));
    
    Ok(success_count)
}

