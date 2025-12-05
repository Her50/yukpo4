/**
 * Contrôleur ML pour recommandations vidéo personnalisées
 * Utilise analyse comportementale et engagement (pgvector non utilisé)
 */
use crate::state::AppState;
use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::Json,
};
use chrono::{Datelike, Timelike};
use log;
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};
use std::sync::Arc;

/// ✅ Helper: Construit URL média avec fallback pour anciens médias locaux
fn build_media_url_with_fallback(state: &Arc<AppState>, path: &str) -> String {
    // Si déjà URL complète, retourner telle quelle
    if path.starts_with("http://") || path.starts_with("https://") {
        return path.to_string();
    }

    // Si S3/Wasabi configuré, utiliser URL publique
    if state.media_storage.is_remote() {
        state.media_storage.build_public_url(path)
    } else {
        // Fallback pour anciens médias locaux (temporaire, migration)
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
pub struct MLRecommendationsQuery {
    pub user_id: Option<i32>,
    pub limit: Option<i32>,
    pub categories: Option<String>,
    pub exclude_content_ids: Option<String>, // IDs déjà vus
}

#[derive(Debug, Serialize, Clone)]
pub struct MLRecommendedVideo {
    pub id: String,
    pub content_id: String,
    pub titre: String,
    pub description: Option<String>,
    pub video_url: String,
    pub thumbnail: Option<String>,
    pub service_id: Option<i32>,
    pub similarity_score: f64,
    pub engagement_score: f64,
    pub recency_score: f64,
    pub total_score: f64,
    pub is_sponsored: bool,
    pub hashtags: Vec<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
pub struct MLRecommendationsResponse {
    pub success: bool,
    pub data: Vec<MLRecommendedVideo>,
    pub algorithm_version: String,
    pub user_profile_strength: f64, // 0.0 à 1.0
}

/// Obtenir des recommandations ML personnalisées pour un utilisateur
pub async fn get_ml_recommendations(
    State(state): State<Arc<AppState>>,
    Query(params): Query<MLRecommendationsQuery>,
) -> Result<Json<MLRecommendationsResponse>, StatusCode> {
    let pool = &state.pg;
    let user_id = params.user_id.unwrap_or(0);
    // ✅ SCALABILITÉ: Limiter à 50 max pour éviter surcharge
    let limit = params.limit.unwrap_or(25).min(50);

    log::info!(
        "🤖 [ML Recommendations] Récupération pour user_id: {}, limit: {}",
        user_id,
        limit
    );

    // Parser les catégories
    let categories: Vec<String> = params
        .categories
        .as_ref()
        .map(|c| c.split(',').map(|s| s.trim().to_string()).collect())
        .unwrap_or_default();

    // Parser les IDs à exclure
    let exclude_ids: Vec<String> = params
        .exclude_content_ids
        .as_ref()
        .map(|s| s.split(',').map(|s| s.trim().to_string()).collect())
        .unwrap_or_default();

    // Calculer le profil utilisateur (force du profil basée sur interactions)
    let user_profile_strength = calculate_user_profile_strength(pool, user_id).await;

    // Si profil faible, utiliser recommandations populaires
    if user_profile_strength < 0.3 {
        return get_popular_recommendations(pool, &state, limit, categories, exclude_ids).await;
    }

    // ✅ Utiliser recommandations améliorées avec signaux enrichis
    let videos = get_enhanced_recommendations(
        pool,
        Some(&state),
        user_id,
        limit,
        &categories,
        &exclude_ids,
    )
    .await;

    Ok(Json(MLRecommendationsResponse {
        success: true,
        data: videos,
        algorithm_version: "ml_v2.0-enhanced".to_string(),
        user_profile_strength,
    }))
}

/// Calcule la force du profil utilisateur (0.0 à 1.0)
async fn calculate_user_profile_strength(pool: &PgPool, user_id: i32) -> f64 {
    let result = sqlx::query_scalar::<_, i64>(
        r#"
        SELECT COUNT(*) as interaction_count
        FROM content_engagement
        WHERE user_id = $1
        AND created_at > NOW() - INTERVAL '30 days'
        "#,
    )
    .bind(user_id)
    .fetch_one(pool)
    .await;

    match result {
        Ok(count) => {
            // Normaliser: 0 interactions = 0.0, 100+ interactions = 1.0
            let strength = (count as f64 / 100.0).min(1.0);
            log::info!(
                "📊 [ML] Profil utilisateur {}: {} interactions, force: {:.2}",
                user_id,
                count,
                strength
            );
            strength
        }
        Err(e) => {
            log::warn!("⚠️ [ML] Erreur calcul profil utilisateur: {}", e);
            0.0
        }
    }
}

// ✅ Note: pgvector non utilisé dans l'application
// Les recommandations utilisent l'engagement enrichi, préférences, et collaborative filtering

/// Structure pour préférences utilisateur
#[derive(Debug, Clone)]
struct UserPreferences {
    preferred_categories: Vec<String>,
    preferred_hashtags: Vec<String>,
    preferred_creators: Vec<i32>,
    avg_watch_duration_ms: i32,
    most_active_hour: Option<i32>,
    most_active_day: Option<i32>,
}

impl Default for UserPreferences {
    fn default() -> Self {
        Self {
            preferred_categories: vec![],
            preferred_hashtags: vec![],
            preferred_creators: vec![],
            avg_watch_duration_ms: 0,
            most_active_hour: None,
            most_active_day: None,
        }
    }
}

/// Récupère les préférences utilisateur depuis la base
async fn get_user_preferences(pool: &PgPool, user_id: i32) -> UserPreferences {
    let result = sqlx::query(
        r#"
        SELECT 
            COALESCE(preferred_categories, ARRAY[]::TEXT[]) as preferred_categories,
            COALESCE(preferred_hashtags, ARRAY[]::TEXT[]) as preferred_hashtags,
            COALESCE(preferred_creators, ARRAY[]::INTEGER[]) as preferred_creators,
            COALESCE(avg_watch_duration_ms, 0) as avg_watch_duration_ms,
            most_active_hour,
            most_active_day
        FROM user_preferences
        WHERE user_id = $1
        "#,
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await;

    match result {
        Ok(Some(row)) => UserPreferences {
            preferred_categories: row.get::<Vec<String>, _>("preferred_categories"),
            preferred_hashtags: row.get::<Vec<String>, _>("preferred_hashtags"),
            preferred_creators: row.get::<Vec<i32>, _>("preferred_creators"),
            avg_watch_duration_ms: row.get::<i64, _>("avg_watch_duration_ms") as i32,
            most_active_hour: row.get::<Option<i32>, _>("most_active_hour"),
            most_active_day: row.get::<Option<i32>, _>("most_active_day"),
        },
        Ok(None) => {
            // Mettre à jour les préférences si elles n'existent pas
            let _ = sqlx::query("SELECT update_user_preferences($1)")
                .bind(user_id)
                .execute(pool)
                .await;
            UserPreferences::default()
        }
        Err(e) => {
            log::warn!("⚠️ [ML] Erreur récupération préférences: {}", e);
            UserPreferences::default()
        }
    }
}

/// Recommandations améliorées avec signaux enrichis
/// ✅ PUBLIC: Utilisée par mixed_content_controller pour recommandations personnalisées
pub async fn get_enhanced_recommendations(
    pool: &PgPool,
    state: Option<&Arc<crate::state::AppState>>,
    user_id: i32,
    limit: i32,
    categories: &[String],
    exclude_ids: &[String],
) -> Vec<MLRecommendedVideo> {
    // Récupérer préférences utilisateur
    let user_prefs = get_user_preferences(pool, user_id).await;

    // Essayer collaborative filtering d'abord si profil fort
    let user_profile_strength = calculate_user_profile_strength(pool, user_id).await;
    if user_profile_strength > 0.5 {
        if let Some(state_ref) = state {
            if let Ok(mut collab_videos) =
                get_collaborative_recommendations(pool, state_ref, user_id, limit / 2, &exclude_ids)
                    .await
            {
                if !collab_videos.is_empty() {
                    log::info!(
                        "🎯 [ML] Utilisation collaborative filtering pour user {}",
                        user_id
                    );
                    // Combiner avec recommandations engagement
                    let mut all_videos = collab_videos;
                    let engagement_videos = get_engagement_based_recommendations_enhanced(
                        pool,
                        state_ref,
                        user_id,
                        limit / 2,
                        categories,
                        exclude_ids,
                        &user_prefs,
                    )
                    .await;
                    all_videos.extend(engagement_videos);

                    // Dédupliquer et trier
                    return deduplicate_and_sort_videos(all_videos, limit);
                }
            }
        }
    }

    // Fallback: Recommandations engagement améliorées
    if let Some(state_ref) = state {
        get_engagement_based_recommendations_enhanced(
            pool,
            state_ref,
            user_id,
            limit,
            categories,
            exclude_ids,
            &user_prefs,
        )
        .await
    } else {
        // Fallback sans state (utiliser une version simplifiée)
        vec![]
    }
}

/// Recommandations basées sur engagement améliorées (avec nouveaux signaux)
async fn get_engagement_based_recommendations_enhanced(
    pool: &PgPool,
    state: &Arc<AppState>,
    user_id: i32,
    limit: i32,
    categories: &[String],
    exclude_ids: &[String],
    user_prefs: &UserPreferences,
) -> Vec<MLRecommendedVideo> {
    // ✅ Utiliser la table media existante avec jointure services pour les vidéos
    // TODO: Migrer vers table videos dédiée après migration
    let mut query = r#"
        SELECT 
            m.id::text as id,
            COALESCE(m.id::text, 'media_' || m.service_id || '_' || m.id) as content_id,
            COALESCE(s.data->>'titre_service'->>'valeur', s.data->>'titre', 'Vidéo') as titre,
            s.data->>'description' as description,
            m.path as video_url_raw,
            (SELECT path FROM media m2 WHERE m2.service_id = m.service_id AND m2.type = 'image' LIMIT 1) as thumbnail_raw,
            m.service_id,
            s.category,
            COALESCE(ce.likes, 0) as likes,
            COALESCE(ce.saves, 0) as saves,
            COALESCE(ce.views, 0) as views,
            FALSE as is_sponsored,
            m.uploaded_at as created_at,
            COALESCE(m.ai_tags, ARRAY[]::text[]) as hashtags
        FROM media m
        INNER JOIN services s ON s.id = m.service_id
        LEFT JOIN (
            SELECT 
                content_id,
                SUM(CASE WHEN liked = TRUE THEN 1 ELSE 0 END) as likes,
                SUM(CASE WHEN saved = TRUE THEN 1 ELSE 0 END) as saves,
                SUM(CASE WHEN shared = TRUE THEN 1 ELSE 0 END) as shares,
                COUNT(*) as views,
                AVG(completion_rate) as avg_completion_rate,
                AVG(watch_duration_ms) as avg_watch_duration_ms
            FROM content_engagement
            WHERE created_at > NOW() - INTERVAL '30 days'
            GROUP BY content_id
        ) ce ON ce.content_id = COALESCE(m.id::text, 'media_' || m.service_id || '_' || m.id)
        WHERE m.type = 'video'
        AND m.path IS NOT NULL
        AND s.is_active = TRUE
    "#
    .to_string();

    // Filtre catégories (si hashtags contiennent catégories)
    if !categories.is_empty() {
        query.push_str(" AND EXISTS (SELECT 1 FROM unnest(COALESCE(m.ai_tags, ARRAY[]::text[])) tag WHERE tag = ANY($1::text[]))");
    }

    // Exclure IDs déjà vus
    if !exclude_ids.is_empty() {
        query.push_str(
            " AND COALESCE(m.id::text, 'media_' || m.service_id || '_' || m.id) != ALL($2::text[])",
        );
    }

    // ✅ NOUVEAU: Score enrichi avec temps de visionnage, complétion, partages
    query.push_str(
        " ORDER BY (
        COALESCE(ce.likes, 0) * 2.0 + 
        COALESCE(ce.saves, 0) * 1.5 + 
        COALESCE(ce.shares, 0) * 2.5 + 
        COALESCE(ce.views, 0) * 0.1 + 
        COALESCE(ce.avg_completion_rate, 0) * 3.0
    ) DESC, m.uploaded_at DESC LIMIT $3",
    );

    let result = if !categories.is_empty() && !exclude_ids.is_empty() {
        sqlx::query(&query)
            .bind(categories)
            .bind(exclude_ids)
            .bind(limit)
            .fetch_all(pool)
            .await
    } else if !categories.is_empty() {
        sqlx::query(&query)
            .bind(categories)
            .bind(limit)
            .fetch_all(pool)
            .await
    } else if !exclude_ids.is_empty() {
        sqlx::query(&query)
            .bind(exclude_ids)
            .bind(limit)
            .fetch_all(pool)
            .await
    } else {
        sqlx::query(&query).bind(limit).fetch_all(pool).await
    };

    match result {
        Ok(rows) => {
            rows.iter()
                .map(|row| {
                    let likes: i64 = row.get::<i64, _>("likes");
                    let saves: i64 = row.get::<i64, _>("saves");
                    let shares: i64 = row.get::<i64, _>("shares");
                    let views: i64 = row.get::<i64, _>("views");
                    let avg_completion: f64 = row.get::<f64, _>("avg_completion_rate");
                    let created_at: chrono::DateTime<chrono::Utc> =
                        row.get::<chrono::DateTime<chrono::Utc>, _>("created_at");
                    let service_id: Option<i32> = row.get::<Option<i32>, _>("service_id");
                    let video_hashtags: Vec<String> = row.get::<Vec<String>, _>("hashtags");
                    let service_category: Option<String> = row.get::<Option<String>, _>("category");

                    // ✅ Score engagement enrichi
                    let engagement_score = (likes as f64 * 2.0
                        + saves as f64 * 1.5
                        + shares as f64 * 2.5
                        + views as f64 * 0.1
                        + avg_completion * 3.0)
                        / 100.0;

                    // ✅ Score préférences utilisateur
                    let preference_score = calculate_preference_score(
                        &user_prefs,
                        &service_category,
                        &video_hashtags,
                        service_id,
                    );

                    // ✅ Score récence amélioré
                    let recency_score = calculate_recency_score(&created_at);

                    // ✅ Score contexte temporel
                    let context_score = calculate_context_score(&user_prefs);

                    // ✅ Score diversité (basé sur catégories déjà recommandées)
                    let diversity_score = 1.0; // Sera calculé après récupération

                    // ✅ Score total pondéré
                    let total_score = (engagement_score * 0.35
                        + preference_score * 0.25
                        + recency_score * 0.15
                        + context_score * 0.15
                        + diversity_score * 0.10);

                    // ✅ CORRIGÉ: Transformer paths en URLs S3/Wasabi avec fallback local
                    let video_url_raw: String = row.get::<String, _>("video_url_raw");
                    let thumbnail_raw: Option<String> =
                        row.get::<Option<String>, _>("thumbnail_raw");

                    let video_url = build_media_url_with_fallback(state, &video_url_raw);
                    let thumbnail = thumbnail_raw
                        .as_ref()
                        .map(|t| build_media_url_with_fallback(state, t));

                    MLRecommendedVideo {
                        id: row.get::<String, _>("id"),
                        content_id: row.get::<String, _>("content_id"),
                        titre: row.get::<String, _>("titre"),
                        description: row.get::<Option<String>, _>("description"),
                        video_url,
                        thumbnail,
                        service_id: row.get::<Option<i32>, _>("service_id"),
                        similarity_score: 0.0, // Basé sur engagement (pgvector non utilisé)
                        engagement_score,
                        recency_score,
                        total_score,
                        is_sponsored: row.get::<bool, _>("is_sponsored"),
                        hashtags: row
                            .get::<Option<Vec<String>>, _>("hashtags")
                            .unwrap_or_default(),
                        created_at: row
                            .get::<Option<chrono::DateTime<chrono::Utc>>, _>("created_at")
                            .map(|dt| dt.to_rfc3339())
                            .unwrap_or_default(),
                    }
                })
                .collect()
        }
        Err(e) => {
            log::error!("❌ [ML] Erreur récupération recommandations: {}", e);
            Vec::new()
        }
    }
}

/// Calcule le score de préférences utilisateur
fn calculate_preference_score(
    user_prefs: &UserPreferences,
    video_category: &Option<String>,
    video_hashtags: &[String],
    video_creator_id: Option<i32>,
) -> f64 {
    let mut score = 1.0;

    // Bonus catégorie préférée
    if let Some(ref cat) = video_category {
        if user_prefs.preferred_categories.contains(cat) {
            score *= 1.5;
        }
    }

    // Bonus hashtags préférés
    let matching_hashtags = video_hashtags
        .iter()
        .filter(|tag| user_prefs.preferred_hashtags.contains(tag))
        .count();
    if matching_hashtags > 0 {
        score *= 1.0 + (matching_hashtags as f64 * 0.2).min(0.6);
    }

    // Bonus créateur préféré
    if let Some(creator_id) = video_creator_id {
        if user_prefs.preferred_creators.contains(&creator_id) {
            score *= 1.4;
        }
    }

    score
}

/// Calcule le score de récence
fn calculate_recency_score(created_at: &chrono::DateTime<chrono::Utc>) -> f64 {
    let now = chrono::Utc::now();
    let age_days = (now - *created_at).num_days();

    if age_days < 1 {
        1.5 // Vidéos < 1 jour
    } else if age_days < 7 {
        1.2 // Vidéos < 1 semaine
    } else if age_days < 30 {
        1.0 // Vidéos < 1 mois
    } else if age_days < 90 {
        0.8 // Vidéos < 3 mois
    } else {
        0.5 // Vidéos anciennes
    }
}

/// Calcule le score contextuel (heure, jour)
fn calculate_context_score(user_prefs: &UserPreferences) -> f64 {
    let now = chrono::Local::now();
    let current_hour = now.time().hour() as i32;
    let current_day = now.date_naive().weekday().num_days_from_sunday() as i32;

    let mut score = 1.0;

    // Bonus si heure correspond à heure active
    if let Some(active_hour) = user_prefs.most_active_hour {
        if (current_hour - active_hour).abs() <= 2 {
            score *= 1.2;
        }
    }

    // Bonus si jour correspond à jour actif
    if let Some(active_day) = user_prefs.most_active_day {
        if current_day == active_day {
            score *= 1.15;
        }
    }

    score
}

/// Recommandations basées sur collaborative filtering
async fn get_collaborative_recommendations(
    pool: &PgPool,
    state: &Arc<AppState>,
    user_id: i32,
    limit: i32,
    exclude_ids: &[String],
) -> Result<Vec<MLRecommendedVideo>, sqlx::Error> {
    let query = r#"
        WITH similar_users AS (
            SELECT 
                ce2.user_id,
                COUNT(*) as common_likes,
                COUNT(*)::REAL / GREATEST(
                    (SELECT COUNT(*) FROM content_engagement WHERE user_id = $1 AND liked = TRUE),
                    (SELECT COUNT(*) FROM content_engagement WHERE user_id = ce2.user_id AND liked = TRUE),
                    1
                ) as similarity_score
            FROM content_engagement ce1
            JOIN content_engagement ce2 ON ce1.content_id = ce2.content_id
            WHERE ce1.user_id = $1
              AND ce2.user_id != $1
              AND ce1.liked = TRUE
              AND ce2.liked = TRUE
            GROUP BY ce2.user_id
            HAVING COUNT(*) >= 3
            ORDER BY similarity_score DESC
            LIMIT 50
        )
        SELECT DISTINCT
            m.id::text as id,
            COALESCE(m.id::text, 'media_' || m.service_id || '_' || m.id) as content_id,
            COALESCE(s.data->>'titre_service'->>'valeur', s.data->>'titre', 'Vidéo') as titre,
            s.data->>'description' as description,
            m.path as video_url_raw,
            (SELECT path FROM media m2 WHERE m2.service_id = m.service_id AND m2.type = 'image' LIMIT 1) as thumbnail_raw,
            m.service_id,
            SUM(su.similarity_score) as collaborative_score,
            FALSE as is_sponsored,
            m.uploaded_at as created_at,
            COALESCE(m.ai_tags, ARRAY[]::text[]) as hashtags
        FROM similar_users su
        JOIN content_engagement ce ON ce.user_id = su.user_id
        JOIN media m ON m.id::text = ce.content_id OR 'media_' || m.service_id || '_' || m.id = ce.content_id
        JOIN services s ON s.id = m.service_id
        WHERE ce.liked = TRUE
          AND m.type = 'video'
          AND m.path IS NOT NULL
          AND s.is_active = TRUE
          AND COALESCE(m.id::text, 'media_' || m.service_id || '_' || m.id) != ALL($2::text[])
          AND COALESCE(m.id::text, 'media_' || m.service_id || '_' || m.id) NOT IN (
              SELECT content_id FROM content_engagement WHERE user_id = $1
          )
        GROUP BY m.id, m.service_id, s.data, m.path, m.uploaded_at, m.ai_tags
        ORDER BY collaborative_score DESC
        LIMIT $3
    "#;

    let rows = sqlx::query(query)
        .bind(user_id)
        .bind(exclude_ids)
        .bind(limit)
        .fetch_all(pool)
        .await?;

    Ok(rows
        .iter()
        .map(|row| {
            let collaborative_score: f64 = row.get::<f64, _>("collaborative_score");

            // ✅ CORRIGÉ: Transformer paths en URLs S3/Wasabi avec fallback local
            let video_url_raw: String = row.get::<String, _>("video_url_raw");
            let thumbnail_raw: Option<String> = row.get::<Option<String>, _>("thumbnail_raw");

            let video_url = build_media_url_with_fallback(&state, &video_url_raw);
            let thumbnail = thumbnail_raw
                .as_ref()
                .map(|t| build_media_url_with_fallback(&state, t));

            MLRecommendedVideo {
                id: row.get::<String, _>("id"),
                content_id: row.get::<String, _>("content_id"),
                titre: row.get::<String, _>("titre"),
                description: row.get::<Option<String>, _>("description"),
                video_url,
                thumbnail,
                service_id: row.get::<Option<i32>, _>("service_id"),
                similarity_score: collaborative_score,
                engagement_score: collaborative_score,
                recency_score: 1.0,
                total_score: collaborative_score,
                is_sponsored: false,
                hashtags: row.get::<Vec<String>, _>("hashtags"),
                created_at: row
                    .get::<chrono::DateTime<chrono::Utc>, _>("created_at")
                    .to_rfc3339(),
            }
        })
        .collect())
}

/// Déduplique et trie les vidéos par score total
fn deduplicate_and_sort_videos(
    mut videos: Vec<MLRecommendedVideo>,
    limit: i32,
) -> Vec<MLRecommendedVideo> {
    // Dédupliquer par content_id
    videos.sort_by(|a, b| {
        b.total_score
            .partial_cmp(&a.total_score)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    videos.dedup_by(|a, b| a.content_id == b.content_id);

    // Trier par score total décroissant
    videos.sort_by(|a, b| {
        b.total_score
            .partial_cmp(&a.total_score)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    videos.into_iter().take(limit as usize).collect()
}

/// Recommandations populaires (pour nouveaux utilisateurs)
async fn get_popular_recommendations(
    pool: &PgPool,
    state: &Arc<AppState>,
    limit: i32,
    categories: Vec<String>,
    exclude_ids: Vec<String>,
) -> Result<Json<MLRecommendationsResponse>, StatusCode> {
    // Utiliser recommandations engagement améliorées (sans préférences utilisateur)
    let user_prefs = UserPreferences::default();
    let videos = get_engagement_based_recommendations_enhanced(
        pool,
        state,
        0,
        limit,
        &categories,
        &exclude_ids,
        &user_prefs,
    )
    .await;

    Ok(Json(MLRecommendationsResponse {
        success: true,
        data: videos,
        algorithm_version: "popular_v1.0".to_string(),
        user_profile_strength: 0.0,
    }))
}
