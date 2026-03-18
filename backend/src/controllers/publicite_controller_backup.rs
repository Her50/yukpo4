use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
};
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, FromRow};
use std::sync::Arc;
use log;
use chrono;

#[derive(Debug, Deserialize)]
pub struct CreatePubliciteRequest {
    pub user_id: i32,
    pub titre: String,
    pub description: Option<String>,
    pub produits_indexes: Vec<String>,
    pub videos: Vec<String>, // Base64
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
    State(pool): State<Arc<PgPool>>,
    Json(payload): Json<CreatePubliciteRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    log::info!("🎯 [Publicité] Création publicité pour user {}", payload.user_id);

    // Valider les données
    if payload.produits_indexes.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    if payload.titre.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    // Parser geo_publicitaire si fourni (format PostGIS WKT)
    let geo_point = payload.geo_publicitaire.as_ref().and_then(|coords| {
        let parts: Vec<&str> = coords.split(',').collect();
        if parts.len() == 2 {
            if let (Ok(lat), Ok(lng)) = (parts[0].parse::<f64>(), parts[1].parse::<f64>()) {
                // PostGIS format: ST_SetSRID(ST_MakePoint(lng, lat), 4326)
                return Some(format!("ST_SetSRID(ST_MakePoint({}, {}), 4326)", lng, lat));
            }
        }
        None
    });

    // Rayon par défaut selon zone
    let rayon = payload.rayon_km.unwrap_or_else(|| {
        match payload.zone_geographique.as_str() {
            "local" => 50,
            "regional" => 500,
            _ => 0,
        }
    });

    // Vérifier le solde de l'utilisateur
    let user_balance: Option<i32> = sqlx::query_scalar(
        "SELECT tokens_balance FROM users WHERE id = $1"
    )
    .bind(payload.user_id)
    .fetch_optional(pool.as_ref())
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
    sqlx::query(
        "UPDATE users SET tokens_balance = tokens_balance - $1 WHERE id = $2",
    )
    .bind(payload.cout as i64)
    .bind(payload.user_id)
    .execute(pool.as_ref())
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
        .fetch_one(pool.as_ref())
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
            "#,
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
        .fetch_one(pool.as_ref())
        .await
    };

    match result {
        Ok(record) => {
            use sqlx::Row;
            let pub_id: i32 = record.get::<Option<_>, _>("id").unwrap_or(0);
            
            log::info!("✅ Publicité créée: ID {}", pub_id);
            
            Ok(Json(serde_json::json!({
                "success": true,
                "data": {
                    "id": pub_id,
                    "message": "Publicité créée avec succès"
                },
                "message": "Publicité créée avec succès"
            })))
        }
        Err(e) => {
            log::error!("Erreur création publicité: {:?}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// Récupérer les publicités actives
pub async fn get_active_publicites(
    State(pool): State<Arc<PgPool>>,
    Query(params): Query<GetPublicitesQuery>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    log::info!("📋 [Publicité] Récupération publicités actives");

    let query = sqlx::query(
        r#"
        SELECT 
            id, user_id, titre, description, produits_indexes, videos, thumbnails,
            zone_geographique, vues, clics, date_debut, date_fin, created_at
        FROM publicites
        WHERE status = 'active'
        AND date_fin > NOW()
        ORDER BY created_at DESC
        LIMIT 50
        "#,
    )
    .fetch_all(pool.as_ref())
    .await
    .map_err(|e| {
        log::error!("Erreur récupération publicités: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // Enrichir avec les données des produits
    let mut publicites = Vec::new();
    for record in &query {
        use sqlx::Row;
        let rec_id: i32 = record.try_get("id").unwrap_or(0);
        let rec_titre: Option<String> = record.try_get("titre").unwrap_or(None);
        let rec_description: Option<String> = record.try_get("description").unwrap_or(None);
        let rec_produits_indexes: Vec<String> = record.try_get("produits_indexes").unwrap_or_default();
        let rec_videos: Vec<String> = record.try_get("videos").unwrap_or_default();
        let rec_thumbnails: Vec<String> = record.try_get("thumbnails").unwrap_or_default();
        let rec_zone: Option<String> = record.try_get("zone_geographique").unwrap_or(None);
        let rec_vues: Option<i32> = record.try_get("vues").unwrap_or(None);
        let rec_clics: Option<i32> = record.try_get("clics").unwrap_or(None);
        let rec_date_debut: Option<chrono::DateTime<chrono::Utc>> = record.try_get("date_debut").unwrap_or(None);
        let rec_date_fin: Option<chrono::DateTime<chrono::Utc>> = record.try_get("date_fin").unwrap_or(None);

        // Récupérer les produits indexés
        let mut produits = Vec::new();
        for product_key in &rec_produits_indexes {
            let parts: Vec<&str> = product_key.split('_').collect();
            if parts.len() == 2 {
                if let (Ok(service_id), Ok(product_index)) = (parts[0].parse::<i32>(), parts[1].parse::<usize>()) {
                    // Récupérer le produit depuis le service
                    if let Ok(Some(service_row)) = sqlx::query(
                        "SELECT data FROM services WHERE id = $1",
                    )
                    .bind(service_id)
                    .fetch_optional(pool.as_ref())
                    .await
                    {
                        let data: Option<serde_json::Value> = service_row.try_get("data").unwrap_or(None);
                        if let Some(data) = data {
                            if let Some(products_array) = data.get("produits").and_then(|p| p.as_array()) {
                                if let Some(product) = products_array.get(product_index) {
                                    let mut product_data = product.clone();
                                    if let Some(obj) = product_data.as_object_mut() {
                                        obj.insert("serviceId".to_string(), serde_json::json!(service_id));
                                    }
                                    produits.push(product_data);
                                }
                            }
                        }
                    }
                }
            }
        }

        publicites.push(serde_json::json!({
            "id": rec_id,
            "titre": rec_titre,
            "description": rec_description,
            "produits": produits,
            "videos": rec_videos,
            "thumbnails": rec_thumbnails,
            "zone_geographique": rec_zone,
            "vues": rec_vues,
            "clics": rec_clics,
            "date_debut": rec_date_debut,
            "date_fin": rec_date_fin
        }));
    }

    Ok(Json(serde_json::json!({
        "success": true,
        "data": publicites
    })))
}

/// Dashboard avec statistiques
pub async fn get_publicite_dashboard(
    State(pool): State<Arc<PgPool>>,
    axum::extract::Extension(user_id): axum::extract::Extension<i32>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    log::info!("📊 [Publicité] Dashboard pour user {}", user_id);

    use sqlx::Row;
    // Stats globales
    let stats = sqlx::query(
        r#"
        SELECT 
            COALESCE(SUM(vues), 0) as total_vues,
            COALESCE(SUM(clics), 0) as total_clics,
            COALESCE(SUM(cout), 0) as budget_total_depense,
            COUNT(*) FILTER (WHERE status = 'active' AND date_fin > NOW()) as publicites_actives
        FROM publicites
        WHERE user_id = $1
        "#,
    )
    .bind(user_id)
    .fetch_one(&**pool)
    .await
    .map_err(|e| {
        log::error!("Erreur stats publicité: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let total_vues: i64 = stats.try_get::<Option<i64>, _>("total_vues").unwrap_or(None).unwrap_or(0);
    let total_clics: i64 = stats.try_get::<Option<i64>, _>("total_clics").unwrap_or(None).unwrap_or(0);
    let budget_total_depense: i64 = stats.try_get::<Option<i64>, _>("budget_total_depense").unwrap_or(None).unwrap_or(0);
    let publicites_actives: i64 = stats.try_get::<Option<i64>, _>("publicites_actives").unwrap_or(None).unwrap_or(0);
    let taux_conversion = if total_vues > 0 {
        (total_clics as f64 / total_vues as f64) * 100.0
    } else {
        0.0
    };

    // Liste des publicités de l'utilisateur
    let publicites = sqlx::query(
        r#"
        SELECT 
            id, titre, status, vues, clics, cout as budget_depense,
            zone_geographique, produits_indexes, date_debut, date_fin,
            EXTRACT(DAY FROM (date_fin - NOW()))::bigint as jours_restants
        FROM publicites
        WHERE user_id = $1
        ORDER BY created_at DESC
        "#,
    )
    .bind(user_id)
    .fetch_all(pool.as_ref())
    .await
    .map_err(|e| {
        log::error!("Erreur liste publicités: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let publicites_details: Vec<serde_json::Value> = publicites
        .iter()
        .map(|r| {
            let vues: i32 = r.try_get("vues").unwrap_or(0);
            let clics: i32 = r.try_get("clics").unwrap_or(0);
            let conversion_rate = if vues > 0 { (clics as f64 / vues as f64) * 100.0 } else { 0.0 };
            let pi: Vec<String> = r.try_get("produits_indexes").unwrap_or_default();
            serde_json::json!({
                "id": r.try_get::<i32, _>("id").unwrap_or(0),
                "titre": r.try_get::<Option<String>, _>("titre").unwrap_or(None),
                "status": r.try_get::<Option<String>, _>("status").unwrap_or(None),
                "vues": vues,
                "clics": clics,
                "conversion_rate": conversion_rate,
                "budget_depense": r.try_get::<Option<f64>, _>("budget_depense").unwrap_or(None),
                "jours_restants": r.try_get::<Option<i64>, _>("jours_restants").unwrap_or(None).unwrap_or(0),
                "zone_geographique": r.try_get::<Option<String>, _>("zone_geographique").unwrap_or(None),
                "produits_count": pi.len(),
                "date_debut": r.try_get::<Option<chrono::DateTime<chrono::Utc>>, _>("date_debut").unwrap_or(None),
                "date_fin": r.try_get::<Option<chrono::DateTime<chrono::Utc>>, _>("date_fin").unwrap_or(None)
            })
        })
        .collect();

    Ok(Json(serde_json::json!({
        "success": true,
        "data": {
            "stats": {
                "total_vues": total_vues,
                "total_clics": total_clics,
                "taux_conversion_moyen": taux_conversion,
                "budget_total_depense": budget_total_depense,
                "publicites_actives": publicites_actives
            },
            "publicites": publicites_details
        }
    })))
}

/// Récupérer une publicité par ID
pub async fn get_publicite_by_id(
    State(pool): State<Arc<PgPool>>,
    Path(id): Path<i32>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    log::info!("🔍 [Publicité] Récupération publicité ID {}", id);

    let publicite = sqlx::query(
        r#"
        SELECT 
            id, user_id, titre, description, produits_indexes, videos, thumbnails,
            duree_jours, cout, zone_geographique, rayon_km, status, vues, clics,
            date_debut, date_fin, created_at
        FROM publicites
        WHERE id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(pool.as_ref())
    .await
    .map_err(|e| {
        log::error!("Erreur récupération publicité: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    match publicite {
        Some(r) => {
            use sqlx::Row;
            Ok(Json(serde_json::json!({
                "success": true,
                "data": {
                    "id": r.try_get::<i32, _>("id").unwrap_or(0),
                    "user_id": r.try_get::<Option<i32>, _>("user_id").unwrap_or(None),
                    "titre": r.try_get::<Option<String>, _>("titre").unwrap_or(None),
                    "description": r.try_get::<Option<String>, _>("description").unwrap_or(None),
                    "produits_indexes": r.try_get::<Vec<String>, _>("produits_indexes").unwrap_or_default(),
                    "videos": r.try_get::<Vec<String>, _>("videos").unwrap_or_default(),
                    "thumbnails": r.try_get::<Vec<String>, _>("thumbnails").unwrap_or_default(),
                    "duree_jours": r.try_get::<Option<i32>, _>("duree_jours").unwrap_or(None),
                    "cout": r.try_get::<Option<f64>, _>("cout").unwrap_or(None),
                    "zone_geographique": r.try_get::<Option<String>, _>("zone_geographique").unwrap_or(None),
                    "status": r.try_get::<Option<String>, _>("status").unwrap_or(None),
                    "vues": r.try_get::<Option<i32>, _>("vues").unwrap_or(None),
                    "clics": r.try_get::<Option<i32>, _>("clics").unwrap_or(None),
                    "date_debut": r.try_get::<Option<chrono::DateTime<chrono::Utc>>, _>("date_debut").unwrap_or(None),
                    "date_fin": r.try_get::<Option<chrono::DateTime<chrono::Utc>>, _>("date_fin").unwrap_or(None)
                }
            })))
        },
        None => Err(StatusCode::NOT_FOUND),
    }
}

/// Mettre à jour une publicité
pub async fn update_publicite(
    State(pool): State<Arc<PgPool>>,
    Path(id): Path<i32>,
    Json(payload): Json<CreatePubliciteRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    log::info!("✏️ [Publicité] Mise à jour publicité ID {}", id);

    // Vérifier que la publicité appartient à l'utilisateur
    let owner_check: Option<i32> = sqlx::query_scalar(
        "SELECT user_id FROM publicites WHERE id = $1"
    )
    .bind(id)
    .fetch_optional(pool.as_ref())
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if owner_check.is_none() || owner_check.unwrap() != payload.user_id {
        return Err(StatusCode::FORBIDDEN);
    }

    // Parser geo_publicitaire si fourni (format PostGIS WKT)
    let geo_point = payload.geo_publicitaire.as_ref().and_then(|coords| {
        let parts: Vec<&str> = coords.split(',').collect();
        if parts.len() == 2 {
            if let (Ok(lat), Ok(lng)) = (parts[0].parse::<f64>(), parts[1].parse::<f64>()) {
                return Some(format!("ST_SetSRID(ST_MakePoint({}, {}), 4326)", lng, lat));
            }
        }
        None
    });

    let result = if let Some(geo) = geo_point {
        sqlx::query(&format!(
            r#"
            UPDATE publicites
            SET titre = $1, description = $2, produits_indexes = $3,
                videos = $4, thumbnails = $5, duree_jours = $6,
                zone_geographique = $7, geo_publicitaire = {},
                rayon_km = $8, date_fin = NOW() + ($6 || ' days')::interval
            WHERE id = $9
            RETURNING id
            "#,
            geo
        ))
        .bind(&payload.titre)
        .bind(&payload.description)
        .bind(&payload.produits_indexes)
        .bind(&payload.videos)
        .bind(&payload.thumbnails)
        .bind(payload.duree_jours)
        .bind(&payload.zone_geographique)
        .bind(payload.rayon_km.unwrap_or(50))
        .bind(id)
        .fetch_one(pool.as_ref())
        .await
    } else {
        sqlx::query(
            r#"
            UPDATE publicites
            SET titre = $2, description = $3, produits_indexes = $4,
                videos = $5, thumbnails = $6, duree_jours = $7,
                zone_geographique = $8, rayon_km = $9,
                date_fin = NOW() + ($7 || ' days')::interval
            WHERE id = $1
            RETURNING id
            "#,
        )
        .bind(id)
        .bind(&payload.titre)
        .bind(&payload.description)
        .bind(&payload.produits_indexes)
        .bind(&payload.videos)
        .bind(&payload.thumbnails)
        .bind(payload.duree_jours)
        .bind(&payload.zone_geographique)
        .bind(payload.rayon_km.unwrap_or(50))
        .fetch_one(pool.as_ref())
        .await
    };

    match result {
        Ok(_) => Ok(Json(serde_json::json!({
            "success": true,
            "message": "Publicité mise à jour avec succès"
        }))),
        Err(e) => {
            log::error!("Erreur mise à jour publicité: {:?}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// Tracker un clic sur une publicité
pub async fn track_publicite_click(
    State(pool): State<Arc<PgPool>>,
    Json(payload): Json<TrackClickRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    log::info!("👆 [Publicité] Tracking clic publicité ID {}", payload.publicite_id);

    sqlx::query(
        "UPDATE publicites SET clics = clics + 1 WHERE id = $1",
    )
    .bind(payload.publicite_id)
    .execute(pool.as_ref())
    .await
    .map_err(|e| {
        log::error!("Erreur tracking clic: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(serde_json::json!({
        "success": true,
        "message": "Clic enregistré"
    })))
}

/// Tracker une vue sur une publicité
pub async fn track_publicite_view(
    State(pool): State<Arc<PgPool>>,
    Json(payload): Json<TrackClickRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    log::info!("👁️ [Publicité] Tracking vue publicité ID {}", payload.publicite_id);

    sqlx::query(
        "UPDATE publicites SET vues = vues + 1, impressions = impressions + 1 WHERE id = $1",
    )
    .bind(payload.publicite_id)
    .execute(pool.as_ref())
    .await
    .map_err(|e| {
        log::error!("Erreur tracking vue: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(serde_json::json!({
        "success": true,
        "message": "Vue enregistrée"
    })))
}

