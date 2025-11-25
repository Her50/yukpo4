// ?? src/services/creer_service.rs

use crate::core::types::{AppError, AppResult};
use crate::services::google_places_service::GooglePlacesService;
use crate::utils::currency::{auto_fill_currencies, extract_country};
use crate::utils::embedding_client::AddEmbeddingPineconeRequest;
use base64::{engine::general_purpose::STANDARD, Engine};
use chrono::Utc;
use log::{info, warn};
use sqlx::{FromRow, PgPool, Row};

#[derive(FromRow)]
struct UserGpsRow {
    gps: Option<String>,
}
use std::path::{Path, PathBuf};
use tokio::fs;
use uuid::Uuid;

// ✅ NOUVEAU 2025-11-01 : Configuration des coûts de création de services et produits
mod service_costs {
    /// Coût de création du premier produit (basé sur tokens IA)
    pub const COST_PER_TOKEN_XAF: f64 = 0.004;
    pub const MULTIPLIER_FIRST_PRODUCT: f64 = 100.0;

    /// ✅ Coût fixe d'ajout d'un nouveau produit dupliqué (modifié)
    pub const COST_NEW_PRODUCT_DUPLICATE_XAF: i64 = 3000;

    /// Coût minimum de création d'un service sans produits
    #[allow(dead_code)]
    pub const COST_SERVICE_MINIMUM_XAF: i64 = 500;

    /// Calculer le coût de création d'un service selon le contexte
    pub fn calculate_service_creation_cost(tokens_ia_externe: i64, is_first_product: bool) -> i64 {
        if is_first_product {
            // Premier produit : coût basé sur tokens IA
            let cost = (tokens_ia_externe as f64) * COST_PER_TOKEN_XAF * MULTIPLIER_FIRST_PRODUCT;
            cost.round() as i64
        } else {
            // Produits suivants : coût fixe
            COST_NEW_PRODUCT_DUPLICATE_XAF
        }
    }
}

#[derive(Debug, Clone)]
struct StoredMedia {
    path: String,
    bytes: Vec<u8>,
}

fn strip_base64_prefix(data: &str) -> &str {
    if let Some(idx) = data.find(',') {
        let (prefix, payload) = data.split_at(idx + 1);
        if prefix.contains("base64") {
            return payload;
        }
    }
    data
}

fn infer_extension_from_data(data: &str, default_ext: &str) -> String {
    if data.starts_with("data:") {
        if let Some(end) = data.find(';') {
            let mime = &data[5..end];
            return match mime {
                "image/png" => "png".to_string(),
                "image/webp" => "webp".to_string(),
                "image/gif" => "gif".to_string(),
                "image/jpeg" | "image/jpg" => "jpg".to_string(),
                "audio/mpeg" | "audio/mp3" => "mp3".to_string(),
                "audio/wav" => "wav".to_string(),
                "video/mp4" => "mp4".to_string(),
                "application/pdf" => "pdf".to_string(),
                "application/vnd.ms-excel" => "xls".to_string(),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" => {
                    "xlsx".to_string()
                }
                _ => default_ext.to_string(),
            };
        }
    }
    default_ext.to_string()
}

fn is_probable_base64(data: &str) -> bool {
    if data.starts_with("data:") {
        return true;
    }
    if data.len() < 80 {
        return false;
    }
    data.chars()
        .all(|c| c.is_ascii_alphanumeric() || matches!(c, '+' | '/' | '=' | '\n' | '\r'))
}

fn produits_array_mut(data_obj: &mut serde_json::Value) -> Option<&mut Vec<serde_json::Value>> {
    let map = data_obj.as_object_mut()?;
    let produits_value = map.get_mut("produits")?;
    match produits_value {
        serde_json::Value::Array(arr) => Some(arr),
        serde_json::Value::Object(obj) => obj.get_mut("valeur").and_then(|v| v.as_array_mut()),
        _ => None,
    }
}

async fn persist_base64_media(
    storage_root: &Path,
    service_id: i32,
    subdir: &str,
    base64_data: &str,
    default_ext: &str,
) -> AppResult<StoredMedia> {
    let payload = strip_base64_prefix(base64_data);
    let cleaned_payload: String = payload.chars().filter(|c| !c.is_whitespace()).collect();
    let bytes = STANDARD
        .decode(cleaned_payload.as_bytes())
        .map_err(|e| AppError::BadRequest(format!("Décodage base64 invalide: {}", e)))?;

    let extension = infer_extension_from_data(base64_data, default_ext);
    let service_dir = storage_root
        .join("services")
        .join(service_id.to_string())
        .join(subdir);
    fs::create_dir_all(&service_dir).await?;

    let file_name = format!(
        "{}_{}.{}",
        subdir.trim_end_matches('s'),
        Uuid::new_v4(),
        extension
    );
    let disk_path = service_dir.join(&file_name);
    fs::write(&disk_path, &bytes).await?;

    let relative_path = Path::new("uploads")
        .join("services")
        .join(service_id.to_string())
        .join(subdir)
        .join(&file_name);
    let path_str = relative_path.to_string_lossy().replace('\\', "/");

    Ok(StoredMedia {
        path: path_str,
        bytes,
    })
}

fn extract_value_string(value: &serde_json::Value) -> Option<String> {
    match value {
        serde_json::Value::String(s) => {
            let trimmed = s.trim();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed.to_string())
            }
        }
        serde_json::Value::Number(n) => Some(n.to_string()),
        serde_json::Value::Bool(b) => Some(b.to_string()),
        serde_json::Value::Object(map) => {
            if let Some(valeur) = map.get("valeur") {
                extract_value_string(valeur)
            } else if let Some(raw) = map.get("raw").and_then(|v| v.as_str()) {
                extract_value_string(&serde_json::Value::String(raw.to_string()))
            } else if let Some(text) = map.get("text").and_then(|v| v.as_str()) {
                extract_value_string(&serde_json::Value::String(text.to_string()))
            } else if let Some(display) = map.get("display_name").and_then(|v| v.as_str()) {
                extract_value_string(&serde_json::Value::String(display.to_string()))
            } else {
                None
            }
        }
        _ => None,
    }
}

fn build_location_label(value: &serde_json::Value) -> Option<String> {
    if let serde_json::Value::Object(map) = value {
        if let Some(raw) = map.get("raw").and_then(|v| v.as_str()) {
            let trimmed = raw.trim();
            if !trimmed.is_empty() {
                return Some(trimmed.to_string());
            }
        }

        let mut parts: Vec<String> = Vec::new();

        if let Some(place_name) = map.get("place_name").and_then(|v| v.as_str()) {
            let trimmed = place_name.trim();
            if !trimmed.is_empty() {
                parts.push(trimmed.to_string());
            }
        }

        if let Some(components) = map
            .get("composants")
            .or_else(|| map.get("components"))
            .and_then(|v| v.as_object())
        {
            for key in ["quartier", "ville", "region", "pays"] {
                if let Some(value) = components.get(key).and_then(|v| v.as_str()) {
                    let trimmed = value.trim();
                    if !trimmed.is_empty()
                        && !parts
                            .iter()
                            .any(|existing| existing.eq_ignore_ascii_case(trimmed))
                    {
                        parts.push(trimmed.to_string());
                    }
                }
            }
        }

        if !parts.is_empty() {
            return Some(parts.join(", "));
        }
    }
    extract_value_string(value)
}

fn extract_coordinates_from_value(value: &serde_json::Value) -> Option<(f64, f64)> {
    if let Some(obj) = value.as_object() {
        if let Some(coords_obj) = obj.get("coordinates").and_then(|v| v.as_object()) {
            let lat = coords_obj
                .get("lat")
                .and_then(|v| v.as_f64())
                .or_else(|| coords_obj.get("latitude").and_then(|v| v.as_f64()));
            let lng = coords_obj
                .get("lng")
                .and_then(|v| v.as_f64())
                .or_else(|| coords_obj.get("longitude").and_then(|v| v.as_f64()));
            if let (Some(lat), Some(lng)) = (lat, lng) {
                return Some((lat, lng));
            }
        }
        if let Some(valeur) = obj.get("valeur") {
            if let Some(coords) = extract_coordinates_from_value(valeur) {
                return Some(coords);
            }
        }
        if let Some(raw) = obj.get("raw").and_then(|v| v.as_str()) {
            if let Some(coords) = parse_lat_lng_from_str(raw) {
                return Some(coords);
            }
        }
    } else if let Some(s) = value.as_str() {
        if let Some(coords) = parse_lat_lng_from_str(s) {
            return Some(coords);
        }
    }
    None
}

fn parse_lat_lng_from_str(input: &str) -> Option<(f64, f64)> {
    let cleaned = input.trim();
    let parts: Vec<&str> = cleaned.split(',').map(|s| s.trim()).collect();
    if parts.len() != 2 {
        return None;
    }
    let lat = parts[0].parse::<f64>().ok()?;
    let lng = parts[1].parse::<f64>().ok()?;
    Some((lat, lng))
}

/// Fonction utilitaire pour détecter si une string est du base64 (média)
fn is_base64_media(s: &str) -> bool {
    // Détecter les strings base64 de médias (très longues, commençant par data:)
    (s.starts_with("data:image/") || 
     s.starts_with("data:video/") || 
     s.starts_with("data:audio/") ||
     s.starts_with("data:application/")) && 
    s.len() > 1000 // Les médias base64 sont toujours très longs
}

/// Fonction récursive pour nettoyer tous les médias base64 dans une structure JSON
/// Supprime les clés médias directes, les objets avec type_donnee médias, et les strings base64 longues
fn clean_media_recursive_final(value: &mut serde_json::Value, removed_count: &mut usize) {
    match value {
        serde_json::Value::Object(obj) => {
            // Liste des clés à supprimer complètement (médias bruts)
            let media_keys = [
                "base64_image",
                "audio_base64",
                "video_base64",
                "doc_base64",
                "excel_base64",
                "images_base64",
                "image_base64",
                "pdf_base64",
            ];
            
            // Supprimer les clés médias directes
            for key in &media_keys {
                if obj.remove(*key).is_some() {
                    *removed_count += 1;
                }
            }
            
            // Nettoyer les objets avec type_donnee médias (media, image, video, audio, document, file, excel)
            let keys_to_check: Vec<String> = obj.keys().cloned().collect();
            for key in keys_to_check {
                if let Some(v) = obj.get_mut(&key) {
                    // Si c'est un objet avec type_donnee médias, supprimer tout l'objet
                    if let Some(media_obj) = v.as_object_mut() {
                        let should_remove = media_obj.get("type_donnee")
                            .and_then(|t| t.as_str())
                            .map(|s| {
                                matches!(s, "media" | "image" | "video" | "audio" | "document" | "file" | "excel" | "pdf")
                            })
                            .unwrap_or(false);
                        
                        if should_remove {
                            // Supprimer tout l'objet média (il sera sauvegardé dans la table media)
                            if obj.remove(&key).is_some() {
                                *removed_count += 1;
                            }
                            continue;
                        }
                        
                        // Vérifier aussi si la valeur contient du base64
                        if let Some(val) = media_obj.get("valeur") {
                            match val {
                                serde_json::Value::String(s) if is_base64_media(s) => {
                                    // Remplacer par null au lieu de supprimer pour garder la structure
                                    media_obj.insert("valeur".to_string(), serde_json::Value::Null);
                                    *removed_count += 1;
                                }
                                serde_json::Value::Array(_) => {
                                    // Nettoyer les tableaux de base64
                                    let mut cleaned = false;
                                    if let Some(arr) = media_obj.get_mut("valeur").and_then(|v| v.as_array_mut()) {
                                        for item in arr.iter_mut() {
                                            if let serde_json::Value::String(s) = item {
                                                if is_base64_media(s) {
                                                    *item = serde_json::Value::Null;
                                                    cleaned = true;
                                                    *removed_count += 1;
                                                }
                                            }
                                        }
                                        if cleaned && arr.iter().all(|v| v.is_null()) {
                                            // Si toutes les valeurs sont null, supprimer l'objet
                                            if obj.remove(&key).is_some() {
                                                *removed_count += 1;
                                            }
                                            continue;
                                        }
                                    }
                                }
                                _ => {}
                            }
                        }
                        
                        // Nettoyer récursivement dans les sous-objets
                        clean_media_recursive_final(v, removed_count);
                    } else if let Some(s) = v.as_str() {
                        // Détecter et supprimer les strings base64 directes
                        if is_base64_media(s) {
                            *v = serde_json::Value::Null;
                            *removed_count += 1;
                        }
                    } else {
                        // Nettoyer récursivement
                        clean_media_recursive_final(v, removed_count);
                    }
                }
            }
        }
        serde_json::Value::Array(arr) => {
            // Nettoyer les tableaux : supprimer les strings base64
            let mut indices_to_remove = Vec::new();
            for (idx, item) in arr.iter_mut().enumerate() {
                match item {
                    serde_json::Value::String(s) if is_base64_media(s) => {
                        *removed_count += 1;
                        indices_to_remove.push(idx);
                    }
                    _ => {
                        clean_media_recursive_final(item, removed_count);
                    }
                }
            }
            // Retirer les éléments base64 en ordre décroissant
            for &idx in indices_to_remove.iter().rev() {
                arr.remove(idx);
            }
        }
        serde_json::Value::String(s) => {
            // Si la valeur elle-même est du base64, la remplacer par null
            if is_base64_media(s) {
                *value = serde_json::Value::Null;
                *removed_count += 1;
            }
        }
        _ => {}
    }
}

fn extract_string_field(
    map: &serde_json::Map<String, serde_json::Value>,
    key: &str,
) -> Option<String> {
    map.get(key).and_then(|value| extract_value_string(value))
}

async fn enrich_service_with_google(
    data_obj: &mut serde_json::Value,
    pool: &PgPool,
    user_id: i32,
) -> Result<(), AppError> {
    let map = match data_obj.as_object_mut() {
        Some(map) => map,
        None => return Ok(()),
    };

    if map.contains_key("google_place") {
        return Ok(());
    }

    let titre = extract_string_field(map, "titre_service");
    let nom_produit = extract_string_field(map, "nom_produit");
    
    // ✅ NOUVEAU: Récupérer le nom du prestataire depuis le JSON OU depuis la table users
    let mut nom_prestataire = extract_string_field(map, "nom_prestataire")
        .or_else(|| extract_string_field(map, "prestataire_nom"));
    
    // Fallback: Récupérer depuis la table users si pas dans le JSON
    if nom_prestataire.is_none() {
        match sqlx::query_scalar::<_, Option<String>>(
            "SELECT COALESCE(NULLIF(TRIM(nom_complet), ''), CONCAT(COALESCE(NULLIF(TRIM(prenom), ''), ''), ' ', COALESCE(NULLIF(TRIM(nom), ''), ''))) FROM users WHERE id = $1"
        )
        .bind(user_id)
        .fetch_optional(pool)
        .await
        {
            Ok(Some(Some(name))) if !name.trim().is_empty() => {
                nom_prestataire = Some(name.trim().to_string());
                log::info!(
                    "[enrich_service_with_google] Nom prestataire récupéré depuis users: {}",
                    nom_prestataire.as_ref().unwrap()
                );
            }
            Ok(Some(None)) | Ok(None) => {
                log::debug!(
                    "[enrich_service_with_google] Aucun nom trouvé dans users pour user_id {}",
                    user_id
                );
            }
            Err(e) => {
                log::warn!(
                    "[enrich_service_with_google] Erreur récupération nom utilisateur {}: {}",
                    user_id,
                    e
                );
            }
        }
    } else {
        log::info!(
            "[enrich_service_with_google] Nom prestataire trouvé dans JSON: {}",
            nom_prestataire.as_ref().unwrap()
        );
    }
    
    let categorie = extract_string_field(map, "categorie_produit")
        .or_else(|| extract_string_field(map, "category"));

    let mut query_parts: Vec<String> = Vec::new();
    if let Some(titre) = titre.clone() {
        query_parts.push(titre);
    }
    if let Some(nom_produit) = nom_produit.clone() {
        if !query_parts
            .iter()
            .any(|q| q.eq_ignore_ascii_case(&nom_produit))
        {
            query_parts.push(nom_produit);
        }
    }
    if let Some(nom_prestataire) = nom_prestataire.clone() {
        if !query_parts
            .iter()
            .any(|q| q.eq_ignore_ascii_case(&nom_prestataire))
        {
            query_parts.push(nom_prestataire);
        }
    }
    if query_parts.is_empty() {
        if let Some(categorie) = categorie.clone() {
            query_parts.push(categorie);
        }
    }

    let lieu_value = map
        .get("lieu_produit")
        .or_else(|| map.get("lieu_commercial"))
        .or_else(|| map.get("lieu_service"))
        .or_else(|| map.get("lieu"));

    let location_label = lieu_value.and_then(|value| build_location_label(value));
    let country = lieu_value
        .and_then(|value| extract_country(value))
        .or_else(|| {
            map.get("location_vector")
                .and_then(|vec| extract_value_string(vec))
        });
    let coordinates = lieu_value.and_then(|value| extract_coordinates_from_value(value));

    let base_query = query_parts.join(" ").trim().to_string();

    let final_query = match (base_query.is_empty(), location_label.clone()) {
        (true, Some(location)) => location,
        (false, Some(location)) => format!("{} {}", base_query, location),
        (false, None) => base_query,
        (true, None) => return Ok(()),
    };

    let places_service = GooglePlacesService::new();
    
    // ✅ NOUVEAU: Utiliser search_and_select_best_match avec validation distance et comparaison multiple
    let nom_prestataire_str = nom_prestataire.as_deref();
    let max_distance_km = 10.0; // Distance maximale acceptée : 10 km
    
    match places_service
        .search_and_select_best_match(
            &final_query,
            country.as_deref(),
            Some("fr"),
            coordinates,
            nom_prestataire_str,
            max_distance_km,
        )
        .await
    {
        Ok(Some(google_place)) => {
            if let Ok(value) = serde_json::to_value(&google_place) {
                map.insert("google_place".to_string(), value);
            }

            if !map.contains_key("location_vector") && !google_place.location_vector.is_empty() {
                let vector_value = serde_json::Value::Array(
                    google_place
                        .location_vector
                        .iter()
                        .cloned()
                        .map(serde_json::Value::String)
                        .collect(),
                );
                map.insert("location_vector".to_string(), vector_value);
            }
            
            log::info!(
                "[creer_service] ✅ Google Places match sélectionné: {} (place_id: {})",
                google_place.display_name,
                google_place.place_id
            );
        }
        Ok(None) => {
            info!(
                "[creer_service] Google Places n'a pas trouvé de résultat pertinent pour '{}'",
                final_query
            );
        }
        Err(error) => {
            warn!(
                "[creer_service] Enrichissement Google Places indisponible: {}",
                error
            );
        }
    }

    Ok(())
}
// ?? Imports pour la génération de signatures d'images (conditionnels)
#[cfg(feature = "image_search")]
use md5;

/// Structure pour tracker les tokens consomm?s lors de la cr?ation de service
#[derive(Debug, Clone)]
pub struct ServiceCreationTokens {
    pub validation_tokens: i64,
    pub embedding_tokens: i64,
    pub translation_tokens: i64,
    pub ocr_tokens: i64,
    pub enrichment_tokens: i64,
    pub total_tokens: i64,
}

impl ServiceCreationTokens {
    pub fn new() -> Self {
        Self {
            validation_tokens: 0,
            embedding_tokens: 0,
            translation_tokens: 0,
            ocr_tokens: 0,
            enrichment_tokens: 0,
            total_tokens: 0,
        }
    }

    pub fn add_validation(&mut self, complexity: i64) {
        self.validation_tokens += complexity;
        self.total_tokens += complexity;
    }

    pub fn add_embedding(&mut self, fields_count: usize) {
        let tokens = (fields_count as i64).max(1);
        self.embedding_tokens += tokens;
        self.total_tokens += tokens;
    }

    pub fn add_translation(&mut self, text_length: usize) {
        let tokens = (text_length / 100).max(1) as i64; // 1 token per 100 chars
        self.translation_tokens += tokens;
        self.total_tokens += tokens;
    }

    pub fn add_ocr(&mut self, image_size_estimate: usize) {
        let tokens = (image_size_estimate / 1000).max(2) as i64; // 2 tokens minimum for OCR
        self.ocr_tokens += tokens;
        self.total_tokens += tokens;
    }

    pub fn add_enrichment(&mut self, complexity: i64) {
        self.enrichment_tokens += complexity;
        self.total_tokens += complexity;
    }
}

// Validation commune du JSON de service (structure, champs, intention)
pub fn valider_service_json(data: &serde_json::Value) -> Result<serde_json::Value, AppError> {
    // DEBUG: Affichage du JSON re?u pour debug maximal
    println!("[DEBUG][valider_service_json] JSON re?u : {}", data);

    // Si data n'est pas un objet, tenter d'extraire le premier objet JSON du texte (robustesse IA)
    let mut data_obj = if !data.is_object() {
        if let Some(s) = data.as_str() {
            if let Some(start) = s.find('{') {
                if let Some(end) = s.rfind('}') {
                    let json_str = &s[start..=end];
                    match serde_json::from_str::<serde_json::Value>(json_str) {
                        Ok(val) => val,
                        Err(_) => return Err(AppError::BadRequest("La sortie de l'IA doit contenir un objet JSON valide. Aucun JSON exploitable trouv?.".to_string())),
                    }
                } else {
                    return Err(AppError::BadRequest("La sortie de l'IA ne contient pas de JSON complet (accolade fermante manquante).".to_string()));
                }
            } else {
                return Err(AppError::BadRequest(
                    "La sortie de l'IA ne contient pas d'objet JSON (accolade ouvrante manquante)."
                        .to_string(),
                ));
            }
        } else {
            return Err(AppError::BadRequest("La sortie de l'IA doit ?tre un objet JSON strict, ou contenir un objet JSON exploitable.".to_string()));
        }
    } else {
        data.clone()
    };

    // ? OPTIMISATION : Nettoyage automatique des champs probl?matiques
    if let Some(map) = data_obj.as_object_mut() {
        // Supprimer tous les champs *_type et *_options restants
        let keys_to_remove: Vec<String> = map
            .keys()
            .filter(|k| k.ends_with("_type") || k.ends_with("_options"))
            .cloned()
            .collect();
        for k in keys_to_remove {
            map.remove(&k);
        }

        // ? OPTIMISATION : Normaliser le champ produits s'il est un tableau direct
        if let Some(produits) = map.get("produits") {
            if produits.is_array() {
                // Convertir le tableau direct en format objet attendu par le sch?ma
                let produits_array = produits.as_array().unwrap();
                let produits_obj = serde_json::json!({
                    "type_donnee": "listeproduit",
                    "valeur": produits_array,
                    "origine_champs": "ia"
                });
                map.insert("produits".to_string(), produits_obj);
                log::info!(
                    "[valider_service_json] Normalisation du champ produits: tableau -> objet"
                );
            } else if let Some(produits_obj) = produits.as_object() {
                // ✅ CORRECTION : Gérer le cas où produits.type_donnee = "string" et produits.valeur est un objet autocomplete
                if let Some(type_donnee) = produits_obj.get("type_donnee").and_then(|v| v.as_str()) {
                    if type_donnee == "string" {
                        if let Some(valeur_obj) = produits_obj.get("valeur").and_then(|v| v.as_object()) {
                            if let Some(valeur_type_donnee) = valeur_obj.get("type_donnee").and_then(|v| v.as_str()) {
                                if valeur_type_donnee == "autocomplete" {
                                    // Structure incorrecte : produits.type_donnee="string" avec produits.valeur.type_donnee="autocomplete"
                                    // Normaliser en listeproduit
                                    let origine_champs = produits_obj
                                        .get("origine_champs")
                                        .and_then(|v| v.as_str())
                                        .unwrap_or("formulaire")
                                        .to_string();
                                    
                                    // Extraire les valeurs de l'autocomplete
                                    let autocomplete_valeurs = valeur_obj
                                        .get("valeur")
                                        .and_then(|v| v.as_array())
                                        .cloned()
                                        .unwrap_or_default();
                                    
                                    // Construire un produit basique à partir de l'autocomplete
                                    let produit_obj = serde_json::json!({
                                        "nom": autocomplete_valeurs.get(0).and_then(|v| v.as_str()).unwrap_or(""),
                                        "combinaison_brute": autocomplete_valeurs
                                            .iter()
                                            .filter_map(|v| v.as_str())
                                            .collect::<Vec<_>>()
                                            .join(","),
                                        "characteristic_vector": autocomplete_valeurs,
                                        "sous_caracteristiques": valeur_obj.get("sous_caracteristiques").cloned().unwrap_or(serde_json::json!({})),
                                        "origine_champs": origine_champs.clone()
                                    });
                                    
                                    let produits_normalized = serde_json::json!({
                                        "type_donnee": "listeproduit",
                                        "valeur": vec![produit_obj],
                                        "origine_champs": origine_champs
                                    });
                                    
                                    map.insert("produits".to_string(), produits_normalized);
                                    log::info!(
                                        "[valider_service_json] ✅ Normalisation produits: type_donnee='string' avec valeur autocomplete -> listeproduit"
                                    );
                                }
                            }
                        }
                    }
                }
            }
        }

        // ✅ Alias rétrocompatibilité : accepter "titre" à la place de "titre_service"
        if map.contains_key("titre") && !map.contains_key("titre_service") {
            if let Some(titre_value) = map.remove("titre") {
                map.insert("titre_service".to_string(), titre_value);
                log::info!(
                    "[valider_service_json] Alias 'titre' détecté → renommé en 'titre_service'"
                );
            }
        }
        if let Some(titre_obj) = map.get("titre_service").and_then(|value| value.as_object()) {
            let titre_vide = titre_obj
                .get("valeur")
                .and_then(|v| v.as_str())
                .map(|s| s.trim().is_empty())
                .unwrap_or(true);
            if titre_vide {
                return Err(AppError::BadRequest(
                    "Le champ 'titre_service.valeur' ne peut pas être vide.".into(),
                ));
            }
        }

        // ? OPTIMISATION : Normaliser le champ gps_fixe s'il manque la propri?t? valeur
        if let Some(gps_fixe) = map.get("gps_fixe") {
            if let Some(gps_obj) = gps_fixe.as_object() {
                if !gps_obj.contains_key("valeur") {
                    log::info!("[valider_service_json] Normalisation du champ gps_fixe: ajout valeur manquante");
                    let mut gps_fixe_normalized = gps_obj.clone();
                    gps_fixe_normalized.insert(
                        "valeur".to_string(),
                        serde_json::Value::String("".to_string()),
                    );
                    map.insert(
                        "gps_fixe".to_string(),
                        serde_json::Value::Object(gps_fixe_normalized),
                    );
                }
            }
        }

        // ? OPTIMISATION : Ajouter automatiquement origine_champs manquants
        for (key, value) in map.iter_mut() {
            if let Some(obj) = value.as_object_mut() {
                if !obj.contains_key("origine_champs")
                    && obj.contains_key("type_donnee")
                    && obj.contains_key("valeur")
                {
                    // D?terminer l'origine automatiquement
                    let origine = if key == "titre_service" || key == "description" {
                        "texte_libre"
                    } else {
                        "ia"
                    };
                    obj.insert(
                        "origine_champs".to_string(),
                        serde_json::Value::String(origine.to_string()),
                    );
                    log::info!("[valider_service_json] Ajout automatique origine_champs='{}' pour champ '{}'", origine, key);
                }
            }
        }

        // ✅ NOUVEAU : Validation spécifique des nouveaux types (autocomplete, price_variant, date, location)
        for (key, value) in map.iter() {
            if let Some(obj) = value.as_object() {
                if let Some(type_donnee) = obj.get("type_donnee").and_then(|v| v.as_str()) {
                    match type_donnee {
                        "autocomplete" => {
                            // Valider structure autocomplete
                            if !obj.contains_key("valeur")
                                || !obj.get("valeur").and_then(|v| v.as_array()).is_some()
                            {
                                return Err(AppError::BadRequest(format!(
                                    "Champ '{}': autocomplete doit avoir 'valeur' (array)",
                                    key
                                )));
                            }
                            if !obj.contains_key("separateur") {
                                return Err(AppError::BadRequest(format!(
                                    "Champ '{}': autocomplete doit avoir 'separateur'",
                                    key
                                )));
                            }
                            if !obj.contains_key("sous_caracteristiques") {
                                return Err(AppError::BadRequest(format!(
                                    "Champ '{}': autocomplete doit avoir 'sous_caracteristiques'",
                                    key
                                )));
                            }
                            if !obj.contains_key("identifiant_base") {
                                return Err(AppError::BadRequest(format!(
                                    "Champ '{}': autocomplete doit avoir 'identifiant_base'",
                                    key
                                )));
                            }
                            log::info!(
                                "[valider_service_json] ✅ Champ '{}' autocomplete validé",
                                key
                            );
                        }
                        "price_variant" => {
                            // Valider structure price_variant
                            if !obj.contains_key("variable") {
                                return Err(AppError::BadRequest(format!(
                                    "Champ '{}': price_variant doit avoir 'variable'",
                                    key
                                )));
                            }
                            if !obj.contains_key("modalites") {
                                return Err(AppError::BadRequest(format!(
                                    "Champ '{}': price_variant doit avoir 'modalites'",
                                    key
                                )));
                            }
                            if let Some(modalites) = obj.get("modalites").and_then(|v| v.as_array())
                            {
                                for (idx, modalite) in modalites.iter().enumerate() {
                                    if let Some(mod_obj) = modalite.as_object() {
                                        // Vérifier que prix est un nombre (jamais string)
                                        if let Some(prix_val) = mod_obj.get("prix") {
                                            if !prix_val.is_number() {
                                                return Err(AppError::BadRequest(format!(
                                                    "Champ '{}': modalite[{}].prix doit être un nombre (jamais string)", 
                                                    key, idx
                                                )));
                                            }
                                        } else {
                                            return Err(AppError::BadRequest(format!(
                                                "Champ '{}': modalite[{}] doit avoir 'prix' (number)", 
                                                key, idx
                                            )));
                                        }
                                        if !mod_obj.contains_key("valeur") {
                                            return Err(AppError::BadRequest(format!(
                                                "Champ '{}': modalite[{}] doit avoir 'valeur'",
                                                key, idx
                                            )));
                                        }
                                        if !mod_obj.contains_key("devise") {
                                            return Err(AppError::BadRequest(format!(
                                                "Champ '{}': modalite[{}] doit avoir 'devise'",
                                                key, idx
                                            )));
                                        }
                                    } else {
                                        return Err(AppError::BadRequest(format!(
                                            "Champ '{}': modalite[{}] doit être un objet",
                                            key, idx
                                        )));
                                    }
                                }
                            } else {
                                return Err(AppError::BadRequest(format!(
                                    "Champ '{}': price_variant.modalites doit être un array",
                                    key
                                )));
                            }
                            log::info!(
                                "[valider_service_json] ✅ Champ '{}' price_variant validé",
                                key
                            );
                        }
                        "date" => {
                            // Valider structure date
                            if let Some(valeur) = obj.get("valeur").and_then(|v| v.as_str()) {
                                // Valider format ISO (YYYY-MM-DD) avec regex simple
                                let parts: Vec<&str> = valeur.split('-').collect();
                                if parts.len() != 3
                                    || parts[0].len() != 4
                                    || parts[1].len() != 2
                                    || parts[2].len() != 2
                                    || !parts[0].chars().all(|c| c.is_ascii_digit())
                                    || !parts[1].chars().all(|c| c.is_ascii_digit())
                                    || !parts[2].chars().all(|c| c.is_ascii_digit())
                                {
                                    return Err(AppError::BadRequest(format!(
                                        "Champ '{}': date.valeur doit être au format YYYY-MM-DD (ex: 2024-12-25)", 
                                        key
                                    )));
                                }
                            } else {
                                return Err(AppError::BadRequest(format!("Champ '{}': date doit avoir 'valeur' (string format YYYY-MM-DD)", key)));
                            }
                            log::info!("[valider_service_json] ✅ Champ '{}' date validé", key);
                        }
                        "location" => {
                            // Valider structure location
                            if !obj.contains_key("valeur") {
                                return Err(AppError::BadRequest(format!(
                                    "Champ '{}': location doit avoir 'valeur'",
                                    key
                                )));
                            }
                            log::info!("[valider_service_json] ✅ Champ '{}' location validé", key);
                        }
                        "media" | "image" | "video" | "audio" | "document" | "file" | "excel" => {
                            // Validation basique : vérifier que la valeur existe
                            if !obj.contains_key("valeur") {
                                return Err(AppError::BadRequest(format!(
                                    "Champ '{}': media doit avoir 'valeur'",
                                    key
                                )));
                            }
                            log::info!("[valider_service_json] ✅ Champ '{}' media validé", key);
                        }
                        _ => {}
                    }
                }
            }
        }
    }

    // ? OPTIMISATION : Validation sch?ma simplifi?e
    // Chargement du sch?ma JSON depuis le fichier centralis?
    let schema_str = match std::fs::read_to_string("src/schemas/service_schema.json") {
        Ok(s) => {
            log::info!(
                "[valider_service_json] ? Sch?ma JSON charg? avec succ?s ({} bytes)",
                s.len()
            );
            s
        }
        Err(e) => {
            log::warn!("[valider_service_json] ? Sch?ma JSON non trouv?: {}", e);
            // Validation simplifi?e si le sch?ma n'est pas trouv?
            if data_obj.get("titre_service").is_some()
                && data_obj.get("category").is_some()
                && data_obj.get("description").is_some()
            {
                info!("[valider_service_json] Validation simplifi?e r?ussie");
                return Ok(data_obj);
            } else {
                return Err(AppError::BadRequest(
                    "Champs obligatoires manquants (titre_service, category, description)"
                        .to_string(),
                ));
            }
        }
    };

    let schema_json: serde_json::Value = serde_json::from_str(&schema_str)
        .map_err(|e| AppError::Internal(format!("Erreur parsing sch?ma JSON: {e}")))?;

    log::info!("[valider_service_json] ?? Validation du sch?ma pour data_obj...");
    log::info!(
        "[valider_service_json] ?? Sch?ma charg?: {}",
        serde_json::to_string_pretty(&schema_json).unwrap_or_default()
    );

    // Validation sch?ma sur data_obj (qui contient seulement les donn?es du service)
    if !jsonschema::is_valid(&schema_json, &data_obj) {
        log::error!(
            "[valider_service_json] ? Sch?ma non valide pour data_obj: {:#?}",
            data_obj
        );

        // Debug: afficher les erreurs de validation sp?cifiques
        let instance = jsonschema::JSONSchema::compile(&schema_json)
            .map_err(|e| AppError::Internal(format!("Erreur compilation sch?ma JSON: {e}")))?;

        let validation_result = instance.validate(&data_obj);
        if let Err(errors) = validation_result {
            for error in errors {
                log::error!(
                    "[valider_service_json] ? Erreur validation: {} ? {}",
                    error,
                    error.instance_path
                );
            }
        }

        return Err(AppError::BadRequest(
            "Donn?es non conformes au sch?ma".to_string(),
        ));
    }

    info!("[valider_service_json] Sch?ma JSON valid? avec succ?s");
    Ok(data_obj)
}

/// ? Crée un service et active l'utilisateur en tant que provider, avec validation et caching
pub async fn creer_service(
    pool: &PgPool,
    user_id: i32,
    data: &serde_json::Value,
    _redis_client: &redis::Client, // Ajout de Redis pour le caching (désactivé)
) -> Result<(serde_json::Value, u32), AppError> {
    // Initialiser le tracking des tokens
    let mut token_tracker = ServiceCreationTokens::new();

    // ?? Déballage automatique du champ 'data' à la racine pour compatibilité nouvelle structure IA
    let mut data_processed = data.clone();
    crate::services::orchestration_ia::deballer_champ_data_a_racine(&mut data_processed);
    log::info!(
        "[creer_service] Données après déballage: {}",
        data_processed
    );

    // ?? Extraction des tokens consommés par l'IA depuis les données
    // Chercher d'abord tokens_ia_externe (nouveau format), puis tokens_consumed (ancien format)
    let ia_tokens_consumed = data_processed
        .get("tokens_ia_externe")
        .and_then(|v| v.as_u64())
        .or_else(|| {
            data_processed
                .get("tokens_consumed")
                .and_then(|v| v.as_u64())
        })
        .unwrap_or(0) as i64;

    // ✅ CRITIQUE 2025-11-02 : VALIDER D'ABORD AVANT DE DÉBITER (éviter perte argent)
    let mut data_obj = valider_service_json(&data_processed)?;
    log::info!("[creer_service] ✅ Validation JSON réussie AVANT débit");

    // ✅ NOUVEAU 2025-11-01 : Déterminer si c'est le premier produit ou un produit dupliqué
    // Si tokens_ia_externe > 0 : c'est le premier produit (analysé par IA)
    // Si tokens_ia_externe = 0 : c'est un produit dupliqué (pas d'analyse IA)
    let is_first_product = ia_tokens_consumed > 0;

    // ✅ NOUVEAU 2025-11-01 : Calculer le coût réel avec le système configurable
    let cout_reel_xaf =
        service_costs::calculate_service_creation_cost(ia_tokens_consumed, is_first_product);

    log::info!(
        "[creer_service] 💰 Coût calculé: {} FCFA (tokens IA: {}, premier produit: {})",
        cout_reel_xaf,
        ia_tokens_consumed,
        is_first_product
    );

    // ✅ NOUVEAU 2025-11-01 : Vérifier le solde (mais NE PAS débiter encore)
    let current_balance_result = sqlx::query("SELECT tokens_balance FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_one(pool)
        .await;

    let current_balance = match current_balance_result {
        Ok(row) => row.try_get::<i64, _>("tokens_balance").unwrap_or(0),
        Err(e) => {
            log::error!(
                "[creer_service] ❌ Impossible de récupérer le solde utilisateur {}: {}",
                user_id,
                e
            );
            return Err(AppError::Internal(format!(
                "Erreur récupération solde: {}",
                e
            )));
        }
    };

    // Vérifier solde suffisant
    if current_balance < cout_reel_xaf {
        log::error!(
            "[creer_service] ❌ Solde insuffisant pour user {}: {} FCFA < {} FCFA requis",
            user_id,
            current_balance,
            cout_reel_xaf
        );
        return Err(AppError::BadRequest(format!(
            "Solde insuffisant: {} FCFA disponible, {} FCFA requis",
            current_balance, cout_reel_xaf
        )));
    }

    // ✅ NOUVEAU: Limiter la taille du JSON pour éviter l'erreur d'index PostgreSQL
    // Supprimer les images base64 du champ produits avant insertion (elles sont déjà dans media)
    if let Some(produits_array) = produits_array_mut(&mut data_obj) {
        for produit in produits_array.iter_mut() {
            if let Some(produit_obj) = produit.as_object_mut() {
                produit_obj.remove("images_base64");
                produit_obj.remove("image_base64");
                produit_obj.remove("video_base64");
                produit_obj.remove("audio_base64");
                produit_obj.remove("doc_base64");
                produit_obj.remove("excel_base64");

                // ✅ CORRIGÉ: Tronquer les descriptions trop longues (réduire de 5000 à 2000 chars)
                if let Some(description) = produit_obj.get_mut("description") {
                    if let Some(desc_str) = description.as_str() {
                        let desc_len = desc_str.len();
                        if desc_len > 2000 {
                            *description = serde_json::Value::String(
                                desc_str.chars().take(2000).collect::<String>() + "...",
                            );
                            log::warn!(
                                "[creer_service] Description produit tronquée (trop longue: {} chars)",
                                desc_len
                            );
                        }
                    }
                }
            }
        }
        log::info!(
            "[creer_service] ✅ Nettoyage des données volumineuses dans produits (images base64 supprimées)"
        );
    }

    // ✅ CRITIQUE: Supprimer base64_image du data_obj AVANT insertion (évite erreur index PostgreSQL)
    // Les images seront sauvegardées dans la table media plus tard
    let mut removed_count_initial = 0;
    clean_media_recursive_final(&mut data_obj, &mut removed_count_initial);
    
    if removed_count_initial > 0 {
        log::info!(
            "[creer_service] ✅ Nettoyage initial des médias base64 ({} médias supprimés)",
            removed_count_initial
        );
    }

    log::info!(
        "[creer_service] Token tracker après ajout validation: {:?}",
        token_tracker
    );

    // Enrichissement multimodal : remplacement des références par les vraies données (optimisé)
    let _data_obj = data_obj.clone();
    let enriched_data = tokio::task::spawn_blocking(move || {
        let enriched = _data_obj;
        // enrichir_multimodalites(&mut enriched, "data/uploads"); // This line was commented out
        enriched
    })
    .await
    .unwrap_or_else(|e| {
        log::error!("[creer_service] Erreur enrichissement multimodal: {:?}", e);
        data_obj.clone()
    });
    data_obj = enriched_data;

    // Extraction du titre selon la structure (ancienne ou nouvelle)
    let titre = if let Some(titre_obj) = data_obj.get("titre") {
        titre_obj
            .as_object()
            .and_then(|obj| obj.get("valeur"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
    } else if let Some(titre_service_obj) = data_obj.get("titre_service") {
        titre_service_obj
            .as_object()
            .and_then(|obj| obj.get("valeur"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
    } else {
        None
    };

    // Extraction de la description (optionnelle dans la nouvelle structure)
    let description = if let Some(desc_obj) = data_obj.get("description") {
        desc_obj
            .as_object()
            .and_then(|obj| obj.get("valeur"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
    } else {
        None
    };
    let is_tarissable = data_obj
        .get("is_tarissable")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    let gps = data_obj.get("gps").and_then(|v| v.as_bool());
    // Correction?: la colonne gps est TEXT en base, il faut passer "true"/"false" (string)
    let gps_str = gps
        .map(|b| if b { "true" } else { "false" })
        .unwrap_or("false");
    // Correction?: forcer la valeur de gps dans data_obj à être une string (pour cohérence JSON stocké)
    if let Some(gps_val) = data_obj.get_mut("gps") {
        *gps_val = serde_json::Value::String(gps_str.to_string());
    }
    let active_days = if is_tarissable {
        data_obj
            .get("active_days")
            .and_then(|d| d.as_i64())
            .unwrap_or(7)
            .min(30)
    } else {
        data_obj
            .get("active_days")
            .and_then(|d| d.as_i64())
            .unwrap_or(7)
    };
    auto_fill_currencies(&mut data_obj);

    if let Err(err) = enrich_service_with_google(&mut data_obj, pool, user_id).await {
        warn!(
            "[creer_service] Impossible d'enrichir le service via Google Places: {}",
            err
        );
    }

    let auto_deactivate_at = chrono::Utc::now() + chrono::Duration::days(active_days);

    let _cache_key = format!(
        "creation_service:{}:{}:{}",
        user_id,
        titre.as_deref().unwrap_or(""),
        description.as_deref().unwrap_or("")
    );

    // let mut redis_con = redis_client.get_multiplexed_async_connection().await.map_err(|e| {
    //     AppError::Internal(format!("Erreur de connexion Redis : {}", e))
    // })?;

    // // Vérifier si un service similaire existe déjà dans le cache
    // if let Ok(cached_result) = redis_con.get::<_, String>(&cache_key).await {
    //     return Ok(serde_json::from_str(&cached_result)?);
    // }

    // ✅ NETTOYAGE FINAL AVANT INSERTION : Supprimer TOUTES les données volumineuses
    // Ce nettoyage est critique pour éviter l'erreur "index row requires X bytes, maximum size is 8191"
    
    // ✅ NOUVEAU: Extraire les données Google Places COMPLÈTES avant nettoyage
    // Elles seront sauvegardées dans la table google_places_data séparément
    let google_place_full_data = data_obj.get("google_place").cloned();
    
    let mut removed_count = 0;
    clean_media_recursive_final(&mut data_obj, &mut removed_count);
    
    if removed_count > 0 {
        log::info!(
            "[creer_service] ✅ Nettoyage final avant insertion ({} médias supprimés)",
            removed_count
        );
    }
    
    // ✅ NOUVEAU: Remplacer google_place par seulement place_id dans services.data
    // Les données complètes seront dans la table google_places_data
    if let Some(google_place) = data_obj.get_mut("google_place") {
        if let Some(gp_obj) = google_place.as_object_mut() {
            // Extraire seulement place_id pour garder la référence
            let place_id = gp_obj.get("place_id")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            
            // Remplacer l'objet complet par seulement place_id
            if let Some(pid) = place_id {
                *google_place = serde_json::json!({ "place_id": pid });
                log::info!("[creer_service] ✅ Google Places réduit à place_id seulement dans services.data");
            } else {
                // Si pas de place_id, supprimer complètement
                data_obj.as_object_mut().and_then(|m| m.remove("google_place"));
                log::warn!("[creer_service] ⚠️ Google Places sans place_id, supprimé de services.data");
            }
        }
    }
    
    // ✅ SUPPRIMÉ: Plus de troncature des descriptions
    // Les descriptions complètes sont maintenant conservées dans services.data
    
    // Vérifier la taille du JSON après nettoyage
    let json_size = serde_json::to_string(&data_obj)
        .map(|s| s.len())
        .unwrap_or(0);
    log::info!(
        "[creer_service] 📊 Taille du JSON après nettoyage: {} bytes (max recommandé: ~8000 bytes)",
        json_size
    );
    
    // ✅ CRITIQUE: Vérifier que le JSON n'est pas trop volumineux pour PostgreSQL (limite index: 8191 bytes)
    // Limite à 8000 bytes pour laisser une marge de sécurité
    if json_size > 8000 {
        // Si le JSON est encore trop volumineux après nettoyage, on refuse l'insertion
        log::error!(
            "[creer_service] ❌ JSON trop volumineux après nettoyage ({} bytes). Limite PostgreSQL: 8191 bytes.",
            json_size
        );
        return Err(AppError::Internal(format!(
            "Les données du service sont trop volumineuses ({} bytes). Veuillez retirer certaines images ou fichiers volumineux et réessayer.",
            json_size
        )));
    }
    
    if json_size > 5000 {
        log::warn!(
            "[creer_service] ⚠️ JSON volumineux après nettoyage ({} bytes). Proche de la limite.",
            json_size
        );
    }

    // ✅ CRITIQUE 2025-11-25 : Débiter le solde MAINTENANT, APRÈS toutes les validations
    // Cela évite de débiter si la création échoue à cause de la taille du JSON
    let debit_result = sqlx::query(
        "UPDATE users SET tokens_balance = tokens_balance - $1 WHERE id = $2 RETURNING tokens_balance"
    )
    .bind(cout_reel_xaf)
    .bind(user_id)
    .fetch_one(pool)
    .await;

    let new_balance = match debit_result {
        Ok(row) => row.try_get::<i64, _>("tokens_balance").unwrap_or(0),
        Err(e) => {
            log::error!(
                "[creer_service] ❌ Échec débit solde pour user {}: {}",
                user_id,
                e
            );
            return Err(AppError::Internal(format!("Erreur débit solde: {}", e)));
        }
    };

    log::info!(
        "[creer_service] ✅ Solde débité : {} FCFA (ancien: {}, nouveau: {})",
        cout_reel_xaf,
        current_balance,
        new_balance
    );

    let mut tx = pool
        .begin()
        .await
        .map_err(|e| AppError::Internal(format!("Échec début transaction: {}", e)))?;

    // Ajout des champs dans la transaction SQL
    // Étape 1 : INSERT dans services et récupérer l'id
    let row = sqlx::query(
        r#"
        INSERT INTO services (user_id, data, is_tarissable, gps, auto_deactivate_at)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id AS service_id
        "#,
    )
    .bind(user_id)
    .bind(&data_obj)
    .bind(is_tarissable)
    .bind(gps_str)
    .bind(auto_deactivate_at)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| {
        // Log détaillé pour diagnostiquer l'erreur
        let json_size = serde_json::to_string(&data_obj)
            .map(|s| s.len())
            .unwrap_or(0);
        let has_base64_image = data_obj
            .as_object()
            .and_then(|m| m.get("base64_image"))
            .is_some();
        
        log::error!(
            "[creer_service] Erreur SQL lors de l'insertion: {} | user_id={} | json_size={} bytes | has_base64_image={}",
            e,
            user_id,
            json_size,
            has_base64_image
        );
        
        // ✅ CRITIQUE 2025-11-25 : Rembourser le solde si l'insertion échoue
        // Le débit a été fait avant, donc on doit rembourser en cas d'échec
        // Note: On lance le remboursement en arrière-plan pour ne pas bloquer
        let pool_clone = pool.clone();
        let user_id_clone = user_id;
        let cout_reel_xaf_clone = cout_reel_xaf;
        tokio::spawn(async move {
            match sqlx::query(
                "UPDATE users SET tokens_balance = tokens_balance + $1 WHERE id = $2 RETURNING tokens_balance"
            )
            .bind(cout_reel_xaf_clone)
            .bind(user_id_clone)
            .fetch_one(&pool_clone)
            .await {
                Ok(refund_row) => {
                    if let Ok(refunded_balance) = refund_row.try_get::<i64, _>("tokens_balance") {
                        log::info!(
                            "[creer_service] ✅ Solde remboursé : {} FCFA (nouveau solde: {})",
                            cout_reel_xaf_clone,
                            refunded_balance
                        );
                    }
                }
                Err(refund_err) => {
                    log::error!(
                        "[creer_service] ❌ Échec remboursement solde pour user {} (montant: {} FCFA): {}",
                        user_id_clone,
                        cout_reel_xaf_clone,
                        refund_err
                    );
                }
            }
        });
        
        AppError::Internal(format!("Échec insertion service: {}", e))
    })?;

    let service_id: i32 = row
        .try_get("service_id")
        .map_err(|e| AppError::Internal(format!("Échec lecture service_id: {}", e)))?;

    // Étape 2 : UPDATE users pour activer le provider (pas bloquant si déjà TRUE)
    let _ = sqlx::query(
        r#"
        UPDATE users
           SET is_provider = TRUE
         WHERE id = $1 AND is_provider = FALSE
        "#,
    )
    .bind(user_id)
    .execute(&mut *tx)
    .await;

    // ✅ NOUVEAU : Sauvegarder tous les types de fichiers dans la table media
    let mut files_saved = 0;
    let storage_root = PathBuf::from(
        std::env::var("UPLOAD_STORAGE_PATH").unwrap_or_else(|_| "./uploads".to_string()),
    );
    let mut saved_service_images: Vec<String> = Vec::new();
    let mut saved_service_audios: Vec<String> = Vec::new();
    let mut saved_service_videos: Vec<String> = Vec::new();
    let mut saved_service_docs: Vec<String> = Vec::new();
    let mut saved_service_excels: Vec<String> = Vec::new();

    // ✅ AMÉLIORATION : Sauvegarder les images PAR PRODUIT (avec product_index)
    // ✅ PHASE 10: Extraire d'abord les images du service pour les ajouter au premier produit
    // ⚠️ IMPORTANT: On utilise data_processed (qui contient encore les médias base64) pour sauvegarder les médias
    // data_obj a été nettoyé pour l'insertion, mais data_processed conserve les médias pour la sauvegarde
    //
    // 📋 RÈGLES DE LIAISON DES MÉDIAS :
    // - Médias de produits (images/vidéos dans produits[]) : product_id + product_index (SANS AMBIGUÏTÉ)
    // - Médias globaux du service (logo/bannière/audio/vidéo/doc/excel) : product_id = NULL, product_index = NULL (liés au service)
    // - GPS : Au niveau service (services.gps ou services.data->'location'), pas dans media
    // - Localisation produit : Dans service.data->'produits'[index]->'lieu_produit' (quartier, ville, pays)
    let service_images: Vec<String> = data_processed
        .get("base64_image")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect()
        })
        .unwrap_or_default();
    
    log::info!(
        "[creer_service] 💾 Début sauvegarde médias pour service {} ({} images globales trouvées dans data_processed)",
        service_id,
        service_images.len()
    );

    // ✅ CRITIQUE: Extraire les produits depuis data_processed (qui contient encore les médias base64)
    // data_obj a été nettoyé, donc on doit utiliser data_processed pour récupérer les médias
    let produits_array_from_processed = data_processed
        .get("produits")
        .and_then(|v| v.as_object())
        .and_then(|obj| obj.get("valeur"))
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();

    if let Some(produits_array) = produits_array_mut(&mut data_obj) {
        log::info!(
            "[creer_service] 📦 Sauvegarde médias pour {} produits",
            produits_array.len()
        );

        let mut saved_image_paths_by_product: Vec<Vec<String>> =
            Vec::with_capacity(produits_array.len());

        for (product_index, produit_value) in produits_array.iter_mut().enumerate() {
            let produit_obj = match produit_value.as_object_mut() {
                Some(obj) => obj,
                None => {
                    saved_image_paths_by_product.push(Vec::new());
                    continue;
                }
            };

            let product_id = produit_obj
                .get("id")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
                .unwrap_or_else(|| format!("prod_{}", product_index));

            log::info!(
                "[creer_service] 📦 Produit {} (index {}): {}",
                product_id,
                product_index,
                produit_obj
                    .get("nom")
                    .and_then(|v| v.as_str())
                    .unwrap_or("Sans nom")
            );

            // ✅ CRITIQUE: Extraire les médias depuis data_processed (non nettoyé) au lieu de data_obj
            let produit_from_processed = produits_array_from_processed
                .get(product_index)
                .and_then(|v| v.as_object());

            let mut images_to_process: Vec<String> = Vec::new();
            if product_index == 0 && !service_images.is_empty() {
                log::info!(
                    "[creer_service] 🖼️ PHASE 10: Ajout de {} image(s) du service comme première(s) image(s) du premier produit",
                    service_images.len()
                );
                images_to_process.extend(service_images.clone());
            }

            // Extraire depuis data_processed (contient les médias base64)
            if let Some(prod_processed) = produit_from_processed {
                // Chercher dans "images" (URLs ou base64)
                if let Some(product_images) = prod_processed.get("images").and_then(|v| v.as_array()) {
                    images_to_process.extend(
                        product_images
                            .iter()
                            .filter_map(|v| v.as_str().map(|s| s.to_string())),
                    );
                }
                // Chercher dans "images_base64" ou "image_base64" (base64)
                if let Some(images_base64) = prod_processed.get("images_base64").and_then(|v| v.as_array()) {
                    images_to_process.extend(
                        images_base64
                            .iter()
                            .filter_map(|v| v.as_str().map(|s| s.to_string())),
                    );
                }
                if let Some(image_base64) = prod_processed.get("image_base64").and_then(|v| v.as_str()) {
                    images_to_process.push(image_base64.to_string());
                }
            }

            // Nettoyer data_obj (supprimer les médias pour l'insertion)
            produit_obj.remove("images");
            produit_obj.remove("images_base64");
            produit_obj.remove("image_base64");

            let mut saved_paths_for_product: Vec<String> = Vec::new();

            if !images_to_process.is_empty() {
                let service_image_count = if product_index == 0 {
                    service_images.len()
                } else {
                    0
                };

                for (image_index, image_data) in images_to_process.iter().enumerate() {
                    if image_data.is_empty() {
                        continue;
                    }

                    let is_main = image_index == 0;

                    log::info!(
                        "[creer_service] 🖼️ Image {} de produit {} (main: {}): {}",
                        image_index,
                        product_index,
                        is_main,
                        &image_data[..image_data.len().min(50)]
                    );

                    let stored = if image_data.starts_with("http") {
                        Ok(StoredMedia {
                            path: image_data.to_string(),
                            bytes: Vec::new(),
                        })
                    } else if is_probable_base64(image_data) {
                        persist_base64_media(
                            storage_root.as_path(),
                            service_id,
                            "images",
                            image_data,
                            "jpg",
                        )
                        .await
                    } else {
                        log::warn!(
                            "[creer_service] Image ignorée (format non supporté) pour produit {}",
                            product_index
                        );
                        continue;
                    };

                    let stored = match stored {
                        Ok(value) => value,
                        Err(err) => {
                            log::error!(
                                "[creer_service] Erreur sauvegarde image produit {}: {}",
                                product_index,
                                err
                            );
                            continue;
                        }
                    };

                    let StoredMedia {
                        path: file_path,
                        bytes: image_bytes,
                    } = stored;

                    #[cfg(not(feature = "image_search"))]
                    let _ = &image_bytes;

                    #[cfg(feature = "image_search")]
                    let (image_signature, image_hash, image_metadata) = if !image_bytes.is_empty() {
                        match crate::services::image_search_service::ImageSearchService::
                            generate_image_signature(&image_bytes)
                        {
                            Ok(signature) => {
                                let metadata = crate::services::image_search_service::ImageSearchService::extract_image_metadata(&image_bytes).unwrap_or_else(|_| {
                                    serde_json::json!({
                                        "width": 0,
                                        "height": 0,
                                        "format": "jpeg",
                                        "file_size": image_bytes.len(),
                                        "dominant_colors": [],
                                        "color_histogram": [],
                                        "edge_density": 0.0,
                                        "brightness": 0.0,
                                        "contrast": 0.0,
                                    })
                                });
                                let hash = format!("{:x}", md5::compute(&image_bytes));
                                (
                                    serde_json::to_value(&signature).unwrap_or_default(),
                                    hash,
                                    metadata,
                                )
                            }
                            Err(e) => {
                                log::warn!("[creer_service] Erreur signature: {}", e);
                                (
                                    serde_json::Value::Null,
                                    String::new(),
                                    serde_json::Value::Null,
                                )
                            }
                        }
                    } else {
                        (
                            serde_json::Value::Null,
                            String::new(),
                            serde_json::Value::Null,
                        )
                    };

                    #[cfg(not(feature = "image_search"))]
                    let (image_signature, image_hash, image_metadata) = (
                        serde_json::Value::Null,
                        String::new(),
                        serde_json::Value::Null,
                    );

                    // ✅ MÉDIA DE PRODUIT : Image liée à un produit spécifique
                    // Liaison SANS AMBIGUÏTÉ via (service_id, product_index)
                    // product_id = ID du produit (ex: "prod_0"), product_index = index dans service.data->'produits'[]
                    if let Err(e) = sqlx::query(
                        r#"
                        INSERT INTO media (
                            service_id, product_id, product_index, type, path,
                            is_main_image, display_order, uploaded_at,
                            image_signature, image_hash, image_metadata
                        )
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                        "#,
                    )
                    .bind(service_id)
                    .bind(&product_id)
                    .bind(product_index as i32)
                    .bind("image")
                    .bind(&file_path)
                    .bind(is_main)
                    .bind(image_index as i32)
                    .bind(Utc::now().naive_utc())
                    .bind(image_signature)
                    .bind(image_hash)
                    .bind(image_metadata)
                    .execute(&mut *tx)
                    .await
                    {
                        log::error!("[creer_service] Erreur insertion media: {}", e);
                        continue;
                    }

                    let product_name = produit_obj
                        .get("nom")
                        .and_then(|v| v.as_str())
                        .unwrap_or("");
                    let product_description = produit_obj
                        .get("description")
                        .and_then(|v| v.as_str())
                        .unwrap_or("");
                    let product_marque = produit_obj.get("marque").and_then(|v| v.as_str());
                    let product_category = produit_obj
                        .get("categorie")
                        .or_else(|| produit_obj.get("category"))
                        .and_then(|v| v.as_str());
                    let product_couleurs: Vec<String> = produit_obj
                        .get("couleurs")
                        .and_then(|v| v.as_array())
                        .map(|arr| {
                            arr.iter()
                                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                                .collect()
                        })
                        .unwrap_or_default();

                    let ai_description = if !product_description.is_empty() {
                        product_description.to_string()
                    } else if !product_name.is_empty() {
                        format!(
                            "{} - {}",
                            product_name,
                            produit_obj
                                .get("prix")
                                .and_then(|v| v.as_str())
                                .unwrap_or("")
                        )
                    } else {
                        String::new()
                    };

                    let mut ai_tags: Vec<String> = Vec::new();
                    if !product_name.is_empty() {
                        ai_tags.push(product_name.to_string());
                    }
                    if let Some(marque) = product_marque {
                        ai_tags.push(marque.to_string());
                    }
                    ai_tags.extend(product_couleurs.clone());
                    if let Some(cat) = product_category {
                        ai_tags.push(cat.to_string());
                    }

                    let mut ai_metadata = serde_json::json!({});
                    if let Some(marque) = product_marque {
                        ai_metadata["marque"] = serde_json::json!(marque);
                    }
                    if !product_couleurs.is_empty() {
                        ai_metadata["couleurs"] = serde_json::json!(product_couleurs);
                    }
                    if let Some(prix) = produit_obj.get("prix").and_then(|v| v.as_str()) {
                        ai_metadata["prix"] = serde_json::json!(prix);
                    }

                    if !ai_description.is_empty() || !ai_tags.is_empty() {
                        if let Err(e) = sqlx::query(
                            r#"
                            UPDATE media
                            SET ai_description = $1,
                                ai_tags = $2,
                                ai_category = $3,
                                ai_metadata = $4,
                                ai_analyzed_at = $5,
                                ai_confidence = 0.95
                            WHERE service_id = $6 AND path = $7
                            "#,
                        )
                        .bind(if ai_description.is_empty() {
                            None::<String>
                        } else {
                            Some(ai_description.clone())
                        })
                        .bind(if ai_tags.is_empty() {
                            None::<Vec<String>>
                        } else {
                            Some(ai_tags.clone())
                        })
                        .bind(product_category)
                        .bind(if ai_metadata.is_null() {
                            None::<serde_json::Value>
                        } else {
                            Some(ai_metadata.clone())
                        })
                        .bind(Utc::now().naive_utc())
                        .bind(service_id)
                        .bind(&file_path)
                        .execute(&mut *tx)
                        .await
                        {
                            log::warn!("[creer_service] ⚠️ Erreur mise à jour media.ai_*: {}", e);
                        } else {
                            log::info!(
                                "[creer_service] ✅ Image cataloguée avec données produit ({} tags)",
                                ai_tags.len()
                            );
                        }
                    }

                    files_saved += 1;
                    if product_index == 0 && image_index < service_image_count {
                        saved_service_images.push(file_path.clone());
                    }
                    saved_paths_for_product.push(file_path.clone());
                    log::info!(
                        "[creer_service] ✅ Image {}/{} du produit {} sauvegardée (main: {})",
                        image_index + 1,
                        images_to_process.len(),
                        product_index,
                        is_main
                    );
                }
            }

            if !saved_paths_for_product.is_empty() {
                let image_paths_json: Vec<serde_json::Value> = saved_paths_for_product
                    .iter()
                    .map(|path| serde_json::Value::String(path.clone()))
                    .collect();
                produit_obj.insert(
                    "images".to_string(),
                    serde_json::Value::Array(image_paths_json),
                );
            }

            saved_image_paths_by_product.push(saved_paths_for_product.clone());

            if let Some(product_videos) = produit_obj.get("videos").and_then(|v| v.as_array()) {
                for (video_index, vid_url) in product_videos.iter().enumerate() {
                    if let Some(video_path) = vid_url.as_str() {
                        let file_path = if video_path.starts_with("http") {
                            video_path.to_string()
                        } else {
                            format!("video_{}_{}.mp4", service_id, Uuid::new_v4())
                        };

                        // ✅ MÉDIA DE PRODUIT : Vidéo liée à un produit spécifique
                        // Liaison SANS AMBIGUÏTÉ via (service_id, product_index)
                        // product_id = ID du produit (ex: "prod_0"), product_index = index dans service.data->'produits'[]
                        if let Err(e) = sqlx::query(
                            r#"
                            INSERT INTO media (
                                service_id, product_id, product_index, type, path,
                                is_main_image, display_order, uploaded_at
                            )
                            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                            "#,
                        )
                        .bind(service_id)
                        .bind(&product_id)
                        .bind(product_index as i32)
                        .bind("video")
                        .bind(&file_path)
                        .bind(video_index == 0)
                        .bind(video_index as i32)
                        .bind(Utc::now().naive_utc())
                        .execute(&mut *tx)
                        .await
                        {
                            log::error!("[creer_service] Erreur insertion media video: {}", e);
                            continue;
                        }

                        files_saved += 1;
                        log::info!(
                            "[creer_service] ✅ Vidéo {}/{} du produit {} sauvegardée",
                            video_index + 1,
                            product_videos.len(),
                            product_index
                        );
                    }
                }
            }
        }

        if let Some(first_product) = produits_array.get_mut(0) {
            if let Some(first_product_obj) = first_product.as_object_mut() {
                if !saved_image_paths_by_product.is_empty()
                    && !saved_image_paths_by_product[0].is_empty()
                {
                    let image_paths_json: Vec<serde_json::Value> = saved_image_paths_by_product[0]
                        .iter()
                        .map(|path| serde_json::Value::String(path.clone()))
                        .collect();

                    first_product_obj.insert(
                        "images".to_string(),
                        serde_json::Value::Array(image_paths_json),
                    );

                    log::info!(
                        "[creer_service] ✅ CORRECTION: Champ 'images' du premier produit mis à jour avec {} chemin(s), images du service en premier",
                        saved_image_paths_by_product[0].len()
                    );
                }
            }
        }
    }

    // ✅ FALLBACK : si aucune image de service n'a été sauvegardée via les produits
    if saved_service_images.is_empty() {
        if let Some(images) = data_processed
            .get("base64_image")
            .and_then(|v| v.as_array())
        {
            let image_strings: Vec<String> = images
                .iter()
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect();

            if !image_strings.is_empty() {
                log::info!(
                    "[creer_service] 🖼️ Sauvegarde de {} images globales pour le service {}",
                    image_strings.len(),
                    service_id
                );

                for (i, image_data) in image_strings.iter().enumerate() {
                    if !is_probable_base64(image_data) {
                        log::warn!(
                            "[creer_service] Image globale ignorée (format non supporté) index {}",
                            i
                        );
                        continue;
                    }

                    let stored = match persist_base64_media(
                        storage_root.as_path(),
                        service_id,
                        "images",
                        image_data,
                        "jpg",
                    )
                    .await
                    {
                        Ok(value) => value,
                        Err(err) => {
                            log::error!(
                                "[creer_service] Erreur sauvegarde image globale {}: {}",
                                i,
                                err
                            );
                            continue;
                        }
                    };

                    let StoredMedia {
                        path: file_path,
                        bytes: image_bytes,
                    } = stored;

                    #[cfg(not(feature = "image_search"))]
                    let _ = &image_bytes;

                    #[cfg(feature = "image_search")]
                    let (image_signature, image_hash, image_metadata) = {
                        if !image_bytes.is_empty() {
                            match crate::services::image_search_service::ImageSearchService::
                                generate_image_signature(&image_bytes)
                            {
                                Ok(signature) => {
                                    let metadata = crate::services::image_search_service::ImageSearchService::extract_image_metadata(&image_bytes).unwrap_or_else(|_| {
                                        serde_json::json!({
                                            "width": 0,
                                            "height": 0,
                                            "format": "jpeg",
                                            "file_size": image_bytes.len(),
                                            "dominant_colors": [],
                                            "color_histogram": [],
                                            "edge_density": 0.0,
                                            "brightness": 0.0,
                                            "contrast": 0.0,
                                        })
                                    });
                                    let hash = format!("{:x}", md5::compute(&image_bytes));
                                    (
                                        serde_json::to_value(&signature).unwrap_or_default(),
                                        hash,
                                        metadata,
                                    )
                                }
                                Err(e) => {
                                    log::warn!(
                                        "[creer_service] Erreur signature image globale {}: {}",
                                        i,
                                        e
                                    );
                                    (
                                        serde_json::Value::Null,
                                        String::new(),
                                        serde_json::Value::Null,
                                    )
                                }
                            }
                        } else {
                            (
                                serde_json::Value::Null,
                                String::new(),
                                serde_json::Value::Null,
                            )
                        }
                    };

                    #[cfg(not(feature = "image_search"))]
                    let (image_signature, image_hash, image_metadata) = (
                        serde_json::Value::Null,
                        String::new(),
                        serde_json::Value::Null,
                    );

                    // ✅ MÉDIA GLOBAL DU SERVICE : Logo/Bannière lié au service (pas à un produit spécifique)
                    // product_id = NULL, product_index = NULL (normal pour médias globaux)
                    if let Err(e) = sqlx::query(
                        r#"
                        INSERT INTO media (service_id, type, path, uploaded_at, image_signature, image_hash, image_metadata) 
                        VALUES ($1, $2, $3, $4, $5, $6, $7)
                        "#
                    )
                    .bind(service_id)
                    .bind("image")
                    .bind(&file_path)
                    .bind(Utc::now().naive_utc())
                    .bind(image_signature)
                    .bind(image_hash)
                    .bind(image_metadata)
                    .execute(&mut *tx)
                    .await
                    {
                        log::error!(
                            "[creer_service] Erreur insertion media image globale: {}",
                            e
                        );
                        continue;
                    }

                    saved_service_images.push(file_path.clone());
                    files_saved += 1;
                    log::info!(
                        "[creer_service] Image globale {} du service {} sauvegardée",
                        i + 1,
                        service_id
                    );
                }
            }
        }
    }

    // Audios
    if let Some(audios) = data_processed
        .get("audio_base64")
        .and_then(|v| v.as_array())
    {
        let audio_strings: Vec<String> = audios
            .iter()
            .filter_map(|v| v.as_str().map(|s| s.to_string()))
            .collect();

        if !audio_strings.is_empty() {
            log::info!(
                "[creer_service] Sauvegarde de {} audios pour le service {}",
                audio_strings.len(),
                service_id
            );

            for (idx, audio_data) in audio_strings.iter().enumerate() {
                if !is_probable_base64(audio_data) {
                    log::warn!(
                        "[creer_service] Audio ignoré (format non supporté) index {}",
                        idx
                    );
                    continue;
                }

                let stored = match persist_base64_media(
                    storage_root.as_path(),
                    service_id,
                    "audio",
                    audio_data,
                    "mp3",
                )
                .await
                {
                    Ok(value) => value,
                    Err(err) => {
                        log::error!("[creer_service] Erreur sauvegarde audio {}: {}", idx, err);
                        continue;
                    }
                };

                let path = stored.path;
                // ✅ MÉDIA GLOBAL DU SERVICE : Audio lié au service (pas à un produit spécifique)
                // product_id = NULL, product_index = NULL (normal pour médias globaux)
                if let Err(e) = sqlx::query(
                    "INSERT INTO media (service_id, type, path, uploaded_at) VALUES ($1, $2, $3, $4)",
                )
                .bind(service_id)
                .bind("audio")
                .bind(&path)
                .bind(Utc::now().naive_utc())
                .execute(&mut *tx)
                .await
                {
                    log::error!("[creer_service] Erreur insertion media audio: {}", e);
                    continue;
                }

                saved_service_audios.push(path.clone());
                files_saved += 1;
            }
        }
    }

    // Vidéos
    if let Some(videos) = data_processed
        .get("video_base64")
        .and_then(|v| v.as_array())
    {
        let video_strings: Vec<String> = videos
            .iter()
            .filter_map(|v| v.as_str().map(|s| s.to_string()))
            .collect();

        if !video_strings.is_empty() {
            log::info!(
                "[creer_service] Sauvegarde de {} vidéos pour le service {}",
                video_strings.len(),
                service_id
            );

            for (idx, video_data) in video_strings.iter().enumerate() {
                if !is_probable_base64(video_data) {
                    log::warn!(
                        "[creer_service] Vidéo ignorée (format non supporté) index {}",
                        idx
                    );
                    continue;
                }

                let stored = match persist_base64_media(
                    storage_root.as_path(),
                    service_id,
                    "videos",
                    video_data,
                    "mp4",
                )
                .await
                {
                    Ok(value) => value,
                    Err(err) => {
                        log::error!("[creer_service] Erreur sauvegarde vidéo {}: {}", idx, err);
                        continue;
                    }
                };

                let path = stored.path;
                // ✅ MÉDIA GLOBAL DU SERVICE : Vidéo liée au service (pas à un produit spécifique)
                // product_id = NULL, product_index = NULL (normal pour médias globaux)
                // Note: Les vidéos de produits sont sauvegardées plus haut avec product_index (ligne ~1649)
                if let Err(e) = sqlx::query(
                    "INSERT INTO media (service_id, type, path, uploaded_at) VALUES ($1, $2, $3, $4)",
                )
                .bind(service_id)
                .bind("video")
                .bind(&path)
                .bind(Utc::now().naive_utc())
                .execute(&mut *tx)
                .await
                {
                    log::error!("[creer_service] Erreur insertion media video: {}", e);
                    continue;
                }

                saved_service_videos.push(path.clone());
                files_saved += 1;
            }
        }
    }

    // Documents
    if let Some(docs) = data_processed.get("doc_base64").and_then(|v| v.as_array()) {
        let doc_strings: Vec<String> = docs
            .iter()
            .filter_map(|v| v.as_str().map(|s| s.to_string()))
            .collect();

        if !doc_strings.is_empty() {
            log::info!(
                "[creer_service] Sauvegarde de {} documents pour le service {}",
                doc_strings.len(),
                service_id
            );

            for (idx, doc_data) in doc_strings.iter().enumerate() {
                if !is_probable_base64(doc_data) {
                    log::warn!(
                        "[creer_service] Document ignoré (format non supporté) index {}",
                        idx
                    );
                    continue;
                }

                let stored = match persist_base64_media(
                    storage_root.as_path(),
                    service_id,
                    "documents",
                    doc_data,
                    "pdf",
                )
                .await
                {
                    Ok(value) => value,
                    Err(err) => {
                        log::error!(
                            "[creer_service] Erreur sauvegarde document {}: {}",
                            idx,
                            err
                        );
                        continue;
                    }
                };

                let path = stored.path;
                // ✅ MÉDIA GLOBAL DU SERVICE : Document lié au service (pas à un produit spécifique)
                // product_id = NULL, product_index = NULL (normal pour médias globaux)
                if let Err(e) = sqlx::query(
                    "INSERT INTO media (service_id, type, path, uploaded_at) VALUES ($1, $2, $3, $4)",
                )
                .bind(service_id)
                .bind("document")
                .bind(&path)
                .bind(Utc::now().naive_utc())
                .execute(&mut *tx)
                .await
                {
                    log::error!("[creer_service] Erreur insertion media document: {}", e);
                    continue;
                }

                saved_service_docs.push(path.clone());
                files_saved += 1;
            }
        }
    }

    // Excel
    if let Some(excels) = data_processed
        .get("excel_base64")
        .and_then(|v| v.as_array())
    {
        let excel_strings: Vec<String> = excels
            .iter()
            .filter_map(|v| v.as_str().map(|s| s.to_string()))
            .collect();

        if !excel_strings.is_empty() {
            log::info!(
                "[creer_service] Sauvegarde de {} fichiers excel pour le service {}",
                excel_strings.len(),
                service_id
            );

            for (idx, excel_data) in excel_strings.iter().enumerate() {
                if !is_probable_base64(excel_data) {
                    log::warn!(
                        "[creer_service] Fichier excel ignoré (format non supporté) index {}",
                        idx
                    );
                    continue;
                }

                let stored = match persist_base64_media(
                    storage_root.as_path(),
                    service_id,
                    "excel",
                    excel_data,
                    "xlsx",
                )
                .await
                {
                    Ok(value) => value,
                    Err(err) => {
                        log::error!("[creer_service] Erreur sauvegarde excel {}: {}", idx, err);
                        continue;
                    }
                };

                let path = stored.path;
                // ✅ MÉDIA GLOBAL DU SERVICE : Fichier Excel lié au service (pas à un produit spécifique)
                // product_id = NULL, product_index = NULL (normal pour médias globaux)
                if let Err(e) = sqlx::query(
                    "INSERT INTO media (service_id, type, path, uploaded_at) VALUES ($1, $2, $3, $4)",
                )
                .bind(service_id)
                .bind("excel")
                .bind(&path)
                .bind(Utc::now().naive_utc())
                .execute(&mut *tx)
                .await
                {
                    log::error!("[creer_service] Erreur insertion media excel: {}", e);
                    continue;
                }

                saved_service_excels.push(path.clone());
                files_saved += 1;
            }
        }
    }

    if let Some(map) = data_obj.as_object_mut() {
        let to_json_array = |items: &Vec<String>| -> serde_json::Value {
            serde_json::Value::Array(
                items
                    .iter()
                    .map(|p| serde_json::Value::String(p.clone()))
                    .collect(),
            )
        };

        map.remove("images");
        map.remove("audios");
        map.remove("videos");
        map.remove("documents");
        map.remove("excels");

        if !saved_service_images.is_empty() {
            map.insert("images".to_string(), to_json_array(&saved_service_images));
        }
        if !saved_service_audios.is_empty() {
            map.insert("audios".to_string(), to_json_array(&saved_service_audios));
        }
        if !saved_service_videos.is_empty() {
            map.insert("videos".to_string(), to_json_array(&saved_service_videos));
        }
        if !saved_service_docs.is_empty() {
            map.insert("documents".to_string(), to_json_array(&saved_service_docs));
        }
        if !saved_service_excels.is_empty() {
            map.insert("excels".to_string(), to_json_array(&saved_service_excels));
        }

        for key in [
            "base64_image",
            "audio_base64",
            "video_base64",
            "doc_base64",
            "excel_base64",
        ] {
            map.remove(key);
        }
    }

    if files_saved > 0 {
        log::info!(
            "[creer_service] ✅ Total de {} fichiers sauvegardés pour le service {} (images: {}, audios: {}, videos: {}, docs: {}, excels: {})",
            files_saved,
            service_id,
            saved_service_images.len(),
            saved_service_audios.len(),
            saved_service_videos.len(),
            saved_service_docs.len(),
            saved_service_excels.len()
        );
    } else {
        log::warn!(
            "[creer_service] ⚠️ Aucun fichier média sauvegardé pour le service {} (vérifier data_processed)",
            service_id
        );
    }

    // ✅ NOTE: PINECONE SUSPENDU - Vérifier si le service est disponible
    let pinecone_enabled = std::env::var("PINECONE_ENABLED")
        .unwrap_or_else(|_| "false".to_string())
        .parse::<bool>()
        .unwrap_or(false);
    
    let embedding_client = if pinecone_enabled {
        log::info!("[EMBEDDING_DEBUG] ?? Initialisation du client d'embedding (Pinecone activé)...");
        Some(crate::utils::embedding_client::EmbeddingClient::new("", ""))
    } else {
        log::info!("[EMBEDDING_DEBUG] ⚠️ Pinecone désactivé (PINECONE_ENABLED=false ou non défini)");
        None
    };
    // Calcul GPS optimal (service ou fallback prestataire)
    let (_gps_lat, _gps_lon) = {
        // 1. Nouveau format : gps avec lat/lon directement
        if let Some(gps_obj) = data_obj.get("gps").and_then(|v| v.as_object()) {
            if let (Some(lat), Some(lon)) = (
                gps_obj.get("lat").and_then(|v| v.as_f64()),
                gps_obj.get("lon").and_then(|v| v.as_f64()),
            ) {
                (Some(lat), Some(lon))
            } else {
                // 2. Si gps=true, on attend gps_coords (string lat,lon)
                let gps_bool = data_obj
                    .get("gps")
                    .and_then(|v| v.as_bool())
                    .unwrap_or(false);
                if gps_bool {
                    if let Some(gps_coords) = data_obj.get("gps_coords").and_then(|v| v.as_str()) {
                        let parts: Vec<&str> = gps_coords.split(',').map(|s| s.trim()).collect();
                        if parts.len() == 2 {
                            let lat = parts[0].parse::<f64>();
                            let lon = parts[1].parse::<f64>();
                            match (lat, lon) {
                                (Ok(lat), Ok(lon)) => (Some(lat), Some(lon)),
                                _ => (None, None),
                            }
                        } else {
                            (None, None)
                        }
                    } else {
                        (None, None)
                    }
                } else if let Some(gps_str) = data_obj.get("gps").and_then(|v| v.as_str()) {
                    // 3. Fallback : gps (string lat,lon)
                    let parts: Vec<&str> = gps_str.split(',').map(|s| s.trim()).collect();
                    if parts.len() == 2 {
                        let lat = parts[0].parse::<f64>();
                        let lon = parts[1].parse::<f64>();
                        match (lat, lon) {
                            (Ok(lat), Ok(lon)) => (Some(lat), Some(lon)),
                            _ => (None, None),
                        }
                    } else {
                        (None, None)
                    }
                } else {
                    // 4. Fallback : GPS du prestataire
                    match get_user_gps(pool, user_id).await {
                        Ok((lon, lat)) => (Some(lat), Some(lon)),
                        Err(_) => (None, None),
                    }
                }
            }
        } else {
            // 2. Si gps=true, on attend gps_coords (string lat,lon)
            let gps_bool = data_obj
                .get("gps")
                .and_then(|v| v.as_bool())
                .unwrap_or(false);
            if gps_bool {
                if let Some(gps_coords) = data_obj.get("gps_coords").and_then(|v| v.as_str()) {
                    let parts: Vec<&str> = gps_coords.split(',').map(|s| s.trim()).collect();
                    if parts.len() == 2 {
                        let lat = parts[0].parse::<f64>();
                        let lon = parts[1].parse::<f64>();
                        match (lat, lon) {
                            (Ok(lat), Ok(lon)) => (Some(lat), Some(lon)),
                            _ => (None, None),
                        }
                    } else {
                        (None, None)
                    }
                } else {
                    (None, None)
                }
            } else if let Some(gps_str) = data_obj.get("gps").and_then(|v| v.as_str()) {
                // 3. Fallback : gps (string lat,lon)
                let parts: Vec<&str> = gps_str.split(',').map(|s| s.trim()).collect();
                if parts.len() == 2 {
                    let lat = parts[0].parse::<f64>();
                    let lon = parts[1].parse::<f64>();
                    match (lat, lon) {
                        (Ok(lat), Ok(lon)) => (Some(lat), Some(lon)),
                        _ => (None, None),
                    }
                } else {
                    (None, None)
                }
            } else {
                // 4. Fallback : GPS du prestataire
                match get_user_gps(pool, user_id).await {
                    Ok((lon, lat)) => (Some(lat), Some(lon)),
                    Err(_) => (None, None),
                }
            }
        }
    };
    // Utilisation directe de gps_lat et gps_lon dans la boucle, plus besoin de gps_lat_fallback/gps_lon_fallback
    // Génération et insertion des embeddings pour chaque champ du service
    let mut embedding_tasks = Vec::new();

    // Préparation des données d'embedding en parallèle
    let map = if let Some(obj) = data_obj.as_object() {
        obj.clone() // Clonage de la map pour qu'elle vive assez longtemps
    } else {
        serde_json::Map::new()
    };

    log::info!(
        "[EMBEDDING_DEBUG] ?? Données ? traiter pour embedding: {:?}",
        map.keys().collect::<Vec<_>>()
    );

    for (k, valeur) in map {
        // Ne jamais vectoriser le champ 'intention'
        if k == "intention" {
            log::info!("[EMBEDDING_DEBUG] ??  Champ 'intention' ignoré");
            continue;
        }
        let type_donnee_raw = if let Some(obj) = valeur.as_object() {
            obj.get("type_donnee")
                .and_then(|v| v.as_str())
                .unwrap_or("texte")
        } else {
            "texte"
        };
        let type_donnee = map_type_for_pinecone(type_donnee_raw);
        let value_str = if let Some(obj) = valeur.as_object() {
            obj.get("valeur")
                .map(|v| v.to_string())
                .unwrap_or_else(|| valeur.to_string())
        } else {
            valeur.to_string()
        };
        log::info!("[PINECONE][SERVICE] Préparation embedding: champ='{}', type_donnee='{}', extrait='{}', service_id={}", k, type_donnee, &value_str.chars().take(80).collect::<String>(), service_id);

        // Créer une tâche asynchrone pour chaque embedding
        let embedding_task = {
            let embedding_client = embedding_client.clone();
            let _pinecone_enabled = pinecone_enabled;
            let k = k.clone();
            let value_str = value_str.clone();
            let type_donnee = type_donnee.to_string();
            let service_id = service_id;
            let mut token_tracker = token_tracker.clone();
            let valeur = valeur.clone();

            tokio::spawn(async move {
                let mut value_for_embedding = value_str.clone();
                let mut meta_lang: Option<String> = None;
                let mut meta_unite: Option<String> = None;
                let mut meta_devise: Option<String> = None;

                let _lang = if type_donnee == "texte" {
                    let detected = detect_lang(&value_str);
                    meta_lang = Some(detected.clone());
                    value_for_embedding = translate_to_en(&value_str, &detected).await;
                    // Tracker la traduction
                    token_tracker.add_translation(value_str.len());
                    detected
                } else {
                    "und".to_string()
                };

                // Extraction unit?/devise pour numériques
                if ["int", "float", "nombre", "prix", "montant"].contains(&type_donnee.as_str()) {
                    if let Some(obj) = valeur.as_object() {
                        if let Some(u) = obj.get("unite").and_then(|v| v.as_str()) {
                            meta_unite = Some(u.to_string());
                        }
                        if let Some(d) = obj.get("devise").and_then(|v| v.as_str()) {
                            meta_devise = Some(d.to_string());
                        }
                    }
                }

                // Utilisation de AddEmbeddingPineconeRequest réactivée
                let embedding_request = AddEmbeddingPineconeRequest {
                    value: value_for_embedding,
                    type_donnee: type_donnee.clone(),
                    service_id,
                    gps_lat: None,
                    gps_lon: None,
                    langue: Some(meta_lang.unwrap_or_else(|| "und".to_string())),
                    active: Some(true),
                    type_metier: Some("service".to_string()),
                    unite: meta_unite,
                    devise: meta_devise,
                };

                // ✅ Vérifier si Pinecone est activé avant d'appeler
                if let Some(ref client) = embedding_client {
                    log::info!(
                        "[PINECONE][SERVICE] Appel add_embedding_pinecone ({}): {:?}",
                        type_donnee,
                        embedding_request
                    );

                    match client
                        .add_embedding_pinecone(&embedding_request)
                        .await
                    {
                        Ok(result) => {
                            log::info!("[PINECONE][SERVICE] Embedding {} ajouté?: champ='{}', service_id={}, retour={:?}", type_donnee, k, service_id, result);
                            Ok(result)
                        }
                        Err(e) => {
                            log::error!("[PINECONE][SERVICE] Erreur embedding {}: champ='{}', service_id={}, erreur={:?}", type_donnee, k, service_id, e);
                            Err(e)
                        }
                    }
                } else {
                    log::info!("[PINECONE][SERVICE] ⚠️ Pinecone désactivé - Embedding ignoré pour champ '{}'", k);
                    // Retourner un résultat vide pour ne pas bloquer le processus
                    Ok(serde_json::json!({"status": "skipped", "reason": "pinecone_disabled"}))
                }
            })
        };

        embedding_tasks.push((k.clone(), embedding_task));
    }

    // Plus besoin de vérifier l'intention

    // ? OPTIMISATION : Réponse immédiate au frontend après création en base
    // Les embeddings continuent en arrière-plan
    let service_creation_result = serde_json::json!({
        "message":        "? Service cr?? avec succ?s",
        "service_id":     service_id,
        "user_id":        user_id,
        "donnees_envoyees": data_obj.clone(),
        "tokens_consumed": token_tracker.total_tokens,
        "token_breakdown": {
            "validation_tokens": token_tracker.validation_tokens,
            "embedding_tokens": token_tracker.embedding_tokens,
            "translation_tokens": token_tracker.translation_tokens,
            "ocr_tokens": token_tracker.ocr_tokens,
            "enrichment_tokens": token_tracker.enrichment_tokens
        },
        "embedding_status": "processing", // Indique que les embeddings sont en cours
        "estimated_embedding_time": "5-10 seconds"
    });

    log::info!(
        "[creer_service] Réponse JSON construite avec tokens_consumed: {}",
        token_tracker.total_tokens
    );
    log::info!(
        "[creer_service] Réponse complète: {}",
        serde_json::to_string_pretty(&service_creation_result).unwrap_or_default()
    );

    // Lancer les embeddings en arrière-plan sans bloquer la réponse
    let _background_embedding_task = {
        let embedding_tasks = embedding_tasks;
        let service_id = service_id;
        let _data_obj = data_obj.clone();

        tokio::spawn(async move {
            log::info!(
                "[PINECONE][BACKGROUND] ?? Démarrage embeddings en arrière-plan pour service {}",
                service_id
            );

            // Attendre et traiter tous les résultats d'embedding en parallèle
            use std::sync::{Arc, atomic::{AtomicU64, Ordering}};
            let successful_embeddings = Arc::new(AtomicU64::new(0));
            let failed_embeddings = Arc::new(AtomicU64::new(0));

            // Utiliser join_all pour traiter toutes les tâches en parallèle avec timeout
            let task_futures: Vec<_> = embedding_tasks.into_iter().map(|(field_name, task): (String, tokio::task::JoinHandle<Result<serde_json::Value, reqwest::Error>>)| {
                let successful = successful_embeddings.clone();
                let failed = failed_embeddings.clone();
                async move {
                    let result = tokio::time::timeout(
                        std::time::Duration::from_secs(60), // Augmenté de 30s à 60s pour les embeddings
                        task
                    ).await;

                    match result {
                        Ok(task_result) => {
                            match task_result {
                                Ok(Ok(_)) => {
                                    successful.fetch_add(1, Ordering::Relaxed);
                                    log::info!("[PINECONE][BACKGROUND] ? Embedding réussi pour champ '{}'", field_name);
                                },
                                Ok(Err(e)) => {
                                    failed.fetch_add(1, Ordering::Relaxed);
                                    log::error!("[PINECONE][BACKGROUND] ? Erreur embedding pour champ '{}': {:?}", field_name, e);
                                },
                                Err(e) => {
                                    failed.fetch_add(1, Ordering::Relaxed);
                                    log::error!("[PINECONE][BACKGROUND] ? Erreur dans la tâche d'embedding pour champ '{}': {:?}", field_name, e);
                                }
                            }
                        },
                        Err(_) => {
                            failed.fetch_add(1, Ordering::Relaxed);
                            log::error!("[PINECONE][BACKGROUND] ? Timeout embedding pour champ '{}' (30s)", field_name);
                        }
                    }
                }
            }).collect();

            // Exécuter toutes les tâches en parallèle
            let start_time = std::time::Instant::now();
            futures::future::join_all(task_futures).await;
            let embedding_duration = start_time.elapsed();

            let success_count = successful_embeddings.load(Ordering::Relaxed);
            let fail_count = failed_embeddings.load(Ordering::Relaxed);

            log::info!("[PINECONE][BACKGROUND] ? Embeddings terminés en {:?}: {} succès, {} échecs pour service {}", 
                       embedding_duration, success_count, fail_count, service_id);

            // Optionnel : mettre à jour le statut du service une fois les embeddings terminés
            // (peut être implémenté plus tard si nécessaire)
        })
    };

    // Ne pas attendre la fin des embeddings, retourner immédiatement
    log::info!("[CREER_SERVICE] ? Réponse immédiate au frontend, embeddings en arrière-plan");

    // ✅ NOUVEAU : Historiser automatiquement les champs autocomplete avant le commit
    // Cela enrichit l'historique même si l'IA externe a oublié certaines combinaisons
    if let Some(map) = data_obj.as_object() {
        for (_key, value) in map.iter() {
            if let Some(obj) = value.as_object() {
                if let Some(type_donnee) = obj.get("type_donnee").and_then(|v| v.as_str()) {
                    if type_donnee == "autocomplete" {
                        // Extraire les données autocomplete
                        if let (
                            Some(valeur_array),
                            Some(separateur),
                            Some(sous_caracs),
                            Some(identifiant_base),
                        ) = (
                            obj.get("valeur").and_then(|v| v.as_array()),
                            obj.get("separateur").and_then(|v| v.as_str()),
                            obj.get("sous_caracteristiques"),
                            obj.get("identifiant_base").and_then(|v| v.as_str()),
                        ) {
                            // Convertir valeurs en Vec<String>
                            let valeurs: Vec<String> = valeur_array
                                .iter()
                                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                                .collect();

                            // Déterminer origine_champs
                            let origine_champs = obj
                                .get("origine_champs")
                                .and_then(|v| v.as_str())
                                .unwrap_or("ia");

                            // Historiser le champ autocomplete (en arrière-plan, ne bloque pas)
                            let pool_clone = pool.clone();
                            let identifiant_base_clone = identifiant_base.to_string();
                            let separateur_clone = separateur.to_string();
                            let sous_caracs_clone = sous_caracs.clone();
                            let user_id_clone = user_id;
                            let service_id_clone = service_id;
                            let origine_champs_clone = origine_champs.to_string();

                            tokio::spawn(async move {
                                match crate::services::autocomplete_history_service::historize_autocomplete_field(
                                    &pool_clone,
                                    &identifiant_base_clone,
                                    &valeurs,
                                    &separateur_clone,
                                    &sous_caracs_clone,
                                    &origine_champs_clone,
                                    Some(user_id_clone),
                                    Some(service_id_clone),
                                ).await {
                                    Ok(ids) => {
                                        log::info!(
                                            "[CREER_SERVICE] ✅ {} caractéristiques autocomplete historisées pour champ '{}'",
                                            ids.len(),
                                            identifiant_base_clone
                                        );
                                    }
                                    Err(e) => {
                                        log::warn!(
                                            "[CREER_SERVICE] ⚠️ Erreur historisation autocomplete pour '{}': {}",
                                            identifiant_base_clone,
                                            e
                                        );
                                    }
                                }
                            });
                        }
                    }
                }
            }
        }
    }

    // ✅ NOUVEAU: Sauvegarder les données Google Places complètes dans la table dédiée
    if let Some(google_place_full) = google_place_full_data {
        if let Some(gp_obj) = google_place_full.as_object() {
            let place_id = gp_obj.get("place_id")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            
            if let Some(pid) = place_id {
                // Extraire toutes les données Google Places
                let display_name = gp_obj.get("display_name")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());
                let formatted_address = gp_obj.get("formatted_address")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());
                let location_vector: Vec<String> = gp_obj.get("location_vector")
                    .and_then(|v| v.as_array())
                    .map(|arr| {
                        arr.iter()
                            .filter_map(|v| v.as_str().map(|s| s.to_string()))
                            .collect()
                    })
                    .unwrap_or_default();
                let coordinates = gp_obj.get("coordinates")
                    .and_then(|v| v.as_object());
                let latitude = coordinates
                    .and_then(|c| c.get("lat"))
                    .and_then(|v| v.as_f64());
                let longitude = coordinates
                    .and_then(|c| c.get("lng"))
                    .and_then(|v| v.as_f64());
                let types: Vec<String> = gp_obj.get("types")
                    .and_then(|v| v.as_array())
                    .map(|arr| {
                        arr.iter()
                            .filter_map(|v| v.as_str().map(|s| s.to_string()))
                            .collect()
                    })
                    .unwrap_or_default();
                let primary_type = gp_obj.get("primary_type")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());
                let primary_type_display_name = gp_obj.get("primary_type_display_name")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());
                let rating = gp_obj.get("rating")
                    .and_then(|v| v.as_f64());
                let rating_count = gp_obj.get("rating_count")
                    .and_then(|v| v.as_i64())
                    .map(|i| i as i32);
                let price_level = gp_obj.get("price_level")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());
                let business_status = gp_obj.get("business_status")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());
                let serves_cuisine: Vec<String> = gp_obj.get("serves_cuisine")
                    .and_then(|v| v.as_array())
                    .map(|arr| {
                        arr.iter()
                            .filter_map(|v| v.as_str().map(|s| s.to_string()))
                            .collect()
                    })
                    .unwrap_or_default();
                let website_uri = gp_obj.get("website_uri")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());
                let google_maps_uri = gp_obj.get("google_maps_uri")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());
                let international_phone_number = gp_obj.get("international_phone_number")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());
                let national_phone_number = gp_obj.get("national_phone_number")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());
                let editorial_summary = gp_obj.get("editorial_summary")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());
                let current_opening_hours = gp_obj.get("current_opening_hours").cloned();
                let regular_opening_hours = gp_obj.get("regular_opening_hours").cloned();
                let photos = gp_obj.get("photos").cloned();
                let country = gp_obj.get("country")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());
                let country_code = gp_obj.get("country_code")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());

                // Insérer dans google_places_data
                if let Err(e) = sqlx::query(
                    r#"
                    INSERT INTO google_places_data (
                        service_id, place_id, display_name, formatted_address, location_vector,
                        latitude, longitude, types, primary_type, primary_type_display_name,
                        rating, rating_count, price_level, business_status, serves_cuisine,
                        website_uri, google_maps_uri, international_phone_number, national_phone_number,
                        editorial_summary, current_opening_hours, regular_opening_hours, photos,
                        country, country_code
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
                    ON CONFLICT (service_id, place_id) DO UPDATE SET
                        display_name = EXCLUDED.display_name,
                        formatted_address = EXCLUDED.formatted_address,
                        location_vector = EXCLUDED.location_vector,
                        latitude = EXCLUDED.latitude,
                        longitude = EXCLUDED.longitude,
                        types = EXCLUDED.types,
                        primary_type = EXCLUDED.primary_type,
                        primary_type_display_name = EXCLUDED.primary_type_display_name,
                        rating = EXCLUDED.rating,
                        rating_count = EXCLUDED.rating_count,
                        price_level = EXCLUDED.price_level,
                        business_status = EXCLUDED.business_status,
                        serves_cuisine = EXCLUDED.serves_cuisine,
                        website_uri = EXCLUDED.website_uri,
                        google_maps_uri = EXCLUDED.google_maps_uri,
                        international_phone_number = EXCLUDED.international_phone_number,
                        national_phone_number = EXCLUDED.national_phone_number,
                        editorial_summary = EXCLUDED.editorial_summary,
                        current_opening_hours = EXCLUDED.current_opening_hours,
                        regular_opening_hours = EXCLUDED.regular_opening_hours,
                        photos = EXCLUDED.photos,
                        country = EXCLUDED.country,
                        country_code = EXCLUDED.country_code,
                        updated_at = NOW()
                    "#
                )
                .bind(service_id)
                .bind(&pid)
                .bind(display_name)
                .bind(formatted_address)
                .bind(&location_vector)
                .bind(latitude)
                .bind(longitude)
                .bind(&types)
                .bind(primary_type)
                .bind(primary_type_display_name)
                .bind(rating)
                .bind(rating_count)
                .bind(price_level)
                .bind(business_status)
                .bind(&serves_cuisine)
                .bind(website_uri)
                .bind(google_maps_uri)
                .bind(international_phone_number)
                .bind(national_phone_number)
                .bind(editorial_summary)
                .bind(current_opening_hours)
                .bind(regular_opening_hours)
                .bind(photos)
                .bind(country)
                .bind(country_code)
                .execute(&mut *tx)
                .await
                {
                    log::error!(
                        "[creer_service] ❌ Erreur sauvegarde Google Places pour service {}: {}",
                        service_id,
                        e
                    );
                    // Ne pas bloquer la création du service si Google Places échoue
                } else {
                    log::info!(
                        "[creer_service] ✅ Données Google Places complètes sauvegardées pour service {} (place_id: {})",
                        service_id,
                        pid
                    );
                }
            }
        }
    }

    // Commit de la transaction AVANT la réponse
    tx.commit()
        .await
        .map_err(|e| {
            log::error!(
                "[creer_service] ❌ Échec commit transaction pour service_id={}: {}",
                service_id,
                e
            );
            
            // ✅ CRITIQUE 2025-11-25 : Rembourser le solde si le commit échoue
            // Le débit a été fait avant, donc on doit rembourser en cas d'échec
            let pool_clone = pool.clone();
            let user_id_clone = user_id;
            let cout_reel_xaf_clone = cout_reel_xaf;
            tokio::spawn(async move {
                match sqlx::query(
                    "UPDATE users SET tokens_balance = tokens_balance + $1 WHERE id = $2 RETURNING tokens_balance"
                )
                .bind(cout_reel_xaf_clone)
                .bind(user_id_clone)
                .fetch_one(&pool_clone)
                .await {
                    Ok(refund_row) => {
                        if let Ok(refunded_balance) = refund_row.try_get::<i64, _>("tokens_balance") {
                            log::info!(
                                "[creer_service] ✅ Solde remboursé après échec commit : {} FCFA (nouveau solde: {})",
                                cout_reel_xaf_clone,
                                refunded_balance
                            );
                        }
                    }
                    Err(refund_err) => {
                        log::error!(
                            "[creer_service] ❌ Échec remboursement solde après échec commit pour user {} (montant: {} FCFA): {}",
                            user_id_clone,
                            cout_reel_xaf_clone,
                            refund_err
                        );
                    }
                }
            });
            
            AppError::Internal(format!("Échec commit: {}", e))
        })?;

    log::info!("[CREER_SERVICE] ? Transaction commitée avec succès - Service ID: {} maintenant visible en base", service_id);
    log::info!(
        "[CREER_SERVICE] Tokens consommés pour utilisateur {}: {:?}",
        user_id,
        token_tracker
    );
    log::info!(
        "[CREER_SERVICE] Total tokens retournés: {} (type: u32)",
        token_tracker.total_tokens
    );

    // ✅ NOUVEAU 2025-11-04: Sauvegarder d'abord les combinaisons IA (avec vérification doublon)
    if let Some(produits_field) = data_obj.get("produits") {
        let session_id = data_obj.get("session_id").and_then(|v| v.as_str());

        if let Err(e) = save_ia_combinations_to_db(pool, produits_field, session_id).await {
            log::warn!(
                "[CREER_SERVICE] Erreur sauvegarde combinaisons IA: {} (non bloquant)",
                e
            );
        } else {
            log::info!("[CREER_SERVICE] ✅ Combinaisons IA sauvegardées (doublons évités)");
        }
    }

    // ✅ NOUVEAU 2025-11-04: Sauvegarder le VRAI produit choisi par le prestataire
    if let Err(e) = save_autocomplete_combination(pool, service_id, &data_obj).await {
        log::warn!(
            "[CREER_SERVICE] Erreur sauvegarde produit réel: {} (non bloquant)",
            e
        );
    } else {
        log::info!("[CREER_SERVICE] ✅ Produit réel sauvegardé (autocomplete_characteristics + autocomplete_combinations)");
    }

    // ✅ NOUVEAU: Créer une notification de création de service
    let service_title = data_obj
        .get("titre_service")
        .or_else(|| data_obj.get("titre"))
        .and_then(|v| {
            if let Some(obj) = v.as_object() {
                obj.get("valeur").and_then(|val| val.as_str())
            } else {
                v.as_str()
            }
        })
        .unwrap_or("Votre service");

    let notification_data = serde_json::json!({
        "service_id": service_id,
        "service_title": service_title,
        "tokens_consumed": token_tracker.total_tokens
    });

    // Créer la notification (ne pas bloquer si ça échoue)
    if let Err(e) = crate::services::notification_service::create_notification(
        pool,
        user_id,
        crate::services::notification_service::NotificationType::ServiceCreated,
        "🎉 Service créé avec succès !".to_string(),
        format!(
            "Votre service '{}' a été créé et est maintenant visible par tous les utilisateurs.",
            service_title
        ),
        Some(notification_data),
    )
    .await
    {
        log::warn!("[CREER_SERVICE] Impossible de créer la notification: {}", e);
    } else {
        log::info!("[CREER_SERVICE] ✅ Notification de création envoyée");
    }

    Ok((service_creation_result, token_tracker.total_tokens as u32))
}

/// Valide un brouillon de service sans insertion en base ni cache
pub async fn brouillon_service(data: &serde_json::Value) -> Result<serde_json::Value, AppError> {
    let data_obj = valider_service_json(data)?;

    // Pas d'insertion ni de cache, juste retour du JSON valid?
    Ok(data_obj)
}

/// Sauvegarde les combinaisons IA dans autocomplete_combinations (avec vérification doublon)
/// Utilisé lors de la réception du JSON IA pour construire la liste de suggestions
async fn save_ia_combinations_to_db(
    pool: &PgPool,
    produits_field: &serde_json::Value,
    session_id: Option<&str>,
) -> Result<(), AppError> {
    log::info!("[save_ia_combinations_to_db] Début sauvegarde combinaisons IA");

    // Extraire les combinaisons depuis produits.valeur
    let separateur = produits_field
        .get("separateur")
        .and_then(|v| v.as_str())
        .unwrap_or(",");

    let separateur_owned = separateur.to_string();

    let extract_combination_from_object =
        |obj: &serde_json::Map<String, serde_json::Value>| -> Option<String> {
            if let Some(raw) = obj.get("combinaison_brute").and_then(|v| v.as_str()) {
                return Some(raw.to_string());
            }

            if let Some(vector_array) = obj.get("characteristic_vector").and_then(|v| v.as_array())
            {
                let items: Vec<String> = vector_array
                    .iter()
                    .filter_map(|value| value.as_str().map(|s| s.trim().to_string()))
                    .filter(|s| !s.is_empty())
                    .collect();

                if !items.is_empty() {
                    return Some(items.join(separateur_owned.as_str()));
                }
            }

            let mut parts: Vec<String> = Vec::new();
            let candidate_keys = [
                "nom",
                "categorie",
                "marque",
                "modele",
                "description",
                "taille",
                "style",
                "couleur",
                "etat",
            ];

            for key in candidate_keys.iter() {
                if let Some(value) = obj.get(*key) {
                    match value {
                        serde_json::Value::String(s) => {
                            let trimmed = s.trim();
                            if !trimmed.is_empty() {
                                parts.push(trimmed.to_string());
                            }
                        }
                        serde_json::Value::Number(num) => {
                            parts.push(num.to_string());
                        }
                        _ => {}
                    }
                }
            }

            if let Some(prix_val) = obj.get("prix") {
                match prix_val {
                    serde_json::Value::String(s) => {
                        let trimmed = s.trim();
                        if !trimmed.is_empty() {
                            parts.push(trimmed.to_string());
                        }
                    }
                    serde_json::Value::Number(num) => {
                        parts.push(num.to_string());
                    }
                    _ => {}
                }
            }

            if let Some(devise_val) = obj.get("devise").and_then(|v| v.as_str()) {
                let trimmed = devise_val.trim();
                if !trimmed.is_empty() {
                    parts.push(trimmed.to_string());
                }
            }

            if parts.is_empty() {
                None
            } else {
                Some(parts.join(separateur_owned.as_str()))
            }
        };

    let valeurs: Vec<String> =
        if let Some(valeur_array) = produits_field.get("valeur").and_then(|v| v.as_array()) {
            valeur_array
                .iter()
                .filter_map(|value| {
                    if let Some(as_str) = value.as_str() {
                        return Some(as_str.to_string());
                    }

                    value
                        .as_object()
                        .and_then(|obj| extract_combination_from_object(obj))
                })
                .collect()
        } else if let Some(valeur_str) = produits_field.get("valeur").and_then(|v| v.as_str()) {
            vec![valeur_str.to_string()]
        } else {
            log::warn!("[save_ia_combinations_to_db] Pas de valeurs exploitables");
            return Ok(());
        };

    if valeurs.is_empty() {
        log::warn!("[save_ia_combinations_to_db] Aucune combinaison exploitable trouvée");
        return Ok(());
    }

    let ai_preferred_index = produits_field
        .get("ai_preferred_index")
        .and_then(|v| v.as_i64())
        .unwrap_or(0) as usize;

    // Traiter chaque combinaison
    for (index, valeur_str) in valeurs.iter().enumerate() {
        let product_vector: Vec<String> = valeur_str
            .split(separateur)
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();

        if product_vector.is_empty() {
            continue;
        }

        // ✅ VÉRIFICATION DOUBLON : Ne PAS insérer si existe déjà (éviter bruit)
        let exists = sqlx::query_scalar::<_, bool>("SELECT product_combination_exists($1)")
            .bind(&product_vector)
            .fetch_one(pool)
            .await
            .unwrap_or(false);

        if exists {
            log::info!("[save_ia_combinations_to_db] ⚠️ Combinaison {} existe déjà, ignorée (éviter bruit)", index);
            continue;
        }

        // Extraire les labels des sous-caractéristiques (dimensions)
        let product_labels: Vec<String> = if let Some(sous_caracs) = produits_field
            .get("sous_caracteristiques")
            .and_then(|v| v.as_object())
        {
            sous_caracs.keys().map(|k| k.to_string()).collect()
        } else {
            vec![]
        };

        // Insérer dans autocomplete_combinations (SANS lieu)
        let is_ai_preferred = index == ai_preferred_index;

        let result = sqlx::query(
            r#"INSERT INTO autocomplete_combinations 
               (service_id, product_vector, product_labels, location_vector, location_labels, full_vector,
                session_id, is_ai_preferred, ai_confidence, usage_count)
               VALUES (NULL, $1, $2, '{}', '{}', $1, $3, $4, 0.7, 1)"#
        )
        .bind(&product_vector)
        .bind(&product_labels)
        .bind(session_id)
        .bind(is_ai_preferred)
        .execute(pool).await;

        if let Err(e) = result {
            log::error!(
                "[save_ia_combinations_to_db] Erreur sauvegarde combinaison {}: {}",
                index,
                e
            );
        } else {
            log::info!(
                "[save_ia_combinations_to_db] ✅ Combinaison {} sauvegardée (IA)",
                index
            );
        }
    }

    log::info!("[save_ia_combinations_to_db] Fin sauvegarde combinaisons IA");
    Ok(())
}

/// ✅ OPTIMISATION : Extraire directement product_vector depuis un objet JSON (sans passer par chaîne)
/// Cette fonction génère directement un Vec<String> au lieu d'une chaîne concaténée
fn extract_product_vector_from_object(
    obj: &serde_json::Map<String, serde_json::Value>,
) -> Vec<String> {
    // 1. Si characteristic_vector existe, l'utiliser directement
    if let Some(vector_array) = obj.get("characteristic_vector").and_then(|v| v.as_array()) {
        let items: Vec<String> = vector_array
            .iter()
            .filter_map(|value| value.as_str().map(|s| s.trim().to_string()))
            .filter(|s| !s.is_empty())
            .collect();
        if !items.is_empty() {
            return items;
        }
    }

    // 2. Si combinaison_brute existe, la splitter
    if let Some(raw) = obj.get("combinaison_brute").and_then(|v| v.as_str()) {
        let items: Vec<String> = raw
            .split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();
        if !items.is_empty() {
            return items;
        }
    }

    // 3. Extraire depuis les champs structurés (format recommandé)
    let mut parts: Vec<String> = Vec::new();
    
    // Champs prioritaires (format structuré)
    let priority_keys = [
        "nom_produit", "nom",
        "categorie_produit", "categorie",
        "description_produit", "description",
    ];
    
    for key in priority_keys.iter() {
        if let Some(value) = obj.get(*key) {
            match value {
                serde_json::Value::String(s) => {
                    let trimmed = s.trim();
                    if !trimmed.is_empty() && !parts.contains(&trimmed.to_string()) {
                        parts.push(trimmed.to_string());
                    }
                }
                serde_json::Value::Number(num) => {
                    let num_str = num.to_string();
                    if !parts.contains(&num_str) {
                        parts.push(num_str);
                    }
                }
                _ => {}
            }
        }
    }
    
    // Autres champs optionnels
    let optional_keys = [
        "marque", "modele", "taille", "style", "couleur", "etat",
    ];
    
    for key in optional_keys.iter() {
        if let Some(value) = obj.get(*key) {
            if let Some(s) = value.as_str() {
                let trimmed = s.trim();
                if !trimmed.is_empty() && !parts.contains(&trimmed.to_string()) {
                    parts.push(trimmed.to_string());
                }
            }
        }
    }

    // Prix et devise
    if let Some(prix_val) = obj.get("prix").or_else(|| obj.get("prix_produit")) {
        match prix_val {
            serde_json::Value::String(s) => {
                let trimmed = s.trim();
                if !trimmed.is_empty() {
                    parts.push(trimmed.to_string());
                }
            }
            serde_json::Value::Number(num) => parts.push(num.to_string()),
            _ => {}
        }
    }

    if let Some(devise_val) = obj.get("devise").or_else(|| obj.get("devise_produit")) {
        if let Some(devise_str) = devise_val.as_str() {
            let trimmed = devise_str.trim();
            if !trimmed.is_empty() {
                parts.push(trimmed.to_string());
            }
        }
    }

    parts
}

/// Sauvegarde les combinaisons autocomplete avec vecteurs produit et localisation
/// LOGIQUE:
/// - autocomplete_combinations : Toutes les combinaisons possibles (IA) pour aider prestataire
/// - autocomplete_characteristics : VRAIS produits validés par prestataires (avec lieu bidirectionnel)
pub async fn save_autocomplete_combination(
    pool: &PgPool,
    service_id: i32,
    data_obj: &serde_json::Value,
) -> Result<(), AppError> {
    use crate::services::geonames_service::{
        build_location_vector, extract_country_from_lieu, get_geoname_id,
    };

    log::info!(
        "[save_autocomplete_combination] Début sauvegarde pour service {} (VRAIS produits)",
        service_id
    );

    // 1. Extraire vecteur produit depuis champ produits
    let produits_field = match data_obj.get("produits") {
        Some(p) => p,
        None => {
            log::warn!("[save_autocomplete_combination] Pas de champ produits");
            return Ok(());
        }
    };

    let type_donnee = produits_field
        .get("type_donnee")
        .and_then(|v| v.as_str())
        .unwrap_or("autocomplete");

    let separateur = produits_field
        .get("separateur")
        .and_then(|v| v.as_str())
        .unwrap_or(",");

    let mut product_vector: Vec<String> = Vec::new();
    let mut product_labels: Vec<String> = if let Some(sous_caracs) = produits_field
        .get("sous_caracteristiques")
        .and_then(|v| v.as_object())
    {
        sous_caracs.keys().map(|k| k.to_string()).collect()
    } else {
        vec![]
    };
    let mut variation_prix_node: Option<serde_json::Value> =
        produits_field.get("variation_prix").cloned();
    let mut embedded_product_object: Option<serde_json::Value> = None;

    // ✅ OPTIMISATION : Extraire product_vector directement depuis les objets JSON
    if type_donnee == "listeproduit" {
        if let Some(valeur_array) = produits_field.get("valeur").and_then(|v| v.as_array()) {
            if let Some(first) = valeur_array.first() {
                if let Some(obj) = first.as_object() {
                    // Générer product_vector directement depuis l'objet JSON
                    product_vector = extract_product_vector_from_object(obj);
                    
                    // Extraire product_labels si disponibles
                    if product_labels.is_empty() {
                        if let Some(labels_array) =
                            obj.get("product_labels").and_then(|v| v.as_array())
                        {
                            product_labels = labels_array
                                .iter()
                                .filter_map(|label| label.as_str().map(|s| s.to_string()))
                                .collect();
                        }
                    }
                    
                    // Extraire variation_prix
                    if variation_prix_node.is_none() {
                        variation_prix_node = obj
                            .get("variabilite_prix")
                            .cloned()
                            .or_else(|| obj.get("variation_prix").cloned())
                            .or_else(|| obj.get("price_variant").cloned());
                    }
                    
                    embedded_product_object = Some(first.clone());
                }
            }
        }
    } else {
        // ✅ RÉTROCOMPATIBILITÉ : Gérer les anciennes chaînes concaténées
        if let Some(valeur_str) = produits_field.get("valeur").and_then(|v| v.as_str()) {
            product_vector = valeur_str
                .split(separateur)
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect();
        } else if let Some(valeur_array) = produits_field.get("valeur").and_then(|v| v.as_array()) {
            // Si c'est un array de chaînes (ancien format)
            if let Some(first_str) = valeur_array
                .iter()
                .filter_map(|v| v.as_str())
                .next()
            {
                product_vector = first_str
                    .split(separateur)
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty())
                    .collect();
            }
        }
    }

    if product_vector.is_empty() {
        log::warn!("[save_autocomplete_combination] Vecteur produit vide");
        return Ok(());
    }

    log::info!(
        "[save_autocomplete_combination] Vecteur produit: {:?}",
        product_vector
    );

    // 2. Extraire lieu (plusieurs champs possibles)
    let mut lieu_field = data_obj
        .get("lieu_produit")
        .or_else(|| data_obj.get("localisation"))
        .or_else(|| data_obj.get("ville"))
        .or_else(|| data_obj.get("lieu"));

    if lieu_field.is_none() {
        if let Some(obj) = embedded_product_object.as_ref().and_then(|v| v.as_object()) {
            lieu_field = obj
                .get("lieu_produit")
                .or_else(|| obj.get("localisation"))
                .or_else(|| obj.get("lieu"));
        }
    }

    let (location_vector, chosen_location, geoname_id) = if let Some(lieu) = lieu_field {
        let lieu_str = lieu
            .get("valeur")
            .and_then(|v| v.as_str())
            .or_else(|| lieu.as_str())
            .unwrap_or("");

        if !lieu_str.is_empty() {
            let country = extract_country_from_lieu(lieu_str);

            // Construire vecteur lieu avec GeoNames
            let loc_vector = build_location_vector(pool, lieu_str, country.as_deref())
                .await
                .unwrap_or_else(|e| {
                    log::warn!(
                        "[save_autocomplete_combination] Erreur enrichissement lieu '{}': {}",
                        lieu_str,
                        e
                    );
                    vec![lieu_str.to_string()]
                });

            let geoname_id_val = get_geoname_id(pool, lieu_str).await.unwrap_or(None);

            log::info!(
                "[save_autocomplete_combination] Vecteur lieu: {:?}",
                loc_vector
            );

            (loc_vector, Some(lieu_str.to_string()), geoname_id_val)
        } else {
            (vec![], None, None)
        }
    } else {
        log::warn!("[save_autocomplete_combination] Pas de champ lieu trouvé");
        (vec![], None, None)
    };

    // 3. Vecteur complet = produit + location (UNIQUEMENT pour autocomplete_characteristics)
    let mut full_vector = product_vector.clone();
    full_vector.extend(location_vector.clone());

    log::info!(
        "[save_autocomplete_combination] Vecteur produit ({}): {:?}",
        product_vector.len(),
        product_vector
    );
    log::info!(
        "[save_autocomplete_combination] Vecteur lieu ({}): {:?}",
        location_vector.len(),
        location_vector
    );
    log::info!(
        "[save_autocomplete_combination] Vecteur complet ({}): {:?}",
        full_vector.len(),
        full_vector
    );

    // 4. Extraire les labels des sous-caractéristiques (dimensions)
    // 5. Générer product_id (format: "serviceId_productIndex")
    let product_id = format!("{}_0", service_id); // Index 0 pour produit principal

    // 5. Gérer variations prix si existe
    let variation_prix = variation_prix_node.as_ref();

    if let Some(variation) = variation_prix {
        let variant_dimension = variation
            .get("variable")
            .and_then(|v| v.as_str())
            .unwrap_or("");

        let modalites = variation.get("modalites").and_then(|v| v.as_array());

        if let Some(modalites_array) = modalites {
            log::info!(
                "[save_autocomplete_combination] {} variations prix trouvées (dimension: {})",
                modalites_array.len(),
                variant_dimension
            );

            for (variant_index, modalite) in modalites_array.iter().enumerate() {
                let variant_value = modalite
                    .get("valeur")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                let prix = modalite.get("prix").and_then(|v| v.as_f64()).unwrap_or(0.0);
                let stock = modalite.get("stock").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
                let devise = modalite
                    .get("devise")
                    .and_then(|v| v.as_str())
                    .unwrap_or("XAF");

                // Vecteur produit avec variation (sans lieu)
                let mut variant_product_vector = product_vector.clone();
                variant_product_vector.push(variant_value.to_string());

                // Vecteur complet (produit + variation + lieu)
                let mut variant_full_vector = variant_product_vector.clone();
                variant_full_vector.extend(location_vector.clone());

                let variant_product_id = format!("{}_{}", service_id, variant_index);

                // ✅ NOUVEAU: Sauvegarder dans autocomplete_characteristics (VRAI produit prestataire)
                let result_char = sqlx::query(
                    r#"INSERT INTO autocomplete_characteristics 
                       (identifiant_base, service_id, product_id, 
                        characteristic_vector, product_labels, location_vector, full_vector,
                        chosen_location, chosen_location_geoname_id,
                        is_real_product, origine_champs, usage_count,
                        sous_caracteristique, valeur)
                       VALUES ('produits', $1, $2, $3, $4, $5, $6, $7, $8, TRUE, 'formulaire', 1, 'vector', $9)"#
                )
                .bind(service_id)
                .bind(&variant_product_id)
                .bind(&variant_product_vector)
                .bind(&product_labels)  // ✅ AJOUT product_labels
                .bind(&location_vector)
                .bind(&variant_full_vector)
                .bind(chosen_location.as_deref())
                .bind(geoname_id)
                .bind(variant_value)  // Premier élément comme valeur legacy
                .execute(pool).await;

                if let Err(e) = result_char {
                    log::error!("[save_autocomplete_combination] Erreur sauvegarde autocomplete_characteristics variation '{}': {}", variant_value, e);
                } else {
                    log::info!("[save_autocomplete_combination] ✅ Sauvegardé dans autocomplete_characteristics variation: {}", variant_value);
                }

                // ✅ AUSSI sauvegarder dans autocomplete_combinations (POPULARITÉ - doublons OK)
                let result_comb = sqlx::query(
                    r#"INSERT INTO autocomplete_combinations 
                       (service_id, product_vector, product_labels, location_vector, location_labels, full_vector,
                        has_variant, variant_dimension, variant_value, prix, devise, stock, usage_count)
                       VALUES ($1, $2, $3, '{}', '{}', $2, true, $4, $5, $6, $7, $8, 1)
                       ON CONFLICT (full_vector)
                       DO UPDATE SET usage_count = autocomplete_combinations.usage_count + 1"#
                )
                .bind(service_id)
                .bind(&variant_product_vector)  // SANS lieu
                .bind(&product_labels)
                .bind(variant_dimension)
                .bind(variant_value)
                .bind(prix)
                .bind(devise)
                .bind(stock)
                .execute(pool).await;

                if let Err(e) = result_comb {
                    log::error!("[save_autocomplete_combination] Erreur sauvegarde autocomplete_combinations variation '{}': {}", variant_value, e);
                } else {
                    log::info!("[save_autocomplete_combination] ✅ Sauvegardé dans autocomplete_combinations variation: {}", variant_value);
                }
            }
        }
    } else {
        // Pas de variation : sauvegarder une seule combinaison
        let prix = produits_field
            .get("prix")
            .and_then(|p| p.get("valeur"))
            .or_else(|| produits_field.get("prix"))
            .and_then(|v| v.as_f64())
            .or_else(|| {
                embedded_product_object
                    .as_ref()
                    .and_then(|obj| obj.get("prix"))
                    .and_then(|v| v.as_f64())
            })
            .unwrap_or(0.0);

        // ✅ NOUVEAU: Sauvegarder dans autocomplete_characteristics (VRAI produit prestataire)
        let result_char = sqlx::query(
            r#"INSERT INTO autocomplete_characteristics 
               (identifiant_base, service_id, product_id,
                characteristic_vector, product_labels, location_vector, full_vector,
                chosen_location, chosen_location_geoname_id,
                is_real_product, origine_champs, usage_count,
                sous_caracteristique, valeur)
               VALUES ('produits', $1, $2, $3, $4, $5, $6, $7, $8, TRUE, 'formulaire', 1, 'vector', $9)"#
        )
        .bind(service_id)
        .bind(&product_id)
        .bind(&product_vector)
        .bind(&product_labels)  // ✅ AJOUT product_labels
        .bind(&location_vector)
        .bind(&full_vector)
        .bind(chosen_location.as_deref())
        .bind(geoname_id)
        .bind(product_vector.get(0).unwrap_or(&String::new()))  // Premier élément comme valeur legacy
        .execute(pool).await;

        if let Err(e) = result_char {
            log::error!("[save_autocomplete_combination] Erreur sauvegarde autocomplete_characteristics: {}", e);
        } else {
            log::info!("[save_autocomplete_combination] ✅ Sauvegardé dans autocomplete_characteristics (VRAI produit)");
        }

        // ✅ AUSSI sauvegarder dans autocomplete_combinations (POPULARITÉ - doublons OK)
        let result_comb = sqlx::query(
            r#"INSERT INTO autocomplete_combinations 
               (service_id, product_vector, product_labels, location_vector, location_labels, full_vector,
                has_variant, prix, usage_count)
               VALUES ($1, $2, $3, '{}', '{}', $2, false, $4, 1)
               ON CONFLICT (product_vector)
               DO UPDATE SET usage_count = autocomplete_combinations.usage_count + 1"#
        )
        .bind(service_id)
        .bind(&product_vector)  // SANS lieu
        .bind(&product_labels)
        .bind(prix)
        .execute(pool).await;

        if let Err(e) = result_comb {
            log::error!(
                "[save_autocomplete_combination] Erreur sauvegarde autocomplete_combinations: {}",
                e
            );
        } else {
            log::info!("[save_autocomplete_combination] ✅ Sauvegardé dans autocomplete_combinations (POPULARITÉ)");
        }
    }

    // ✅ NOUVEAU 2025-11-04: Sauvegarder le vecteur AUSSI dans service.data->produits pour compatibilité recherche
    log::info!(
        "[save_autocomplete_combination] Mise à jour vecteur dans service.data->produits..."
    );

    // Récupérer le JSON actuel du service
    let current_data_row = sqlx::query("SELECT data FROM services WHERE id = $1")
        .bind(service_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur récupération service data: {}", e)))?;

    if let Some(row) = current_data_row {
        let mut service_data: serde_json::Value = row
            .try_get("data")
            .map_err(|e| AppError::Internal(format!("Erreur parsing service data: {}", e)))?;

        // ✅ CORRECTION 2025-11-04: Ajouter le vecteur COMPLET (produit + lieu) au champ produits
        // Construire combination_string à partir de product_vector
        let combination_string = if !product_vector.is_empty() {
            Some(product_vector.join(separateur))
        } else {
            None
        };
        
        if let Some(produits_obj) = service_data
            .get_mut("produits")
            .and_then(|p| p.as_object_mut())
        {
            let current_type = produits_obj
                .get("type_donnee")
                .and_then(|v| v.as_str())
                .unwrap_or("");

            if current_type == "listeproduit" {
                if let Some(valeur_array) = produits_obj
                    .get_mut("valeur")
                    .and_then(|v| v.as_array_mut())
                {
                    if let Some(first_product) =
                        valeur_array.first_mut().and_then(|v| v.as_object_mut())
                    {
                        first_product.insert(
                            "characteristic_vector".to_string(),
                            serde_json::json!(product_vector),
                        );
                        first_product.insert(
                            "product_labels".to_string(),
                            serde_json::json!(product_labels),
                        );
                        if let Some(combo) = &combination_string {
                            first_product
                                .insert("combinaison_brute".to_string(), serde_json::json!(combo));
                        }
                        if let Some(chosen) = &chosen_location {
                            first_product
                                .insert("chosen_location".to_string(), serde_json::json!(chosen));
                        }
                    }
                }

                produits_obj.insert(
                    "characteristic_vector".to_string(),
                    serde_json::json!(product_vector),
                );
                produits_obj.insert(
                    "product_labels".to_string(),
                    serde_json::json!(product_labels),
                );
                if let Some(combo) = &combination_string {
                    produits_obj.insert("combinaison_brute".to_string(), serde_json::json!(combo));
                }
                produits_obj.insert(
                    "location_vector".to_string(),
                    serde_json::json!(location_vector),
                );
                produits_obj.insert("full_vector".to_string(), serde_json::json!(full_vector));
                produits_obj.insert(
                    "chosen_location".to_string(),
                    serde_json::json!(chosen_location),
                );
            } else {
                produits_obj.insert(
                    "characteristic_vector".to_string(),
                    serde_json::json!(product_vector),
                );
                produits_obj.insert(
                    "product_labels".to_string(),
                    serde_json::json!(product_labels),
                );
                if let Some(combo) = &combination_string {
                    produits_obj.insert("combinaison_brute".to_string(), serde_json::json!(combo));
                }
                produits_obj.insert(
                    "location_vector".to_string(),
                    serde_json::json!(location_vector),
                );
                produits_obj.insert("full_vector".to_string(), serde_json::json!(full_vector));
                produits_obj.insert(
                    "chosen_location".to_string(),
                    serde_json::json!(chosen_location),
                );
            }

            // Mettre à jour dans la base
            let _ = sqlx::query("UPDATE services SET data = $1 WHERE id = $2")
                .bind(&service_data)
                .bind(service_id)
                .execute(pool)
                .await
                .map_err(|e| {
                    log::error!(
                        "[save_autocomplete_combination] Erreur UPDATE service data: {}",
                        e
                    );
                    e
                });

            log::info!(
                "[save_autocomplete_combination] ✅ Vecteur ajouté à service.data->produits"
            );
        }
    }

    log::info!(
        "[save_autocomplete_combination] Fin sauvegarde pour service {}",
        service_id
    );

    Ok(())
}

/// Fonction utilitaire pour r?cup?rer le GPS dynamique du prestataire
#[allow(dead_code)]
async fn get_user_gps(pool: &PgPool, user_id: i32) -> Result<(f64, f64), AppError> {
    let row: Option<UserGpsRow> = sqlx::query_as(
        "SELECT gps FROM users WHERE id = $1"
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur lecture GPS user: {}", e)))?;
    if let Some(r) = row {
        if let Some(coords) = r.gps {
            let parts: Vec<&str> = coords.split(',').collect();
            if parts.len() == 2 {
                let lon = parts[0].trim().parse().unwrap_or(0.0);
                let lat = parts[1].trim().parse().unwrap_or(0.0);
                return Ok((lon, lat));
            }
        }
    }
    Err(AppError::BadRequest(
        "GPS prestataire non disponible".to_string(),
    ))
}

/// D?tecte la langue d'un texte (retourne code ISO ou "und")
pub fn detect_lang(text: &str) -> String {
    whatlang::detect(text)
        .map(|info| info.lang().code())
        .unwrap_or("und")
        .to_string()
}

pub async fn translate_to_en(text: &str, lang: &str) -> String {
    if lang == "eng" || lang == "und" {
        return text.to_string();
    }
    let api_key = std::env::var("GOOGLE_TRANSLATE_API_KEY").unwrap_or_default();
    if api_key.is_empty() {
        log::warn!("[TRANSLATE] GOOGLE_TRANSLATE_API_KEY absente, retour texte original.");
        return text.to_string();
    }
    let url = format!(
        "https://translation.googleapis.com/language/translate/v2?key={}",
        api_key
    );
    let client = reqwest::Client::new();
    let params = serde_json::json!({
        "q": text,
        "source": lang,
        "target": "en",
        "format": "text"
    });
    let resp = client.post(&url).json(&params).send().await;
    if let Ok(r) = resp {
        if let Ok(json) = r.json::<serde_json::Value>().await {
            if let Some(translated) = json["data"]["translations"][0]["translatedText"].as_str() {
                return translated.to_string();
            } else {
                log::warn!("[TRANSLATE] Champ 'translatedText' absent dans la réponse Google, retour texte original. Réponse: {:?}", json);
            }
        } else {
            log::warn!("[TRANSLATE] Impossible de parser la réponse JSON de Google, retour texte original.");
        }
    } else {
        log::warn!(
            "[TRANSLATE] Erreur HTTP lors de l'appel Google Translate, retour texte original."
        );
    }
    text.to_string() // fallback
}

/// Mapping des types pour Pinecone : conversion des types non support?s en "texte"
pub fn map_type_for_pinecone(type_donnee: &str) -> &str {
    match type_donnee {
        "string" | "text" | "texte" => "texte",
        "boolean" | "bool" => "texte",    // Conversion boolean ? texte
        "gps" | "geolocation" => "texte", // Conversion gps ? texte
        "int" | "float" | "nombre" | "prix" | "montant" => "texte", // Conversion numérique ? texte
        _ => "texte",                     // Par défaut, tout en texte pour éviter les erreurs
    }
}

// Toute la fonction build_add_embedding_pinecone_json et toute déclaration embedding_task sont commentées temporairement pour compilation.
