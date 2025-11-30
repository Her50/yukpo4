// ✅ NOUVEAU 2025-11-01 : Contrôleur pour l'ajout incrémental de produits
// Ce contrôleur permet d'ajouter un nouveau produit à un service existant
// sans réenvoyer tout le service, avec un coût fixe de 3000 FCFA

use crate::core::types::{AppError, AppResult};
use crate::state::AppState;
use axum::{
    extract::{Path as AxumPath, State},
    Extension, Json,
};
use base64::{engine::general_purpose::STANDARD, Engine};
use chrono::Utc;
#[cfg(feature = "image_search")]
use md5;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::Row;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::fs;
use uuid::Uuid;
use futures::stream::FuturesUnordered;
use futures::StreamExt;

#[derive(Debug, Deserialize)]
pub struct AddProductRequest {
    pub user_id: i32,
    pub product_data: Value, // Données du nouveau produit uniquement
}

#[derive(Debug, Serialize)]
pub struct AddProductResponse {
    pub success: bool,
    pub service_id: i32,
    pub product_index: usize,
    pub cost: i64,
    pub message: String,
}

/// Ajouter un nouveau produit à un service existant
/// Route : POST /api/services/{service_id}/products
#[axum::debug_handler]
pub async fn add_product_to_service(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<crate::middlewares::jwt::AuthenticatedUser>,
    AxumPath(service_id): AxumPath<i32>,
    Json(request): Json<AddProductRequest>,
) -> AppResult<Json<Value>> {
    use crate::utils::log::{log_error, log_info};

    log_info(&format!(
        "[add_product_to_service] 📦 Ajout d'un produit au service {}",
        service_id
    ));

    // ✅ Vérification : L'utilisateur est-il le propriétaire du service ?
    let service_row =
        sqlx::query("SELECT user_id, data FROM services WHERE id = $1 AND is_active = true")
            .bind(service_id)
            .fetch_optional(&state.pg)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur récupération service: {}", e)))?;

    let (owner_id, mut service_data): (i32, Value) = match service_row {
        Some(row) => (
            row.try_get("user_id")
                .map_err(|e| AppError::Internal(e.to_string()))?,
            row.try_get("data")
                .map_err(|e| AppError::Internal(e.to_string()))?,
        ),
        None => {
            log_error(&format!(
                "[add_product_to_service] Service {} introuvable",
                service_id
            ));
            return Err(AppError::NotFound(format!(
                "Service {} introuvable",
                service_id
            )));
        }
    };

    // Vérifier que l'utilisateur authentifié est bien le propriétaire
    if owner_id != user.id {
        log_error(&format!(
            "[add_product_to_service] User {} n'est pas propriétaire du service {}",
            user.id, service_id
        ));
        return Err(AppError::Unauthorized(
            "Vous n'êtes pas le propriétaire de ce service".to_string(),
        ));
    }

    // ✅ Coût fixe : 2000 FCFA pour ajouter un produit dupliqué
    mod service_costs {
        pub const COST_NEW_PRODUCT_DUPLICATE_XAF: i64 = 2000;
    }
    let cout_ajout = service_costs::COST_NEW_PRODUCT_DUPLICATE_XAF;

    // ✅ Vérifier le solde
    let current_balance_result = sqlx::query("SELECT tokens_balance FROM users WHERE id = $1")
        .bind(user.id)
        .fetch_one(&state.pg)
        .await;

    let current_balance = match current_balance_result {
        Ok(row) => row.try_get::<i64, _>("tokens_balance").unwrap_or(0),
        Err(e) => {
            log_error(&format!(
                "[add_product_to_service] Erreur récupération solde: {}",
                e
            ));
            return Err(AppError::Internal(format!(
                "Erreur récupération solde: {}",
                e
            )));
        }
    };

    if current_balance < cout_ajout {
        log_error(&format!(
            "[add_product_to_service] Solde insuffisant: {} < {}",
            current_balance, cout_ajout
        ));
        return Err(AppError::BadRequest(format!(
            "Solde insuffisant: {} FCFA disponible, {} FCFA requis",
            current_balance, cout_ajout
        )));
    }

    // ✅ Débiter le solde
    let debit_result = sqlx::query(
        "UPDATE users SET tokens_balance = tokens_balance - $1 WHERE id = $2 RETURNING tokens_balance"
    )
    .bind(cout_ajout)
    .bind(user.id)
    .fetch_one(&state.pg)
    .await;

    let new_balance = match debit_result {
        Ok(row) => row.try_get::<i64, _>("tokens_balance").unwrap_or(0),
        Err(e) => {
            log_error(&format!(
                "[add_product_to_service] Échec débit solde: {}",
                e
            ));
            return Err(AppError::Internal(format!("Erreur débit solde: {}", e)));
        }
    };

    log_info(&format!(
        "[add_product_to_service] ✅ Solde débité: {} FCFA (ancien: {}, nouveau: {})",
        cout_ajout, current_balance, new_balance
    ));

    // ✅ CORRECTION 2025-11-24: Sauvegarder le produit comme un objet structuré au lieu d'une chaîne
    // Format attendu par MesServicesScreen: { nom_produit, description_produit, categorie_produit, prix, devise, ... }
    let extract_string = |value: &Value| -> Option<String> {
        value.as_str().map(|s| s.to_string()).or_else(|| {
            value
                .get("valeur")
                .and_then(|v| v.as_str().map(|s| s.to_string()))
        })
    };

    let extract_number = |value: &Value| -> Option<f64> {
        value.as_f64().or_else(|| {
            value
                .get("valeur")
                .and_then(|v| v.as_f64())
        })
    };

    // Construire l'objet produit structuré
    let mut product_obj = json!({});

    // nom_produit
    if let Some(nom) = request
        .product_data
        .get("nom_produit")
        .or_else(|| request.product_data.get("produits"))
        .and_then(extract_string)
    {
        if !nom.is_empty() {
            product_obj["nom_produit"] = json!(nom);
            // ✅ CORRECTION: Ajouter aussi le champ "nom" pour compatibilité avec MesServicesScreen
            product_obj["nom"] = json!(nom);
        }
    }

    // description_produit
    if let Some(desc) = request
        .product_data
        .get("description_produit")
        .and_then(extract_string)
    {
        if !desc.is_empty() {
            product_obj["description_produit"] = json!(desc);
        }
    }

    // categorie_produit
    if let Some(cat) = request
        .product_data
        .get("categorie_produit")
        .and_then(extract_string)
    {
        if !cat.is_empty() {
            product_obj["categorie_produit"] = json!(cat);
        }
    }

    // prix
    if let Some(prix) = request
        .product_data
        .get("prix")
        .or_else(|| request.product_data.get("prix_produit"))
        .and_then(|v| extract_string(v).or_else(|| extract_number(v).map(|n| n.to_string())))
    {
        if !prix.is_empty() {
            product_obj["prix"] = json!(prix);
        }
    }

    // devise
    if let Some(devise) = request
        .product_data
        .get("devise")
        .and_then(extract_string)
    {
        if !devise.is_empty() {
            product_obj["devise"] = json!(devise);
        }
    }

    // lieu_produit
    if let Some(lieu) = request
        .product_data
        .get("lieu_produit")
        .or_else(|| request.product_data.get("lieu_commercial"))
        .or_else(|| request.product_data.get("lieu_commercialisation"))
        .and_then(extract_string)
    {
        if !lieu.is_empty() {
            product_obj["lieu_produit"] = json!(lieu);
        }
    }

    // Conserver toutes les autres propriétés du product_data
    if let Some(obj) = request.product_data.as_object() {
        for (key, value) in obj {
            if !["nom_produit", "description_produit", "categorie_produit", "prix", "prix_produit", "devise", "lieu_produit", "lieu_commercial", "lieu_commercialisation", "produits"].contains(&key.as_str()) {
                product_obj[key] = value.clone();
            }
        }
    }

    // ✅ OPTIMISATION : Plus besoin de générer la chaîne concaténée
    // Les arrays pour la recherche seront générés directement depuis l'objet JSON dans save_autocomplete_combination
    log_info(&format!(
        "[add_product_to_service] 📝 Product object (structured JSON): {:?}",
        product_obj
    ));

    // ✅ NOUVEAU 2025-11-26: Sauvegarder les médias du produit AVANT d'ajouter au service
    // Cela permet d'obtenir le product_index correct pour lier les médias au produit
    let produits_array = service_data
        .get_mut("produits")
        .and_then(|p| p.as_object_mut())
        .and_then(|obj| obj.get_mut("valeur"))
        .and_then(|v| v.as_array_mut());

    // Calculer le product_index AVANT d'ajouter le produit (pour sauvegarder les médias)
    let product_index = match produits_array {
        Some(arr) => arr.len(), // Index du nouveau produit (pas encore ajouté)
        None => 0,
    };

    // ✅ NOUVEAU 2025-11-26: Sauvegarder les médias du produit
    let saved_media_paths = save_product_media(
        &state,
        service_id,
        product_index,
        &request.product_data,
        &product_obj,
    )
    .await;

    // Remplacer les base64 par les chemins de fichiers dans product_obj
    // ✅ CORRECTION: Utiliser une référence pour éviter le move
    if let Some(ref image_paths) = saved_media_paths.images {
        product_obj["images"] = json!(image_paths.clone());
    }
    if let Some(video_paths) = saved_media_paths.videos {
        product_obj["videos"] = json!(video_paths);
    }

    // Maintenant ajouter le produit au service_data
    let produits_array = service_data
        .get_mut("produits")
        .and_then(|p| p.as_object_mut())
        .and_then(|obj| obj.get_mut("valeur"))
        .and_then(|v| v.as_array_mut());

    match produits_array {
        Some(arr) => {
            // ✅ CORRECTION: Ajouter l'objet structuré au lieu de la chaîne
            arr.push(product_obj.clone());
        }
        None => {
            // Créer le tableau de produits s'il n'existe pas
            service_data["produits"] = json!({
                "type_donnee": "autocomplete",
                "valeur": vec![product_obj.clone()],
                "separateur": ",",
                "sous_caracteristiques": {},
                "filtrable": true,
                "origine_champs": "formulaire"
            });
        }
    };

    // ✅ NOUVEAU 2025-11-06: Ajouter lieu_produit au service_data pour save_autocomplete_combination
    if let Some(lieu) = request
        .product_data
        .get("lieu_produit")
        .or_else(|| request.product_data.get("lieu_commercial"))
        .or_else(|| request.product_data.get("lieu_commercialisation"))
    {
        service_data["lieu_produit"] = json!({
            "type_donnee": "string",
            "valeur": lieu.as_str().unwrap_or(""),
            "origine_champs": "formulaire"
        });
    }

    // ✅ Mettre à jour le service en base
    let update_result =
        sqlx::query("UPDATE services SET data = $1, updated_at = NOW() WHERE id = $2")
            .bind(&service_data)
            .bind(service_id)
            .execute(&state.pg)
            .await;

    match update_result {
        Ok(_) => {
            log_info(&format!(
                "[add_product_to_service] ✅ Produit ajouté au service {} (index: {})",
                service_id, product_index
            ));

            // ✅ NOUVEAU 2025-11-06: Sauvegarder dans autocomplete_characteristics et autocomplete_combinations
            // Créer un data_obj temporaire avec SEULEMENT le nouveau produit (pas tous les produits du service)
            // ✅ CORRECTION 2025-11-24: Extraire le nom du produit depuis product_obj pour autocomplete
            let product_string = product_obj
                .get("nom_produit")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            
            let temp_data_obj = {
                let mut obj = json!({
                    "produits": {
                        "type_donnee": "autocomplete",
                        "valeur": product_string,
                        "separateur": ",",
                        "filtrable": true,
                        "origine_champs": "formulaire"
                    }
                });

                // Ajouter lieu_produit si présent
                if let Some(lieu) = request
                    .product_data
                    .get("lieu_produit")
                    .or_else(|| request.product_data.get("lieu_commercial"))
                    .or_else(|| request.product_data.get("lieu_commercialisation"))
                {
                    obj["lieu_produit"] = json!({
                        "type_donnee": "string",
                        "valeur": lieu.as_str().unwrap_or(""),
                        "origine_champs": "formulaire"
                    });
                }

                obj
            };

            // Appeler save_autocomplete_combination pour indexer SEULEMENT le nouveau produit
            if let Err(e) = crate::services::creer_service::save_autocomplete_combination(
                &state.pg,
                service_id,
                &temp_data_obj,
            )
            .await
            {
                log_error(&format!(
                    "[add_product_to_service] ⚠️ Erreur sauvegarde autocomplete: {} (non bloquant)",
                    e
                ));
            } else {
                log_info(&format!("[add_product_to_service] ✅ Produit indexé dans autocomplete_characteristics + autocomplete_combinations"));
            }

            let extract_string = |value: &serde_json::Value| -> Option<String> {
                value.as_str().map(|s| s.to_string()).or_else(|| {
                    value
                        .get("valeur")
                        .and_then(|v| v.as_str().map(|s| s.to_string()))
                })
            };

            let product_name = request
                .product_data
                .get("nom_produit")
                .and_then(extract_string)
                .unwrap_or_else(|| "Produit".to_string());

            let product_category = request
                .product_data
                .get("categorie_produit")
                .and_then(extract_string)
                .unwrap_or_else(|| "Sans catégorie".to_string());

            let product_price = request.product_data.get("prix_produit").and_then(|v| {
                v.as_f64()
                    .or_else(|| extract_string(v).and_then(|s| s.parse::<f64>().ok()))
            });

            let title = format!("✨ Produit ajouté: {}", product_name);

            let mut details = format!(
                "{} ajouté (catégorie: {}, index: {})",
                product_name, product_category, product_index
            );

            if let Some(price) = product_price {
                details.push_str(&format!(", prix: {} FCFA", price as i64));
            }

            let _ = crate::services::notification_service::create_notification(
                &state.pg,
                user.id,
                crate::services::notification_service::NotificationType::ProductAdded,
                title,
                details,
                Some(json!({
                    "service_id": service_id,
                    "product_index": product_index,
                    "cost": cout_ajout,
                    "product_name": product_name,
                    "product_category": product_category,
                    "product_price": product_price
                })),
            )
            .await;

            // ✅ AMÉLIORATION: Ajouter warning si aucune image
            let warning_message = if saved_media_paths.images.is_none() || 
                (saved_media_paths.images.as_ref().map(|v| v.is_empty()).unwrap_or(true)) {
                Some("Aucune image ajoutée. La génération de vidéo nécessite au moins une image.".to_string())
            } else {
                None
            };

            Ok(Json(json!({
                "success": true,
                "service_id": service_id,
                "product_index": product_index,
                "cost": cout_ajout,
                "message": format!("Produit ajouté avec succès (coût: {} FCFA)", cout_ajout),
                "new_balance": new_balance,
                "warning": warning_message
            })))
        }
        Err(e) => {
            log_error(&format!(
                "[add_product_to_service] Erreur mise à jour service: {}",
                e
            ));

            // ✅ ROLLBACK : Rembourser l'utilisateur en cas d'échec
            let _ =
                sqlx::query("UPDATE users SET tokens_balance = tokens_balance + $1 WHERE id = $2")
                    .bind(cout_ajout)
                    .bind(user.id)
                    .execute(&state.pg)
                    .await;

            Err(AppError::Internal(format!(
                "Erreur mise à jour service: {}",
                e
            )))
        }
    }
}

// ✅ NOUVEAU 2025-11-26: Structure pour stocker les chemins de médias sauvegardés
struct SavedMediaPaths {
    images: Option<Vec<String>>,
    videos: Option<Vec<String>>,
}

// ✅ OPTIMISÉ: Fonction helper pour traiter une seule image en parallèle
async fn process_single_image_async(
    storage_root: &PathBuf,
    service_id: i32,
    product_id: &str,
    product_index: usize,
    image_index: usize,
    image_data: &str,
    is_main: bool,
    pool: &sqlx::PgPool,
) -> AppResult<Option<String>> {
    use crate::utils::log::{log_error, log_info, log_warn};

    if image_data.is_empty() {
        return Ok(None);
    }

    log_info(&format!(
        "[process_single_image_async] 🖼️ Traitement image {} de produit {} (main: {})",
        image_index, product_index, is_main
    ));

    // Sauvegarder l'image
    let stored = if is_url(image_data) {
        download_and_save_image(storage_root.as_path(), service_id, image_data, "images").await
    } else if is_probable_base64(image_data) {
        persist_base64_media(storage_root.as_path(), service_id, "images", image_data, "jpg").await
    } else {
        log_warn(&format!(
            "[process_single_image_async] Image ignorée (format non supporté) pour produit {}",
            product_index
        ));
        return Ok(None);
    };

    let stored = match stored {
        Ok(value) => value,
        Err(err) => {
            log_error(&format!(
                "[process_single_image_async] Erreur sauvegarde image produit {}: {}",
                product_index, err
            ));
            return Err(err);
        }
    };

    let file_path = stored.path;
    #[cfg(feature = "image_search")]
    let image_bytes = stored.bytes;
    #[cfg(not(feature = "image_search"))]
    let _image_bytes = stored.bytes;

    // Générer signature d'image si disponible
    #[cfg(feature = "image_search")]
    let (image_signature, image_hash, image_metadata) = if !image_bytes.is_empty() {
        match crate::services::image_search_service::ImageSearchService::generate_image_signature(&image_bytes) {
            Ok(signature) => {
                let metadata = crate::services::image_search_service::ImageSearchService::extract_image_metadata(&image_bytes).unwrap_or_else(|_| {
                    serde_json::json!({
                        "width": 0,
                        "height": 0,
                        "format": "jpeg",
                        "file_size": image_bytes.len(),
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
                log_warn(&format!("[process_single_image_async] Erreur signature: {}", e));
                (serde_json::Value::Null, String::new(), serde_json::Value::Null)
            }
        }
    } else {
        (serde_json::Value::Null, String::new(), serde_json::Value::Null)
    };

    #[cfg(not(feature = "image_search"))]
    let (image_signature, image_hash, image_metadata) = (
        serde_json::Value::Null,
        String::new(),
        serde_json::Value::Null,
    );

    // Insérer dans la table media
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
    .bind(product_id)
    .bind(product_index as i32)
    .bind("image")
    .bind(&file_path)
    .bind(is_main)
    .bind(image_index as i32)
    .bind(Utc::now().naive_utc())
    .bind(image_signature)
    .bind(image_hash)
    .bind(image_metadata)
    .execute(pool)
    .await
    {
        log_error(&format!(
            "[process_single_image_async] Erreur insertion media image: {}",
            e
        ));
        return Err(AppError::Internal(format!("Erreur insertion media: {}", e)));
    }

    Ok(Some(file_path))
}

// ✅ NOUVEAU 2025-11-26: Fonction helper pour sauvegarder les médias d'un produit
async fn save_product_media(
    state: &Arc<AppState>,
    service_id: i32,
    product_index: usize,
    product_data: &Value,
    _product_obj: &Value,
) -> SavedMediaPaths {
    use crate::utils::log::{log_error, log_info, log_warn};

    let storage_root = PathBuf::from(
        std::env::var("UPLOAD_STORAGE_PATH").unwrap_or_else(|_| "./uploads".to_string()),
    );
    let product_id = format!("prod_{}", product_index);

    let mut saved_images: Vec<String> = Vec::new();
    let mut saved_videos: Vec<String> = Vec::new();

    // Extraire les images
    let mut images_to_process: Vec<String> = Vec::new();
    
    // ✅ NOUVEAU: Chercher d'abord dans imageUrls (upload préalable)
    if let Some(image_urls) = product_data.get("imageUrls").and_then(|v| v.as_array()) {
        for img in image_urls {
            if let Some(img_str) = img.as_str() {
                if !img_str.is_empty() {
                    images_to_process.push(img_str.to_string());
                }
            }
        }
    }
    
    // Chercher dans images (URLs ou base64)
    if let Some(images) = product_data.get("images").and_then(|v| v.as_array()) {
        for img in images {
            if let Some(img_str) = img.as_str() {
                if !img_str.is_empty() {
                    images_to_process.push(img_str.to_string());
                }
            }
        }
    }
    
    // Chercher dans base64_image (rétrocompatibilité)
    if let Some(base64_image) = product_data.get("base64_image") {
        if let Some(base64_array) = base64_image.as_array() {
            for img in base64_array {
                if let Some(img_str) = img.as_str() {
                    if !img_str.is_empty() {
                        images_to_process.push(img_str.to_string());
                    }
                }
            }
        } else if let Some(base64_str) = base64_image.as_str() {
            if !base64_str.is_empty() {
                images_to_process.push(base64_str.to_string());
            }
        }
    }

    // ✅ OPTIMISÉ: Sauvegarder les images en PARALLÈLE pour améliorer les performances
    if !images_to_process.is_empty() {
        log_info(&format!(
            "[add_product_to_service] 🚀 Traitement parallèle de {} images pour produit {}",
            images_to_process.len(),
            product_index
        ));

        let pool = state.pg.clone();
        let mut futures = FuturesUnordered::new();

        // Créer une future pour chaque image
        for (image_index, image_data) in images_to_process.iter().enumerate() {
            if image_data.is_empty() {
                continue;
            }

            let is_main = image_index == 0;
            let image_data = image_data.clone();
            let storage_root_clone = storage_root.clone();
            let service_id_clone = service_id;
            let product_id_clone = product_id.clone();
            let product_index_clone = product_index;
            let pool_clone = pool.clone();

            futures.push(tokio::spawn(async move {
                let result = process_single_image_async(
                    &storage_root_clone,
                    service_id_clone,
                    &product_id_clone,
                    product_index_clone,
                    image_index,
                    &image_data,
                    is_main,
                    &pool_clone,
                ).await;

                (image_index, is_main, result)
            }));
        }

        // Collecter les résultats au fur et à mesure qu'ils arrivent
        let mut results: Vec<(usize, bool, Option<String>)> = Vec::new();
        while let Some(result) = futures.next().await {
            match result {
                Ok((image_index, is_main, Ok(Some(file_path)))) => {
                    results.push((image_index, is_main, Some(file_path)));
                    log_info(&format!(
                        "[add_product_to_service] ✅ Image {} du produit {} traitée en parallèle (main: {})",
                        image_index + 1,
                        product_index,
                        is_main
                    ));
                }
                Ok((image_index, is_main, Ok(None))) => {
                    log_warn(&format!(
                        "[add_product_to_service] ⚠️ Image {} du produit {} ignorée",
                        image_index + 1,
                        product_index
                    ));
                }
                Ok((image_index, _is_main, Err(e))) => {
                    log_error(&format!(
                        "[add_product_to_service] ❌ Erreur traitement image {} du produit {}: {}",
                        image_index + 1,
                        product_index,
                        e
                    ));
                }
                Err(e) => {
                    log_error(&format!(
                        "[add_product_to_service] ❌ Erreur task image du produit {}: {}",
                        product_index,
                        e
                    ));
                }
            }
        }

        // Trier par index pour préserver l'ordre et ajouter aux images sauvegardées
        results.sort_by_key(|(idx, _, _)| *idx);
        for (_idx, _is_main, file_path_opt) in results {
            if let Some(file_path) = file_path_opt {
                saved_images.push(file_path);
            }
        }

        log_info(&format!(
            "[add_product_to_service] ✅ {} images sauvegardées en parallèle pour produit {}",
            saved_images.len(),
            product_index
        ));
    }

    // Extraire et sauvegarder les vidéos
    let mut videos_to_process: Vec<String> = Vec::new();
    
    // ✅ NOUVEAU: Chercher d'abord dans videoUrls (upload préalable)
    if let Some(video_urls) = product_data.get("videoUrls").and_then(|v| v.as_array()) {
        for video in video_urls {
            if let Some(video_str) = video.as_str() {
                if !video_str.is_empty() {
                    videos_to_process.push(video_str.to_string());
                }
            }
        }
    }
    
    // Chercher dans videos (URLs ou base64)
    if let Some(videos) = product_data.get("videos").and_then(|v| v.as_array()) {
        for video in videos {
            if let Some(video_str) = video.as_str() {
                if !video_str.is_empty() {
                    videos_to_process.push(video_str.to_string());
                }
            }
        }
    }
    
    // Chercher dans video_base64 (rétrocompatibilité)
    if let Some(video_base64) = product_data.get("video_base64") {
        if let Some(video_array) = video_base64.as_array() {
            for video in video_array {
                if let Some(video_str) = video.as_str() {
                    if !video_str.is_empty() {
                        videos_to_process.push(video_str.to_string());
                    }
                }
            }
        } else if let Some(video_str) = video_base64.as_str() {
            if !video_str.is_empty() {
                videos_to_process.push(video_str.to_string());
            }
        }
    }
    
    if !videos_to_process.is_empty() {
        for (video_index, video_data) in videos_to_process.iter().enumerate() {
            let video_str = video_data.as_str();
            if video_str.is_empty() {
                continue;
            }

            let file_path = if is_url(video_str) {
                video_str.to_string()
            } else if is_probable_base64(video_str) {
                match persist_base64_media(storage_root.as_path(), service_id, "videos", video_str, "mp4").await {
                    Ok(stored) => stored.path,
                    Err(e) => {
                        log_error(&format!(
                            "[add_product_to_service] Erreur sauvegarde vidéo produit {}: {}",
                            product_index, e
                        ));
                        continue;
                    }
                }
            } else {
                log_warn(&format!(
                    "[add_product_to_service] Vidéo ignorée (format non supporté) pour produit {}",
                    product_index
                ));
                continue;
            };

            // Insérer dans la table media
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
            .execute(&state.pg)
            .await
            {
                log_error(&format!(
                    "[add_product_to_service] Erreur insertion media video: {}",
                    e
                ));
                continue;
            }

            saved_videos.push(file_path);
            log_info(&format!(
                "[add_product_to_service] ✅ Vidéo {}/{} du produit {} sauvegardée",
                video_index + 1,
                videos_to_process.len(),
                product_index
            ));
        }
    }

    SavedMediaPaths {
        images: if saved_images.is_empty() { None } else { Some(saved_images) },
        videos: if saved_videos.is_empty() { None } else { Some(saved_videos) },
    }
}

// ✅ Helper functions (copiées depuis creer_service.rs)
fn is_probable_base64(data: &str) -> bool {
    if data.starts_with("data:") {
        return true;
    }
    if data.starts_with("http://") || data.starts_with("https://") {
        return false;
    }
    if data.len() < 80 {
        return false;
    }
    let valid_chars = data.chars()
        .all(|c| c.is_ascii_alphanumeric() || matches!(c, '+' | '/' | '=' | '\n' | '\r' | ' '));
    let has_base64_chars = data.contains('+') || data.contains('/') || data.contains('=');
    let base64_char_count = data.chars()
        .filter(|c| c.is_ascii_alphanumeric() || matches!(c, '+' | '/' | '='))
        .count();
    let base64_ratio = base64_char_count as f64 / data.len() as f64;
    valid_chars && has_base64_chars && base64_ratio >= 0.8
}

fn is_url(data: &str) -> bool {
    data.starts_with("http://") || data.starts_with("https://")
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
                _ => default_ext.to_string(),
            };
        }
    }
    default_ext.to_string()
}

struct StoredMedia {
    path: String,
    bytes: Vec<u8>,
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

async fn download_and_save_image(
    storage_root: &Path,
    service_id: i32,
    image_url: &str,
    subdir: &str,
) -> AppResult<StoredMedia> {
    use crate::utils::log::log_info;

    log_info(&format!(
        "[add_product_to_service] 📥 Téléchargement image depuis URL: {}",
        image_url
    ));

    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| AppError::Internal(format!("Erreur création client HTTP: {}", e)))?;

    let response = client
        .get(image_url)
        .send()
        .await
        .map_err(|e| AppError::BadRequest(format!("Erreur téléchargement image depuis {}: {}", image_url, e)))?;

    if !response.status().is_success() {
        return Err(AppError::BadRequest(format!(
            "Erreur HTTP {} lors du téléchargement de l'image",
            response.status()
        )));
    }

    let content_type = response
        .headers()
        .get("content-type")
        .and_then(|ct| ct.to_str().ok())
        .map(|s| s.to_string());

    let bytes = response
        .bytes()
        .await
        .map_err(|e| AppError::BadRequest(format!("Erreur lecture image: {}", e)))?
        .to_vec();

    let extension = content_type
        .as_deref()
        .and_then(|ct| {
            if ct.contains("image/png") {
                Some("png")
            } else if ct.contains("image/jpeg") || ct.contains("image/jpg") {
                Some("jpg")
            } else if ct.contains("image/gif") {
                Some("gif")
            } else if ct.contains("image/webp") {
                Some("webp")
            } else if ct.contains("image/svg") {
                Some("svg")
            } else {
                None
            }
        })
        .or_else(|| {
            if let Some(dot_pos) = image_url.rfind('.') {
                let ext = &image_url[dot_pos + 1..];
                match ext.to_lowercase().as_str() {
                    "png" => Some("png"),
                    "jpg" | "jpeg" => Some("jpg"),
                    "gif" => Some("gif"),
                    "webp" => Some("webp"),
                    "svg" => Some("svg"),
                    _ => None,
                }
            } else {
                None
            }
        })
        .unwrap_or("jpg");

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

    log_info(&format!(
        "[add_product_to_service] ✅ Image téléchargée et sauvegardée: {}",
        path_str
    ));

    Ok(StoredMedia {
        path: path_str,
        bytes,
    })
}
