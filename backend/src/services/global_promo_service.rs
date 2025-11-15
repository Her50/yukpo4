use bigdecimal::{BigDecimal, FromPrimitive};
use chrono::{DateTime, Duration, Utc};
use log::{error, info, warn};
use serde_json::{json, Value};
use sqlx::{postgres::PgRow, FromRow, PgPool, Postgres, QueryBuilder, Row};
use std::sync::Arc;
use uuid::Uuid;

use crate::{
    core::types::{AppError, AppResult},
    models::global_promo_model::{
        CreateGlobalPromoEventRequest, GlobalPromoCatalogBadges, GlobalPromoCatalogItem,
        GlobalPromoCatalogPage, GlobalPromoCatalogQuery, GlobalPromoEntry, GlobalPromoEvent,
        GlobalPromoProductSnapshot, ReviewGlobalPromoEntryRequest, UpdateGlobalPromoEventRequest,
        UpsertGlobalPromoEntryRequest,
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

        let service_id: i32 = row.try_get("service_id")?;
        let availability: String = row.try_get("availability")?;
        let service_data: Value = row.try_get("service_data")?;
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
    ) -> AppResult<GlobalPromoCatalogPage> {
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

        if let Some(search_value) = search {
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
                total = row.try_get::<i64, _>("total_count").unwrap_or(0);
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
        Ok(GlobalPromoCatalogPage {
            items,
            page,
            page_size,
            total,
            has_more,
        })
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

        let current_status: String = row.try_get("status")?;
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

        let mut metadata: Value = row.try_get("metadata")?;
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
            let availability: String = row.try_get("availability")?;
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
                event_name: row.try_get("event_display_name")?,
                service_id: row.try_get("service_id")?,
            };

            let (notif_type, mut title, mut body) = if decision == "approved" {
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

    pub async fn process_scheduler(state: Arc<AppState>) {
        if let Err(err) = Self::process_scheduler_inner(state.clone()).await {
            error!("process_scheduler global promos failed: {:?}", err);
        }
    }

    async fn process_scheduler_inner(state: Arc<AppState>) -> AppResult<()> {
        let pool = &state.pg;
        let now = Utc::now();

        let activated = activate_due_events(pool, now).await?;
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
        Ok(Some(BigDecimal::from_f64(percent).ok_or_else(|| {
            AppError::BadRequest("Réduction invalide.".into())
        })?))
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
        Ok(Some(BigDecimal::from_f64(price).ok_or_else(|| {
            AppError::BadRequest("Prix promotionnel invalide.".into())
        })?))
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
        id: row.try_get("event_id_alias")?,
        slug: row.try_get("event_slug")?,
        theme: row.try_get("event_theme")?,
        display_name: row.try_get("event_display_name")?,
        description: row.try_get("event_description")?,
        starts_at: row.try_get("event_starts_at")?,
        ends_at: row.try_get("event_ends_at")?,
        recurrence_rule: row.try_get("event_recurrence_rule")?,
        status: row.try_get("event_status")?,
        config: row.try_get("event_config")?,
        created_by_user_id: row.try_get("event_created_by_user_id")?,
        created_at: row.try_get("event_created_at")?,
        updated_at: row.try_get("event_updated_at")?,
    })
}

fn map_product_from_row(row: &PgRow) -> AppResult<Option<GlobalPromoProductSnapshot>> {
    let id: Option<Uuid> = row.try_get("product_id")?;
    if id.is_none() {
        return Ok(None);
    }

    Ok(Some(GlobalPromoProductSnapshot {
        id: id.unwrap(),
        promo_entry_id: row.try_get("product_entry_id")?,
        availability: row.try_get("product_availability")?,
        snapshot: row
            .try_get::<Option<Value>, _>("product_snapshot")?
            .unwrap_or_else(|| json!({})),
        priority_score: row
            .try_get::<Option<i32>, _>("product_priority_score")?
            .unwrap_or(0),
        highlighted: row
            .try_get::<Option<bool>, _>("product_highlighted")?
            .unwrap_or(false),
        created_at: row.try_get("product_created_at")?,
        updated_at: row.try_get("product_updated_at")?,
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

async fn activate_due_events(pool: &PgPool, now: DateTime<Utc>) -> AppResult<usize> {
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
        let event_id: Uuid = row.try_get("id")?;
        sqlx::query(
            "UPDATE global_promo_events SET status = 'live', updated_at = NOW() WHERE id = $1",
        )
        .bind(event_id)
        .execute(pool)
        .await?;
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
        let event_id: Uuid = row.try_get("id")?;
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
        let entry_id: Uuid = row.try_get("entry_id")?;
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
                event_name: row.try_get("event_display_name")?,
                service_id: row.try_get("service_id")?,
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
        let entry_id: Uuid = row.try_get("entry_id")?;
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
                event_name: row.try_get("event_display_name")?,
                service_id: row.try_get("service_id")?,
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
