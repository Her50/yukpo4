use crate::services::{
    publicite_filtering_service::PubliciteFilteringService,
    publicite_frequency_service::PubliciteFrequencyService,
    publicite_geographic_service::{GeographicLocation, PubliciteGeographicService},
};
use crate::state::AppState;
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
};
use log;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::{PgPool, Row};
use std::collections::{HashMap, HashSet};
use std::sync::Arc;

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct PubliciteVideoMeta {
    pub format: Option<String>,
    pub source: Option<String>,
    pub duration_ms: Option<i64>,
    pub ai_generated: Option<bool>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct TargetingOptions {
    #[serde(rename = "age_range")]
    pub age_range: Option<AgeRange>,
    pub gender: Option<String>,
    pub interests: Option<Vec<String>>,
    pub behaviors: Option<Vec<String>>,
    pub locations: Option<Vec<String>>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct AgeRange {
    pub min: i32,
    pub max: i32,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ABTestingVariant {
    pub titre: String,
    pub description: Option<String>,
    #[serde(rename = "is_active")]
    pub is_active: bool,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ABTesting {
    pub variants: Option<Vec<ABTestingVariant>>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ScheduleOptions {
    #[serde(rename = "start_date")]
    pub start_date: Option<String>,
    #[serde(rename = "end_date")]
    pub end_date: Option<String>,
    #[serde(rename = "start_time")]
    pub start_time: Option<String>,
    #[serde(rename = "end_time")]
    pub end_time: Option<String>,
    pub timezone: Option<String>,
    #[serde(rename = "pause_on_weekends")]
    pub pause_on_weekends: Option<bool>,
    #[serde(rename = "pause_hours")]
    pub pause_hours: Option<PauseHours>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct PauseHours {
    pub start: i32,
    pub end: i32,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct Placement {
    pub r#type: String,
    pub budget: Option<i32>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct BidStrategy {
    pub r#type: String,
    #[serde(rename = "bid_amount")]
    pub bid_amount: Option<f64>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct RetargetingRule {
    pub r#type: String,
    #[serde(rename = "days_since")]
    pub days_since: Option<i32>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct Retargeting {
    pub rules: Option<Vec<RetargetingRule>>,
}

#[derive(Debug, Deserialize)]
pub struct CreatePubliciteRequest {
    pub user_id: i32,
    pub titre: String,
    pub description: Option<String>,
    pub produits_indexes: Vec<String>,
    pub videos: Vec<String>,     // Base64
    pub thumbnails: Vec<String>, // Base64
    pub videos_meta: Option<Vec<PubliciteVideoMeta>>,
    pub duree_jours: i32,
    pub cout: i32, // En FCFA
    pub zone_geographique: String,
    pub devise_utilisateur: Option<String>,
    pub geo_publicitaire: Option<String>, // Format: "lat,lng"
    pub rayon_km: Option<i32>,
    // ✅ NOUVEAU: Fonctionnalités avancées pour 100% parité
    pub targeting: Option<TargetingOptions>,
    #[serde(rename = "ab_testing")]
    pub ab_testing: Option<ABTesting>,
    pub schedule: Option<ScheduleOptions>,
    pub placements: Option<Vec<Placement>>,
    #[serde(rename = "bid_strategy")]
    pub bid_strategy: Option<BidStrategy>,
    pub retargeting: Option<Retargeting>,
}

#[derive(Debug, Serialize)]
pub struct PubliciteResponse {
    pub id: i32,
    pub user_id: i32,
    pub titre: String,
    pub description: Option<String>,
    pub produits_indexes: Vec<String>,
    pub duree_jours: i32,
    pub cout: i32,
    pub zone_geographique: String,
    pub status: String,
    pub vues: i32,
    pub clics: i32,
    pub date_debut: String,
    pub date_fin: String,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
pub struct PubliciteDashboardStats {
    pub total_vues: i64,
    pub total_clics: i64,
    pub taux_conversion_moyen: f64,
    pub budget_total_depense: i64,
    pub publicites_actives: i64,
    pub video_summary: VideoPerformanceSummary,
}

#[derive(Debug, Serialize)]
pub struct PubliciteDashboardResponse {
    pub stats: PubliciteDashboardStats,
    pub publicites: Vec<PubliciteWithDetails>,
}

#[derive(Debug, Serialize)]
pub struct PubliciteWithDetails {
    pub id: i32,
    pub titre: String,
    pub status: String,
    pub vues: i32,
    pub clics: i32,
    pub conversion_rate: f64,
    pub budget_depense: i32,
    pub jours_restants: i64,
    pub zone_geographique: String,
    pub produits_count: i32,
    pub date_debut: String,
    pub date_fin: String,
    pub produits: Vec<serde_json::Value>,
    pub videos_meta: Vec<PubliciteVideoMeta>,
    pub video_stats: Value,
}

#[derive(Debug, Default, Serialize)]
pub struct VideoPerformanceSummary {
    pub views_by_format: HashMap<String, i64>,
    pub clicks_by_format: HashMap<String, i64>,
    pub ai_generated_videos: i64,
    pub manual_videos: i64,
}

#[derive(Debug, Deserialize)]
pub struct GetPublicitesQuery {
    pub categories: Option<String>,
    pub user_id: Option<i32>,
    pub placement: Option<String>, // "feed", "stories", "carousel", "search", etc.
    pub latitude: Option<f64>,     // Localisation utilisateur
    pub longitude: Option<f64>,    // Localisation utilisateur
}

#[derive(Debug, Deserialize)]
pub struct TrackClickRequest {
    pub publicite_id: i32,
    pub user_id: Option<i32>,
    pub video_format: Option<String>,
    pub video_source: Option<String>,
}

/// Créer une nouvelle publicité
pub async fn create_publicite(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CreatePubliciteRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let pool = &state.pg;
    log::info!(
        "🎯 [Publicité] Création publicité pour user {}",
        payload.user_id
    );

    // Valider les données
    if payload.produits_indexes.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    if payload.titre.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    // Parser le point GPS si fourni
    let geo_point = if let Some(ref geo_str) = payload.geo_publicitaire {
        match parse_gps_point(geo_str) {
            Some((lat, lng)) => Some(format!("ST_MakePoint({}, {})", lng, lat)),
            None => None,
        }
    } else {
        None
    };

    // Calculer le rayon selon la zone
    let rayon = payload
        .rayon_km
        .unwrap_or_else(|| match payload.zone_geographique.as_str() {
            "local" => 50,
            "regional" => 500,
            _ => 0,
        });

    // Calculer métadonnées vidéos
    let videos_meta_vec = payload.videos_meta.clone().unwrap_or_default();
    let videos_meta_json = serde_json::to_value(&videos_meta_vec).unwrap_or_else(|_| json!([]));

    let mut ai_generated_count: i64 = 0;
    let mut manual_count: i64 = 0;
    for meta in &videos_meta_vec {
        let ai_generated = meta.ai_generated.unwrap_or_else(|| {
            meta.source
                .as_ref()
                .map(|s| s.to_lowercase().contains("ai"))
                .unwrap_or(false)
        });
        if ai_generated {
            ai_generated_count += 1;
        } else {
            manual_count += 1;
        }
    }
    let mut video_stats_json = json!({});
    if ai_generated_count > 0 || manual_count > 0 {
        video_stats_json["inventory"] = json!({
            "ai_generated": ai_generated_count,
            "manual": manual_count
        });
    }

    // ✅ NOUVEAU: Préparer les données JSON pour les fonctionnalités avancées
    let targeting_json = serde_json::to_value(&payload.targeting).unwrap_or_else(|_| json!({}));
    let ab_testing_json = serde_json::to_value(&payload.ab_testing).unwrap_or_else(|_| json!({}));
    let schedule_json = serde_json::to_value(&payload.schedule).unwrap_or_else(|_| json!(null));
    let placements_json = serde_json::to_value(&payload.placements).unwrap_or_else(|_| json!([]));
    let bid_strategy_json =
        serde_json::to_value(&payload.bid_strategy).unwrap_or_else(|_| json!({}));
    let retargeting_json = serde_json::to_value(&payload.retargeting).unwrap_or_else(|_| json!({}));

    // Vérifier le solde de l'utilisateur
    let user_balance: Option<i32> =
        sqlx::query_scalar("SELECT tokens_balance FROM users WHERE id = $1")
            .bind(payload.user_id)
            .fetch_optional(pool)
            .await
            .map_err(|e| {
                log::error!("Erreur vérification solde: {:?}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;

    let balance = user_balance.unwrap_or(0);
    if balance < payload.cout {
        log::warn!("Solde insuffisant: {} < {}", balance, payload.cout);
        return Ok(Json(serde_json::json!({
            "success": false,
            "error": "insufficient_balance",
            "message": "Solde insuffisant pour créer cette publicité"
        })));
    }

    // Déduire le coût du solde
    sqlx::query("UPDATE users SET tokens_balance = tokens_balance - $1 WHERE id = $2")
        .bind(payload.cout as i64)
        .bind(payload.user_id)
        .execute(pool)
        .await
        .map_err(|e| {
            log::error!("Erreur déduction solde: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    // ✅ NOUVEAU: Gérer la planification (date_debut peut être dans le schedule)
    let date_debut_opt = if let Some(ref schedule) = payload.schedule {
        if let Some(ref start_date) = schedule.start_date {
            // Parser la date ISO depuis le schedule
            chrono::DateTime::parse_from_rfc3339(start_date)
                .ok()
                .map(|dt| dt.naive_utc())
        } else {
            None
        }
    } else {
        None
    };

    // Insérer la publicité
    let result = if let Some(geo) = geo_point {
        // Avec géolocalisation PostGIS
        if let Some(start_dt) = date_debut_opt {
            sqlx::query(&format!(
                r#"
                INSERT INTO publicites (
                    user_id, titre, description, produits_indexes, videos, thumbnails, videos_meta, video_stats,
                    duree_jours, cout, zone_geographique, geo_publicitaire, rayon_km,
                    targeting, ab_testing, schedule, placements, bid_strategy, retargeting,
                    date_debut, date_fin
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, {}, $12, $13, $14, $15, $16, $17, $18, $19, $19 + ($9 || ' days')::interval)
                RETURNING id, date_debut, date_fin
                "#,
                geo
            ))
            .bind(payload.user_id)
            .bind(&payload.titre)
            .bind(&payload.description)
            .bind(&payload.produits_indexes)
            .bind(&payload.videos)
            .bind(&payload.thumbnails)
            .bind(videos_meta_json.clone())
            .bind(video_stats_json.clone())
            .bind(payload.duree_jours)
            .bind(payload.cout)
            .bind(&payload.zone_geographique)
            .bind(rayon)
            .bind(targeting_json.clone())
            .bind(ab_testing_json.clone())
            .bind(schedule_json.clone())
            .bind(placements_json.clone())
            .bind(bid_strategy_json.clone())
            .bind(retargeting_json.clone())
            .bind(start_dt)
            .fetch_one(pool)
            .await
        } else {
            sqlx::query(&format!(
                r#"
                INSERT INTO publicites (
                    user_id, titre, description, produits_indexes, videos, thumbnails, videos_meta, video_stats,
                    duree_jours, cout, zone_geographique, geo_publicitaire, rayon_km,
                    targeting, ab_testing, schedule, placements, bid_strategy, retargeting,
                    date_debut, date_fin
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, {}, $12, $13, $14, $15, $16, $17, $18, NOW(), NOW() + ($9 || ' days')::interval)
                RETURNING id, date_debut, date_fin
                "#,
                geo
            ))
            .bind(payload.user_id)
            .bind(&payload.titre)
            .bind(&payload.description)
            .bind(&payload.produits_indexes)
            .bind(&payload.videos)
            .bind(&payload.thumbnails)
            .bind(videos_meta_json.clone())
            .bind(video_stats_json.clone())
            .bind(payload.duree_jours)
            .bind(payload.cout)
            .bind(&payload.zone_geographique)
            .bind(rayon)
            .bind(targeting_json.clone())
            .bind(ab_testing_json.clone())
            .bind(schedule_json.clone())
            .bind(placements_json.clone())
            .bind(bid_strategy_json.clone())
            .bind(retargeting_json.clone())
            .fetch_one(pool)
            .await
        }
    } else {
        // Sans géolocalisation
        if let Some(start_dt) = date_debut_opt {
            sqlx::query(
                r#"
                INSERT INTO publicites (
                    user_id, titre, description, produits_indexes, videos, thumbnails, videos_meta, video_stats,
                    duree_jours, cout, zone_geographique, rayon_km,
                    targeting, ab_testing, schedule, placements, bid_strategy, retargeting,
                    date_debut, date_fin
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $19 + ($9 || ' days')::interval)
                RETURNING id, date_debut, date_fin
                "#
            )
            .bind(payload.user_id)
            .bind(&payload.titre)
            .bind(&payload.description)
            .bind(&payload.produits_indexes)
            .bind(&payload.videos)
            .bind(&payload.thumbnails)
            .bind(videos_meta_json.clone())
            .bind(video_stats_json.clone())
            .bind(payload.duree_jours)
            .bind(payload.cout)
            .bind(&payload.zone_geographique)
            .bind(rayon)
            .bind(targeting_json.clone())
            .bind(ab_testing_json.clone())
            .bind(schedule_json.clone())
            .bind(placements_json.clone())
            .bind(bid_strategy_json.clone())
            .bind(retargeting_json.clone())
            .bind(start_dt)
            .fetch_one(pool)
            .await
        } else {
            sqlx::query(
                r#"
                INSERT INTO publicites (
                    user_id, titre, description, produits_indexes, videos, thumbnails, videos_meta, video_stats,
                    duree_jours, cout, zone_geographique, rayon_km,
                    targeting, ab_testing, schedule, placements, bid_strategy, retargeting,
                    date_debut, date_fin
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW(), NOW() + ($9 || ' days')::interval)
                RETURNING id, date_debut, date_fin
                "#
            )
            .bind(payload.user_id)
            .bind(&payload.titre)
            .bind(&payload.description)
            .bind(&payload.produits_indexes)
            .bind(&payload.videos)
            .bind(&payload.thumbnails)
            .bind(videos_meta_json.clone())
            .bind(video_stats_json.clone())
            .bind(payload.duree_jours)
            .bind(payload.cout)
            .bind(&payload.zone_geographique)
            .bind(rayon)
            .bind(targeting_json.clone())
            .bind(ab_testing_json.clone())
            .bind(schedule_json.clone())
            .bind(placements_json.clone())
            .bind(bid_strategy_json.clone())
            .bind(retargeting_json.clone())
            .fetch_one(pool)
            .await
        }
    };

    match result {
        Ok(record) => {
            let pub_id: i32 = record.get::<i32, _>("id");

            log::info!("✅ Publicité créée: ID {}", pub_id);

            Ok(Json(serde_json::json!({
                "success": true,
                "publicite_id": pub_id,
                "message": "Publicité créée avec succès"
            })))
        }
        Err(e) => {
            log::error!("Erreur création publicité: {:?}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

fn parse_gps_point(geo_str: &str) -> Option<(f64, f64)> {
    let parts: Vec<&str> = geo_str.split(',').collect();
    if parts.len() == 2 {
        if let (Ok(lat), Ok(lng)) = (
            parts[0].trim().parse::<f64>(),
            parts[1].trim().parse::<f64>(),
        ) {
            return Some((lat, lng));
        }
    }
    None
}

/// Récupérer toutes les publicités actives
pub async fn get_active_publicites(
    State(state): State<Arc<AppState>>,
    Query(params): Query<GetPublicitesQuery>,
) -> Result<Json<Vec<serde_json::Value>>, StatusCode> {
    let pool = &state.pg;
    log::info!("📋 [Publicité] Récupération publicités actives");

    let categories: Vec<String> = params
        .categories
        .as_ref()
        .map(|c| {
            c.split(',')
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect()
        })
        .unwrap_or_default();
    let categories_lower: HashSet<String> = categories.iter().map(|c| c.to_lowercase()).collect();

    // ✅ AMÉLIORÉ: Récupérer les infos utilisateur pour le filtrage avancé
    let user_id_param = params.user_id;
    let (user_age, user_gender, user_interests, user_behaviors) = if let Some(uid) = user_id_param {
        // Récupérer les infos utilisateur pour le ciblage
        let user_row = sqlx::query(
            r#"
            SELECT age, gender, interests, behaviors
            FROM users
            WHERE id = $1
            "#,
        )
        .bind(uid)
        .fetch_optional(pool)
        .await
        .ok()
        .flatten();

        if let Some(row) = user_row {
            (
                row.get::<Option<i32>, _>("age"),
                row.get::<Option<String>, _>("gender"),
                row.get::<Option<Vec<String>>, _>("interests")
                    .unwrap_or_default(),
                row.get::<Option<Vec<String>>, _>("behaviors")
                    .unwrap_or_default(),
            )
        } else {
            (None, None, vec![], vec![])
        }
    } else {
        (None, None, vec![], vec![])
    };

    // ✅ AMÉLIORÉ: Récupérer la localisation utilisateur si disponible
    let user_location = if let (Some(lat), Some(lng)) = (params.latitude, params.longitude) {
        Some(GeographicLocation {
            latitude: lat,
            longitude: lng,
            city: None,
            region: None,
            country: None,
        })
    } else {
        None
    };

    // ✅ AMÉLIORÉ: Placement demandé (par défaut: "feed")
    let requested_placement = params.placement.as_deref().unwrap_or("feed");

    // ✅ AMÉLIORÉ: Inclure les nouvelles colonnes et filtrer par planification + ciblage + retargeting
    let mut query_str = r#"
        SELECT 
            id, user_id, titre, description, produits_indexes, videos, thumbnails, videos_meta, video_stats,
            duree_jours, cout, zone_geographique, status, vues, clics,
            date_debut, date_fin, created_at,
            targeting, ab_testing, schedule, placements, bid_strategy, retargeting,
            geo_publicitaire, rayon_km, frequency_config
        FROM publicites
        WHERE status = 'active' 
        AND date_debut <= NOW()
        AND date_fin > NOW()
        AND (schedule IS NULL OR is_publicite_scheduled_active(id))
        "#
    .to_string();

    // ✅ AMÉLIORÉ: Filtrer par placements si spécifié
    query_str.push_str(&format!(
        r#"
        AND (
            placements IS NULL
            OR placements = '[]'::jsonb
            OR EXISTS (
                SELECT 1
                FROM jsonb_array_elements(placements) AS p
                WHERE p->>'type' = '{}'
            )
        )
        "#,
        requested_placement
    ));

    query_str.push_str(" ORDER BY created_at DESC LIMIT 100");

    // ✅ AMÉLIORÉ: Exécuter la requête avec les paramètres de ciblage si utilisateur connecté
    let rows = if let Some(uid) = user_id_param {
        // Version avec filtrage utilisateur (ciblage + retargeting)
        let query_with_targeting = format!(
            r#"
            SELECT 
                id, user_id, titre, description, produits_indexes, videos, thumbnails, videos_meta, video_stats,
                duree_jours, cout, zone_geographique, status, vues, clics,
                date_debut, date_fin, created_at,
                targeting, ab_testing, schedule, placements, bid_strategy, retargeting,
                geo_publicitaire, rayon_km, frequency_config
            FROM publicites
            WHERE status = 'active' 
            AND date_debut <= NOW()
            AND date_fin > NOW()
            AND (schedule IS NULL OR is_publicite_scheduled_active(id))
            AND (
                placements IS NULL
                OR placements = '[]'::jsonb
                OR EXISTS (
                    SELECT 1
                    FROM jsonb_array_elements(placements) AS p
                    WHERE p->>'type' = '{}'
                )
            )
            AND (
                targeting IS NULL 
                OR targeting = '{{}}'::jsonb
                OR matches_targeting(
                    targeting,
                    $1,
                    $2,
                    $3::text[],
                    $4::text[]
                )
            )
            AND (
                retargeting IS NULL
                OR retargeting = '{{}}'::jsonb
                OR matches_retargeting(retargeting, $5)
            )
            ORDER BY created_at DESC
            LIMIT 100
            "#,
            requested_placement
        );
        
        sqlx::query(&query_with_targeting)
            .bind(user_age.unwrap_or(30))
            .bind(user_gender.as_deref().unwrap_or("all"))
            .bind(&user_interests)
            .bind(&user_behaviors)
            .bind(uid)
            .fetch_all(pool)
            .await
    } else {
        // Version sans filtrage utilisateur
        sqlx::query(&query_str).fetch_all(pool).await
    }
    .map_err(|e| {
        log::error!("Erreur récupération publicités: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // ✅ NOUVEAU: Filtrer par zone géographique
    let mut publicite_ids: Vec<i32> = rows.iter().map(|r| r.get::<i32, _>("id")).collect();

    if let Some(loc) = user_location {
        let filtered_ids = PubliciteGeographicService::filter_by_geographic_zone(
            pool,
            publicite_ids.clone(),
            Some(loc),
        )
        .await
        .unwrap_or(publicite_ids.clone());
        publicite_ids = filtered_ids;
    }

    // ✅ NOUVEAU: Filtrer par fréquence si utilisateur connecté
    if let Some(uid) = user_id_param {
        let filtered_ids = PubliciteFrequencyService::filter_by_frequency(
            pool,
            publicite_ids.clone(),
            uid,
            Some("daily"),
        )
        .await
        .unwrap_or(publicite_ids.clone());
        publicite_ids = filtered_ids;
    }

    // ✅ NOUVEAU: Filtrer les rows selon les IDs filtrés et créer un HashMap pour accès rapide
    let filtered_ids_set: HashSet<i32> = publicite_ids.into_iter().collect();
    let rows: Vec<_> = rows
        .into_iter()
        .filter(|r| {
            let id: i32 = r.get::<i32, _>("id");
            filtered_ids_set.contains(&id)
        })
        .take(50) // Limiter à 50 résultats finaux
        .collect();

    let mut prepared_publicites: Vec<PubliciteItem> = Vec::new();
    let mut produit_service_ids: HashSet<i32> = HashSet::new();

    for row in rows {
        let id: i32 = row.get::<i32, _>("id");
        let user_id: i32 = row.get::<i32, _>("user_id");
        let titre: String = row.get::<String, _>("titre");
        let description: Option<String> = row.get::<Option<String>, _>("description");
        let produits_indexes: Vec<String> = row.get::<Vec<String>, _>("produits_indexes");
        let zone: String = row.get::<String, _>("zone_geographique");
        let status: String = row.get::<String, _>("status");
        let vues: i32 = row.get::<i32, _>("vues");
        let clics: i32 = row.get::<i32, _>("clics");
        let videos_meta_value: Value = row
            .get::<Option<Value>, _>("videos_meta")
            .unwrap_or_else(|| json!([]));
        let video_stats_value: Value = row
            .get::<Option<Value>, _>("video_stats")
            .unwrap_or_else(|| json!({}));
        // ✅ NOUVEAU: Extraire les nouvelles colonnes depuis la base de données
        let targeting_value: Value = row
            .get::<Option<Value>, _>("targeting")
            .unwrap_or_else(|| json!({}));
        let ab_testing_value: Value = row
            .get::<Option<Value>, _>("ab_testing")
            .unwrap_or_else(|| json!({}));
        let schedule_value: Value = row
            .get::<Option<Value>, _>("schedule")
            .unwrap_or_else(|| json!(null));
        let placements_value: Value = row
            .get::<Option<Value>, _>("placements")
            .unwrap_or_else(|| json!([]));
        let bid_strategy_value: Value = row
            .get::<Option<Value>, _>("bid_strategy")
            .unwrap_or_else(|| json!({}));
        let retargeting_value: Value = row
            .get::<Option<Value>, _>("retargeting")
            .unwrap_or_else(|| json!({}));

        // ✅ AMÉLIORÉ: Sélectionner et appliquer la meilleure variante A/B
        let mut final_titre = titre.clone();
        let mut final_description = description.clone();
        let mut variant_selected: Option<String> = None;

        if let Ok(Some(best_variant_id)) =
            PubliciteFilteringService::select_best_ab_variant(pool, id).await
        {
            if let Some(variants_array) =
                ab_testing_value.get("variants").and_then(|v| v.as_array())
            {
                if let Some(best_variant) = variants_array.iter().find(|v| {
                    v.get("id").and_then(|id| id.as_str()) == Some(best_variant_id.as_str())
                }) {
                    // Appliquer le titre et description de la meilleure variante
                    if let Some(variant_titre) = best_variant.get("titre").and_then(|t| t.as_str())
                    {
                        final_titre = variant_titre.to_string();
                    }
                    if let Some(variant_desc) =
                        best_variant.get("description").and_then(|d| d.as_str())
                    {
                        final_description = Some(variant_desc.to_string());
                    }
                    variant_selected = Some(best_variant_id);
                }
            }
        }

        for service_id in produits_indexes
            .iter()
            .filter_map(|idx| extract_service_id(idx))
        {
            produit_service_ids.insert(service_id);
        }

        // ✅ NOUVEAU: Enregistrer l'impression si utilisateur connecté
        if let Some(uid) = user_id_param {
            let _ =
                PubliciteFrequencyService::record_impression(pool, id, uid, requested_placement)
                    .await;
        }

        let json = serde_json::json!({
            "id": id,
            "user_id": user_id,
            "titre": final_titre, // ✅ AMÉLIORÉ: Titre de la variante A/B gagnante
            "description": final_description, // ✅ AMÉLIORÉ: Description de la variante A/B gagnante
            "produits_indexes": produits_indexes.clone(),
            "zone_geographique": zone,
            "status": status,
            "vues": vues,
            "clics": clics,
            "videos_meta": videos_meta_value,
            "video_stats": video_stats_value,
            // ✅ NOUVEAU: Nouvelles données
            "targeting": targeting_value,
            "ab_testing": ab_testing_value,
            "schedule": schedule_value,
            "placements": placements_value,
            "bid_strategy": bid_strategy_value,
            "retargeting": retargeting_value,
            "placement": requested_placement, // Placement actuel
            "variant_selected": variant_selected, // ✅ AMÉLIORÉ: ID de la variante A/B sélectionnée
        });

        prepared_publicites.push(PubliciteItem {
            json,
            produits_indexes,
        });
    }

    let service_category_map = if !categories_lower.is_empty() && !produit_service_ids.is_empty() {
        fetch_service_categories(pool, &produit_service_ids)
            .await
            .map_err(|e| {
                log::error!(
                    "Erreur récupération catégories services pour publicités: {:?}",
                    e
                );
                StatusCode::INTERNAL_SERVER_ERROR
            })?
    } else {
        HashMap::new()
    };

    let mut filtered_publicites: Vec<serde_json::Value> = if categories_lower.is_empty() {
        prepared_publicites
            .iter()
            .map(|item| item.json.clone())
            .collect()
    } else {
        prepared_publicites
            .iter()
            .filter(|item| {
                item.produits_indexes.iter().any(|idx| {
                    extract_service_id(idx)
                        .and_then(|service_id| {
                            service_category_map
                                .get(&service_id)
                                .and_then(|cat| cat.as_ref())
                        })
                        .map(|category| categories_lower.contains(&category.to_lowercase()))
                        .unwrap_or(false)
                })
            })
            .map(|item| item.json.clone())
            .collect()
    };

    if filtered_publicites.is_empty() && !categories_lower.is_empty() {
        log::info!(
            "ℹ️ [Publicité] Aucune publicité ne correspond aux catégories {:?}, retour au flux complet",
            categories
        );
        filtered_publicites = prepared_publicites
            .into_iter()
            .map(|item| item.json)
            .collect();
    }

    Ok(Json(filtered_publicites))
}

/// Dashboard des publicités pour un utilisateur
pub async fn get_publicite_dashboard(
    State(state): State<Arc<AppState>>,
    Query(user_query): Query<std::collections::HashMap<String, String>>,
) -> Result<Json<PubliciteDashboardResponse>, StatusCode> {
    let pool = &state.pg;
    let user_id: i32 = user_query
        .get("user_id")
        .and_then(|s| s.parse().ok())
        .unwrap_or(0);

    log::info!("📊 [Publicité] Dashboard pour user {}", user_id);

    // Stats globales
    let stats_row = sqlx::query(
        r#"
        SELECT 
            COALESCE(SUM(vues), 0) as total_vues,
            COALESCE(SUM(clics), 0) as total_clics,
            COALESCE(SUM(cout), 0) as budget_total,
            COUNT(CASE WHEN status = 'active' THEN 1 END) as actives
        FROM publicites
        WHERE user_id = $1
        "#,
    )
    .bind(user_id)
    .fetch_one(pool)
    .await
    .map_err(|e| {
        log::error!("Erreur stats publicité: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let total_vues: i64 = stats_row.get::<Option<i64>, _>("total_vues").unwrap_or(0);
    let total_clics: i64 = stats_row.get::<Option<i64>, _>("total_clics").unwrap_or(0);
    let taux_conversion = if total_vues > 0 {
        (total_clics as f64 / total_vues as f64) * 100.0
    } else {
        0.0
    };

    let mut stats = PubliciteDashboardStats {
        total_vues,
        total_clics,
        taux_conversion_moyen: taux_conversion,
        budget_total_depense: stats_row.get::<Option<i64>, _>("budget_total").unwrap_or(0),
        publicites_actives: stats_row.get::<Option<i32>, _>("actives").unwrap_or(0) as i64,
        video_summary: VideoPerformanceSummary::default(),
    };

    // Liste des publicités
    let pub_rows = sqlx::query(
        r#"
        SELECT 
            id, titre, status, vues, clics, cout as budget_depense,
            zone_geographique, produits_indexes, date_debut, date_fin,
            EXTRACT(DAY FROM (date_fin - NOW()))::integer as jours_restants,
            videos_meta, video_stats
        FROM publicites
        WHERE user_id = $1
        ORDER BY created_at DESC
        "#,
    )
    .bind(user_id)
    .fetch_all(pool)
    .await
    .map_err(|e| {
        log::error!("Erreur liste publicités: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let mut publicites: Vec<PubliciteWithDetails> = Vec::new();
    let mut video_summary = VideoPerformanceSummary::default();

    for row in pub_rows.iter() {
        let vues: i32 = row.get::<Option<i32>, _>("vues").unwrap_or(0);
        let clics: i32 = row.get::<Option<i32>, _>("clics").unwrap_or(0);
        let conversion = if vues > 0 {
            (clics as f64 / vues as f64) * 100.0
        } else {
            0.0
        };

        let produits_indexes: Vec<String> = row
            .get::<Option<Vec<String>>, _>("produits_indexes")
            .unwrap_or_default();
        let video_stats_value: Value = row
            .get::<Option<Value>, _>("video_stats")
            .unwrap_or_else(|| json!({}));
        let videos_meta_value: Value = row
            .get::<Option<Value>, _>("videos_meta")
            .unwrap_or_else(|| json!([]));
        let videos_meta: Vec<PubliciteVideoMeta> =
            serde_json::from_value(videos_meta_value.clone()).unwrap_or_default();

        if let Some(views_obj) = video_stats_value.get("views").and_then(|v| v.as_object()) {
            for (format, count) in views_obj {
                let format_key = format.to_lowercase();
                let increment = count.as_i64().unwrap_or(0);
                if increment > 0 {
                    *video_summary.views_by_format.entry(format_key).or_insert(0) += increment;
                }
            }
        }

        if let Some(clicks_obj) = video_stats_value.get("clicks").and_then(|v| v.as_object()) {
            for (format, count) in clicks_obj {
                let format_key = format.to_lowercase();
                let increment = count.as_i64().unwrap_or(0);
                if increment > 0 {
                    *video_summary
                        .clicks_by_format
                        .entry(format_key)
                        .or_insert(0) += increment;
                }
            }
        }

        let mut ai_count: i64 = 0;
        let mut manual_count: i64 = 0;
        for meta in &videos_meta {
            let ai_generated = meta.ai_generated.unwrap_or_else(|| {
                meta.source
                    .as_ref()
                    .map(|s| s.to_lowercase().contains("ai"))
                    .unwrap_or(false)
            });
            if ai_generated {
                ai_count += 1;
            } else {
                manual_count += 1;
            }
        }
        video_summary.ai_generated_videos += ai_count;
        video_summary.manual_videos += manual_count.max(0);

        publicites.push(PubliciteWithDetails {
            id: row.get::<i32, _>("id"),
            titre: row.get::<String, _>("titre"),
            status: row.get::<String, _>("status"),
            vues,
            clics,
            conversion_rate: conversion,
            budget_depense: row.get::<Option<i64>, _>("budget_depense").unwrap_or(0) as i32,
            jours_restants: row.get::<Option<i32>, _>("jours_restants").unwrap_or(0) as i64,
            zone_geographique: row.get::<String, _>("zone_geographique"),
            produits_count: produits_indexes.len() as i32,
            date_debut: "".to_string(),
            date_fin: "".to_string(),
            produits: vec![],
            videos_meta,
            video_stats: video_stats_value,
        });
    }

    stats.video_summary = video_summary;

    Ok(Json(PubliciteDashboardResponse { stats, publicites }))
}

/// Analytics avancés avec tendances temporelles et comparaisons
#[derive(Debug, Serialize)]
pub struct AdvancedAnalyticsResponse {
    pub time_series: Vec<TimeSeriesData>,
    pub campaign_comparison: Vec<CampaignComparison>,
    pub conversion_funnel: ConversionFunnel,
    pub performance_by_placement: Vec<PlacementPerformance>,
    pub performance_by_targeting: Vec<TargetingPerformance>,
}

#[derive(Debug, Serialize)]
pub struct TimeSeriesData {
    pub date: String,
    pub vues: i64,
    pub clics: i64,
    pub conversions: f64,
    pub budget: i64,
    pub impressions: i64,
}

#[derive(Debug, Serialize)]
pub struct CampaignComparison {
    pub campaign_id: i32,
    pub titre: String,
    pub vues: i64,
    pub clics: i64,
    pub conversion_rate: f64,
    pub budget: i64,
    pub roi: f64,
}

#[derive(Debug, Serialize)]
pub struct ConversionFunnel {
    pub impressions: i64,
    pub views: i64,
    pub clicks: i64,
    pub conversions: i64,
    pub drop_off_rates: Vec<FunnelStep>,
}

#[derive(Debug, Serialize)]
pub struct FunnelStep {
    pub step: String,
    pub count: i64,
    pub drop_off_pct: f64,
}

#[derive(Debug, Serialize)]
pub struct PlacementPerformance {
    pub placement: String,
    pub vues: i64,
    pub clics: i64,
    pub conversion_rate: f64,
    pub ctr: f64,
}

#[derive(Debug, Serialize)]
pub struct TargetingPerformance {
    pub targeting_type: String,
    pub count: i64,
    pub avg_conversion: f64,
    pub avg_ctr: f64,
}

/// Endpoint pour analytics avancés
pub async fn get_advanced_analytics(
    State(state): State<Arc<AppState>>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> Result<Json<AdvancedAnalyticsResponse>, StatusCode> {
    let pool = &state.pg;
    let user_id: i32 = params
        .get("user_id")
        .and_then(|s| s.parse().ok())
        .unwrap_or(0);

    let period_days: i32 = params
        .get("period_days")
        .and_then(|s| s.parse().ok())
        .unwrap_or(30);

    log::info!(
        "📊 [Analytics Avancés] Pour user {} ({} jours)",
        user_id,
        period_days
    );

    // 1. Time Series - Tendances temporelles
    let time_series_rows = sqlx::query(
        r#"
        SELECT 
            DATE(created_at) as date,
            SUM(vues) as vues,
            SUM(clics) as clics,
            SUM(impressions) as impressions,
            SUM(cout) as budget,
            CASE 
                WHEN SUM(vues) > 0 THEN (SUM(clics)::float / SUM(vues)::float) * 100.0
                ELSE 0.0
            END as conversions
        FROM publicites
        WHERE user_id = $1
        AND created_at >= NOW() - ($2 || ' days')::interval
        GROUP BY DATE(created_at)
        ORDER BY date ASC
        "#,
    )
    .bind(user_id)
    .bind(period_days)
    .fetch_all(pool)
    .await
    .map_err(|e| {
        log::error!("Erreur time series: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let mut time_series = Vec::new();
    for row in time_series_rows {
        time_series.push(TimeSeriesData {
            date: row
                .get::<Option<chrono::NaiveDate>, _>("date")
                .unwrap_or_default()
                .format("%Y-%m-%d")
                .to_string(),
            vues: row.get::<Option<i32>, _>("vues").unwrap_or(0) as i64,
            clics: row.get::<Option<i32>, _>("clics").unwrap_or(0) as i64,
            conversions: row.get::<Option<f64>, _>("conversions").unwrap_or(0.0),
            budget: row.get::<Option<i64>, _>("budget").unwrap_or(0),
            impressions: row.get::<Option<i32>, _>("impressions").unwrap_or(0) as i64,
        });
    }

    // 2. Comparaison de campagnes
    let campaign_rows = sqlx::query(
        r#"
        SELECT 
            id as campaign_id,
            titre,
            vues,
            clics,
            cout as budget,
            CASE 
                WHEN vues > 0 THEN (clics::float / vues::float) * 100.0
                ELSE 0.0
            END as conversion_rate,
            CASE 
                WHEN cout > 0 AND clics > 0 THEN (clics::float / cout::float) * 100.0
                ELSE 0.0
            END as roi
        FROM publicites
        WHERE user_id = $1
        AND created_at >= NOW() - ($2 || ' days')::interval
        ORDER BY vues DESC
        LIMIT 10
        "#,
    )
    .bind(user_id)
    .bind(period_days)
    .fetch_all(pool)
    .await
    .map_err(|e| {
        log::error!("Erreur campaign comparison: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let mut campaign_comparison = Vec::new();
    for row in campaign_rows {
        campaign_comparison.push(CampaignComparison {
            campaign_id: row.get::<Option<i32>, _>("campaign_id").unwrap_or(0),
            titre: row.get::<String, _>("titre"),
            vues: row.get::<Option<i32>, _>("vues").unwrap_or(0) as i64,
            clics: row.get::<Option<i32>, _>("clics").unwrap_or(0) as i64,
            conversion_rate: row.get::<Option<f64>, _>("conversion_rate").unwrap_or(0.0),
            budget: row.get::<Option<i64>, _>("budget").unwrap_or(0),
            roi: row.get::<Option<f64>, _>("roi").unwrap_or(0.0),
        });
    }

    // 3. Funnel de conversion
    let funnel_row = sqlx::query(
        r#"
        SELECT 
            SUM(impressions) as impressions,
            SUM(vues) as views,
            SUM(clics) as clicks,
            COUNT(CASE WHEN clics > 0 THEN 1 END) as conversions
        FROM publicites
        WHERE user_id = $1
        AND created_at >= NOW() - ($2 || ' days')::interval
        "#,
    )
    .bind(user_id)
    .bind(period_days)
    .fetch_one(pool)
    .await
    .map_err(|e| {
        log::error!("Erreur funnel: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let impressions: i64 = funnel_row.get::<Option<i64>, _>("impressions").unwrap_or(0);
    let views: i64 = funnel_row.get::<Option<i64>, _>("views").unwrap_or(0);
    let clicks: i64 = funnel_row.get::<Option<i64>, _>("clicks").unwrap_or(0);
    let conversions: i64 = funnel_row.get::<Option<i64>, _>("conversions").unwrap_or(0);

    let mut drop_off_rates = Vec::new();
    if impressions > 0 {
        let views_drop = ((impressions - views) as f64 / impressions as f64) * 100.0;
        drop_off_rates.push(FunnelStep {
            step: "Impressions → Vues".to_string(),
            count: impressions - views,
            drop_off_pct: views_drop,
        });
    }
    if views > 0 {
        let clicks_drop = ((views - clicks) as f64 / views as f64) * 100.0;
        drop_off_rates.push(FunnelStep {
            step: "Vues → Clics".to_string(),
            count: views - clicks,
            drop_off_pct: clicks_drop,
        });
    }
    if clicks > 0 {
        let conv_drop = ((clicks - conversions) as f64 / clicks as f64) * 100.0;
        drop_off_rates.push(FunnelStep {
            step: "Clics → Conversions".to_string(),
            count: clicks - conversions,
            drop_off_pct: conv_drop,
        });
    }

    let conversion_funnel = ConversionFunnel {
        impressions,
        views,
        clicks,
        conversions,
        drop_off_rates,
    };

    // 4. Performance par placement
    let placement_rows = sqlx::query(
        r#"
        SELECT 
            jsonb_array_elements(placements)->>'type' as placement,
            SUM(vues) as vues,
            SUM(clics) as clics,
            CASE 
                WHEN SUM(vues) > 0 THEN (SUM(clics)::float / SUM(vues)::float) * 100.0
                ELSE 0.0
            END as conversion_rate,
            CASE 
                WHEN SUM(impressions) > 0 THEN (SUM(vues)::float / SUM(impressions)::float) * 100.0
                ELSE 0.0
            END as ctr
        FROM publicites
        WHERE user_id = $1
        AND created_at >= NOW() - ($2 || ' days')::interval
        AND placements IS NOT NULL
        AND jsonb_array_length(placements) > 0
        GROUP BY placement
        ORDER BY vues DESC
        "#,
    )
    .bind(user_id)
    .bind(period_days)
    .fetch_all(pool)
    .await
    .map_err(|e| {
        log::error!("Erreur placement performance: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let mut performance_by_placement = Vec::new();
    for row in placement_rows {
        let placement = row.get::<Option<String>, _>("placement");
        if let Some(placement) = placement {
            performance_by_placement.push(PlacementPerformance {
                placement,
                vues: row.get::<Option<i32>, _>("vues").unwrap_or(0) as i64,
                clics: row.get::<Option<i32>, _>("clics").unwrap_or(0) as i64,
                conversion_rate: row.get::<Option<f64>, _>("conversion_rate").unwrap_or(0.0),
                ctr: row.get::<Option<f64>, _>("ctr").unwrap_or(0.0),
            });
        }
    }

    // 5. Performance par ciblage
    let targeting_rows = sqlx::query(
        r#"
        SELECT 
            CASE 
                WHEN targeting->>'gender' IS NOT NULL AND targeting->>'gender' != 'all' THEN 'gender'
                WHEN targeting->'age_range' IS NOT NULL THEN 'age'
                WHEN targeting->'interests' IS NOT NULL AND jsonb_array_length(targeting->'interests') > 0 THEN 'interests'
                WHEN targeting->'behaviors' IS NOT NULL AND jsonb_array_length(targeting->'behaviors') > 0 THEN 'behaviors'
                ELSE 'none'
            END as targeting_type,
            COUNT(*) as count,
            AVG(CASE WHEN vues > 0 THEN (clics::float / vues::float) * 100.0 ELSE 0.0 END) as avg_conversion,
            AVG(CASE WHEN impressions > 0 THEN (vues::float / impressions::float) * 100.0 ELSE 0.0 END) as avg_ctr
        FROM publicites
        WHERE user_id = $1
        AND created_at >= NOW() - ($2 || ' days')::interval
        GROUP BY targeting_type
        ORDER BY count DESC
        "#,
    )
    .bind(user_id)
    .bind(period_days)
    .fetch_all(pool)
    .await
    .map_err(|e| {
        log::error!("Erreur targeting performance: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let mut performance_by_targeting = Vec::new();
    for row in targeting_rows {
        performance_by_targeting.push(TargetingPerformance {
            targeting_type: row
                .get::<Option<String>, _>("targeting_type")
                .unwrap_or_default(),
            count: row.get::<Option<i32>, _>("count").unwrap_or(0) as i64,
            avg_conversion: row.get::<Option<f64>, _>("avg_conversion").unwrap_or(0.0),
            avg_ctr: row.get::<Option<f64>, _>("avg_ctr").unwrap_or(0.0),
        });
    }

    Ok(Json(AdvancedAnalyticsResponse {
        time_series,
        campaign_comparison,
        conversion_funnel,
        performance_by_placement,
        performance_by_targeting,
    }))
}

/// Endpoint pour suggestions d'optimisation automatiques
#[derive(Debug, Serialize)]
pub struct OptimizationResponse {
    pub reports: Vec<crate::services::publicite_optimization_service::OptimizationReport>,
}

pub async fn get_optimization_suggestions(
    State(state): State<Arc<AppState>>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> Result<Json<OptimizationResponse>, StatusCode> {
    let pool = &state.pg;
    let user_id: i32 = params
        .get("user_id")
        .and_then(|s| s.parse().ok())
        .unwrap_or(0);

    log::info!("🔧 [Optimisation] Suggestions pour user {}", user_id);

    let reports =
        crate::services::publicite_optimization_service::generate_user_optimization_report(
            pool, user_id,
        )
        .await
        .map_err(|e| {
            log::error!("Erreur optimisation: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(OptimizationResponse { reports }))
}

/// Endpoint pour analyser une campagne spécifique
pub async fn analyze_campaign(
    State(state): State<Arc<AppState>>,
    Path(campaign_id): Path<i32>,
) -> Result<Json<crate::services::publicite_optimization_service::OptimizationReport>, StatusCode> {
    let pool = &state.pg;

    log::info!("🔧 [Optimisation] Analyse campagne {}", campaign_id);

    let report =
        crate::services::publicite_optimization_service::analyze_and_suggest(pool, campaign_id)
            .await
            .map_err(|e| {
                log::error!("Erreur analyse campagne: {:?}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;

    Ok(Json(report))
}

/// Endpoint pour récupérer les alertes de publicités
#[derive(Debug, Serialize)]
pub struct PubliciteAlertsResponse {
    pub alerts: Vec<PubliciteAlertResponse>,
}

#[derive(Debug, Serialize)]
pub struct PubliciteAlertResponse {
    pub id: i64,
    pub campaign_id: i32,
    pub campaign_title: String,
    pub alert_type: String,
    pub message: String,
    pub severity: String,
    pub created_at: String,
    pub read: bool,
}

pub async fn get_publicite_alerts(
    State(state): State<Arc<AppState>>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> Result<Json<PubliciteAlertsResponse>, StatusCode> {
    let pool = &state.pg;
    let user_id: i32 = params
        .get("user_id")
        .and_then(|s| s.parse().ok())
        .unwrap_or(0);

    log::info!("🔔 [Alertes] Pour user {}", user_id);

    // Récupérer les notifications d'alertes publicités
    let alert_rows = sqlx::query(
        r#"
        SELECT 
            n.id, n.message, n.data, n.read, n.created_at,
            p.id as campaign_id, p.titre as campaign_title
        FROM notifications n
        LEFT JOIN publicites p ON (n.data->>'campaign_id')::integer = p.id
        WHERE n.user_id = $1
        AND n.type = 'publicite_alert'
        ORDER BY n.created_at DESC
        LIMIT 50
        "#,
    )
    .bind(user_id)
    .fetch_all(pool)
    .await
    .map_err(|e| {
        log::error!("Erreur récupération alertes: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let mut alerts = Vec::new();
    for row in alert_rows {
        let data: serde_json::Value = row
            .get::<Option<serde_json::Value>, _>("data")
            .unwrap_or_else(|| json!({}));
        let alert_type = data
            .get("alert_type")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown")
            .to_string();
        let severity = data
            .get("severity")
            .and_then(|v| v.as_str())
            .unwrap_or("info")
            .to_string();

        alerts.push(PubliciteAlertResponse {
            id: row.get::<i32, _>("id") as i64,
            campaign_id: row.get::<Option<i32>, _>("campaign_id").unwrap_or(0),
            campaign_title: row
                .get::<Option<String>, _>("campaign_title")
                .unwrap_or_default(),
            alert_type,
            message: row.get::<String, _>("message"),
            severity,
            created_at: row
                .get::<Option<chrono::DateTime<chrono::Utc>>, _>("created_at")
                .unwrap_or_default()
                .to_rfc3339(),
            read: row.get::<Option<bool>, _>("read").unwrap_or(false),
        });
    }

    Ok(Json(PubliciteAlertsResponse { alerts }))
}

/// Endpoint pour déclencher manuellement la vérification des alertes
pub async fn trigger_alert_check(
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let pool = &state.pg;

    log::info!("🔔 [Alertes] Vérification manuelle déclenchée");

    let alerts = crate::services::publicite_notification_service::check_and_generate_alerts(pool)
        .await
        .map_err(|e| {
            log::error!("Erreur vérification alertes: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let sent =
        crate::services::publicite_notification_service::send_alerts_to_users(pool, alerts.clone())
            .await
            .map_err(|e| {
                log::error!("Erreur envoi alertes: {:?}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;

    Ok(Json(json!({
        "checked": true,
        "alerts_generated": alerts.len(),
        "notifications_sent": sent
    })))
}

/// Export d'une campagne en JSON
pub async fn export_campaign(
    State(state): State<Arc<AppState>>,
    Path(campaign_id): Path<i32>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let pool = &state.pg;

    log::info!("📤 [Export] Campagne {}", campaign_id);

    let row = sqlx::query(
        r#"
        SELECT 
            id, user_id, titre, description, produits_indexes, videos, thumbnails,
            videos_meta, video_stats, duree_jours, cout, devise_utilisateur,
            zone_geographique, geo_publicitaire, rayon_km, status,
            targeting, ab_testing, schedule, placements, bid_strategy, retargeting,
            date_debut, date_fin, created_at
        FROM publicites
        WHERE id = $1
        "#,
    )
    .bind(campaign_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| {
        log::error!("Erreur export: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    if let Some(row) = row {
        let export_data = json!({
            "version": "1.0",
            "exported_at": chrono::Utc::now().to_rfc3339(),
            "campaign": {
                "titre": row.get::<String, _>("titre"),
                "description": row.get::<Option<String>, _>("description"),
                "produits_indexes": row.get::<Option<Vec<String>>, _>("produits_indexes").unwrap_or_default(),
                "duree_jours": row.get::<Option<i32>, _>("duree_jours").unwrap_or(0),
                "cout": row.get::<Option<i32>, _>("cout").unwrap_or(0),
                "devise_utilisateur": row.get::<Option<String>, _>("devise_utilisateur"),
                "zone_geographique": row.get::<String, _>("zone_geographique"),
                "rayon_km": row.get::<Option<i32>, _>("rayon_km"),
                "targeting": row.get::<Option<serde_json::Value>, _>("targeting"),
                "ab_testing": row.get::<Option<serde_json::Value>, _>("ab_testing"),
                "schedule": row.get::<Option<serde_json::Value>, _>("schedule"),
                "placements": row.get::<Option<serde_json::Value>, _>("placements"),
                "bid_strategy": row.get::<Option<serde_json::Value>, _>("bid_strategy"),
                "retargeting": row.get::<Option<serde_json::Value>, _>("retargeting"),
            }
        });

        Ok(Json(export_data))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

/// Export Excel de toutes les campagnes d'un utilisateur
pub async fn export_excel_campaigns(
    State(state): State<Arc<AppState>>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> Result<axum::response::Response, StatusCode> {
    let pool = &state.pg;
    let user_id: i32 = params
        .get("user_id")
        .and_then(|s| s.parse().ok())
        .unwrap_or(0);

    let period_days: i32 = params
        .get("period_days")
        .and_then(|s| s.parse().ok())
        .unwrap_or(30);

    log::info!(
        "📤 [Export Excel] Campagnes pour user {} ({} jours)",
        user_id,
        period_days
    );

    use crate::services::publicite_reporting_service::PubliciteReportingService;

    match PubliciteReportingService::generate_excel_report(pool, user_id, period_days).await {
        Ok(excel_data) => Ok(axum::response::Response::builder()
            .status(StatusCode::OK)
            .header(
                "Content-Type",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
            .header(
                "Content-Disposition",
                format!(
                    "attachment; filename=\"publicites_{}_{}.xlsx\"",
                    user_id,
                    chrono::Utc::now().format("%Y%m%d")
                ),
            )
            .body(axum::body::Body::from(excel_data))
            .unwrap()),
        Err(e) => {
            log::error!("Erreur export Excel: {:?}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// Export de toutes les campagnes d'un utilisateur en JSON
pub async fn export_all_campaigns(
    State(state): State<Arc<AppState>>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let pool = &state.pg;
    let user_id: i32 = params
        .get("user_id")
        .and_then(|s| s.parse().ok())
        .unwrap_or(0);

    log::info!("📤 [Export] Toutes les campagnes pour user {}", user_id);

    let rows = sqlx::query(
        r#"
        SELECT 
            id, titre, description, produits_indexes, duree_jours, cout,
            devise_utilisateur, zone_geographique, rayon_km,
            targeting, ab_testing, schedule, placements, bid_strategy, retargeting
        FROM publicites
        WHERE user_id = $1
        ORDER BY created_at DESC
        "#,
    )
    .bind(user_id)
    .fetch_all(pool)
    .await
    .map_err(|e| {
        log::error!("Erreur export: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let mut campaigns = Vec::new();
    for row in rows {
        campaigns.push(json!({
            "titre": row.get::<String, _>("titre"),
            "description": row.get::<Option<String>, _>("description"),
            "produits_indexes": row.get::<Option<Vec<String>>, _>("produits_indexes").unwrap_or_default(),
            "duree_jours": row.get::<Option<i32>, _>("duree_jours").unwrap_or(0),
            "cout": row.get::<Option<i32>, _>("cout").unwrap_or(0),
            "devise_utilisateur": row.get::<Option<String>, _>("devise_utilisateur"),
            "zone_geographique": row.get::<String, _>("zone_geographique"),
            "rayon_km": row.get::<Option<i32>, _>("rayon_km"),
            "targeting": row.get::<Option<serde_json::Value>, _>("targeting"),
            "ab_testing": row.get::<Option<serde_json::Value>, _>("ab_testing"),
            "schedule": row.get::<Option<serde_json::Value>, _>("schedule"),
            "placements": row.get::<Option<serde_json::Value>, _>("placements"),
            "bid_strategy": row.get::<Option<serde_json::Value>, _>("bid_strategy"),
            "retargeting": row.get::<Option<serde_json::Value>, _>("retargeting"),
        }));
    }

    Ok(Json(json!({
        "version": "1.0",
        "exported_at": chrono::Utc::now().to_rfc3339(),
        "user_id": user_id,
        "campaigns": campaigns
    })))
}

/// Import d'une campagne depuis JSON
#[derive(Debug, Deserialize)]
pub struct ImportCampaignRequest {
    pub campaign: serde_json::Value,
}

pub async fn import_campaign(
    State(state): State<Arc<AppState>>,
    Query(params): Query<std::collections::HashMap<String, String>>,
    Json(payload): Json<ImportCampaignRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let pool = &state.pg;
    let user_id: i32 = params
        .get("user_id")
        .and_then(|s| s.parse().ok())
        .unwrap_or(0);

    log::info!("📥 [Import] Campagne pour user {}", user_id);

    let campaign = &payload.campaign;

    // Extraire les données
    let titre = campaign
        .get("titre")
        .and_then(|v| v.as_str())
        .ok_or_else(|| {
            log::error!("Titre manquant dans l'import");
            StatusCode::BAD_REQUEST
        })?;

    let description = campaign.get("description").and_then(|v| v.as_str());
    let produits_indexes: Vec<String> = campaign
        .get("produits_indexes")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect()
        })
        .unwrap_or_default();

    if produits_indexes.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    let duree_jours = campaign
        .get("duree_jours")
        .and_then(|v| v.as_i64())
        .unwrap_or(30) as i32;

    let cout = campaign.get("cout").and_then(|v| v.as_i64()).unwrap_or(0) as i32;

    let zone_geographique = campaign
        .get("zone_geographique")
        .and_then(|v| v.as_str())
        .unwrap_or("local")
        .to_string();

    // Extraire les données JSONB
    let targeting = campaign.get("targeting").cloned().unwrap_or(json!({}));
    let ab_testing = campaign.get("ab_testing").cloned().unwrap_or(json!({}));
    let schedule = campaign.get("schedule").cloned();
    let placements = campaign.get("placements").cloned().unwrap_or(json!([]));
    let bid_strategy = campaign.get("bid_strategy").cloned().unwrap_or(json!({}));
    let retargeting = campaign.get("retargeting").cloned().unwrap_or(json!({}));

    // Créer la publicité
    let result = sqlx::query(
        r#"
        INSERT INTO publicites (
            user_id, titre, description, produits_indexes, videos, thumbnails,
            duree_jours, cout, zone_geographique,
            targeting, ab_testing, schedule, placements, bid_strategy, retargeting,
            date_debut, date_fin
        )
        VALUES ($1, $2, $3, $4, '{}', '{}', $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW() + ($5 || ' days')::interval)
        RETURNING id, date_debut, date_fin
        "#,
    )
    .bind(user_id)
    .bind(titre)
    .bind(description)
    .bind(&produits_indexes)
    .bind(duree_jours)
    .bind(cout)
    .bind(&zone_geographique)
    .bind(&targeting)
    .bind(&ab_testing)
    .bind(&schedule)
    .bind(&placements)
    .bind(&bid_strategy)
    .bind(&retargeting)
    .fetch_one(pool)
    .await
    .map_err(|e| {
        log::error!("Erreur import: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let campaign_id: i32 = result.get::<i32, _>("id");

    Ok(Json(json!({
        "success": true,
        "campaign_id": campaign_id,
        "message": "Campagne importée avec succès"
    })))
}

/// Récupère l'historique des versions d'une publicité
#[derive(Debug, Serialize)]
pub struct PubliciteVersionsResponse {
    pub versions: Vec<PubliciteVersionResponse>,
}

#[derive(Debug, Serialize)]
pub struct PubliciteVersionResponse {
    pub id: i64,
    pub version_number: i32,
    pub change_type: String,
    pub change_description: Option<String>,
    pub created_at: String,
    pub changed_by: Option<i32>,
}

pub async fn get_publicite_versions(
    State(state): State<Arc<AppState>>,
    Path(campaign_id): Path<i32>,
) -> Result<Json<PubliciteVersionsResponse>, StatusCode> {
    let pool = &state.pg;

    log::info!("📜 [Versioning] Historique pour campagne {}", campaign_id);

    let versions =
        crate::services::publicite_versioning_service::get_publicite_versions(pool, campaign_id)
            .await
            .map_err(|e| {
                log::error!("Erreur récupération versions: {:?}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;

    let version_responses: Vec<PubliciteVersionResponse> = versions
        .into_iter()
        .map(|v| PubliciteVersionResponse {
            id: v.id,
            version_number: v.version_number,
            change_type: v.change_type,
            change_description: v.change_description,
            created_at: v.created_at.to_rfc3339(),
            changed_by: v.changed_by,
        })
        .collect();

    Ok(Json(PubliciteVersionsResponse {
        versions: version_responses,
    }))
}

/// Récupère une version spécifique
pub async fn get_publicite_version(
    State(state): State<Arc<AppState>>,
    Path((campaign_id, version_number)): Path<(i32, i32)>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let pool = &state.pg;

    log::info!(
        "📜 [Versioning] Version {} pour campagne {}",
        version_number,
        campaign_id
    );

    let version = crate::services::publicite_versioning_service::get_publicite_version(
        pool,
        campaign_id,
        version_number,
    )
    .await
    .map_err(|e| {
        log::error!("Erreur récupération version: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    if let Some(v) = version {
        Ok(Json(serde_json::json!({
            "version_number": v.version_number,
            "change_type": v.change_type,
            "change_description": v.change_description,
            "created_at": v.created_at.to_rfc3339(),
            "data": v.data_snapshot
        })))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

/// Restaure une version
pub async fn restore_publicite_version(
    State(state): State<Arc<AppState>>,
    Path((campaign_id, version_number)): Path<(i32, i32)>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let pool = &state.pg;

    log::info!(
        "🔄 [Versioning] Restauration version {} pour campagne {}",
        version_number,
        campaign_id
    );

    let success = crate::services::publicite_versioning_service::restore_publicite_version(
        pool,
        campaign_id,
        version_number,
    )
    .await
    .map_err(|e| {
        log::error!("Erreur restauration version: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    if success {
        Ok(Json(json!({
            "success": true,
            "message": format!("Version {} restaurée avec succès", version_number)
        })))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

/// Compare deux versions
pub async fn compare_publicite_versions(
    State(state): State<Arc<AppState>>,
    Path((campaign_id, version1, version2)): Path<(i32, i32, i32)>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let pool = &state.pg;

    log::info!(
        "🔍 [Versioning] Comparaison versions {} et {} pour campagne {}",
        version1,
        version2,
        campaign_id
    );

    let differences = crate::services::publicite_versioning_service::compare_versions(
        pool,
        campaign_id,
        version1,
        version2,
    )
    .await
    .map_err(|e| {
        log::error!("Erreur comparaison versions: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(differences))
}

// Autres fonctions simplifiées...

struct PubliciteItem {
    json: serde_json::Value,
    produits_indexes: Vec<String>,
}

fn extract_service_id(index: &str) -> Option<i32> {
    index
        .split('_')
        .next()
        .and_then(|id_part| id_part.parse::<i32>().ok())
}

async fn fetch_service_categories(
    pool: &PgPool,
    service_ids: &HashSet<i32>,
) -> Result<HashMap<i32, Option<String>>, sqlx::Error> {
    if service_ids.is_empty() {
        return Ok(HashMap::new());
    }

    let ids: Vec<i32> = service_ids.iter().copied().collect();
    let rows = sqlx::query(
        r#"
        SELECT id, category
        FROM services
        WHERE id = ANY($1)
        "#,
    )
    .bind(ids)
    .fetch_all(pool)
    .await?;

    let mut map = HashMap::new();
    for row in rows {
        let id: i32 = row.get::<i32, _>("id");
        let category: Option<String> = row.get::<Option<String>, _>("category");
        map.insert(id, category);
    }

    Ok(map)
}
pub async fn get_publicite_by_id(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i32>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let pool = &state.pg;
    log::info!("🔍 [Publicité] Récupération publicité ID {}", id);

    let row = sqlx::query("SELECT * FROM publicites WHERE id = $1")
        .bind(id)
        .fetch_optional(pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    match row {
        Some(r) => Ok(Json(serde_json::json!({
            "id": r.get::<i32, _>("id"),
            "titre": r.get::<String, _>("titre"),
        }))),
        None => Err(StatusCode::NOT_FOUND),
    }
}

pub async fn update_publicite(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i32>,
    Json(payload): Json<CreatePubliciteRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let pool = &state.pg;
    log::info!("✏️ [Publicité] Mise à jour publicité ID {}", id);

    sqlx::query(
        r#"
        UPDATE publicites
        SET titre = $2, description = $3
        WHERE id = $1
        "#,
    )
    .bind(id)
    .bind(&payload.titre)
    .bind(&payload.description)
    .execute(pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(serde_json::json!({
            "success": true,
        "message": "Publicité mise à jour"
    })))
}

fn bump_counter(stats: &mut Value, category: &str, key: &str) {
    if !stats.is_object() {
        *stats = json!({});
    }
    if let Some(map) = stats.as_object_mut() {
        let entry = map.entry(category.to_string()).or_insert_with(|| json!({}));
        if !entry.is_object() {
            *entry = json!({});
        }
        if let Some(obj) = entry.as_object_mut() {
            let counter = obj.entry(key.to_string()).or_insert(json!(0));
            let current = counter.as_i64().unwrap_or(0) + 1;
            *counter = json!(current);
        }
    }
}

async fn record_video_event(
    pool: &PgPool,
    publicite_id: i32,
    category: &str,
    format: Option<String>,
    source: Option<String>,
) -> Result<(), StatusCode> {
    let existing: Option<Value> =
        sqlx::query_scalar("SELECT video_stats FROM publicites WHERE id = $1")
            .bind(publicite_id)
            .fetch_optional(pool)
            .await
            .map_err(|e| {
                log::error!("Erreur récupération vidéo stats: {:?}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;

    let mut stats_value = existing.unwrap_or_else(|| json!({}));

    if let Some(format_key) = format {
        let fmt = format_key.trim().to_lowercase();
        if !fmt.is_empty() {
            bump_counter(&mut stats_value, category, &fmt);
        }
    }

    if let Some(source_key) = source {
        let src = source_key.trim().to_lowercase();
        if !src.is_empty() {
            let category_by_source = format!("{}_by_source", category);
            bump_counter(&mut stats_value, &category_by_source, &src);
        }
    }

    sqlx::query("UPDATE publicites SET video_stats = $1, updated_at = NOW() WHERE id = $2")
        .bind(stats_value)
        .bind(publicite_id)
        .execute(pool)
        .await
        .map_err(|e| {
            log::error!("Erreur mise à jour video_stats: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(())
}

pub async fn track_publicite_click(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<TrackClickRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let pool = &state.pg;
    log::info!(
        "👆 [Publicité] Tracking clic publicité ID {}",
        payload.publicite_id
    );

    sqlx::query("UPDATE publicites SET clics = clics + 1 WHERE id = $1")
        .bind(payload.publicite_id)
        .execute(pool)
        .await
        .map_err(|e| {
            log::error!("Erreur tracking clic: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let format = payload
        .video_format
        .as_ref()
        .map(|f| f.trim().to_lowercase())
        .filter(|f| !f.is_empty());
    let source = payload
        .video_source
        .as_ref()
        .map(|s| s.trim().to_lowercase())
        .filter(|s| !s.is_empty());

    record_video_event(pool, payload.publicite_id, "clicks", format, source).await?;

    Ok(Json(serde_json::json!({ "success": true })))
}

pub async fn track_publicite_view(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<TrackClickRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let pool = &state.pg;
    log::info!(
        "👁️ [Publicité] Tracking vue publicité ID {}",
        payload.publicite_id
    );

    sqlx::query(
        "UPDATE publicites SET vues = vues + 1, impressions = impressions + 1 WHERE id = $1",
    )
    .bind(payload.publicite_id)
    .execute(pool)
    .await
    .map_err(|e| {
        log::error!("Erreur tracking vue: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let format = payload
        .video_format
        .as_ref()
        .map(|f| f.trim().to_lowercase())
        .filter(|f| !f.is_empty());
    let source = payload
        .video_source
        .as_ref()
        .map(|s| s.trim().to_lowercase())
        .filter(|s| !s.is_empty());

    record_video_event(pool, payload.publicite_id, "views", format, source).await?;

    Ok(Json(serde_json::json!({ "success": true })))
}
