use std::{collections::HashMap, str::FromStr, sync::Arc};

use bigdecimal::{BigDecimal, FromPrimitive, ToPrimitive};
use chrono::{DateTime, Duration, Utc};
use redis::Client as RedisClient;
use serde_json::{json, Value};
use sqlx::{postgres::PgRow, PgPool, Postgres, Row, Transaction};
use uuid::Uuid;

use crate::{
    core::types::{AppError, AppResult},
    models::live_model::{
        ConfigureFlashSalesRequest, LiveFlashSaleCommentary, LiveFlashSaleInput,
        LiveFlashSaleReservationView, LiveFlashSaleSummary, LiveLinkedService,
    },
    services::{live_audience_service, live_stream_service::LiveStreamingService},
    state::AppState,
};

const FLASH_SCHEDULE_LEAD_MINUTES: i64 = 30;
const FLASH_ENDING_THRESHOLD_MINUTES: i64 = 5;

pub struct LiveFlashSaleService;

impl LiveFlashSaleService {
    pub async fn configure_flash_sales(
        state: Arc<AppState>,
        session_id: Uuid,
        host_user_id: i32,
        payload: ConfigureFlashSalesRequest,
    ) -> AppResult<Vec<LiveFlashSaleSummary>> {
        let session_row = sqlx::query(
            "SELECT host_user_id, service_id, metadata, title FROM live_sessions WHERE id = $1",
        )
        .bind(session_id)
        .fetch_optional(&state.pg)
        .await?;

        let Some(session_row) = session_row else {
            return Err(AppError::NotFound(
                "Session live introuvable pour la configuration des ventes flash".into(),
            ));
        };

        let session_host: i32 = session_row.try_get("host_user_id")?;
        if session_host != host_user_id {
            return Err(AppError::Forbidden(
                "Vous ne pouvez configurer que vos propres ventes flash".into(),
            ));
        }

        let primary_service_id: Option<i32> = session_row.get::<Option<i32>, _>("service_id");
        let metadata: Value = session_row.try_get("metadata")?;
        let session_title: String = session_row.try_get("title")?;

        let mut audience_services = LiveStreamingService::extract_linked_ids(&metadata);
        if let Some(primary) = primary_service_id {
            if !audience_services.contains(&primary) {
                audience_services.push(primary);
            }
        }

        let items = payload.items;
        Self::validate_flash_sale_inputs(&items)?;

        let mut tx: Transaction<'_, Postgres> = state.pg.begin().await?;

        sqlx::query("DELETE FROM live_flash_sales WHERE live_session_id = $1")
            .bind(session_id)
            .execute(&mut *tx)
            .await?;

        for item in &items {
            let commentary_mode = item.commentary_mode.to_lowercase();
            if commentary_mode != "host" && commentary_mode != "ai_voice" {
                return Err(AppError::BadRequest(
                    "Mode de commentaire invalide (host ou ai_voice autorisés)".into(),
                ));
            }

            if item.commentary_interval_seconds < 15 {
                return Err(AppError::BadRequest(
                    "L'intervalle de commentaire doit être d'au moins 15 secondes".into(),
                ));
            }

            let price_decimal = BigDecimal::from_str(&item.promo_price_cfa.to_string())
                .map_err(|_| AppError::BadRequest("Le prix promotionnel est invalide".into()))?;

            let metadata_value = if item.metadata.is_null() {
                json!({})
            } else {
                item.metadata.clone()
            };

            let ai_voice_profile = item
                .ai_voice_profile
                .as_ref()
                .map(|value| value.trim().to_string())
                .filter(|value| !value.is_empty());

            sqlx::query(
                r#"
                INSERT INTO live_flash_sales (
                    live_session_id,
                    service_id,
                    promo_price_cfa,
                    stock_target,
                    start_at,
                    end_at,
                    status,
                    commentary_mode,
                    commentary_interval_seconds,
                    ai_voice_profile,
                    metadata
                )
                VALUES ($1, $2, $3, $4, $5, $6, 'scheduled', $7, $8, $9, $10)
                "#,
            )
            .bind(session_id)
            .bind(item.service_id)
            .bind(price_decimal)
            .bind(item.stock_target)
            .bind(item.start_at)
            .bind(item.end_at)
            .bind(&commentary_mode)
            .bind(item.commentary_interval_seconds)
            .bind(ai_voice_profile.clone())
            .bind(metadata_value)
            .execute(&mut *tx)
            .await?;
        }

        tx.commit().await?;

        let summaries = Self::list_flash_sales(&state.pg, session_id).await?;

        for summary in &summaries {
            let product_title = summary
                .linked_service
                .as_ref()
                .and_then(|svc| svc.title.clone())
                .unwrap_or_else(|| session_title.clone());

            if let Err(err) = live_audience_service::notify_flash_sale_scheduled(
                &state.pg,
                host_user_id,
                &Self::build_audience_targets(&audience_services, summary.service_id),
                session_id,
                summary.id,
                &product_title,
                summary.start_at,
                summary.promo_price_cfa,
            )
            .await
            {
                log::warn!(
                    "Notification vente flash programmée impossible ({:?}): {:?}",
                    summary.id,
                    err
                );
            }
        }

        Ok(summaries)
    }

    pub async fn reserve_slot(
        pool: &PgPool,
        flash_sale_id: Uuid,
        user_id: i32,
        quantity: i32,
    ) -> AppResult<LiveFlashSaleSummary> {
        if quantity <= 0 {
            return Err(AppError::BadRequest(
                "La quantité réservée doit être supérieure à zéro".into(),
            ));
        }

        let mut tx: Transaction<'_, Postgres> = pool.begin().await?;
        let sale_row = sqlx::query(
            r#"
            SELECT id, live_session_id, service_id, stock_target, start_at, end_at, status
            FROM live_flash_sales
            WHERE id = $1
            FOR UPDATE
            "#,
        )
        .bind(flash_sale_id)
        .fetch_optional(&mut *tx)
        .await?;

        let Some(sale_row) = sale_row else {
            return Err(AppError::NotFound("Vente flash introuvable".to_string()));
        };

        let stock_target: i32 = sale_row.try_get("stock_target")?;
        let start_at: DateTime<Utc> = sale_row.try_get("start_at")?;
        let end_at: DateTime<Utc> = sale_row.try_get("end_at")?;
        let mut status: String = sale_row.try_get("status")?;

        let now = Utc::now();
        if now < start_at {
            return Err(AppError::BadRequest(
                "La vente flash n'a pas encore commencé".into(),
            ));
        }
        if now >= end_at {
            return Err(AppError::BadRequest(
                "La vente flash est déjà terminée".into(),
            ));
        }

        if status == "scheduled" {
            sqlx::query(
                "UPDATE live_flash_sales SET status = 'live', live_notification_sent_at = COALESCE(live_notification_sent_at, NOW()), updated_at = NOW() WHERE id = $1",
            )
            .bind(flash_sale_id)
            .execute(&mut *tx)
            .await?;
            status = "live".into();
        }

        if status != "live" {
            return Err(AppError::BadRequest(
                "La vente flash n'est pas active".into(),
            ));
        }

        let previous_quantity: i64 = sqlx::query_scalar(
            r#"
            SELECT COALESCE(quantity, 0)::bigint
            FROM live_flash_sale_reservations
            WHERE flash_sale_id = $1 AND user_id = $2
            "#,
        )
        .bind(flash_sale_id)
        .bind(user_id)
        .fetch_optional(&mut *tx)
        .await?
        .unwrap_or(0);

        let total_reserved: i64 = sqlx::query_scalar(
            r#"
            SELECT COALESCE(SUM(quantity), 0)::bigint
            FROM live_flash_sale_reservations
            WHERE flash_sale_id = $1
            "#,
        )
        .bind(flash_sale_id)
        .fetch_one(&mut *tx)
        .await?;

        let new_total = total_reserved - previous_quantity + quantity as i64;
        if new_total > stock_target as i64 {
            return Err(AppError::BadRequest(
                "Stock promotionnel épuisé pour cette vente flash".into(),
            ));
        }

        sqlx::query(
            r#"
            INSERT INTO live_flash_sale_reservations (flash_sale_id, user_id, quantity)
            VALUES ($1, $2, $3)
            ON CONFLICT (flash_sale_id, user_id)
            DO UPDATE
            SET quantity = EXCLUDED.quantity,
                reserved_at = NOW()
            "#,
        )
        .bind(flash_sale_id)
        .bind(user_id)
        .bind(quantity)
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;

        Self::get_flash_sale_summary(pool, flash_sale_id).await
    }

    /// ✅ NOUVEAU: Diffuse une mise à jour de stock via Redis pub/sub
    pub async fn broadcast_stock_update(
        redis_client: &redis::Client,
        flash_sale_id: Uuid,
        available_stock: i32,
        reserved_quantity: i64,
    ) {
        use crate::utils::redis_helper;
        use redis::AsyncCommands;

        let mut conn = match redis_helper::get_redis_connection(redis_client, 1, 0).await {
            Ok(conn) => conn,
            Err(_) => {
                // Redis non disponible, ignorer silencieusement
                return;
            }
        };

        let channel = format!("flash_sale:{}:stock", flash_sale_id);
        let message = serde_json::json!({
            "flash_sale_id": flash_sale_id,
            "available_stock": available_stock,
            "reserved_quantity": reserved_quantity,
            "timestamp": chrono::Utc::now(),
        });

        if let Err(e) = conn
            .publish::<_, _, ()>(&channel, message.to_string())
            .await
        {
            log::debug!(
                "⚠️ Impossible de publier mise à jour stock flash_sale {}: {:?}",
                flash_sale_id,
                e
            );
        }
    }

    pub async fn list_reservations_for_host(
        pool: &PgPool,
        flash_sale_id: Uuid,
        host_user_id: i32,
    ) -> AppResult<Vec<LiveFlashSaleReservationView>> {
        let ownership = sqlx::query(
            r#"
            SELECT ls.host_user_id
            FROM live_flash_sales lfs
            JOIN live_sessions ls ON ls.id = lfs.live_session_id
            WHERE lfs.id = $1
            "#,
        )
        .bind(flash_sale_id)
        .fetch_optional(pool)
        .await?;

        let Some(row) = ownership else {
            return Err(AppError::NotFound("Vente flash introuvable".to_string()));
        };

        let owner: i32 = row.try_get("host_user_id")?;
        if owner != host_user_id {
            return Err(AppError::Forbidden(
                "Vous ne pouvez consulter que vos propres réservations".into(),
            ));
        }

        let reservations = sqlx::query(
            r#"
            SELECT
                r.user_id,
                r.quantity,
                r.reserved_at,
                u.name,
                u.prenom,
                u.nom
            FROM live_flash_sale_reservations r
            JOIN users u ON u.id = r.user_id
            WHERE r.flash_sale_id = $1
            ORDER BY r.reserved_at ASC
            "#,
        )
        .bind(flash_sale_id)
        .fetch_all(pool)
        .await?;

        let mut result = Vec::with_capacity(reservations.len());
        for row in reservations {
            let user_id: i32 = row.try_get("user_id")?;
            let quantity: i32 = row.try_get("quantity")?;
            let reserved_at: DateTime<Utc> = row.try_get("reserved_at")?;

            let name: Option<String> = row.get::<Option<String>, _>("name");
            let prenom: Option<String> = row.get::<Option<String>, _>("prenom");
            let nom: Option<String> = row.get::<Option<String>, _>("nom");
            let user_name = name.or_else(|| match (prenom, nom) {
                (Some(p), Some(n)) if !p.is_empty() || !n.is_empty() => {
                    Some(format!("{} {}", p, n).trim().to_string())
                }
                (Some(p), None) => Some(p),
                (None, Some(n)) => Some(n),
                _ => None,
            });

            result.push(LiveFlashSaleReservationView {
                user_id,
                quantity,
                reserved_at,
                user_name,
            });
        }

        Ok(result)
    }

    pub async fn process_timers(state: Arc<AppState>) {
        if let Err(err) = Self::process_timers_inner(state.clone()).await {
            log::error!("process_timers live flash sales failed: {:?}", err);
        }
    }

    /// ✅ NOUVEAU: Diffuse une mise à jour de stock via Redis pub/sub
    pub async fn broadcast_stock_update(
        redis_client: &redis::Client,
        flash_sale_id: Uuid,
        available_stock: i32,
        reserved_quantity: i64,
    ) {
        use crate::utils::redis_helper;
        use redis::AsyncCommands;

        let mut conn = match redis_helper::get_redis_connection(redis_client, 1, 0).await {
            Ok(conn) => conn,
            Err(_) => {
                // Redis non disponible, ignorer silencieusement
                return;
            }
        };

        let channel = format!("flash_sale:{}:stock", flash_sale_id);
        let message = serde_json::json!({
            "flash_sale_id": flash_sale_id,
            "available_stock": available_stock,
            "reserved_quantity": reserved_quantity,
            "timestamp": chrono::Utc::now(),
        });

        if let Err(e) = conn
            .publish::<_, _, ()>(&channel, message.to_string())
            .await
        {
            log::debug!(
                "⚠️ Impossible de publier mise à jour stock flash_sale {}: {:?}",
                flash_sale_id,
                e
            );
        }
    }

    async fn process_timers_inner(state: Arc<AppState>) -> AppResult<()> {
        let now = Utc::now();
        Self::dispatch_scheduled_notifications(state.clone(), now).await?;
        Self::activate_flash_sales(state.clone(), now).await?;
        Self::send_ending_reminders(state.clone(), now).await?;
        Self::generate_ai_commentary(state.clone(), now).await?;
        Self::close_finished_sales(state, now).await?;
        Ok(())
    }

    async fn dispatch_scheduled_notifications(
        state: Arc<AppState>,
        now: DateTime<Utc>,
    ) -> AppResult<()> {
        let notify_before = now + Duration::minutes(FLASH_SCHEDULE_LEAD_MINUTES);
        let rows = sqlx::query(
            r#"
            SELECT
                lfs.id,
                lfs.live_session_id,
                lfs.service_id,
                lfs.promo_price_cfa,
                lfs.start_at,
                lfs.scheduled_notification_sent_at,
                ls.host_user_id,
                ls.service_id AS primary_service_id,
                ls.metadata,
                ls.title
            FROM live_flash_sales lfs
            JOIN live_sessions ls ON ls.id = lfs.live_session_id
            WHERE lfs.status = 'scheduled'
              AND lfs.start_at <= $1
              AND lfs.scheduled_notification_sent_at IS NULL
            "#,
        )
        .bind(notify_before)
        .fetch_all(&state.pg)
        .await?;

        for row in rows {
            let flash_sale_id: Uuid = row.try_get("id")?;
            let session_id: Uuid = row.try_get("live_session_id")?;
            let host_user_id: i32 = row.try_get("host_user_id")?;
            let service_id: i32 = row.try_get("service_id")?;
            let promo_price: BigDecimal = row.try_get("promo_price_cfa")?;
            let start_at: DateTime<Utc> = row.try_get("start_at")?;
            let promo_price_cfa = promo_price
                .to_f64()
                .ok_or_else(|| AppError::Internal("Conversion du prix promo impossible".into()))?;
            let metadata: Value = row.try_get("metadata")?;
            let session_title: String = row.try_get("title")?;

            let mut audience_services = LiveStreamingService::extract_linked_ids(&metadata);
            if let Some(primary) = row.try_get::<Option<i32>, _>("primary_service_id")? {
                if !audience_services.contains(&primary) {
                    audience_services.push(primary);
                }
            }

            if !audience_services.contains(&service_id) {
                audience_services.push(service_id);
            }

            let summaries =
                LiveStreamingService::load_linked_services(&state.pg, &audience_services).await?;
            let map: HashMap<i32, _> = summaries.into_iter().map(|svc| (svc.id, svc)).collect();
            let product_title = map
                .get(&service_id)
                .and_then(|svc| svc.title.clone())
                .unwrap_or_else(|| session_title.clone());

            if let Err(err) = live_audience_service::notify_flash_sale_scheduled(
                &state.pg,
                host_user_id,
                &audience_services,
                session_id,
                flash_sale_id,
                &product_title,
                start_at,
                promo_price_cfa,
            )
            .await
            {
                log::warn!(
                    "Impossible d'envoyer la notification de vente flash programmée {:?}: {:?}",
                    flash_sale_id,
                    err
                );
                continue;
            }

            if let Err(err) = sqlx::query(
                "UPDATE live_flash_sales SET scheduled_notification_sent_at = NOW(), updated_at = NOW() WHERE id = $1",
            )
            .bind(flash_sale_id)
            .execute(&state.pg)
            .await
            {
                log::warn!(
                    "Impossible de marquer la notification programmée {:?}: {:?}",
                    flash_sale_id,
                    err
                );
            }
        }

        Ok(())
    }

    async fn activate_flash_sales(state: Arc<AppState>, now: DateTime<Utc>) -> AppResult<()> {
        let rows = sqlx::query(
            r#"
            SELECT
                lfs.id,
                lfs.live_session_id,
                lfs.service_id,
                lfs.promo_price_cfa,
                ls.host_user_id,
                ls.service_id AS primary_service_id,
                ls.metadata,
                ls.title
            FROM live_flash_sales lfs
            JOIN live_sessions ls ON ls.id = lfs.live_session_id
            WHERE lfs.status = 'scheduled'
              AND lfs.start_at <= $1
            "#,
        )
        .bind(now)
        .fetch_all(&state.pg)
        .await?;

        for row in rows {
            let flash_sale_id: Uuid = row.try_get("id")?;
            let session_id: Uuid = row.try_get("live_session_id")?;
            let host_user_id: i32 = row.try_get("host_user_id")?;
            let service_id: i32 = row.try_get("service_id")?;
            let promo_price: BigDecimal = row.try_get("promo_price_cfa")?;
            let promo_price_cfa = promo_price
                .to_f64()
                .ok_or_else(|| AppError::Internal("Conversion du prix promo impossible".into()))?;
            let metadata: Value = row.try_get("metadata")?;
            let session_title: String = row.try_get("title")?;

            let mut audience_services = LiveStreamingService::extract_linked_ids(&metadata);
            if let Some(primary) = row.try_get::<Option<i32>, _>("primary_service_id")? {
                if !audience_services.contains(&primary) {
                    audience_services.push(primary);
                }
            }
            if !audience_services.contains(&service_id) {
                audience_services.push(service_id);
            }

            sqlx::query(
                "UPDATE live_flash_sales SET status = 'live', live_notification_sent_at = NOW(), updated_at = NOW() WHERE id = $1",
            )
            .bind(flash_sale_id)
            .execute(&state.pg)
            .await?;

            let summaries =
                LiveStreamingService::load_linked_services(&state.pg, &audience_services).await?;
            let map: HashMap<i32, _> = summaries.into_iter().map(|svc| (svc.id, svc)).collect();
            let product_title = map
                .get(&service_id)
                .and_then(|svc| svc.title.clone())
                .unwrap_or_else(|| session_title.clone());

            if let Err(err) = live_audience_service::notify_flash_sale_live(
                &state.pg,
                host_user_id,
                &audience_services,
                session_id,
                flash_sale_id,
                &product_title,
                promo_price_cfa,
            )
            .await
            {
                log::warn!(
                    "Impossible d'envoyer la notification de vente flash live {:?}: {:?}",
                    flash_sale_id,
                    err
                );
            }
        }

        Ok(())
    }

    async fn send_ending_reminders(state: Arc<AppState>, now: DateTime<Utc>) -> AppResult<()> {
        let reminder_threshold = now + Duration::minutes(FLASH_ENDING_THRESHOLD_MINUTES);
        let rows = sqlx::query(
            r#"
            SELECT
                lfs.id,
                lfs.live_session_id,
                lfs.service_id,
                lfs.end_at,
                lfs.ending_notification_sent_at,
                ls.host_user_id,
                ls.service_id AS primary_service_id,
                ls.metadata,
                ls.title
            FROM live_flash_sales lfs
            JOIN live_sessions ls ON ls.id = lfs.live_session_id
            WHERE lfs.status = 'live'
              AND lfs.end_at <= $1
              AND lfs.ending_notification_sent_at IS NULL
            "#,
        )
        .bind(reminder_threshold)
        .fetch_all(&state.pg)
        .await?;

        for row in rows {
            let flash_sale_id: Uuid = row.try_get("id")?;
            let session_id: Uuid = row.try_get("live_session_id")?;
            let host_user_id: i32 = row.try_get("host_user_id")?;
            let service_id: i32 = row.try_get("service_id")?;
            let end_at: DateTime<Utc> = row.try_get("end_at")?;
            let metadata: Value = row.try_get("metadata")?;
            let session_title: String = row.try_get("title")?;

            let mut audience_services = LiveStreamingService::extract_linked_ids(&metadata);
            if let Some(primary) = row.try_get::<Option<i32>, _>("primary_service_id")? {
                if !audience_services.contains(&primary) {
                    audience_services.push(primary);
                }
            }
            if !audience_services.contains(&service_id) {
                audience_services.push(service_id);
            }

            let remaining_minutes = (end_at - now).num_minutes().max(1);

            let summaries =
                LiveStreamingService::load_linked_services(&state.pg, &audience_services).await?;
            let map: HashMap<i32, _> = summaries.into_iter().map(|svc| (svc.id, svc)).collect();
            let product_title = map
                .get(&service_id)
                .and_then(|svc| svc.title.clone())
                .unwrap_or_else(|| session_title.clone());

            if let Err(err) = live_audience_service::notify_flash_sale_ending(
                &state.pg,
                host_user_id,
                &audience_services,
                session_id,
                flash_sale_id,
                &product_title,
                remaining_minutes,
            )
            .await
            {
                log::warn!(
                    "Impossible d'envoyer la notification de fin de vente flash {:?}: {:?}",
                    flash_sale_id,
                    err
                );
                continue;
            }

            if let Err(err) = sqlx::query(
                "UPDATE live_flash_sales SET ending_notification_sent_at = NOW(), updated_at = NOW() WHERE id = $1",
            )
            .bind(flash_sale_id)
            .execute(&state.pg)
            .await
            {
                log::warn!(
                    "Impossible de marquer la notification de fin {:?}: {:?}",
                    flash_sale_id,
                    err
                );
            }
        }

        Ok(())
    }

    async fn generate_ai_commentary(state: Arc<AppState>, now: DateTime<Utc>) -> AppResult<()> {
        let rows = sqlx::query(
            r#"
            WITH reservations AS (
                SELECT flash_sale_id, SUM(quantity) AS reserved_quantity
                FROM live_flash_sale_reservations
                GROUP BY flash_sale_id
            )
            SELECT
                lfs.id,
                lfs.live_session_id,
                lfs.service_id,
                lfs.stock_target,
                COALESCE(res.reserved_quantity, 0) AS reserved_quantity,
                lfs.commentary_interval_seconds,
                lfs.last_commentary_sent_at,
                lfs.end_at,
                COALESCE(lfs.metadata, '{}'::jsonb) AS flash_metadata,
                ls.host_user_id,
                ls.service_id AS primary_service_id,
                COALESCE(ls.metadata, '{}'::jsonb) AS session_metadata,
                ls.title
            FROM live_flash_sales lfs
            JOIN live_sessions ls ON ls.id = lfs.live_session_id
            LEFT JOIN reservations res ON res.flash_sale_id = lfs.id
            WHERE lfs.status = 'live'
              AND lfs.commentary_mode = 'ai_voice'
              AND lfs.end_at > $1
              AND (
                    lfs.last_commentary_sent_at IS NULL
                    OR lfs.last_commentary_sent_at <= $1 - make_interval(secs => lfs.commentary_interval_seconds)
              )
            "#,
        )
        .bind(now)
        .fetch_all(&state.pg)
        .await?;

        if rows.is_empty() {
            return Ok(());
        }

        let mut service_ids = Vec::new();
        for row in &rows {
            let service_id: i32 = row.try_get("service_id")?;
            if !service_ids.contains(&service_id) {
                service_ids.push(service_id);
            }
        }

        let linked = LiveStreamingService::load_linked_services(&state.pg, &service_ids).await?;
        let mut linked_map: HashMap<i32, LiveLinkedService> = HashMap::new();
        for service in linked {
            linked_map.insert(service.id, service);
        }

        for row in rows {
            let flash_sale_id: Uuid = row.try_get("id")?;
            let session_id: Uuid = row.try_get("live_session_id")?;
            let service_id: i32 = row.try_get("service_id")?;
            let stock_target: i32 = row.try_get("stock_target")?;
            let reserved_quantity: i64 = row.try_get("reserved_quantity")?;
            let interval_seconds: i32 = row.try_get("commentary_interval_seconds")?;
            let end_at: DateTime<Utc> = row.try_get("end_at")?;
            let session_metadata: Value = row.try_get("session_metadata")?;
            let flash_metadata: Value = row.try_get("flash_metadata")?;
            let host_user_id: i32 = row.try_get("host_user_id")?;
            let primary_service_id: Option<i32> = row.try_get("primary_service_id")?;
            let session_title: String = row.try_get("title")?;

            let title = linked_map
                .get(&service_id)
                .and_then(|svc| svc.title.clone())
                .unwrap_or_else(|| format!("Produit #{service_id}"));

            let percent = if stock_target > 0 {
                (reserved_quantity as f64 / stock_target as f64 * 100.0).min(100.0)
            } else {
                0.0
            };
            let remaining = (stock_target as i64 - reserved_quantity).max(0);
            let seconds_left = (end_at - now).num_seconds().max(0);

            let message = if remaining == 0 {
                format!(
                    "🔥 {title} : stock promotionnel épuisé avec {reserved_quantity} réservations !"
                )
            } else if percent < 25.0 {
                format!(
                    "🟢 {title} : {reserved_quantity}/{stock_target} réservations ({percent:.0}% du stock). Il reste {remaining} unité(s)."
                )
            } else if percent < 75.0 {
                format!(
                    "⚡ {title} progresse vite : {reserved_quantity}/{stock_target} réservations ({percent:.0}%). Encore {remaining} unité(s) disponibles."
                )
            } else {
                format!(
                    "⏳ {title} près du sold-out : {reserved_quantity}/{stock_target} réservations ({percent:.0}%). Plus que {remaining} unité(s) !"
                )
            };

            let commentary = Self::insert_commentary(
                &state.pg,
                flash_sale_id,
                "ai_voice",
                &message,
                json!({
                    "source": "ai_voice",
                    "percent": percent,
                    "reserved": reserved_quantity,
                    "stock": stock_target,
                    "remaining": remaining,
                    "seconds_left": seconds_left,
                    "interval_seconds": interval_seconds,
                }),
            )
            .await?;

            sqlx::query(
                "UPDATE live_flash_sales SET last_commentary_sent_at = NOW(), updated_at = NOW() WHERE id = $1",
            )
            .bind(flash_sale_id)
            .execute(&state.pg)
            .await?;

            Self::broadcast_commentary(
                state.clone(),
                session_id,
                host_user_id,
                service_id,
                primary_service_id,
                &session_metadata,
                &flash_metadata,
                &session_title,
                &commentary,
            )
            .await?;
        }

        Ok(())
    }

    async fn close_finished_sales(state: Arc<AppState>, now: DateTime<Utc>) -> AppResult<()> {
        sqlx::query(
            "UPDATE live_flash_sales SET status = 'ended', updated_at = NOW() WHERE status IN ('scheduled', 'live') AND end_at <= $1",
        )
        .bind(now)
        .execute(&state.pg)
        .await?;

        Ok(())
    }

    async fn broadcast_commentary(
        state: Arc<AppState>,
        session_id: Uuid,
        host_user_id: i32,
        sale_service_id: i32,
        primary_service_id: Option<i32>,
        session_metadata: &Value,
        flash_metadata: &Value,
        session_title: &str,
        commentary: &LiveFlashSaleCommentary,
    ) -> AppResult<()> {
        let mut audience_services = LiveStreamingService::extract_linked_ids(session_metadata);

        if let Some(primary) = primary_service_id {
            if !audience_services.contains(&primary) {
                audience_services.push(primary);
            }
        }

        if let Some(flash_services) = flash_metadata
            .get("linked_services")
            .and_then(|value| value.as_array())
        {
            for item in flash_services {
                if let Some(id) = item.as_i64() {
                    let id = id as i32;
                    if !audience_services.contains(&id) {
                        audience_services.push(id);
                    }
                }
            }
        }

        if !audience_services.contains(&sale_service_id) {
            audience_services.push(sale_service_id);
        }

        if audience_services.is_empty() {
            return Ok(());
        }

        if let Err(err) = live_audience_service::notify_flash_sale_commentary(
            &state.pg,
            host_user_id,
            &audience_services,
            session_id,
            commentary.flash_sale_id,
            session_title,
            &commentary.message,
        )
        .await
        {
            log::warn!(
                "Impossible d'envoyer la notification de commentaire flash sale {:?}: {:?}",
                commentary.flash_sale_id,
                err
            );
        }

        Ok(())
    }

    async fn map_summaries(
        pool: &PgPool,
        rows: Vec<PgRow>,
    ) -> AppResult<Vec<LiveFlashSaleSummary>> {
        if rows.is_empty() {
            return Ok(vec![]);
        }

        let mut service_ids = Vec::new();
        let mut sale_ids = Vec::new();
        for row in &rows {
            let service_id: i32 = row.try_get("service_id")?;
            if !service_ids.contains(&service_id) {
                service_ids.push(service_id);
            }
            let sale_id: Uuid = row.try_get("id")?;
            sale_ids.push(sale_id);
        }

        let linked = LiveStreamingService::load_linked_services(pool, &service_ids).await?;
        let mut linked_map: HashMap<i32, LiveLinkedService> = HashMap::new();
        for service in linked {
            linked_map.insert(service.id, service);
        }

        let commentary_map = Self::load_recent_commentaries(pool, &sale_ids, 5).await?;

        let mut summaries = Vec::with_capacity(rows.len());
        for row in rows {
            let promo_price: BigDecimal = row.try_get("promo_price_cfa")?;
            let promo_price_cfa = promo_price
                .to_f64()
                .ok_or_else(|| AppError::Internal("Conversion du prix promo impossible".into()))?;

            let summary = LiveFlashSaleSummary {
                id: row.try_get("id")?,
                live_session_id: row.try_get("live_session_id")?,
                service_id: row.try_get("service_id")?,
                promo_price_cfa,
                stock_target: row.try_get("stock_target")?,
                reserved_quantity: row.get::<i64, _>("reserved_quantity"),
                start_at: row.try_get("start_at")?,
                end_at: row.try_get("end_at")?,
                status: row.get::<String, _>("status"),
                commentary_mode: row.try_get("commentary_mode")?,
                commentary_interval_seconds: row.try_get("commentary_interval_seconds")?,
                ai_voice_profile: row.try_get("ai_voice_profile")?,
                last_commentary_sent_at: row.try_get("last_commentary_sent_at")?,
                metadata: row.try_get("metadata")?,
                linked_service: linked_map.get(&row.get::<i32, _>("service_id")).cloned(),
                recent_commentaries: commentary_map
                    .get(&row.get::<Uuid, _>("id"))
                    .cloned()
                    .unwrap_or_default(),
            };
            summaries.push(summary);
        }

        Ok(summaries)
    }

    async fn load_recent_commentaries(
        pool: &PgPool,
        sale_ids: &[Uuid],
        limit_per_sale: i64,
    ) -> AppResult<HashMap<Uuid, Vec<LiveFlashSaleCommentary>>> {
        if sale_ids.is_empty() || limit_per_sale <= 0 {
            return Ok(HashMap::new());
        }

        let rows = sqlx::query(
            r#"
            SELECT *
            FROM (
                SELECT
                    id,
                    flash_sale_id,
                    created_by,
                    message,
                    COALESCE(metadata, '{}'::jsonb) AS metadata,
                    created_at,
                    ROW_NUMBER() OVER (PARTITION BY flash_sale_id ORDER BY created_at DESC) AS rn
                FROM live_flash_sale_commentaries
                WHERE flash_sale_id = ANY($1)
            ) ranked
            WHERE rn <= $2
            ORDER BY flash_sale_id, created_at DESC
            "#,
        )
        .bind(sale_ids)
        .bind(limit_per_sale)
        .fetch_all(pool)
        .await?;

        let mut map: HashMap<Uuid, Vec<LiveFlashSaleCommentary>> = HashMap::new();

        for row in rows {
            let flash_sale_id: Uuid = row.try_get("flash_sale_id")?;
            let entry = map.entry(flash_sale_id).or_default();
            entry.push(LiveFlashSaleCommentary {
                id: row.try_get("id")?,
                flash_sale_id,
                created_by: row.get::<String, _>("created_by"),
                message: row.try_get("message")?,
                metadata: row.try_get("metadata")?,
                created_at: row.try_get("created_at")?,
            });
        }

        Ok(map)
    }

    async fn insert_commentary(
        pool: &PgPool,
        flash_sale_id: Uuid,
        created_by: &str,
        message: &str,
        metadata: Value,
    ) -> AppResult<LiveFlashSaleCommentary> {
        let commentary = sqlx::query_as::<_, LiveFlashSaleCommentary>(
            r#"
            INSERT INTO live_flash_sale_commentaries (flash_sale_id, created_by, message, metadata)
            VALUES ($1, $2, $3, $4)
            RETURNING id, flash_sale_id, created_by, message, metadata, created_at
            "#,
        )
        .bind(flash_sale_id)
        .bind(created_by)
        .bind(message)
        .bind(metadata)
        .fetch_one(pool)
        .await?;

        Ok(commentary)
    }

    async fn get_flash_sale_summary(
        pool: &PgPool,
        flash_sale_id: Uuid,
    ) -> AppResult<LiveFlashSaleSummary> {
        let rows = sqlx::query(
            r#"
            SELECT
                lfs.id,
                lfs.live_session_id,
                lfs.service_id,
                lfs.promo_price_cfa,
                lfs.stock_target,
                lfs.start_at,
                lfs.end_at,
                lfs.status,
                lfs.commentary_mode,
                lfs.commentary_interval_seconds,
                lfs.ai_voice_profile,
                lfs.last_commentary_sent_at,
                COALESCE(lfs.metadata, '{}'::jsonb) AS metadata,
                COALESCE(SUM(res.quantity), 0) AS reserved_quantity
            FROM live_flash_sales lfs
            LEFT JOIN live_flash_sale_reservations res
                ON res.flash_sale_id = lfs.id
            WHERE lfs.id = $1
            GROUP BY lfs.id
            "#,
        )
        .bind(flash_sale_id)
        .fetch_all(pool)
        .await?;

        let mut summaries = Self::map_summaries(pool, rows).await?;
        summaries
            .pop()
            .ok_or_else(|| AppError::NotFound("Vente flash introuvable".into()))
    }

    fn validate_flash_sale_inputs(items: &[LiveFlashSaleInput]) -> AppResult<()> {
        for item in items {
            if item.promo_price_cfa <= 0.0 {
                return Err(AppError::BadRequest(
                    "Le prix promotionnel doit être positif".into(),
                ));
            }
            if item.stock_target <= 0 {
                return Err(AppError::BadRequest(
                    "Le stock promotionnel doit être supérieur à zéro".into(),
                ));
            }
            if item.end_at <= item.start_at {
                return Err(AppError::BadRequest(
                    "La date de fin doit être postérieure au début de la vente flash".into(),
                ));
            }
        }
        Ok(())
    }

    pub async fn list_flash_sales(
        pool: &PgPool,
        session_id: Uuid,
    ) -> AppResult<Vec<LiveFlashSaleSummary>> {
        let rows = sqlx::query(
            r#"
            SELECT
                lfs.id,
                lfs.live_session_id,
                lfs.service_id,
                lfs.promo_price_cfa,
                lfs.stock_target,
                lfs.start_at,
                lfs.end_at,
                lfs.status,
                lfs.commentary_mode,
                lfs.commentary_interval_seconds,
                lfs.ai_voice_profile,
                lfs.last_commentary_sent_at,
                COALESCE(lfs.metadata, '{}'::jsonb) AS metadata,
                COALESCE(SUM(res.quantity), 0) AS reserved_quantity
            FROM live_flash_sales lfs
            LEFT JOIN live_flash_sale_reservations res
                ON res.flash_sale_id = lfs.id
            WHERE lfs.live_session_id = $1
            GROUP BY lfs.id
            ORDER BY lfs.start_at ASC
            "#,
        )
        .bind(session_id)
        .fetch_all(pool)
        .await?;

        Self::map_summaries(pool, rows).await
    }

    pub async fn list_flash_sales_for_host(
        pool: &PgPool,
        session_id: Uuid,
        host_user_id: i32,
    ) -> AppResult<Vec<LiveFlashSaleSummary>> {
        let session_owner = sqlx::query("SELECT host_user_id FROM live_sessions WHERE id = $1")
            .bind(session_id)
            .fetch_optional(pool)
            .await?;

        let Some(row) = session_owner else {
            return Err(AppError::NotFound("Session live introuvable".to_string()));
        };

        let owner: i32 = row.try_get("host_user_id")?;
        if owner != host_user_id {
            return Err(AppError::Forbidden(
                "Accès refusé aux ventes flash d'un autre prestataire".into(),
            ));
        }

        Self::list_flash_sales(pool, session_id).await
    }

    pub async fn list_commentaries(
        pool: &PgPool,
        flash_sale_id: Uuid,
        limit: Option<i64>,
    ) -> AppResult<Vec<LiveFlashSaleCommentary>> {
        let map =
            Self::load_recent_commentaries(pool, &[flash_sale_id], limit.unwrap_or(20)).await?;
        let mut items = map.get(&flash_sale_id).cloned().unwrap_or_default();
        items.sort_by_key(|item| item.created_at);
        Ok(items)
    }

    pub async fn add_host_commentary(
        state: Arc<AppState>,
        flash_sale_id: Uuid,
        host_user_id: i32,
        message: String,
    ) -> AppResult<LiveFlashSaleCommentary> {
        if message.trim().is_empty() {
            return Err(AppError::BadRequest(
                "Le message de commentaire ne peut pas être vide".into(),
            ));
        }

        let details = sqlx::query(
            r#"
            SELECT
                lfs.live_session_id,
                lfs.service_id,
                lfs.commentary_mode,
                ls.host_user_id,
                ls.service_id AS primary_service_id,
                COALESCE(ls.metadata, '{}'::jsonb) AS session_metadata,
                ls.title,
                COALESCE(lfs.metadata, '{}'::jsonb) AS flash_metadata
            FROM live_flash_sales lfs
            JOIN live_sessions ls ON ls.id = lfs.live_session_id
            WHERE lfs.id = $1
            "#,
        )
        .bind(flash_sale_id)
        .fetch_optional(&state.pg)
        .await?;

        let Some(row) = details else {
            return Err(AppError::NotFound("Vente flash introuvable".into()));
        };

        let owner: i32 = row.try_get("host_user_id")?;
        if owner != host_user_id {
            return Err(AppError::Forbidden(
                "Vous ne pouvez commenter que vos propres ventes flash".into(),
            ));
        }

        let session_id: Uuid = row.try_get("live_session_id")?;
        let service_id: i32 = row.try_get("service_id")?;
        let session_metadata: Value = row.try_get("session_metadata")?;
        let flash_metadata: Value = row.try_get("flash_metadata")?;
        let primary_service_id: Option<i32> = row.try_get("primary_service_id")?;
        let session_title: String = row.try_get("title")?;

        let metadata = json!({
            "source": "host",
        });

        let commentary =
            Self::insert_commentary(&state.pg, flash_sale_id, "host", message.trim(), metadata)
                .await?;

        sqlx::query(
            "UPDATE live_flash_sales SET last_commentary_sent_at = NOW(), updated_at = NOW() WHERE id = $1",
        )
        .bind(flash_sale_id)
        .execute(&state.pg)
        .await?;

        Self::broadcast_commentary(
            state,
            session_id,
            owner,
            service_id,
            primary_service_id,
            &session_metadata,
            &flash_metadata,
            &session_title,
            &commentary,
        )
        .await?;

        Ok(commentary)
    }

    fn build_audience_targets(base: &[i32], sale_service_id: i32) -> Vec<i32> {
        let mut result = base.to_vec();
        if !result.contains(&sale_service_id) {
            result.push(sale_service_id);
        }
        result
    }
}
