//! API dédiée restaurant (plan de salle, tables, menu, horaires, commandes, codes partenaires,
//! paiement wallet, commission Yukpo, livraison intelligente).
//! Le menu hebdomadaire IA familial reste sur `/api/menus/*`.

use crate::core::types::{AppError, AppResult};
use crate::middlewares::jwt::AuthenticatedUser;
use crate::services::push_notification_service;
use crate::state::AppState;
use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use chrono::Utc;
use log::info;
use rand::{distributions::Alphanumeric, Rng};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::Row;
use std::sync::Arc;
use uuid::Uuid;

async fn restaurant_service_id_for_user(pool: &sqlx::PgPool, user_id: i32) -> AppResult<i32> {
    let id: Option<i32> = sqlx::query_scalar(
        r#"
        SELECT id FROM services
        WHERE user_id = $1 AND specialized_type = 'restaurant'
        ORDER BY created_at DESC
        LIMIT 1
        "#,
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await?;

    id.ok_or_else(|| AppError::NotFound("Aucun service restaurant pour ce compte".to_string()))
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct RestaurantTableRow {
    pub id: i32,
    pub service_id: i32,
    pub label: String,
    pub capacity: i32,
    pub position_x: f64,
    pub position_y: f64,
    pub zone: Option<String>,
    pub sort_order: i32,
    pub is_active: bool,
}

#[derive(Debug, Deserialize)]
pub struct CreateTableBody {
    pub label: String,
    pub capacity: Option<i32>,
    pub position_x: Option<f64>,
    pub position_y: Option<f64>,
    pub zone: Option<String>,
    pub sort_order: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateTableBody {
    pub label: Option<String>,
    pub capacity: Option<i32>,
    pub position_x: Option<f64>,
    pub position_y: Option<f64>,
    /// Absent = pas de changement ; `null` JSON = effacer la zone
    pub zone: Option<serde_json::Value>,
    pub sort_order: Option<i32>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct FloorPlanBody {
    pub name: Option<String>,
    pub layout: serde_json::Value,
}

/// GET /api/restaurant/overview
pub async fn get_overview(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    let service_id = restaurant_service_id_for_user(&state.pg, user.id).await?;
    let tables_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM restaurant_tables WHERE service_id = $1 AND is_active = TRUE",
    )
    .bind(service_id)
    .fetch_one(&state.pg)
    .await
    .unwrap_or(0);

    let pending_res: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM specialized_reservations
           WHERE prestataire_id = $1 AND service_type = 'restaurant' AND status = 'pending'"#,
    )
    .bind(user.id)
    .fetch_one(&state.pg)
    .await
    .unwrap_or(0);

    #[derive(sqlx::FromRow)]
    struct RSettings {
        accepts_delivery: bool,
        accepts_dine_in: bool,
        default_prep_minutes: Option<i32>,
    }

    let settings: Option<RSettings> = sqlx::query_as(
        "SELECT accepts_delivery, accepts_dine_in, default_prep_minutes FROM restaurant_settings WHERE service_id = $1",
    )
    .bind(service_id)
    .fetch_optional(&state.pg)
    .await?;

    let (accepts_delivery, accepts_dine_in, default_prep) = if let Some(s) = settings {
        (
            s.accepts_delivery,
            s.accepts_dine_in,
            s.default_prep_minutes,
        )
    } else {
        (true, true, None)
    };

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "service_id": service_id,
            "tables_count": tables_count,
            "reservations_pending": pending_res,
            "accepts_delivery": accepts_delivery,
            "accepts_dine_in": accepts_dine_in,
            "default_prep_minutes": default_prep,
        })),
    ))
}

/// GET /api/restaurant/tables
pub async fn list_tables(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    let service_id = restaurant_service_id_for_user(&state.pg, user.id).await?;
    let rows: Vec<RestaurantTableRow> = sqlx::query_as(
        r#"SELECT id, service_id, label, capacity, position_x, position_y, zone, sort_order, is_active
           FROM restaurant_tables WHERE service_id = $1 ORDER BY sort_order, id"#,
    )
    .bind(service_id)
    .fetch_all(&state.pg)
    .await?;

    Ok((
        StatusCode::OK,
        Json(json!({ "success": true, "tables": rows })),
    ))
}

/// POST /api/restaurant/tables
pub async fn create_table(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(body): Json<CreateTableBody>,
) -> AppResult<impl IntoResponse> {
    let service_id = restaurant_service_id_for_user(&state.pg, user.id).await?;
    let label = body.label.trim();
    if label.is_empty() {
        return Err(AppError::BadRequest("label requis".to_string()));
    }
    let capacity = body.capacity.unwrap_or(4).max(1);
    let row: RestaurantTableRow = sqlx::query_as(
        r#"
        INSERT INTO restaurant_tables (service_id, label, capacity, position_x, position_y, zone, sort_order)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, service_id, label, capacity, position_x, position_y, zone, sort_order, is_active
        "#,
    )
    .bind(service_id)
    .bind(label)
    .bind(capacity)
    .bind(body.position_x.unwrap_or(0.0))
    .bind(body.position_y.unwrap_or(0.0))
    .bind(body.zone.as_deref())
    .bind(body.sort_order.unwrap_or(0))
    .fetch_one(&state.pg)
    .await
    .map_err(|e| {
        if let sqlx::Error::Database(dbe) = &e {
            if dbe.code().as_deref() == Some("23505") {
                return AppError::Conflict("Une table avec ce label existe déjà".to_string());
            }
        }
        AppError::Database(e.to_string())
    })?;

    Ok((
        StatusCode::CREATED,
        Json(json!({ "success": true, "table": row })),
    ))
}

/// PATCH /api/restaurant/tables/:id
pub async fn update_table(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(table_id): Path<i32>,
    Json(body): Json<UpdateTableBody>,
) -> AppResult<impl IntoResponse> {
    let service_id = restaurant_service_id_for_user(&state.pg, user.id).await?;

    let owner: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM restaurant_tables WHERE id = $1 AND service_id = $2)",
    )
    .bind(table_id)
    .bind(service_id)
    .fetch_one(&state.pg)
    .await
    .unwrap_or(false);
    if !owner {
        return Err(AppError::NotFound("Table introuvable".to_string()));
    }

    let mut current: RestaurantTableRow = sqlx::query_as(
        r#"SELECT id, service_id, label, capacity, position_x, position_y, zone, sort_order, is_active
           FROM restaurant_tables WHERE id = $1 AND service_id = $2"#,
    )
    .bind(table_id)
    .bind(service_id)
    .fetch_optional(&state.pg)
    .await?
    .ok_or_else(|| AppError::NotFound("Table introuvable".to_string()))?;

    if let Some(ref l) = body.label {
        let t = l.trim();
        if !t.is_empty() {
            current.label = t.to_string();
        }
    }
    if let Some(c) = body.capacity {
        current.capacity = c.max(1);
    }
    if let Some(x) = body.position_x {
        current.position_x = x;
    }
    if let Some(y) = body.position_y {
        current.position_y = y;
    }
    if let Some(z) = body.zone {
        current.zone = match z {
            serde_json::Value::Null => None,
            serde_json::Value::String(s) => Some(s),
            _ => Some(z.to_string()),
        };
    }
    if let Some(s) = body.sort_order {
        current.sort_order = s;
    }
    if let Some(a) = body.is_active {
        current.is_active = a;
    }

    sqlx::query(
        r#"
        UPDATE restaurant_tables SET
            label = $1,
            capacity = $2,
            position_x = $3,
            position_y = $4,
            zone = $5,
            sort_order = $6,
            is_active = $7,
            updated_at = NOW()
        WHERE id = $8 AND service_id = $9
        "#,
    )
    .bind(&current.label)
    .bind(current.capacity)
    .bind(current.position_x)
    .bind(current.position_y)
    .bind(&current.zone)
    .bind(current.sort_order)
    .bind(current.is_active)
    .bind(table_id)
    .bind(service_id)
    .execute(&state.pg)
    .await?;

    let row: Option<RestaurantTableRow> = sqlx::query_as(
        r#"SELECT id, service_id, label, capacity, position_x, position_y, zone, sort_order, is_active
           FROM restaurant_tables WHERE id = $1"#,
    )
    .bind(table_id)
    .fetch_optional(&state.pg)
    .await?;

    let row = row.ok_or_else(|| AppError::NotFound("Table introuvable".to_string()))?;
    Ok((
        StatusCode::OK,
        Json(json!({ "success": true, "table": row })),
    ))
}

/// DELETE /api/restaurant/tables/:id (soft)
pub async fn delete_table(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(table_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    let service_id = restaurant_service_id_for_user(&state.pg, user.id).await?;
    let r = sqlx::query(
        "UPDATE restaurant_tables SET is_active = FALSE, updated_at = NOW() WHERE id = $1 AND service_id = $2",
    )
    .bind(table_id)
    .bind(service_id)
    .execute(&state.pg)
    .await?;
    if r.rows_affected() == 0 {
        return Err(AppError::NotFound("Table introuvable".to_string()));
    }
    Ok((StatusCode::OK, Json(json!({ "success": true }))))
}

/// GET /api/restaurant/floor-plan
pub async fn get_floor_plan(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    let service_id = restaurant_service_id_for_user(&state.pg, user.id).await?;
    let layout: Option<(serde_json::Value, String)> = sqlx::query(
        r#"SELECT layout_json, name FROM restaurant_floor_layouts WHERE service_id = $1 AND name = 'default'"#,
    )
    .bind(service_id)
    .map(|row: sqlx::postgres::PgRow| {
        (row.get::<serde_json::Value, _>("layout_json"), row.get::<String, _>("name"))
    })
    .fetch_optional(&state.pg)
    .await?;

    let (layout_json, name) = layout.unwrap_or_else(|| (json!({}), "default".to_string()));

    let tables: Vec<RestaurantTableRow> = sqlx::query_as(
        r#"SELECT id, service_id, label, capacity, position_x, position_y, zone, sort_order, is_active
           FROM restaurant_tables WHERE service_id = $1 AND is_active = TRUE ORDER BY sort_order, id"#,
    )
    .bind(service_id)
    .fetch_all(&state.pg)
    .await?;

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "service_id": service_id,
            "name": name,
            "layout": layout_json,
            "tables": tables,
        })),
    ))
}

/// PUT /api/restaurant/floor-plan
pub async fn put_floor_plan(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(body): Json<FloorPlanBody>,
) -> AppResult<impl IntoResponse> {
    let service_id = restaurant_service_id_for_user(&state.pg, user.id).await?;
    let name = body.name.as_deref().unwrap_or("default");
    sqlx::query(
        r#"
        INSERT INTO restaurant_floor_layouts (service_id, name, layout_json, updated_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (service_id, name) DO UPDATE SET layout_json = EXCLUDED.layout_json, updated_at = NOW()
        "#,
    )
    .bind(service_id)
    .bind(name)
    .bind(&body.layout)
    .execute(&state.pg)
    .await?;

    Ok((StatusCode::OK, Json(json!({ "success": true }))))
}

#[derive(Debug, Deserialize)]
pub struct PatchSettingsBody {
    pub accepts_delivery: Option<bool>,
    pub accepts_dine_in: Option<bool>,
    pub default_prep_minutes: Option<i32>,
}

/// PATCH /api/restaurant/settings
pub async fn patch_settings(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(body): Json<PatchSettingsBody>,
) -> AppResult<impl IntoResponse> {
    let service_id = restaurant_service_id_for_user(&state.pg, user.id).await?;
    sqlx::query(
        r#"
        INSERT INTO restaurant_settings (service_id, accepts_delivery, accepts_dine_in, default_prep_minutes, updated_at)
        VALUES ($1, COALESCE($2, TRUE), COALESCE($3, TRUE), $4, NOW())
        ON CONFLICT (service_id) DO UPDATE SET
            accepts_delivery = COALESCE($2, restaurant_settings.accepts_delivery),
            accepts_dine_in = COALESCE($3, restaurant_settings.accepts_dine_in),
            default_prep_minutes = COALESCE($4, restaurant_settings.default_prep_minutes),
            updated_at = NOW()
        "#,
    )
    .bind(service_id)
    .bind(body.accepts_delivery)
    .bind(body.accepts_dine_in)
    .bind(body.default_prep_minutes)
    .execute(&state.pg)
    .await?;

    Ok((StatusCode::OK, Json(json!({ "success": true }))))
}

#[derive(Debug, Deserialize)]
pub struct CreatePartnerCodeBody {
    pub label: Option<String>,
}

/// POST /api/restaurant/partner-code
pub async fn create_partner_code(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(body): Json<CreatePartnerCodeBody>,
) -> AppResult<impl IntoResponse> {
    let service_id = restaurant_service_id_for_user(&state.pg, user.id).await?;

    let code: String = rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(10)
        .map(char::from)
        .collect::<String>()
        .to_uppercase();

    sqlx::query(
        r#"
        INSERT INTO restaurant_partner_codes (code, issuer_service_id, label, is_active)
        VALUES ($1, $2, $3, TRUE)
        "#,
    )
    .bind(&code)
    .bind(service_id)
    .bind(body.label.as_deref())
    .execute(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Impossible de créer le code partenaire: {}", e)))?;

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "success": true,
            "code": code,
            "issuer_service_id": service_id,
        })),
    ))
}

#[derive(Debug, Deserialize)]
pub struct VerifyCodeParams {
    pub code: String,
}

/// GET /api/restaurant/partner-code/verify?code= — public
pub async fn verify_partner_code_public(
    State(state): State<Arc<AppState>>,
    Query(q): Query<VerifyCodeParams>,
) -> AppResult<impl IntoResponse> {
    let c = q.code.trim();
    if c.is_empty() {
        return Err(AppError::BadRequest("code requis".to_string()));
    }
    let row: Option<(i32, bool)> = sqlx::query(
        "SELECT issuer_service_id, is_active FROM restaurant_partner_codes WHERE UPPER(code) = UPPER($1)",
    )
    .bind(c)
    .map(|r: sqlx::postgres::PgRow| (r.get::<i32, _>("issuer_service_id"), r.get::<bool, _>("is_active")))
    .fetch_optional(&state.pg)
    .await?;

    let (issuer, active) = row.ok_or_else(|| AppError::NotFound("Code inconnu".to_string()))?;
    if !active {
        return Err(AppError::BadRequest("Code inactif".to_string()));
    }

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "valid": true,
            "issuer_service_id": issuer,
        })),
    ))
}

// ============================================================
// MENU ITEMS
// ============================================================

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct MenuItemRow {
    pub id: i32,
    pub service_id: i32,
    pub nom: String,
    pub description: Option<String>,
    pub prix: f64,
    pub categorie: String,
    pub is_disponible: bool,
    pub image_url: Option<String>,
    pub video_url: Option<String>,
    pub availability_days: serde_json::Value,
    pub sort_order: i32,
}

#[derive(Debug, Deserialize)]
pub struct CreateMenuItemBody {
    pub nom: String,
    pub description: Option<String>,
    pub prix: f64,
    pub categorie: Option<String>,
    pub is_disponible: Option<bool>,
    pub image_url: Option<String>,
    pub video_url: Option<String>,
    pub availability_days: Option<serde_json::Value>,
    pub sort_order: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateMenuItemBody {
    pub nom: Option<String>,
    pub description: Option<String>,
    pub prix: Option<f64>,
    pub categorie: Option<String>,
    pub is_disponible: Option<bool>,
    pub image_url: Option<String>,
    pub video_url: Option<String>,
    pub availability_days: Option<serde_json::Value>,
    pub sort_order: Option<i32>,
}

/// GET /api/restaurant/menu
pub async fn list_menu_items(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    let service_id = restaurant_service_id_for_user(&state.pg, user.id).await?;
    let rows: Vec<MenuItemRow> = sqlx::query_as(
        r#"SELECT id, service_id, nom, description, prix::float8, categorie, is_disponible,
                  image_url, video_url, availability_days, sort_order
           FROM restaurant_menu_items WHERE service_id = $1
           ORDER BY categorie, sort_order, id"#,
    )
    .bind(service_id)
    .fetch_all(&state.pg)
    .await?;

    Ok((
        StatusCode::OK,
        Json(json!({ "success": true, "items": rows })),
    ))
}

/// POST /api/restaurant/menu
pub async fn create_menu_item(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(body): Json<CreateMenuItemBody>,
) -> AppResult<impl IntoResponse> {
    let service_id = restaurant_service_id_for_user(&state.pg, user.id).await?;
    let nom = body.nom.trim();
    if nom.is_empty() {
        return Err(AppError::BadRequest("nom requis".to_string()));
    }
    let categorie = body.categorie.as_deref().unwrap_or("plat");
    let days = body.availability_days.unwrap_or_else(|| json!([0, 1, 2, 3, 4, 5, 6]));
    let row: MenuItemRow = sqlx::query_as(
        r#"INSERT INTO restaurant_menu_items
               (service_id, nom, description, prix, categorie, is_disponible, image_url, video_url, availability_days, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           RETURNING id, service_id, nom, description, prix::float8, categorie, is_disponible,
                     image_url, video_url, availability_days, sort_order"#,
    )
    .bind(service_id)
    .bind(nom)
    .bind(body.description.as_deref())
    .bind(body.prix)
    .bind(categorie)
    .bind(body.is_disponible.unwrap_or(true))
    .bind(body.image_url.as_deref())
    .bind(body.video_url.as_deref())
    .bind(&days)
    .bind(body.sort_order.unwrap_or(0))
    .fetch_one(&state.pg)
    .await?;

    Ok((
        StatusCode::CREATED,
        Json(json!({ "success": true, "item": row })),
    ))
}

/// PATCH /api/restaurant/menu/:id
pub async fn update_menu_item(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(item_id): Path<i32>,
    Json(body): Json<UpdateMenuItemBody>,
) -> AppResult<impl IntoResponse> {
    let service_id = restaurant_service_id_for_user(&state.pg, user.id).await?;
    let row: Option<MenuItemRow> = sqlx::query_as(
        r#"SELECT id, service_id, nom, description, prix::float8, categorie, is_disponible,
                  image_url, video_url, availability_days, sort_order
           FROM restaurant_menu_items WHERE id=$1 AND service_id=$2"#,
    )
    .bind(item_id)
    .bind(service_id)
    .fetch_optional(&state.pg)
    .await?;
    let mut cur = row.ok_or_else(|| AppError::NotFound("Plat introuvable".to_string()))?;

    if let Some(v) = body.nom {
        let t = v.trim().to_string();
        if !t.is_empty() {
            cur.nom = t;
        }
    }
    if let Some(v) = body.description {
        cur.description = Some(v);
    }
    if let Some(v) = body.prix {
        cur.prix = v;
    }
    if let Some(v) = body.categorie {
        cur.categorie = v;
    }
    if let Some(v) = body.is_disponible {
        cur.is_disponible = v;
    }
    if let Some(v) = body.image_url {
        cur.image_url = Some(v);
    }
    if let Some(v) = body.video_url {
        cur.video_url = Some(v);
    }
    if let Some(v) = body.availability_days {
        cur.availability_days = v;
    }
    if let Some(v) = body.sort_order {
        cur.sort_order = v;
    }

    let updated: MenuItemRow = sqlx::query_as(
        r#"UPDATE restaurant_menu_items SET
               nom=$1, description=$2, prix=$3, categorie=$4, is_disponible=$5,
               image_url=$6, video_url=$7, availability_days=$8, sort_order=$9, updated_at=NOW()
           WHERE id=$10 AND service_id=$11
           RETURNING id, service_id, nom, description, prix::float8, categorie, is_disponible,
                     image_url, video_url, availability_days, sort_order"#,
    )
    .bind(&cur.nom)
    .bind(&cur.description)
    .bind(cur.prix)
    .bind(&cur.categorie)
    .bind(cur.is_disponible)
    .bind(&cur.image_url)
    .bind(&cur.video_url)
    .bind(&cur.availability_days)
    .bind(cur.sort_order)
    .bind(item_id)
    .bind(service_id)
    .fetch_one(&state.pg)
    .await?;

    Ok((
        StatusCode::OK,
        Json(json!({ "success": true, "item": updated })),
    ))
}

/// DELETE /api/restaurant/menu/:id (soft — désactive le plat)
pub async fn delete_menu_item(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(item_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    let service_id = restaurant_service_id_for_user(&state.pg, user.id).await?;
    let r = sqlx::query(
        "UPDATE restaurant_menu_items SET is_disponible=FALSE, updated_at=NOW() WHERE id=$1 AND service_id=$2",
    )
    .bind(item_id)
    .bind(service_id)
    .execute(&state.pg)
    .await?;
    if r.rows_affected() == 0 {
        return Err(AppError::NotFound("Plat introuvable".to_string()));
    }
    Ok((StatusCode::OK, Json(json!({ "success": true }))))
}

// ============================================================
// OPENING HOURS
// ============================================================

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct OpeningHourRow {
    pub id: i32,
    pub service_id: i32,
    pub day_of_week: i32,
    pub open_time: Option<String>,
    pub close_time: Option<String>,
    pub is_closed: bool,
}

#[derive(Debug, Deserialize)]
pub struct HourEntry {
    pub day_of_week: i32,
    pub open_time: Option<String>,
    pub close_time: Option<String>,
    pub is_closed: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct PutOpeningHoursBody {
    pub hours: Vec<HourEntry>,
}

/// GET /api/restaurant/opening-hours
pub async fn get_opening_hours(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    let service_id = restaurant_service_id_for_user(&state.pg, user.id).await?;
    let rows = sqlx::query(
        r#"SELECT id, service_id, day_of_week,
                  open_time::text AS open_time, close_time::text AS close_time, is_closed
           FROM restaurant_opening_hours WHERE service_id=$1 ORDER BY day_of_week"#,
    )
    .bind(service_id)
    .map(|r: sqlx::postgres::PgRow| {
        json!({
            "id": r.get::<i32,_>("id"),
            "day_of_week": r.get::<i32,_>("day_of_week"),
            "open_time": r.get::<Option<String>,_>("open_time"),
            "close_time": r.get::<Option<String>,_>("close_time"),
            "is_closed": r.get::<bool,_>("is_closed"),
        })
    })
    .fetch_all(&state.pg)
    .await?;

    Ok((
        StatusCode::OK,
        Json(json!({ "success": true, "hours": rows })),
    ))
}

/// PUT /api/restaurant/opening-hours  (upsert complet)
pub async fn put_opening_hours(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(body): Json<PutOpeningHoursBody>,
) -> AppResult<impl IntoResponse> {
    let service_id = restaurant_service_id_for_user(&state.pg, user.id).await?;
    for h in &body.hours {
        if h.day_of_week < 0 || h.day_of_week > 6 {
            return Err(AppError::BadRequest(format!(
                "day_of_week invalide: {}",
                h.day_of_week
            )));
        }
        sqlx::query(
            r#"INSERT INTO restaurant_opening_hours (service_id, day_of_week, open_time, close_time, is_closed)
               VALUES ($1,$2,$3::time,$4::time,$5)
               ON CONFLICT (service_id, day_of_week) DO UPDATE SET
                   open_time=EXCLUDED.open_time, close_time=EXCLUDED.close_time, is_closed=EXCLUDED.is_closed"#,
        )
        .bind(service_id)
        .bind(h.day_of_week)
        .bind(h.open_time.as_deref())
        .bind(h.close_time.as_deref())
        .bind(h.is_closed.unwrap_or(false))
        .execute(&state.pg)
        .await?;
    }
    Ok((StatusCode::OK, Json(json!({ "success": true }))))
}

// ============================================================
// RESTAURANT ORDERS (commandes internes restaurant)
// ============================================================

#[derive(Debug, Deserialize)]
pub struct CreateRestaurantOrderBody {
    pub order_type: Option<String>,
    pub table_id: Option<i32>,
    pub notes: Option<String>,
    pub client_name: Option<String>,
    pub client_phone: Option<String>,
    pub delivery_address: Option<String>,
    pub items: Vec<OrderItemInput>,
}

#[derive(Debug, Deserialize)]
pub struct OrderItemInput {
    pub menu_item_id: Option<i32>,
    pub item_name: String,
    pub item_price: f64,
    pub quantity: Option<i32>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateOrderStatusBody {
    pub status: String,
    pub estimated_ready_at: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ListOrdersParams {
    pub status: Option<String>,
}

const ORDER_SELECT: &str = r#"
    SELECT o.id, o.order_type, o.status, o.total_amount::float8,
           o.client_name, o.client_phone, o.notes, o.table_id,
           o.estimated_ready_at::text AS estimated_ready_at,
           o.created_at::text AS created_at,
           o.yukpo_commission::float8, o.net_partner_amount::float8,
           o.payment_status, o.delivery_order_id,
           COALESCE(
               json_agg(json_build_object(
                   'id', oi.id,
                   'item_name', oi.item_name,
                   'item_price', oi.item_price::float8,
                   'quantity', oi.quantity,
                   'notes', oi.notes
               )) FILTER (WHERE oi.id IS NOT NULL),
               '[]'::json
           ) AS items
    FROM restaurant_orders o
    LEFT JOIN restaurant_order_items oi ON oi.order_id = o.id"#;

/// GET /api/restaurant/orders?status=
pub async fn list_orders(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Query(q): Query<ListOrdersParams>,
) -> AppResult<impl IntoResponse> {
    let service_id = restaurant_service_id_for_user(&state.pg, user.id).await?;
    let rows = if let Some(ref s) = q.status {
        sqlx::query(&format!(
            "{} WHERE o.service_id=$1 AND o.status=$2 GROUP BY o.id ORDER BY o.created_at DESC LIMIT 100",
            ORDER_SELECT
        ))
        .bind(service_id)
        .bind(s.as_str())
        .map(|r: sqlx::postgres::PgRow| map_order_row(&r))
        .fetch_all(&state.pg)
        .await?
    } else {
        sqlx::query(&format!(
            "{} WHERE o.service_id=$1 AND o.status NOT IN ('completed','cancelled') GROUP BY o.id ORDER BY o.created_at DESC LIMIT 100",
            ORDER_SELECT
        ))
        .bind(service_id)
        .map(|r: sqlx::postgres::PgRow| map_order_row(&r))
        .fetch_all(&state.pg)
        .await?
    };

    Ok((
        StatusCode::OK,
        Json(json!({ "success": true, "orders": rows })),
    ))
}

fn map_order_row(r: &sqlx::postgres::PgRow) -> serde_json::Value {
    json!({
        "id": r.get::<i32,_>("id"),
        "order_type": r.get::<String,_>("order_type"),
        "status": r.get::<String,_>("status"),
        "total_amount": r.get::<f64,_>("total_amount"),
        "client_name": r.get::<Option<String>,_>("client_name"),
        "client_phone": r.get::<Option<String>,_>("client_phone"),
        "notes": r.get::<Option<String>,_>("notes"),
        "table_id": r.get::<Option<i32>,_>("table_id"),
        "estimated_ready_at": r.get::<Option<String>,_>("estimated_ready_at"),
        "created_at": r.get::<Option<String>,_>("created_at"),
        "yukpo_commission": r.try_get::<Option<f64>,_>("yukpo_commission").ok().flatten(),
        "net_partner_amount": r.try_get::<Option<f64>,_>("net_partner_amount").ok().flatten(),
        "payment_status": r.try_get::<Option<String>,_>("payment_status").ok().flatten(),
        "delivery_order_id": r.try_get::<Option<i32>,_>("delivery_order_id").ok().flatten(),
        "items": r.get::<serde_json::Value,_>("items"),
    })
}

/// POST /api/restaurant/orders  (créer une commande, partenaire ou client authentifié)
pub async fn create_order(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(body): Json<CreateRestaurantOrderBody>,
) -> AppResult<impl IntoResponse> {
    // Trouver le service_id via table_id ou via owner
    let service_id_opt: Option<i32> = sqlx::query_scalar(
        "SELECT id FROM services WHERE user_id=$1 AND specialized_type='restaurant' ORDER BY created_at DESC LIMIT 1",
    )
    .bind(user.id)
    .fetch_optional(&state.pg)
    .await?;

    // Si le user est partenaire → son service; sinon service_id doit venir du table_id
    let service_id = if let Some(sid) = service_id_opt {
        sid
    } else if let Some(tid) = body.table_id {
        sqlx::query_scalar::<_, i32>("SELECT service_id FROM restaurant_tables WHERE id=$1")
            .bind(tid)
            .fetch_optional(&state.pg)
            .await?
            .ok_or_else(|| AppError::BadRequest("table_id invalide".to_string()))?
    } else {
        return Err(AppError::BadRequest(
            "service_id ou table_id requis pour client".to_string(),
        ));
    };

    let order_type = body.order_type.as_deref().unwrap_or("dine_in");
    let total: f64 = body.items.iter().map(|i| i.item_price * i.quantity.unwrap_or(1) as f64).sum();

    let order_id: i32 = sqlx::query_scalar(
        r#"INSERT INTO restaurant_orders
               (service_id, client_user_id, order_type, table_id, status, total_amount, notes, client_name, client_phone)
           VALUES ($1,$2,$3,$4,'pending',$5,$6,$7,$8)
           RETURNING id"#,
    )
    .bind(service_id)
    .bind(user.id)
    .bind(order_type)
    .bind(body.table_id)
    .bind(total)
    .bind(body.notes.as_deref())
    .bind(body.client_name.as_deref())
    .bind(body.client_phone.as_deref())
    .fetch_one(&state.pg)
    .await?;

    for item in &body.items {
        sqlx::query(
            r#"INSERT INTO restaurant_order_items (order_id, menu_item_id, item_name, item_price, quantity, notes)
               VALUES ($1,$2,$3,$4,$5,$6)"#,
        )
        .bind(order_id)
        .bind(item.menu_item_id)
        .bind(&item.item_name)
        .bind(item.item_price)
        .bind(item.quantity.unwrap_or(1))
        .bind(item.notes.as_deref())
        .execute(&state.pg)
        .await?;
    }

    Ok((
        StatusCode::CREATED,
        Json(json!({ "success": true, "order_id": order_id, "total": total })),
    ))
}

// (voir update_order_status_with_payout ci-dessous — exposé comme update_order_status dans les routes)

// ============================================================
// ENDPOINTS PUBLICS — côté client/utilisateur
// ============================================================

#[derive(Debug, Deserialize)]
pub struct PublicSearchParams {
    pub q: Option<String>,
    #[serde(rename = "type")]
    pub search_type: Option<String>, // "restaurant" | "menu"
    pub limit: Option<i64>,
}

/// GET /api/restaurant/public/search?q=...&type=restaurant|menu
/// Recherche unifiée : par nom de restaurant OU par plat dans tous les menus
pub async fn public_search(
    State(state): State<Arc<AppState>>,
    Query(params): Query<PublicSearchParams>,
) -> AppResult<impl IntoResponse> {
    let q = params.q.as_deref().unwrap_or("").trim().to_string();
    let limit = params.limit.unwrap_or(40).min(100);
    let search_type = params.search_type.as_deref().unwrap_or("restaurant");

    if q.is_empty() {
        return Ok((
            StatusCode::OK,
            Json(json!({ "success": true, "results": [], "type": search_type })),
        ));
    }

    let pattern = format!("%{}%", q.to_lowercase());

    if search_type == "menu" {
        // Recherche dans les plats de tous les restaurants actifs
        let rows = sqlx::query(
            r#"SELECT m.id, m.service_id, m.nom, m.description, m.prix::float8,
                      m.categorie, m.image_url, m.video_url,
                      s.name AS restaurant_name, s.city,
                      COALESCE(rs.accepts_delivery, TRUE) AS accepts_delivery,
                      COALESCE(rs.accepts_dine_in, TRUE) AS accepts_dine_in
               FROM restaurant_menu_items m
               JOIN services s ON s.id = m.service_id
               LEFT JOIN restaurant_settings rs ON rs.service_id = m.service_id
               WHERE m.is_disponible = TRUE
                 AND s.is_active = TRUE
                 AND s.specialized_type = 'restaurant'
                 AND (LOWER(m.nom) LIKE $1 OR LOWER(m.description) LIKE $1 OR LOWER(m.categorie) LIKE $1)
               ORDER BY m.nom
               LIMIT $2"#,
        )
        .bind(&pattern)
        .bind(limit)
        .map(|r: sqlx::postgres::PgRow| {
            json!({
                "id": r.get::<i32,_>("id"),
                "service_id": r.get::<i32,_>("service_id"),
                "nom": r.get::<String,_>("nom"),
                "description": r.get::<Option<String>,_>("description"),
                "prix": r.get::<f64,_>("prix"),
                "categorie": r.get::<Option<String>,_>("categorie"),
                "image_url": r.get::<Option<String>,_>("image_url"),
                "video_url": r.get::<Option<String>,_>("video_url"),
                "restaurant_name": r.get::<String,_>("restaurant_name"),
                "city": r.get::<Option<String>,_>("city"),
                "accepts_delivery": r.get::<bool,_>("accepts_delivery"),
                "accepts_dine_in": r.get::<bool,_>("accepts_dine_in"),
            })
        })
        .fetch_all(&state.pg)
        .await?;

        Ok((
            StatusCode::OK,
            Json(json!({ "success": true, "type": "menu", "results": rows })),
        ))
    } else {
        // Recherche par nom/ville/description de restaurant
        let rows = sqlx::query(
            r#"SELECT s.id AS service_id, s.name, s.description, s.address, s.city,
                      s.latitude::float8, s.longitude::float8,
                      COALESCE(rs.accepts_delivery, TRUE) AS accepts_delivery,
                      COALESCE(rs.accepts_dine_in, TRUE) AS accepts_dine_in,
                      rs.default_prep_minutes,
                      (SELECT COUNT(*) FROM restaurant_menu_items m WHERE m.service_id=s.id AND m.is_disponible=TRUE) AS menu_count
               FROM services s
               LEFT JOIN restaurant_settings rs ON rs.service_id = s.id
               WHERE s.specialized_type = 'restaurant' AND s.is_active = TRUE
                 AND (LOWER(s.name) LIKE $1 OR LOWER(s.city) LIKE $1 OR LOWER(s.description) LIKE $1 OR LOWER(s.address) LIKE $1)
               ORDER BY s.name
               LIMIT $2"#,
        )
        .bind(&pattern)
        .bind(limit)
        .map(|r: sqlx::postgres::PgRow| {
            json!({
                "service_id": r.get::<i32,_>("service_id"),
                "name": r.get::<String,_>("name"),
                "description": r.get::<Option<String>,_>("description"),
                "address": r.get::<Option<String>,_>("address"),
                "city": r.get::<Option<String>,_>("city"),
                "latitude": r.get::<Option<f64>,_>("latitude"),
                "longitude": r.get::<Option<f64>,_>("longitude"),
                "accepts_delivery": r.get::<bool,_>("accepts_delivery"),
                "accepts_dine_in": r.get::<bool,_>("accepts_dine_in"),
                "default_prep_minutes": r.get::<Option<i32>,_>("default_prep_minutes"),
                "menu_count": r.get::<i64,_>("menu_count"),
            })
        })
        .fetch_all(&state.pg)
        .await?;

        Ok((
            StatusCode::OK,
            Json(json!({ "success": true, "type": "restaurant", "results": rows })),
        ))
    }
}

#[derive(Debug, Deserialize)]
pub struct PublicListParams {
    pub lat: Option<f64>,
    pub lon: Option<f64>,
    pub limit: Option<i64>,
}

/// GET /api/restaurant/public/list  — liste publique des restaurants
pub async fn public_list_restaurants(
    State(state): State<Arc<AppState>>,
    Query(q): Query<PublicListParams>,
) -> AppResult<impl IntoResponse> {
    let limit = q.limit.unwrap_or(30).min(100);
    let rows = sqlx::query(
        r#"SELECT s.id AS service_id, s.name, s.description, s.address, s.city,
                  s.latitude::float8, s.longitude::float8,
                  rs.accepts_delivery, rs.accepts_dine_in, rs.default_prep_minutes,
                  (SELECT COUNT(*) FROM restaurant_menu_items m WHERE m.service_id=s.id AND m.is_disponible=TRUE) AS menu_count
           FROM services s
           LEFT JOIN restaurant_settings rs ON rs.service_id = s.id
           WHERE s.specialized_type='restaurant' AND s.is_active=TRUE
           ORDER BY s.created_at DESC
           LIMIT $1"#,
    )
    .bind(limit)
    .map(|r: sqlx::postgres::PgRow| {
        json!({
            "service_id": r.get::<i32,_>("service_id"),
            "name": r.get::<String,_>("name"),
            "description": r.get::<Option<String>,_>("description"),
            "address": r.get::<Option<String>,_>("address"),
            "city": r.get::<Option<String>,_>("city"),
            "latitude": r.get::<Option<f64>,_>("latitude"),
            "longitude": r.get::<Option<f64>,_>("longitude"),
            "accepts_delivery": r.get::<Option<bool>,_>("accepts_delivery").unwrap_or(true),
            "accepts_dine_in": r.get::<Option<bool>,_>("accepts_dine_in").unwrap_or(true),
            "default_prep_minutes": r.get::<Option<i32>,_>("default_prep_minutes"),
            "menu_count": r.get::<i64,_>("menu_count"),
        })
    })
    .fetch_all(&state.pg)
    .await?;

    Ok((
        StatusCode::OK,
        Json(json!({ "success": true, "restaurants": rows })),
    ))
}

#[derive(Debug, Deserialize)]
pub struct PublicMenuParams {
    pub service_id: i32,
}

/// GET /api/restaurant/public/:service_id/menu  — menu public d'un restaurant
pub async fn public_get_menu(
    State(state): State<Arc<AppState>>,
    Path(service_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    // Vérifier que le service est actif
    let exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM services WHERE id=$1 AND specialized_type='restaurant' AND is_active=TRUE)",
    )
    .bind(service_id)
    .fetch_one(&state.pg)
    .await
    .unwrap_or(false);

    if !exists {
        return Err(AppError::NotFound("Restaurant introuvable".to_string()));
    }

    let items: Vec<MenuItemRow> = sqlx::query_as(
        r#"SELECT id, service_id, nom, description, prix::float8, categorie, is_disponible,
                  image_url, video_url, availability_days, sort_order
           FROM restaurant_menu_items
           WHERE service_id=$1 AND is_disponible=TRUE
           ORDER BY categorie, sort_order, id"#,
    )
    .bind(service_id)
    .fetch_all(&state.pg)
    .await?;

    let hours = sqlx::query(
        r#"SELECT day_of_week, open_time::text, close_time::text, is_closed
           FROM restaurant_opening_hours WHERE service_id=$1 ORDER BY day_of_week"#,
    )
    .bind(service_id)
    .map(|r: sqlx::postgres::PgRow| {
        json!({
            "day_of_week": r.get::<i32,_>("day_of_week"),
            "open_time": r.get::<Option<String>,_>("open_time"),
            "close_time": r.get::<Option<String>,_>("close_time"),
            "is_closed": r.get::<bool,_>("is_closed"),
        })
    })
    .fetch_all(&state.pg)
    .await?;

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "service_id": service_id,
            "menu": items,
            "opening_hours": hours,
        })),
    ))
}

/// POST /api/restaurant/public/:service_id/order  — commande client (auth requise)
/// Intègre : wallet débit client (repas + livraison + assurance), commission Yukpo 2%,
/// QR code livraison, push partenaire, facture détaillée.
pub async fn public_create_order(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(service_id): Path<i32>,
    Json(body): Json<CreateRestaurantOrderBody>,
) -> AppResult<impl IntoResponse> {
    // ── 1. Vérifier le restaurant ────────────────────────────
    let exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM services WHERE id=$1 AND specialized_type='restaurant' AND is_active=TRUE)",
    )
    .bind(service_id)
    .fetch_one(&state.pg)
    .await
    .unwrap_or(false);
    if !exists {
        return Err(AppError::NotFound("Restaurant introuvable".to_string()));
    }

    // ── 2. Calcul du total repas et commission Yukpo ──────────
    let order_type = body.order_type.as_deref().unwrap_or("takeaway");
    let total_meal: f64 =
        body.items.iter().map(|i| i.item_price * i.quantity.unwrap_or(1) as f64).sum();
    let total_meal_cents = (total_meal * 100.0) as i64;

    let commission_rate: f64 = sqlx::query_scalar(
        "SELECT rate::float8 FROM yukpo_commission_config WHERE service_type='restaurant'",
    )
    .fetch_optional(&state.pg)
    .await?
    .unwrap_or(0.02);

    let yukpo_commission = total_meal * commission_rate;
    let net_partner = total_meal - yukpo_commission;

    // ── 3. Frais livraison + assurance (si delivery) ─────────
    // Livraison : minimum_cost_fcfa depuis delivery_engine_pricing (scooter)
    // Assurance : base_fee + percentage_rate% × repas, plafonnée à max_fee — depuis delivery_insurance_fees
    let (delivery_fee_cents, insurance_fee_cents) = if order_type == "delivery" {
        let delivery_fee: f64 = sqlx::query_scalar(
            "SELECT minimum_cost_fcfa FROM delivery_engine_pricing WHERE engine_type='scooter' LIMIT 1",
        )
        .fetch_optional(&state.pg)
        .await
        .ok()
        .flatten()
        .unwrap_or(1000.0); // fallback scooter défaut

        let ins: Option<(f64, f64, f64)> = sqlx::query_as(
            "SELECT base_fee_fcfa, percentage_rate, max_fee_fcfa FROM delivery_insurance_fees WHERE engine_type='scooter' LIMIT 1",
        )
        .fetch_optional(&state.pg)
        .await
        .ok()
        .flatten();
        let (ins_base, ins_rate, ins_max) = ins.unwrap_or((200.0, 0.8, 2500.0));
        let insurance_raw = ins_base + total_meal * (ins_rate / 100.0);
        let insurance_fee: f64 = insurance_raw.min(ins_max);

        (
            (delivery_fee * 100.0).round() as i64,
            (insurance_fee * 100.0).round() as i64,
        )
    } else {
        (0i64, 0i64)
    };

    let total_with_fees_cents = total_meal_cents + delivery_fee_cents + insurance_fee_cents;

    // ── 4. Vérifier et débiter le wallet client ───────────────
    let client_balance: Option<i64> =
        sqlx::query_scalar("SELECT balance_cents FROM user_wallets WHERE user_id=$1 FOR UPDATE")
            .bind(user.id)
            .fetch_optional(&state.pg)
            .await?;

    let payment_status;
    let payment_method;

    if let Some(balance) = client_balance {
        if balance >= total_with_fees_cents {
            // Débit wallet client (repas + livraison + assurance)
            sqlx::query(
                "UPDATE user_wallets SET balance_cents = balance_cents - $1, updated_at=NOW() WHERE user_id=$2",
            )
            .bind(total_with_fees_cents)
            .bind(user.id)
            .execute(&state.pg)
            .await?;

            // Transaction wallet client
            let motif = if order_type == "delivery" {
                format!(
                    "Commande restaurant #{service_id} (repas {:.0} FCFA + livraison {:.0} FCFA + assurance {:.0} FCFA)",
                    total_meal,
                    delivery_fee_cents as f64 / 100.0,
                    insurance_fee_cents as f64 / 100.0,
                )
            } else {
                format!("Commande restaurant #{service_id}")
            };
            sqlx::query(
                r#"INSERT INTO wallet_transactions (user_id, montant, type_transaction, motif, created_at)
                   VALUES ($1, $2, 'debit', $3, NOW())"#,
            )
            .bind(user.id)
            .bind(total_with_fees_cents as f64 / 100.0)
            .bind(motif)
            .execute(&state.pg)
            .await
            .ok();

            payment_status = "paid";
            payment_method = Some("wallet");
        } else {
            // Solde insuffisant → paiement en espèces (à la livraison / sur place)
            payment_status = "unpaid";
            payment_method = Some("cash");
        }
    } else {
        payment_status = "unpaid";
        payment_method = Some("cash");
    }

    // ── 5. Créer la commande restaurant ─────────────────────
    let delivery_addr = body.delivery_address.as_deref().or(body.notes.as_deref()); // compat: notes utilisées comme adresse si delivery_address absent
                                                                                    // wallet_reserved_cents = total débité au client (repas + livraison + assurance)
    let wallet_reserved_cents_val = if payment_status == "paid" {
        total_with_fees_cents
    } else {
        0
    };

    let order_id: i32 = sqlx::query_scalar(
        r#"INSERT INTO restaurant_orders
               (service_id, client_user_id, order_type, table_id, status,
                total_amount, yukpo_commission, net_partner_amount,
                payment_status, payment_method, notes, client_name, client_phone,
                delivery_fee_cents, insurance_fee_cents, total_with_fees_cents,
                wallet_reserved_cents, delivery_address)
           VALUES ($1,$2,$3,$4,'pending',$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
           RETURNING id"#,
    )
    .bind(service_id)
    .bind(user.id)
    .bind(order_type)
    .bind(body.table_id)
    .bind(total_meal)
    .bind(yukpo_commission)
    .bind(net_partner)
    .bind(payment_status)
    .bind(payment_method)
    .bind(body.notes.as_deref())
    .bind(body.client_name.as_deref())
    .bind(body.client_phone.as_deref())
    .bind(delivery_fee_cents as i32)
    .bind(insurance_fee_cents as i32)
    .bind(total_with_fees_cents as i32)
    .bind(wallet_reserved_cents_val)
    .bind(delivery_addr)
    .fetch_one(&state.pg)
    .await?;

    // ── 6. Insérer les lignes de commande ─────────────────────
    for item in &body.items {
        sqlx::query(
            r#"INSERT INTO restaurant_order_items (order_id, menu_item_id, item_name, item_price, quantity, notes)
               VALUES ($1,$2,$3,$4,$5,$6)"#,
        )
        .bind(order_id)
        .bind(item.menu_item_id)
        .bind(&item.item_name)
        .bind(item.item_price)
        .bind(item.quantity.unwrap_or(1))
        .bind(item.notes.as_deref())
        .execute(&state.pg)
        .await?;
    }

    // ── 7. Si livraison → créer un delivery_order + QR code ──
    let mut delivery_order_id: Option<i32> = None;
    let mut qr_code_url: Option<String> = None;
    let mut qr_code_value: Option<String> = None;

    if order_type == "delivery" {
        let addr = delivery_addr.unwrap_or("Adresse non précisée");
        let client_name = body.client_name.as_deref().unwrap_or("Client");
        // Récupérer l'owner du service restaurant (expéditeur)
        let partner_user_id: Option<i32> =
            sqlx::query_scalar("SELECT user_id FROM services WHERE id=$1")
                .bind(service_id)
                .fetch_optional(&state.pg)
                .await?;

        if let Some(partner_id) = partner_user_id {
            let did: Option<i32> = sqlx::query_scalar(
                r#"INSERT INTO delivery_orders
                       (sender_id, recipient_name, delivery_address, package_description,
                        delivery_type, status, created_at, updated_at)
                   VALUES ($1, $2, $3, $4, 'standard', 'pending', NOW(), NOW())
                   RETURNING id"#,
            )
            .bind(partner_id)
            .bind(client_name)
            .bind(addr)
            .bind(format!("Commande restaurant #{order_id}"))
            .fetch_optional(&state.pg)
            .await?;

            if let Some(did) = did {
                delivery_order_id = Some(did);
                sqlx::query("UPDATE restaurant_orders SET delivery_order_id=$1 WHERE id=$2")
                    .bind(did)
                    .bind(order_id)
                    .execute(&state.pg)
                    .await
                    .ok();

                // Générer QR code livraison (valide 24h)
                let qr_val = format!(
                    "RST-DELIVERY-{}-{}-{}",
                    order_id,
                    chrono::Utc::now().timestamp(),
                    Uuid::new_v4().to_string().chars().take(8).collect::<String>()
                );
                let expires = chrono::Utc::now() + chrono::Duration::hours(24);
                let qr_payload = json!({
                    "t": "delivery",
                    "order_id": order_id,
                    "service_id": service_id,
                    "client": client_name,
                    "addr": addr,
                    "ts": chrono::Utc::now().timestamp(),
                });
                let qr_data_enc = urlencoding::encode(&qr_payload.to_string()).to_string();
                let url = format!(
                    "https://api.qrserver.com/v1/create-qr-code/?size=400x400&data={}",
                    qr_data_enc
                );

                sqlx::query(
                    r#"INSERT INTO restaurant_order_qr_codes
                           (order_id, qr_code, qr_code_url, qr_type, status, expires_at)
                       VALUES ($1, $2, $3, 'delivery', 'pending', $4)
                       ON CONFLICT (qr_code) DO NOTHING"#,
                )
                .bind(order_id)
                .bind(&qr_val)
                .bind(&url)
                .bind(expires)
                .execute(&state.pg)
                .await
                .ok();

                qr_code_url = Some(url);
                qr_code_value = Some(qr_val);
            }

            // Push notification au partenaire
            let push_data = json!({
                "type": "new_restaurant_order",
                "order_id": order_id,
                "order_type": order_type,
                "total": total_meal,
            });
            let _ = push_notification_service::send_push_notification(
                &state.pg,
                partner_id,
                "🍽️ Nouvelle commande !".to_string(),
                format!("Livraison de {:.0} FCFA pour {}", total_meal, client_name),
                Some(push_data),
                Some("default".to_string()),
            )
            .await;
        }
    } else {
        // Pour dine_in / takeaway : push au partenaire également
        let partner_user_id: Option<i32> =
            sqlx::query_scalar("SELECT user_id FROM services WHERE id=$1")
                .bind(service_id)
                .fetch_optional(&state.pg)
                .await?;

        if let Some(partner_id) = partner_user_id {
            let label = if order_type == "dine_in" {
                "sur place"
            } else {
                "à emporter"
            };
            let push_data = json!({
                "type": "new_restaurant_order",
                "order_id": order_id,
                "order_type": order_type,
                "total": total_meal,
            });
            let _ = push_notification_service::send_push_notification(
                &state.pg,
                partner_id,
                "🍽️ Nouvelle commande !".to_string(),
                format!("Commande {} de {:.0} FCFA", label, total_meal),
                Some(push_data),
                Some("default".to_string()),
            )
            .await;
        }
    }

    // ── 8. Réponse : facture détaillée ────────────────────────
    let invoice_lines: Vec<serde_json::Value> = body
        .items
        .iter()
        .map(|i| {
            json!({
                "label": i.item_name,
                "qty": i.quantity.unwrap_or(1),
                "unit_price": i.item_price,
                "subtotal": i.item_price * i.quantity.unwrap_or(1) as f64,
            })
        })
        .collect();

    let mut invoice = json!({
        "lines": invoice_lines,
        "sous_total_repas": total_meal,
        "commission_yukpo_2pct": yukpo_commission,
        "net_partenaire": net_partner,
    });

    if order_type == "delivery" {
        invoice["frais_livraison"] = json!(delivery_fee_cents as f64 / 100.0);
        invoice["assurance"] = json!(insurance_fee_cents as f64 / 100.0);
        invoice["total_ttc"] = json!(total_with_fees_cents as f64 / 100.0);
    } else {
        invoice["total_ttc"] = json!(total_meal);
    }

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "success": true,
            "order_id": order_id,
            "total": total_meal,
            "total_with_fees": total_with_fees_cents as f64 / 100.0,
            "delivery_fee": delivery_fee_cents as f64 / 100.0,
            "insurance_fee": insurance_fee_cents as f64 / 100.0,
            "yukpo_commission": yukpo_commission,
            "net_partner_amount": net_partner,
            "payment_status": payment_status,
            "payment_method": payment_method,
            "delivery_order_id": delivery_order_id,
            "qr_code": qr_code_value,
            "qr_code_url": qr_code_url,
            "invoice": invoice,
            "message": if payment_status == "paid" {
                "Commande payée et envoyée au restaurant !"
            } else {
                "Commande envoyée. Paiement à la réception."
            },
        })),
    ))
}

// ============================================================
// DASHBOARD FINANCIER PARTENAIRE
// ============================================================

/// GET /api/restaurant/financial-summary — Résumé financier partenaire
pub async fn get_financial_summary(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    let service_id = restaurant_service_id_for_user(&state.pg, user.id).await?;

    // Totaux globaux
    let global = sqlx::query(
        r#"SELECT
               COUNT(*) AS total_orders,
               COUNT(*) FILTER (WHERE status='completed') AS completed_orders,
               COALESCE(SUM(total_amount) FILTER (WHERE status='completed'), 0)::float8 AS total_revenue,
               COALESCE(SUM(yukpo_commission) FILTER (WHERE status='completed'), 0)::float8 AS total_commission,
               COALESCE(SUM(net_partner_amount) FILTER (WHERE status='completed'), 0)::float8 AS total_net,
               COUNT(*) FILTER (WHERE payment_status='paid') AS paid_orders,
               COALESCE(SUM(total_amount) FILTER (WHERE payment_status='paid'), 0)::float8 AS paid_amount
           FROM restaurant_orders WHERE service_id=$1"#,
    )
    .bind(service_id)
    .map(|r: sqlx::postgres::PgRow| {
        json!({
            "total_orders": r.get::<i64,_>("total_orders"),
            "completed_orders": r.get::<i64,_>("completed_orders"),
            "total_revenue": r.get::<f64,_>("total_revenue"),
            "total_commission": r.get::<f64,_>("total_commission"),
            "total_net": r.get::<f64,_>("total_net"),
            "paid_orders": r.get::<i64,_>("paid_orders"),
            "paid_amount": r.get::<f64,_>("paid_amount"),
        })
    })
    .fetch_optional(&state.pg)
    .await?
    .unwrap_or(json!({}));

    // Aujourd'hui
    let today = sqlx::query(
        r#"SELECT
               COUNT(*) AS orders_today,
               COALESCE(SUM(total_amount) FILTER (WHERE status NOT IN ('cancelled')), 0)::float8 AS revenue_today,
               COALESCE(SUM(net_partner_amount) FILTER (WHERE status='completed'), 0)::float8 AS net_today
           FROM restaurant_orders
           WHERE service_id=$1 AND created_at::date = CURRENT_DATE"#,
    )
    .bind(service_id)
    .map(|r: sqlx::postgres::PgRow| {
        json!({
            "orders_today": r.get::<i64,_>("orders_today"),
            "revenue_today": r.get::<f64,_>("revenue_today"),
            "net_today": r.get::<f64,_>("net_today"),
        })
    })
    .fetch_optional(&state.pg)
    .await?
    .unwrap_or(json!({}));

    // Historique des 30 derniers jours (par jour)
    let history = sqlx::query(
        r#"SELECT
               created_at::date::text AS day,
               COUNT(*) AS orders,
               COALESCE(SUM(total_amount),0)::float8 AS revenue,
               COALESCE(SUM(net_partner_amount),0)::float8 AS net
           FROM restaurant_orders
           WHERE service_id=$1
             AND created_at >= NOW() - INTERVAL '30 days'
             AND status NOT IN ('cancelled')
           GROUP BY created_at::date
           ORDER BY day DESC
           LIMIT 30"#,
    )
    .bind(service_id)
    .map(|r: sqlx::postgres::PgRow| {
        json!({
            "day": r.get::<Option<String>,_>("day"),
            "orders": r.get::<i64,_>("orders"),
            "revenue": r.get::<f64,_>("revenue"),
            "net": r.get::<f64,_>("net"),
        })
    })
    .fetch_all(&state.pg)
    .await?;

    // Top plats vendus
    let top_items = sqlx::query(
        r#"SELECT oi.item_name,
               SUM(oi.quantity) AS qty_sold,
               SUM(oi.item_price::float8 * oi.quantity) AS revenue
           FROM restaurant_order_items oi
           JOIN restaurant_orders o ON o.id = oi.order_id
           WHERE o.service_id=$1 AND o.status NOT IN ('cancelled')
           GROUP BY oi.item_name
           ORDER BY qty_sold DESC
           LIMIT 10"#,
    )
    .bind(service_id)
    .map(|r: sqlx::postgres::PgRow| {
        json!({
            "item_name": r.get::<String,_>("item_name"),
            "qty_sold": r.get::<i64,_>("qty_sold"),
            "revenue": r.get::<f64,_>("revenue"),
        })
    })
    .fetch_all(&state.pg)
    .await?;

    // Wallet partenaire
    let wallet_balance: Option<i64> =
        sqlx::query_scalar("SELECT balance_cents FROM user_wallets WHERE user_id=$1")
            .bind(user.id)
            .fetch_optional(&state.pg)
            .await?;

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "global": global,
            "today": today,
            "history": history,
            "top_items": top_items,
            "wallet_balance_cents": wallet_balance,
            "wallet_balance": wallet_balance.map(|b| b as f64 / 100.0),
            "yukpo_commission_rate": 0.02,
        })),
    ))
}

/// PATCH /api/restaurant/orders/:id/status — avec crédit partenaire si completed
pub async fn update_order_status_with_payout(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(order_id): Path<i32>,
    Json(body): Json<UpdateOrderStatusBody>,
) -> AppResult<impl IntoResponse> {
    let service_id = restaurant_service_id_for_user(&state.pg, user.id).await?;
    let valid = [
        "pending",
        "accepted",
        "preparing",
        "ready",
        "completed",
        "cancelled",
    ];
    if !valid.contains(&body.status.as_str()) {
        return Err(AppError::BadRequest(format!(
            "Status invalide: {}",
            body.status
        )));
    }

    let r = sqlx::query(
        r#"UPDATE restaurant_orders SET status=$1, estimated_ready_at=$2::timestamptz, updated_at=NOW()
           WHERE id=$3 AND service_id=$4"#,
    )
    .bind(&body.status)
    .bind(body.estimated_ready_at.as_deref())
    .bind(order_id)
    .bind(service_id)
    .execute(&state.pg)
    .await?;

    if r.rows_affected() == 0 {
        return Err(AppError::NotFound("Commande introuvable".to_string()));
    }

    // Si la commande passe à "completed" → créditer le wallet partenaire
    if body.status == "completed" {
        let order = sqlx::query(
            "SELECT net_partner_amount::float8, payment_status FROM restaurant_orders WHERE id=$1",
        )
        .bind(order_id)
        .map(|r: sqlx::postgres::PgRow| {
            (
                r.get::<f64, _>("net_partner_amount"),
                r.get::<String, _>("payment_status"),
            )
        })
        .fetch_optional(&state.pg)
        .await?;

        if let Some((net, pstatus)) = order {
            if pstatus == "paid" && net > 0.0 {
                let net_cents = (net * 100.0) as i64;
                // Créer le wallet partenaire s'il n'existe pas
                sqlx::query(
                    r#"INSERT INTO user_wallets (user_id, balance_cents, currency)
                       VALUES ($1, 0, 'XAF')
                       ON CONFLICT (user_id, currency) DO NOTHING"#,
                )
                .bind(user.id)
                .execute(&state.pg)
                .await
                .ok();

                // Créditer
                sqlx::query(
                    "UPDATE user_wallets SET balance_cents = balance_cents + $1, updated_at=NOW() WHERE user_id=$2",
                )
                .bind(net_cents)
                .bind(user.id)
                .execute(&state.pg)
                .await
                .ok();

                // Transaction
                sqlx::query(
                    r#"INSERT INTO wallet_transactions (user_id, montant, type_transaction, motif, created_at)
                       VALUES ($1, $2, 'credit', $3, NOW())"#,
                )
                .bind(user.id)
                .bind(net)
                .bind(format!("Revenu commande restaurant #{order_id} (commission Yukpo 2% déduite)"))
                .execute(&state.pg)
                .await
                .ok();
            }
        }
    }

    // Push notification au client si client_user_id connu
    let client_info = sqlx::query(
        "SELECT client_user_id, total_amount::float8, order_type FROM restaurant_orders WHERE id=$1",
    )
    .bind(order_id)
    .map(|r: sqlx::postgres::PgRow| {
        (
            r.get::<Option<i32>, _>("client_user_id"),
            r.get::<f64, _>("total_amount"),
            r.get::<String, _>("order_type"),
        )
    })
    .fetch_optional(&state.pg)
    .await
    .ok()
    .flatten();

    if let Some((Some(client_id), amount, otype)) = client_info {
        let (title, msg) = match body.status.as_str() {
            "accepted" => (
                "✅ Commande acceptée",
                format!("Votre commande de {:.0} FCFA a été acceptée !", amount),
            ),
            "preparing" => (
                "👨‍🍳 En préparation",
                "Votre repas est en cours de préparation.".to_string(),
            ),
            "ready" => {
                if otype == "delivery" {
                    (
                        "📦 Commande prête",
                        "Votre commande est prête et en attente du coursier.".to_string(),
                    )
                } else {
                    (
                        "✅ Prêt à récupérer",
                        "Votre commande est prête ! Vous pouvez venir la récupérer.".to_string(),
                    )
                }
            }
            "completed" => (
                "🎉 Livraison effectuée",
                "Votre commande a bien été reçue. Bon appétit !".to_string(),
            ),
            "cancelled" => (
                "❌ Commande annulée",
                "Votre commande a été annulée par le restaurant.".to_string(),
            ),
            _ => (
                "📋 Statut mis à jour",
                format!("Nouveau statut : {}", body.status),
            ),
        };
        let push_data = json!({
            "type": "restaurant_order_status",
            "order_id": order_id,
            "status": body.status,
        });
        let _ = push_notification_service::send_push_notification(
            &state.pg,
            client_id,
            title.to_string(),
            msg,
            Some(push_data),
            Some("default".to_string()),
        )
        .await;
    }

    Ok((
        StatusCode::OK,
        Json(json!({ "success": true, "status": body.status })),
    ))
}

// ============================================================
// QR CODE VALIDATION (scan par coursier ou partenaire)
// ============================================================

#[derive(Debug, Deserialize)]
pub struct ValidateQrBody {
    pub qr_code: String,
}

/// POST /api/restaurant/public/orders/validate-qr
/// Le coursier ou le partenaire scanne le QR code pour valider la remise
pub async fn validate_delivery_qr(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(body): Json<ValidateQrBody>,
) -> AppResult<impl IntoResponse> {
    let row = sqlx::query(
        r#"SELECT rq.id, rq.order_id, rq.status, rq.expires_at,
                  ro.service_id, ro.client_user_id, ro.order_type,
                  ro.total_amount::float8, ro.client_name
           FROM restaurant_order_qr_codes rq
           JOIN restaurant_orders ro ON ro.id = rq.order_id
           WHERE rq.qr_code = $1"#,
    )
    .bind(&body.qr_code)
    .fetch_optional(&state.pg)
    .await?
    .ok_or_else(|| AppError::NotFound("QR code introuvable".to_string()))?;

    let qr_id: i32 = row.get("id");
    let order_id: i32 = row.get("order_id");
    let qr_status: String = row.get("status");
    let expires_at: chrono::DateTime<chrono::Utc> = row.get("expires_at");
    let service_id: i32 = row.get("service_id");
    let client_user_id: Option<i32> = row.get("client_user_id");
    let total: f64 = row.get("total_amount");
    let client_name: Option<String> = row.get("client_name");

    if expires_at < chrono::Utc::now() {
        return Err(AppError::BadRequest("QR code expiré".to_string()));
    }
    if qr_status != "pending" {
        return Err(AppError::BadRequest(format!(
            "QR code déjà utilisé (statut: {})",
            qr_status
        )));
    }

    // Autorisation : le partenaire (owner du service) ou un coursier lié à la commande
    let is_partner: bool =
        sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM services WHERE id=$1 AND user_id=$2)")
            .bind(service_id)
            .bind(user.id)
            .fetch_one(&state.pg)
            .await
            .unwrap_or(false);

    let is_courier: bool = sqlx::query_scalar(
        r#"SELECT EXISTS(
            SELECT 1 FROM delivery_orders do2
            JOIN restaurant_orders ro ON ro.delivery_order_id = do2.id
            WHERE ro.id = $1 AND do2.coursier_id = $2
        )"#,
    )
    .bind(order_id)
    .bind(user.id)
    .fetch_one(&state.pg)
    .await
    .unwrap_or(false);

    if !is_partner && !is_courier {
        return Err(AppError::Forbidden(
            "Vous n'êtes pas autorisé à valider ce QR code".to_string(),
        ));
    }

    // Valider le QR
    sqlx::query(
        "UPDATE restaurant_order_qr_codes SET status='validated', validated_at=NOW(), validated_by=$1 WHERE id=$2",
    )
    .bind(user.id)
    .bind(qr_id)
    .execute(&state.pg)
    .await?;

    // Passer la commande à 'completed'
    sqlx::query(
        "UPDATE restaurant_orders SET status='completed', updated_at=NOW() WHERE id=$1 AND status != 'completed'",
    )
    .bind(order_id)
    .execute(&state.pg)
    .await
    .ok();

    // ✅ REVERSAL FINANCIER : créditer automatiquement le wallet du partenaire restaurant
    // Identique au flux pharmacie — évite que le partenaire ait à appeler update_order_status manuellement
    {
        let commission_rate: f64 = sqlx::query_scalar(
            "SELECT rate::float8 FROM yukpo_commission_config WHERE service_type = 'restaurant'",
        )
        .fetch_optional(&state.pg)
        .await
        .ok()
        .flatten()
        .unwrap_or(0.02);

        let order_data = sqlx::query(
            r#"SELECT payment_status, wallet_reserved_cents, reversed_at,
                      delivery_fee_cents, insurance_fee_cents,
                      s.user_id AS partner_user_id
               FROM restaurant_orders ro
               JOIN services s ON s.id = ro.service_id
               WHERE ro.id = $1"#,
        )
        .bind(order_id)
        .fetch_optional(&state.pg)
        .await
        .ok()
        .flatten();

        if let Some(ord) = order_data {
            let already_reversed: Option<chrono::DateTime<chrono::Utc>> =
                ord.try_get("reversed_at").ok().flatten();
            let payment_status: String = ord.try_get("payment_status").unwrap_or_default();
            let partner_user_id: i32 = ord.try_get("partner_user_id").unwrap_or(0);
            let wallet_reserved_cents: i64 = ord.try_get("wallet_reserved_cents").unwrap_or(0);
            let delivery_fee_cents: i64 =
                ord.try_get::<i32, _>("delivery_fee_cents").unwrap_or(0) as i64;
            let insurance_fee_cents: i64 =
                ord.try_get::<i32, _>("insurance_fee_cents").unwrap_or(0) as i64;

            if already_reversed.is_none()
                && payment_status == "paid"
                && wallet_reserved_cents > 0
                && partner_user_id > 0
            {
                // ✅ Split correct des fonds :
                //   - Partie repas uniquement → partenaire (moins commission Yukpo)
                //   - Frais livraison → coursier (géré séparément via delivery_payment_service)
                //   - Assurance → compte Yukpo (conservé — reversé si sinistre)
                let meal_cents = wallet_reserved_cents - delivery_fee_cents - insurance_fee_cents;
                let commission_cents = (meal_cents as f64 * commission_rate).round() as i64;
                let net_partner_cents = (meal_cents - commission_cents).max(0);

                // Créer le wallet partenaire s'il n'existe pas
                sqlx::query(
                    "INSERT INTO user_wallets (user_id, balance_cents, currency) VALUES ($1, 0, 'XAF') ON CONFLICT (user_id, currency) DO NOTHING",
                )
                .bind(partner_user_id)
                .execute(&state.pg)
                .await
                .ok();

                let balance_before: i64 = sqlx::query_scalar(
                    "SELECT COALESCE(balance_cents, 0) FROM user_wallets WHERE user_id = $1 AND currency = 'XAF'",
                )
                .bind(partner_user_id)
                .fetch_optional(&state.pg)
                .await
                .ok()
                .flatten()
                .unwrap_or(0);

                // Créditer le wallet partenaire (repas uniquement)
                if net_partner_cents > 0 {
                    sqlx::query(
                        "UPDATE user_wallets SET balance_cents = balance_cents + $1, updated_at = NOW() WHERE user_id = $2 AND currency = 'XAF'",
                    )
                    .bind(net_partner_cents)
                    .bind(partner_user_id)
                    .execute(&state.pg)
                    .await
                    .ok();
                }

                // Logger la transaction
                sqlx::query(
                    r#"INSERT INTO wallet_transactions (
                        user_id, transaction_type, direction, amount_cents,
                        balance_before_cents, balance_after_cents,
                        currency, reference_type, reference_id, description, created_at
                    ) VALUES ($1, 'restaurant_order_payout', 'credit', $2, $3, $4,
                              'XAF', 'restaurant_order', $5, $6, NOW())"#,
                )
                .bind(partner_user_id)
                .bind(net_partner_cents)
                .bind(balance_before)
                .bind(balance_before + net_partner_cents)
                .bind(order_id)
                .bind(format!(
                    "Repas commande #{} net partenaire (commission {:.0}% | livraison {}F et assurance {}F retenus séparément)",
                    order_id,
                    commission_rate * 100.0,
                    delivery_fee_cents / 100,
                    insurance_fee_cents / 100,
                ))
                .execute(&state.pg)
                .await
                .ok();

                // Marquer comme reversé (idempotence)
                sqlx::query("UPDATE restaurant_orders SET reversed_at = NOW() WHERE id = $1")
                    .bind(order_id)
                    .execute(&state.pg)
                    .await
                    .ok();

                info!(
                    "[validate_delivery_qr] ✅ Payout restaurant: {}F → partner {} (commission {}F)",
                    net_partner_cents, partner_user_id, commission_cents
                );
            }
        }
    }

    // Push au client
    if let Some(cid) = client_user_id {
        let _ = push_notification_service::send_push_notification(
            &state.pg,
            cid,
            "🎉 Livraison confirmée !".to_string(),
            format!(
                "Votre commande de {:.0} FCFA a été remise. Bon appétit {}!",
                total,
                client_name.as_deref().map(|n| format!("{} ", n)).unwrap_or_default()
            ),
            Some(json!({ "type": "restaurant_order_delivered", "order_id": order_id })),
            Some("default".to_string()),
        )
        .await;
    }

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "order_id": order_id,
            "message": "Livraison validée avec succès",
        })),
    ))
}

// ============================================================
// HISTORIQUE COMMANDES CLIENT
// ============================================================

/// GET /api/restaurant/public/orders/history — historique commandes du client connecté
pub async fn client_order_history(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    let orders = sqlx::query(
        r#"SELECT o.id, o.order_type, o.status, o.total_amount::float8,
                  o.delivery_fee_cents, o.insurance_fee_cents, o.total_with_fees_cents,
                  o.payment_status, o.notes, o.delivery_address,
                  o.created_at::text AS created_at,
                  o.estimated_ready_at::text AS estimated_ready_at,
                  o.client_rating, o.client_rating_comment,
                  s.name AS restaurant_name, s.city AS restaurant_city,
                  s.id AS service_id,
                  COALESCE(
                      json_agg(json_build_object(
                          'item_name', oi.item_name,
                          'item_price', oi.item_price::float8,
                          'quantity', oi.quantity
                      )) FILTER (WHERE oi.id IS NOT NULL),
                      '[]'::json
                  ) AS items
           FROM restaurant_orders o
           JOIN services s ON s.id = o.service_id
           LEFT JOIN restaurant_order_items oi ON oi.order_id = o.id
           WHERE o.client_user_id = $1
           GROUP BY o.id, s.id
           ORDER BY o.created_at DESC
           LIMIT 50"#,
    )
    .bind(user.id)
    .map(|r: sqlx::postgres::PgRow| {
        json!({
            "id": r.get::<i32,_>("id"),
            "order_type": r.get::<String,_>("order_type"),
            "status": r.get::<String,_>("status"),
            "total_amount": r.get::<f64,_>("total_amount"),
            "delivery_fee": r.get::<Option<i32>,_>("delivery_fee_cents").unwrap_or(0) as f64 / 100.0,
            "insurance_fee": r.get::<Option<i32>,_>("insurance_fee_cents").unwrap_or(0) as f64 / 100.0,
            "total_with_fees": r.get::<Option<i32>,_>("total_with_fees_cents").map(|v| v as f64 / 100.0),
            "payment_status": r.get::<Option<String>,_>("payment_status"),
            "notes": r.get::<Option<String>,_>("notes"),
            "delivery_address": r.get::<Option<String>,_>("delivery_address"),
            "created_at": r.get::<Option<String>,_>("created_at"),
            "estimated_ready_at": r.get::<Option<String>,_>("estimated_ready_at"),
            "client_rating": r.get::<Option<i16>,_>("client_rating"),
            "client_rating_comment": r.get::<Option<String>,_>("client_rating_comment"),
            "restaurant_name": r.get::<String,_>("restaurant_name"),
            "restaurant_city": r.get::<Option<String>,_>("restaurant_city"),
            "service_id": r.get::<i32,_>("service_id"),
            "items": r.get::<serde_json::Value,_>("items"),
        })
    })
    .fetch_all(&state.pg)
    .await?;

    Ok((
        StatusCode::OK,
        Json(json!({ "success": true, "orders": orders })),
    ))
}

// ============================================================
// NOTATION COMMANDE CLIENT
// ============================================================

#[derive(Debug, Deserialize)]
pub struct RateOrderBody {
    pub rating: i16, // 1-5
    pub comment: Option<String>,
}

/// POST /api/restaurant/public/orders/:order_id/rate
/// Le client note sa commande après livraison/récupération
pub async fn rate_order(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(order_id): Path<i32>,
    Json(body): Json<RateOrderBody>,
) -> AppResult<impl IntoResponse> {
    if body.rating < 1 || body.rating > 5 {
        return Err(AppError::BadRequest(
            "La note doit être entre 1 et 5".to_string(),
        ));
    }

    // Vérifier que la commande appartient bien au client et est terminée
    let order = sqlx::query(
        "SELECT id, service_id, status FROM restaurant_orders WHERE id=$1 AND client_user_id=$2",
    )
    .bind(order_id)
    .bind(user.id)
    .fetch_optional(&state.pg)
    .await?
    .ok_or_else(|| AppError::NotFound("Commande introuvable".to_string()))?;

    let status: String = order.get("status");
    if status != "completed" {
        return Err(AppError::BadRequest(
            "Vous ne pouvez noter qu'une commande complétée".to_string(),
        ));
    }

    let service_id: i32 = order.get("service_id");

    sqlx::query(
        "UPDATE restaurant_orders SET client_rating=$1, client_rating_comment=$2, rated_at=NOW() WHERE id=$3",
    )
    .bind(body.rating)
    .bind(body.comment.as_deref())
    .bind(order_id)
    .execute(&state.pg)
    .await?;

    // Propager aussi vers specialized_ratings pour cohérence globale
    let partner_id: Option<i32> = sqlx::query_scalar("SELECT user_id FROM services WHERE id=$1")
        .bind(service_id)
        .fetch_optional(&state.pg)
        .await
        .ok()
        .flatten();
    if let Some(pid) = partner_id {
        sqlx::query(
            r#"INSERT INTO specialized_ratings (user_id, service_id, service_type, prestataire_id, rating, comment, created_at)
               VALUES ($1, $2, 'restaurant', $3, $4, $5, NOW())
               ON CONFLICT DO NOTHING"#,
        )
        .bind(user.id)
        .bind(service_id)
        .bind(pid)
        .bind(body.rating as i32)
        .bind(body.comment.as_deref())
        .execute(&state.pg)
        .await
        .ok();
    }

    Ok((
        StatusCode::OK,
        Json(json!({ "success": true, "message": "Merci pour votre avis !" })),
    ))
}

/// GET /api/restaurant/public/orders/:order_id/status — suivi temps réel pour le client
pub async fn get_order_status(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(order_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    let row = sqlx::query(
        r#"SELECT o.id, o.status, o.order_type, o.estimated_ready_at::text,
                  o.total_amount::float8, o.delivery_fee_cents, o.payment_status,
                  s.name AS restaurant_name,
                  rq.qr_code, rq.qr_code_url, rq.status AS qr_status
           FROM restaurant_orders o
           JOIN services s ON s.id = o.service_id
           LEFT JOIN restaurant_order_qr_codes rq ON rq.order_id = o.id
           WHERE o.id = $1 AND o.client_user_id = $2"#,
    )
    .bind(order_id)
    .bind(user.id)
    .map(|r: sqlx::postgres::PgRow| {
        json!({
            "id": r.get::<i32,_>("id"),
            "status": r.get::<String,_>("status"),
            "order_type": r.get::<String,_>("order_type"),
            "estimated_ready_at": r.get::<Option<String>,_>("estimated_ready_at"),
            "total_amount": r.get::<f64,_>("total_amount"),
            "delivery_fee": r.get::<Option<i32>,_>("delivery_fee_cents").unwrap_or(0) as f64 / 100.0,
            "payment_status": r.get::<Option<String>,_>("payment_status"),
            "restaurant_name": r.get::<String,_>("restaurant_name"),
            "qr_code": r.get::<Option<String>,_>("qr_code"),
            "qr_code_url": r.get::<Option<String>,_>("qr_code_url"),
            "qr_status": r.get::<Option<String>,_>("qr_status"),
        })
    })
    .fetch_optional(&state.pg)
    .await?
    .ok_or_else(|| AppError::NotFound("Commande introuvable".to_string()))?;

    Ok((
        StatusCode::OK,
        Json(json!({ "success": true, "order": row })),
    ))
}
