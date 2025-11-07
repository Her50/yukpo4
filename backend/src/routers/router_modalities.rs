use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::middlewares::jwt::AuthenticatedUser;
use crate::state::AppState;

// ===========================
// STRUCTURES DE DONNÉES
// ===========================

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct ProductModality {
    pub id: i32,
    pub product_type: String,
    pub field_name: String,
    pub modality: String,
    pub added_by: Option<i32>,
    pub added_at: chrono::DateTime<chrono::Utc>,
    pub usage_count: i32,
    pub is_system: bool,
}

#[derive(Debug, Deserialize)]
pub struct CreateModalityRequest {
    pub product_type: String,
    pub field_name: String,
    pub modality: String,
}

#[derive(Debug, Deserialize)]
pub struct IncrementUsageRequest {
    pub product_type: String,
    pub field_name: String,
    pub modality: String,
}

#[derive(Debug, Deserialize)]
pub struct ModalityQueryParams {
    pub product_type: Option<String>,
    pub field_name: Option<String>,
    pub limit: Option<i32>,
}

#[derive(Debug, Serialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}

// ===========================
// HANDLERS
// ===========================

/// GET /api/modalities/custom
/// Récupérer toutes les modalités personnalisées (optionnellement filtrées)
pub async fn get_custom_modalities(
    State(state): State<Arc<AppState>>,
    Query(params): Query<ModalityQueryParams>,
) -> Result<Json<ApiResponse<Vec<ProductModality>>>, StatusCode> {
    let mut query = String::from(
        "SELECT id, product_type, field_name, modality, added_by, added_at, usage_count, is_system 
         FROM product_modalities 
         WHERE 1=1",
    );

    // Filtres optionnels
    if params.product_type.is_some() {
        query.push_str(" AND product_type = $1");
    }
    if params.field_name.is_some() {
        query.push_str(" AND field_name = $2");
    }

    query.push_str(" ORDER BY usage_count DESC, modality ASC");

    if let Some(limit) = params.limit {
        query.push_str(&format!(" LIMIT {}", limit));
    }

    // Exécuter la requête
    let modalities: Vec<ProductModality> = match (params.product_type, params.field_name) {
        (Some(pt), Some(fn_)) => {
            sqlx::query_as::<_, ProductModality>(
                r#"SELECT id, product_type, field_name, modality, added_by, added_at, usage_count, is_system 
                   FROM product_modalities 
                   WHERE product_type = $1 AND field_name = $2
                   ORDER BY usage_count DESC, modality ASC"#
            )
            .bind(pt)
            .bind(fn_)
            .fetch_all(&state.pg)
            .await
            .map_err(|e| {
                eprintln!("Erreur récupération modalités: {:?}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?
        }
        (Some(pt), None) => {
            sqlx::query_as::<_, ProductModality>(
                r#"SELECT id, product_type, field_name, modality, added_by, added_at, usage_count, is_system 
                   FROM product_modalities 
                   WHERE product_type = $1
                   ORDER BY usage_count DESC, modality ASC"#
            )
            .bind(pt)
            .fetch_all(&state.pg)
            .await
            .map_err(|e| {
                eprintln!("Erreur récupération modalités: {:?}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?
        }
        (None, Some(fn_)) => {
            sqlx::query_as::<_, ProductModality>(
                r#"SELECT id, product_type, field_name, modality, added_by, added_at, usage_count, is_system 
                   FROM product_modalities 
                   WHERE field_name = $1
                   ORDER BY usage_count DESC, modality ASC"#
            )
            .bind(fn_)
            .fetch_all(&state.pg)
            .await
            .map_err(|e| {
                eprintln!("Erreur récupération modalités: {:?}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?
        }
        (None, None) => {
            sqlx::query_as::<_, ProductModality>(
                r#"SELECT id, product_type, field_name, modality, added_by, added_at, usage_count, is_system 
                   FROM product_modalities 
                   ORDER BY usage_count DESC, modality ASC"#
            )
            .fetch_all(&state.pg)
            .await
            .map_err(|e| {
                eprintln!("Erreur récupération modalités: {:?}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?
        }
    };

    Ok(Json(ApiResponse {
        success: true,
        data: Some(modalities),
        error: None,
    }))
}

/// POST /api/modalities/custom
/// Créer une nouvelle modalité personnalisée
pub async fn create_custom_modality(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(payload): Json<CreateModalityRequest>,
) -> Result<Json<ApiResponse<ProductModality>>, StatusCode> {
    // Validation
    if payload.product_type.trim().is_empty() {
        return Ok(Json(ApiResponse {
            success: false,
            data: None,
            error: Some("Le type de produit est requis".to_string()),
        }));
    }

    if payload.field_name.trim().is_empty() {
        return Ok(Json(ApiResponse {
            success: false,
            data: None,
            error: Some("Le nom du champ est requis".to_string()),
        }));
    }

    if payload.modality.trim().is_empty() {
        return Ok(Json(ApiResponse {
            success: false,
            data: None,
            error: Some("La modalité est requise".to_string()),
        }));
    }

    // Normaliser les données
    let product_type = payload.product_type.trim().to_lowercase();
    let field_name = payload.field_name.trim().to_lowercase();
    let modality = payload.modality.trim();

    // Vérifier si la modalité existe déjà
    let existing = sqlx::query(
        "SELECT id FROM product_modalities 
         WHERE product_type = $1 AND field_name = $2 AND modality = $3",
    )
    .bind(&product_type)
    .bind(&field_name)
    .bind(&modality)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| {
        eprintln!("Erreur vérification modalité existante: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    if existing.is_some() {
        return Ok(Json(ApiResponse {
            success: false,
            data: None,
            error: Some("Cette modalité existe déjà".to_string()),
        }));
    }

    // Insérer la nouvelle modalité
    let new_modality = sqlx::query_as::<_, ProductModality>(
        r#"INSERT INTO product_modalities (product_type, field_name, modality, added_by, is_system)
           VALUES ($1, $2, $3, $4, false)
           RETURNING id, product_type, field_name, modality, added_by, added_at, usage_count, is_system"#
    )
    .bind(&product_type)
    .bind(&field_name)
    .bind(&modality)
    .bind(user.id)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| {
        eprintln!("Erreur création modalité: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    println!(
        "✅ Nouvelle modalité créée: {} > {} > {}",
        product_type, field_name, modality
    );

    Ok(Json(ApiResponse {
        success: true,
        data: Some(new_modality),
        error: None,
    }))
}

/// POST /api/modalities/usage
/// Incrémenter le compteur d'utilisation d'une modalité
pub async fn increment_modality_usage(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<IncrementUsageRequest>,
) -> Result<Json<ApiResponse<()>>, StatusCode> {
    let product_type = payload.product_type.trim().to_lowercase();
    let field_name = payload.field_name.trim().to_lowercase();
    let modality = payload.modality.trim();

    sqlx::query(
        "UPDATE product_modalities 
         SET usage_count = usage_count + 1, updated_at = NOW()
         WHERE product_type = $1 AND field_name = $2 AND modality = $3",
    )
    .bind(&product_type)
    .bind(&field_name)
    .bind(&modality)
    .execute(&state.pg)
    .await
    .map_err(|e| {
        eprintln!("Erreur incrément usage modalité: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(ApiResponse {
        success: true,
        data: Some(()),
        error: None,
    }))
}

/// GET /api/modalities/popular
/// Récupérer les modalités les plus populaires pour un type/champ donné
pub async fn get_popular_modalities(
    State(state): State<Arc<AppState>>,
    Query(params): Query<ModalityQueryParams>,
) -> Result<Json<ApiResponse<Vec<ProductModality>>>, StatusCode> {
    let limit = params.limit.unwrap_or(10);

    let modalities = match (params.product_type, params.field_name) {
        (Some(pt), Some(fn_)) => {
            sqlx::query_as::<_, ProductModality>(
                r#"SELECT id, product_type, field_name, modality, added_by, added_at, usage_count, is_system 
                   FROM product_modalities 
                   WHERE product_type = $1 AND field_name = $2
                   ORDER BY usage_count DESC
                   LIMIT $3"#
            )
            .bind(pt)
            .bind(fn_)
            .bind(limit as i64)
            .fetch_all(&state.pg)
            .await
            .map_err(|e| {
                eprintln!("Erreur récupération modalités populaires: {:?}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?
        }
        _ => {
            return Ok(Json(ApiResponse {
                success: false,
                data: None,
                error: Some("Les paramètres product_type et field_name sont requis".to_string()),
            }));
        }
    };

    Ok(Json(ApiResponse {
        success: true,
        data: Some(modalities),
        error: None,
    }))
}

/// DELETE /api/modalities/:id
/// Supprimer une modalité personnalisée (seulement si non-système)
pub async fn delete_modality(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(id): Path<i32>,
) -> Result<Json<ApiResponse<()>>, StatusCode> {
    // Vérifier si la modalité existe et n'est pas système
    let modality = sqlx::query("SELECT is_system, added_by FROM product_modalities WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.pg)
        .await
        .map_err(|e| {
            eprintln!("Erreur vérification modalité: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    match modality {
        None => {
            return Ok(Json(ApiResponse {
                success: false,
                data: None,
                error: Some("Modalité non trouvée".to_string()),
            }));
        }
        Some(m) => {
            use sqlx::Row;
            let is_system: bool = m.try_get("is_system").unwrap_or(false);
            let added_by: Option<i32> = m.try_get("added_by").ok();

            if is_system {
                return Ok(Json(ApiResponse {
                    success: false,
                    data: None,
                    error: Some("Les modalités système ne peuvent pas être supprimées".to_string()),
                }));
            }

            // Vérifier que l'utilisateur est le créateur ou admin
            if added_by != Some(user.id) {
                // TODO: Vérifier si l'utilisateur est admin
                return Ok(Json(ApiResponse {
                    success: false,
                    data: None,
                    error: Some("Vous n'êtes pas autorisé à supprimer cette modalité".to_string()),
                }));
            }
        }
    }

    // Supprimer la modalité
    sqlx::query("DELETE FROM product_modalities WHERE id = $1")
        .bind(id)
        .execute(&state.pg)
        .await
        .map_err(|e| {
            eprintln!("Erreur suppression modalité: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    println!("✅ Modalité {} supprimée", id);

    Ok(Json(ApiResponse {
        success: true,
        data: Some(()),
        error: None,
    }))
}

// ===========================
// ROUTER BUILDER
// ===========================

/// Construit le routeur pour les modalités de produits
pub fn modality_routes(state: Arc<AppState>) -> axum::Router<Arc<AppState>> {
    use crate::middlewares::jwt::jwt_auth;
    use axum::{
        routing::{delete, get, post},
        Router,
    };

    Router::<Arc<AppState>>::new()
        .route("/api/modalities/custom", get(get_custom_modalities))
        .route(
            "/api/modalities/custom",
            post(create_custom_modality).layer(axum::middleware::from_fn_with_state(
                state.clone(),
                jwt_auth,
            )),
        )
        .route("/api/modalities/usage", post(increment_modality_usage))
        .route("/api/modalities/popular", get(get_popular_modalities))
        .route(
            "/api/modalities/{id}",
            delete(delete_modality).layer(axum::middleware::from_fn_with_state(
                state.clone(),
                jwt_auth,
            )),
        )
        .with_state(state)
}
