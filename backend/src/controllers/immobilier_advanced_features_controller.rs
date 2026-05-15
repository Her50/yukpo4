// ✅ NOUVEAU 2026-01-26: Contrôleur pour améliorations optionnelles (nice to have)
// Favoris avancés, Analytics, QR codes, Exports, Calendrier, Thèmes

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::Arc;

use crate::core::types::{AppError, AppResult, AppState};
use crate::middlewares::jwt::AuthenticatedUser;
use crate::middlewares::jwt::Extension;
use rust_decimal::Decimal;

// ============================================
// 1. FAVORIS AVANCÉS (Collections, Tags, Notes)
// ============================================

#[derive(Debug, Deserialize)]
pub struct CreateCollectionRequest {
    pub name: String,
    pub description: Option<String>,
    pub color: Option<String>,
    pub icon: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct CollectionResponse {
    pub id: i32,
    pub name: String,
    pub description: Option<String>,
    pub color: String,
    pub icon: String,
    pub is_default: bool,
    pub property_count: i64,
}

/// POST /api/immobilier/favorites/collections
pub async fn create_favorite_collection(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(request): Json<CreateCollectionRequest>,
) -> AppResult<impl IntoResponse> {
    let collection_id: i32 = sqlx::query_scalar(
        r#"
        INSERT INTO immobilier_favorite_collections (user_id, name, description, color, icon)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
        "#
    )
    .bind(user_id)
    .bind(&request.name)
    .bind(request.description.as_deref())
    .bind(request.color.as_deref().unwrap_or("#6366F1"))
    .bind(request.icon.as_deref().unwrap_or("heart"))
    .fetch_one(&state.pg)
    .await
    .map_err(|e| {
        log::error!("[create_favorite_collection] Erreur: {}", e);
        AppError::Internal("Erreur création collection".to_string())
    })?;

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "success": true,
            "data": { "id": collection_id }
        })),
    ))
}

/// GET /api/immobilier/favorites/collections
pub async fn get_my_collections(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    #[derive(sqlx::FromRow)]
    struct CollectionRow {
        id: i32,
        name: String,
        description: Option<String>,
        color: String,
        icon: String,
        is_default: bool,
        property_count: i64,
    }

    let collections: Vec<CollectionRow> = sqlx::query_as(
        r#"
        SELECT 
            c.id,
            c.name,
            c.description,
            c.color,
            c.icon,
            c.is_default,
            COUNT(f.id) as property_count
        FROM immobilier_favorite_collections c
        LEFT JOIN immobilier_favorites_advanced f ON f.collection_id = c.id
        WHERE c.user_id = $1
        GROUP BY c.id, c.name, c.description, c.color, c.icon, c.is_default
        ORDER BY c.is_default DESC, c.created_at DESC
        "#
    )
    .bind(user_id)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| {
        log::error!("[get_my_collections] Erreur: {}", e);
        AppError::Internal("Erreur récupération collections".to_string())
    })?;

    let collections_json: Vec<Value> = collections.into_iter().map(|c| {
        json!({
            "id": c.id,
            "name": c.name,
            "description": c.description,
            "color": c.color,
            "icon": c.icon,
            "is_default": c.is_default,
            "property_count": c.property_count
        })
    }).collect();

    Ok(Json(json!({
        "success": true,
        "data": collections_json
    })))
}

#[derive(Debug, Deserialize)]
pub struct AddToCollectionRequest {
    pub collection_id: Option<i32>, // NULL = collection par défaut
    pub tags: Option<Vec<String>>,
    pub notes: Option<String>,
}

/// POST /api/immobilier/favorites/{property_id}/add
pub async fn add_to_favorites_advanced(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(property_id): Path<i32>,
    Json(request): Json<AddToCollectionRequest>,
) -> AppResult<impl IntoResponse> {
    // Récupérer ou créer collection par défaut
    let collection_id = if let Some(cid) = request.collection_id {
        cid
    } else {
        // Récupérer collection par défaut ou créer si n'existe pas
        let default_collection: Option<i32> = sqlx::query_scalar(
            "SELECT id FROM immobilier_favorite_collections WHERE user_id = $1 AND is_default = TRUE"
        )
        .bind(user_id)
        .fetch_optional(&state.pg)
        .await
        .ok()
        .flatten();

        if let Some(cid) = default_collection {
            cid
        } else {
            // Créer collection par défaut
            sqlx::query_scalar(
                r#"
                INSERT INTO immobilier_favorite_collections (user_id, name, description, is_default)
                VALUES ($1, 'Mes favoris', 'Collection par défaut', TRUE)
                ON CONFLICT (user_id, name) DO UPDATE SET is_default = TRUE
                RETURNING id
                "#
            )
            .bind(user_id)
            .fetch_one(&state.pg)
            .await
            .map_err(|e| {
                log::error!("[add_to_favorites_advanced] Erreur création collection: {}", e);
                AppError::Internal("Erreur création collection par défaut".to_string())
            })?
        }
    };

    // Convertir tags en JSONB
    let tags_json = if let Some(tags) = &request.tags {
        serde_json::to_value(tags).unwrap_or(json!([]))
    } else {
        json!([])
    };

    sqlx::query(
        r#"
        INSERT INTO immobilier_favorites_advanced (user_id, property_id, collection_id, tags, notes)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (user_id, property_id, collection_id) 
        DO UPDATE SET tags = $4, notes = $5, updated_at = NOW()
        "#
    )
    .bind(user_id)
    .bind(property_id)
    .bind(collection_id)
    .bind(&tags_json)
    .bind(request.notes.as_deref())
    .execute(&state.pg)
    .await
    .map_err(|e| {
        log::error!("[add_to_favorites_advanced] Erreur: {}", e);
        AppError::Internal("Erreur ajout favori".to_string())
    })?;

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "success": true,
            "message": "Ajouté aux favoris"
        })),
    ))
}

/// GET /api/immobilier/favorites/collection/{collection_id}
pub async fn get_collection_properties(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(collection_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    // Vérifier que la collection appartient à l'utilisateur
    let collection_exists: Option<i32> = sqlx::query_scalar(
        "SELECT id FROM immobilier_favorite_collections WHERE id = $1 AND user_id = $2"
    )
    .bind(collection_id)
    .bind(user_id)
    .fetch_optional(&state.pg)
    .await?;

    if collection_exists.is_none() {
        return Err(AppError::NotFound("Collection non trouvée".to_string()));
    }

    // Récupérer les biens de la collection avec leurs tags et notes
    let favorites: Vec<Value> = sqlx::query(
        r#"
        SELECT 
            f.id,
            f.property_id,
            f.tags,
            f.notes,
            p.titre,
            p.type_bien,
            p.statut,
            p.prix_vente,
            p.prix_location_mensuel,
            p.prix_location_journalier,
            p.photos
        FROM immobilier_favorites_advanced f
        INNER JOIN real_estate_properties p ON p.id = f.property_id
        WHERE f.collection_id = $1 AND f.user_id = $2
        ORDER BY f.created_at DESC
        "#
    )
    .bind(collection_id)
    .bind(user_id)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| {
        log::error!("[get_collection_properties] Erreur: {}", e);
        AppError::Internal("Erreur récupération favoris".to_string())
    })?
    .into_iter()
    .map(|row| {
        json!({
            "id": row.try_get::<i32, _>("id").unwrap_or(0),
            "property_id": row.try_get::<i32, _>("property_id").unwrap_or(0),
            "tags": row.try_get::<Value, _>("tags").ok().flatten().unwrap_or(json!([])),
            "notes": row.try_get::<Option<String>, _>("notes").ok().flatten(),
            "property": {
                "titre": row.try_get::<Option<String>, _>("titre").ok().flatten(),
                "type_bien": row.try_get::<Option<String>, _>("type_bien").ok().flatten(),
                "statut": row.try_get::<Option<String>, _>("statut").ok().flatten(),
                "prix_vente": row.try_get::<Option<Decimal>, _>("prix_vente").ok().flatten().and_then(|d| d.to_string().parse::<f64>().ok()),
                "prix_location_mensuel": row.try_get::<Option<Decimal>, _>("prix_location_mensuel").ok().flatten().and_then(|d| d.to_string().parse::<f64>().ok()),
                "prix_location_journalier": row.try_get::<Option<Decimal>, _>("prix_location_journalier").ok().flatten().and_then(|d| d.to_string().parse::<f64>().ok()),
                "photos": row.try_get::<Option<Value>, _>("photos").ok().flatten(),
            }
        })
    })
    .collect();

    Ok(Json(json!({
        "success": true,
        "data": favorites
    })))
}

// ============================================
// 2. ANALYTICS AVANCÉS
// ============================================

/// GET /api/immobilier/analytics/property/{property_id}
pub async fn get_property_analytics_advanced(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(property_id): Path<i32>,
    Query(params): Query<Value>, // period: "7d", "30d", "90d", "all"
) -> AppResult<impl IntoResponse> {
    // Vérifier que le bien appartient à l'utilisateur
    let property_owner: Option<i32> = sqlx::query_scalar(
        r#"
        SELECT s.user_id
        FROM real_estate_properties p
        INNER JOIN services s ON s.id = p.service_id
        WHERE p.id = $1
        "#
    )
    .bind(property_id)
    .fetch_optional(&state.pg)
    .await?;

    if property_owner.is_none() || property_owner.unwrap() != user_id {
        return Err(AppError::Forbidden("Accès non autorisé".to_string()));
    }

    let period = params.get("period").and_then(|v| v.as_str()).unwrap_or("30d");
    let date_filter = match period {
        "7d" => "NOW() - INTERVAL '7 days'",
        "30d" => "NOW() - INTERVAL '30 days'",
        "90d" => "NOW() - INTERVAL '90 days'",
        _ => "NOW() - INTERVAL '100 years'", // "all"
    };

    // Statistiques complètes
    let analytics: Value = sqlx::query_scalar(
        &format!(
            r#"
            SELECT json_build_object(
                'total_views', COUNT(DISTINCT v.id),
                'authenticated_views', COUNT(DISTINCT CASE WHEN v.user_id IS NOT NULL THEN v.id END),
                'anonymous_views', COUNT(DISTINCT CASE WHEN v.user_id IS NULL THEN v.id END),
                'total_contacts', COUNT(DISTINCT c.id),
                'total_shares', COUNT(DISTINCT s.id),
                'total_favorites', COUNT(DISTINCT f.id),
                'avg_view_duration', AVG(v.view_duration_seconds),
                'views_by_source', (
                    SELECT json_object_agg(source, count)
                    FROM (
                        SELECT source, COUNT(*) as count
                        FROM immobilier_property_views
                        WHERE property_id = $1 AND created_at >= {}
                        GROUP BY source
                    ) src
                ),
                'contacts_by_type', (
                    SELECT json_object_agg(contact_type, count)
                    FROM (
                        SELECT contact_type, COUNT(*) as count
                        FROM immobilier_property_contacts
                        WHERE property_id = $1 AND created_at >= {}
                        GROUP BY contact_type
                    ) ct
                ),
                'shares_by_platform', (
                    SELECT json_object_agg(share_platform, count)
                    FROM (
                        SELECT share_platform, COUNT(*) as count
                        FROM immobilier_property_shares
                        WHERE property_id = $1 AND created_at >= {}
                        GROUP BY share_platform
                    ) sp
                )
            )
            FROM real_estate_properties p
            LEFT JOIN immobilier_property_views v ON v.property_id = p.id AND v.created_at >= {}
            LEFT JOIN immobilier_property_contacts c ON c.property_id = p.id AND c.created_at >= {}
            LEFT JOIN immobilier_property_shares s ON s.property_id = p.id AND s.created_at >= {}
            LEFT JOIN immobilier_favorites_advanced f ON f.property_id = p.id
            WHERE p.id = $1
            "#,
            date_filter, date_filter, date_filter, date_filter, date_filter, date_filter
        )
    )
    .bind(property_id)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| {
        log::error!("[get_property_analytics_advanced] Erreur: {}", e);
        AppError::Internal("Erreur récupération analytics".to_string())
    })?;

    Ok(Json(json!({
        "success": true,
        "data": analytics
    })))
}

/// POST /api/immobilier/properties/{property_id}/track-view
pub async fn track_property_view(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(property_id): Path<i32>,
    Json(request): Json<Value>,
) -> AppResult<impl IntoResponse> {
    let user_id = user.id;
    let source = request.get("source").and_then(|v| v.as_str()).unwrap_or("direct");
    let referrer = request.get("referrer").and_then(|v| v.as_str());
    let view_duration = request.get("view_duration_seconds").and_then(|v| v.as_i64());
    let viewed_sections = request.get("viewed_sections").cloned().unwrap_or(json!({}));

    sqlx::query(
        r#"
        INSERT INTO immobilier_property_views (
            property_id, user_id, source, referrer, 
            view_duration_seconds, viewed_sections
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        "#
    )
    .bind(property_id)
    .bind(Some(user_id))
    .bind(source)
    .bind(referrer)
    .bind(view_duration)
    .bind(&viewed_sections)
    .execute(&state.pg)
    .await
    .ok(); // Ne pas faire échouer si tracking échoue

    Ok(Json(json!({
        "success": true
    })))
}

// ============================================
// 3. QR CODES POUR PARTAGE
// ============================================

/// POST /api/immobilier/properties/{property_id}/generate-qr
pub async fn generate_property_qr_code(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(property_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    // Générer URL de partage
    let share_url = format!("https://yukpo.app/immobilier/{}", property_id);
    
    // TODO: Générer QR code image (utiliser bibliothèque qrcode)
    // Pour l'instant, on retourne juste l'URL
    let qr_code_data = share_url.clone();
    let qr_code_url = format!("https://api.qrserver.com/v1/create-qr-code/?size=300x300&data={}", 
        urlencoding::encode(&qr_code_data));

    // Enregistrer le QR code
    let qr_id: i32 = sqlx::query_scalar(
        r#"
        INSERT INTO immobilier_qr_codes (
            property_id, user_id, qr_code_url, qr_code_data, share_url
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
        "#
    )
    .bind(property_id)
    .bind(user_id)
    .bind(&qr_code_url)
    .bind(&qr_code_data)
    .bind(&share_url)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| {
        log::error!("[generate_property_qr_code] Erreur: {}", e);
        AppError::Internal("Erreur génération QR code".to_string())
    })?;

    Ok(Json(json!({
        "success": true,
        "data": {
            "id": qr_id,
            "qr_code_url": qr_code_url,
            "share_url": share_url,
            "scan_count": 0
        }
    })))
}

// ============================================
// 4. EXPORTS PDF/EXCEL
// ============================================

#[derive(Debug, Deserialize)]
pub struct ExportRequest {
    pub export_type: String, // "pdf", "excel", "csv"
    pub export_format: String, // "property_details", "property_list", "analytics", "comparison"
    pub property_ids: Option<Vec<i32>>, // Pour export multiple
}

/// POST /api/immobilier/export
pub async fn export_properties(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(request): Json<ExportRequest>,
) -> AppResult<impl IntoResponse> {
    // TODO: Générer fichier PDF/Excel selon format
    // Pour l'instant, on retourne juste un placeholder
    
    let file_url = format!("/exports/{}/export_{}.{}", 
        user_id, 
        chrono::Utc::now().timestamp(),
        request.export_type
    );

    // Enregistrer l'export
    let export_id: i32 = sqlx::query_scalar(
        r#"
        INSERT INTO immobilier_exports (
            user_id, export_type, export_format, file_url, expires_at
        )
        VALUES ($1, $2, $3, $4, NOW() + INTERVAL '7 days')
        RETURNING id
        "#
    )
    .bind(user_id)
    .bind(&request.export_type)
    .bind(&request.export_format)
    .bind(&file_url)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| {
        log::error!("[export_properties] Erreur: {}", e);
        AppError::Internal("Erreur création export".to_string())
    })?;

    Ok(Json(json!({
        "success": true,
        "data": {
            "id": export_id,
            "file_url": file_url,
            "expires_at": chrono::Utc::now() + chrono::Duration::days(7)
        }
    })))
}

// ============================================
// 5. INTÉGRATIONS CALENDRIER
// ============================================

#[derive(Debug, Deserialize)]
pub struct CalendarIntegrationRequest {
    pub calendar_type: String, // "google", "ical", "outlook", "apple"
    pub calendar_url: Option<String>, // Pour iCal
    pub access_token: Option<String>, // Pour Google/Outlook
    pub refresh_token: Option<String>, // Pour Google/Outlook
}

/// POST /api/immobilier/properties/{property_id}/calendar/connect
pub async fn connect_calendar(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(property_id): Path<i32>,
    Json(request): Json<CalendarIntegrationRequest>,
) -> AppResult<impl IntoResponse> {
    // Vérifier que le bien appartient à l'utilisateur
    let property_owner: Option<i32> = sqlx::query_scalar(
        r#"
        SELECT s.user_id
        FROM real_estate_properties p
        INNER JOIN services s ON s.id = p.service_id
        WHERE p.id = $1
        "#
    )
    .bind(property_id)
    .fetch_optional(&state.pg)
    .await?;

    if property_owner.is_none() || property_owner.unwrap() != user_id {
        return Err(AppError::Forbidden("Accès non autorisé".to_string()));
    }

    // Créer ou mettre à jour l'intégration
    let integration_id: i32 = sqlx::query_scalar(
        r#"
        INSERT INTO immobilier_calendar_integrations (
            user_id, property_id, calendar_type, calendar_url, 
            access_token, refresh_token, is_active
        )
        VALUES ($1, $2, $3, $4, $5, $6, TRUE)
        ON CONFLICT (user_id, property_id, calendar_type)
        DO UPDATE SET 
            calendar_url = EXCLUDED.calendar_url,
            access_token = EXCLUDED.access_token,
            refresh_token = EXCLUDED.refresh_token,
            is_active = TRUE,
            updated_at = NOW()
        RETURNING id
        "#
    )
    .bind(user_id)
    .bind(property_id)
    .bind(&request.calendar_type)
    .bind(request.calendar_url.as_deref())
    .bind(request.access_token.as_deref())
    .bind(request.refresh_token.as_deref())
    .fetch_one(&state.pg)
    .await
    .map_err(|e| {
        log::error!("[connect_calendar] Erreur: {}", e);
        AppError::Internal("Erreur connexion calendrier".to_string())
    })?;

    Ok(Json(json!({
        "success": true,
        "data": { "integration_id": integration_id }
    })))
}

// ============================================
// 6. PERSONNALISATION THÈMES
// ============================================

#[derive(Debug, Deserialize)]
pub struct ThemeConfigRequest {
    pub theme_name: String,
    pub theme_config: Value, // JSON avec couleurs, fonts, etc.
    pub is_default: Option<bool>,
}

/// POST /api/immobilier/themes
pub async fn create_custom_theme(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(request): Json<ThemeConfigRequest>,
) -> AppResult<impl IntoResponse> {
    // Si c'est le thème par défaut, désactiver les autres
    if request.is_default.unwrap_or(false) {
        sqlx::query(
            "UPDATE user_immobilier_themes SET is_default = FALSE WHERE user_id = $1"
        )
        .bind(user_id)
        .execute(&state.pg)
        .await
        .ok();
    }

    let theme_id: i32 = sqlx::query_scalar(
        r#"
        INSERT INTO user_immobilier_themes (user_id, theme_name, theme_config, is_default)
        VALUES ($1, $2, $3, $4)
        RETURNING id
        "#
    )
    .bind(user_id)
    .bind(&request.theme_name)
    .bind(&request.theme_config)
    .bind(request.is_default.unwrap_or(false))
    .fetch_one(&state.pg)
    .await
    .map_err(|e| {
        log::error!("[create_custom_theme] Erreur: {}", e);
        AppError::Internal("Erreur création thème".to_string())
    })?;

    Ok(Json(json!({
        "success": true,
        "data": { "id": theme_id }
    })))
}

/// GET /api/immobilier/themes
pub async fn get_my_themes(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    let themes: Vec<Value> = sqlx::query(
        r#"
        SELECT id, theme_name, theme_config, is_active, is_default, created_at
        FROM user_immobilier_themes
        WHERE user_id = $1
        ORDER BY is_default DESC, created_at DESC
        "#
    )
    .bind(user_id)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| {
        log::error!("[get_my_themes] Erreur: {}", e);
        AppError::Internal("Erreur récupération thèmes".to_string())
    })?
    .into_iter()
    .map(|row| {
        json!({
            "id": row.try_get::<i32, _>("id").unwrap_or(0),
            "theme_name": row.try_get::<String, _>("theme_name").unwrap_or_default(),
            "theme_config": row.try_get::<Value, _>("theme_config").ok().flatten().unwrap_or(json!({})),
            "is_active": row.try_get::<bool, _>("is_active").unwrap_or(true),
            "is_default": row.try_get::<bool, _>("is_default").unwrap_or(false),
            "created_at": row.try_get::<chrono::DateTime<chrono::Utc>, _>("created_at").ok().map(|d| d.to_rfc3339()),
        })
    })
    .collect();

    Ok(Json(json!({
        "success": true,
        "data": themes
    })))
}

