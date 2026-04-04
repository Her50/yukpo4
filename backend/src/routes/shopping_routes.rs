use std::sync::Arc;

use axum::{
    extract::{Extension, Path, State},
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use uuid::Uuid;

use crate::{
    core::types::{AppError, AppResult},
    middlewares::jwt::{jwt_auth, AuthenticatedUser},
    models::delivery_model::{ParcelRejectionReason, ShoppingItemStatus, ShoppingStatus},
    services::delivery_service::{
        CreateShoppingOrderParams, DeliveryRecipientInput, LocationInput, ShoppingBasketItemInput,
        ShoppingCheckoutInput, ShoppingEstimateInput, ShoppingItemUpdateInput,
        ShoppingStatusUpdateInput, ShoppingStoreInput,
    },
    state::AppState,
};

pub fn shopping_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .route("/shopping/orders/estimate", post(estimate_shopping_order))
        .route("/shopping/orders", post(create_shopping_order))
        .route(
            "/shopping/orders/{order_id}/items/{item_id}",
            post(update_shopping_item),
        )
        .route(
            "/shopping/orders/{order_id}/status",
            post(update_shopping_status),
        )
        .route(
            "/shopping/orders/{order_id}/checkout",
            post(submit_shopping_checkout),
        )
        .route("/shopping/wallet/balance", get(get_wallet_balance))
        .route(
            "/shopping/wallet/transactions",
            get(get_wallet_transactions),
        )
        .route(
            "/shopping/wallet/financial-summary",
            get(get_wallet_financial_summary),
        )
        .layer(axum::middleware::from_fn(jwt_auth))
        .with_state(state)
}

#[derive(Debug, Deserialize)]
struct ShoppingEstimatePayload {
    items: Vec<ShoppingItemPayload>,
    #[serde(default = "default_currency")]
    currency: String,
}

#[derive(Debug, Deserialize)]
struct ShoppingItemPayload {
    #[serde(rename = "product_id")]
    product_id: Option<Uuid>,
    #[serde(rename = "product_name")]
    product_name: String,
    #[serde(default)]
    characteristics: Value,
    quantity: f64,
    #[serde(default = "default_unit")]
    unit: String,
    #[serde(rename = "estimated_price_cents")]
    estimated_price_cents: Option<i32>,
}

#[derive(Debug, Deserialize)]
struct StorePayload {
    name: Option<String>,
    latitude: f64,
    longitude: f64,
    address: Option<String>,
}

#[derive(Debug, Deserialize)]
struct CreateShoppingPayload {
    items: Vec<ShoppingItemPayload>,
    store: StorePayload,
    dropoff: LocationPayload,
    #[serde(default)]
    recipient: Option<RecipientPayload>,
    #[serde(default)]
    notes: Option<String>,
    #[serde(default = "default_currency")]
    currency: String,
    #[serde(default)]
    metadata: Value,
    estimated_total_cents: i32,
    delivery_base_price_cents: i32,
    delivery_distance_price_cents: i32,
    delivery_surcharge_cents: i32,
    delivery_discount_cents: i32,
    #[serde(default)]
    delivery_details: Value,
    #[serde(default)]
    distance_meters: Option<i32>,
    #[serde(default)]
    estimated_duration_seconds: Option<i32>,
}

#[derive(Debug, Deserialize)]
struct RecipientPayload {
    #[serde(default)]
    user_id: Option<i32>,
    #[serde(default)]
    contact_name: Option<String>,
    #[serde(default)]
    contact_phone: Option<String>,
    #[serde(default)]
    notes: Option<String>,
    #[serde(default)]
    chat_thread_id: Option<Uuid>,
    #[serde(default)]
    dropoff_override: Option<LocationPayload>,
    #[serde(default)]
    dropoff_address: Option<String>,
    #[serde(default)]
    country_code: Option<String>,
    #[serde(default)]
    allow_tracking: Option<bool>,
    #[serde(default)]
    allow_contact: Option<bool>,
    #[serde(default)]
    consent_granted: Option<bool>,
    #[serde(default)]
    preferred_language: Option<String>,
}

#[derive(Debug, Deserialize)]
struct LocationPayload {
    latitude: f64,
    longitude: f64,
    address: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ShoppingItemUpdatePayload {
    status: String,
    #[serde(default)]
    actual_price_cents: Option<i32>,
    // ✅ Phase 9 - Amélioration : Raison de refus du produit
    #[serde(default)]
    rejection_reason: Option<String>,
    #[serde(default)]
    metadata: Option<Value>,
}

#[derive(Debug, Deserialize)]
struct ShoppingStatusPayload {
    status: String,
}

#[derive(Debug, Deserialize)]
struct ShoppingCheckoutPayload {
    actual_total_cents: i32,
    #[serde(default)]
    payload: Option<Value>,
}

#[derive(Debug, Serialize)]
struct ShoppingEstimateResponse {
    estimate: crate::services::delivery_repository::ShoppingEstimateResult,
}

#[allow(dead_code)]
#[derive(Debug, Serialize)]
struct ShoppingOrderResponse {
    delivery: crate::models::delivery_model::DeliverySummary,
    shopping_order: crate::models::delivery_model::ShoppingOrder,
    items: Vec<crate::models::delivery_model::ShoppingOrderItem>,
    estimated_total_cents: i32,
    margin_cents: i32,
    balance_remaining: i64,
}

async fn estimate_shopping_order(
    State(state): State<Arc<AppState>>,
    Extension(_user): Extension<AuthenticatedUser>,
    Json(payload): Json<ShoppingEstimatePayload>,
) -> AppResult<Json<ShoppingEstimateResponse>> {
    let service = state.delivery_service.clone();
    let result = service
        .estimate_shopping_order(ShoppingEstimateInput {
            items: payload.items.into_iter().map(ShoppingBasketItemInput::from).collect(),
            currency: payload.currency,
        })
        .await?;

    Ok(Json(ShoppingEstimateResponse { estimate: result }))
}

async fn create_shopping_order(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(payload): Json<CreateShoppingPayload>,
) -> AppResult<Json<Value>> {
    // ✅ Calculer l'assurance livraison avant création de la commande
    let product_cents = payload.estimated_total_cents;
    let delivery_cents = payload.delivery_base_price_cents
        + payload.delivery_distance_price_cents
        + payload.delivery_surcharge_cents
        - payload.delivery_discount_cents.max(0);

    let insurance_fee_cents: i64 = sqlx::query_scalar::<_, f64>(
        "SELECT LEAST(base_fee_fcfa + percentage_rate / 100.0 * $1, max_fee_fcfa) FROM delivery_insurance_fees WHERE engine_type = 'scooter' LIMIT 1",
    )
    .bind(product_cents as f64 / 100.0)
    .fetch_optional(&state.pg)
    .await
    .ok()
    .flatten()
    .map(|f| (f * 100.0).round() as i64)
    .unwrap_or(0);

    let service = state.delivery_service.clone();
    let result = service
        .create_shopping_order(CreateShoppingOrderParams {
            creator_id: user.id,
            items: payload.items.into_iter().map(ShoppingBasketItemInput::from).collect(),
            store: ShoppingStoreInput {
                name: payload.store.name,
                latitude: payload.store.latitude,
                longitude: payload.store.longitude,
                address: payload.store.address,
            },
            dropoff: payload.dropoff.into(),
            recipient: payload.recipient.as_ref().map(DeliveryRecipientInput::from),
            estimated_total_cents: payload.estimated_total_cents,
            currency: payload.currency,
            delivery_base_price_cents: payload.delivery_base_price_cents,
            delivery_distance_price_cents: payload.delivery_distance_price_cents,
            delivery_surcharge_cents: payload.delivery_surcharge_cents,
            delivery_discount_cents: payload.delivery_discount_cents,
            delivery_details: if payload.delivery_details.is_null() {
                Value::Object(Default::default())
            } else {
                payload.delivery_details
            },
            distance_meters: payload.distance_meters,
            estimated_duration_seconds: payload.estimated_duration_seconds,
            notes: payload.notes,
            metadata: payload.metadata,
        })
        .await?;

    // ✅ Débiter l'assurance séparément (va dans le compte Yukpo — reversé si sinistre)
    if insurance_fee_cents > 0 {
        let balance_before: i64 = sqlx::query_scalar(
            "SELECT COALESCE(balance_cents, 0) FROM user_wallets WHERE user_id = $1 AND currency = 'XAF'",
        )
        .bind(user.id)
        .fetch_optional(&state.pg)
        .await
        .ok()
        .flatten()
        .unwrap_or(0);

        if balance_before >= insurance_fee_cents {
            let _ = sqlx::query(
                "UPDATE user_wallets SET balance_cents = balance_cents - $1, updated_at = NOW() WHERE user_id = $2 AND currency = 'XAF'",
            )
            .bind(insurance_fee_cents)
            .bind(user.id)
            .execute(&state.pg)
            .await;

            let order_id = result.shopping_order.id.to_string();

            let _ = sqlx::query(
                r#"INSERT INTO wallet_transactions (
                    user_id, transaction_type, direction, amount_cents,
                    balance_before_cents, balance_after_cents,
                    currency, reference_type, reference_id, description, created_at
                ) VALUES ($1, 'insurance_debit', 'debit', $2, $3, $4,
                          'XAF', 'shopping_order', $5, $6, NOW())"#,
            )
            .bind(user.id)
            .bind(insurance_fee_cents)
            .bind(balance_before)
            .bind(balance_before - insurance_fee_cents)
            .bind(&order_id)
            .bind(format!(
                "Assurance livraison commande shopping ({}F)",
                insurance_fee_cents / 100
            ))
            .execute(&state.pg)
            .await;
        }
    }

    Ok(Json(json!({
        "delivery": result.delivery,
        "shopping_order": result.shopping_order,
        "items": result.items,
        // ✅ Détail des frais visible par l'utilisateur avant/après validation
        "breakdown": {
            "produits_cents": product_cents,
            "frais_livraison_cents": delivery_cents.max(0),
            "assurance_cents": insurance_fee_cents,
            "total_cents": product_cents as i64 + delivery_cents.max(0) as i64 + insurance_fee_cents
        },
        "estimated_total_cents": result.estimated_total_cents,
        "margin_cents": result.margin_cents,
        "balance_remaining": result.balance_remaining,
    })))
}

async fn get_wallet_balance(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
) -> AppResult<Json<Value>> {
    let service = state.delivery_service.clone();
    let balance = service.get_wallet_balance(user.id).await?;
    Ok(Json(json!({ "balance": balance })))
}

#[derive(Debug, Deserialize)]
struct WalletTransactionsQuery {
    limit: Option<i64>,
    offset: Option<i64>,
    #[serde(rename = "type")]
    transaction_type: Option<String>,
}

/// ✅ Historique des transactions wallet (crédit, débit, remboursement, reversement)
async fn get_wallet_transactions(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    axum::extract::Query(query): axum::extract::Query<WalletTransactionsQuery>,
) -> AppResult<Json<Value>> {
    let limit = query.limit.unwrap_or(50).min(200);
    let offset = query.offset.unwrap_or(0);

    let transactions = if let Some(ref txn_type) = query.transaction_type {
        sqlx::query_as::<
            _,
            (
                i64,
                i32,
                String,
                i64,
                i64,
                i64,
                String,
                Option<String>,
                Option<String>,
                Option<uuid::Uuid>,
                Option<String>,
                chrono::DateTime<chrono::Utc>,
            ),
        >(
            r#"
            SELECT id, user_id, transaction_type, amount_cents,
                   balance_before_cents, balance_after_cents, currency,
                   reference_type, reference_id, delivery_id, description,
                   created_at
            FROM wallet_transactions
            WHERE user_id = $1 AND transaction_type = $2
            ORDER BY created_at DESC
            LIMIT $3 OFFSET $4
            "#,
        )
        .bind(user.id)
        .bind(txn_type)
        .bind(limit)
        .bind(offset)
        .fetch_all(&state.pg)
        .await
        .unwrap_or_default()
    } else {
        sqlx::query_as::<
            _,
            (
                i64,
                i32,
                String,
                i64,
                i64,
                i64,
                String,
                Option<String>,
                Option<String>,
                Option<uuid::Uuid>,
                Option<String>,
                chrono::DateTime<chrono::Utc>,
            ),
        >(
            r#"
            SELECT id, user_id, transaction_type, amount_cents,
                   balance_before_cents, balance_after_cents, currency,
                   reference_type, reference_id, delivery_id, description,
                   created_at
            FROM wallet_transactions
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT $2 OFFSET $3
            "#,
        )
        .bind(user.id)
        .bind(limit)
        .bind(offset)
        .fetch_all(&state.pg)
        .await
        .unwrap_or_default()
    };

    let txn_json: Vec<Value> = transactions
        .iter()
        .map(|t| {
            json!({
                "id": t.0,
                "user_id": t.1,
                "transaction_type": t.2,
                "amount_cents": t.3,
                "balance_before_cents": t.4,
                "balance_after_cents": t.5,
                "currency": t.6,
                "reference_type": t.7,
                "reference_id": t.8,
                "delivery_id": t.9,
                "description": t.10,
                "created_at": t.11.to_rfc3339(),
            })
        })
        .collect();

    // Solde actuel
    let balance: i64 = sqlx::query_scalar::<_, Option<i64>>(
        "SELECT balance_cents FROM user_wallets WHERE user_id = $1 AND currency = 'XAF'",
    )
    .bind(user.id)
    .fetch_optional(&state.pg)
    .await
    .unwrap_or(None)
    .flatten()
    .unwrap_or(0);

    Ok(Json(json!({
        "success": true,
        "balance_cents": balance,
        "transactions": txn_json,
        "count": txn_json.len(),
        "limit": limit,
        "offset": offset,
    })))
}

/// ✅ Résumé financier avec analytics périodiques (7j, 30j, 90j)
async fn get_wallet_financial_summary(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    axum::extract::Query(query): axum::extract::Query<std::collections::HashMap<String, String>>,
) -> AppResult<Json<Value>> {
    let days: i32 = query.get("days").and_then(|d| d.parse().ok()).unwrap_or(30);

    // Solde actuel
    let balance: i64 = sqlx::query_scalar::<_, Option<i64>>(
        "SELECT balance_cents FROM user_wallets WHERE user_id = $1 AND currency = 'XAF'",
    )
    .bind(user.id)
    .fetch_optional(&state.pg)
    .await
    .unwrap_or(None)
    .flatten()
    .unwrap_or(0);

    // Total crédits (revenus) sur la période
    let total_credits: i64 = sqlx::query_scalar::<_, Option<i64>>(
        r#"
        SELECT COALESCE(SUM(amount_cents), 0)
        FROM wallet_transactions
        WHERE user_id = $1 AND transaction_type LIKE 'credit%'
        AND created_at >= NOW() - make_interval(days => $2)
        "#,
    )
    .bind(user.id)
    .bind(days)
    .fetch_one(&state.pg)
    .await
    .unwrap_or(Some(0))
    .unwrap_or(0);

    // Total débits sur la période
    let total_debits: i64 = sqlx::query_scalar::<_, Option<i64>>(
        r#"
        SELECT COALESCE(SUM(amount_cents), 0)
        FROM wallet_transactions
        WHERE user_id = $1 AND transaction_type LIKE 'debit%'
        AND created_at >= NOW() - make_interval(days => $2)
        "#,
    )
    .bind(user.id)
    .bind(days)
    .fetch_one(&state.pg)
    .await
    .unwrap_or(Some(0))
    .unwrap_or(0);

    // Total remboursements sur la période
    let total_refunds: i64 = sqlx::query_scalar::<_, Option<i64>>(
        r#"
        SELECT COALESCE(SUM(amount_cents), 0)
        FROM wallet_transactions
        WHERE user_id = $1 AND transaction_type LIKE 'refund%'
        AND created_at >= NOW() - make_interval(days => $2)
        "#,
    )
    .bind(user.id)
    .bind(days)
    .fetch_one(&state.pg)
    .await
    .unwrap_or(Some(0))
    .unwrap_or(0);

    // Nombre de transactions sur la période
    let transaction_count: i64 = sqlx::query_scalar::<_, Option<i64>>(
        r#"
        SELECT COUNT(*)
        FROM wallet_transactions
        WHERE user_id = $1
        AND created_at >= NOW() - make_interval(days => $2)
        "#,
    )
    .bind(user.id)
    .bind(days)
    .fetch_one(&state.pg)
    .await
    .unwrap_or(Some(0))
    .unwrap_or(0);

    // Revenus par jour (pour graphique)
    let daily_revenue = sqlx::query_as::<_, (chrono::NaiveDate, i64)>(
        r#"
        SELECT DATE(created_at) as day, COALESCE(SUM(amount_cents), 0) as total
        FROM wallet_transactions
        WHERE user_id = $1 AND transaction_type LIKE 'credit%'
        AND created_at >= NOW() - make_interval(days => $2)
        GROUP BY DATE(created_at)
        ORDER BY day ASC
        "#,
    )
    .bind(user.id)
    .bind(days)
    .fetch_all(&state.pg)
    .await
    .unwrap_or_default();

    let daily_revenue_json: Vec<Value> = daily_revenue
        .iter()
        .map(|(day, total)| json!({ "date": day.to_string(), "amount_cents": total }))
        .collect();

    // Disbursements (transferts sortants)
    let disbursements_count: i64 = sqlx::query_scalar::<_, Option<i64>>(
        r#"
        SELECT COUNT(*)
        FROM disbursement_requests
        WHERE recipient_user_id = $1
        AND created_at >= NOW() - make_interval(days => $2)
        "#,
    )
    .bind(user.id)
    .bind(days)
    .fetch_one(&state.pg)
    .await
    .unwrap_or(Some(0))
    .unwrap_or(0);

    let disbursements_total: i64 = sqlx::query_scalar::<_, Option<i64>>(
        r#"
        SELECT COALESCE(SUM(amount_cents), 0)
        FROM disbursement_requests
        WHERE recipient_user_id = $1 AND status = 'completed'
        AND created_at >= NOW() - make_interval(days => $2)
        "#,
    )
    .bind(user.id)
    .bind(days)
    .fetch_one(&state.pg)
    .await
    .unwrap_or(Some(0))
    .unwrap_or(0);

    // Période précédente pour comparaison (croissance)
    let prev_credits: i64 = sqlx::query_scalar::<_, Option<i64>>(
        r#"
        SELECT COALESCE(SUM(amount_cents), 0)
        FROM wallet_transactions
        WHERE user_id = $1 AND transaction_type LIKE 'credit%'
        AND created_at >= NOW() - make_interval(days => $2 * 2)
        AND created_at < NOW() - make_interval(days => $2)
        "#,
    )
    .bind(user.id)
    .bind(days)
    .fetch_one(&state.pg)
    .await
    .unwrap_or(Some(0))
    .unwrap_or(0);

    let growth_pct = if prev_credits > 0 {
        ((total_credits - prev_credits) as f64 / prev_credits as f64) * 100.0
    } else if total_credits > 0 {
        100.0
    } else {
        0.0
    };

    Ok(Json(json!({
        "success": true,
        "period_days": days,
        "balance_cents": balance,
        "summary": {
            "total_credits_cents": total_credits,
            "total_debits_cents": total_debits,
            "total_refunds_cents": total_refunds,
            "net_income_cents": total_credits - total_debits,
            "transaction_count": transaction_count,
            "growth_percent": (growth_pct * 10.0).round() / 10.0,
        },
        "disbursements": {
            "count": disbursements_count,
            "total_completed_cents": disbursements_total,
        },
        "daily_revenue": daily_revenue_json,
    })))
}

async fn update_shopping_item(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path((order_id, item_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<ShoppingItemUpdatePayload>,
) -> AppResult<Json<Value>> {
    let service = state.delivery_service.clone();
    let status = serde_json::from_str::<ShoppingItemStatus>(&format!("\"{}\"", payload.status))
        .map_err(|_| AppError::BadRequest("Statut article invalide".into()))?;

    // ✅ Phase 9 - Amélioration : Parser la raison de refus si fournie
    let rejection_reason = if let Some(reason_str) = payload.rejection_reason {
        if status == ShoppingItemStatus::Rejected {
            Some(
                serde_json::from_str::<ParcelRejectionReason>(&format!("\"{}\"", reason_str))
                    .map_err(|_| AppError::BadRequest("Raison de refus invalide".into()))?,
            )
        } else {
            None
        }
    } else {
        None
    };

    service
        .update_shopping_item(
            user.id,
            ShoppingItemUpdateInput {
                order_id,
                item_id,
                status,
                actual_price_cents: payload.actual_price_cents,
                rejection_reason,
                metadata: payload.metadata,
            },
        )
        .await?;

    Ok(Json(json!({ "status": "ok" })))
}

async fn update_shopping_status(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(order_id): Path<Uuid>,
    Json(payload): Json<ShoppingStatusPayload>,
) -> AppResult<Json<Value>> {
    let service = state.delivery_service.clone();
    let status = serde_json::from_str::<ShoppingStatus>(&format!("\"{}\"", payload.status))
        .map_err(|_| AppError::BadRequest("Statut commande invalide".into()))?;

    service
        .update_shopping_status(user.id, ShoppingStatusUpdateInput { order_id, status })
        .await?;

    Ok(Json(json!({ "status": "ok" })))
}

async fn submit_shopping_checkout(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(order_id): Path<Uuid>,
    Json(payload): Json<ShoppingCheckoutPayload>,
) -> AppResult<Json<Value>> {
    let service = state.delivery_service.clone();
    let pricing = service
        .submit_shopping_checkout(
            user.id,
            ShoppingCheckoutInput {
                order_id,
                actual_total_cents: payload.actual_total_cents,
                payload: payload.payload,
            },
        )
        .await?;

    Ok(Json(json!({
        "status": "ok",
        "pricing": {
            "base_price_cents": pricing.base_price_cents,
            "distance_price_cents": pricing.distance_price_cents,
            "surcharge_cents": pricing.surcharge_cents,
            "discount_cents": pricing.discount_cents,
            "shopping_cost_cents": pricing.shopping_cost_cents,
            "shopping_discount_cents": pricing.shopping_discount_cents,
            "currency": pricing.currency
        }
    })))
}

fn default_unit() -> String {
    "unite".to_string()
}

fn default_currency() -> String {
    "XAF".to_string()
}

impl From<ShoppingItemPayload> for ShoppingBasketItemInput {
    fn from(value: ShoppingItemPayload) -> Self {
        ShoppingBasketItemInput {
            product_id: value.product_id,
            product_name: value.product_name,
            characteristics: if value.characteristics.is_null() {
                Value::Array(vec![])
            } else {
                value.characteristics
            },
            quantity: value.quantity,
            unit: value.unit,
            estimated_price_cents: value.estimated_price_cents,
        }
    }
}

impl From<LocationPayload> for LocationInput {
    fn from(value: LocationPayload) -> Self {
        LocationInput {
            latitude: value.latitude,
            longitude: value.longitude,
            address: value.address,
        }
    }
}

impl From<&RecipientPayload> for DeliveryRecipientInput {
    fn from(value: &RecipientPayload) -> Self {
        DeliveryRecipientInput {
            user_id: value.user_id,
            contact_name: value.contact_name.clone(),
            contact_phone: value.contact_phone.clone(),
            notes: value.notes.clone(),
            chat_thread_id: value.chat_thread_id,
            dropoff_override: value.dropoff_override.as_ref().map(|loc| LocationInput {
                latitude: loc.latitude,
                longitude: loc.longitude,
                address: loc.address.clone(),
            }),
            dropoff_address: value.dropoff_address.clone(),
            country_code: value.country_code.clone(),
            allow_tracking: value.allow_tracking,
            allow_contact: value.allow_contact,
            consent_granted: value.consent_granted,
            preferred_language: value.preferred_language.clone(),
        }
    }
}
