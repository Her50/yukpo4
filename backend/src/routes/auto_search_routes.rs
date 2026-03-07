// ✅ Routes pour recherche automobile intelligente (produits véhicules)
// Recherche au niveau PRODUIT (service_products) avec filtres dynamiques extraits de la base

use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::get,
    Json, Router,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::Row;
use std::sync::Arc;

use crate::state::AppState;
use crate::utils::log::log_info;

// ===== STRUCTURES =====

#[derive(Debug, Deserialize)]
pub struct AutoFiltersQuery {
    /// Optionnel: limiter l'extraction des filtres à une zone GPS
    pub gps_lat: Option<f64>,
    pub gps_lon: Option<f64>,
    pub rayon_km: Option<i32>,
}

#[derive(Debug, Serialize)]
pub struct AutoFiltersResponse {
    pub marques: Vec<FacetItem>,
    pub types_vehicule: Vec<FacetItem>,
    pub carburants: Vec<FacetItem>,
    pub transmissions: Vec<FacetItem>,
    pub couleurs: Vec<FacetItem>,
    pub etats: Vec<FacetItem>,
    pub prix_range: PriceRange,
    pub annee_range: YearRange,
    pub total_products: i64,
}

#[derive(Debug, Serialize)]
pub struct FacetItem {
    pub label: String,
    pub count: i64,
}

#[derive(Debug, Serialize)]
pub struct PriceRange {
    pub min: Option<f64>,
    pub max: Option<f64>,
}

#[derive(Debug, Serialize)]
pub struct YearRange {
    pub min: Option<i32>,
    pub max: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct AutoSearchQuery {
    /// Recherche texte libre (marque, modèle, description...)
    pub q: Option<String>,
    /// Filtre par marque
    pub marque: Option<String>,
    /// Filtre par type de véhicule
    pub type_vehicule: Option<String>,
    /// Filtre par carburant
    pub carburant: Option<String>,
    /// Filtre par transmission
    pub transmission: Option<String>,
    /// Filtre par couleur
    pub couleur: Option<String>,
    /// Filtre par état (neuf/occasion)
    pub etat: Option<String>,
    /// Prix minimum
    pub prix_min: Option<f64>,
    /// Prix maximum
    pub prix_max: Option<f64>,
    /// Année minimum
    pub annee_min: Option<i32>,
    /// Année maximum
    pub annee_max: Option<i32>,
    /// Kilométrage maximum
    pub km_max: Option<i64>,
    /// GPS latitude
    pub gps_lat: Option<f64>,
    /// GPS longitude
    pub gps_lon: Option<f64>,
    /// Rayon en km
    pub rayon_km: Option<i32>,
    /// Tri: price_asc, price_desc, year_desc, year_asc, distance, recent
    pub sort: Option<String>,
    /// Page (0-indexed)
    pub page: Option<i32>,
    /// Nombre de résultats par page
    pub limit: Option<i32>,
}

#[derive(Debug, Serialize)]
pub struct AutoSearchResponse {
    pub products: Vec<AutoProductResult>,
    pub total: i64,
    pub page: i32,
    pub limit: i32,
    pub filters_applied: Value,
}

#[derive(Debug, Serialize)]
pub struct AutoProductResult {
    pub product_id: i32,
    pub service_id: i32,
    pub product_index: i32,
    pub nom: String,
    pub description: String,
    pub prix: Option<f64>,
    pub devise: String,
    pub marque: Option<String>,
    pub modele: Option<String>,
    pub type_vehicule: Option<String>,
    pub annee: Option<i32>,
    pub kilometrage: Option<i64>,
    pub carburant: Option<String>,
    pub transmission: Option<String>,
    pub couleur: Option<String>,
    pub etat: Option<String>,
    pub images: Vec<String>,
    pub ville: Option<String>,
    pub quartier: Option<String>,
    pub distance_km: Option<f64>,
    pub vendeur_nom: Option<String>,
    pub vendeur_user_id: Option<i32>,
    pub vendeur_telephone: Option<String>,
    pub vendeur_whatsapp: Option<String>,
    pub created_at: Option<String>,
}

// ===== HELPER: Extraire une valeur depuis product_data JSONB =====
// Les champs peuvent être sous forme {valeur: "..."} ou directement "..."
fn extract_text_field(data: &Value, field_names: &[&str]) -> Option<String> {
    for name in field_names {
        // Essayer product_data.field.valeur (format formulaire dynamique)
        if let Some(v) = data.get(name).and_then(|v| v.get("valeur")).and_then(|v| v.as_str()) {
            if !v.is_empty() {
                return Some(v.to_string());
            }
        }
        // Essayer product_data.field directement
        if let Some(v) = data.get(name).and_then(|v| v.as_str()) {
            if !v.is_empty() {
                return Some(v.to_string());
            }
        }
        // Essayer dans sous_caracteristiques
        if let Some(sc) = data.get("sous_caracteristiques") {
            if let Some(v) = sc.get(name).and_then(|v| v.as_str()) {
                if !v.is_empty() {
                    return Some(v.to_string());
                }
            }
            // sous_caracteristiques.field peut être un array avec une seule valeur
            if let Some(arr) = sc.get(name).and_then(|v| v.as_array()) {
                if let Some(first) = arr.first().and_then(|v| v.as_str()) {
                    if !first.is_empty() {
                        return Some(first.to_string());
                    }
                }
            }
        }
    }
    None
}

fn extract_number_field(data: &Value, field_names: &[&str]) -> Option<f64> {
    for name in field_names {
        if let Some(v) = data.get(name).and_then(|v| v.get("valeur")) {
            if let Some(n) = v.as_f64() {
                return Some(n);
            }
            if let Some(s) = v.as_str() {
                if let Ok(n) = s.replace(" ", "").replace(",", ".").parse::<f64>() {
                    return Some(n);
                }
            }
            // {valeur: {montant: X}}
            if let Some(m) = v.get("montant") {
                if let Some(n) = m.as_f64() {
                    return Some(n);
                }
                if let Some(s) = m.as_str() {
                    if let Ok(n) = s.replace(" ", "").replace(",", ".").parse::<f64>() {
                        return Some(n);
                    }
                }
            }
        }
        if let Some(v) = data.get(name) {
            if let Some(n) = v.as_f64() {
                return Some(n);
            }
            if let Some(n) = v.as_i64() {
                return Some(n as f64);
            }
            if let Some(s) = v.as_str() {
                if let Ok(n) = s
                    .replace(" ", "")
                    .replace(",", ".")
                    .replace("FCFA", "")
                    .replace("XAF", "")
                    .trim()
                    .parse::<f64>()
                {
                    return Some(n);
                }
            }
            if let Some(m) = v.get("montant") {
                if let Some(n) = m.as_f64() {
                    return Some(n);
                }
                if let Some(s) = m.as_str() {
                    if let Ok(n) = s.replace(" ", "").replace(",", ".").parse::<f64>() {
                        return Some(n);
                    }
                }
            }
        }
        // sous_caracteristiques
        if let Some(sc) = data.get("sous_caracteristiques") {
            if let Some(v) = sc.get(name) {
                if let Some(n) = v.as_f64() {
                    return Some(n);
                }
                if let Some(n) = v.as_i64() {
                    return Some(n as f64);
                }
                if let Some(s) = v.as_str() {
                    if let Ok(n) = s.replace(" ", "").replace(",", ".").parse::<f64>() {
                        return Some(n);
                    }
                }
            }
        }
    }
    None
}

fn extract_images(data: &Value) -> Vec<String> {
    let mut images = Vec::new();
    let fields = ["images", "photos", "image"];
    for f in &fields {
        if let Some(v) = data.get(f) {
            if let Some(arr) = v.as_array() {
                for item in arr {
                    if let Some(s) = item.as_str() {
                        if !s.is_empty() {
                            images.push(s.to_string());
                        }
                    }
                }
            } else if let Some(valeur) = v.get("valeur") {
                if let Some(arr) = valeur.as_array() {
                    for item in arr {
                        if let Some(s) = item.as_str() {
                            if !s.is_empty() {
                                images.push(s.to_string());
                            }
                        }
                    }
                }
            } else if let Some(s) = v.as_str() {
                if !s.is_empty() {
                    images.push(s.to_string());
                }
            }
        }
    }
    images
}

/// Catégories automobiles reconnues (flexible matching)
#[allow(dead_code)]
const AUTO_CATEGORIES: &[&str] = &[
    "automobile",
    "vehicule",
    "véhicule",
    "voiture",
    "moto",
    "camion",
    "auto",
    "car",
    "vehicle",
    "truck",
    "motorcycle",
    "scooter",
    "engin",
    "4x4",
    "suv",
    "pick-up",
    "pickup",
    "bus",
    "minibus",
    "transport",
    "garage",
    "concessionnaire",
    "vente vehicule",
    "vente voiture",
    "location vehicule",
    "location voiture",
    "pièces auto",
    "pieces auto",
    "accessoires auto",
];

#[allow(dead_code)]
fn is_auto_category(cat: &str) -> bool {
    let lower = cat.to_lowercase();
    AUTO_CATEGORIES.iter().any(|c| lower.contains(c))
}

// ===== HANDLERS =====

/// GET /api/auto/filters
/// Extrait dynamiquement les facettes de filtrage depuis les produits automobile existants
pub async fn get_auto_filters(
    State(state): State<Arc<AppState>>,
    Query(_query): Query<AutoFiltersQuery>,
) -> impl IntoResponse {
    log_info("[auto_search] GET /api/auto/filters called");

    let pool = &state.pg;

    // Récupérer TOUS les produits actifs dont le service ou le produit est lié à l'automobile
    // On cherche dans: services.category, services.data->>'category', product_data->>'categorie_produit',
    // product_name, product_data->>'description'
    let sql = r#"
        SELECT sp.product_data, sp.product_name, sp.product_price,
               s.category as service_category, s.data as service_data
        FROM service_products sp
        INNER JOIN services s ON s.id = sp.service_id
        WHERE sp.is_active = true AND s.is_active = true
        AND (
            -- Service category matches auto
            LOWER(COALESCE(s.category, '')) LIKE ANY(ARRAY[
                '%automobile%','%vehicule%','%véhicule%','%voiture%','%moto%','%camion%',
                '%auto%','%car%','%vehicle%','%garage%','%concessionnaire%','%pièces auto%',
                '%pieces auto%','%accessoires auto%','%4x4%','%suv%','%pick%up%','%transport%'
            ])
            OR LOWER(COALESCE(s.data->>'category', '')) LIKE ANY(ARRAY[
                '%automobile%','%vehicule%','%véhicule%','%voiture%','%moto%','%camion%',
                '%auto%','%car%','%vehicle%','%garage%','%concessionnaire%'
            ])
            -- Product category matches auto
            OR LOWER(COALESCE(sp.product_data->>'categorie_produit', '')) LIKE ANY(ARRAY[
                '%automobile%','%vehicule%','%véhicule%','%voiture%','%moto%','%camion%',
                '%auto%','%car%','%vehicle%','%4x4%','%suv%','%pick%up%'
            ])
            -- Product name suggests auto
            OR LOWER(sp.product_name) LIKE ANY(ARRAY[
                '%voiture%','%vehicule%','%véhicule%','%toyota%','%mercedes%','%bmw%',
                '%peugeot%','%renault%','%hyundai%','%kia%','%nissan%','%honda%',
                '%audi%','%volkswagen%','%ford%','%chevrolet%','%suzuki%','%mitsubishi%',
                '%moto%','%camion%','%4x4%','%suv%','%berline%','%pick-up%','%pickup%',
                '%scooter%','%bus%','%minibus%'
            ])
        )
        LIMIT 5000
    "#;

    let rows = match sqlx::query(sql).fetch_all(pool).await {
        Ok(r) => r,
        Err(e) => {
            log_info(&format!(
                "[auto_search] Error fetching auto products: {}",
                e
            ));
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": format!("{}", e)})),
            )
                .into_response();
        }
    };

    log_info(&format!(
        "[auto_search] Found {} potential auto products",
        rows.len()
    ));

    let mut marques_map: std::collections::HashMap<String, i64> = std::collections::HashMap::new();
    let mut types_map: std::collections::HashMap<String, i64> = std::collections::HashMap::new();
    let mut carburants_map: std::collections::HashMap<String, i64> =
        std::collections::HashMap::new();
    let mut transmissions_map: std::collections::HashMap<String, i64> =
        std::collections::HashMap::new();
    let mut couleurs_map: std::collections::HashMap<String, i64> = std::collections::HashMap::new();
    let mut etats_map: std::collections::HashMap<String, i64> = std::collections::HashMap::new();
    let mut prix_min: Option<f64> = None;
    let mut prix_max: Option<f64> = None;
    let mut annee_min: Option<i32> = None;
    let mut annee_max: Option<i32> = None;
    let mut total: i64 = 0;

    for row in &rows {
        let product_data: Value = row.try_get("product_data").unwrap_or(Value::Null);
        let _product_name: String = row.try_get("product_name").unwrap_or_default();

        total += 1;

        // Extraire marque
        if let Some(m) = extract_text_field(
            &product_data,
            &["marque", "brand", "constructeur", "fabricant", "make"],
        ) {
            let normalized = normalize_facet_value(&m);
            if !normalized.is_empty() && normalized.len() > 1 {
                *marques_map.entry(normalized).or_insert(0) += 1;
            }
        }

        // Extraire type véhicule
        if let Some(t) = extract_text_field(
            &product_data,
            &[
                "type_vehicule",
                "type",
                "categorie",
                "body_type",
                "carrosserie",
                "forme",
            ],
        ) {
            let normalized = normalize_facet_value(&t);
            if !normalized.is_empty() && normalized.len() > 1 {
                *types_map.entry(normalized).or_insert(0) += 1;
            }
        }

        // Extraire carburant
        if let Some(c) = extract_text_field(
            &product_data,
            &["carburant", "fuel", "energie", "motorisation", "fuel_type"],
        ) {
            let normalized = normalize_facet_value(&c);
            if !normalized.is_empty() && normalized.len() > 1 {
                *carburants_map.entry(normalized).or_insert(0) += 1;
            }
        }

        // Extraire transmission
        if let Some(t) = extract_text_field(
            &product_data,
            &["transmission", "boite", "boite_vitesse", "gearbox", "boîte"],
        ) {
            let normalized = normalize_facet_value(&t);
            if !normalized.is_empty() && normalized.len() > 1 {
                *transmissions_map.entry(normalized).or_insert(0) += 1;
            }
        }

        // Extraire couleur
        if let Some(c) =
            extract_text_field(&product_data, &["couleur", "color", "colour", "teinte"])
        {
            let normalized = normalize_facet_value(&c);
            if !normalized.is_empty() && normalized.len() > 1 {
                *couleurs_map.entry(normalized).or_insert(0) += 1;
            }
        }

        // Extraire état
        if let Some(e) = extract_text_field(
            &product_data,
            &["etat", "état", "condition", "neuf_occasion", "state"],
        ) {
            let normalized = normalize_facet_value(&e);
            if !normalized.is_empty() {
                *etats_map.entry(normalized).or_insert(0) += 1;
            }
        }

        // Extraire prix
        if let Some(p) =
            extract_number_field(&product_data, &["prix", "price", "montant", "cout", "coût"])
        {
            if p > 0.0 && p < 1_000_000_000.0 {
                prix_min = Some(prix_min.map_or(p, |m: f64| m.min(p)));
                prix_max = Some(prix_max.map_or(p, |m: f64| m.max(p)));
            }
        }

        // Extraire année
        if let Some(a) = extract_number_field(
            &product_data,
            &["annee", "année", "year", "annee_fabrication", "model_year"],
        ) {
            let year = a as i32;
            if year >= 1950 && year <= 2030 {
                annee_min = Some(annee_min.map_or(year, |m: i32| m.min(year)));
                annee_max = Some(annee_max.map_or(year, |m: i32| m.max(year)));
            }
        }
    }

    // Convertir en vecteurs triés par count DESC
    let to_facet_vec = |map: std::collections::HashMap<String, i64>| -> Vec<FacetItem> {
        let mut v: Vec<FacetItem> =
            map.into_iter().map(|(k, c)| FacetItem { label: k, count: c }).collect();
        v.sort_by(|a, b| b.count.cmp(&a.count));
        v
    };

    let response = AutoFiltersResponse {
        marques: to_facet_vec(marques_map),
        types_vehicule: to_facet_vec(types_map),
        carburants: to_facet_vec(carburants_map),
        transmissions: to_facet_vec(transmissions_map),
        couleurs: to_facet_vec(couleurs_map),
        etats: to_facet_vec(etats_map),
        prix_range: PriceRange {
            min: prix_min,
            max: prix_max,
        },
        annee_range: YearRange {
            min: annee_min,
            max: annee_max,
        },
        total_products: total,
    };

    (StatusCode::OK, Json(json!(response))).into_response()
}

/// GET /api/auto/search
/// Recherche produits automobile avec filtres, tri, pagination et GPS
pub async fn search_auto_products(
    State(state): State<Arc<AppState>>,
    Query(query): Query<AutoSearchQuery>,
) -> impl IntoResponse {
    log_info(&format!(
        "[auto_search] GET /api/auto/search q={:?} marque={:?} type={:?}",
        query.q, query.marque, query.type_vehicule
    ));

    let pool = &state.pg;
    let page = query.page.unwrap_or(0).max(0);
    let limit = query.limit.unwrap_or(30).min(100).max(1);
    let offset = page * limit;

    // Construction dynamique de la requête SQL
    let mut conditions = Vec::new();
    let mut params: Vec<String> = Vec::new();
    let mut param_idx = 0usize;

    // Base: produits actifs de services actifs + catégorie automobile
    let base_auto_filter = r#"
        sp.is_active = true AND s.is_active = true
        AND (
            LOWER(COALESCE(s.category, '')) LIKE ANY(ARRAY[
                '%automobile%','%vehicule%','%véhicule%','%voiture%','%moto%','%camion%',
                '%auto%','%car%','%vehicle%','%garage%','%concessionnaire%','%pièces auto%',
                '%pieces auto%','%accessoires auto%','%4x4%','%suv%','%pick%up%','%transport%'
            ])
            OR LOWER(COALESCE(s.data->>'category', '')) LIKE ANY(ARRAY[
                '%automobile%','%vehicule%','%véhicule%','%voiture%','%moto%','%camion%',
                '%auto%','%car%','%vehicle%','%garage%','%concessionnaire%'
            ])
            OR LOWER(COALESCE(sp.product_data->>'categorie_produit', '')) LIKE ANY(ARRAY[
                '%automobile%','%vehicule%','%véhicule%','%voiture%','%moto%','%camion%',
                '%auto%','%car%','%vehicle%','%4x4%','%suv%','%pick%up%'
            ])
            OR LOWER(sp.product_name) LIKE ANY(ARRAY[
                '%voiture%','%vehicule%','%véhicule%','%toyota%','%mercedes%','%bmw%',
                '%peugeot%','%renault%','%hyundai%','%kia%','%nissan%','%honda%',
                '%audi%','%volkswagen%','%ford%','%chevrolet%','%suzuki%','%mitsubishi%',
                '%moto%','%camion%','%4x4%','%suv%','%berline%','%pick-up%','%pickup%',
                '%scooter%','%bus%','%minibus%'
            ])
        )
    "#;

    // Recherche texte libre
    if let Some(ref q) = query.q {
        let q_trimmed = q.trim();
        if !q_trimmed.is_empty() {
            param_idx += 1;
            params.push(q_trimmed.to_lowercase());
            conditions.push(format!(
                r#"(
                    unaccent(LOWER(sp.product_name)) ILIKE '%' || unaccent(${}::text) || '%'
                    OR unaccent(LOWER(COALESCE(sp.product_data->>'description', sp.product_data->>'description_produit', sp.product_data->'description'->>'valeur', ''))) ILIKE '%' || unaccent(${}::text) || '%'
                    OR EXISTS (
                        SELECT 1 FROM jsonb_each_text(COALESCE(sp.product_data->'sous_caracteristiques', '{{}}')) AS sc
                        WHERE unaccent(LOWER(sc.value)) ILIKE '%' || unaccent(${}::text) || '%'
                    )
                )"#,
                param_idx, param_idx, param_idx
            ));
        }
    }

    // Filtre marque - recherche dans product_data JSONB
    if let Some(ref marque) = query.marque {
        if !marque.trim().is_empty() {
            param_idx += 1;
            params.push(marque.trim().to_lowercase());
            conditions.push(format!(
                r#"(
                    unaccent(LOWER(COALESCE(
                        sp.product_data->'marque'->>'valeur',
                        sp.product_data->>'marque',
                        sp.product_data->'sous_caracteristiques'->>'marque',
                        sp.product_data->'brand'->>'valeur',
                        sp.product_data->>'brand',
                        ''
                    ))) ILIKE '%' || unaccent(${}::text) || '%'
                    OR unaccent(LOWER(sp.product_name)) ILIKE '%' || unaccent(${}::text) || '%'
                )"#,
                param_idx, param_idx
            ));
        }
    }

    // Filtre type véhicule
    if let Some(ref type_v) = query.type_vehicule {
        if !type_v.trim().is_empty() {
            param_idx += 1;
            params.push(type_v.trim().to_lowercase());
            conditions.push(format!(
                r#"(
                    unaccent(LOWER(COALESCE(
                        sp.product_data->'type_vehicule'->>'valeur',
                        sp.product_data->>'type_vehicule',
                        sp.product_data->'type'->>'valeur',
                        sp.product_data->>'type',
                        sp.product_data->'sous_caracteristiques'->>'type_vehicule',
                        sp.product_data->'sous_caracteristiques'->>'type',
                        sp.product_data->'carrosserie'->>'valeur',
                        sp.product_data->>'carrosserie',
                        ''
                    ))) ILIKE '%' || unaccent(${}::text) || '%'
                )"#,
                param_idx
            ));
        }
    }

    // Filtre carburant
    if let Some(ref carburant) = query.carburant {
        if !carburant.trim().is_empty() {
            param_idx += 1;
            params.push(carburant.trim().to_lowercase());
            conditions.push(format!(
                r#"(
                    unaccent(LOWER(COALESCE(
                        sp.product_data->'carburant'->>'valeur',
                        sp.product_data->>'carburant',
                        sp.product_data->'fuel'->>'valeur',
                        sp.product_data->>'fuel',
                        sp.product_data->'sous_caracteristiques'->>'carburant',
                        sp.product_data->'energie'->>'valeur',
                        sp.product_data->>'energie',
                        ''
                    ))) ILIKE '%' || unaccent(${}::text) || '%'
                )"#,
                param_idx
            ));
        }
    }

    // Filtre transmission
    if let Some(ref transmission) = query.transmission {
        if !transmission.trim().is_empty() {
            param_idx += 1;
            params.push(transmission.trim().to_lowercase());
            conditions.push(format!(
                r#"(
                    unaccent(LOWER(COALESCE(
                        sp.product_data->'transmission'->>'valeur',
                        sp.product_data->>'transmission',
                        sp.product_data->'boite'->>'valeur',
                        sp.product_data->>'boite',
                        sp.product_data->'sous_caracteristiques'->>'transmission',
                        sp.product_data->'sous_caracteristiques'->>'boite',
                        ''
                    ))) ILIKE '%' || unaccent(${}::text) || '%'
                )"#,
                param_idx
            ));
        }
    }

    // Filtre couleur
    if let Some(ref couleur) = query.couleur {
        if !couleur.trim().is_empty() {
            param_idx += 1;
            params.push(couleur.trim().to_lowercase());
            conditions.push(format!(
                r#"(
                    unaccent(LOWER(COALESCE(
                        sp.product_data->'couleur'->>'valeur',
                        sp.product_data->>'couleur',
                        sp.product_data->'color'->>'valeur',
                        sp.product_data->>'color',
                        sp.product_data->'sous_caracteristiques'->>'couleur',
                        ''
                    ))) ILIKE '%' || unaccent(${}::text) || '%'
                )"#,
                param_idx
            ));
        }
    }

    // Filtre état (neuf/occasion)
    if let Some(ref etat) = query.etat {
        if !etat.trim().is_empty() {
            param_idx += 1;
            params.push(etat.trim().to_lowercase());
            conditions.push(format!(
                r#"(
                    unaccent(LOWER(COALESCE(
                        sp.product_data->'etat'->>'valeur',
                        sp.product_data->>'etat',
                        sp.product_data->'état'->>'valeur',
                        sp.product_data->>'état',
                        sp.product_data->'condition'->>'valeur',
                        sp.product_data->>'condition',
                        sp.product_data->'sous_caracteristiques'->>'etat',
                        sp.product_data->'sous_caracteristiques'->>'état',
                        ''
                    ))) ILIKE '%' || unaccent(${}::text) || '%'
                )"#,
                param_idx
            ));
        }
    }

    // Filtre prix
    if let Some(prix_min) = query.prix_min {
        conditions.push(format!(r#"COALESCE(sp.product_price, 0) >= {}"#, prix_min));
    }
    if let Some(prix_max) = query.prix_max {
        conditions.push(format!(
            r#"COALESCE(sp.product_price, 99999999999) <= {}"#,
            prix_max
        ));
    }

    // Filtre année
    if let Some(annee_min) = query.annee_min {
        param_idx += 1;
        params.push(annee_min.to_string());
        conditions.push(format!(
            r#"(
                COALESCE(
                    (sp.product_data->'annee'->>'valeur')::INT,
                    (sp.product_data->>'annee')::INT,
                    (sp.product_data->'année'->>'valeur')::INT,
                    (sp.product_data->>'année')::INT,
                    (sp.product_data->'year'->>'valeur')::INT,
                    (sp.product_data->>'year')::INT,
                    (sp.product_data->'sous_caracteristiques'->>'annee')::INT,
                    0
                ) >= ${}::INT OR COALESCE(
                    (sp.product_data->'annee'->>'valeur')::INT,
                    (sp.product_data->>'annee')::INT,
                    0
                ) = 0
            )"#,
            param_idx
        ));
    }
    if let Some(annee_max) = query.annee_max {
        param_idx += 1;
        params.push(annee_max.to_string());
        conditions.push(format!(
            r#"(
                COALESCE(
                    (sp.product_data->'annee'->>'valeur')::INT,
                    (sp.product_data->>'annee')::INT,
                    (sp.product_data->'année'->>'valeur')::INT,
                    (sp.product_data->>'année')::INT,
                    (sp.product_data->'year'->>'valeur')::INT,
                    (sp.product_data->>'year')::INT,
                    (sp.product_data->'sous_caracteristiques'->>'annee')::INT,
                    9999
                ) <= ${}::INT OR COALESCE(
                    (sp.product_data->'annee'->>'valeur')::INT,
                    (sp.product_data->>'annee')::INT,
                    9999
                ) = 9999
            )"#,
            param_idx
        ));
    }

    // Kilométrage max
    if let Some(km_max) = query.km_max {
        conditions.push(format!(
            r#"COALESCE(
                (sp.product_data->'kilometrage'->>'valeur')::BIGINT,
                (sp.product_data->>'kilometrage')::BIGINT,
                (sp.product_data->'km'->>'valeur')::BIGINT,
                (sp.product_data->>'km')::BIGINT,
                (sp.product_data->'sous_caracteristiques'->>'kilometrage')::BIGINT,
                0
            ) <= {} OR COALESCE(
                (sp.product_data->'kilometrage'->>'valeur')::BIGINT,
                (sp.product_data->>'kilometrage')::BIGINT,
                0
            ) = 0"#,
            km_max
        ));
    }

    // GPS distance
    let distance_select = if let (Some(lat), Some(lon)) = (query.gps_lat, query.gps_lon) {
        let rayon = query.rayon_km.unwrap_or(50) as f64;
        // Calculer la distance via haversine depuis le GPS du service
        let distance_expr = format!(
            r#"(
                6371 * acos(
                    LEAST(1.0, GREATEST(-1.0,
                        cos(radians({})) * cos(radians(
                            COALESCE(
                                (regexp_match(COALESCE(s.gps, ''), '([-]?[0-9]+\.[0-9]+)'))[1]::FLOAT,
                                0
                            )
                        )) *
                        cos(radians(
                            COALESCE(
                                (regexp_match(COALESCE(s.gps, ''), '[,;]\s*([-]?[0-9]+\.[0-9]+)'))[1]::FLOAT,
                                0
                            )
                        ) - radians({})) +
                        sin(radians({})) * sin(radians(
                            COALESCE(
                                (regexp_match(COALESCE(s.gps, ''), '([-]?[0-9]+\.[0-9]+)'))[1]::FLOAT,
                                0
                            )
                        ))
                    ))
                )
            )"#,
            lat, lon, lat
        );

        // Filtre par rayon si GPS fourni
        conditions.push(format!(
            "({} < {} OR s.gps IS NULL OR s.gps = '')",
            distance_expr, rayon
        ));

        format!("{} as distance_km", distance_expr)
    } else {
        "NULL::FLOAT as distance_km".to_string()
    };

    // Construire la requête SQL complète
    let where_clause = if conditions.is_empty() {
        base_auto_filter.to_string()
    } else {
        format!("{} AND {}", base_auto_filter, conditions.join(" AND "))
    };

    // Tri
    let order_by = match query.sort.as_deref() {
        Some("price_asc") => "COALESCE(sp.product_price, 99999999) ASC",
        Some("price_desc") => "COALESCE(sp.product_price, 0) DESC",
        Some("year_desc") => "COALESCE((sp.product_data->>'annee')::INT, (sp.product_data->'annee'->>'valeur')::INT, 0) DESC",
        Some("year_asc") => "COALESCE((sp.product_data->>'annee')::INT, (sp.product_data->'annee'->>'valeur')::INT, 9999) ASC",
        Some("distance") if query.gps_lat.is_some() => "distance_km ASC NULLS LAST",
        _ => "sp.created_at DESC", // recent par défaut
    };

    // Count total
    let count_sql = format!(
        r#"SELECT COUNT(*) as total
        FROM service_products sp
        INNER JOIN services s ON s.id = sp.service_id
        WHERE {}"#,
        where_clause
    );

    // Requête données
    let data_sql = format!(
        r#"SELECT 
            sp.id as product_id,
            sp.service_id,
            sp.product_index,
            sp.product_name,
            sp.product_price,
            sp.product_data,
            sp.created_at,
            s.data as service_data,
            s.gps as service_gps,
            s.user_id,
            u.phone as vendeur_phone,
            {},
            u.name as vendeur_nom
        FROM service_products sp
        INNER JOIN services s ON s.id = sp.service_id
        LEFT JOIN users u ON u.id = s.user_id
        WHERE {}
        ORDER BY {}
        LIMIT {} OFFSET {}"#,
        distance_select, where_clause, order_by, limit, offset
    );

    // Exécuter count
    let mut count_query = sqlx::query(&count_sql);
    for p in &params {
        count_query = count_query.bind(p);
    }
    let total: i64 = match count_query.fetch_one(pool).await {
        Ok(row) => row.try_get("total").unwrap_or(0),
        Err(e) => {
            log_info(&format!("[auto_search] Count error: {}", e));
            0
        }
    };

    // Exécuter recherche
    let mut data_query = sqlx::query(&data_sql);
    for p in &params {
        data_query = data_query.bind(p);
    }
    let rows = match data_query.fetch_all(pool).await {
        Ok(r) => r,
        Err(e) => {
            log_info(&format!("[auto_search] Search error: {}", e));
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": format!("{}", e)})),
            )
                .into_response();
        }
    };

    log_info(&format!(
        "[auto_search] Found {} products (total: {})",
        rows.len(),
        total
    ));

    // Transformer les résultats
    let mut products: Vec<AutoProductResult> = Vec::new();

    for row in &rows {
        let product_data: Value = row.try_get("product_data").unwrap_or(Value::Null);
        let service_data: Value = row.try_get("service_data").unwrap_or(Value::Null);
        let product_name: String = row.try_get("product_name").unwrap_or_default();
        let product_price: Option<rust_decimal::Decimal> =
            row.try_get("product_price").unwrap_or(None);

        // Extraire les champs
        let nom = if product_name == "Produit sans nom" {
            extract_text_field(
                &product_data,
                &["nom", "nom_produit", "titre", "title", "name"],
            )
            .unwrap_or(product_name)
        } else {
            product_name
        };

        let description = extract_text_field(
            &product_data,
            &["description", "description_produit", "details"],
        )
        .unwrap_or_default();
        let prix = product_price
            .map(|d| d.to_string().parse::<f64>().unwrap_or(0.0))
            .or_else(|| extract_number_field(&product_data, &["prix", "price", "montant"]));
        let devise = extract_text_field(&product_data, &["devise", "currency"])
            .unwrap_or_else(|| "FCFA".to_string());

        let marque =
            extract_text_field(&product_data, &["marque", "brand", "constructeur", "make"]);
        let modele = extract_text_field(&product_data, &["modele", "modèle", "model"]);
        let type_vehicule = extract_text_field(
            &product_data,
            &["type_vehicule", "type", "carrosserie", "body_type"],
        );
        let annee =
            extract_number_field(&product_data, &["annee", "année", "year"]).map(|a| a as i32);
        let kilometrage = extract_number_field(&product_data, &["kilometrage", "km", "mileage"])
            .map(|k| k as i64);
        let carburant = extract_text_field(&product_data, &["carburant", "fuel", "energie"]);
        let transmission = extract_text_field(
            &product_data,
            &["transmission", "boite", "boite_vitesse", "gearbox"],
        );
        let couleur = extract_text_field(&product_data, &["couleur", "color", "colour"]);
        let etat = extract_text_field(
            &product_data,
            &["etat", "état", "condition", "neuf_occasion"],
        );

        let images = extract_images(&product_data);

        let ville = extract_text_field(&service_data, &["ville", "city"])
            .or_else(|| extract_text_field(&product_data, &["ville", "city", "localisation"]));
        let quartier = extract_text_field(&service_data, &["quartier", "district"])
            .or_else(|| extract_text_field(&product_data, &["quartier", "district"]));

        let distance_km: Option<f64> = row.try_get("distance_km").unwrap_or(None);
        let vendeur_nom: Option<String> = row.try_get("vendeur_nom").unwrap_or(None);
        let vendeur_user_id: Option<i32> = row.try_get("user_id").unwrap_or(None);
        let vendeur_phone: Option<String> = row.try_get("vendeur_phone").unwrap_or(None);

        // Extraire téléphone/whatsapp depuis service_data (prioritaire) ou users.phone (fallback)
        let vendeur_telephone = extract_text_field(&service_data, &["telephone", "phone", "tel"])
            .or_else(|| vendeur_phone.clone());
        let vendeur_whatsapp = extract_text_field(&service_data, &["whatsapp", "whatsapp_number"])
            .or_else(|| vendeur_phone.clone());

        let created_at: Option<chrono::DateTime<chrono::Utc>> =
            row.try_get("created_at").unwrap_or(None);

        products.push(AutoProductResult {
            product_id: row.try_get("product_id").unwrap_or(0),
            service_id: row.try_get("service_id").unwrap_or(0),
            product_index: row.try_get("product_index").unwrap_or(0),
            nom,
            description,
            prix,
            devise,
            marque,
            modele,
            type_vehicule,
            annee,
            kilometrage,
            carburant,
            transmission,
            couleur,
            etat,
            images,
            ville,
            quartier,
            distance_km,
            vendeur_nom,
            vendeur_user_id,
            vendeur_telephone,
            vendeur_whatsapp,
            created_at: created_at.map(|d| d.to_rfc3339()),
        });
    }

    let filters_applied = json!({
        "q": query.q,
        "marque": query.marque,
        "type_vehicule": query.type_vehicule,
        "carburant": query.carburant,
        "transmission": query.transmission,
        "couleur": query.couleur,
        "etat": query.etat,
        "prix_min": query.prix_min,
        "prix_max": query.prix_max,
        "annee_min": query.annee_min,
        "annee_max": query.annee_max,
        "km_max": query.km_max,
        "sort": query.sort,
    });

    let response = AutoSearchResponse {
        products,
        total,
        page,
        limit,
        filters_applied,
    };

    (StatusCode::OK, Json(json!(response))).into_response()
}

/// Normalise une valeur de facette (première lettre majuscule, trim)
fn normalize_facet_value(s: &str) -> String {
    let trimmed = s.trim();
    if trimmed.is_empty() {
        return String::new();
    }
    let lower = trimmed.to_lowercase();
    // Capitalize first letter
    let mut chars = lower.chars();
    match chars.next() {
        None => String::new(),
        Some(f) => f.to_uppercase().collect::<String>() + chars.as_str(),
    }
}

// ===== ROUTES =====

pub fn auto_search_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .route("/api/auto/filters", get(get_auto_filters))
        .route("/api/auto/search", get(search_auto_products))
        .with_state(state)
}
