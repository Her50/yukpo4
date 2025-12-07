use bigdecimal::{BigDecimal, FromPrimitive};
use chrono::{DateTime, Duration, Utc};
use log::{error, info, warn};
use serde_json::{json, Value};
use sqlx::{postgres::PgRow, FromRow, PgPool, Postgres, QueryBuilder, Row};
use std::{str::FromStr, sync::Arc};
use uuid::Uuid;

use crate::{
    core::types::{AppError, AppResult},
    models::global_promo_model::{
        BulkReviewGlobalPromoEntryRequest, CreateGlobalPromoEventRequest, GlobalPromoCatalogBadges,
        GlobalPromoCatalogItem, GlobalPromoCatalogPage, GlobalPromoCatalogQuery, GlobalPromoEntry,
        GlobalPromoEvent, GlobalPromoProductSnapshot, ReviewGlobalPromoEntryRequest,
        UpdateGlobalPromoEventRequest, UpsertGlobalPromoEntryRequest,
    },
    services::{
        notification_service, notification_service::NotificationType, push_notification_service,
    },
    state::AppState,
};

const VALID_ENTRY_AVAILABILITIES: &[&str] = &["online", "live", "both"];
const VALID_ENTRY_STATUSES: &[&str] = &[
    "draft",
    "pending_review",
    "approved",
    "rejected",
    "published",
    "ended",
];

pub struct GlobalPromoService;

impl GlobalPromoService {
    pub async fn create_event(
        pool: &PgPool,
        payload: CreateGlobalPromoEventRequest,
        creator_id: i32,
    ) -> AppResult<GlobalPromoEvent> {
        Self::create_event_with_notification_queue(pool, payload, creator_id, None).await
    }

    pub async fn create_event_with_notification_queue(
        pool: &PgPool,
        payload: CreateGlobalPromoEventRequest,
        creator_id: i32,
        notification_queue: Option<&crate::services::notification_queue::NotificationQueue>,
    ) -> AppResult<GlobalPromoEvent> {
        if payload.ends_at <= payload.starts_at {
            return Err(AppError::BadRequest(
                "La date de fin doit être postérieure au début de l'évènement.".into(),
            ));
        }

        let slug = normalize_slug(&payload.slug);

        let event = sqlx::query_as::<_, GlobalPromoEvent>(
            r#"
            INSERT INTO global_promo_events (
                slug,
                theme,
                display_name,
                description,
                starts_at,
                ends_at,
                recurrence_rule,
                status,
                config,
                created_by_user_id
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'scheduled', $8, $9)
            ON CONFLICT (slug)
            DO UPDATE
            SET theme = EXCLUDED.theme,
                display_name = EXCLUDED.display_name,
                description = EXCLUDED.description,
                starts_at = EXCLUDED.starts_at,
                ends_at = EXCLUDED.ends_at,
                recurrence_rule = EXCLUDED.recurrence_rule,
                config = EXCLUDED.config,
                updated_at = NOW()
            RETURNING *
            "#,
        )
        .bind(slug)
        .bind(payload.theme.trim())
        .bind(payload.display_name.trim())
        .bind(payload.description.as_deref())
        .bind(payload.starts_at)
        .bind(payload.ends_at)
        .bind(payload.recurrence_rule.as_deref())
        .bind(payload.config)
        .bind(creator_id)
        .fetch_one(pool)
        .await?;

        // Incrémenter métrique événements actifs si l'événement est actif
        if event.status == "active" || event.status == "scheduled" {
            crate::metrics::GLOBAL_PROMO_METRICS
                .events_active
                .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        }

        // ✅ NOUVEAU : Notifier tous les prestataires via queue asynchrone
        if let Err(err) =
            notify_all_prestataires_event_created(pool, &event, notification_queue).await
        {
            warn!(
                "Failed to notify prestataires about new Black Friday event: {:?}",
                err
            );
            // Ne pas échouer la création de l'événement si la notification échoue
        }

        Ok(event)
    }

    pub async fn update_event(
        pool: &PgPool,
        event_id: Uuid,
        payload: UpdateGlobalPromoEventRequest,
    ) -> AppResult<GlobalPromoEvent> {
        let event = sqlx::query_as::<_, GlobalPromoEvent>(
            r#"
            UPDATE global_promo_events
            SET
                theme = COALESCE($2, theme),
                display_name = COALESCE($3, display_name),
                description = COALESCE($4, description),
                starts_at = COALESCE($5, starts_at),
                ends_at = COALESCE($6, ends_at),
                recurrence_rule = COALESCE($7, recurrence_rule),
                status = COALESCE($8, status),
                config = COALESCE($9, config),
                updated_at = NOW()
            WHERE id = $1
            RETURNING *
            "#,
        )
        .bind(event_id)
        .bind(payload.theme.as_deref())
        .bind(payload.display_name.as_deref())
        .bind(payload.description.as_deref())
        .bind(payload.starts_at)
        .bind(payload.ends_at)
        .bind(payload.recurrence_rule.as_deref())
        .bind(payload.status.as_deref())
        .bind(payload.config)
        .fetch_optional(pool)
        .await?;

        event.ok_or_else(|| {
            AppError::NotFound("Évènement global introuvable pour mise à jour.".into())
        })
    }

    pub async fn list_events(
        pool: &PgPool,
        include_archived: bool,
    ) -> AppResult<Vec<GlobalPromoEvent>> {
        let events = sqlx::query_as::<_, GlobalPromoEvent>(
            r#"
            SELECT * FROM global_promo_events
            WHERE $1 OR status != 'archived'
            ORDER BY starts_at ASC
            "#,
        )
        .bind(include_archived)
        .fetch_all(pool)
        .await?;

        Ok(events)
    }

    pub async fn get_event(pool: &PgPool, event_id: Uuid) -> AppResult<GlobalPromoEvent> {
        let event = sqlx::query_as::<_, GlobalPromoEvent>(
            "SELECT * FROM global_promo_events WHERE id = $1",
        )
        .bind(event_id)
        .fetch_optional(pool)
        .await?;

        event.ok_or_else(|| AppError::NotFound("Évènement global introuvable.".into()))
    }

    pub async fn upsert_entry(
        pool: &PgPool,
        event_id: Uuid,
        payload: UpsertGlobalPromoEntryRequest,
        submitted_by: i32,
    ) -> AppResult<GlobalPromoEntry> {
        Self::get_event(pool, event_id).await?;

        let UpsertGlobalPromoEntryRequest {
            service_id,
            live_session_id,
            discount_percentage,
            promo_price_cfa,
            stock_cap,
            availability,
            status,
            metadata,
            highlighted,
            priority_score,
            snapshot,
        } = payload;

        validate_availability(&availability)?;
        let status = status.as_deref().unwrap_or("draft");
        validate_entry_status(status)?;

        if let Some(stock) = stock_cap {
            if stock <= 0 {
                return Err(AppError::BadRequest(
                    "Le stock spécial doit être supérieur à zéro.".into(),
                ));
            }
        }

        let discount_decimal = to_decimal_percentage(discount_percentage)?;
        let promo_decimal = to_decimal_price(promo_price_cfa)?;

        let entry = sqlx::query_as::<_, GlobalPromoEntry>(
            r#"
            INSERT INTO global_promo_entries (
                event_id,
                service_id,
                live_session_id,
                submitted_by_user_id,
                discount_percentage,
                promo_price_cfa,
                stock_cap,
                availability,
                status,
                metadata
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (event_id, service_id)
            DO UPDATE SET
                live_session_id = EXCLUDED.live_session_id,
                discount_percentage = EXCLUDED.discount_percentage,
                promo_price_cfa = EXCLUDED.promo_price_cfa,
                stock_cap = EXCLUDED.stock_cap,
                availability = EXCLUDED.availability,
                status = EXCLUDED.status,
                metadata = EXCLUDED.metadata,
                updated_at = NOW(),
                submitted_by_user_id = EXCLUDED.submitted_by_user_id
            RETURNING *
            "#,
        )
        .bind(event_id)
        .bind(service_id)
        .bind(live_session_id)
        .bind(submitted_by)
        .bind(discount_decimal)
        .bind(promo_decimal)
        .bind(stock_cap)
        .bind(availability.as_str())
        .bind(status)
        .bind(metadata)
        .fetch_one(pool)
        .await?;

        if snapshot.is_some() || highlighted.is_some() || priority_score.is_some() {
            let snapshot_value = snapshot.unwrap_or_else(|| json!({ "service_id": service_id }));
            Self::save_product_snapshot(
                pool,
                entry.id,
                availability.as_str(),
                snapshot_value,
                highlighted.unwrap_or(false),
                priority_score.unwrap_or(0),
            )
            .await?;
        }

        // Incrémenter métrique entrées totales
        crate::metrics::GLOBAL_PROMO_METRICS
            .entries_total
            .fetch_add(1, std::sync::atomic::Ordering::Relaxed);

        Ok(entry)
    }

    pub async fn list_entries_for_event(
        pool: &PgPool,
        event_id: Uuid,
    ) -> AppResult<Vec<GlobalPromoEntry>> {
        let entries = sqlx::query_as::<_, GlobalPromoEntry>(
            r#"
            SELECT * FROM global_promo_entries
            WHERE event_id = $1
            ORDER BY updated_at DESC
            "#,
        )
        .bind(event_id)
        .fetch_all(pool)
        .await?;

        Ok(entries)
    }

    pub async fn list_available_events(pool: &PgPool) -> AppResult<Vec<GlobalPromoEvent>> {
        let now = Utc::now();
        let events = sqlx::query_as::<_, GlobalPromoEvent>(
            r#"
            SELECT *
            FROM global_promo_events
            WHERE status IN ('scheduled', 'live')
              AND ends_at >= $1
            ORDER BY starts_at ASC
            "#,
        )
        .bind(now)
        .fetch_all(pool)
        .await?;

        Ok(events)
    }

    pub async fn list_entries_for_user(
        pool: &PgPool,
        user_id: i32,
    ) -> AppResult<Vec<GlobalPromoEntry>> {
        let entries = sqlx::query_as::<_, GlobalPromoEntry>(
            r#"
            SELECT *
            FROM global_promo_entries
            WHERE submitted_by_user_id = $1
            ORDER BY updated_at DESC
            "#,
        )
        .bind(user_id)
        .fetch_all(pool)
        .await?;

        Ok(entries)
    }

    pub async fn save_product_snapshot(
        pool: &PgPool,
        entry_id: Uuid,
        availability: &str,
        snapshot: Value,
        highlighted: bool,
        priority_score: i32,
    ) -> AppResult<()> {
        validate_availability(availability)?;

        sqlx::query(
            r#"
            INSERT INTO global_promo_products (
                promo_entry_id,
                snapshot,
                availability,
                priority_score,
                highlighted
            )
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (promo_entry_id)
            DO UPDATE SET
                snapshot = EXCLUDED.snapshot,
                availability = EXCLUDED.availability,
                priority_score = EXCLUDED.priority_score,
                highlighted = EXCLUDED.highlighted,
                updated_at = NOW()
            "#,
        )
        .bind(entry_id)
        .bind(snapshot)
        .bind(availability)
        .bind(priority_score)
        .bind(highlighted)
        .execute(pool)
        .await?;

        Ok(())
    }

    pub async fn regenerate_snapshot_from_service(
        pool: &PgPool,
        entry_id: Uuid,
        highlighted: bool,
        priority_score: i32,
    ) -> AppResult<()> {
        let row = sqlx::query(
            r#"
            SELECT
                e.availability,
                e.service_id,
                s.data AS service_data
            FROM global_promo_entries e
            JOIN services s ON s.id = e.service_id
            WHERE e.id = $1
            "#,
        )
        .bind(entry_id)
        .fetch_optional(pool)
        .await?;

        let Some(row) = row else {
            return Err(AppError::NotFound(
                "Entrée de promotion introuvable.".into(),
            ));
        };

        let service_id: i32 = row.get::<i32, _>("service_id");
        let availability: String = row.get::<String, _>("availability");
        let service_data: Value = row.get::<Value, _>("service_data");
        let snapshot = build_snapshot_from_service(service_id, service_data);

        Self::save_product_snapshot(
            pool,
            entry_id,
            availability.as_str(),
            snapshot,
            highlighted,
            priority_score,
        )
        .await
    }

    pub async fn list_active_catalog(
        pool: &PgPool,
        query: GlobalPromoCatalogQuery,
        cache: Option<&crate::services::global_promo_cache::GlobalPromoCache>,
    ) -> AppResult<GlobalPromoCatalogPage> {
        // ✅ NOUVEAU: Vérifier le cache d'abord
        if let Some(cache_service) = cache {
            if let Ok(Some(cached_page)) = cache_service.get_catalog_page(&query).await {
                log::debug!("✅ Catalogue récupéré depuis le cache Redis");
                return Ok(cached_page);
            }
        }

        let GlobalPromoCatalogQuery {
            page,
            page_size,
            highlighted_only,
            event_slug,
            availability,
            status,
            search,
            sort,
            starts_within_minutes,
        } = query;

        // Cloner immédiatement les valeurs nécessaires pour éviter les moves partiels
        let event_slug_clone = event_slug.clone();
        let availability_clone = availability.clone();
        let status_clone = status.clone();
        let search_clone = search.clone();

        let page = page.unwrap_or(1).max(1);
        let page_size = page_size.unwrap_or(24).clamp(1, 100);
        let offset = (page - 1) * page_size;
        let highlighted_only = highlighted_only.unwrap_or(false);
        let start_filter_opt = starts_within_minutes;
        let imminence_minutes = start_filter_opt.unwrap_or(180).clamp(1, 1440);
        let sort_label = sort.unwrap_or_else(|| "priority".to_string());

        let now = Utc::now();
        let mut builder = QueryBuilder::<Postgres>::new(
            r#"
            SELECT
                e.*,
                ev.id AS event_id_alias,
                ev.slug AS event_slug,
                ev.theme AS event_theme,
                ev.display_name AS event_display_name,
                ev.description AS event_description,
                ev.starts_at AS event_starts_at,
                ev.ends_at AS event_ends_at,
                ev.recurrence_rule AS event_recurrence_rule,
                ev.status AS event_status,
                ev.config AS event_config,
                ev.created_by_user_id AS event_created_by_user_id,
                ev.created_at AS event_created_at,
                ev.updated_at AS event_updated_at,
                gp.id AS product_id,
                gp.promo_entry_id AS product_entry_id,
                gp.snapshot AS product_snapshot,
                gp.availability AS product_availability,
                gp.priority_score AS product_priority_score,
                gp.highlighted AS product_highlighted,
                gp.created_at AS product_created_at,
                gp.updated_at AS product_updated_at,
                COUNT(*) OVER() AS total_count
            FROM global_promo_entries e
            JOIN global_promo_events ev ON ev.id = e.event_id
            LEFT JOIN global_promo_products gp ON gp.promo_entry_id = e.id
            WHERE
                ev.status IN ('scheduled', 'live')
                AND e.status IN ('approved', 'published', 'pending_review')
                AND ev.ends_at >=
            "#,
        );
        builder.push_bind(now);

        if highlighted_only {
            builder.push(" AND COALESCE(gp.highlighted, FALSE) = TRUE");
        }

        if let Some(slug) = event_slug {
            let trimmed = slug.trim().to_string();
            if !trimmed.is_empty() {
                builder.push(" AND ev.slug = ");
                builder.push_bind(trimmed);
            }
        }

        if let Some(avail) = availability {
            validate_availability(avail.as_str())?;
            builder.push(" AND e.availability = ");
            builder.push_bind(avail);
        }

        if let Some(status_value) = status {
            validate_entry_status(status_value.as_str())?;
            builder.push(" AND e.status = ");
            builder.push_bind(status_value);
        }

        if let Some(ref search_value) = search {
            let trimmed = search_value.trim().to_string();
            if !trimmed.is_empty() {
                let like_pattern = format!("%{}%", trimmed);
                builder.push(" AND (ev.display_name ILIKE ");
                builder.push_bind(like_pattern.clone());
                builder.push(" OR ev.theme ILIKE ");
                builder.push_bind(like_pattern.clone());
                builder.push(" OR gp.snapshot::text ILIKE ");
                builder.push_bind(like_pattern);
                if let Ok(service_id) = trimmed.parse::<i32>() {
                    builder.push(" OR e.service_id = ");
                    builder.push_bind(service_id);
                }
                builder.push(')');
            }
        }

        if let Some(start_filter) = start_filter_opt {
            if start_filter > 0 {
                let horizon = now + Duration::minutes(start_filter.clamp(1, 1440));
                builder.push(" AND ev.starts_at <= ");
                builder.push_bind(horizon);
            }
        }

        match sort_label.as_str() {
            "ending_soon" => builder.push(
                " ORDER BY ev.ends_at ASC, gp.highlighted DESC, gp.priority_score DESC, e.updated_at DESC ",
            ),
            "recent" => builder.push(" ORDER BY e.updated_at DESC "),
            "newest_event" => {
                builder.push(" ORDER BY ev.starts_at ASC, gp.priority_score DESC, e.updated_at DESC ")
            }
            _ => builder.push(
                " ORDER BY gp.highlighted DESC, gp.priority_score DESC, ev.starts_at ASC, e.updated_at DESC ",
            ),
        };

        builder.push(" LIMIT ");
        builder.push_bind(page_size);
        builder.push(" OFFSET ");
        builder.push_bind(offset);

        let rows = builder.build().fetch_all(pool).await?;
        let threshold = now + Duration::minutes(imminence_minutes);

        let mut total = 0_i64;
        let mut items = Vec::with_capacity(rows.len());
        for row in rows {
            if total == 0 {
                total = row.get::<Option<i64>, _>("total_count").unwrap_or(0);
            }

            let event = map_event_from_row(&row)?;
            let entry = <GlobalPromoEntry as FromRow<PgRow>>::from_row(&row)?;
            let product_snapshot = map_product_from_row(&row)?;
            let event_is_live = event.status == "live";
            let event_is_imminent = event.status == "scheduled" && event.starts_at <= threshold;

            items.push(GlobalPromoCatalogItem {
                event,
                entry,
                product: product_snapshot,
                badges: GlobalPromoCatalogBadges {
                    event_is_live,
                    event_is_imminent,
                },
            });
        }

        if total == 0 {
            total = items.len() as i64;
        }

        let has_more = (page * page_size) < total;
        // Incrémenter métriques catalogue
        crate::metrics::GLOBAL_PROMO_METRICS
            .catalog_page_views_total
            .fetch_add(1, std::sync::atomic::Ordering::Relaxed);

        // Si une recherche a été effectuée
        let search_was_performed = search
            .as_ref()
            .map(|s| !s.trim().is_empty())
            .unwrap_or(false);
        if search_was_performed {
            crate::metrics::GLOBAL_PROMO_METRICS
                .catalog_searches_total
                .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        }

        let result = GlobalPromoCatalogPage {
            items,
            page,
            page_size,
            total,
            has_more,
        };

        // ✅ NOUVEAU: Mettre en cache le résultat
        if let Some(cache_service) = cache {
            // Cloner les valeurs nécessaires pour le cache avant la déstructuration
            let cache_query = GlobalPromoCatalogQuery {
                page: Some(page),
                page_size: Some(page_size),
                highlighted_only: Some(highlighted_only),
                event_slug: event_slug_clone,
                availability: availability_clone,
                status: status_clone,
                search: search_clone,
                sort: Some(sort_label.clone()),
                starts_within_minutes: start_filter_opt,
            };
            if let Err(e) = cache_service.set_catalog_page(&cache_query, &result).await {
                log::warn!("⚠️ Impossible de mettre en cache le catalogue: {:?}", e);
            }
        }

        Ok(result)
    }

    pub async fn upsert_entry_for_owner(
        pool: &PgPool,
        event_id: Uuid,
        user_id: i32,
        mut payload: UpsertGlobalPromoEntryRequest,
    ) -> AppResult<GlobalPromoEntry> {
        ensure_service_ownership(pool, payload.service_id, user_id).await?;

        if payload.metadata.is_null() {
            payload.metadata = json!({
                "source": "self_service",
                "submitted_by": user_id
            });
        }
        payload.status = Some("pending_review".to_string());

        Self::upsert_entry(pool, event_id, payload, user_id).await
    }

    pub async fn review_entry(
        pool: &PgPool,
        entry_id: Uuid,
        reviewer_id: i32,
        payload: ReviewGlobalPromoEntryRequest,
    ) -> AppResult<GlobalPromoEntry> {
        let ReviewGlobalPromoEntryRequest {
            status,
            message,
            highlighted,
            priority_score,
            metadata_patch,
        } = payload;

        let decision = status.to_lowercase();
        if decision != "approved" && decision != "rejected" {
            return Err(AppError::BadRequest(
                "Le workflow accepte uniquement les statuts approved ou rejected.".into(),
            ));
        }

        let row = sqlx::query(
            r#"
            SELECT
                e.status,
                e.metadata,
                e.submitted_by_user_id,
                e.service_id,
                e.availability,
                ev.display_name AS event_display_name
            FROM global_promo_entries e
            JOIN global_promo_events ev ON ev.id = e.event_id
            WHERE e.id = $1
            "#,
        )
        .bind(entry_id)
        .fetch_optional(pool)
        .await?;

        let Some(row) = row else {
            return Err(AppError::NotFound(
                "Entrée promotionnelle introuvable pour revue.".into(),
            ));
        };

        let current_status: String = row.get::<String, _>("status");
        if matches!(current_status.as_str(), "published" | "ended") {
            return Err(AppError::BadRequest(
                "Impossible de modifier une entrée déjà publiée ou terminée.".into(),
            ));
        }
        if current_status == decision {
            return Err(AppError::BadRequest(format!(
                "L'entrée est déjà en statut {decision}."
            )));
        }

        let mut metadata: Value = row.get::<Value, _>("metadata");
        if !metadata.is_object() {
            metadata = json!({});
        }
        if let Some(patch) = metadata_patch {
            merge_json(&mut metadata, patch);
        }

        let mut review_block = json!({
            "status": decision,
            "reviewed_by": reviewer_id,
            "reviewed_at": Utc::now(),
        });
        if let Some(note) = &message {
            review_block["message"] = Value::String(note.clone());
        }
        metadata
            .as_object_mut()
            .expect("metadata object")
            .insert("review".to_string(), review_block);

        let entry = sqlx::query_as::<_, GlobalPromoEntry>(
            r#"
            UPDATE global_promo_entries
            SET status = $2,
                metadata = $3,
                updated_at = NOW()
            WHERE id = $1
            RETURNING *
            "#,
        )
        .bind(entry_id)
        .bind(decision.as_str())
        .bind(&metadata)
        .fetch_one(pool)
        .await?;

        if highlighted.is_some() || priority_score.is_some() {
            let availability: String = row.get::<String, _>("availability");
            sqlx::query(
                r#"
                INSERT INTO global_promo_products (
                    promo_entry_id,
                    snapshot,
                    availability,
                    priority_score,
                    highlighted
                )
                VALUES ($1, '{}'::jsonb, $2, COALESCE($3, 0), COALESCE($4, FALSE))
                ON CONFLICT (promo_entry_id)
                DO UPDATE SET
                    priority_score = COALESCE($3, global_promo_products.priority_score),
                    highlighted = COALESCE($4, global_promo_products.highlighted),
                    updated_at = NOW()
                "#,
            )
            .bind(entry_id)
            .bind(&availability)
            .bind(priority_score)
            .bind(highlighted)
            .execute(pool)
            .await?;
        }

        if let Some(user_id) = row.try_get::<Option<i32>, _>("submitted_by_user_id")? {
            let promo_info = PromoEntryInfo {
                user_id,
                entry_id,
                event_name: row.get::<String, _>("event_display_name"),
                service_id: row.get::<i32, _>("service_id"),
            };

            let (notif_type, title, mut body) = if decision == "approved" {
                (
                    NotificationType::GlobalPromoEntryApproved,
                    format!("✅ Promo approuvée: {}", promo_info.event_name),
                    format!(
                        "Votre service #{} est validé pour la campagne globale.",
                        promo_info.service_id
                    ),
                )
            } else {
                (
                    NotificationType::GlobalPromoEntryRejected,
                    format!("❌ Promo refusée: {}", promo_info.event_name),
                    format!(
                        "Votre service #{} n'a pas été retenu pour cette campagne.",
                        promo_info.service_id
                    ),
                )
            };

            if let Some(note) = &message {
                body.push_str("\n\n");
                body.push_str(note);
            }

            send_entry_notification(pool, &promo_info, notif_type, title, body).await;
        }

        Ok(entry)
    }

    pub async fn review_entries_bulk(
        pool: &PgPool,
        reviewer_id: i32,
        bulk: BulkReviewGlobalPromoEntryRequest,
    ) -> AppResult<Vec<GlobalPromoEntry>> {
        if bulk.entry_ids.is_empty() {
            return Ok(Vec::new());
        }

        let mut updated = Vec::with_capacity(bulk.entry_ids.len());
        for entry_id in bulk.entry_ids {
            let entry = Self::review_entry(
                pool,
                entry_id,
                reviewer_id,
                ReviewGlobalPromoEntryRequest {
                    status: bulk.status.clone(),
                    message: bulk.message.clone(),
                    highlighted: bulk.highlighted,
                    priority_score: bulk.priority_score,
                    metadata_patch: bulk.metadata_patch.clone(),
                },
            )
            .await?;
            updated.push(entry);
        }

        Ok(updated)
    }

    pub async fn process_scheduler(state: Arc<AppState>) {
        if let Err(err) = Self::process_scheduler_inner(state.clone()).await {
            error!("process_scheduler global promos failed: {:?}", err);
        }
    }

    async fn process_scheduler_inner(state: Arc<AppState>) -> AppResult<()> {
        let pool = &state.pg;
        let now = Utc::now();
        let notification_queue = state.notification_queue.as_deref();

        let activated = activate_due_events(pool, now, notification_queue).await?;
        if activated > 0 {
            info!(
                "[GlobalPromo] {} évènement(s) passent en statut LIVE",
                activated
            );
        }

        let archived = archive_finished_events(pool, now).await?;
        if archived > 0 {
            info!(
                "[GlobalPromo] {} évènement(s) terminés et archivés",
                archived
            );
        }

        let published_entries = publish_entries_for_live_events(pool).await?;
        notify_published_entries(pool, published_entries).await;

        let ended_entries = close_entries_for_archived_events(pool).await?;
        notify_ended_entries(pool, ended_entries).await;

        Ok(())
    }

    /// ✅ NOUVEAU : Récupère le prix réel d'un produit en tenant compte des promotions globales actives
    /// Utilisé par le système de livraison pour calculer les prix avec promotions
    pub async fn get_real_product_price(
        pool: &PgPool,
        service_id: i32,
        _product_index: Option<i32>, // Réservé pour usage futur (promotions par produit)
        base_price: f64,
    ) -> AppResult<f64> {
        let now = Utc::now();

        // Chercher une promotion active pour ce service
        let promo_entry = sqlx::query_as::<_, GlobalPromoEntry>(
            r#"
            SELECT e.*
            FROM global_promo_entries e
            JOIN global_promo_events ev ON ev.id = e.event_id
            WHERE e.service_id = $1
                AND e.status IN ('approved', 'published')
                AND ev.status IN ('scheduled', 'live')
                AND ev.starts_at <= $2
                AND ev.ends_at >= $2
            ORDER BY ev.starts_at DESC, e.created_at DESC
            LIMIT 1
            "#,
        )
        .bind(service_id)
        .bind(now)
        .fetch_optional(pool)
        .await?;

        if let Some(entry) = promo_entry {
            // Priorité 1 : Prix promotionnel fixe
            if let Some(promo_price) = entry.promo_price_cfa {
                if promo_price > 0.0 && promo_price < base_price {
                    return Ok(promo_price);
                }
            }

            // Priorité 2 : Pourcentage de réduction
            if let Some(discount_pct) = entry.discount_percentage {
                if discount_pct > 0.0 && discount_pct <= 100.0 {
                    let discounted = base_price * (1.0 - discount_pct / 100.0);
                    if discounted > 0.0 {
                        return Ok(discounted);
                    }
                }
            }
        }

        // Pas de promotion active : retourner le prix de base
        Ok(base_price)
    }
}

fn normalize_slug(input: &str) -> String {
    input
        .trim()
        .to_lowercase()
        .replace([' ', '/'], "-")
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '-')
        .collect()
}

fn validate_availability(value: &str) -> AppResult<()> {
    if VALID_ENTRY_AVAILABILITIES.contains(&value) {
        Ok(())
    } else {
        Err(AppError::BadRequest(format!(
            "Disponibilité inconnue: {} (attendu: online, live ou both)",
            value
        )))
    }
}

fn validate_entry_status(value: &str) -> AppResult<()> {
    if VALID_ENTRY_STATUSES.contains(&value) {
        Ok(())
    } else {
        Err(AppError::BadRequest(format!(
            "Statut de promotion invalide: {}",
            value
        )))
    }
}

fn to_decimal_percentage(value: Option<f64>) -> AppResult<Option<BigDecimal>> {
    if let Some(percent) = value {
        if !(0.0..=100.0).contains(&percent) {
            return Err(AppError::BadRequest(
                "Le pourcentage de réduction doit être compris entre 0 et 100.".into(),
            ));
        }
        Ok(Some(BigDecimal::from_str(&percent.to_string()).map_err(
            |_| AppError::BadRequest("Réduction invalide.".into()),
        )?))
    } else {
        Ok(None)
    }
}

fn to_decimal_price(value: Option<f64>) -> AppResult<Option<BigDecimal>> {
    if let Some(price) = value {
        if price < 0.0 {
            return Err(AppError::BadRequest(
                "Le prix promotionnel doit être positif.".into(),
            ));
        }
        Ok(Some(BigDecimal::from_str(&price.to_string()).map_err(
            |_| AppError::BadRequest("Prix promotionnel invalide.".into()),
        )?))
    } else {
        Ok(None)
    }
}

fn build_snapshot_from_service(service_id: i32, service_data: Value) -> Value {
    let title = service_data
        .get("nom_service")
        .or_else(|| service_data.get("title"))
        .cloned()
        .unwrap_or_else(|| json!(format!("Service #{}", service_id)));

    let price = service_data
        .get("prix")
        .or_else(|| service_data.get("price"))
        .cloned()
        .unwrap_or(Value::Null);

    let images = service_data
        .get("medias")
        .or_else(|| service_data.get("gallery"))
        .cloned()
        .unwrap_or_else(|| json!([]));

    json!({
        "service_id": service_id,
        "title": title,
        "price": price,
        "images": images,
        "raw": service_data,
    })
}

fn map_event_from_row(row: &PgRow) -> AppResult<GlobalPromoEvent> {
    Ok(GlobalPromoEvent {
        id: row.get::<Uuid, _>("event_id_alias"),
        slug: row.get::<String, _>("event_slug"),
        theme: row.get::<String, _>("event_theme"),
        display_name: row.get::<String, _>("event_display_name"),
        description: row.get::<Option<String>, _>("event_description"),
        starts_at: row.get::<DateTime<Utc>, _>("event_starts_at"),
        ends_at: row.get::<DateTime<Utc>, _>("event_ends_at"),
        recurrence_rule: row.get::<Option<String>, _>("event_recurrence_rule"),
        status: row.get::<String, _>("event_status"),
        config: row.get::<Value, _>("event_config"),
        created_by_user_id: row.get::<Option<i32>, _>("event_created_by_user_id"),
        created_at: row.get::<DateTime<Utc>, _>("event_created_at"),
        updated_at: row.get::<DateTime<Utc>, _>("event_updated_at"),
    })
}

fn map_product_from_row(row: &PgRow) -> AppResult<Option<GlobalPromoProductSnapshot>> {
    let id: Option<Uuid> = row.get::<Option<Uuid>, _>("product_id");
    if id.is_none() {
        return Ok(None);
    }

    Ok(Some(GlobalPromoProductSnapshot {
        id: id.unwrap(),
        promo_entry_id: row.get::<Uuid, _>("product_entry_id"),
        availability: row.get::<String, _>("product_availability"),
        snapshot: row
            .get::<Option<Value>, _>("product_snapshot")
            .unwrap_or_else(|| json!({})),
        priority_score: row
            .get::<Option<i32>, _>("product_priority_score")
            .unwrap_or(0),
        highlighted: row
            .get::<Option<bool>, _>("product_highlighted")
            .unwrap_or(false),
        created_at: row.get::<DateTime<Utc>, _>("product_created_at"),
        updated_at: row.get::<DateTime<Utc>, _>("product_updated_at"),
    }))
}

fn merge_json(target: &mut Value, patch: Value) {
    match (target, patch) {
        (Value::Object(target_map), Value::Object(patch_map)) => {
            for (key, value) in patch_map {
                if let Some(existing) = target_map.get_mut(&key) {
                    merge_json(existing, value);
                } else {
                    target_map.insert(key, value);
                }
            }
        }
        (target_slot, patch_value) => {
            *target_slot = patch_value;
        }
    }
}

#[derive(Debug, Clone)]
struct PromoEntryInfo {
    user_id: i32,
    entry_id: Uuid,
    event_name: String,
    service_id: i32,
}

async fn activate_due_events(
    pool: &PgPool,
    now: DateTime<Utc>,
    notification_queue: Option<&crate::services::notification_queue::NotificationQueue>,
) -> AppResult<usize> {
    let rows = sqlx::query(
        r#"
        SELECT id, display_name
        FROM global_promo_events
        WHERE status = 'scheduled' AND starts_at <= $1
        "#,
    )
    .bind(now)
    .fetch_all(pool)
    .await?;

    let mut counter = 0usize;
    for row in rows {
        let event_id: Uuid = row.get::<Uuid, _>("id");
        let _event_name: String = row.get::<String, _>("display_name");

        sqlx::query(
            "UPDATE global_promo_events SET status = 'live', updated_at = NOW() WHERE id = $1",
        )
        .bind(event_id)
        .execute(pool)
        .await?;

        // ✅ NOUVEAU : Notifier tous les prestataires quand un événement devient "live"
        // Récupérer l'événement complet pour la notification
        if let Ok(Some(event)) =
            sqlx::query_as::<_, GlobalPromoEvent>("SELECT * FROM global_promo_events WHERE id = $1")
                .bind(event_id)
                .fetch_optional(pool)
                .await
        {
            // Utiliser la queue de notifications si disponible
            if let Err(err) =
                notify_all_prestataires_event_created(pool, &event, notification_queue).await
            {
                warn!(
                    "Failed to notify prestataires about activated event: {:?}",
                    err
                );
            }
        }

        counter += 1;
    }

    Ok(counter)
}

async fn archive_finished_events(pool: &PgPool, now: DateTime<Utc>) -> AppResult<usize> {
    let rows = sqlx::query(
        r#"
        SELECT id, display_name
        FROM global_promo_events
        WHERE status IN ('scheduled','live') AND ends_at <= $1
        "#,
    )
    .bind(now)
    .fetch_all(pool)
    .await?;

    let mut counter = 0usize;
    for row in rows {
        let event_id: Uuid = row.get::<Uuid, _>("id");
        sqlx::query(
            "UPDATE global_promo_events SET status = 'archived', updated_at = NOW() WHERE id = $1",
        )
        .bind(event_id)
        .execute(pool)
        .await?;
        counter += 1;
    }

    Ok(counter)
}

async fn publish_entries_for_live_events(pool: &PgPool) -> AppResult<Vec<PromoEntryInfo>> {
    let rows = sqlx::query(
        r#"
        SELECT
            e.id AS entry_id,
            e.service_id,
            e.submitted_by_user_id,
            ev.display_name AS event_display_name
        FROM global_promo_entries e
        JOIN global_promo_events ev ON ev.id = e.event_id
        WHERE ev.status = 'live'
          AND e.status = 'approved'
        "#,
    )
    .fetch_all(pool)
    .await?;

    let mut entries = Vec::with_capacity(rows.len());
    for row in rows {
        let entry_id: Uuid = row.get::<Uuid, _>("entry_id");
        sqlx::query(
            "UPDATE global_promo_entries SET status = 'published', published_at = NOW(), updated_at = NOW() WHERE id = $1",
        )
        .bind(entry_id)
        .execute(pool)
        .await?;

        if let Some(user_id) = row.try_get::<Option<i32>, _>("submitted_by_user_id")? {
            entries.push(PromoEntryInfo {
                user_id,
                entry_id,
                event_name: row.get::<String, _>("event_display_name"),
                service_id: row.get::<i32, _>("service_id"),
            });
        }
    }

    Ok(entries)
}

async fn close_entries_for_archived_events(pool: &PgPool) -> AppResult<Vec<PromoEntryInfo>> {
    let rows = sqlx::query(
        r#"
        SELECT
            e.id AS entry_id,
            e.service_id,
            e.submitted_by_user_id,
            ev.display_name AS event_display_name
        FROM global_promo_entries e
        JOIN global_promo_events ev ON ev.id = e.event_id
        WHERE ev.status = 'archived'
          AND e.status <> 'ended'
        "#,
    )
    .fetch_all(pool)
    .await?;

    let mut entries = Vec::with_capacity(rows.len());
    for row in rows {
        let entry_id: Uuid = row.get::<Uuid, _>("entry_id");
        sqlx::query(
            "UPDATE global_promo_entries SET status = 'ended', updated_at = NOW() WHERE id = $1",
        )
        .bind(entry_id)
        .execute(pool)
        .await?;

        if let Some(user_id) = row.try_get::<Option<i32>, _>("submitted_by_user_id")? {
            entries.push(PromoEntryInfo {
                user_id,
                entry_id,
                event_name: row.get::<String, _>("event_display_name"),
                service_id: row.get::<i32, _>("service_id"),
            });
        }
    }

    Ok(entries)
}

async fn notify_published_entries(pool: &PgPool, entries: Vec<PromoEntryInfo>) {
    for entry in entries {
        let title = format!("🎉 Promo lancée: {}", entry.event_name);
        let body = format!(
            "Votre service #{} est désormais visible dans la campagne.",
            entry.service_id
        );
        send_entry_notification(
            pool,
            &entry,
            NotificationType::GlobalPromoEntryPublished,
            title,
            body,
        )
        .await;
    }
}

async fn notify_ended_entries(pool: &PgPool, entries: Vec<PromoEntryInfo>) {
    for entry in entries {
        let title = format!("✅ Promo terminée: {}", entry.event_name);
        let body = format!(
            "La promotion spéciale du service #{} est maintenant close.",
            entry.service_id
        );
        send_entry_notification(
            pool,
            &entry,
            NotificationType::GlobalPromoEntryEnded,
            title,
            body,
        )
        .await;
    }
}

async fn send_entry_notification(
    pool: &PgPool,
    entry: &PromoEntryInfo,
    notif_type: NotificationType,
    title: String,
    body: String,
) {
    let metadata = json!({
        "promo_entry_id": entry.entry_id,
        "service_id": entry.service_id,
        "event_name": entry.event_name,
    });

    if let Err(err) = notification_service::create_notification(
        pool,
        entry.user_id,
        notif_type,
        title.clone(),
        body.clone(),
        Some(metadata.clone()),
    )
    .await
    {
        warn!("GlobalPromo notification DB failed: {:?}", err);
    }

    if let Err(err) = push_notification_service::send_push_notification(
        pool,
        entry.user_id,
        title,
        body,
        Some(metadata),
        Some("default".into()),
    )
    .await
    {
        warn!("GlobalPromo push notification failed: {:?}", err);
    }
}

// ✅ NOUVEAU : Notifier tous les prestataires lors de la création d'un événement Black Friday
// Version asynchrone avec queue pour gérer des milliers de prestataires
async fn notify_all_prestataires_event_created(
    pool: &PgPool,
    event: &GlobalPromoEvent,
    notification_queue: Option<&crate::services::notification_queue::NotificationQueue>,
) -> AppResult<()> {
    // Récupérer tous les prestataires (utilisateurs qui ont créé au moins un service)
    let prestataires: Vec<i32> = sqlx::query_scalar::<_, i32>(
        "SELECT DISTINCT user_id FROM services WHERE user_id IS NOT NULL AND is_active = TRUE",
    )
    .fetch_all(pool)
    .await?;

    let title = format!("🔥 Nouveau Black Friday : {}", event.display_name);
    let body = format!(
        "Une nouvelle campagne Black Friday '{}' est disponible ! Participez dès maintenant pour booster vos ventes. Cliquez pour voir les détails.",
        event.display_name
    );

    let metadata = json!({
        "event_id": event.id,
        "event_slug": event.slug,
        "event_name": event.display_name,
        "action_url": "yukpo://GlobalPromoSubmission",
        "action_text": "Participer au Black Friday"
    });

    let prestataires_count = prestataires.len();

    // ✅ NOUVEAU: Utiliser la queue si disponible (recommandé pour > 100 prestataires)
    if let Some(queue) = notification_queue {
        use crate::services::notification_queue::NotificationJob;
        use chrono::Utc;

        let mut jobs = Vec::with_capacity(prestataires.len());
        for prestataire_id in &prestataires {
            jobs.push(NotificationJob {
                user_id: *prestataire_id,
                notification_type: "GlobalPromoEventCreated".to_string(),
                title: title.clone(),
                body: body.clone(),
                metadata: Some(metadata.clone()),
                push_channel: Some("default".to_string()),
                created_at: Utc::now(),
            });
        }

        // Ajouter toutes les notifications à la queue en batch
        match queue.enqueue_notifications_batch(jobs).await {
            Ok(count) => {
                info!(
                    "✅ {} notifications ajoutées à la queue pour l'événement Black Friday: {}",
                    count, event.display_name
                );
            }
            Err(e) => {
                warn!("⚠️ Erreur ajout notifications à la queue: {:?}. Fallback vers méthode synchrone.", e);
                // Fallback vers méthode synchrone
                return notify_all_prestataires_event_created_sync(
                    pool,
                    event,
                    &prestataires,
                    &title,
                    &body,
                    &metadata,
                )
                .await;
            }
        }
    } else {
        // Fallback vers méthode synchrone si queue non disponible
        warn!("⚠️ Queue de notifications non disponible. Utilisation méthode synchrone (peut être lent pour {} prestataires)", prestataires_count);
        notify_all_prestataires_event_created_sync(
            pool,
            event,
            &prestataires,
            &title,
            &body,
            &metadata,
        )
        .await?;
    }

    Ok(())
}

// Méthode synchrone de fallback
async fn notify_all_prestataires_event_created_sync(
    pool: &PgPool,
    event: &GlobalPromoEvent,
    prestataires: &[i32],
    title: &str,
    body: &str,
    metadata: &serde_json::Value,
) -> AppResult<()> {
    let mut success_count = 0;
    let mut error_count = 0;

    for prestataire_id in prestataires {
        // Créer la notification en base
        if let Err(err) = notification_service::create_notification(
            pool,
            *prestataire_id,
            NotificationType::GlobalPromoEventCreated,
            title.to_string(),
            body.to_string(),
            Some(metadata.clone()),
        )
        .await
        {
            warn!(
                "Failed to create notification for prestataire {}: {:?}",
                prestataire_id, err
            );
            error_count += 1;
            continue;
        }

        // Envoyer la push notification
        if let Err(err) = push_notification_service::send_push_notification(
            pool,
            *prestataire_id,
            title.to_string(),
            body.to_string(),
            Some(metadata.clone()),
            Some("default".into()),
        )
        .await
        {
            warn!(
                "Failed to send push notification to prestataire {}: {:?}",
                prestataire_id, err
            );
            error_count += 1;
        } else {
            success_count += 1;
        }
    }

    info!(
        "Notified {} prestataires ({} succès, {} erreurs) about new Black Friday event: {}",
        prestataires.len(),
        success_count,
        error_count,
        event.display_name
    );
    Ok(())
}

async fn ensure_service_ownership(pool: &PgPool, service_id: i32, user_id: i32) -> AppResult<()> {
    let owner = sqlx::query_scalar::<_, i32>("SELECT user_id FROM services WHERE id = $1")
        .bind(service_id)
        .fetch_optional(pool)
        .await?;

    let Some(owner_id) = owner else {
        return Err(AppError::NotFound(
            "Service introuvable pour rattachement à la campagne.".into(),
        ));
    };

    if owner_id != user_id {
        return Err(AppError::Forbidden(
            "Vous ne pouvez rattacher que vos propres services aux promotions globales.".into(),
        ));
    }

    Ok(())
}
