// Route de diagnostic pour vérifier la structure de la base de données
use axum::{
    routing::get,
    Router,
    Json,
    extract::State,
};
use serde::Serialize;
use sqlx::Row;
use std::sync::Arc;
use crate::state::AppState;

#[derive(Debug, Serialize)]
pub struct DiagnosticResponse {
    pub table_exists: bool,
    pub columns: Vec<String>,
    pub has_product_labels: bool,
    pub has_location_labels: bool,
    pub total_rows: i64,
    pub popular_products: i64,
    pub ai_preferred: i64,
    pub max_usage_count: Option<i32>,
    pub sample_products: Vec<serde_json::Value>,
    pub migrations_applied: Vec<String>,
}

/// GET /api/diagnostic/autocomplete-table
/// Vérifier la structure et le contenu de autocomplete_combinations
pub async fn diagnostic_autocomplete_table(
    State(state): State<Arc<AppState>>,
) -> Json<DiagnosticResponse> {
    let pool = &state.pg;
    
    // 1. Vérifier si la table existe
    let table_exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'autocomplete_combinations'
        )"
    )
    .fetch_one(pool)
    .await
    .unwrap_or(false);
    
    if !table_exists {
        return Json(DiagnosticResponse {
            table_exists: false,
            columns: vec![],
            has_product_labels: false,
            has_location_labels: false,
            total_rows: 0,
            popular_products: 0,
            ai_preferred: 0,
            max_usage_count: None,
            sample_products: vec![],
            migrations_applied: vec![],
        });
    }
    
    // 2. Lister les colonnes
    let column_rows = sqlx::query(
        "SELECT column_name FROM information_schema.columns 
         WHERE table_schema = 'public' AND table_name = 'autocomplete_combinations'
         ORDER BY ordinal_position"
    )
    .fetch_all(pool)
    .await
    .unwrap_or_default();
    
    let columns: Vec<String> = column_rows.iter()
        .map(|row| row.get::<String, _>("column_name"))
        .collect();
    
    let has_product_labels = columns.contains(&"product_labels".to_string());
    let has_location_labels = columns.contains(&"location_labels".to_string());
    
    // 3. Statistiques
    let stats = sqlx::query(
        "SELECT 
            COUNT(*) as total_rows,
            COUNT(CASE WHEN usage_count >= 2 THEN 1 END) as popular_products,
            COUNT(CASE WHEN is_ai_preferred = TRUE THEN 1 END) as ai_preferred,
            MAX(usage_count) as max_usage_count
         FROM autocomplete_combinations"
    )
    .fetch_one(pool)
    .await
    .ok();
    
    let (total_rows, popular_products, ai_preferred, max_usage_count) = if let Some(row) = stats {
        (
            row.get::<i64, _>("total_rows"),
            row.get::<i64, _>("popular_products"),
            row.get::<i64, _>("ai_preferred"),
            row.get::<Option<i32>, _>("max_usage_count"),
        )
    } else {
        (0, 0, 0, None)
    };
    
    // 4. Exemples de produits (si product_labels existe)
    let sample_products = if has_product_labels && total_rows > 0 {
        sqlx::query(
            "SELECT 
                product_vector,
                product_labels,
                usage_count,
                prix,
                has_variant
             FROM autocomplete_combinations
             ORDER BY usage_count DESC
             LIMIT 3"
        )
        .fetch_all(pool)
        .await
        .ok()
        .map(|rows| {
            rows.iter().map(|row| {
                serde_json::json!({
                    "product_vector": row.get::<Vec<String>, _>("product_vector"),
                    "product_labels": row.get::<Vec<String>, _>("product_labels"),
                    "usage_count": row.get::<i32, _>("usage_count"),
                    "prix": row.get::<Option<f64>, _>("prix"),
                    "has_variant": row.get::<bool, _>("has_variant"),
                })
            }).collect()
        })
        .unwrap_or_default()
    } else {
        vec![]
    };
    
    // 5. Migrations appliquées
    let migration_rows = sqlx::query(
        "SELECT version FROM _sqlx_migrations 
         WHERE description LIKE '%autocomplete%' 
         OR description LIKE '%product_labels%'
         OR description LIKE '%missing_columns%'
         ORDER BY installed_on DESC
         LIMIT 10"
    )
    .fetch_all(pool)
    .await
    .unwrap_or_default();
    
    let migrations_applied: Vec<String> = migration_rows.iter()
        .map(|row| row.get::<i64, _>("version").to_string())
        .collect();
    
    Json(DiagnosticResponse {
        table_exists,
        columns,
        has_product_labels,
        has_location_labels,
        total_rows,
        popular_products,
        ai_preferred,
        max_usage_count,
        sample_products,
        migrations_applied,
    })
}

pub fn diagnostic_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .route("/api/diagnostic/autocomplete-table", get(diagnostic_autocomplete_table))
        .with_state(state)
}

