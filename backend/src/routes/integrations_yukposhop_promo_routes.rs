//! Bridge YukpoShop ⇄ Yukpo Rust marketplace (Promo / Loyalty / Similar / Abandoned).
//!
//! Expose les services Rust existants (LoyaltyService, SimilarProductsService,
//! flash promo, global promo, abandoned cart) derrière des routes HTTP
//! protégées par HMAC (clé partagée `YUKPOSHOP_BRIDGE_HMAC_KEY`), pour que le
//! backend Python YukpoPro puisse en bénéficier sans dupliquer la logique.
//!
//! Auth : headers X-Yukpo-Signature + X-Yukpo-Timestamp (cf. Piste 1).
//! Mapping : un `external_product_id` (id YukpoShop Python) est résolu en
//! `service_id` Rust via la table `external_product_links` (source_app='yukposhop').

use axum::{
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use chrono::{DateTime, Utc};
use log::{info, warn};
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::Row;
use std::sync::Arc;

use crate::routes::integrations_yukposhop_routes::verify_hmac;
use crate::state::AppState;

// ─── HMAC guard helper ────────────────────────────────────────────────────

fn check_hmac(headers: &HeaderMap, body: &[u8]) -> Result<(), (StatusCode, Json<Value>)> {
    let secret = std::env::var("YUKPOSHOP_BRIDGE_HMAC_KEY").unwrap_or_default();
    if secret.is_empty() {
        return Err((
            StatusCode::SERVICE_UNAVAILABLE,
            Json(json!({"ok": false, "error": "bridge non configuré"})),
        ));
    }
    if let Err(e) = verify_hmac(body, headers, &secret) {
        warn!("[yukposhop bridge promo] HMAC reject: {e}");
        return Err((
            StatusCode::UNAUTHORIZED,
            Json(json!({"ok": false, "error": e})),
        ));
    }
    Ok(())
}

/// Pour les GET (pas de body) : on signe une chaîne vide.
fn check_hmac_get(headers: &HeaderMap) -> Result<(), (StatusCode, Json<Value>)> {
    check_hmac(headers, b"")
}

// ─── Helpers : mapping email → user_id, external_product_id → service_id ──

async fn user_id_from_email(pool: &sqlx::PgPool, email: &str) -> Option<i32> {
    sqlx::query_scalar::<_, i32>("SELECT id FROM users WHERE email = $1 LIMIT 1")
        .bind(email)
        .fetch_optional(pool)
        .await
        .ok()
        .flatten()
}

async fn service_id_from_external(pool: &sqlx::PgPool, external_id: &str) -> Option<i32> {
    sqlx::query_scalar::<_, i32>(
        "SELECT rust_service_id FROM external_product_links \
         WHERE source_app = 'yukposhop' AND external_id = $1 LIMIT 1",
    )
    .bind(external_id)
    .fetch_optional(pool)
    .await
    .ok()
    .flatten()
}

// ═════════════════════════════════════════════════════════════════════════
// 1. Loyalty — credit + balance
// ═════════════════════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
struct LoyaltyCreditIn {
    user_email: String,
    points: i32,
    #[serde(default)]
    motif: Option<String>,
    #[serde(default)]
    reference_id: Option<String>,
    #[serde(default)]
    origin: Option<String>,
}

pub async fn loyalty_credit(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    body: axum::body::Bytes,
) -> impl IntoResponse {
    if let Err(r) = check_hmac(&headers, &body) {
        return r.into_response();
    }
    let req: LoyaltyCreditIn = match serde_json::from_slice(&body) {
        Ok(r) => r,
        Err(e) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"ok": false, "error": e.to_string()})),
            )
                .into_response();
        }
    };
    let pool = &state.pg;
    let uid = match user_id_from_email(pool, &req.user_email).await {
        Some(u) => u,
        None => {
            return (
                StatusCode::OK,
                Json(json!({"ok": false, "error": "user inconnu", "skipped": true})),
            )
                .into_response();
        }
    };
    // Reference id : tente parse en i32 (numéro commande peut être string YK-...)
    let ref_int: Option<i32> = req.reference_id.as_deref().and_then(|s| s.parse().ok());
    let svc = crate::services::loyalty_service::LoyaltyService::new(pool.clone());
    let action = req.motif.unwrap_or_else(|| "yukposhop_order".into());
    let desc = req.origin.clone();
    match svc.credit(uid, req.points, &action, ref_int, desc.as_deref()).await {
        Ok(id) => {
            info!(
                "[yukposhop/loyalty] credit user={} points={} ref={:?} → entry_id={}",
                uid, req.points, req.reference_id, id
            );
            (StatusCode::OK, Json(json!({"ok": true, "entry_id": id}))).into_response()
        }
        Err(e) => {
            warn!("[yukposhop/loyalty] credit failed: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"ok": false, "error": e})),
            )
                .into_response()
        }
    }
}

#[derive(Debug, Deserialize)]
struct LoyaltyBalanceQuery {
    user_email: String,
}

pub async fn loyalty_balance(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(q): Query<LoyaltyBalanceQuery>,
) -> impl IntoResponse {
    if let Err(r) = check_hmac_get(&headers) {
        return r.into_response();
    }
    let pool = &state.pg;
    let uid = match user_id_from_email(pool, &q.user_email).await {
        Some(u) => u,
        None => {
            return (StatusCode::OK, Json(json!({"ok": true, "balance": 0}))).into_response();
        }
    };
    let svc = crate::services::loyalty_service::LoyaltyService::new(pool.clone());
    match svc.get_balance(uid).await {
        Ok(b) => (
            StatusCode::OK,
            Json(json!({"ok": true, "balance": b.balance, "earned": b.total_earned, "spent": b.total_spent})),
        )
            .into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"ok": false, "error": e})),
        )
            .into_response(),
    }
}

// ═════════════════════════════════════════════════════════════════════════
// 2. Similar products — bridge SimilarProductsService
// ═════════════════════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
struct SimilarQuery {
    external_product_id: String,
    #[serde(default = "default_similar_limit")]
    limit: i32,
}

fn default_similar_limit() -> i32 {
    6
}

pub async fn similar_products(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(q): Query<SimilarQuery>,
) -> impl IntoResponse {
    if let Err(r) = check_hmac_get(&headers) {
        return r.into_response();
    }
    let pool = &state.pg;
    let sid = match service_id_from_external(pool, &q.external_product_id).await {
        Some(s) => s,
        None => {
            return (StatusCode::OK, Json(json!({"ok": true, "items": []}))).into_response();
        }
    };
    let svc = crate::services::similar_products_service::SimilarProductsService::new(pool.clone());
    // product_index = 0 par défaut (un service Rust = 1 produit YukpoShop côté bridge Piste 1)
    match svc.find_similar_products(sid, 0, q.limit.max(1).min(20)).await {
        Ok(items) => {
            let out: Vec<Value> = items
                .into_iter()
                .map(|p| {
                    json!({
                        "id": p.service_id,
                        "titre": p.name,
                        "description": p.description,
                        "category": p.category,
                        "prix": p.price,
                        "score": p.similarity_score,
                        "distance_km": p.distance_km,
                        "url": format!("https://yukpomnang.com/services/{}", p.service_id),
                    })
                })
                .collect();
            (StatusCode::OK, Json(json!({"ok": true, "items": out}))).into_response()
        }
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"ok": false, "error": format!("{:?}", e)})),
        )
            .into_response(),
    }
}

// ═════════════════════════════════════════════════════════════════════════
// 3. Abandoned cart — insert direct dans abandoned_cart_jobs
// ═════════════════════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
struct AbandonedCartIn {
    vendeur_email: String,
    visitor_telephone: String,
    #[serde(default)]
    cart_items: Vec<Value>,
    #[serde(default)]
    total: f64,
    #[serde(default)]
    devise: Option<String>,
    #[serde(default)]
    boutique_slug: Option<String>,
}

pub async fn abandoned_cart_track(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    body: axum::body::Bytes,
) -> impl IntoResponse {
    if let Err(r) = check_hmac(&headers, &body) {
        return r.into_response();
    }
    let req: AbandonedCartIn = match serde_json::from_slice(&body) {
        Ok(r) => r,
        Err(e) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"ok": false, "error": e.to_string()})),
            )
                .into_response();
        }
    };
    let pool = &state.pg;
    let vendeur_uid = match user_id_from_email(pool, &req.vendeur_email).await {
        Some(u) => u,
        None => {
            return (
                StatusCode::OK,
                Json(json!({"ok": false, "error": "vendeur inconnu", "skipped": true})),
            )
                .into_response();
        }
    };
    // service_id : on prend le premier item du panier comme référence
    let first_external_id: Option<String> = req
        .cart_items
        .first()
        .and_then(|it| it.get("id"))
        .map(|v| v.to_string().trim_matches('"').to_string());
    let service_id: i32 = match &first_external_id {
        Some(eid) => match service_id_from_external(pool, eid).await {
            Some(s) => s,
            None => 0,
        },
        None => 0,
    };
    if service_id == 0 {
        return (
            StatusCode::OK,
            Json(json!({"ok": false, "error": "produit panier non sync Rust", "skipped": true})),
        )
            .into_response();
    }

    let devise = req.devise.unwrap_or_else(|| "XAF".into());
    let recovery_msg = format!(
        "🛒 Bonjour ! Votre panier de {:.0} {} vous attend{}. Finalisez votre commande, le vendeur garde le stock pour vous.",
        req.total,
        devise,
        req.boutique_slug
            .as_ref()
            .map(|s| format!(" sur {}.yukpomnang.com", s))
            .unwrap_or_default(),
    );
    let product_hint = req
        .cart_items
        .iter()
        .filter_map(|it| it.get("titre").and_then(|v| v.as_str()))
        .take(3)
        .collect::<Vec<_>>()
        .join(" · ");

    // Programmation : 2h après l'abandon
    let r = sqlx::query(
        "INSERT INTO abandoned_cart_jobs \
         (service_id, user_id, customer_external_id, platform, \
          product_hint, recovery_message, scheduled_at) \
         VALUES ($1, $2, $3, $4, $5, $6, NOW() + INTERVAL '2 hours') \
         RETURNING id",
    )
    .bind(service_id)
    .bind(vendeur_uid)
    .bind(&req.visitor_telephone)
    .bind("whatsapp")
    .bind(&product_hint)
    .bind(&recovery_msg)
    .fetch_one(pool)
    .await;

    match r {
        Ok(row) => {
            let id: i32 = row.get("id");
            (StatusCode::OK, Json(json!({"ok": true, "job_id": id}))).into_response()
        }
        Err(e) => {
            warn!("[yukposhop/abandoned-cart] insert failed: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"ok": false, "error": e.to_string()})),
            )
                .into_response()
        }
    }
}

// ═════════════════════════════════════════════════════════════════════════
// 4. Flash sale — wrap create_flash_promo logique (sans JWT, mapping email→user)
// ═════════════════════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
struct FlashPromoBridgeIn {
    external_product_id: String,
    vendeur_email: String,
    prix_initial: f64,
    prix_flash: f64,
    #[allow(dead_code)]
    devise: Option<String>,
    debut: DateTime<Utc>,
    fin: DateTime<Utc>,
    stock_target: i32,
}

pub async fn flash_promo_bridge(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    body: axum::body::Bytes,
) -> impl IntoResponse {
    if let Err(r) = check_hmac(&headers, &body) {
        return r.into_response();
    }
    let req: FlashPromoBridgeIn = match serde_json::from_slice(&body) {
        Ok(r) => r,
        Err(e) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"ok": false, "error": e.to_string()})),
            )
                .into_response();
        }
    };
    let pool = &state.pg;
    let service_id = match service_id_from_external(pool, &req.external_product_id).await {
        Some(s) => s,
        None => {
            return (
                StatusCode::NOT_FOUND,
                Json(json!({"ok": false, "error": "produit non synchronisé côté Rust"})),
            )
                .into_response();
        }
    };
    let user_id = match user_id_from_email(pool, &req.vendeur_email).await {
        Some(u) => u,
        None => {
            return (
                StatusCode::NOT_FOUND,
                Json(json!({"ok": false, "error": "vendeur introuvable"})),
            )
                .into_response();
        }
    };

    if req.fin <= req.debut || req.fin < Utc::now() {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({"ok": false, "error": "dates invalides"})),
        )
            .into_response();
    }
    if req.prix_flash <= 0.0 || req.prix_initial <= 0.0 || req.prix_flash >= req.prix_initial {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({"ok": false, "error": "prix_flash doit être < prix_initial"})),
        )
            .into_response();
    }
    // Calcul %réduction depuis prix_initial → prix_flash
    let discount_pct = ((req.prix_initial - req.prix_flash) / req.prix_initial * 100.0).round();

    // Vérif ownership service côté Rust
    let owner: Option<i32> =
        sqlx::query_scalar::<_, i32>("SELECT user_id FROM services WHERE id = $1")
            .bind(service_id)
            .fetch_optional(pool)
            .await
            .unwrap_or(None);
    if owner != Some(user_id) {
        return (
            StatusCode::FORBIDDEN,
            Json(json!({"ok": false, "error": "vendeur n'est pas propriétaire du service"})),
        )
            .into_response();
    }

    // Mise à jour data.promotion.flash_promos sur services
    let svc_row = sqlx::query("SELECT data FROM services WHERE id = $1")
        .bind(service_id)
        .fetch_one(pool)
        .await;
    let mut data: Value = match svc_row {
        Ok(r) => r.try_get("data").unwrap_or_else(|_| json!({})),
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"ok": false, "error": e.to_string()})),
            )
                .into_response()
        }
    };
    if data.get("promotion").is_none() {
        data["promotion"] = json!({"flash_promos": []});
    }
    let flash_id = format!("ykp_{}_{}", service_id, Utc::now().timestamp());
    let promo = json!({
        "id": flash_id.clone(),
        "service_id": service_id,
        "product_indexes": [0],
        "discount_type": "percentage",
        "discount_value": discount_pct,
        "title": format!("Vente flash YukpoShop -{}%", discount_pct),
        "description": format!("Prix flash : {} (au lieu de {})", req.prix_flash, req.prix_initial),
        "starts_at": req.debut.to_rfc3339(),
        "ends_at": req.fin.to_rfc3339(),
        "availability": "online",
        "stock_cap": req.stock_target,
        "is_active": true,
        "created_at": Utc::now().to_rfc3339(),
        "origin": "yukposhop",
    });
    if let Some(promotion) = data.get_mut("promotion") {
        if let Some(arr) = promotion.get_mut("flash_promos").and_then(|v| v.as_array_mut()) {
            arr.push(promo.clone());
        } else {
            promotion["flash_promos"] = json!([promo.clone()]);
        }
    }
    let _ = sqlx::query("UPDATE services SET data = $1 WHERE id = $2")
        .bind(&data)
        .bind(service_id)
        .execute(pool)
        .await;

    info!(
        "[yukposhop/flash] flash sale créée service={} discount={}%",
        service_id, discount_pct
    );
    (
        StatusCode::OK,
        Json(json!({"ok": true, "flash_sale_id": flash_id, "discount_pct": discount_pct})),
    )
        .into_response()
}

// ═════════════════════════════════════════════════════════════════════════
// 5. Global promos — list catalog + join
// ═════════════════════════════════════════════════════════════════════════

pub async fn global_promos_catalog(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> impl IntoResponse {
    if let Err(r) = check_hmac_get(&headers) {
        return r.into_response();
    }
    let pool = &state.pg;
    let rows = sqlx::query(
        "SELECT id::text AS id, slug, display_name, description, starts_at, ends_at, status \
         FROM global_promo_events \
         WHERE status IN ('scheduled', 'live') AND ends_at > NOW() \
         ORDER BY starts_at ASC LIMIT 50",
    )
    .fetch_all(pool)
    .await;
    match rows {
        Ok(rs) => {
            let items: Vec<Value> = rs
                .into_iter()
                .map(|r| {
                    json!({
                        "id": r.try_get::<String, _>("id").ok(),
                        "slug": r.try_get::<String, _>("slug").ok(),
                        "nom": r.try_get::<String, _>("display_name").ok(),
                        "description": r.try_get::<String, _>("description").ok(),
                        "debut": r.try_get::<DateTime<Utc>, _>("starts_at").ok().map(|d| d.to_rfc3339()),
                        "fin": r.try_get::<DateTime<Utc>, _>("ends_at").ok().map(|d| d.to_rfc3339()),
                        "statut": r.try_get::<String, _>("status").ok(),
                    })
                })
                .collect();
            (StatusCode::OK, Json(json!({"ok": true, "items": items}))).into_response()
        }
        Err(_) => (StatusCode::OK, Json(json!({"ok": true, "items": []}))).into_response(),
    }
}

#[derive(Debug, Deserialize)]
struct JoinGlobalPromoIn {
    external_product_ids: Vec<String>,
    vendeur_email: String,
    reduction_pct: i32,
    #[serde(default)]
    origin: Option<String>,
}

pub async fn global_promos_join(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(event_id): Path<String>,
    body: axum::body::Bytes,
) -> impl IntoResponse {
    if let Err(r) = check_hmac(&headers, &body) {
        return r.into_response();
    }
    let req: JoinGlobalPromoIn = match serde_json::from_slice(&body) {
        Ok(r) => r,
        Err(e) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"ok": false, "error": e.to_string()})),
            )
                .into_response();
        }
    };
    let pool = &state.pg;
    let user_id = match user_id_from_email(pool, &req.vendeur_email).await {
        Some(u) => u,
        None => {
            return (
                StatusCode::NOT_FOUND,
                Json(json!({"ok": false, "error": "vendeur introuvable"})),
            )
                .into_response()
        }
    };

    let mut inscrits = 0i32;
    let pct = req.reduction_pct as f64;
    for eid in req.external_product_ids.iter() {
        if let Some(sid) = service_id_from_external(pool, eid).await {
            let r = sqlx::query(
                "INSERT INTO global_promo_entries \
                 (event_id, service_id, submitted_by_user_id, discount_percentage, \
                  availability, status, metadata) \
                 VALUES ($1::uuid, $2, $3, $4, 'online', 'pending_review', \
                         jsonb_build_object('source_app','yukposhop','origin',$5::text)) \
                 ON CONFLICT (event_id, service_id) \
                 DO UPDATE SET discount_percentage = $4, updated_at = NOW()",
            )
            .bind(&event_id)
            .bind(sid)
            .bind(user_id)
            .bind(pct)
            .bind(req.origin.clone().unwrap_or_default())
            .execute(pool)
            .await;
            if r.is_ok() {
                inscrits += 1;
            }
        }
    }
    info!(
        "[yukposhop/global-promo] event={} produits_inscrits={}",
        event_id, inscrits
    );
    (
        StatusCode::OK,
        Json(json!({"ok": true, "event_id": event_id, "produits_inscrits": inscrits})),
    )
        .into_response()
}

// ═════════════════════════════════════════════════════════════════════════
// Router
// ═════════════════════════════════════════════════════════════════════════

pub fn integrations_yukposhop_promo_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .route(
            "/api/v1/integrations/yukposhop/loyalty/credit",
            post(loyalty_credit),
        )
        .route(
            "/api/v1/integrations/yukposhop/loyalty/balance",
            get(loyalty_balance),
        )
        .route(
            "/api/v1/integrations/yukposhop/similar",
            get(similar_products),
        )
        .route(
            "/api/v1/integrations/yukposhop/abandoned-carts/track",
            post(abandoned_cart_track),
        )
        .route(
            "/api/v1/integrations/yukposhop/flash-promos",
            post(flash_promo_bridge),
        )
        .route(
            "/api/v1/integrations/yukposhop/global-promos/catalog",
            get(global_promos_catalog),
        )
        .route(
            "/api/v1/integrations/yukposhop/global-promos/events/{event_id}/entries",
            post(global_promos_join),
        )
        .with_state(state)
}
