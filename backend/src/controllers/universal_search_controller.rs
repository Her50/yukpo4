//! ✅ 2026-04-01: Recherche Universelle Cross-Services
//!
//! Endpoint unique qui recherche dans TOUTES les sources de données de Yukpo :
//! - service_products         → Produits supermarché / e-commerce / pharmacie
//! - restaurant_menu_items    → Menus et plats de restaurants
//! - services (avec category) → Services spécialisés (transport, santé, immobilier, etc.)
//!
//! Chaque résultat contient un champ `deep_link` avec le nom de l'écran mobile
//! et les paramètres de navigation pour orienter l'utilisateur directement.
//!
//! GET /api/search/universal?q=...&lat=...&lng=...&limit=...&categories=...

use crate::core::types::{AppError, AppResult};
use crate::state::AppState;
use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use log::error;
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::Row;
use std::sync::Arc;

#[derive(Debug, Deserialize)]
pub struct UniversalSearchQuery {
    pub q: String,
    pub lat: Option<f64>,
    pub lng: Option<f64>,
    pub radius_km: Option<f64>,
    pub limit: Option<i32>,
    pub page: Option<i32>,
    /// Filtrer par catégories séparées par virgule : "supermarche,restaurant,pharmacie,transport"
    pub categories: Option<String>,
}

// ─── Description enrichie selon le type de service ──────────────────────────

/// Extrait les caractéristiques clés d'un produit JSONB selon sa catégorie
/// et les formate en une description courte (1 ligne) pour la carte.
fn enrich_product_description(
    data: &Value,
    category: &str,
    fallback: Option<&str>,
) -> Option<String> {
    let s = |key: &str| -> Option<&str> {
        data.get(key).and_then(|v| v.as_str()).filter(|s| !s.is_empty())
    };

    let parts: Vec<&str> = match category {
        // Véhicule : marque · modèle · année · transmission · carburant
        "auto" | "automobile" | "garage" | "location_vehicule" | "vente_vehicule" => [
            s("marque"),
            s("modele"),
            s("annee"),
            s("transmission"),
            s("carburant"),
        ]
        .into_iter()
        .flatten()
        .collect(),
        // Pharmacie : forme · dosage · sur ordonnance
        "pharmacie" => {
            let mut v: Vec<&str> = [s("forme"), s("dosage")].into_iter().flatten().collect();
            if data.get("sur_ordonnance").and_then(|v| v.as_bool()).unwrap_or(false) {
                v.push("Sur ordonnance");
            }
            v
        }
        // Restaurant/menu : catégorie du plat · allergènes
        "restaurant" => [s("categorie"), s("allergenes")].into_iter().flatten().collect(),
        // Hôtel/hébergement : type chambre · équipements
        "hotel" | "meuble" | "hebergement" => {
            [s("type_chambre"), s("equipements")].into_iter().flatten().collect()
        }
        // Hôpital/clinique : spécialités
        "hopital" | "sante" | "clinique" => {
            [s("specialites"), s("services_disponibles")].into_iter().flatten().collect()
        }
        // Laboratoire : types analyses
        "laboratoire" => [s("types_analyses"), s("services")].into_iter().flatten().collect(),
        // Immobilier : type bien · surface · nb pièces
        "immobilier" => {
            [s("type_bien"), s("surface"), s("nb_pieces")].into_iter().flatten().collect()
        }
        // Emploi : contrat · lieu · secteur
        "emploi" => [s("type_contrat"), s("lieu"), s("secteur")].into_iter().flatten().collect(),
        // Transport/Bus : origine → destination
        "transport" | "agence_voyage" | "bus" => {
            [s("origine"), s("destination")].into_iter().flatten().collect()
        }
        // Gym/Sport : disciplines · horaires
        "gym" | "sport" | "fitness" => {
            [s("disciplines"), s("horaires")].into_iter().flatten().collect()
        }
        // Spa/beauté : prestations
        "spa" | "beaute" | "coiffure" => {
            [s("prestations"), s("services")].into_iter().flatten().collect()
        }
        // Assurance : type couverture
        "assurance" => [s("type_couverture"), s("garanties")].into_iter().flatten().collect(),
        // Librairie : auteur · niveau · matière
        "librairie" => [s("auteur"), s("niveau"), s("matiere")].into_iter().flatten().collect(),
        _ => vec![],
    };

    if !parts.is_empty() {
        Some(parts.join(" · "))
    } else {
        // Fallback : description générique tronquée
        fallback.map(|d| {
            let d = d.trim();
            if d.len() > 80 {
                format!("{}…", &d[..77])
            } else {
                d.to_string()
            }
        })
    }
}

/// Extrait une description courte pour un service spécialisé (table `services`)
fn enrich_service_description(data: &Value, category: &str) -> Option<String> {
    enrich_product_description(
        data,
        category,
        data.get("description").and_then(|v| v.as_str()),
    )
}

// ─── Deep-link mapping : category → écran mobile + params ───────────────────

fn deep_link_for_product(
    service_id: i32,
    store_category: Option<&str>,
    product_type: Option<&str>,
) -> Value {
    // La location et la vente de véhicules sont des produits normaux (store_category = "auto"/"automobile")
    // On les oriente vers AutoServicesSearch avec un filtre contextuel
    match store_category.unwrap_or("supermarche") {
        "pharmacie" => json!({
            "screen": "PharmacieSearchPage",
            "params": { "service_id": service_id }
        }),
        "auto" | "automobile" | "location_vehicule" | "vente_vehicule" | "garage" => {
            // Distinguer location vs vente selon product_type ou store_category
            let mode = if store_category == Some("location_vehicule")
                || product_type.map(|t| t.contains("location")).unwrap_or(false)
            {
                "location"
            } else {
                "vente"
            };
            json!({
                "screen": "AutoServicesSearch",
                "params": { "service_id": service_id, "mode": mode, "store_category": store_category }
            })
        }
        cat if cat.starts_with("mode")
            || cat == "electronique"
            || cat == "ecommerce"
            || cat == "sport"
            || cat == "maison"
            || cat == "autres" =>
        {
            json!({
                "screen": "EcommerceHub",
                "params": { "service_id": service_id, "store_category": cat }
            })
        }
        _ => json!({
            "screen": "SupermarketHome",
            "params": { "service_id": service_id }
        }),
    }
}

fn deep_link_for_menu(service_id: i32) -> Value {
    json!({
        "screen": "RestaurantClient",
        "params": { "service_id": service_id }
    })
}

fn deep_link_for_service(service_id: i32, category: &str, specialized_type: Option<&str>) -> Value {
    let screen = match category {
        "restaurant" => "RestaurantClient",
        "supermarche" => "SupermarketHome",
        "ecommerce" => "EcommerceHub",
        "pharmacie" => "PharmacieSearchPage",
        "hopital" | "sante" | "clinique" => "HopitalSearchScreen",
        "laboratoire" => "LaboratoireSearchScreen",
        "transport" | "agence_voyage" => {
            if specialized_type == Some("bus") {
                "BusSearchScreen"
            } else {
                "TransportScreen"
            }
        }
        "taxi" => "TaxiScreen",
        "covoiturage" => "CovoiturageSearchScreen",
        "hotel" | "meuble" | "hebergement" => "HotelSearchScreen",
        "immobilier" => "ImmobilierSearchScreen",
        "assurance" => "AssuranceScreen",
        "emploi" => "EmploiScreen",
        "veterinaire" => "VeterinaireScreen",
        "gym" | "sport" | "fitness" => "GymScreen",
        "spa" | "beaute" | "coiffure" => "SpaScreen",
        "auto" | "automobile" | "garage" | "location_vehicule" | "vente_vehicule" => {
            "AutoServicesSearch"
        }
        "librairie" => "LibrairieScreen",
        _ => "ResultatBesoin",
    };

    // Pour l'auto, on passe un filtre de mode (location vs vente) selon le specialized_type
    let params = match category {
        "location_vehicule" => {
            json!({ "service_id": service_id, "category": category, "mode": "location" })
        }
        "vente_vehicule" => {
            json!({ "service_id": service_id, "category": category, "mode": "vente" })
        }
        "auto" | "automobile" | "garage" => {
            let mode = specialized_type
                .map(|t| {
                    if t.contains("location") {
                        "location"
                    } else {
                        "vente"
                    }
                })
                .unwrap_or("vente");
            json!({ "service_id": service_id, "category": category, "mode": mode })
        }
        _ => json!({ "service_id": service_id, "category": category }),
    };

    json!({ "screen": screen, "params": params })
}

fn category_label(category: &str) -> &'static str {
    match category {
        "supermarche" => "Supermarché",
        "restaurant" => "Restaurant",
        "pharmacie" => "Pharmacie",
        "ecommerce" => "E-Commerce",
        "hopital" | "sante" | "clinique" => "Santé",
        "laboratoire" => "Laboratoire",
        "transport" | "agence_voyage" | "bus" => "Transport",
        "taxi" => "Taxi",
        "covoiturage" => "Covoiturage",
        "hotel" | "meuble" | "hebergement" => "Hébergement",
        "immobilier" => "Immobilier",
        "assurance" => "Assurance",
        "emploi" => "Emploi",
        "veterinaire" => "Vétérinaire",
        "gym" | "sport" | "fitness" => "Sport & Fitness",
        "spa" | "beaute" | "coiffure" => "Beauté & Spa",
        "auto" | "automobile" | "garage" => "Automobile",
        "location_vehicule" => "Location de Véhicule",
        "vente_vehicule" => "Vente de Véhicule",
        "librairie" => "Librairie",
        _ => "Service",
    }
}

fn category_icon(category: &str) -> &'static str {
    match category {
        "supermarche" => "cart",
        "restaurant" => "restaurant",
        "pharmacie" => "medkit",
        "ecommerce" => "storefront",
        "hopital" | "sante" | "clinique" => "heart",
        "laboratoire" => "flask",
        "transport" | "agence_voyage" | "bus" => "bus",
        "taxi" => "car",
        "covoiturage" => "people",
        "hotel" | "meuble" | "hebergement" => "bed",
        "immobilier" => "home",
        "assurance" => "shield",
        "emploi" => "briefcase",
        "veterinaire" => "paw",
        "gym" | "sport" | "fitness" => "barbell",
        "spa" | "beaute" | "coiffure" => "sparkles",
        "auto" | "automobile" | "garage" => "settings",
        "location_vehicule" => "key",
        "vente_vehicule" => "car",
        "librairie" => "book",
        _ => "search",
    }
}

// ─── Utilitaire GPS distance (Haversine approx.) ────────────────────────────

fn haversine_km(lat1: f64, lng1: f64, lat2: f64, lng2: f64) -> f64 {
    let r = 6371.0_f64;
    let dlat = (lat2 - lat1).to_radians();
    let dlng = (lng2 - lng1).to_radians();
    let a = (dlat / 2.0).sin().powi(2)
        + lat1.to_radians().cos() * lat2.to_radians().cos() * (dlng / 2.0).sin().powi(2);
    2.0 * r * a.sqrt().atan2((1.0 - a).sqrt())
}

fn parse_gps(gps: &str) -> Option<(f64, f64)> {
    let parts: Vec<&str> = gps.split(',').collect();
    if parts.len() < 2 {
        return None;
    }
    let lat = parts[0].trim().parse::<f64>().ok()?;
    let lng = parts[1].trim().parse::<f64>().ok()?;
    Some((lat, lng))
}

// ─── Endpoint principal ──────────────────────────────────────────────────────

/// GET /api/search/universal
pub async fn universal_search(
    State(state): State<Arc<AppState>>,
    Query(params): Query<UniversalSearchQuery>,
) -> AppResult<impl IntoResponse> {
    let q = params.q.trim().to_string();
    if q.is_empty() {
        return Err(AppError::BadRequest("Paramètre 'q' requis".to_string()));
    }

    let search_pattern = format!("%{}%", q.to_lowercase());
    let limit = params.limit.unwrap_or(30).min(100) as i64;
    let offset = ((params.page.unwrap_or(1) - 1) * params.limit.unwrap_or(30)) as i64;
    let radius = params.radius_km.unwrap_or(50.0);

    // Filtres catégories optionnels
    let cat_filter: Option<Vec<String>> = params.categories.as_ref().map(|c| {
        c.split(',')
            .map(|s| s.trim().to_lowercase())
            .filter(|s| !s.is_empty())
            .collect()
    });

    let mut results: Vec<Value> = Vec::new();

    // ══════════════════════════════════════════════════════════════
    // 1. service_products (supermarché / e-commerce / pharmacie / mode)
    // ══════════════════════════════════════════════════════════════
    let include_products = cat_filter.as_ref().map_or(true, |cats| {
        cats.iter().any(|c| {
            matches!(
                c.as_str(),
                "supermarche"
                    | "ecommerce"
                    | "pharmacie"
                    | "mode"
                    | "electronique"
                    | "sport"
                    | "maison"
                    | "auto"
                    | "automobile"
                    | "location_vehicule"
                    | "vente_vehicule"
                    | "garage"
            )
        })
    });

    if include_products {
        let product_rows = sqlx::query(
            r#"
            SELECT sp.id, sp.service_id, sp.product_index, sp.product_name,
                   sp.product_price, sp.product_data, sp.store_category, sp.product_type,
                   s.data->>'nom'      AS service_nom,
                   s.data->>'adresse'  AS service_adresse,
                   COALESCE(s.gps, s.data->>'gps') AS service_gps,
                   s.category
            FROM service_products sp
            INNER JOIN services s ON s.id = sp.service_id AND s.is_active = true
            WHERE sp.is_active = true
              AND (
                    LOWER(sp.product_name) LIKE $1
                 OR LOWER(sp.product_data->>'description') LIKE $1
                 OR LOWER(sp.product_data->>'categorie') LIKE $1
                 OR LOWER(sp.product_data->>'marque') LIKE $1
                 OR LOWER(sp.product_data->>'modele') LIKE $1
                 OR LOWER(sp.product_data->>'type_vehicule') LIKE $1
              )
            ORDER BY sp.product_price ASC NULLS LAST
            LIMIT $2 OFFSET $3
            "#,
        )
        .bind(&search_pattern)
        .bind(limit / 2)
        .bind(offset)
        .fetch_all(&state.pg)
        .await
        .unwrap_or_default();

        for row in &product_rows {
            let service_id: i32 = row.try_get("service_id").unwrap_or_default();
            let data: Value = row.try_get("product_data").unwrap_or(json!({}));
            let store_cat: Option<String> = row.try_get("store_category").ok().flatten();
            let service_cat: Option<String> = row.try_get("category").ok().flatten();
            let product_type_val: Option<String> = row.try_get("product_type").ok().flatten();
            let effective_cat =
                store_cat.as_deref().or(service_cat.as_deref()).unwrap_or("supermarche");

            let prix: Option<f64> = row
                .try_get::<Option<rust_decimal::Decimal>, _>("product_price")
                .ok()
                .flatten()
                .and_then(|d| d.to_string().parse().ok());

            let gps_str: Option<String> = row.try_get("service_gps").ok().flatten();
            let distance_km = params.lat.zip(params.lng).and_then(|(ulat, ulng)| {
                gps_str
                    .as_deref()
                    .and_then(parse_gps)
                    .map(|(slat, slng)| haversine_km(ulat, ulng, slat, slng))
            });

            if let Some(d) = distance_km {
                if d > radius {
                    continue;
                }
            }

            results.push(json!({
                "result_type": "product",
                "id": row.try_get::<i32, _>("id").unwrap_or_default(),
                "service_id": service_id,
                "title": row.try_get::<Option<String>, _>("product_name").unwrap_or(None)
                             .unwrap_or_else(|| "Produit".to_string()),
                "subtitle": row.try_get::<Option<String>, _>("service_nom").unwrap_or(None),
                "description": enrich_product_description(
                    &data, effective_cat,
                    data.get("description").and_then(|v| v.as_str())
                ),
                "price": prix,
                "currency": data.get("devise").and_then(|v| v.as_str()).unwrap_or("XAF"),
                "image": data.get("images").and_then(|v| v.as_array())
                             .and_then(|a| a.first()).and_then(|v| v.as_str()),
                "address": row.try_get::<Option<String>, _>("service_adresse").unwrap_or(None),
                "gps": gps_str,
                "distance_km": distance_km,
                "category": effective_cat,
                "category_label": category_label(effective_cat),
                "category_icon": category_icon(effective_cat),
                "is_promotion": data.get("en_promotion").and_then(|v| v.as_bool()).unwrap_or(false),
                "deep_link": deep_link_for_product(service_id, Some(effective_cat), product_type_val.as_deref()),
            }));
        }
    }

    // ══════════════════════════════════════════════════════════════
    // 2. restaurant_menu_items
    // ══════════════════════════════════════════════════════════════
    let include_restaurant =
        cat_filter.as_ref().map_or(true, |cats| cats.iter().any(|c| c == "restaurant"));

    if include_restaurant {
        let menu_rows = sqlx::query(
            r#"
            SELECT rmi.id, rmi.service_id, rmi.nom, rmi.description, rmi.prix,
                   rmi.categorie, rmi.image_url,
                   s.data->>'nom'      AS service_nom,
                   s.data->>'adresse'  AS service_adresse,
                   COALESCE(s.gps, s.data->>'gps') AS service_gps
            FROM restaurant_menu_items rmi
            INNER JOIN services s ON s.id = rmi.service_id AND s.is_active = true
            WHERE rmi.is_disponible = true
              AND (
                    LOWER(rmi.nom) LIKE $1
                 OR LOWER(rmi.description) LIKE $1
                 OR LOWER(rmi.categorie) LIKE $1
              )
            ORDER BY rmi.prix ASC NULLS LAST
            LIMIT $2 OFFSET $3
            "#,
        )
        .bind(&search_pattern)
        .bind(limit / 3)
        .bind(offset)
        .fetch_all(&state.pg)
        .await
        .unwrap_or_default();

        for row in &menu_rows {
            let service_id: i32 = row.try_get("service_id").unwrap_or_default();
            let gps_str: Option<String> = row.try_get("service_gps").ok().flatten();
            let distance_km = params.lat.zip(params.lng).and_then(|(ulat, ulng)| {
                gps_str
                    .as_deref()
                    .and_then(parse_gps)
                    .map(|(slat, slng)| haversine_km(ulat, ulng, slat, slng))
            });

            if let Some(d) = distance_km {
                if d > radius {
                    continue;
                }
            }

            let prix: Option<f64> = row
                .try_get::<Option<rust_decimal::Decimal>, _>("prix")
                .ok()
                .flatten()
                .and_then(|d| d.to_string().parse().ok());

            results.push(json!({
                "result_type": "menu_item",
                "id": row.try_get::<i32, _>("id").unwrap_or_default(),
                "service_id": service_id,
                "title": row.try_get::<Option<String>, _>("nom").unwrap_or(None)
                             .unwrap_or_else(|| "Plat".to_string()),
                "subtitle": row.try_get::<Option<String>, _>("service_nom").unwrap_or(None),
                "description": row.try_get::<Option<String>, _>("description").unwrap_or(None),
                "price": prix,
                "currency": "XAF",
                "image": row.try_get::<Option<String>, _>("image_url").unwrap_or(None),
                "address": row.try_get::<Option<String>, _>("service_adresse").unwrap_or(None),
                "gps": gps_str,
                "distance_km": distance_km,
                "category": "restaurant",
                "category_label": "Restaurant",
                "category_icon": "restaurant",
                "is_promotion": false,
                "deep_link": deep_link_for_menu(service_id),
            }));
        }
    }

    // ══════════════════════════════════════════════════════════════
    // 3. services spécialisés (transport, santé, immobilier, assurance…)
    // ══════════════════════════════════════════════════════════════
    let include_services = cat_filter.as_ref().map_or(true, |cats| {
        cats.iter().any(|c| {
            matches!(
                c.as_str(),
                "transport"
                    | "bus"
                    | "taxi"
                    | "covoiturage"
                    | "hopital"
                    | "sante"
                    | "laboratoire"
                    | "hotel"
                    | "meuble"
                    | "immobilier"
                    | "assurance"
                    | "emploi"
                    | "veterinaire"
                    | "gym"
                    | "spa"
                    | "auto"
                    | "automobile"
                    | "garage"
                    | "location_vehicule"
                    | "vente_vehicule"
                    | "librairie"
            )
        })
    });

    if include_services {
        // Catégories à exclure (déjà traitées via service_products / menu_items)
        let excluded = vec!["supermarche", "ecommerce", "restaurant"];
        let cat_sql_filter: String = if let Some(ref cats) = cat_filter {
            let joined = cats
                .iter()
                .filter(|c| !excluded.contains(&c.as_str()))
                .map(|c| format!("'{}'", c.replace('\'', "''")))
                .collect::<Vec<_>>()
                .join(", ");
            if joined.is_empty() {
                return Ok((
                    StatusCode::OK,
                    Json(json!({
                        "success": true, "query": q, "results": results, "total": results.len()
                    })),
                ));
            }
            format!(
                "AND (s.category IN ({}) OR s.specialized_type IN ({}))",
                joined, joined
            )
        } else {
            format!(
                "AND s.category NOT IN ({})",
                excluded.iter().map(|c| format!("'{}'", c)).collect::<Vec<_>>().join(", ")
            )
        };

        let service_sql = format!(
            r#"
            SELECT s.id, s.category, s.specialized_type,
                   s.data                  AS service_data,
                   s.data->>'nom'          AS nom,
                   s.data->>'description'  AS description,
                   s.data->>'adresse'      AS adresse,
                   COALESCE(s.gps, s.data->>'gps') AS gps,
                   s.data->>'logo_url'     AS logo_url,
                   s.data->>'prix'         AS prix_raw,
                   s.data->>'type'         AS data_type
            FROM services s
            WHERE s.is_active = true
              {}
              AND (
                    LOWER(s.data->>'nom') LIKE $1
                 OR LOWER(s.data->>'description') LIKE $1
                 OR LOWER(s.data->>'adresse') LIKE $1
                 OR LOWER(s.data->>'ville') LIKE $1
                 OR LOWER(s.data->>'titre') LIKE $1
                 OR LOWER(s.category) LIKE $1
              )
            ORDER BY s.updated_at DESC
            LIMIT $2 OFFSET $3
            "#,
            cat_sql_filter
        );

        let service_rows = sqlx::query(&service_sql)
            .bind(&search_pattern)
            .bind(limit / 2)
            .bind(offset)
            .fetch_all(&state.pg)
            .await
            .unwrap_or_else(|e| {
                error!("[universal_search] Erreur services: {}", e);
                vec![]
            });

        for row in &service_rows {
            let service_id: i32 = row.try_get("id").unwrap_or_default();
            let category: String =
                row.try_get("category").unwrap_or_else(|_| "service".to_string());
            let specialized_type: Option<String> = row.try_get("specialized_type").ok().flatten();
            let gps_str: Option<String> = row.try_get("gps").ok().flatten();

            let distance_km = params.lat.zip(params.lng).and_then(|(ulat, ulng)| {
                gps_str
                    .as_deref()
                    .and_then(parse_gps)
                    .map(|(slat, slng)| haversine_km(ulat, ulng, slat, slng))
            });

            if let Some(d) = distance_km {
                if d > radius {
                    continue;
                }
            }

            let prix_raw: Option<String> = row.try_get("prix_raw").ok().flatten();
            let price: Option<f64> = prix_raw.as_deref().and_then(|p| p.parse().ok());
            let service_data: Value = row.try_get("service_data").unwrap_or(json!({}));
            let raw_desc: Option<String> = row.try_get("description").ok().flatten();

            results.push(json!({
                "result_type": "service",
                "id": service_id,
                "service_id": service_id,
                "title": row.try_get::<Option<String>, _>("nom").ok().flatten()
                             .unwrap_or_else(|| category_label(&category).to_string()),
                "subtitle": row.try_get::<Option<String>, _>("adresse").ok().flatten(),
                "description": enrich_service_description(&service_data, &category)
                    .or(raw_desc),
                "price": price,
                "currency": "XAF",
                "image": row.try_get::<Option<String>, _>("logo_url").ok().flatten(),
                "address": row.try_get::<Option<String>, _>("adresse").ok().flatten(),
                "gps": gps_str,
                "distance_km": distance_km,
                "category": category,
                "category_label": category_label(&category),
                "category_icon": category_icon(&category),
                "is_promotion": false,
                "deep_link": deep_link_for_service(service_id, &category, specialized_type.as_deref()),
            }));
        }
    }

    // Trier par distance si GPS disponible, sinon par type (product > menu_item > service)
    if params.lat.is_some() && params.lng.is_some() {
        results.sort_by(|a, b| {
            let da = a["distance_km"].as_f64().unwrap_or(f64::MAX);
            let db = b["distance_km"].as_f64().unwrap_or(f64::MAX);
            da.partial_cmp(&db).unwrap_or(std::cmp::Ordering::Equal)
        });
    }

    // Limiter le total final
    results.truncate(limit as usize);

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "query": q,
            "results": results,
            "total": results.len(),
            "has_products": results.iter().any(|r| r["result_type"] == "product"),
            "has_menu_items": results.iter().any(|r| r["result_type"] == "menu_item"),
            "has_services": results.iter().any(|r| r["result_type"] == "service"),
        })),
    ))
}
