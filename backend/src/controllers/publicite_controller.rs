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

    // Insérer la publicité
    let result = if let Some(geo) = geo_point {
        // Avec géolocalisation PostGIS
        sqlx::query(&format!(
            r#"
            INSERT INTO publicites (
                user_id, titre, description, produits_indexes, videos, thumbnails, videos_meta, video_stats,
                duree_jours, cout, zone_geographique, geo_publicitaire, rayon_km,
                date_debut, date_fin
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, {}, $12, NOW(), NOW() + ($9 || ' days')::interval)
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
        .fetch_one(pool)
        .await
    } else {
        // Sans géolocalisation
        sqlx::query(
            r#"
            INSERT INTO publicites (
                user_id, titre, description, produits_indexes, videos, thumbnails, videos_meta, video_stats,
                duree_jours, cout, zone_geographique, rayon_km,
                date_debut, date_fin
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW() + ($9 || ' days')::interval)
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
        .fetch_one(pool)
        .await
    };

    match result {
        Ok(record) => {
            let pub_id: i32 = record.try_get("id").unwrap_or(0);

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

    let mut query_str = r#"
        SELECT 
            id, user_id, titre, description, produits_indexes, videos, thumbnails, videos_meta, video_stats,
            duree_jours, cout, zone_geographique, status, vues, clics,
            date_debut, date_fin, created_at
        FROM publicites
        WHERE status = 'active' AND date_fin > NOW()
        "#
    .to_string();

    // Filtrage par user_id désactivé pour le moment
    if let Some(_user_id) = params.user_id {
        // query_str.push_str(" AND user_id = $1");
    }

    query_str.push_str(" ORDER BY created_at DESC");

    let rows = sqlx::query(&query_str).fetch_all(pool).await.map_err(|e| {
        log::error!("Erreur récupération publicités: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

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
        let videos_meta_value: Value = row.try_get("videos_meta").unwrap_or_else(|_| json!([]));
        let video_stats_value: Value = row.try_get("video_stats").unwrap_or_else(|_| json!({}));

        for service_id in produits_indexes
            .iter()
            .filter_map(|idx| extract_service_id(idx))
        {
            produit_service_ids.insert(service_id);
        }

        let json = serde_json::json!({
            "id": id,
            "user_id": user_id,
            "titre": titre,
            "description": description,
            "produits_indexes": produits_indexes.clone(),
            "zone_geographique": zone,
            "status": status,
            "vues": vues,
            "clics": clics,
            "videos_meta": videos_meta_value,
            "video_stats": video_stats_value,
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

    let total_vues: i64 = stats_row.try_get("total_vues").unwrap_or(0);
    let total_clics: i64 = stats_row.try_get("total_clics").unwrap_or(0);
    let taux_conversion = if total_vues > 0 {
        (total_clics as f64 / total_vues as f64) * 100.0
    } else {
        0.0
    };

    let mut stats = PubliciteDashboardStats {
        total_vues,
        total_clics,
        taux_conversion_moyen: taux_conversion,
        budget_total_depense: stats_row.try_get("budget_total").unwrap_or(0),
        publicites_actives: stats_row.try_get("actives").unwrap_or(0),
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
        let vues: i32 = row.try_get("vues").unwrap_or(0);
        let clics: i32 = row.try_get("clics").unwrap_or(0);
        let conversion = if vues > 0 {
            (clics as f64 / vues as f64) * 100.0
        } else {
            0.0
        };

        let produits_indexes: Vec<String> = row.try_get("produits_indexes").unwrap_or_default();
        let video_stats_value: Value = row.try_get("video_stats").unwrap_or_else(|_| json!({}));
        let videos_meta_value: Value = row.try_get("videos_meta").unwrap_or_else(|_| json!([]));
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
            id: row.try_get("id").unwrap_or(0),
            titre: row.try_get("titre").unwrap_or_default(),
            status: row.try_get("status").unwrap_or_default(),
            vues,
            clics,
            conversion_rate: conversion,
            budget_depense: row.try_get("budget_depense").unwrap_or(0),
            jours_restants: row.try_get("jours_restants").unwrap_or(0),
            zone_geographique: row.try_get("zone_geographique").unwrap_or_default(),
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
        let id: i32 = row.try_get("id")?;
        let category: Option<String> = row.try_get("category").ok();
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
            "id": r.try_get::<i32, _>("id").unwrap_or(0),
            "titre": r.try_get::<String, _>("titre").unwrap_or_default(),
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
