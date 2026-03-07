//! ✅ Contrôleur pour service Assurance dédié — Digitalisation complète
//!
//! Endpoints pour :
//! - Recherche dédiée de produits d'assurance
//! - Génération de devis IA
//! - Comparaison de produits IA
//! - Recommandations personnalisées IA
//! - Estimation de prime IA
//! - CRUD produits d'assurance (partenaire)
//! - Gestion polices/contrats (partenaire)
//! - Déclarations sinistres + suivi temps réel
//! - Analyse IA sinistres (fraude, estimation)
//! - Dashboard analytics partenaire

use crate::core::types::{AppError, AppResult};
use crate::middlewares::jwt::AuthenticatedUser;
use crate::services::assurance_ai_service::{AssuranceAIService, InsuranceProfile};
use crate::state::AppState;
use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use chrono::{NaiveDate, Utc};
use log::{error, info, warn};
use serde::Deserialize;
use serde_json::json;
use sqlx::Row;
use std::sync::Arc;
use uuid::Uuid;

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

// ═══════════════════════════════════════════════════════════════
// 6. CRUD PRODUITS D'ASSURANCE (PARTENAIRE)
// ═══════════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct CreateInsuranceProductRequest {
    pub service_id: i32,
    pub nom_produit: String,
    pub type_assurance: String,
    pub sous_categorie: String,
    pub description: Option<String>,
    pub compagnie: Option<String>,
    pub prime_mensuelle: Option<f64>,
    pub prime_trimestrielle: Option<f64>,
    pub prime_semestrielle: Option<f64>,
    pub prime_annuelle: Option<f64>,
    pub couverture_max: Option<f64>,
    pub franchise_montant: Option<f64>,
    pub franchise_pourcentage: Option<f64>,
    pub duree_contrat_mois: Option<i32>,
    pub age_min: Option<i32>,
    pub age_max: Option<i32>,
    pub garanties: Option<Vec<String>>,
    pub exclusions: Option<Vec<String>>,
    pub conditions_generales: Option<String>,
    pub avantages: Option<Vec<String>>,
    pub options_supplementaires: Option<serde_json::Value>,
    pub documents_requis: Option<Vec<String>>,
    pub delai_carence_jours: Option<i32>,
}

/// POST /api/assurance/products - Créer un produit d'assurance
pub async fn create_insurance_product(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(req): Json<CreateInsuranceProductRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[create_insurance_product] user_id={}, produit={}",
        user_id, req.nom_produit
    );

    let row = sqlx::query(
        r#"INSERT INTO insurance_products (
            service_id, assureur_user_id, nom_produit, type_assurance, sous_categorie,
            description, compagnie, prime_mensuelle, prime_trimestrielle, prime_semestrielle,
            prime_annuelle, couverture_max, franchise_montant, franchise_pourcentage,
            duree_contrat_mois, age_min, age_max, garanties, exclusions, conditions_generales,
            avantages, options_supplementaires, documents_requis, delai_carence_jours
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
            $18::jsonb, $19::jsonb, $20, $21::jsonb, $22::jsonb, $23::jsonb, $24
        ) RETURNING id, created_at"#,
    )
    .bind(req.service_id)
    .bind(user_id)
    .bind(&req.nom_produit)
    .bind(&req.type_assurance)
    .bind(&req.sous_categorie)
    .bind(&req.description)
    .bind(&req.compagnie)
    .bind(req.prime_mensuelle)
    .bind(req.prime_trimestrielle)
    .bind(req.prime_semestrielle)
    .bind(req.prime_annuelle)
    .bind(req.couverture_max)
    .bind(req.franchise_montant.unwrap_or(0.0))
    .bind(req.franchise_pourcentage.unwrap_or(0.0))
    .bind(req.duree_contrat_mois.unwrap_or(12))
    .bind(req.age_min.unwrap_or(18))
    .bind(req.age_max.unwrap_or(70))
    .bind(json!(req.garanties.unwrap_or_default()))
    .bind(json!(req.exclusions.unwrap_or_default()))
    .bind(&req.conditions_generales)
    .bind(json!(req.avantages.unwrap_or_default()))
    .bind(req.options_supplementaires.clone().unwrap_or(json!([])))
    .bind(json!(req.documents_requis.unwrap_or_default()))
    .bind(req.delai_carence_jours.unwrap_or(0))
    .fetch_one(&state.pg)
    .await
    .map_err(|e| {
        error!("[create_insurance_product] SQL error: {}", e);
        AppError::Internal(format!("Erreur création produit: {}", e))
    })?;

    let id: i32 = row.get("id");

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "success": true,
            "product_id": id,
            "message": "Produit d'assurance créé avec succès"
        })),
    ))
}

/// GET /api/assurance/products - Lister les produits du partenaire
pub async fn list_insurance_products(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    let rows = sqlx::query(
        r#"SELECT id, service_id, nom_produit, type_assurance, sous_categorie, description,
            compagnie, prime_mensuelle, prime_annuelle, couverture_max, franchise_montant,
            duree_contrat_mois, garanties, exclusions, avantages, options_supplementaires,
            documents_requis, delai_carence_jours, age_min, age_max, is_active, is_featured,
            souscriptions_count, note_moyenne, created_at, updated_at
        FROM insurance_products WHERE assureur_user_id = $1 ORDER BY created_at DESC"#,
    )
    .bind(user_id)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur liste produits: {}", e)))?;

    let products: Vec<serde_json::Value> = rows.iter().map(|r| json!({
        "id": r.get::<i32, _>("id"),
        "service_id": r.get::<i32, _>("service_id"),
        "nom_produit": r.get::<String, _>("nom_produit"),
        "type_assurance": r.get::<String, _>("type_assurance"),
        "sous_categorie": r.get::<String, _>("sous_categorie"),
        "description": r.try_get::<String, _>("description").ok(),
        "compagnie": r.try_get::<String, _>("compagnie").ok(),
        "prime_mensuelle": r.try_get::<rust_decimal::Decimal, _>("prime_mensuelle").ok().map(|d| d.to_string()),
        "prime_annuelle": r.try_get::<rust_decimal::Decimal, _>("prime_annuelle").ok().map(|d| d.to_string()),
        "couverture_max": r.try_get::<rust_decimal::Decimal, _>("couverture_max").ok().map(|d| d.to_string()),
        "franchise_montant": r.try_get::<rust_decimal::Decimal, _>("franchise_montant").ok().map(|d| d.to_string()),
        "duree_contrat_mois": r.try_get::<i32, _>("duree_contrat_mois").ok(),
        "garanties": r.try_get::<serde_json::Value, _>("garanties").ok(),
        "exclusions": r.try_get::<serde_json::Value, _>("exclusions").ok(),
        "avantages": r.try_get::<serde_json::Value, _>("avantages").ok(),
        "options_supplementaires": r.try_get::<serde_json::Value, _>("options_supplementaires").ok(),
        "documents_requis": r.try_get::<serde_json::Value, _>("documents_requis").ok(),
        "age_min": r.try_get::<i32, _>("age_min").ok(),
        "age_max": r.try_get::<i32, _>("age_max").ok(),
        "is_active": r.try_get::<bool, _>("is_active").unwrap_or(true),
        "is_featured": r.try_get::<bool, _>("is_featured").unwrap_or(false),
        "souscriptions_count": r.try_get::<i32, _>("souscriptions_count").unwrap_or(0),
        "note_moyenne": r.try_get::<rust_decimal::Decimal, _>("note_moyenne").ok().map(|d| d.to_string()),
    })).collect();

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "products": products,
            "total": products.len()
        })),
    ))
}

/// PUT /api/assurance/products/:id - Modifier un produit
pub async fn update_insurance_product(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(product_id): Path<i32>,
    Json(req): Json<CreateInsuranceProductRequest>,
) -> AppResult<impl IntoResponse> {
    sqlx::query(
        r#"UPDATE insurance_products SET
            nom_produit=$1, type_assurance=$2, sous_categorie=$3, description=$4,
            compagnie=$5, prime_mensuelle=$6, prime_trimestrielle=$7, prime_semestrielle=$8,
            prime_annuelle=$9, couverture_max=$10, franchise_montant=$11, franchise_pourcentage=$12,
            duree_contrat_mois=$13, age_min=$14, age_max=$15, garanties=$16::jsonb,
            exclusions=$17::jsonb, conditions_generales=$18, avantages=$19::jsonb,
            options_supplementaires=$20::jsonb, documents_requis=$21::jsonb,
            delai_carence_jours=$22, updated_at=NOW()
        WHERE id=$23 AND assureur_user_id=$24"#,
    )
    .bind(&req.nom_produit)
    .bind(&req.type_assurance)
    .bind(&req.sous_categorie)
    .bind(&req.description)
    .bind(&req.compagnie)
    .bind(req.prime_mensuelle)
    .bind(req.prime_trimestrielle)
    .bind(req.prime_semestrielle)
    .bind(req.prime_annuelle)
    .bind(req.couverture_max)
    .bind(req.franchise_montant.unwrap_or(0.0))
    .bind(req.franchise_pourcentage.unwrap_or(0.0))
    .bind(req.duree_contrat_mois.unwrap_or(12))
    .bind(req.age_min.unwrap_or(18))
    .bind(req.age_max.unwrap_or(70))
    .bind(json!(req.garanties.unwrap_or_default()))
    .bind(json!(req.exclusions.unwrap_or_default()))
    .bind(&req.conditions_generales)
    .bind(json!(req.avantages.unwrap_or_default()))
    .bind(req.options_supplementaires.clone().unwrap_or(json!([])))
    .bind(json!(req.documents_requis.unwrap_or_default()))
    .bind(req.delai_carence_jours.unwrap_or(0))
    .bind(product_id)
    .bind(user_id)
    .execute(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur mise à jour produit: {}", e)))?;

    Ok((
        StatusCode::OK,
        Json(json!({ "success": true, "message": "Produit mis à jour" })),
    ))
}

/// DELETE /api/assurance/products/:id/toggle - Activer/désactiver
pub async fn toggle_insurance_product(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(product_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    let row = sqlx::query(
        "UPDATE insurance_products SET is_active = NOT is_active, updated_at=NOW() WHERE id=$1 AND assureur_user_id=$2 RETURNING is_active"
    )
    .bind(product_id).bind(user_id)
    .fetch_one(&state.pg).await
    .map_err(|e| AppError::Internal(format!("Erreur toggle produit: {}", e)))?;

    let active: bool = row.get("is_active");
    Ok((
        StatusCode::OK,
        Json(json!({ "success": true, "is_active": active })),
    ))
}

// ═══════════════════════════════════════════════════════════════
// 7. GESTION POLICES / CONTRATS
// ═══════════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct CreatePolicyRequest {
    pub product_id: i32,
    pub client_nom: String,
    pub client_prenom: Option<String>,
    pub client_telephone: Option<String>,
    pub client_email: Option<String>,
    pub client_adresse: Option<String>,
    pub client_date_naissance: Option<String>,
    pub client_profession: Option<String>,
    pub client_user_id: Option<i32>,
    pub beneficiaires: Option<serde_json::Value>,
    pub date_effet: String,
    pub date_expiration: String,
    pub prime_totale: f64,
    pub frequence_paiement: Option<String>,
    pub garanties_souscrites: Option<serde_json::Value>,
    pub options_souscrites: Option<serde_json::Value>,
    pub conditions_particulieres: Option<String>,
    pub objet_assure: Option<serde_json::Value>,
    pub renouvellement_auto: Option<bool>,
}

fn generate_policy_number() -> String {
    let now = Utc::now();
    format!(
        "POL-{}-{}",
        now.format("%Y%m%d"),
        &Uuid::new_v4().to_string()[..8].to_uppercase()
    )
}

fn generate_claim_number() -> String {
    let now = Utc::now();
    format!(
        "SIN-{}-{}",
        now.format("%Y%m%d"),
        &Uuid::new_v4().to_string()[..8].to_uppercase()
    )
}

/// POST /api/assurance/policies - Émettre une police
pub async fn create_policy(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(req): Json<CreatePolicyRequest>,
) -> AppResult<impl IntoResponse> {
    let numero = generate_policy_number();
    let date_effet = NaiveDate::parse_from_str(&req.date_effet, "%Y-%m-%d")
        .map_err(|_| AppError::BadRequest("Format date_effet invalide (YYYY-MM-DD)".into()))?;
    let date_exp = NaiveDate::parse_from_str(&req.date_expiration, "%Y-%m-%d")
        .map_err(|_| AppError::BadRequest("Format date_expiration invalide (YYYY-MM-DD)".into()))?;
    let client_naissance = req
        .client_date_naissance
        .as_ref()
        .and_then(|d| NaiveDate::parse_from_str(d, "%Y-%m-%d").ok());

    let row = sqlx::query(
        r#"INSERT INTO insurance_policies (
            product_id, assureur_user_id, client_user_id, numero_police,
            client_nom, client_prenom, client_telephone, client_email,
            client_adresse, client_date_naissance, client_profession,
            beneficiaires, date_effet, date_expiration, prime_totale,
            frequence_paiement, garanties_souscrites, options_souscrites,
            conditions_particulieres, objet_assure, renouvellement_auto
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14,$15,$16,$17::jsonb,$18::jsonb,$19,$20::jsonb,$21)
        RETURNING id, numero_police"#,
    )
    .bind(req.product_id)
    .bind(user_id)
    .bind(req.client_user_id)
    .bind(&numero)
    .bind(&req.client_nom)
    .bind(&req.client_prenom)
    .bind(&req.client_telephone)
    .bind(&req.client_email)
    .bind(&req.client_adresse)
    .bind(client_naissance)
    .bind(&req.client_profession)
    .bind(req.beneficiaires.clone().unwrap_or(json!([])))
    .bind(date_effet)
    .bind(date_exp)
    .bind(req.prime_totale)
    .bind(req.frequence_paiement.as_deref().unwrap_or("annuel"))
    .bind(req.garanties_souscrites.clone().unwrap_or(json!([])))
    .bind(req.options_souscrites.clone().unwrap_or(json!([])))
    .bind(&req.conditions_particulieres)
    .bind(req.objet_assure.clone().unwrap_or(json!({})))
    .bind(req.renouvellement_auto.unwrap_or(true))
    .fetch_one(&state.pg)
    .await
    .map_err(|e| {
        error!("[create_policy] SQL: {}", e);
        AppError::Internal(format!("Erreur création police: {}", e))
    })?;

    // Incrémente le compteur de souscriptions
    let _ = sqlx::query(
        "UPDATE insurance_products SET souscriptions_count = souscriptions_count + 1 WHERE id = $1",
    )
    .bind(req.product_id)
    .execute(&state.pg)
    .await;

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "success": true,
            "policy_id": row.get::<i32, _>("id"),
            "numero_police": row.get::<String, _>("numero_police"),
            "message": "Police émise avec succès"
        })),
    ))
}

/// GET /api/assurance/policies - Lister les polices du partenaire
pub async fn list_policies(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Query(query): Query<PolicyListQuery>,
) -> AppResult<impl IntoResponse> {
    let statut_filter = query.statut.as_deref().unwrap_or("");
    let rows = if statut_filter.is_empty() {
        sqlx::query(
            r#"SELECT p.*, ip.nom_produit, ip.type_assurance, ip.sous_categorie
            FROM insurance_policies p
            JOIN insurance_products ip ON ip.id = p.product_id
            WHERE p.assureur_user_id = $1 ORDER BY p.created_at DESC LIMIT 100"#,
        )
        .bind(user_id)
        .fetch_all(&state.pg)
        .await
    } else {
        sqlx::query(
            r#"SELECT p.*, ip.nom_produit, ip.type_assurance, ip.sous_categorie
            FROM insurance_policies p
            JOIN insurance_products ip ON ip.id = p.product_id
            WHERE p.assureur_user_id = $1 AND p.statut = $2 ORDER BY p.created_at DESC LIMIT 100"#,
        )
        .bind(user_id)
        .bind(statut_filter)
        .fetch_all(&state.pg)
        .await
    }
    .map_err(|e| AppError::Internal(format!("Erreur liste polices: {}", e)))?;

    let policies: Vec<serde_json::Value> = rows.iter().map(|r| json!({
        "id": r.get::<i32, _>("id"),
        "product_id": r.get::<i32, _>("product_id"),
        "numero_police": r.get::<String, _>("numero_police"),
        "nom_produit": r.try_get::<String, _>("nom_produit").ok(),
        "type_assurance": r.try_get::<String, _>("type_assurance").ok(),
        "client_nom": r.get::<String, _>("client_nom"),
        "client_prenom": r.try_get::<String, _>("client_prenom").ok(),
        "client_telephone": r.try_get::<String, _>("client_telephone").ok(),
        "date_effet": r.try_get::<NaiveDate, _>("date_effet").ok().map(|d| d.to_string()),
        "date_expiration": r.try_get::<NaiveDate, _>("date_expiration").ok().map(|d| d.to_string()),
        "prime_totale": r.try_get::<rust_decimal::Decimal, _>("prime_totale").ok().map(|d| d.to_string()),
        "statut": r.try_get::<String, _>("statut").unwrap_or("active".into()),
        "renouvellement_auto": r.try_get::<bool, _>("renouvellement_auto").unwrap_or(true),
        "created_at": r.try_get::<chrono::DateTime<Utc>, _>("created_at").ok().map(|d| d.to_rfc3339()),
    })).collect();

    Ok((
        StatusCode::OK,
        Json(json!({ "success": true, "policies": policies, "total": policies.len() })),
    ))
}

#[derive(Debug, Deserialize)]
pub struct PolicyListQuery {
    pub statut: Option<String>,
}

/// PUT /api/assurance/policies/:id/status - Changer le statut d'une police
pub async fn update_policy_status(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(policy_id): Path<i32>,
    Json(body): Json<serde_json::Value>,
) -> AppResult<impl IntoResponse> {
    let new_status = body
        .get("statut")
        .and_then(|v| v.as_str())
        .ok_or_else(|| AppError::BadRequest("Champ 'statut' requis".into()))?;
    let motif = body.get("motif").and_then(|v| v.as_str()).unwrap_or("");

    sqlx::query(
        "UPDATE insurance_policies SET statut=$1, motif_resiliation=$2, updated_at=NOW() WHERE id=$3 AND assureur_user_id=$4"
    )
    .bind(new_status).bind(motif).bind(policy_id).bind(user_id)
    .execute(&state.pg).await
    .map_err(|e| AppError::Internal(format!("Erreur update statut police: {}", e)))?;

    Ok((
        StatusCode::OK,
        Json(json!({ "success": true, "message": format!("Statut mis à jour: {}", new_status) })),
    ))
}

/// GET /api/assurance/policies/client - Polices d'un client (côté utilisateur)
pub async fn get_client_policies(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    let rows = sqlx::query(
        r#"SELECT p.*, ip.nom_produit, ip.type_assurance, ip.sous_categorie, ip.compagnie,
            ip.garanties, ip.couverture_max
        FROM insurance_policies p
        JOIN insurance_products ip ON ip.id = p.product_id
        WHERE p.client_user_id = $1 ORDER BY p.created_at DESC"#,
    )
    .bind(user_id)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur polices client: {}", e)))?;

    let policies: Vec<serde_json::Value> = rows.iter().map(|r| json!({
        "id": r.get::<i32, _>("id"),
        "numero_police": r.get::<String, _>("numero_police"),
        "nom_produit": r.try_get::<String, _>("nom_produit").ok(),
        "type_assurance": r.try_get::<String, _>("type_assurance").ok(),
        "sous_categorie": r.try_get::<String, _>("sous_categorie").ok(),
        "compagnie": r.try_get::<String, _>("compagnie").ok(),
        "client_nom": r.get::<String, _>("client_nom"),
        "date_effet": r.try_get::<NaiveDate, _>("date_effet").ok().map(|d| d.to_string()),
        "date_expiration": r.try_get::<NaiveDate, _>("date_expiration").ok().map(|d| d.to_string()),
        "prime_totale": r.try_get::<rust_decimal::Decimal, _>("prime_totale").ok().map(|d| d.to_string()),
        "statut": r.try_get::<String, _>("statut").unwrap_or("active".into()),
        "garanties": r.try_get::<serde_json::Value, _>("garanties").ok(),
        "couverture_max": r.try_get::<rust_decimal::Decimal, _>("couverture_max").ok().map(|d| d.to_string()),
    })).collect();

    Ok((
        StatusCode::OK,
        Json(json!({ "success": true, "policies": policies })),
    ))
}

// ═══════════════════════════════════════════════════════════════
// 8. DÉCLARATIONS SINISTRES
// ═══════════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct CreateClaimRequest {
    pub policy_id: i32,
    pub type_sinistre: String,
    pub date_sinistre: String,
    pub lieu_sinistre: Option<String>,
    pub gps_sinistre: Option<String>,
    pub description_sinistre: String,
    pub circonstances: Option<String>,
    pub temoins: Option<serde_json::Value>,
    pub dommages_estimes: Option<f64>,
    pub montant_reclame: Option<f64>,
}

/// POST /api/assurance/claims - Déclarer un sinistre (client)
pub async fn create_claim(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(req): Json<CreateClaimRequest>,
) -> AppResult<impl IntoResponse> {
    // Vérifier que la police appartient bien au client
    let policy = sqlx::query(
        "SELECT assureur_user_id, client_user_id, statut FROM insurance_policies WHERE id = $1",
    )
    .bind(req.policy_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur vérif police: {}", e)))?;

    let policy = policy.ok_or_else(|| AppError::NotFound("Police introuvable".into()))?;
    let assureur_id: i32 = policy.get("assureur_user_id");
    let statut: String = policy.try_get("statut").unwrap_or("active".into());

    if statut != "active" {
        return Err(AppError::BadRequest(format!(
            "Police non active (statut: {})",
            statut
        )));
    }

    let numero = generate_claim_number();
    let date_sin = NaiveDate::parse_from_str(&req.date_sinistre, "%Y-%m-%d")
        .map_err(|_| AppError::BadRequest("Format date_sinistre invalide (YYYY-MM-DD)".into()))?;

    let initial_history = json!([{
        "statut": "declare",
        "date": Utc::now().to_rfc3339(),
        "par": "client",
        "note": "Déclaration initiale"
    }]);

    let row = sqlx::query(
        r#"INSERT INTO insurance_claims (
            policy_id, assureur_user_id, declarant_user_id, numero_sinistre,
            type_sinistre, date_sinistre, lieu_sinistre, gps_sinistre,
            description_sinistre, circonstances, temoins,
            dommages_estimes, montant_reclame, historique_statuts
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14::jsonb)
        RETURNING id, numero_sinistre"#,
    )
    .bind(req.policy_id)
    .bind(assureur_id)
    .bind(user_id)
    .bind(&numero)
    .bind(&req.type_sinistre)
    .bind(date_sin)
    .bind(&req.lieu_sinistre)
    .bind(&req.gps_sinistre)
    .bind(&req.description_sinistre)
    .bind(&req.circonstances)
    .bind(req.temoins.clone().unwrap_or(json!([])))
    .bind(req.dommages_estimes)
    .bind(req.montant_reclame)
    .bind(initial_history)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| {
        error!("[create_claim] SQL: {}", e);
        AppError::Internal(format!("Erreur déclaration sinistre: {}", e))
    })?;

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "success": true,
            "claim_id": row.get::<i32, _>("id"),
            "numero_sinistre": row.get::<String, _>("numero_sinistre"),
            "message": "Sinistre déclaré avec succès. Vous serez notifié de l'avancement."
        })),
    ))
}

/// GET /api/assurance/claims - Lister sinistres (partenaire assureur)
pub async fn list_claims(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Query(query): Query<ClaimListQuery>,
) -> AppResult<impl IntoResponse> {
    let statut_filter = query.statut.as_deref().unwrap_or("");
    let rows = if statut_filter.is_empty() {
        sqlx::query(
            r#"SELECT c.*, p.numero_police, ip.nom_produit, ip.type_assurance
            FROM insurance_claims c
            JOIN insurance_policies p ON p.id = c.policy_id
            JOIN insurance_products ip ON ip.id = p.product_id
            WHERE c.assureur_user_id = $1 ORDER BY c.created_at DESC LIMIT 100"#,
        )
        .bind(user_id)
        .fetch_all(&state.pg)
        .await
    } else {
        sqlx::query(
            r#"SELECT c.*, p.numero_police, ip.nom_produit, ip.type_assurance
            FROM insurance_claims c
            JOIN insurance_policies p ON p.id = c.policy_id
            JOIN insurance_products ip ON ip.id = p.product_id
            WHERE c.assureur_user_id = $1 AND c.statut = $2 ORDER BY c.created_at DESC LIMIT 100"#,
        )
        .bind(user_id)
        .bind(statut_filter)
        .fetch_all(&state.pg)
        .await
    }
    .map_err(|e| AppError::Internal(format!("Erreur liste sinistres: {}", e)))?;

    let claims: Vec<serde_json::Value> = rows.iter().map(|r| json!({
        "id": r.get::<i32, _>("id"),
        "policy_id": r.get::<i32, _>("policy_id"),
        "numero_sinistre": r.get::<String, _>("numero_sinistre"),
        "numero_police": r.try_get::<String, _>("numero_police").ok(),
        "nom_produit": r.try_get::<String, _>("nom_produit").ok(),
        "type_assurance": r.try_get::<String, _>("type_assurance").ok(),
        "type_sinistre": r.get::<String, _>("type_sinistre"),
        "date_sinistre": r.try_get::<NaiveDate, _>("date_sinistre").ok().map(|d| d.to_string()),
        "description_sinistre": r.try_get::<String, _>("description_sinistre").ok(),
        "lieu_sinistre": r.try_get::<String, _>("lieu_sinistre").ok(),
        "dommages_estimes": r.try_get::<rust_decimal::Decimal, _>("dommages_estimes").ok().map(|d| d.to_string()),
        "montant_reclame": r.try_get::<rust_decimal::Decimal, _>("montant_reclame").ok().map(|d| d.to_string()),
        "montant_indemnise": r.try_get::<rust_decimal::Decimal, _>("montant_indemnise").ok().map(|d| d.to_string()),
        "statut": r.try_get::<String, _>("statut").unwrap_or("declare".into()),
        "priorite": r.try_get::<String, _>("priorite").unwrap_or("normale".into()),
        "agent_traitant": r.try_get::<String, _>("agent_traitant").ok(),
        "fraud_score": r.try_get::<rust_decimal::Decimal, _>("fraud_score").ok().map(|d| d.to_string()),
        "ai_analysis": r.try_get::<serde_json::Value, _>("ai_analysis").ok(),
        "created_at": r.try_get::<chrono::DateTime<Utc>, _>("created_at").ok().map(|d| d.to_rfc3339()),
    })).collect();

    Ok((
        StatusCode::OK,
        Json(json!({ "success": true, "claims": claims, "total": claims.len() })),
    ))
}

#[derive(Debug, Deserialize)]
pub struct ClaimListQuery {
    pub statut: Option<String>,
}

/// GET /api/assurance/claims/client - Sinistres côté client
pub async fn get_client_claims(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    let rows = sqlx::query(
        r#"SELECT c.*, p.numero_police, ip.nom_produit, ip.type_assurance, ip.compagnie
        FROM insurance_claims c
        JOIN insurance_policies p ON p.id = c.policy_id
        JOIN insurance_products ip ON ip.id = p.product_id
        WHERE c.declarant_user_id = $1 ORDER BY c.created_at DESC"#,
    )
    .bind(user_id)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur sinistres client: {}", e)))?;

    let claims: Vec<serde_json::Value> = rows.iter().map(|r| json!({
        "id": r.get::<i32, _>("id"),
        "numero_sinistre": r.get::<String, _>("numero_sinistre"),
        "numero_police": r.try_get::<String, _>("numero_police").ok(),
        "nom_produit": r.try_get::<String, _>("nom_produit").ok(),
        "type_assurance": r.try_get::<String, _>("type_assurance").ok(),
        "compagnie": r.try_get::<String, _>("compagnie").ok(),
        "type_sinistre": r.get::<String, _>("type_sinistre"),
        "date_sinistre": r.try_get::<NaiveDate, _>("date_sinistre").ok().map(|d| d.to_string()),
        "description_sinistre": r.try_get::<String, _>("description_sinistre").ok(),
        "statut": r.try_get::<String, _>("statut").unwrap_or("declare".into()),
        "priorite": r.try_get::<String, _>("priorite").unwrap_or("normale".into()),
        "montant_reclame": r.try_get::<rust_decimal::Decimal, _>("montant_reclame").ok().map(|d| d.to_string()),
        "montant_indemnise": r.try_get::<rust_decimal::Decimal, _>("montant_indemnise").ok().map(|d| d.to_string()),
        "historique_statuts": r.try_get::<serde_json::Value, _>("historique_statuts").ok(),
        "created_at": r.try_get::<chrono::DateTime<Utc>, _>("created_at").ok().map(|d| d.to_rfc3339()),
    })).collect();

    Ok((
        StatusCode::OK,
        Json(json!({ "success": true, "claims": claims })),
    ))
}

/// PUT /api/assurance/claims/:id/status - Mettre à jour le statut d'un sinistre (partenaire)
pub async fn update_claim_status(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(claim_id): Path<i32>,
    Json(body): Json<serde_json::Value>,
) -> AppResult<impl IntoResponse> {
    let new_status = body
        .get("statut")
        .and_then(|v| v.as_str())
        .ok_or_else(|| AppError::BadRequest("Champ 'statut' requis".into()))?;
    let note = body.get("note").and_then(|v| v.as_str()).unwrap_or("");
    let montant_indemnise = body.get("montant_indemnise").and_then(|v| v.as_f64());
    let motif_refus = body.get("motif_refus").and_then(|v| v.as_str());
    let agent = body.get("agent_traitant").and_then(|v| v.as_str());

    // Ajouter au historique
    let history_entry = json!({
        "statut": new_status,
        "date": Utc::now().to_rfc3339(),
        "par": "assureur",
        "note": note
    });

    sqlx::query(
        r#"UPDATE insurance_claims SET
            statut = $1,
            notes_internes = COALESCE(notes_internes, '') || $2,
            montant_indemnise = COALESCE($3, montant_indemnise),
            motif_refus = COALESCE($4, motif_refus),
            agent_traitant = COALESCE($5, agent_traitant),
            date_indemnisation = CASE WHEN $1 = 'indemnise' THEN NOW()::date ELSE date_indemnisation END,
            historique_statuts = COALESCE(historique_statuts, '[]'::jsonb) || $6::jsonb,
            updated_at = NOW()
        WHERE id = $7 AND assureur_user_id = $8"#
    )
    .bind(new_status)
    .bind(if note.is_empty() { "".to_string() } else { format!("\n[{}] {}", Utc::now().format("%d/%m/%Y %H:%M"), note) })
    .bind(montant_indemnise)
    .bind(motif_refus)
    .bind(agent)
    .bind(history_entry)
    .bind(claim_id)
    .bind(user_id)
    .execute(&state.pg).await
    .map_err(|e| AppError::Internal(format!("Erreur update sinistre: {}", e)))?;

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "message": format!("Sinistre mis à jour: {}", new_status)
        })),
    ))
}

// ═══════════════════════════════════════════════════════════════
// 9. ANALYSE IA SINISTRE (FRAUDE, ESTIMATION, RECOMMANDATIONS)
// ═══════════════════════════════════════════════════════════════

/// POST /api/assurance/claims/:id/ai-analyze - Analyse IA d'un sinistre
pub async fn ai_analyze_claim(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(claim_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    let claim = sqlx::query(
        r#"SELECT c.*, p.numero_police, p.prime_totale, p.garanties_souscrites, p.objet_assure,
            ip.nom_produit, ip.type_assurance, ip.sous_categorie, ip.couverture_max, ip.franchise_montant
        FROM insurance_claims c
        JOIN insurance_policies p ON p.id = c.policy_id
        JOIN insurance_products ip ON ip.id = p.product_id
        WHERE c.id = $1 AND c.assureur_user_id = $2"#
    ).bind(claim_id).bind(user_id)
    .fetch_optional(&state.pg).await
    .map_err(|e| AppError::Internal(format!("Erreur fetch sinistre: {}", e)))?
    .ok_or_else(|| AppError::NotFound("Sinistre introuvable".into()))?;

    let prompt = format!(
        r#"Tu es un expert en gestion de sinistres d'assurance en Afrique (spécialité CIMA/Cameroun).

ANALYSE LE SINISTRE SUIVANT :
- Numéro: {}
- Type: {}
- Date: {}
- Lieu: {}
- Description: {}
- Circonstances: {}
- Dommages estimés: {} XAF
- Montant réclamé: {} XAF

CONTRAT :
- Produit: {} ({})
- Police: {}
- Prime: {} XAF
- Couverture max: {} XAF
- Franchise: {} XAF
- Garanties: {}
- Objet assuré: {}

Fournis une analyse complète en JSON strict :
{{
    "fraud_score": 0.15,
    "fraud_indicators": ["indicateur 1", ...],
    "legitimacy_assessment": "Évaluation de la légitimité...",
    "estimated_indemnity": 500000.0,
    "indemnity_calculation": "Méthode de calcul...",
    "coverage_applicable": true,
    "applicable_guarantees": ["garantie 1", ...],
    "exclusions_check": ["Aucune exclusion applicable"],
    "franchise_deductible": 50000.0,
    "recommended_action": "approuver|refuser|expertise_necessaire",
    "action_justification": "Justification détaillée...",
    "documents_manquants": ["PV police", ...],
    "priority_level": "normale|haute|urgente",
    "estimated_processing_days": 15,
    "similar_claims_pattern": "Description de patterns similaires...",
    "recommendations": ["Recommandation 1", ...]
}}
"#,
        claim.try_get::<String, _>("numero_sinistre").unwrap_or_default(),
        claim.try_get::<String, _>("type_sinistre").unwrap_or_default(),
        claim
            .try_get::<NaiveDate, _>("date_sinistre")
            .map(|d| d.to_string())
            .unwrap_or_default(),
        claim.try_get::<String, _>("lieu_sinistre").unwrap_or("Non précisé".into()),
        claim.try_get::<String, _>("description_sinistre").unwrap_or_default(),
        claim.try_get::<String, _>("circonstances").unwrap_or("Non précisé".into()),
        claim
            .try_get::<rust_decimal::Decimal, _>("dommages_estimes")
            .map(|d| d.to_string())
            .unwrap_or("Non estimé".into()),
        claim
            .try_get::<rust_decimal::Decimal, _>("montant_reclame")
            .map(|d| d.to_string())
            .unwrap_or("Non précisé".into()),
        claim.try_get::<String, _>("nom_produit").unwrap_or_default(),
        claim.try_get::<String, _>("type_assurance").unwrap_or_default(),
        claim.try_get::<String, _>("numero_police").unwrap_or_default(),
        claim
            .try_get::<rust_decimal::Decimal, _>("prime_totale")
            .map(|d| d.to_string())
            .unwrap_or("N/A".into()),
        claim
            .try_get::<rust_decimal::Decimal, _>("couverture_max")
            .map(|d| d.to_string())
            .unwrap_or("N/A".into()),
        claim
            .try_get::<rust_decimal::Decimal, _>("franchise_montant")
            .map(|d| d.to_string())
            .unwrap_or("0".into()),
        claim
            .try_get::<serde_json::Value, _>("garanties_souscrites")
            .unwrap_or(json!([])),
        claim.try_get::<serde_json::Value, _>("objet_assure").unwrap_or(json!({})),
    );

    let _ai_service = AssuranceAIService::new(state.ia.clone());
    let (_, response, _) = state.ia.predict(&prompt).await?;

    let cleaned = crate::services::assurance_ai_service::clean_json_response_pub(&response);
    let analysis: serde_json::Value = serde_json::from_str(&cleaned).unwrap_or(json!({
        "error": "Analyse IA indisponible",
        "raw": response
    }));

    // Sauvegarder l'analyse et le fraud_score dans le sinistre
    let fraud_score = analysis.get("fraud_score").and_then(|v| v.as_f64());
    sqlx::query(
        "UPDATE insurance_claims SET ai_analysis = $1::jsonb, fraud_score = $2, updated_at = NOW() WHERE id = $3"
    )
    .bind(&analysis)
    .bind(fraud_score)
    .bind(claim_id)
    .execute(&state.pg).await
    .map_err(|e| warn!("Erreur sauvegarde analyse IA: {}", e)).ok();

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "analysis": analysis
        })),
    ))
}

// ═══════════════════════════════════════════════════════════════
// 10. DASHBOARD STATS PARTENAIRE
// ═══════════════════════════════════════════════════════════════

/// GET /api/assurance/dashboard/stats - Stats complètes dashboard assureur
pub async fn get_dashboard_stats(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    // Produits
    let products_stats = sqlx::query(
        r#"SELECT 
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE is_active = true) as actifs,
            SUM(souscriptions_count) as total_souscriptions
        FROM insurance_products WHERE assureur_user_id = $1"#,
    )
    .bind(user_id)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur stats produits: {}", e)))?;

    // Polices
    let policies_stats = sqlx::query(
        r#"SELECT 
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE statut = 'active') as actives,
            COUNT(*) FILTER (WHERE statut = 'suspendue') as suspendues,
            COUNT(*) FILTER (WHERE statut = 'expiree') as expirees,
            COUNT(*) FILTER (WHERE date_expiration < NOW()::date AND statut = 'active') as a_renouveler,
            COALESCE(SUM(prime_totale), 0) as ca_total
        FROM insurance_policies WHERE assureur_user_id = $1"#
    ).bind(user_id).fetch_one(&state.pg).await
    .map_err(|e| AppError::Internal(format!("Erreur stats polices: {}", e)))?;

    // Sinistres
    let claims_stats = sqlx::query(
        r#"SELECT 
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE statut = 'declare') as declares,
            COUNT(*) FILTER (WHERE statut = 'en_cours_instruction') as en_instruction,
            COUNT(*) FILTER (WHERE statut IN ('expertise_demandee','expertise_en_cours')) as en_expertise,
            COUNT(*) FILTER (WHERE statut = 'approuve') as approuves,
            COUNT(*) FILTER (WHERE statut = 'indemnise') as indemnises,
            COUNT(*) FILTER (WHERE statut = 'refuse') as refuses,
            COALESCE(SUM(montant_reclame), 0) as total_reclame,
            COALESCE(SUM(montant_indemnise), 0) as total_indemnise
        FROM insurance_claims WHERE assureur_user_id = $1"#
    ).bind(user_id).fetch_one(&state.pg).await
    .map_err(|e| AppError::Internal(format!("Erreur stats sinistres: {}", e)))?;

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "products": {
                "total": products_stats.try_get::<i64, _>("total").unwrap_or(0),
                "actifs": products_stats.try_get::<i64, _>("actifs").unwrap_or(0),
                "total_souscriptions": products_stats.try_get::<i64, _>("total_souscriptions").unwrap_or(0)
            },
            "policies": {
                "total": policies_stats.try_get::<i64, _>("total").unwrap_or(0),
                "actives": policies_stats.try_get::<i64, _>("actives").unwrap_or(0),
                "suspendues": policies_stats.try_get::<i64, _>("suspendues").unwrap_or(0),
                "expirees": policies_stats.try_get::<i64, _>("expirees").unwrap_or(0),
                "a_renouveler": policies_stats.try_get::<i64, _>("a_renouveler").unwrap_or(0),
                "ca_total": policies_stats.try_get::<rust_decimal::Decimal, _>("ca_total").ok().map(|d| d.to_string())
            },
            "claims": {
                "total": claims_stats.try_get::<i64, _>("total").unwrap_or(0),
                "declares": claims_stats.try_get::<i64, _>("declares").unwrap_or(0),
                "en_instruction": claims_stats.try_get::<i64, _>("en_instruction").unwrap_or(0),
                "en_expertise": claims_stats.try_get::<i64, _>("en_expertise").unwrap_or(0),
                "approuves": claims_stats.try_get::<i64, _>("approuves").unwrap_or(0),
                "indemnises": claims_stats.try_get::<i64, _>("indemnises").unwrap_or(0),
                "refuses": claims_stats.try_get::<i64, _>("refuses").unwrap_or(0),
                "total_reclame": claims_stats.try_get::<rust_decimal::Decimal, _>("total_reclame").ok().map(|d| d.to_string()),
                "total_indemnise": claims_stats.try_get::<rust_decimal::Decimal, _>("total_indemnise").ok().map(|d| d.to_string())
            }
        })),
    ))
}
