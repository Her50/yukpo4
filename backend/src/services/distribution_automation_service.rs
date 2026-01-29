use std::sync::Arc;

use chrono::Utc;
use log::{error, info, warn};
use serde_json::{json, Value};
use sqlx::FromRow;
use tokio::time::{sleep, Duration};

#[derive(FromRow)]
struct MediaServiceContextRow {
    path: String,
    ai_description: Option<String>,
    ai_tags: Option<Vec<String>>,
    ai_metadata: Option<Value>,
    #[sqlx(rename = "service_data")]
    service_data: Value,
}

use crate::{
    core::types::{AppError, AppResult},
    services::{
        commerce_connector_service::ProductConnectorSnapshot,
        social_connector_service::{self, SocialAccountRecord},
        video_analytics_service,
    },
    state::AppState,
};

#[derive(Debug, Clone)]
struct DistributionContext {
    media_path: String,
    ai_description: Option<String>,
    ai_tags: Vec<String>,
    ai_metadata: Value,
    service_snapshot: Value,
    product_snapshot: Option<ProductConnectorSnapshot>,
}

pub async fn automate_media_distribution(
    state: Arc<AppState>,
    user_id: i32,
    service_id: i32,
    product_index: i32,
    media_id: i32,
    snapshot: Option<ProductConnectorSnapshot>,
    targets: &[String],
) -> AppResult<()> {
    if targets.is_empty() {
        return Ok(());
    }

    let connectors =
        social_connector_service::list_accounts_for_platforms(state.clone(), user_id, targets)
            .await?;

    let context =
        fetch_distribution_context(state.clone(), media_id, service_id, product_index, snapshot)
            .await?;

    for target in targets {
        let target_normalized = target.to_lowercase();
        let metadata_base = json!({
            "automation": "auto_router_v1",
            "requested_at": Utc::now(),
            "target": target,
            "service_snapshot": context.service_snapshot,
            "product_snapshot": context.product_snapshot
                .as_ref()
                .map(product_snapshot_summary),
        });

        if let Some(account) = connectors.get(&target_normalized) {
            mark_distribution_processing(&state, media_id, target, Some(&account), &metadata_base)
                .await?;

            let state_clone = state.clone();
            let target_clone = target.clone();
            let account_clone = account.clone();
            let context_clone = context.clone();

            tokio::spawn(async move {
                if let Err(err) = dispatch_social_publication(
                    state_clone,
                    media_id,
                    service_id,
                    target_clone,
                    account_clone,
                    context_clone,
                )
                .await
                {
                    error!(
                        "[DistributionAutomation] Publication automatique échouée: {:?}",
                        err
                    );
                }
            });
        } else {
            // ✅ AMÉLIORATION: Message plus informatif selon le type de cible
            let message = if target == "product" || target == "chat" {
                format!(
                    "[DistributionAutomation] ⚠️ Aucun connecteur configuré pour cible '{}' (user={}). \
                    Cette cible nécessite une configuration spécifique. La distribution sera mise en attente.",
                    target, user_id
                )
            } else {
                format!(
                    "[DistributionAutomation] ⚠️ Aucun connecteur pour cible '{}' (user={}). \
                    L'utilisateur doit configurer un connecteur pour cette plateforme.",
                    target, user_id
                )
            };
            warn!("{}", message);

            update_missing_connector(
                &state,
                media_id,
                target,
                &metadata_base,
                context.product_snapshot.as_ref(),
            )
            .await?;
        }
    }

    Ok(())
}

async fn fetch_distribution_context(
    state: Arc<AppState>,
    media_id: i32,
    service_id: i32,
    product_index: i32,
    provided_snapshot: Option<ProductConnectorSnapshot>,
) -> AppResult<DistributionContext> {
    let row: MediaServiceContextRow = sqlx::query_as(
        r#"
        SELECT
            m.path,
            m.ai_description,
            m.ai_tags,
            m.ai_metadata,
            s.data AS service_data
        FROM media m
        JOIN services s ON s.id = m.service_id
        WHERE m.id = $1
          AND s.id = $2
        "#,
    )
    .bind(media_id)
    .bind(service_id)
    .fetch_one(&state.pg)
    .await
    .map_err(|err| {
        error!(
            "[DistributionAutomation] Impossible de récupérer le contexte média {}: {:?}",
            media_id, err
        );
        AppError::from(err)
    })?;

    let ai_tags = row
        .ai_tags
        .map(|tags: Vec<String>| {
            tags.into_iter()
                .filter(|tag| !tag.trim().is_empty())
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    let ai_metadata = row
        .ai_metadata
        .unwrap_or_else(|| Value::Object(Default::default()));

    let service_snapshot = build_service_snapshot(&row.service_data);

    let product_snapshot = match provided_snapshot {
        Some(snapshot) => Some(snapshot),
        None => state
            .commerce_connector
            .snapshot_by_index(service_id, product_index)
            .await
            .ok(),
    };

    Ok(DistributionContext {
        media_path: row.path,
        ai_description: row.ai_description,
        ai_tags,
        ai_metadata,
        service_snapshot,
        product_snapshot,
    })
}

fn build_service_snapshot(service_data: &Value) -> Value {
    let produits = extract_products_array(service_data);

    let total_products = produits.len();
    let products_in_stock = produits
        .iter()
        .filter(|item| {
            item.get("stock")
                .and_then(|stock| stock.as_i64())
                .unwrap_or(0)
                > 0
        })
        .count();
    let has_promo = produits.iter().any(|item| {
        item.get("promotion_active")
            .and_then(|value| value.as_bool())
            .unwrap_or(false)
    });

    let deliveries = service_data
        .get("delivery")
        .and_then(|value| value.as_object())
        .cloned()
        .unwrap_or_default();

    json!({
        "products_total": total_products,
        "products_in_stock": products_in_stock,
        "has_promotion": has_promo,
        "delivery": deliveries,
    })
}

fn extract_products_array(service_data: &Value) -> Vec<Value> {
    if let Some(node) = service_data.get("produits") {
        if let Some(array) = node.get("valeur").and_then(|value| value.as_array()) {
            return array.to_vec();
        }
        if let Some(array) = node.as_array() {
            return array.to_vec();
        }
    }
    vec![]
}

async fn mark_distribution_processing(
    state: &Arc<AppState>,
    media_id: i32,
    target: &str,
    account: Option<&SocialAccountRecord>,
    metadata_base: &Value,
) -> AppResult<()> {
    let mut merged = metadata_base.clone();
    if let Some(acc) = account {
        if let Some(obj) = merged.as_object_mut() {
            obj.insert(
                "connector".to_string(),
                json!({
                    "platform": acc.platform,
                    "account_handle": acc.account_handle,
                    "connector_scope": acc.scope,
                    "token_expiration": acc.expires_at,
                }),
            );
        }
    }

    sqlx::query(
        r#"
        UPDATE media_distribution
        SET status = 'processing',
            metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb,
            updated_at = NOW()
        WHERE media_id = $2
          AND target = $3
        "#,
    )
    .bind(merged)
    .bind(media_id)
    .bind(target)
    .execute(&state.pg)
    .await
    .map_err(AppError::from)?;

    Ok(())
}

async fn update_missing_connector(
    state: &Arc<AppState>,
    media_id: i32,
    target: &str,
    metadata: &Value,
    product_snapshot: Option<&ProductConnectorSnapshot>,
) -> AppResult<()> {
    let payload = json!({
        "missing_connector": true,
        "details": metadata,
        "product_snapshot": product_snapshot.map(product_snapshot_summary),
    });

    sqlx::query(
        r#"
        UPDATE media_distribution
        SET status = 'waiting_connector',
            metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb,
            updated_at = NOW()
        WHERE media_id = $2
          AND target = $3
        "#,
    )
    .bind(payload)
    .bind(media_id)
    .bind(target)
    .execute(&state.pg)
    .await
    .map_err(AppError::from)?;

    Ok(())
}

async fn dispatch_social_publication(
    state: Arc<AppState>,
    media_id: i32,
    service_id: i32,
    target: String,
    account: SocialAccountRecord,
    context: DistributionContext,
) -> AppResult<()> {
    // Simulation d'appel API (placeholder en attendant intégration direct API)
    info!(
        "[DistributionAutomation] Publication {} pour media={} via compte {:?}",
        target, media_id, account.account_handle
    );

    // Delay simulant le temps d'appel réseau/GPU
    sleep(Duration::from_secs(2)).await;

    let payload = json!({
        "platform": account.platform,
        "account_handle": account.account_handle,
        "service_id": service_id,
        "media_path": context.media_path,
        "ai_description": context.ai_description,
        "ai_tags": context.ai_tags,
        "ai_metadata": context.ai_metadata,
        "service_snapshot": context.service_snapshot,
        "product_snapshot": context
            .product_snapshot
            .as_ref()
            .map(product_snapshot_summary),
    });

    video_analytics_service::update_distribution_status(
        state.clone(),
        media_id,
        &target,
        "completed",
        Some(payload),
    )
    .await?;

    info!(
        "[DistributionAutomation] Publication {} terminée pour media={}",
        target, media_id
    );

    Ok(())
}

fn product_snapshot_summary(snapshot: &ProductConnectorSnapshot) -> Value {
    json!({
        "product_index": snapshot.product_index,
        "product_name": snapshot.product_name,
        "product_type": snapshot.product_type,
        "price_cents": snapshot.price_cents,
        "currency": snapshot.currency,
        "stock": snapshot.stock,
        "promotion_active": snapshot.promotion_active,
        "promotion_label": snapshot.promotion_label,
        "delivery_eta_minutes": snapshot.delivery_eta_minutes,
        "delivery_modes": snapshot.delivery_modes,
        "connectors": snapshot.connectors,
    })
}
