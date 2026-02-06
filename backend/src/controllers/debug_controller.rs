use crate::state::AppState;
use axum::{extract::State, http::StatusCode, response::Json};
use serde_json::json;
use std::sync::Arc;

/// Route de debug pour vérifier l'existence et le contenu de toutes les tables importantes
pub async fn check_all_tables(
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let pool = &state.pg;

    log::info!("🔍 [Debug] Vérification de toutes les tables...");

    // Liste des tables à vérifier
    let tables = vec![
        "geo_hierarchy",
        "african_locations",
        "autocomplete_characteristics",
        "autocomplete_combinations",
        "search_history",
        "services",
        "users",
        "publicites",
        "notifications",
        "token_usage_logs",
        "service_reviews",
        "product_reactions",
        "chat_messages",
        "alerts",
        "signalements",
        "private_conversations",
        "bus_reservations",
        "payment_transactions",
        "token_transactions",
    ];

    let mut results = serde_json::Map::new();
    let mut total_tables_exist = 0;
    let mut total_tables_missing = 0;

    for table_name in tables {
        // Vérifier si la table existe
        let exists = sqlx::query_scalar::<_, bool>(&format!(
            "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = '{}')",
            table_name
        ))
        .fetch_one(pool)
        .await
        .unwrap_or(false);

        if exists {
            total_tables_exist += 1;

            // Compter les lignes
            let count =
                sqlx::query_scalar::<_, i64>(&format!("SELECT COUNT(*) FROM {}", table_name))
                    .fetch_one(pool)
                    .await
                    .unwrap_or(0);

            results.insert(
                table_name.to_string(),
                json!({
                    "exists": true,
                    "row_count": count,
                    "status": "✅"
                }),
            );

            log::info!("✅ [Debug] Table '{}': {} lignes", table_name, count);
        } else {
            total_tables_missing += 1;
            results.insert(
                table_name.to_string(),
                json!({
                    "exists": false,
                    "row_count": 0,
                    "status": "❌"
                }),
            );

            log::warn!("❌ [Debug] Table '{}': MANQUANTE", table_name);
        }
    }

    // Vérifier les fonctions SQL importantes
    let functions = vec![
        "extract_all_product_text",
        "deactivate_expired_products",
        "can_show_content",
        "get_eligible_organic_products",
        "get_eligible_paid_ads",
    ];

    let mut function_results = serde_json::Map::new();
    let mut total_functions_exist = 0;

    for func_name in functions {
        let exists = sqlx::query_scalar::<_, bool>(&format!(
            "SELECT EXISTS(SELECT 1 FROM pg_proc WHERE proname = '{}')",
            func_name
        ))
        .fetch_one(pool)
        .await
        .unwrap_or(false);

        if exists {
            total_functions_exist += 1;
            function_results.insert(
                func_name.to_string(),
                json!({
                    "exists": true,
                    "status": "✅"
                }),
            );
        } else {
            function_results.insert(
                func_name.to_string(),
                json!({
                    "exists": false,
                    "status": "❌"
                }),
            );
        }
    }

    // Vérifications spéciales pour autocomplete et localisation
    let mut special_checks = serde_json::Map::new();

    // 1. Vérifier les quartiers de Douala dans african_locations
    if results
        .get("african_locations")
        .and_then(|v| v.get("exists"))
        .and_then(|v| v.as_bool())
        .unwrap_or(false)
    {
        let douala_count = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM african_locations WHERE ville = 'Douala'",
        )
        .fetch_one(pool)
        .await
        .unwrap_or(0);

        special_checks.insert(
            "douala_quartiers".to_string(),
            json!({
                "count": douala_count,
                "status": if douala_count > 0 { "✅" } else { "⚠️" }
            }),
        );
    }

    // 2. Vérifier les quartiers de Yaoundé
    if results
        .get("african_locations")
        .and_then(|v| v.get("exists"))
        .and_then(|v| v.as_bool())
        .unwrap_or(false)
    {
        let yaounde_count = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM african_locations WHERE ville = 'Yaoundé'",
        )
        .fetch_one(pool)
        .await
        .unwrap_or(0);

        special_checks.insert(
            "yaounde_quartiers".to_string(),
            json!({
                "count": yaounde_count,
                "status": if yaounde_count > 0 { "✅" } else { "⚠️" }
            }),
        );
    }

    // 3. Vérifier les produits indexés dans autocomplete_characteristics
    if results
        .get("autocomplete_characteristics")
        .and_then(|v| v.get("exists"))
        .and_then(|v| v.as_bool())
        .unwrap_or(false)
    {
        let indexed_products = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM autocomplete_characteristics WHERE is_real_product = TRUE",
        )
        .fetch_one(pool)
        .await
        .unwrap_or(0);

        special_checks.insert(
            "indexed_products".to_string(),
            json!({
                "count": indexed_products,
                "status": if indexed_products > 0 { "✅" } else { "⚠️" }
            }),
        );
    }

    // 4. Vérifier les combinaisons d'autocomplete
    if results
        .get("autocomplete_combinations")
        .and_then(|v| v.get("exists"))
        .and_then(|v| v.as_bool())
        .unwrap_or(false)
    {
        let combinations_count =
            sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM autocomplete_combinations")
                .fetch_one(pool)
                .await
                .unwrap_or(0);

        special_checks.insert(
            "autocomplete_combinations_total".to_string(),
            json!({
                "count": combinations_count,
                "status": if combinations_count > 0 { "✅" } else { "⚠️" }
            }),
        );
    }

    log::info!(
        "✅ [Debug] Vérification terminée: {}/{} tables existent",
        total_tables_exist,
        total_tables_exist + total_tables_missing
    );

    Ok(Json(json!({
        "success": true,
        "summary": {
            "tables_exist": total_tables_exist,
            "tables_missing": total_tables_missing,
            "functions_exist": total_functions_exist,
            "database_ready": total_tables_missing == 0
        },
        "tables": results,
        "functions": function_results,
        "special_checks": special_checks,
        "timestamp": chrono::Utc::now().to_rfc3339()
    })))
}

/// Vérifier spécifiquement les tables d'autocomplete et localisation
pub async fn check_autocomplete_tables(
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let pool = &state.pg;

    log::info!("🔍 [Debug] Vérification des tables autocomplete et localisation...");

    let mut results = serde_json::Map::new();

    // 1. geo_hierarchy
    let geo_exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'geo_hierarchy')",
    )
    .fetch_one(pool)
    .await
    .unwrap_or(false);

    if geo_exists {
        let count = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM geo_hierarchy")
            .fetch_one(pool)
            .await
            .unwrap_or(0);

        results.insert(
            "geo_hierarchy".to_string(),
            json!({
                "exists": true,
                "count": count,
                "description": "Hiérarchie géographique (GeoNames)"
            }),
        );
    } else {
        results.insert(
            "geo_hierarchy".to_string(),
            json!({
                "exists": false,
                "count": 0,
                "description": "❌ MANQUANTE"
            }),
        );
    }

    // 2. african_locations
    let african_exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'african_locations')"
    )
    .fetch_one(pool)
    .await
    .unwrap_or(false);

    if african_exists {
        let count = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM african_locations")
            .fetch_one(pool)
            .await
            .unwrap_or(0);

        // Détails par ville
        let villes = sqlx::query_as::<_, (String, i64)>(
            "SELECT ville, COUNT(*) as count FROM african_locations GROUP BY ville ORDER BY count DESC"
        )
        .fetch_all(pool)
        .await
        .unwrap_or_default();

        let villes_map: serde_json::Map<String, serde_json::Value> =
            villes.into_iter().map(|(ville, count)| (ville, json!(count))).collect();

        results.insert(
            "african_locations".to_string(),
            json!({
                "exists": true,
                "total_count": count,
                "villes": villes_map,
                "description": "Lieux africains (quartiers)"
            }),
        );
    } else {
        results.insert(
            "african_locations".to_string(),
            json!({
                "exists": false,
                "count": 0,
                "description": "❌ MANQUANTE"
            }),
        );
    }

    // 3. autocomplete_characteristics
    let char_exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'autocomplete_characteristics')"
    )
    .fetch_one(pool)
    .await
    .unwrap_or(false);

    if char_exists {
        let total =
            sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM autocomplete_characteristics")
                .fetch_one(pool)
                .await
                .unwrap_or(0);

        let real_products = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM autocomplete_characteristics WHERE is_real_product = TRUE",
        )
        .fetch_one(pool)
        .await
        .unwrap_or(0);

        results.insert(
            "autocomplete_characteristics".to_string(),
            json!({
                "exists": true,
                "total_count": total,
                "real_products": real_products,
                "synthetic_products": total - real_products,
                "description": "Caractéristiques produits vectorielles"
            }),
        );
    } else {
        results.insert(
            "autocomplete_characteristics".to_string(),
            json!({
                "exists": false,
                "count": 0,
                "description": "❌ MANQUANTE"
            }),
        );
    }

    // 4. autocomplete_combinations
    let comb_exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'autocomplete_combinations')"
    )
    .fetch_one(pool)
    .await
    .unwrap_or(false);

    if comb_exists {
        let count = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM autocomplete_combinations")
            .fetch_one(pool)
            .await
            .unwrap_or(0);

        results.insert(
            "autocomplete_combinations".to_string(),
            json!({
                "exists": true,
                "count": count,
                "description": "Combinaisons de recherche"
            }),
        );
    } else {
        results.insert(
            "autocomplete_combinations".to_string(),
            json!({
                "exists": false,
                "count": 0,
                "description": "❌ MANQUANTE"
            }),
        );
    }

    // 5. search_history
    let history_exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'search_history')"
    )
    .fetch_one(pool)
    .await
    .unwrap_or(false);

    if history_exists {
        let count = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM search_history")
            .fetch_one(pool)
            .await
            .unwrap_or(0);

        results.insert(
            "search_history".to_string(),
            json!({
                "exists": true,
                "count": count,
                "description": "Historique recherches utilisateurs"
            }),
        );
    } else {
        results.insert(
            "search_history".to_string(),
            json!({
                "exists": false,
                "count": 0,
                "description": "❌ MANQUANTE"
            }),
        );
    }

    Ok(Json(json!({
        "success": true,
        "tables": results,
        "all_present": results.values().all(|v| v.get("exists").and_then(|e| e.as_bool()).unwrap_or(false)),
        "timestamp": chrono::Utc::now().to_rfc3339()
    })))
}

/// Nettoyer les combinaisons invalides (objet unique généré comme catalogue)
pub async fn clean_invalid_combinations(
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let pool = &state.pg;

    log::info!("🧹 [Debug] Nettoyage des combinaisons invalides...");

    // 1. Compter avant nettoyage
    let total_before =
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM autocomplete_combinations")
            .fetch_one(pool)
            .await
            .unwrap_or(0);

    // 2. Identifier les sessions avec trop de combinaisons
    let problematic_sessions = sqlx::query_as::<_, (Option<String>, i64)>(
        "SELECT session_id, COUNT(*) as count 
         FROM autocomplete_combinations 
         WHERE session_id IS NOT NULL 
         GROUP BY session_id 
         HAVING COUNT(*) > 50",
    )
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    log::info!(
        "🔍 [Debug] {} sessions avec >50 combinaisons détectées",
        problematic_sessions.len()
    );

    // 3. Nettoyer : Garder seulement la combinaison préférée de chaque session
    let deleted_count = sqlx::query(
        r#"
        DELETE FROM autocomplete_combinations
        WHERE id NOT IN (
            SELECT MIN(id)
            FROM autocomplete_combinations
            WHERE session_id IS NOT NULL AND is_ai_preferred = TRUE
            GROUP BY session_id
        )
        AND session_id IN (
            SELECT session_id
            FROM autocomplete_combinations
            WHERE session_id IS NOT NULL
            GROUP BY session_id
            HAVING COUNT(*) > 50
        )
        AND service_id IS NULL
        "#,
    )
    .execute(pool)
    .await
    .map(|r| r.rows_affected())
    .unwrap_or(0);

    // 4. Compter après nettoyage
    let total_after =
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM autocomplete_combinations")
            .fetch_one(pool)
            .await
            .unwrap_or(0);

    // 5. Optimiser la table
    let _ = sqlx::query("REINDEX TABLE autocomplete_combinations").execute(pool).await;

    let _ = sqlx::query("ANALYZE autocomplete_combinations").execute(pool).await;

    log::info!(
        "✅ [Debug] Nettoyage terminé: {} combinaisons supprimées",
        deleted_count
    );

    Ok(Json(json!({
        "success": true,
        "before": total_before,
        "after": total_after,
        "deleted": deleted_count,
        "problematic_sessions": problematic_sessions.len(),
        "message": format!("{} combinaisons invalides supprimées", deleted_count),
        "timestamp": chrono::Utc::now().to_rfc3339()
    })))
}
