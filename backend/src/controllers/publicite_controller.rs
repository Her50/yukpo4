use crate::state::AppState;
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
};
use log;
use serde::{Deserialize, Serialize};
use sqlx::Row;
use std::sync::Arc;

#[derive(Debug, Deserialize)]
pub struct CreatePubliciteRequest {
    pub user_id: i32,
    pub titre: String,
    pub description: Option<String>,
    pub produits_indexes: Vec<String>,
    pub videos: Vec<String>,     // Base64
    pub thumbnails: Vec<String>, // Base64
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
                user_id, titre, description, produits_indexes, videos, thumbnails,
                duree_jours, cout, zone_geographique, geo_publicitaire, rayon_km,
                date_debut, date_fin
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, {}, $10, NOW(), NOW() + ($7 || ' days')::interval)
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
                user_id, titre, description, produits_indexes, videos, thumbnails,
                duree_jours, cout, zone_geographique, rayon_km,
                date_debut, date_fin
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW() + ($7 || ' days')::interval)
            RETURNING id, date_debut, date_fin
            "#
        )
        .bind(payload.user_id)
        .bind(&payload.titre)
        .bind(&payload.description)
        .bind(&payload.produits_indexes)
        .bind(&payload.videos)
        .bind(&payload.thumbnails)
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

    let mut query_str = r#"
        SELECT 
            id, user_id, titre, description, produits_indexes, videos, thumbnails,
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

    let publicites: Vec<serde_json::Value> = rows
        .iter()
        .map(|row| {
            serde_json::json!({
                "id": row.get::<i32, _>("id"),
                "user_id": row.get::<i32, _>("user_id"),
                "titre": row.get::<String, _>("titre"),
                "description": row.get::<Option<String>, _>("description"),
                "produits_indexes": row.get::<Vec<String>, _>("produits_indexes"),
                "zone_geographique": row.get::<String, _>("zone_geographique"),
                "status": row.get::<String, _>("status"),
                "vues": row.get::<i32, _>("vues"),
                "clics": row.get::<i32, _>("clics"),
            })
        })
        .collect();

    Ok(Json(publicites))
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

    let stats = PubliciteDashboardStats {
        total_vues,
        total_clics,
        taux_conversion_moyen: taux_conversion,
        budget_total_depense: stats_row.try_get("budget_total").unwrap_or(0),
        publicites_actives: stats_row.try_get("actives").unwrap_or(0),
    };

    // Liste des publicités
    let pub_rows = sqlx::query(
        r#"
        SELECT 
            id, titre, status, vues, clics, cout as budget_depense,
            zone_geographique, produits_indexes, date_debut, date_fin,
            EXTRACT(DAY FROM (date_fin - NOW()))::integer as jours_restants
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

    let publicites: Vec<PubliciteWithDetails> = pub_rows
        .iter()
        .map(|row| {
            let vues: i32 = row.try_get("vues").unwrap_or(0);
            let clics: i32 = row.try_get("clics").unwrap_or(0);
            let conversion = if vues > 0 {
                (clics as f64 / vues as f64) * 100.0
            } else {
                0.0
            };

            let produits_indexes: Vec<String> = row.try_get("produits_indexes").unwrap_or_default();

            PubliciteWithDetails {
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
            }
        })
        .collect();

    Ok(Json(PubliciteDashboardResponse { stats, publicites }))
}

// Autres fonctions simplifiées...
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

    Ok(Json(serde_json::json!({ "success": true })))
}
