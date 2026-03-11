use std::collections::{HashMap, HashSet};
use std::sync::Arc;

use chrono::{Duration, Utc};
use jsonwebtoken::{encode, EncodingKey, Header};
use rand::{distributions::Alphanumeric, Rng};
use reqwest::Client;
use serde::Serialize;
use serde_json::{json, Value};
use sqlx::{FromRow, PgPool, Postgres, Row, Transaction};
use uuid::Uuid;

#[derive(FromRow)]
struct LiveSessionAnalyticsRow {
    id: uuid::Uuid,
    host_user_id: i32,
    service_id: Option<i32>,
    title: String,
    description: Option<String>,
    status: String,
    start_at: chrono::DateTime<Utc>,
    end_at: Option<chrono::DateTime<Utc>>,
    livekit_room_name: Option<String>,
    livekit_participant_identity: Option<String>,
    livekit_ingress_id: Option<String>,
    livekit_ingress_url: Option<String>,
    stream_key: Option<String>,
    webrtc_url: Option<String>,
    hls_url: Option<String>,
    fallback_rtmp_url: Option<String>,
    fallback_hls_url: Option<String>,
    current_viewers: i32,
    peak_viewers: i32,
    total_watch_time_seconds: i64,
    metadata: Value,
    created_at: chrono::DateTime<Utc>,
    updated_at: chrono::DateTime<Utc>,
    analytics_live_session_id: uuid::Uuid,
    #[sqlx(try_from = "i64")]
    analytics_total_viewers: i32,
    #[sqlx(try_from = "i64")]
    analytics_hls_viewers: i32,
    #[sqlx(try_from = "i64")]
    analytics_webrtc_viewers: i32,
    analytics_total_watch_time_seconds: i64,
    analytics_average_watch_time_seconds: f64,
    analytics_conversions: i32,
    analytics_revenue_cfa: f64,
    analytics_last_synced_at: chrono::DateTime<Utc>,
}

use crate::{
    config::live_streaming::{LiveKitIngressMode, LiveStreamingConfig},
    core::types::{AppError, AppResult},
    models::live_model::{
        CreateLiveSessionRequest, LiveJoinInformation, LiveLinkedService, LiveReplay, LiveSession,
        LiveSessionAnalytics, LiveSessionResponse, SaveReplayRequest,
    },
    services::{live_audience_service, live_flash_sale_service::LiveFlashSaleService},
    state::AppState,
    utils::livekit::generate_server_access_token,
};

const DEFAULT_MAX_PARTICIPANTS: i32 = 200;
const HOST_IDENTITY_PREFIX: &str = "host";
const VIEWER_IDENTITY_PREFIX: &str = "viewer";

pub struct LiveStreamingService;

impl LiveStreamingService {
    pub async fn list_upcoming_sessions(pool: &PgPool, limit: i64) -> AppResult<Vec<LiveSession>> {
        let records = sqlx::query_as::<_, LiveSession>(
            r#"
            SELECT *
            FROM live_sessions
            WHERE status IN ('scheduled', 'live')
            ORDER BY start_at ASC
            LIMIT $1
        "#,
        )
        .bind(limit.max(1))
        .fetch_all(pool)
        .await?;

        Ok(records)
    }

    pub async fn create_session(
        state: Arc<AppState>,
        payload: CreateLiveSessionRequest,
    ) -> AppResult<LiveSessionResponse> {
        log::info!(
            "[live] create_session: host={}, title={:?}, service_id={:?}",
            payload.host_user_id,
            payload.title,
            payload.service_id
        );

        if payload.title.trim().is_empty() {
            return Err(AppError::BadRequest(
                "Le titre du live est obligatoire".to_string(),
            ));
        }

        if payload.scheduled_start < Utc::now() - Duration::minutes(5) {
            return Err(AppError::BadRequest(
                "La date de démarrage doit être dans le futur proche".to_string(),
            ));
        }

        // Validate that the host user actually exists to prevent FK violation
        let user_exists: bool =
            sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM users WHERE id = $1)")
                .bind(payload.host_user_id)
                .fetch_one(&state.pg)
                .await
                .unwrap_or(false);

        if !user_exists {
            log::error!(
                "[live] host_user_id {} does not exist in users table",
                payload.host_user_id
            );
            return Err(AppError::BadRequest(format!(
                "Utilisateur {} introuvable",
                payload.host_user_id
            )));
        }

        // Validate service_id FK if provided — clear invalid ones to prevent FK violation
        let validated_service_id: Option<i32> = if let Some(sid) = payload.service_id {
            let service_exists: bool =
                sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM services WHERE id = $1)")
                    .bind(sid)
                    .fetch_one(&state.pg)
                    .await
                    .unwrap_or(false);

            if service_exists {
                Some(sid)
            } else {
                log::warn!(
                    "[live] service_id {} does not exist in services table, clearing to None",
                    sid
                );
                None
            }
        } else {
            None
        };

        let mut session_metadata = if payload.metadata.is_null() {
            json!({})
        } else {
            payload.metadata.clone()
        };

        if !session_metadata.is_object() {
            session_metadata = json!({});
        }

        let mut linked_ids = payload.linked_service_ids.clone();
        if let Some(primary) = validated_service_id {
            if !linked_ids.contains(&primary) {
                linked_ids.push(primary);
            }
        }
        linked_ids.sort_unstable();
        linked_ids.dedup();

        let provisioning = match Self::provision_stream_targets(state.clone(), &payload).await {
            Ok(p) => {
                log::info!("[live] provisioning OK: source={}", p.provisioning_source);
                p
            }
            Err(e) => {
                log::error!("[live] provision_stream_targets failed: {:?}", e);
                return Err(e);
            }
        };
        session_metadata["provisioning"] = json!(provisioning.provisioning_source);
        session_metadata["fallback_used"] = json!(provisioning.used_fallback);

        if let Some(ref mut metadata_map) = session_metadata.as_object_mut() {
            metadata_map.insert("linked_services".to_string(), json!(linked_ids));
        }

        let mut tx: Transaction<'_, Postgres> = state.pg.begin().await?;

        let record = sqlx::query_as::<_, LiveSession>(
            r#"
            INSERT INTO live_sessions (
                host_user_id,
                service_id,
                title,
                description,
                status,
                start_at,
                livekit_room_name,
                livekit_participant_identity,
                livekit_ingress_id,
                livekit_ingress_url,
                stream_key,
                webrtc_url,
                hls_url,
                fallback_rtmp_url,
                fallback_hls_url,
                metadata
            )
            VALUES (
                $1, $2, $3, $4, $5, $6,
                $7, $8, $9, $10,
                $11, $12, $13, $14, $15,
                $16
            )
            RETURNING *
        "#,
        )
        .bind(payload.host_user_id)
        .bind(validated_service_id)
        .bind(&payload.title)
        .bind(&payload.description)
        .bind("scheduled")
        .bind(payload.scheduled_start)
        .bind(&provisioning.livekit_room_name)
        .bind(&provisioning.host_identity)
        .bind(&provisioning.livekit_ingress_id)
        .bind(&provisioning.livekit_ingress_url)
        .bind(&provisioning.stream_key)
        .bind(&provisioning.webrtc_url)
        .bind(&provisioning.hls_url)
        .bind(&provisioning.fallback_rtmp_url)
        .bind(&provisioning.fallback_hls_url)
        .bind(session_metadata)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| {
            log::error!("[live] INSERT live_sessions failed: {}", e);
            AppError::Database(format!("Erreur création session live: {}", e))
        })?;

        log::info!("[live] live_sessions INSERT OK, id={}", record.id);

        sqlx::query(
            r#"
            INSERT INTO live_session_analytics (live_session_id)
            VALUES ($1)
            ON CONFLICT (live_session_id) DO NOTHING
        "#,
        )
        .bind(record.id)
        .execute(&mut *tx)
        .await
        .map_err(|e| {
            log::error!("[live] INSERT live_session_analytics failed: {}", e);
            AppError::Database(format!("Erreur création analytics live: {}", e))
        })?;

        tx.commit().await.map_err(|e| {
            log::error!("[live] transaction commit failed: {}", e);
            AppError::Database(format!("Erreur commit transaction live: {}", e))
        })?;

        log::info!("[live] session {} created successfully", record.id);

        let linked_services_vec = Self::load_linked_services(&state.pg, &linked_ids).await?;

        Ok(LiveSessionResponse {
            session: record,
            replay: None,
            analytics: None,
            linked_services: if linked_services_vec.is_empty() {
                None
            } else {
                Some(linked_services_vec)
            },
            flash_sales: None,
        })
    }

    pub async fn get_session(
        pool: &PgPool,
        session_id: Uuid,
    ) -> AppResult<Option<LiveSessionResponse>> {
        let session = sqlx::query_as::<_, LiveSession>("SELECT * FROM live_sessions WHERE id = $1")
            .bind(session_id)
            .fetch_optional(pool)
            .await?;

        let Some(session) = session else {
            return Ok(None);
        };

        let replay = sqlx::query_as::<_, LiveReplay>(
            r#"
            SELECT *
            FROM live_replays
            WHERE live_session_id = $1
            ORDER BY available_at DESC
            LIMIT 1
        "#,
        )
        .bind(session.id)
        .fetch_optional(pool)
        .await?;

        let analytics = sqlx::query_as::<_, LiveSessionAnalytics>(
            "SELECT * FROM live_session_analytics WHERE live_session_id = $1",
        )
        .bind(session.id)
        .fetch_optional(pool)
        .await?;

        let linked_ids = Self::extract_linked_ids(&session.metadata);
        let linked_services_vec = Self::load_linked_services(pool, &linked_ids).await?;

        let flash_sales = LiveFlashSaleService::list_flash_sales(pool, session.id).await?;

        Ok(Some(LiveSessionResponse {
            session,
            replay,
            analytics,
            linked_services: if linked_services_vec.is_empty() {
                None
            } else {
                Some(linked_services_vec)
            },
            flash_sales: if flash_sales.is_empty() {
                None
            } else {
                Some(flash_sales)
            },
        }))
    }

    pub async fn get_join_information(
        state: Arc<AppState>,
        session_id: Uuid,
        viewer_user_id: Option<i32>,
        allow_publish: bool,
    ) -> AppResult<LiveJoinInformation> {
        let Some(details) = Self::get_session(&state.pg, session_id).await? else {
            return Err(AppError::NotFound("Session live introuvable".into()));
        };

        let config = state.live_streaming.clone();

        let identity = match (allow_publish, viewer_user_id) {
            (true, Some(user_id)) => format!("{HOST_IDENTITY_PREFIX}-{user_id}"),
            (true, None) => format!("{HOST_IDENTITY_PREFIX}-anonymous"),
            (false, Some(user_id)) => format!("{VIEWER_IDENTITY_PREFIX}-{user_id}"),
            (false, None) => format!("{VIEWER_IDENTITY_PREFIX}-guest"),
        };

        let mut webrtc_token = None;
        if let (Some(room_name), true) = (
            details.session.livekit_room_name.as_ref(),
            config.is_livekit_enabled(),
        ) {
            if let (Some(api_key), Some(api_secret)) = (
                config.livekit_api_key.as_ref(),
                config.livekit_api_secret.as_ref(),
            ) {
                webrtc_token = Some(create_access_token(
                    api_key,
                    api_secret,
                    room_name,
                    &identity,
                    allow_publish,
                )?);
            }
        }

        let linked_services = details.linked_services.clone();
        let mut audience_targets: Vec<i32> = linked_services
            .as_ref()
            .map(|items| items.iter().map(|item| item.id).collect())
            .unwrap_or_default();
        if let Some(primary) = details.session.service_id {
            if !audience_targets.contains(&primary) {
                audience_targets.push(primary);
            }
        }

        let mut session_status = details.session.status.clone();

        if allow_publish && session_status != "live" {
            match sqlx::query(
                "UPDATE live_sessions SET status = 'live', updated_at = NOW() WHERE id = $1",
            )
            .bind(details.session.id)
            .execute(&state.pg)
            .await
            {
                Ok(_) => {
                    session_status = "live".to_string();
                    if !audience_targets.is_empty() {
                        if let Err(err) = live_audience_service::notify_live_starting(
                            &state.pg,
                            details.session.host_user_id,
                            &audience_targets,
                            details.session.id,
                            &details.session.title,
                        )
                        .await
                        {
                            log::warn!("Live audience live-now notification failed: {:?}", err);
                        }
                    }
                }
                Err(err) => {
                    log::warn!(
                        "Impossible de mettre à jour le statut du live {} en 'live': {:?}",
                        details.session.id,
                        err
                    );
                }
            }
        }

        Ok(LiveJoinInformation {
            session_id: details.session.id,
            title: details.session.title.clone(),
            status: session_status,
            start_at: details.session.start_at,
            host_identity: details.session.livekit_participant_identity.clone(),
            livekit_room_name: details.session.livekit_room_name.clone(),
            participant_identity: Some(identity),
            webrtc_token,
            webrtc_url: details.session.webrtc_url.clone(),
            hls_url: details.session.hls_url.clone(),
            fallback_rtmp_url: details.session.fallback_rtmp_url.clone(),
            fallback_hls_url: details.session.fallback_hls_url.clone(),
            linked_services,
            flash_sales: details.flash_sales.clone(),
        })
    }

    pub async fn save_replay(
        pool: &PgPool,
        session_id: Uuid,
        payload: SaveReplayRequest,
    ) -> AppResult<LiveReplay> {
        let mut tx: Transaction<'_, Postgres> = pool.begin().await?;

        let replay = sqlx::query_as::<_, LiveReplay>(
            r#"
            INSERT INTO live_replays (
                live_session_id,
                replay_url,
                storage_provider,
                format,
                duration_seconds,
                size_bytes
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        "#,
        )
        .bind(session_id)
        .bind(&payload.replay_url)
        .bind(&payload.storage_provider)
        .bind(&payload.format)
        .bind(payload.duration_seconds)
        .bind(payload.size_bytes)
        .fetch_one(&mut *tx)
        .await?;

        sqlx::query(
            r#"
            UPDATE live_sessions
            SET status = 'replay_ready',
                end_at = COALESCE(end_at, NOW()),
                hls_url = COALESCE(hls_url, $2),
                updated_at = NOW()
            WHERE id = $1
        "#,
        )
        .bind(session_id)
        .bind(&payload.replay_url)
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;
        Ok(replay)
    }

    pub async fn get_live_analytics(
        pool: &PgPool,
        limit: i64,
    ) -> AppResult<Vec<(LiveSession, LiveSessionAnalytics)>> {
        let rows: Vec<LiveSessionAnalyticsRow> = sqlx::query_as(
            r#"
            SELECT
                ls.id,
                ls.host_user_id,
                ls.service_id,
                ls.title,
                ls.description,
                ls.status,
                ls.start_at,
                ls.end_at,
                ls.livekit_room_name,
                ls.livekit_participant_identity,
                ls.livekit_ingress_id,
                ls.livekit_ingress_url,
                ls.stream_key,
                ls.webrtc_url,
                ls.hls_url,
                ls.fallback_rtmp_url,
                ls.fallback_hls_url,
                ls.current_viewers,
                ls.peak_viewers,
                ls.total_watch_time_seconds,
                ls.metadata,
                ls.created_at,
                ls.updated_at,
                lsa.live_session_id AS analytics_live_session_id,
                lsa.total_viewers AS analytics_total_viewers,
                lsa.hls_viewers AS analytics_hls_viewers,
                lsa.webrtc_viewers AS analytics_webrtc_viewers,
                lsa.total_watch_time_seconds AS analytics_total_watch_time_seconds,
                (lsa.average_watch_time_seconds)::FLOAT8 AS analytics_average_watch_time_seconds,
                lsa.conversions AS analytics_conversions,
                (lsa.revenue_cfa)::FLOAT8 AS analytics_revenue_cfa,
                lsa.last_synced_at AS analytics_last_synced_at
            FROM live_sessions ls
            JOIN live_session_analytics lsa ON lsa.live_session_id = ls.id
            ORDER BY lsa.last_synced_at DESC
            LIMIT $1
            "#,
        )
        .bind(limit.max(1))
        .fetch_all(pool)
        .await?;

        let result = rows
            .into_iter()
            .map(|row| {
                let session = LiveSession {
                    id: row.id,
                    host_user_id: row.host_user_id,
                    service_id: row.service_id,
                    title: row.title,
                    description: row.description,
                    status: row.status,
                    start_at: row.start_at,
                    end_at: row.end_at,
                    livekit_room_name: row.livekit_room_name,
                    livekit_participant_identity: row.livekit_participant_identity,
                    livekit_ingress_id: row.livekit_ingress_id,
                    livekit_ingress_url: row.livekit_ingress_url,
                    stream_key: row.stream_key,
                    webrtc_url: row.webrtc_url,
                    hls_url: row.hls_url,
                    fallback_rtmp_url: row.fallback_rtmp_url,
                    fallback_hls_url: row.fallback_hls_url,
                    current_viewers: row.current_viewers,
                    peak_viewers: row.peak_viewers,
                    total_watch_time_seconds: row.total_watch_time_seconds,
                    metadata: row.metadata,
                    created_at: row.created_at,
                    updated_at: row.updated_at,
                };

                let analytics = LiveSessionAnalytics {
                    live_session_id: row.analytics_live_session_id,
                    total_viewers: row.analytics_total_viewers,
                    hls_viewers: row.analytics_hls_viewers,
                    webrtc_viewers: row.analytics_webrtc_viewers,
                    total_watch_time_seconds: row.analytics_total_watch_time_seconds,
                    average_watch_time_seconds: Some(row.analytics_average_watch_time_seconds),
                    conversions: row.analytics_conversions,
                    revenue_cfa: Some(row.analytics_revenue_cfa),
                    last_synced_at: row.analytics_last_synced_at,
                };

                (session, analytics)
            })
            .collect();

        Ok(result)
    }

    async fn provision_stream_targets(
        state: Arc<AppState>,
        payload: &CreateLiveSessionRequest,
    ) -> AppResult<ProvisioningResult> {
        let config = state.live_streaming.clone();
        let mut result = ProvisioningResult::default();

        if config.is_livekit_enabled() {
            match Self::provision_livekit(&config, payload).await {
                Ok(info) => {
                    return Ok(info);
                }
                Err(err) => {
                    log::warn!(
                        "LiveKit provisioning failed, fallback to SRS (reason: {})",
                        err
                    );
                    result.provisioning_source = "fallback_srs".to_string();
                }
            }
        } else {
            result.provisioning_source = "fallback_srs".to_string();
        }

        // Ensure fallback configuration
        result.used_fallback = true;
        result.stream_key = Some(generate_stream_key());
        result.host_identity = Some(format!(
            "{HOST_IDENTITY_PREFIX}-{}-{}",
            payload.host_user_id,
            Uuid::new_v4().simple()
        ));

        if let Some(base) = config.srs_rtmp_url.as_ref() {
            let normalized = base.trim_end_matches('/');
            if let Some(key) = result.stream_key.as_ref() {
                result.fallback_rtmp_url = Some(format!("{}/{}", normalized, key));
            } else {
                result.fallback_rtmp_url = Some(normalized.to_string());
            }
        }

        if let Some(hls_base) = config.srs_hls_url.as_ref() {
            let normalized = hls_base.trim_end_matches('/');
            if let Some(key) = result.stream_key.as_ref() {
                result.fallback_hls_url = Some(format!("{}/{}.m3u8", normalized, key));
            } else {
                result.fallback_hls_url = Some(normalized.to_string());
            }
        }

        Ok(result)
    }

    async fn provision_livekit(
        config: &LiveStreamingConfig,
        payload: &CreateLiveSessionRequest,
    ) -> AppResult<ProvisioningResult> {
        let api_url = config
            .livekit_api_url
            .as_ref()
            .ok_or_else(|| AppError::Internal("LIVEKIT_API_URL non configuré".into()))?;
        let api_key = config
            .livekit_api_key
            .as_ref()
            .ok_or_else(|| AppError::Internal("LIVEKIT_API_KEY manquant".into()))?;
        let api_secret = config
            .livekit_api_secret
            .as_ref()
            .ok_or_else(|| AppError::Internal("LIVEKIT_API_SECRET manquant".into()))?;

        let client = Client::new();
        let server_token = generate_server_access_token(api_key, api_secret)?;
        let room_name = format!("yukpo-live-{}", Uuid::new_v4().simple());
        let host_identity = format!(
            "{HOST_IDENTITY_PREFIX}-{}-{}",
            payload.host_user_id,
            Uuid::new_v4().simple()
        );

        let room_body = json!({
            "room": {
                "name": room_name,
                "empty_timeout": config.default_room_ttl_seconds as i32,
                "max_participants": DEFAULT_MAX_PARTICIPANTS,
                "metadata": serde_json::to_string(&json!({
                    "title": payload.title,
                    "scheduled_start": payload.scheduled_start,
                }))
                .ok()
            }
        });

        let room_endpoint = format!(
            "{}/twirp/livekit.RoomService/CreateRoom",
            api_url.trim_end_matches('/')
        );

        let room_res = client
            .post(room_endpoint)
            .bearer_auth(&server_token)
            .json(&room_body)
            .send()
            .await?;

        if !room_res.status().is_success() {
            return Err(AppError::Internal(format!(
                "Impossible de créer la salle LiveKit (status: {})",
                room_res.status()
            )));
        }

        let mut result = ProvisioningResult {
            provisioning_source: "livekit".into(),
            livekit_room_name: Some(room_name.clone()),
            host_identity: Some(host_identity.clone()),
            used_fallback: false,
            ..Default::default()
        };

        // Optional ingress for RTMP fallback
        if config.livekit_ingress_type == LiveKitIngressMode::Rtmp {
            let ingress_endpoint = format!(
                "{}/twirp/livekit.Ingress/CreateIngress",
                api_url.trim_end_matches('/')
            );

            let ingress_body = json!({
                "input_type": 0, // 0 = RTMP_INPUT
                "name": payload.title,
                "room_name": room_name,
                "participant_identity": host_identity,
                "participant_name": payload.title,
            });

            // generate fresh token to ensure validity if processing is long
            let ingress_token = generate_server_access_token(api_key, api_secret)?;
            let ingress_res = client
                .post(ingress_endpoint)
                .bearer_auth(ingress_token)
                .json(&ingress_body)
                .send()
                .await?;

            if ingress_res.status().is_success() {
                let ingress_json: serde_json::Value = ingress_res.json().await.unwrap_or_default();
                result.livekit_ingress_id = ingress_json
                    .get("ingress")
                    .and_then(|ingress| ingress.get("ingress_id"))
                    .and_then(|id| id.as_str())
                    .map(|v| v.to_string());

                result.livekit_ingress_url = ingress_json
                    .get("ingress")
                    .and_then(|ingress| ingress.get("url"))
                    .and_then(|u| u.as_str())
                    .map(|v| v.to_string());

                result.stream_key = ingress_json
                    .get("ingress")
                    .and_then(|ingress| ingress.get("stream_key"))
                    .and_then(|k| k.as_str())
                    .map(|v| v.to_string());
            }
        }

        if let Some(ws_url) = config.livekit_ws_url.as_ref() {
            result.webrtc_url = Some(ws_url.clone());
        }

        if let Some(hls_base) = config.livekit_hls_base_url.as_ref() {
            result.hls_url = Some(format!(
                "{}/{}.m3u8",
                hls_base.trim_end_matches('/'),
                room_name
            ));
        }

        Ok(result)
    }

    pub(crate) fn extract_linked_ids(metadata: &Value) -> Vec<i32> {
        metadata
            .get("linked_services")
            .and_then(|value| value.as_array())
            .map(|arr| {
                let mut seen = HashSet::new();
                let mut ids = Vec::new();
                for item in arr {
                    if let Some(id) = item.as_i64() {
                        let id = id as i32;
                        if seen.insert(id) {
                            ids.push(id);
                        }
                    }
                }
                ids
            })
            .unwrap_or_default()
    }

    pub(crate) async fn load_linked_services(
        pool: &PgPool,
        service_ids: &[i32],
    ) -> AppResult<Vec<LiveLinkedService>> {
        if service_ids.is_empty() {
            return Ok(vec![]);
        }

        let rows = sqlx::query("SELECT id, data FROM services WHERE id = ANY($1)")
            .bind(service_ids)
            .fetch_all(pool)
            .await?;

        let mut map: HashMap<i32, LiveLinkedService> = HashMap::new();

        for row in rows {
            let id: i32 = row.get::<i32, _>("id");
            let data: Value = row.get::<Value, _>("data");

            let gallery = Self::extract_gallery(&data);
            let cover_media = Self::extract_string(
                &data,
                &[
                    "cover_media",
                    "image_couverture",
                    "image_principale",
                    "image",
                ],
            )
            .or_else(|| gallery.first().cloned());

            let service = LiveLinkedService {
                id,
                title: Self::extract_string(
                    &data,
                    &["titre_service", "title", "nom_service", "nom"],
                ),
                short_description: Self::extract_string(
                    &data,
                    &[
                        "short_description",
                        "description_courte",
                        "description_short",
                        "description",
                    ],
                ),
                cover_media,
                gallery,
                price: Self::extract_price(&data),
            };

            map.insert(id, service);
        }

        let mut result = Vec::new();
        for id in service_ids {
            if let Some(service) = map.remove(id) {
                result.push(service);
            }
        }

        Ok(result)
    }

    fn extract_string(data: &Value, keys: &[&str]) -> Option<String> {
        for key in keys {
            if let Some(value) = data.get(*key) {
                if let Some(s) = value.as_str() {
                    let trimmed = s.trim();
                    if !trimmed.is_empty() {
                        return Some(trimmed.to_string());
                    }
                } else if let Some(n) = value.as_f64() {
                    return Some(format!("{n}"));
                } else if let Some(n) = value.as_i64() {
                    return Some(n.to_string());
                }
            }
        }
        None
    }

    fn extract_gallery(data: &Value) -> Vec<String> {
        let mut urls = Vec::new();
        let mut seen = HashSet::new();
        let keys = ["gallery", "galerie", "images", "photos", "media"];

        for key in keys {
            if let Some(array) = data.get(key).and_then(|value| value.as_array()) {
                for item in array {
                    if let Some(url) = item.as_str() {
                        let trimmed = url.trim();
                        if !trimmed.is_empty() && seen.insert(trimmed.to_string()) {
                            urls.push(trimmed.to_string());
                        }
                    } else if let Some(obj_url) = item.get("url").and_then(|value| value.as_str()) {
                        let trimmed = obj_url.trim();
                        if !trimmed.is_empty() && seen.insert(trimmed.to_string()) {
                            urls.push(trimmed.to_string());
                        }
                    }
                }
            }
        }

        urls
    }

    fn extract_price(data: &Value) -> Option<String> {
        let keys = ["prix", "price", "prix_cfa", "price_cfa", "price_xaf"];

        for key in keys {
            if let Some(value) = data.get(key) {
                if let Some(s) = value.as_str() {
                    let trimmed = s.trim();
                    if !trimmed.is_empty() {
                        return Some(trimmed.to_string());
                    }
                } else if let Some(n) = value.as_f64() {
                    if (n - n.round()).abs() < f64::EPSILON {
                        return Some(format!("{}", n.round() as i64));
                    }
                    return Some(format!("{:.2}", n));
                } else if let Some(n) = value.as_i64() {
                    return Some(n.to_string());
                }
            }
        }

        None
    }
}

#[derive(Debug, Default)]
struct ProvisioningResult {
    provisioning_source: String,
    livekit_room_name: Option<String>,
    host_identity: Option<String>,
    livekit_ingress_id: Option<String>,
    livekit_ingress_url: Option<String>,
    stream_key: Option<String>,
    webrtc_url: Option<String>,
    hls_url: Option<String>,
    fallback_rtmp_url: Option<String>,
    fallback_hls_url: Option<String>,
    used_fallback: bool,
}

fn generate_stream_key() -> String {
    let mut rng = rand::thread_rng();
    std::iter::repeat_with(|| rng.sample(Alphanumeric) as char)
        .filter(|c| c.is_ascii_alphanumeric())
        .take(24)
        .collect()
}

fn create_access_token(
    api_key: &str,
    api_secret: &str,
    room_name: &str,
    identity: &str,
    can_publish: bool,
) -> AppResult<String> {
    let header = Header::default();
    let exp = Utc::now() + Duration::hours(4);

    let claims = LiveKitClaims {
        iss: api_key.to_string(),
        sub: identity.to_string(),
        exp: exp.timestamp() as usize,
        video: LiveKitVideoGrant {
            room: room_name.to_string(),
            room_join: true,
            can_publish,
            can_subscribe: true,
            can_publish_data: can_publish,
        },
    };

    let token = encode(
        &header,
        &claims,
        &EncodingKey::from_secret(api_secret.as_bytes()),
    )
    .map_err(|err| AppError::Internal(format!("Erreur génération token LiveKit: {}", err)))?;

    Ok(token)
}

#[derive(Debug, Serialize)]
struct LiveKitClaims {
    iss: String,
    sub: String,
    exp: usize,
    video: LiveKitVideoGrant,
}

#[derive(Debug, Serialize)]
struct LiveKitVideoGrant {
    room: String,
    #[serde(rename = "roomJoin")]
    room_join: bool,
    #[serde(rename = "canPublish")]
    can_publish: bool,
    #[serde(rename = "canSubscribe")]
    can_subscribe: bool,
    #[serde(rename = "canPublishData")]
    can_publish_data: bool,
}
