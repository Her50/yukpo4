//! ✅ Contrôleur pour service Assurance dédié
//!
//! Endpoints pour :
//! - Recherche dédiée de produits d'assurance
//! - Génération de devis IA
//! - Comparaison de produits IA
//! - Recommandations personnalisées IA
//! - Estimation de prime IA

use crate::core::types::{AppError, AppResult};
use crate::middlewares::jwt::AuthenticatedUser;
use crate::services::assurance_ai_service::{AssuranceAIService, InsuranceProfile};
use crate::state::AppState;
use axum::{
    extract::{Extension, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use log::{error, info};
use serde::Deserialize;
use serde_json::json;
use sqlx::Row;
use std::sync::Arc;

// ═══════════════════════════════════════════════════════════════
// 1. RECHERCHE DÉDIÉE ASSURANCE
// ═══════════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct SearchInsuranceQuery {
    pub type_assurance: Option<String>,
    pub compagnie: Option<String>,
    pub ville: Option<String>,
    pub quartier: Option<String>,
    pub gps_lat: Option<f64>,
    pub gps_lon: Option<f64>,
    pub rayon_km: Option<f64>,
    pub prix_min: Option<f64>,
    pub prix_max: Option<f64>,
    pub limit: Option<i32>,
    pub offset: Option<i32>,
}

/// GET /api/assurance/search - Recherche dédiée de produits d'assurance
pub async fn search_insurance(
    State(state): State<Arc<AppState>>,
    Query(query): Query<SearchInsuranceQuery>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[search_insurance] Recherche assurance: type={:?}, compagnie={:?}, ville={:?}",
        query.type_assurance, query.compagnie, query.ville
    );

    let limit = query.limit.unwrap_or(20).min(50);
    let offset = query.offset.unwrap_or(0);

    // Recherche dans la table services avec category = 'assurance'
    let rows = sqlx::query(
        r#"
        SELECT s.id, s.data, s.user_id, s.category, s.is_active, s.gps,
               u.nom as user_nom, u.prenom as user_prenom, u.telephone as user_telephone
        FROM services s
        LEFT JOIN users u ON u.id = s.user_id
        WHERE s.is_active = true
          AND (s.category ILIKE '%assurance%' OR s.data::text ILIKE '%assurance%')
        ORDER BY s.id DESC
        LIMIT $1 OFFSET $2
        "#,
    )
    .bind(limit as i64)
    .bind(offset as i64)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| {
        error!("[search_insurance] Erreur SQL: {}", e);
        AppError::Internal(format!("Erreur recherche assurance: {}", e))
    })?;

    let mut results: Vec<serde_json::Value> = Vec::new();

    for row in rows {
        let id = row.get::<i32, _>("id");
        let data: serde_json::Value =
            row.try_get::<serde_json::Value, _>("data").unwrap_or(json!({}));
        let gps_str: Option<String> = row.try_get("gps").ok();
        let user_nom: Option<String> = row.try_get("user_nom").ok();
        let user_prenom: Option<String> = row.try_get("user_prenom").ok();
        let user_telephone: Option<String> = row.try_get("user_telephone").ok();

        // Extraire les champs du JSON data
        let titre = extract_text_field(&data, &["titre_service", "nom", "title", "titre"])
            .unwrap_or_else(|| "Service assurance".to_string());
        let description = extract_text_field(&data, &["description", "details"]);
        let type_ass = extract_text_field(&data, &["type_assurance", "sous_categorie", "type"]);
        let compagnie_val = extract_text_field(&data, &["compagnie", "nom_compagnie", "company"]);
        let ville_val = extract_text_field(&data, &["ville", "city"]);
        let quartier_val = extract_text_field(&data, &["quartier", "neighborhood"]);
        let adresse = extract_text_field(&data, &["adresse", "address"]);
        let prix = extract_price(&data);
        let telephone = extract_text_field(&data, &["telephone", "phone"]).or(user_telephone);

        // Filtrage côté serveur
        if let Some(ref type_filter) = query.type_assurance {
            if let Some(ref t) = type_ass {
                if !t.to_lowercase().contains(&type_filter.to_lowercase()) {
                    continue;
                }
            } else {
                continue;
            }
        }

        if let Some(ref compagnie_filter) = query.compagnie {
            if let Some(ref c) = compagnie_val {
                if !c.to_lowercase().contains(&compagnie_filter.to_lowercase()) {
                    continue;
                }
            } else {
                continue;
            }
        }

        if let Some(ref ville_filter) = query.ville {
            if let Some(ref v) = ville_val {
                if !v.to_lowercase().contains(&ville_filter.to_lowercase()) {
                    continue;
                }
            } else {
                continue;
            }
        }

        if let Some(ref quartier_filter) = query.quartier {
            if let Some(ref q) = quartier_val {
                if !q.to_lowercase().contains(&quartier_filter.to_lowercase()) {
                    continue;
                }
            } else {
                continue;
            }
        }

        if let Some(prix_min) = query.prix_min {
            if let Some(p) = prix {
                if p < prix_min {
                    continue;
                }
            }
        }

        if let Some(prix_max) = query.prix_max {
            if let Some(p) = prix {
                if p > prix_max {
                    continue;
                }
            }
        }

        // Calcul distance GPS si fourni
        let distance_km = if let (Some(lat), Some(lon)) = (query.gps_lat, query.gps_lon) {
            parse_gps_and_distance(&gps_str, lat, lon)
        } else {
            None
        };

        if let Some(rayon) = query.rayon_km {
            if let Some(dist) = distance_km {
                if dist > rayon {
                    continue;
                }
            }
        }

        // Extraire les couvertures et images
        let couvertures = extract_array_field(&data, &["couvertures", "garanties", "coverages"]);
        let images = extract_media_field(&data, "images");

        results.push(json!({
            "id": id,
            "titre": titre,
            "description": description,
            "type_assurance": type_ass,
            "compagnie": compagnie_val,
            "ville": ville_val,
            "quartier": quartier_val,
            "adresse": adresse,
            "prix": prix,
            "telephone": telephone,
            "prestataire": format!("{} {}",
                user_prenom.unwrap_or_default(),
                user_nom.unwrap_or_default()
            ).trim().to_string(),
            "distance_km": distance_km,
            "couvertures": couvertures,
            "images": images,
        }));
    }

    let total = results.len();

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "results": results,
            "total": total,
            "limit": limit,
            "offset": offset,
        })),
    ))
}

// ═══════════════════════════════════════════════════════════════
// 2. DEVIS IA
// ═══════════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct GenerateQuoteRequest {
    pub type_assurance: String,
    pub couvertures_souhaitees: Option<Vec<String>>,
    pub profile: Option<InsuranceProfile>,
}

/// POST /api/assurance/ai/quote - Générer un devis d'assurance avec IA
pub async fn generate_quote(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(req): Json<GenerateQuoteRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[generate_quote] Génération devis pour user_id={}, type={}",
        user_id, req.type_assurance
    );

    let profile = req.profile.unwrap_or(InsuranceProfile {
        age: None,
        profession: None,
        ville: None,
        situation_familiale: None,
        nombre_personnes: Some(1),
        budget_mensuel: None,
        vehicule_type: None,
        vehicule_valeur: None,
        bien_immobilier_type: None,
        bien_immobilier_valeur: None,
    });

    let couvertures = req.couvertures_souhaitees.unwrap_or_default();

    let ai_service = AssuranceAIService::new(state.ia.clone());
    let quote = ai_service.generate_quote(&req.type_assurance, &profile, &couvertures).await?;

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "quote": serde_json::to_value(&quote).unwrap_or(json!({}))
        })),
    ))
}

// ═══════════════════════════════════════════════════════════════
// 3. COMPARAISON IA
// ═══════════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct CompareProductsRequest {
    pub type_assurance: String,
    pub produits: Vec<String>,
    pub profile: Option<InsuranceProfile>,
}

/// POST /api/assurance/ai/compare - Comparer des produits d'assurance avec IA
pub async fn compare_products(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(req): Json<CompareProductsRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[compare_products] Comparaison pour user_id={}, {} produits",
        user_id,
        req.produits.len()
    );

    if req.produits.len() < 2 {
        return Err(AppError::BadRequest(
            "Au moins 2 produits sont nécessaires pour une comparaison".to_string(),
        ));
    }

    let profile = req.profile.unwrap_or(InsuranceProfile {
        age: None,
        profession: None,
        ville: None,
        situation_familiale: None,
        nombre_personnes: Some(1),
        budget_mensuel: None,
        vehicule_type: None,
        vehicule_valeur: None,
        bien_immobilier_type: None,
        bien_immobilier_valeur: None,
    });

    let ai_service = AssuranceAIService::new(state.ia.clone());
    let comparison = ai_service
        .compare_products(&req.type_assurance, &req.produits, &profile)
        .await?;

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "comparison": serde_json::to_value(&comparison).unwrap_or(json!({}))
        })),
    ))
}

// ═══════════════════════════════════════════════════════════════
// 4. RECOMMANDATIONS IA
// ═══════════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct RecommendationsRequest {
    pub profile: Option<InsuranceProfile>,
    pub limit: Option<i32>,
}

/// POST /api/assurance/ai/recommendations - Recommandations personnalisées
pub async fn get_recommendations(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(req): Json<RecommendationsRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[get_recommendations] Recommandations assurance pour user_id={}",
        user_id
    );

    let profile = req.profile.unwrap_or(InsuranceProfile {
        age: None,
        profession: None,
        ville: None,
        situation_familiale: None,
        nombre_personnes: Some(1),
        budget_mensuel: None,
        vehicule_type: None,
        vehicule_valeur: None,
        bien_immobilier_type: None,
        bien_immobilier_valeur: None,
    });

    let limit = req.limit.unwrap_or(5).min(10) as usize;

    let ai_service = AssuranceAIService::new(state.ia.clone());
    let recommendations = ai_service.get_recommendations(&profile, limit).await?;

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "recommendations": serde_json::to_value(&recommendations).unwrap_or(json!([]))
        })),
    ))
}

// ═══════════════════════════════════════════════════════════════
// 5. ESTIMATION DE PRIME IA
// ═══════════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct EstimatePremiumRequest {
    pub type_assurance: String,
    pub produit: String,
    pub profile: Option<InsuranceProfile>,
}

/// POST /api/assurance/ai/estimate-premium - Estimer la prime d'assurance
pub async fn estimate_premium(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(req): Json<EstimatePremiumRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[estimate_premium] Estimation prime pour user_id={}, type={}, produit={}",
        user_id, req.type_assurance, req.produit
    );

    let profile = req.profile.unwrap_or(InsuranceProfile {
        age: None,
        profession: None,
        ville: None,
        situation_familiale: None,
        nombre_personnes: Some(1),
        budget_mensuel: None,
        vehicule_type: None,
        vehicule_valeur: None,
        bien_immobilier_type: None,
        bien_immobilier_valeur: None,
    });

    let ai_service = AssuranceAIService::new(state.ia.clone());
    let estimate = ai_service.estimate_premium(&req.type_assurance, &req.produit, &profile).await?;

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "estimate": serde_json::to_value(&estimate).unwrap_or(json!({}))
        })),
    ))
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

/// Extrait un champ texte du JSON data en essayant plusieurs clés
fn extract_text_field(data: &serde_json::Value, keys: &[&str]) -> Option<String> {
    for key in keys {
        if let Some(val) = data.get(key) {
            // Gérer le format {valeur: "..."}
            if let Some(obj) = val.as_object() {
                if let Some(v) = obj.get("valeur") {
                    if let Some(s) = v.as_str() {
                        if !s.is_empty() {
                            return Some(s.to_string());
                        }
                    }
                }
            }
            if let Some(s) = val.as_str() {
                if !s.is_empty() {
                    return Some(s.to_string());
                }
            }
        }
    }
    None
}

/// Extrait un prix du JSON data
fn extract_price(data: &serde_json::Value) -> Option<f64> {
    for key in &["price", "prix", "prime", "prime_annuelle", "tarif"] {
        if let Some(val) = data.get(key) {
            if let Some(obj) = val.as_object() {
                if let Some(v) = obj.get("valeur") {
                    if let Some(n) = v.as_f64() {
                        return Some(n);
                    }
                    if let Some(s) = v.as_str() {
                        if let Ok(n) = s.parse::<f64>() {
                            return Some(n);
                        }
                    }
                }
            }
            if let Some(n) = val.as_f64() {
                return Some(n);
            }
            if let Some(s) = val.as_str() {
                if let Ok(n) = s.parse::<f64>() {
                    return Some(n);
                }
            }
        }
    }
    None
}

/// Extrait un tableau de strings du JSON data
fn extract_array_field(data: &serde_json::Value, keys: &[&str]) -> Vec<String> {
    for key in keys {
        if let Some(val) = data.get(key) {
            if let Some(obj) = val.as_object() {
                if let Some(v) = obj.get("valeur") {
                    if let Some(arr) = v.as_array() {
                        return arr.iter().filter_map(|v| v.as_str().map(String::from)).collect();
                    }
                }
            }
            if let Some(arr) = val.as_array() {
                return arr.iter().filter_map(|v| v.as_str().map(String::from)).collect();
            }
        }
    }
    vec![]
}

/// Extrait les URLs média du JSON data
fn extract_media_field(data: &serde_json::Value, key: &str) -> Vec<String> {
    if let Some(val) = data.get(key) {
        if let Some(obj) = val.as_object() {
            if let Some(v) = obj.get("valeur") {
                if let Some(arr) = v.as_array() {
                    return arr.iter().filter_map(|v| v.as_str().map(String::from)).collect();
                }
            }
        }
        if let Some(arr) = val.as_array() {
            return arr.iter().filter_map(|v| v.as_str().map(String::from)).collect();
        }
    }
    vec![]
}

/// Parse GPS et calcule la distance
fn parse_gps_and_distance(gps_str: &Option<String>, user_lat: f64, user_lon: f64) -> Option<f64> {
    let gps = gps_str.as_ref()?;
    let parts: Vec<&str> = gps.split(',').collect();
    if parts.len() != 2 {
        return None;
    }
    let coord1: f64 = parts[0].trim().parse().ok()?;
    let coord2: f64 = parts[1].trim().parse().ok()?;

    // Déterminer lat/lng
    let (lat, lng) = if coord1.abs() <= 90.0 && coord2.abs() <= 180.0 {
        (coord1, coord2)
    } else {
        (coord2, coord1)
    };

    Some(haversine_distance(user_lat, user_lon, lat, lng))
}

/// Formule de Haversine pour calculer la distance entre 2 points GPS
fn haversine_distance(lat1: f64, lon1: f64, lat2: f64, lon2: f64) -> f64 {
    let r = 6371.0; // Rayon de la Terre en km
    let d_lat = (lat2 - lat1).to_radians();
    let d_lon = (lon2 - lon1).to_radians();
    let a = (d_lat / 2.0).sin().powi(2)
        + lat1.to_radians().cos() * lat2.to_radians().cos() * (d_lon / 2.0).sin().powi(2);
    let c = 2.0 * a.sqrt().asin();
    r * c
}
