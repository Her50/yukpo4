/**
 * Contrôleur pour fonctionnalité Duet/Remix (comme TikTok)
 * Permet de réutiliser l'audio d'une vidéo ou créer une vidéo côte à côte
 */
use crate::services::audio_extraction_service::AudioExtractionService;
use crate::state::AppState;
use axum::{
    extract::{multipart::Multipart, Path, Query, State},
    http::StatusCode,
    response::Json,
};
use log;
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};
use std::sync::Arc;

/// ✅ Helper: Construit URL média avec fallback pour anciens médias locaux
fn build_media_url_with_fallback(state: &Arc<AppState>, path: &str) -> String {
    if path.starts_with("http://") || path.starts_with("https://") {
        return path.to_string();
    }

    if state.media_storage.is_remote() {
        state.media_storage.build_public_url(path)
    } else {
        let api_base_url = std::env::var("PUBLIC_BASE_URL")
            .or_else(|_| std::env::var("UPLOAD_BASE_URL"))
            .unwrap_or_else(|_| "https://yukpomnang.onrender.com".to_string());
        let clean_path = path.trim_start_matches('/');
        format!(
            "{}/api/media/files/{}",
            api_base_url.trim_end_matches('/'),
            clean_path
        )
    }
}

#[derive(Debug, Deserialize)]
pub struct CreateDuetRequest {
    pub original_video_id: String,
    pub duet_type: String,             // 'audio' ou 'side_by_side'
    pub new_video_url: Option<String>, // Optionnel si upload multipart
    pub service_id: Option<i32>,
    pub titre: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct DuetInfo {
    pub duet_id: String,
    pub original_video_id: String,
    pub original_video_url: String,
    pub original_audio_url: Option<String>,
    pub duet_video_url: String,
    pub duet_type: String,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
pub struct CreateDuetResponse {
    pub success: bool,
    pub data: DuetInfo,
}

#[derive(Debug, Deserialize)]
pub struct GetDuetsQuery {
    pub video_id: Option<String>,
    pub limit: Option<i32>,
    pub offset: Option<i32>,
}

#[derive(Debug, Serialize)]
pub struct DuetVideo {
    pub id: String,
    pub content_id: String,
    pub titre: String,
    pub video_url: String,
    pub thumbnail: Option<String>,
    pub service_id: Option<i32>,
    pub duet_type: String,
    pub original_video_id: String,
    pub created_at: String,
    pub likes: i64,
    pub saves: i64,
    pub views: i64,
}

#[derive(Debug, Serialize)]
pub struct GetDuetsResponse {
    pub success: bool,
    pub data: Vec<DuetVideo>,
    pub total: i64,
}

/// Créer un duet/remix (JSON)
pub async fn create_duet(
    State(state): State<Arc<AppState>>,
    axum::extract::Json(payload): axum::extract::Json<CreateDuetRequest>,
) -> Result<Json<CreateDuetResponse>, StatusCode> {
    let request_payload = payload;
    let pool = &state.pg;
    let _user_id = 0; // TODO: Extraire depuis JWT

    log::info!(
        "🎬 [Duet] Création duet: original_video_id={}, type={}",
        request_payload.original_video_id,
        request_payload.duet_type
    );

    // Récupérer la vidéo originale
    let original_video = sqlx::query(
        r#"
        SELECT 
            m.path as video_url_raw,
            m.id::text as content_id,
            (s.data->'titre_service')->>'valeur' as titre
        FROM media m
        INNER JOIN services s ON s.id = m.service_id
        WHERE m.id::text = $1 OR m.id::text = $1
        AND m.type = 'video'
        LIMIT 1
        "#,
    )
    .bind(&request_payload.original_video_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| {
        log::error!("❌ [Duet] Erreur récupération vidéo originale: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let original_video_url = if let Some(row) = original_video {
        let video_url_raw: String = row
            .get::<Option<String>, _>("video_url_raw")
            .unwrap_or_default();
        // ✅ CORRIGÉ: Transformer path en URL S3/Wasabi avec fallback
        build_media_url_with_fallback(&state, &video_url_raw)
    } else {
        return Err(StatusCode::NOT_FOUND);
    };

    // ✅ NOUVEAU: Extraire l'audio si type = 'audio'
    let original_audio_url = if request_payload.duet_type == "audio" {
        match AudioExtractionService::extract_and_upload(&state, &original_video_url).await {
            Ok(audio_url) => {
                log::info!("✅ [Duet] Audio extrait: {}", audio_url);
                Some(audio_url)
            }
            Err(e) => {
                log::error!("❌ [Duet] Erreur extraction audio: {}", e);
                None // Continuer même si extraction échoue
            }
        }
    } else {
        None
    };

    // Créer l'entrée duet dans la base
    let duet_id = format!("duet_{}", chrono::Utc::now().timestamp_millis());
    let duet_type = request_payload.duet_type.clone();

    // Utiliser new_video_url ou générer depuis upload
    let new_video_url = request_payload
        .new_video_url
        .unwrap_or_else(|| original_video_url.clone());

    // Insérer dans table duets (à créer via migration)
    // Pour l'instant, utiliser une table temporaire ou media avec metadata
    let result = sqlx::query(
        r#"
        INSERT INTO media (
            service_id,
            type,
            path,
            media_type,
            ai_metadata
        ) VALUES (
            $1,
            'video',
            $2,
            'video',
            jsonb_build_object(
                'duet_type', $3,
                'original_video_id', $4,
                'is_duet', true,
                'original_audio_url', $5
            )
        )
        RETURNING id::text
        "#,
    )
    .bind(request_payload.service_id)
    .bind(&new_video_url)
    .bind(&duet_type)
    .bind(&request_payload.original_video_id)
    .bind(&original_audio_url)
    .fetch_one(pool)
    .await;

    match result {
        Ok(row) => {
            let content_id = row
                .get::<Option<String>, _>("id")
                .unwrap_or(duet_id.clone());

            Ok(Json(CreateDuetResponse {
                success: true,
                data: DuetInfo {
                    duet_id: content_id,
                    original_video_id: request_payload.original_video_id,
                    original_video_url,
                    original_audio_url,
                    duet_video_url: new_video_url,
                    duet_type,
                    created_at: chrono::Utc::now().to_rfc3339(),
                },
            }))
        }
        Err(e) => {
            log::error!("❌ [Duet] Erreur création: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// Créer un duet/remix avec upload multipart
pub async fn create_duet_multipart(
    State(state): State<Arc<AppState>>,
    mut multipart: Multipart,
) -> Result<Json<CreateDuetResponse>, StatusCode> {
    let mut request_payload = CreateDuetRequest {
        original_video_id: String::new(),
        duet_type: String::new(),
        new_video_url: None,
        service_id: None,
        titre: None,
        description: None,
    };

    let mut video_data: Option<Vec<u8>> = None;

    // Parser multipart
    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|_| StatusCode::BAD_REQUEST)?
    {
        match field.name() {
            Some("original_video_id") => {
                request_payload.original_video_id = field.text().await.unwrap_or_default();
            }
            Some("duet_type") => {
                request_payload.duet_type = field.text().await.unwrap_or_default();
            }
            Some("service_id") => {
                request_payload.service_id = field.text().await.ok().and_then(|s| s.parse().ok());
            }
            Some("titre") => {
                request_payload.titre = Some(field.text().await.unwrap_or_default());
            }
            Some("description") => {
                request_payload.description = Some(field.text().await.unwrap_or_default());
            }
            Some("video") => {
                let data = field.bytes().await.map_err(|_| StatusCode::BAD_REQUEST)?;
                video_data = Some(data.to_vec());
            }
            _ => {}
        }
    }

    // Upload vidéo si fournie
    if let Some(data) = video_data {
        let temp_path = format!(
            "temp/duet_uploads/duet_{}.mp4",
            chrono::Utc::now().timestamp()
        );
        tokio::fs::create_dir_all("temp/duet_uploads").await.ok();
        tokio::fs::write(&temp_path, data)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

        let stored = state
            .media_storage
            .store_file(
                &temp_path,
                &format!("duets/duet_{}.mp4", chrono::Utc::now().timestamp()),
                Some("video/mp4"),
            )
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        request_payload.new_video_url = Some(stored.public_url);

        tokio::fs::remove_file(&temp_path).await.ok();
    }

    // Utiliser la fonction create_duet existante
    create_duet(State(state), axum::extract::Json(request_payload)).await
}

/// Obtenir les duets d'une vidéo
pub async fn get_duets(
    State(state): State<Arc<AppState>>,
    Query(params): Query<GetDuetsQuery>,
) -> Result<Json<GetDuetsResponse>, StatusCode> {
    let pool = &state.pg;
    let limit = params.limit.unwrap_or(25);
    let offset = params.offset.unwrap_or(0);

    let video_id_ref = params.video_id.as_ref();
    let sql = if let Some(video_id) = video_id_ref {
        // Duets d'une vidéo spécifique
        r#"
        SELECT 
            m.id::text as id,
            m.id::text as content_id,
            COALESCE((s.data->'titre_service')->>'valeur', 'Duet') as titre,
            m.path as video_url_raw,
            (SELECT path FROM media m2 WHERE m2.service_id = m.service_id AND m2.type = 'image' LIMIT 1) as thumbnail_raw,
            m.service_id,
            m.ai_metadata->>'duet_type' as duet_type,
            m.ai_metadata->>'original_video_id' as original_video_id,
            m.uploaded_at as created_at,
            COALESCE(ce.likes, 0) as likes,
            COALESCE(ce.saves, 0) as saves,
            COALESCE(ce.views, 0) as views
        FROM media m
        INNER JOIN services s ON s.id = m.service_id
        LEFT JOIN (
            SELECT content_id,
                SUM(CASE WHEN liked = TRUE THEN 1 ELSE 0 END) as likes,
                SUM(CASE WHEN saved = TRUE THEN 1 ELSE 0 END) as saves,
                COUNT(*) as views
            FROM content_engagement
            GROUP BY content_id
        ) ce ON ce.content_id = m.id::text
        WHERE m.type = 'video'
        AND m.path IS NOT NULL
        AND s.is_active = TRUE
        AND m.ai_metadata->>'is_duet' = 'true'
        AND m.ai_metadata->>'original_video_id' = $1
        ORDER BY m.uploaded_at DESC
        LIMIT $2 OFFSET $3
        "#
    } else {
        // Tous les duets récents
        r#"
        SELECT 
            m.id::text as id,
            m.id::text as content_id,
            COALESCE((s.data->'titre_service')->>'valeur', 'Duet') as titre,
            m.path as video_url_raw,
            (SELECT path FROM media m2 WHERE m2.service_id = m.service_id AND m2.type = 'image' LIMIT 1) as thumbnail_raw,
            m.service_id,
            m.ai_metadata->>'duet_type' as duet_type,
            m.ai_metadata->>'original_video_id' as original_video_id,
            m.uploaded_at as created_at,
            COALESCE(ce.likes, 0) as likes,
            COALESCE(ce.saves, 0) as saves,
            COALESCE(ce.views, 0) as views
        FROM media m
        INNER JOIN services s ON s.id = m.service_id
        LEFT JOIN (
            SELECT content_id,
                SUM(CASE WHEN liked = TRUE THEN 1 ELSE 0 END) as likes,
                SUM(CASE WHEN saved = TRUE THEN 1 ELSE 0 END) as saves,
                COUNT(*) as views
            FROM content_engagement
            GROUP BY content_id
        ) ce ON ce.content_id = m.id::text
        WHERE m.type = 'video'
        AND m.path IS NOT NULL
        AND s.is_active = TRUE
        AND m.ai_metadata->>'is_duet' = 'true'
        ORDER BY m.uploaded_at DESC
        LIMIT $1 OFFSET $2
        "#
    };

    let count_sql = if let Some(_video_id) = video_id_ref {
        r#"
        SELECT COUNT(*)
        FROM media m
        INNER JOIN services s ON s.id = m.service_id
        WHERE m.type = 'video'
        AND s.is_active = TRUE
        AND m.ai_metadata->>'is_duet' = 'true'
        AND m.ai_metadata->>'original_video_id' = $1
        "#
    } else {
        r#"
        SELECT COUNT(*)
        FROM media m
        INNER JOIN services s ON s.id = m.service_id
        WHERE m.type = 'video'
        AND s.is_active = TRUE
        AND m.ai_metadata->>'is_duet' = 'true'
        "#
    };

    let count_result = if let Some(video_id) = video_id_ref {
        sqlx::query_scalar::<_, i64>(count_sql)
            .bind(video_id)
            .fetch_one(pool)
            .await
    } else {
        sqlx::query_scalar::<_, i64>(count_sql)
            .fetch_one(pool)
            .await
    };

    let total = count_result.unwrap_or(0);

    let result = if let Some(video_id) = video_id_ref {
        sqlx::query(sql)
            .bind(video_id)
            .bind(limit)
            .bind(offset)
            .fetch_all(pool)
            .await
    } else {
        sqlx::query(sql)
            .bind(limit)
            .bind(offset)
            .fetch_all(pool)
            .await
    };

    match result {
        Ok(rows) => {
            // ✅ CORRIGÉ: Transformer paths en URLs S3/Wasabi avec fallback
            let duets: Vec<DuetVideo> = rows
                .iter()
                .map(|row| {
                    let video_url_raw: String = row
                        .get::<Option<String>, _>("video_url_raw")
                        .unwrap_or_default();
                    let thumbnail_raw: Option<String> =
                        row.get::<Option<String>, _>("thumbnail_raw");

                    let video_url = build_media_url_with_fallback(&state, &video_url_raw);
                    let thumbnail = thumbnail_raw
                        .as_ref()
                        .map(|t| build_media_url_with_fallback(&state, t));

                    DuetVideo {
                        id: row.get::<Option<String>, _>("id").unwrap_or_default(),
                        content_id: row
                            .get::<Option<String>, _>("content_id")
                            .unwrap_or_default(),
                        titre: row.get::<Option<String>, _>("titre").unwrap_or_default(),
                        video_url,
                        thumbnail,
                        service_id: row.get::<Option<i32>, _>("service_id"),
                        duet_type: row
                            .get::<Option<String>, _>("duet_type")
                            .unwrap_or_default(),
                        original_video_id: row
                            .get::<Option<String>, _>("original_video_id")
                            .unwrap_or_default(),
                        created_at: row
                            .get::<Option<chrono::DateTime<chrono::Utc>>, _>("created_at")
                            .map(|dt| dt.to_rfc3339())
                            .unwrap_or_default(),
                        likes: row.get::<Option<i64>, _>("likes").unwrap_or(0),
                        saves: row.get::<Option<i64>, _>("saves").unwrap_or(0),
                        views: row.get::<Option<i64>, _>("views").unwrap_or(0),
                    }
                })
                .collect();

            Ok(Json(GetDuetsResponse {
                success: true,
                data: duets,
                total,
            }))
        }
        Err(e) => {
            log::error!("❌ [Duet] Erreur récupération duets: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}
