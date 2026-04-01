// ✅ 2026-04-01: Contrôleur gestion groupes multi-biens hôtel/meublé,
//               formulaires personnalisés et profils clients

use crate::core::types::{AppError, AppResult};
use crate::middlewares::jwt::AuthenticatedUser;
use crate::models::hotel_room_management::{
    CreatePropertyGroupRequest, SaveClientProfileRequest, UpdateFormConfigRequest,
};
use crate::state::AppState;
use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use log::info;
use serde::Deserialize;
use serde_json::json;
use sqlx::Row;
use std::sync::Arc;

// ============================================================================
// GROUPES MULTI-PROPRIÉTÉS
// ============================================================================

/// POST /api/hotel/groups
/// Créer un groupe de propriétés (chaîne hôtelière, réseau meublés)
pub async fn create_property_group(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(request): Json<CreatePropertyGroupRequest>,
) -> AppResult<impl IntoResponse> {
    info!("[create_property_group] user_id={}", user_id);

    if request.group_name.trim().is_empty() {
        return Err(AppError::BadRequest(
            "Le nom du groupe est requis".to_string(),
        ));
    }

    let id: i32 = sqlx::query_scalar(
        r#"
        INSERT INTO hotel_property_groups
            (partner_id, group_name, description, logo_url, company_name,
             tax_id, address, phone, email, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE)
        RETURNING id
        "#,
    )
    .bind(user_id)
    .bind(request.group_name.trim())
    .bind(&request.description)
    .bind(&request.logo_url)
    .bind(&request.company_name)
    .bind(&request.tax_id)
    .bind(&request.address)
    .bind(&request.phone)
    .bind(&request.email)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| {
        log::error!("[create_property_group] Erreur: {}", e);
        AppError::Internal("Erreur création groupe".to_string())
    })?;

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "success": true,
            "message": "Groupe créé avec succès",
            "id": id
        })),
    ))
}

/// GET /api/hotel/groups
/// Lister mes groupes de propriétés
pub async fn list_my_groups(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    info!("[list_my_groups] user_id={}", user_id);

    let rows = sqlx::query(
        r#"
        SELECT
            g.id, g.group_name, g.description, g.logo_url, g.company_name,
            g.tax_id, g.address, g.phone, g.email, g.is_active,
            g.created_at, g.updated_at,
            COUNT(gm.id) AS nb_properties
        FROM hotel_property_groups g
        LEFT JOIN hotel_property_group_members gm ON gm.group_id = g.id
        WHERE g.partner_id = $1 AND g.is_active = TRUE
        GROUP BY g.id
        ORDER BY g.created_at DESC
        "#,
    )
    .bind(user_id)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| {
        log::error!("[list_my_groups] Erreur: {}", e);
        AppError::Internal("Erreur chargement groupes".to_string())
    })?;

    let groups: Vec<serde_json::Value> = rows
        .iter()
        .map(|r| {
            json!({
                "id": r.try_get::<i32, _>("id").unwrap_or(0),
                "group_name": r.try_get::<String, _>("group_name").unwrap_or_default(),
                "description": r.try_get::<Option<String>, _>("description").ok().flatten(),
                "logo_url": r.try_get::<Option<String>, _>("logo_url").ok().flatten(),
                "company_name": r.try_get::<Option<String>, _>("company_name").ok().flatten(),
                "tax_id": r.try_get::<Option<String>, _>("tax_id").ok().flatten(),
                "address": r.try_get::<Option<String>, _>("address").ok().flatten(),
                "phone": r.try_get::<Option<String>, _>("phone").ok().flatten(),
                "email": r.try_get::<Option<String>, _>("email").ok().flatten(),
                "is_active": r.try_get::<bool, _>("is_active").unwrap_or(true),
                "nb_properties": r.try_get::<i64, _>("nb_properties").unwrap_or(0),
                "created_at": r.try_get::<chrono::DateTime<chrono::Utc>, _>("created_at").ok().map(|d| d.to_rfc3339()),
            })
        })
        .collect();

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": groups,
            "total": groups.len()
        })),
    ))
}

/// GET /api/hotel/groups/{group_id}
/// Détail d'un groupe avec ses propriétés membres
pub async fn get_group_details(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(group_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[get_group_details] group_id={}, user_id={}",
        group_id, user_id
    );

    let group_row = sqlx::query(
        r#"
        SELECT id, group_name, description, logo_url, company_name, tax_id,
               address, phone, email, is_active, created_at, updated_at
        FROM hotel_property_groups
        WHERE id = $1 AND partner_id = $2
        "#,
    )
    .bind(group_id)
    .bind(user_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| {
        log::error!("[get_group_details] Erreur groupe: {}", e);
        AppError::Internal("Erreur chargement groupe".to_string())
    })?;

    let group_row = match group_row {
        Some(r) => r,
        None => return Err(AppError::NotFound("Groupe non trouvé".to_string())),
    };

    // Charger les propriétés membres
    let member_rows = sqlx::query(
        r#"
        SELECT
            gm.id AS member_id,
            gm.property_id,
            gm.location_name,
            gm.location_address,
            gm.location_gps,
            gm.display_order,
            p.titre AS property_name,
            p.type_bien,
            p.statut,
            p.ville,
            p.quartier
        FROM hotel_property_group_members gm
        JOIN real_estate_properties p ON p.id = gm.property_id
        WHERE gm.group_id = $1
        ORDER BY gm.display_order ASC, gm.created_at ASC
        "#,
    )
    .bind(group_id)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| {
        log::error!("[get_group_details] Erreur membres: {}", e);
        AppError::Internal("Erreur chargement membres".to_string())
    })?;

    let members: Vec<serde_json::Value> = member_rows
        .iter()
        .map(|r| {
            json!({
                "member_id": r.try_get::<i32, _>("member_id").unwrap_or(0),
                "property_id": r.try_get::<i32, _>("property_id").unwrap_or(0),
                "property_name": r.try_get::<Option<String>, _>("property_name").ok().flatten(),
                "type_bien": r.try_get::<Option<String>, _>("type_bien").ok().flatten(),
                "statut": r.try_get::<Option<String>, _>("statut").ok().flatten(),
                "ville": r.try_get::<Option<String>, _>("ville").ok().flatten(),
                "quartier": r.try_get::<Option<String>, _>("quartier").ok().flatten(),
                "location_name": r.try_get::<Option<String>, _>("location_name").ok().flatten(),
                "location_address": r.try_get::<Option<String>, _>("location_address").ok().flatten(),
                "location_gps": r.try_get::<Option<String>, _>("location_gps").ok().flatten(),
                "display_order": r.try_get::<i32, _>("display_order").unwrap_or(0),
            })
        })
        .collect();

    let group_json = json!({
        "id": group_row.try_get::<i32, _>("id").unwrap_or(0),
        "group_name": group_row.try_get::<String, _>("group_name").unwrap_or_default(),
        "description": group_row.try_get::<Option<String>, _>("description").ok().flatten(),
        "logo_url": group_row.try_get::<Option<String>, _>("logo_url").ok().flatten(),
        "company_name": group_row.try_get::<Option<String>, _>("company_name").ok().flatten(),
        "tax_id": group_row.try_get::<Option<String>, _>("tax_id").ok().flatten(),
        "address": group_row.try_get::<Option<String>, _>("address").ok().flatten(),
        "phone": group_row.try_get::<Option<String>, _>("phone").ok().flatten(),
        "email": group_row.try_get::<Option<String>, _>("email").ok().flatten(),
        "is_active": group_row.try_get::<bool, _>("is_active").unwrap_or(true),
        "created_at": group_row.try_get::<chrono::DateTime<chrono::Utc>, _>("created_at").ok().map(|d| d.to_rfc3339()),
        "properties": members
    });

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": group_json
        })),
    ))
}

#[derive(Debug, Deserialize)]
pub struct UpdateGroupRequest {
    pub group_name: Option<String>,
    pub description: Option<String>,
    pub logo_url: Option<String>,
    pub company_name: Option<String>,
    pub tax_id: Option<String>,
    pub address: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
}

/// PUT /api/hotel/groups/{group_id}
/// Mettre à jour un groupe
pub async fn update_property_group(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(group_id): Path<i32>,
    Json(request): Json<UpdateGroupRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[update_property_group] group_id={}, user_id={}",
        group_id, user_id
    );

    let exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM hotel_property_groups WHERE id = $1 AND partner_id = $2)",
    )
    .bind(group_id)
    .bind(user_id)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| AppError::Internal(e.to_string()))?;

    if !exists {
        return Err(AppError::NotFound("Groupe non trouvé".to_string()));
    }

    sqlx::query(
        r#"
        UPDATE hotel_property_groups SET
            group_name   = COALESCE($1, group_name),
            description  = COALESCE($2, description),
            logo_url     = COALESCE($3, logo_url),
            company_name = COALESCE($4, company_name),
            tax_id       = COALESCE($5, tax_id),
            address      = COALESCE($6, address),
            phone        = COALESCE($7, phone),
            email        = COALESCE($8, email),
            updated_at   = NOW()
        WHERE id = $9 AND partner_id = $10
        "#,
    )
    .bind(&request.group_name)
    .bind(&request.description)
    .bind(&request.logo_url)
    .bind(&request.company_name)
    .bind(&request.tax_id)
    .bind(&request.address)
    .bind(&request.phone)
    .bind(&request.email)
    .bind(group_id)
    .bind(user_id)
    .execute(&state.pg)
    .await
    .map_err(|e| {
        log::error!("[update_property_group] Erreur: {}", e);
        AppError::Internal("Erreur mise à jour groupe".to_string())
    })?;

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "message": "Groupe mis à jour"
        })),
    ))
}

/// DELETE /api/hotel/groups/{group_id}
/// Désactiver (soft delete) un groupe
pub async fn delete_property_group(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(group_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[delete_property_group] group_id={}, user_id={}",
        group_id, user_id
    );

    let rows_affected = sqlx::query(
        "UPDATE hotel_property_groups SET is_active = FALSE, updated_at = NOW() WHERE id = $1 AND partner_id = $2",
    )
    .bind(group_id)
    .bind(user_id)
    .execute(&state.pg)
    .await
    .map_err(|e| AppError::Internal(e.to_string()))?
    .rows_affected();

    if rows_affected == 0 {
        return Err(AppError::NotFound("Groupe non trouvé".to_string()));
    }

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "message": "Groupe supprimé"
        })),
    ))
}

#[derive(Debug, Deserialize)]
pub struct AddGroupMemberRequest {
    pub property_id: i32,
    pub location_name: Option<String>,
    pub location_address: Option<String>,
    pub location_gps: Option<String>,
    pub display_order: Option<i32>,
}

/// POST /api/hotel/groups/{group_id}/members
/// Ajouter une propriété à un groupe
pub async fn add_property_to_group(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(group_id): Path<i32>,
    Json(request): Json<AddGroupMemberRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[add_property_to_group] group_id={}, property_id={}, user_id={}",
        group_id, request.property_id, user_id
    );

    // Vérifier que le groupe appartient à l'utilisateur
    let group_exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM hotel_property_groups WHERE id = $1 AND partner_id = $2 AND is_active = TRUE)",
    )
    .bind(group_id)
    .bind(user_id)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| AppError::Internal(e.to_string()))?;

    if !group_exists {
        return Err(AppError::NotFound("Groupe non trouvé".to_string()));
    }

    // Vérifier que la propriété appartient à l'utilisateur
    let property_exists: bool = sqlx::query_scalar(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM real_estate_properties p
            JOIN services s ON s.id = p.service_id
            WHERE p.id = $1 AND s.user_id = $2
        )
        "#,
    )
    .bind(request.property_id)
    .bind(user_id)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| AppError::Internal(e.to_string()))?;

    if !property_exists {
        return Err(AppError::Forbidden("Propriété non autorisée".to_string()));
    }

    let member_id: i32 = sqlx::query_scalar(
        r#"
        INSERT INTO hotel_property_group_members
            (group_id, property_id, location_name, location_address, location_gps, display_order)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (group_id, property_id) DO UPDATE SET
            location_name    = EXCLUDED.location_name,
            location_address = EXCLUDED.location_address,
            location_gps     = EXCLUDED.location_gps,
            display_order    = EXCLUDED.display_order
        RETURNING id
        "#,
    )
    .bind(group_id)
    .bind(request.property_id)
    .bind(&request.location_name)
    .bind(&request.location_address)
    .bind(&request.location_gps)
    .bind(request.display_order.unwrap_or(0))
    .fetch_one(&state.pg)
    .await
    .map_err(|e| {
        log::error!("[add_property_to_group] Erreur: {}", e);
        AppError::Internal("Erreur ajout propriété au groupe".to_string())
    })?;

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "success": true,
            "message": "Propriété ajoutée au groupe",
            "member_id": member_id
        })),
    ))
}

/// DELETE /api/hotel/groups/{group_id}/members/{property_id}
/// Retirer une propriété d'un groupe
pub async fn remove_property_from_group(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path((group_id, property_id)): Path<(i32, i32)>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[remove_property_from_group] group_id={}, property_id={}, user_id={}",
        group_id, property_id, user_id
    );

    // Vérifier ownership du groupe
    let group_exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM hotel_property_groups WHERE id = $1 AND partner_id = $2)",
    )
    .bind(group_id)
    .bind(user_id)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| AppError::Internal(e.to_string()))?;

    if !group_exists {
        return Err(AppError::NotFound("Groupe non trouvé".to_string()));
    }

    let rows_affected = sqlx::query(
        "DELETE FROM hotel_property_group_members WHERE group_id = $1 AND property_id = $2",
    )
    .bind(group_id)
    .bind(property_id)
    .execute(&state.pg)
    .await
    .map_err(|e| AppError::Internal(e.to_string()))?
    .rows_affected();

    if rows_affected == 0 {
        return Err(AppError::NotFound(
            "Propriété non trouvée dans ce groupe".to_string(),
        ));
    }

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "message": "Propriété retirée du groupe"
        })),
    ))
}

/// GET /api/hotel/groups/{group_id}/financial
/// Vue financière consolidée d'un groupe (toutes propriétés)
pub async fn get_group_financial_overview(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(group_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[get_group_financial_overview] group_id={}, user_id={}",
        group_id, user_id
    );

    let group_exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM hotel_property_groups WHERE id = $1 AND partner_id = $2 AND is_active = TRUE)",
    )
    .bind(group_id)
    .bind(user_id)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| AppError::Internal(e.to_string()))?;

    if !group_exists {
        return Err(AppError::NotFound("Groupe non trouvé".to_string()));
    }

    // Agréger les données financières de toutes les propriétés du groupe
    let financial_row = sqlx::query(
        r#"
        SELECT
            COUNT(DISTINCT r.id)                                               AS total_reservations,
            COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'confirmed')        AS reservations_confirmees,
            COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'completed')        AS reservations_terminees,
            COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'cancelled')        AS reservations_annulees,
            COALESCE(SUM(r.montant_total) FILTER (WHERE r.payment_status IN ('advance_paid','fully_paid')), 0) AS revenus_total,
            COALESCE(SUM(r.montant_avance) FILTER (WHERE r.payment_status = 'advance_paid'), 0)               AS avances_recues,
            COALESCE(SUM(r.penalty_amount) FILTER (WHERE r.status = 'cancelled'), 0)                          AS penalites_total,
            COUNT(DISTINCT gm.property_id)                                    AS nb_properties
        FROM hotel_property_group_members gm
        LEFT JOIN hotel_meuble_reservations r ON r.property_id = gm.property_id
        WHERE gm.group_id = $1
        "#,
    )
    .bind(group_id)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| {
        log::error!("[get_group_financial_overview] Erreur: {}", e);
        AppError::Internal("Erreur calcul financier groupe".to_string())
    })?;

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": {
                "total_reservations": financial_row.try_get::<i64, _>("total_reservations").unwrap_or(0),
                "reservations_confirmees": financial_row.try_get::<i64, _>("reservations_confirmees").unwrap_or(0),
                "reservations_terminees": financial_row.try_get::<i64, _>("reservations_terminees").unwrap_or(0),
                "reservations_annulees": financial_row.try_get::<i64, _>("reservations_annulees").unwrap_or(0),
                "revenus_total": financial_row.try_get::<rust_decimal::Decimal, _>("revenus_total").ok(),
                "avances_recues": financial_row.try_get::<rust_decimal::Decimal, _>("avances_recues").ok(),
                "penalites_total": financial_row.try_get::<rust_decimal::Decimal, _>("penalites_total").ok(),
                "nb_properties": financial_row.try_get::<i64, _>("nb_properties").unwrap_or(0),
            }
        })),
    ))
}

// ============================================================================
// FORMULAIRES CLIENT PERSONNALISÉS
// ============================================================================

/// GET /api/hotel/properties/{property_id}/form-config
/// Récupérer la configuration du formulaire client d'une propriété
pub async fn get_form_config(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(property_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[get_form_config] property_id={}, user_id={}",
        property_id, user_id
    );

    // Vérifier les permissions
    use crate::services::hotel_room_management_service::HotelRoomManagementService;
    HotelRoomManagementService::ensure_user_can_manage_property(&state.pg, user_id, property_id)
        .await?;

    let row = sqlx::query(
        r#"
        SELECT id, property_id, group_id, form_fields, required_fields, default_values,
               logo_url, header_text, footer_text, company_info, is_active, created_at, updated_at
        FROM hotel_client_form_configs
        WHERE property_id = $1 AND is_active = TRUE
        ORDER BY updated_at DESC
        LIMIT 1
        "#,
    )
    .bind(property_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| {
        log::error!("[get_form_config] Erreur: {}", e);
        AppError::Internal("Erreur chargement configuration formulaire".to_string())
    })?;

    let config = row.map(|r| json!({
        "id": r.try_get::<i32, _>("id").unwrap_or(0),
        "property_id": r.try_get::<Option<i32>, _>("property_id").ok().flatten(),
        "group_id": r.try_get::<Option<i32>, _>("group_id").ok().flatten(),
        "form_fields": r.try_get::<serde_json::Value, _>("form_fields").unwrap_or(json!([])),
        "required_fields": r.try_get::<Option<Vec<String>>, _>("required_fields").ok().flatten(),
        "default_values": r.try_get::<serde_json::Value, _>("default_values").unwrap_or(json!({})),
        "logo_url": r.try_get::<Option<String>, _>("logo_url").ok().flatten(),
        "header_text": r.try_get::<Option<String>, _>("header_text").ok().flatten(),
        "footer_text": r.try_get::<Option<String>, _>("footer_text").ok().flatten(),
        "company_info": r.try_get::<serde_json::Value, _>("company_info").unwrap_or(json!({})),
        "is_active": r.try_get::<bool, _>("is_active").unwrap_or(true),
        "updated_at": r.try_get::<chrono::DateTime<chrono::Utc>, _>("updated_at").ok().map(|d| d.to_rfc3339()),
    }));

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": config
        })),
    ))
}

/// PUT /api/hotel/properties/{property_id}/form-config
/// Créer ou mettre à jour la configuration du formulaire client
pub async fn upsert_form_config(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(property_id): Path<i32>,
    Json(request): Json<UpdateFormConfigRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[upsert_form_config] property_id={}, user_id={}",
        property_id, user_id
    );

    use crate::services::hotel_room_management_service::HotelRoomManagementService;
    HotelRoomManagementService::ensure_user_can_manage_property(&state.pg, user_id, property_id)
        .await?;

    // Récupérer les valeurs actuelles si elles existent
    let existing_id: Option<i32> = sqlx::query_scalar(
        "SELECT id FROM hotel_client_form_configs WHERE property_id = $1 AND is_active = TRUE LIMIT 1",
    )
    .bind(property_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| AppError::Internal(e.to_string()))?;

    let form_fields_val = request.form_fields.unwrap_or(json!([]));
    let default_values_val = request.default_values.unwrap_or(json!({}));
    let company_info_val = request.company_info.unwrap_or(json!({}));

    if let Some(existing_id) = existing_id {
        sqlx::query(
            r#"
            UPDATE hotel_client_form_configs SET
                form_fields     = $1,
                required_fields = $2,
                default_values  = $3,
                logo_url        = $4,
                header_text     = $5,
                footer_text     = $6,
                company_info    = $7,
                updated_at      = NOW()
            WHERE id = $8
            "#,
        )
        .bind(&form_fields_val)
        .bind(&request.required_fields)
        .bind(&default_values_val)
        .bind(&request.logo_url)
        .bind(&request.header_text)
        .bind(&request.footer_text)
        .bind(&company_info_val)
        .bind(existing_id)
        .execute(&state.pg)
        .await
        .map_err(|e| {
            log::error!("[upsert_form_config] Erreur update: {}", e);
            AppError::Internal("Erreur mise à jour formulaire".to_string())
        })?;
    } else {
        sqlx::query(
            r#"
            INSERT INTO hotel_client_form_configs
                (property_id, form_fields, required_fields, default_values,
                 logo_url, header_text, footer_text, company_info, is_active)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)
            "#,
        )
        .bind(property_id)
        .bind(&form_fields_val)
        .bind(&request.required_fields)
        .bind(&default_values_val)
        .bind(&request.logo_url)
        .bind(&request.header_text)
        .bind(&request.footer_text)
        .bind(&company_info_val)
        .execute(&state.pg)
        .await
        .map_err(|e| {
            log::error!("[upsert_form_config] Erreur insert: {}", e);
            AppError::Internal("Erreur création formulaire".to_string())
        })?;
    }

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "message": "Configuration du formulaire sauvegardée"
        })),
    ))
}

// ============================================================================
// PROFILS CLIENTS (pré-remplissage)
// ============================================================================

/// GET /api/hotel/client-profile
/// Récupérer le profil client sauvegardé (pour pré-remplissage formulaire)
pub async fn get_client_profile(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    info!("[get_client_profile] user_id={}", user_id);

    let row = sqlx::query(
        r#"
        SELECT id, user_id, nom_complet, prenom, nom_famille, date_naissance,
               lieu_naissance, nationalite, type_piece_identite, numero_piece_identite,
               date_expiration_piece, telephone, email, adresse, ville, pays,
               preferences, created_at, updated_at
        FROM hotel_client_profiles
        WHERE user_id = $1
        LIMIT 1
        "#,
    )
    .bind(user_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| {
        log::error!("[get_client_profile] Erreur: {}", e);
        AppError::Internal("Erreur chargement profil".to_string())
    })?;

    let profile = row.map(|r| json!({
        "id": r.try_get::<i32, _>("id").unwrap_or(0),
        "nom_complet": r.try_get::<Option<String>, _>("nom_complet").ok().flatten(),
        "prenom": r.try_get::<Option<String>, _>("prenom").ok().flatten(),
        "nom_famille": r.try_get::<Option<String>, _>("nom_famille").ok().flatten(),
        "date_naissance": r.try_get::<Option<chrono::NaiveDate>, _>("date_naissance").ok().flatten().map(|d| d.to_string()),
        "lieu_naissance": r.try_get::<Option<String>, _>("lieu_naissance").ok().flatten(),
        "nationalite": r.try_get::<Option<String>, _>("nationalite").ok().flatten(),
        "type_piece_identite": r.try_get::<Option<String>, _>("type_piece_identite").ok().flatten(),
        "numero_piece_identite": r.try_get::<Option<String>, _>("numero_piece_identite").ok().flatten(),
        "date_expiration_piece": r.try_get::<Option<chrono::NaiveDate>, _>("date_expiration_piece").ok().flatten().map(|d| d.to_string()),
        "telephone": r.try_get::<Option<String>, _>("telephone").ok().flatten(),
        "email": r.try_get::<Option<String>, _>("email").ok().flatten(),
        "adresse": r.try_get::<Option<String>, _>("adresse").ok().flatten(),
        "ville": r.try_get::<Option<String>, _>("ville").ok().flatten(),
        "pays": r.try_get::<Option<String>, _>("pays").ok().flatten(),
        "preferences": r.try_get::<serde_json::Value, _>("preferences").unwrap_or(json!({})),
        "updated_at": r.try_get::<chrono::DateTime<chrono::Utc>, _>("updated_at").ok().map(|d| d.to_rfc3339()),
    }));

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": profile
        })),
    ))
}

/// PUT /api/hotel/client-profile
/// Sauvegarder ou mettre à jour le profil client (pour pré-remplissage)
pub async fn save_client_profile(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(request): Json<SaveClientProfileRequest>,
) -> AppResult<impl IntoResponse> {
    info!("[save_client_profile] user_id={}", user_id);

    let preferences_val = request.preferences.unwrap_or(json!({}));

    sqlx::query(
        r#"
        INSERT INTO hotel_client_profiles
            (user_id, nom_complet, prenom, nom_famille, date_naissance,
             lieu_naissance, nationalite, type_piece_identite, numero_piece_identite,
             date_expiration_piece, telephone, email, adresse, ville, pays, preferences)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        ON CONFLICT (user_id) DO UPDATE SET
            nom_complet              = COALESCE(EXCLUDED.nom_complet, hotel_client_profiles.nom_complet),
            prenom                   = COALESCE(EXCLUDED.prenom, hotel_client_profiles.prenom),
            nom_famille              = COALESCE(EXCLUDED.nom_famille, hotel_client_profiles.nom_famille),
            date_naissance           = COALESCE(EXCLUDED.date_naissance, hotel_client_profiles.date_naissance),
            lieu_naissance           = COALESCE(EXCLUDED.lieu_naissance, hotel_client_profiles.lieu_naissance),
            nationalite              = COALESCE(EXCLUDED.nationalite, hotel_client_profiles.nationalite),
            type_piece_identite      = COALESCE(EXCLUDED.type_piece_identite, hotel_client_profiles.type_piece_identite),
            numero_piece_identite    = COALESCE(EXCLUDED.numero_piece_identite, hotel_client_profiles.numero_piece_identite),
            date_expiration_piece    = COALESCE(EXCLUDED.date_expiration_piece, hotel_client_profiles.date_expiration_piece),
            telephone                = COALESCE(EXCLUDED.telephone, hotel_client_profiles.telephone),
            email                    = COALESCE(EXCLUDED.email, hotel_client_profiles.email),
            adresse                  = COALESCE(EXCLUDED.adresse, hotel_client_profiles.adresse),
            ville                    = COALESCE(EXCLUDED.ville, hotel_client_profiles.ville),
            pays                     = COALESCE(EXCLUDED.pays, hotel_client_profiles.pays),
            preferences              = $16,
            updated_at               = NOW()
        "#,
    )
    .bind(user_id)
    .bind(&request.nom_complet)
    .bind(&request.prenom)
    .bind(&request.nom_famille)
    .bind(request.date_naissance)
    .bind(&request.lieu_naissance)
    .bind(&request.nationalite)
    .bind(&request.type_piece_identite)
    .bind(&request.numero_piece_identite)
    .bind(request.date_expiration_piece)
    .bind(&request.telephone)
    .bind(&request.email)
    .bind(&request.adresse)
    .bind(&request.ville)
    .bind(&request.pays)
    .bind(&preferences_val)
    .execute(&state.pg)
    .await
    .map_err(|e| {
        log::error!("[save_client_profile] Erreur: {}", e);
        AppError::Internal("Erreur sauvegarde profil".to_string())
    })?;

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "message": "Profil sauvegardé"
        })),
    ))
}
