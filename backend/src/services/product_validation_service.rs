// ✅ NOUVEAU 2025-01-27 : Service de validation stricte pour les produits
// Validation complète des données produit avant insertion

use crate::core::types::{AppError, AppResult};
use serde_json::Value;
use sqlx::Row;
use std::collections::HashSet;

/// Constantes de validation
mod validation_constants {
    pub const MIN_NAME_LENGTH: usize = 1;
    pub const MAX_NAME_LENGTH: usize = 200;
    pub const MIN_DESCRIPTION_LENGTH: usize = 0;
    pub const MAX_DESCRIPTION_LENGTH: usize = 5000;
    pub const MAX_IMAGE_SIZE_MB: usize = 10;
    pub const MAX_VIDEO_SIZE_MB: usize = 100;
    pub const MAX_IMAGES_COUNT: usize = 10;
    pub const MAX_VIDEOS_COUNT: usize = 3;

    // Devises acceptées
    pub const ACCEPTED_CURRENCIES: &[&str] = &["XAF", "FCFA", "EUR", "USD", "GBP", "JPY", "CNY"];
}

/// Résultat de validation détaillé
#[derive(Debug, Clone)]
pub struct ProductValidationResult {
    pub is_valid: bool,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
}

impl ProductValidationResult {
    pub fn new() -> Self {
        Self {
            is_valid: true,
            errors: Vec::new(),
            warnings: Vec::new(),
        }
    }

    pub fn add_error(&mut self, error: String) {
        self.is_valid = false;
        self.errors.push(error);
    }

    pub fn add_warning(&mut self, warning: String) {
        self.warnings.push(warning);
    }
}

/// Valide les données d'un produit de manière stricte
pub fn validate_product_data(product_data: &Value) -> ProductValidationResult {
    let mut result = ProductValidationResult::new();

    // 1. Validation du nom
    validate_product_name(product_data, &mut result);

    // 2. Validation du prix
    validate_product_price(product_data, &mut result);

    // 3. Validation de la devise
    validate_product_currency(product_data, &mut result);

    // 4. Validation de la description
    validate_product_description(product_data, &mut result);

    // 5. Validation des images
    validate_product_images(product_data, &mut result);

    // 6. Validation des vidéos
    validate_product_videos(product_data, &mut result);

    // 7. Validation des champs optionnels
    validate_optional_fields(product_data, &mut result);

    result
}

/// Valide le nom du produit
fn validate_product_name(data: &Value, result: &mut ProductValidationResult) {
    let name = extract_string_field(data, "nom_produit")
        .or_else(|| extract_string_field(data, "nom"))
        .or_else(|| extract_string_field(data, "produits"));

    match name {
        Some(name) => {
            let trimmed = name.trim();
            if trimmed.is_empty() {
                result.add_error("Le nom du produit est requis".to_string());
            } else if trimmed.len() < validation_constants::MIN_NAME_LENGTH {
                result.add_error(format!(
                    "Le nom du produit doit contenir au moins {} caractère(s)",
                    validation_constants::MIN_NAME_LENGTH
                ));
            } else if trimmed.len() > validation_constants::MAX_NAME_LENGTH {
                result.add_error(format!(
                    "Le nom du produit ne peut pas dépasser {} caractères",
                    validation_constants::MAX_NAME_LENGTH
                ));
            }
        }
        None => {
            result.add_error("Le nom du produit est requis".to_string());
        }
    }
}

/// Valide le prix du produit
fn validate_product_price(data: &Value, result: &mut ProductValidationResult) {
    let price_str =
        extract_string_field(data, "prix").or_else(|| extract_string_field(data, "prix_produit"));

    if let Some(price_str) = price_str {
        let trimmed = price_str.trim();
        if trimmed.is_empty() {
            result.add_error("Le prix du produit est requis".to_string());
        } else {
            // Essayer de parser comme nombre
            match parse_price(trimmed) {
                Ok(price) => {
                    if price < 0.0 {
                        result.add_error("Le prix ne peut pas être négatif".to_string());
                    } else if price == 0.0 {
                        result.add_warning(
                            "Le prix est à zéro, vérifiez que c'est intentionnel".to_string(),
                        );
                    } else if price > 1_000_000_000.0 {
                        result.add_error("Le prix est trop élevé (maximum 1 milliard)".to_string());
                    }
                }
                Err(e) => {
                    result.add_error(format!("Format de prix invalide : {}", e));
                }
            }
        }
    } else {
        // Essayer de récupérer comme nombre
        if let Some(price_num) = data.get("prix").and_then(|v| v.as_f64()) {
            if price_num < 0.0 {
                result.add_error("Le prix ne peut pas être négatif".to_string());
            } else if price_num > 1_000_000_000.0 {
                result.add_error("Le prix est trop élevé (maximum 1 milliard)".to_string());
            }
        } else {
            result.add_error("Le prix du produit est requis".to_string());
        }
    }
}

/// Parse un prix depuis une chaîne (supporte formats variés)
fn parse_price(price_str: &str) -> Result<f64, String> {
    // Nettoyer la chaîne (supprimer espaces, séparateurs)
    let cleaned = price_str
        .replace(' ', "")
        .replace(',', ".")
        .replace('\u{00A0}', ""); // Espace insécable

    // Supprimer les caractères non numériques sauf le point
    let numeric_only: String = cleaned
        .chars()
        .filter(|c| c.is_ascii_digit() || *c == '.')
        .collect();

    numeric_only
        .parse::<f64>()
        .map_err(|_| format!("Impossible de parser '{}' comme nombre", price_str))
}

/// Valide la devise
fn validate_product_currency(data: &Value, result: &mut ProductValidationResult) {
    let currency = extract_string_field(data, "devise");

    if let Some(currency) = currency {
        let currency_upper = currency.to_uppercase();
        let accepted: HashSet<String> = validation_constants::ACCEPTED_CURRENCIES
            .iter()
            .map(|c| c.to_uppercase())
            .collect();

        if !accepted.contains(&currency_upper) {
            result.add_warning(format!(
                "Devise '{}' non standard. Devises recommandées : {}",
                currency,
                validation_constants::ACCEPTED_CURRENCIES.join(", ")
            ));
        }
    } else {
        result.add_warning("Aucune devise spécifiée, XAF sera utilisé par défaut".to_string());
    }
}

/// Valide la description
fn validate_product_description(data: &Value, result: &mut ProductValidationResult) {
    if let Some(desc) = extract_string_field(data, "description_produit")
        .or_else(|| extract_string_field(data, "description"))
    {
        if desc.len() > validation_constants::MAX_DESCRIPTION_LENGTH {
            result.add_error(format!(
                "La description ne peut pas dépasser {} caractères",
                validation_constants::MAX_DESCRIPTION_LENGTH
            ));
        }
    }
}

/// Valide les images du produit
fn validate_product_images(data: &Value, result: &mut ProductValidationResult) {
    let mut image_count = 0;
    let mut _total_size_estimate = 0;

    // Chercher dans différents champs
    let image_fields = ["imageUrls", "images", "base64_image"];

    for field in &image_fields {
        if let Some(images) = data.get(field) {
            if let Some(arr) = images.as_array() {
                image_count += arr.len();
                for img in arr {
                    if let Some(img_str) = img.as_str() {
                        // Estimer la taille (base64 = ~33% plus grand que binaire)
                        let estimated_size = (img_str.len() * 3) / 4;
                        _total_size_estimate += estimated_size;

                        // Vérifier la taille individuelle
                        let size_mb = estimated_size / (1024 * 1024);
                        if size_mb > validation_constants::MAX_IMAGE_SIZE_MB {
                            result.add_error(format!(
                                "Image trop volumineuse : {} MB (maximum {} MB)",
                                size_mb,
                                validation_constants::MAX_IMAGE_SIZE_MB
                            ));
                        }
                    }
                }
            } else if let Some(img_str) = images.as_str() {
                image_count += 1;
                let estimated_size = (img_str.len() * 3) / 4;
                _total_size_estimate += estimated_size;

                let size_mb = estimated_size / (1024 * 1024);
                if size_mb > validation_constants::MAX_IMAGE_SIZE_MB {
                    result.add_error(format!(
                        "Image trop volumineuse : {} MB (maximum {} MB)",
                        size_mb,
                        validation_constants::MAX_IMAGE_SIZE_MB
                    ));
                }
            }
        }
    }

    // Vérifier le nombre d'images
    if image_count > validation_constants::MAX_IMAGES_COUNT {
        result.add_error(format!(
            "Trop d'images : {} (maximum {})",
            image_count,
            validation_constants::MAX_IMAGES_COUNT
        ));
    }

    // Avertissement si aucune image
    if image_count == 0 {
        result.add_warning(
            "Aucune image fournie. Les produits avec images sont mieux visibles.".to_string(),
        );
    }
}

/// Valide les vidéos du produit
fn validate_product_videos(data: &Value, result: &mut ProductValidationResult) {
    let mut video_count = 0;
    let mut _total_size_estimate = 0;

    let video_fields = ["videoUrls", "videos", "video_base64"];

    for field in &video_fields {
        if let Some(videos) = data.get(field) {
            if let Some(arr) = videos.as_array() {
                video_count += arr.len();
                for video in arr {
                    if let Some(video_str) = video.as_str() {
                        let estimated_size = (video_str.len() * 3) / 4;
                        _total_size_estimate += estimated_size;

                        let size_mb = estimated_size / (1024 * 1024);
                        if size_mb > validation_constants::MAX_VIDEO_SIZE_MB {
                            result.add_error(format!(
                                "Vidéo trop volumineuse : {} MB (maximum {} MB)",
                                size_mb,
                                validation_constants::MAX_VIDEO_SIZE_MB
                            ));
                        }
                    }
                }
            } else if let Some(video_str) = videos.as_str() {
                video_count += 1;
                let estimated_size = (video_str.len() * 3) / 4;
                _total_size_estimate += estimated_size;

                let size_mb = estimated_size / (1024 * 1024);
                if size_mb > validation_constants::MAX_VIDEO_SIZE_MB {
                    result.add_error(format!(
                        "Vidéo trop volumineuse : {} MB (maximum {} MB)",
                        size_mb,
                        validation_constants::MAX_VIDEO_SIZE_MB
                    ));
                }
            }
        }
    }

    if video_count > validation_constants::MAX_VIDEOS_COUNT {
        result.add_error(format!(
            "Trop de vidéos : {} (maximum {})",
            video_count,
            validation_constants::MAX_VIDEOS_COUNT
        ));
    }
}

/// Valide les champs optionnels
fn validate_optional_fields(data: &Value, result: &mut ProductValidationResult) {
    // Validation de la catégorie si présente
    if let Some(cat) = extract_string_field(data, "categorie_produit") {
        if cat.len() > 100 {
            result.add_warning(
                "La catégorie est très longue, vérifiez qu'elle est correcte".to_string(),
            );
        }
    }

    // Validation du lieu si présent
    if let Some(lieu) = extract_string_field(data, "lieu_produit") {
        if lieu.len() > 500 {
            result.add_warning("Le lieu est très long, vérifiez qu'il est correct".to_string());
        }
    }
}

/// Helper pour extraire un champ string
fn extract_string_field(value: &Value, key: &str) -> Option<String> {
    value
        .get(key)
        .and_then(|v| {
            v.as_str().map(|s| s.to_string()).or_else(|| {
                v.get("valeur")
                    .and_then(|v2| v2.as_str())
                    .map(|s| s.to_string())
            })
        })
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

/// Valide et retourne une erreur AppError si invalide
pub fn validate_product_data_strict(product_data: &Value) -> AppResult<()> {
    let validation = validate_product_data(product_data);

    if !validation.is_valid {
        let error_msg = format!("Validation échouée : {}", validation.errors.join("; "));
        return Err(AppError::BadRequest(error_msg));
    }

    // Avertissements non bloquants mais loggés
    if !validation.warnings.is_empty() {
        log::warn!(
            "Avertissements de validation produit : {}",
            validation.warnings.join("; ")
        );
    }

    Ok(())
}

/// Notifie si la configuration de livraison est manquante pour un produit
pub async fn notify_missing_delivery_config(
    _pool: &sqlx::PgPool,
    service_id: i32,
    product_index: i32,
) -> AppResult<()> {
    // TODO: Implémenter la notification (email, push, etc.)
    log::warn!(
        "[notify_missing_delivery_config] Configuration de livraison manquante pour service_id={}, product_index={}",
        service_id,
        product_index
    );
    Ok(())
}

/// Structure pour la validation d'activation de produit
#[derive(Debug, Clone, serde::Serialize)]
pub struct ProductActivationValidation {
    pub is_valid: bool,
    pub errors: Vec<String>,
    pub missing_fields: Vec<String>,
}

/// Valide un produit pour activation (vérifie que tous les champs requis sont présents)
pub async fn validate_product_for_activation(
    pool: &sqlx::PgPool,
    service_id: i32,
    product_index: i32,
) -> AppResult<ProductActivationValidation> {
    // Récupérer le produit depuis la base de données
    let service_row = sqlx::query("SELECT data FROM services WHERE id = $1 AND is_active = true")
        .bind(service_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur récupération service: {}", e)))?;

    let service_data: Value = match service_row {
        Some(row) => row
            .try_get::<Value, _>("data")
            .map_err(|e| AppError::Internal(format!("Erreur parsing service data: {}", e)))?,
        None => {
            return Ok(ProductActivationValidation {
                is_valid: false,
                errors: vec!["Service non trouvé".to_string()],
                missing_fields: vec![],
            });
        }
    };

    let produits = service_data.get("produits").and_then(|v| v.as_array());

    let produit = match produits {
        Some(produits_array) => produits_array.get(product_index as usize),
        None => None,
    };

    let mut validation = ProductActivationValidation {
        is_valid: true,
        errors: Vec::new(),
        missing_fields: Vec::new(),
    };

    if let Some(produit_obj) = produit.and_then(|v| v.as_object()) {
        // Vérifier les champs requis pour activation
        if produit_obj.get("nom").is_none() {
            validation.missing_fields.push("nom".to_string());
            validation.is_valid = false;
        }
        if produit_obj.get("prix").is_none() {
            validation.missing_fields.push("prix".to_string());
            validation.is_valid = false;
        }
        // Vérifier la configuration de livraison si nécessaire
        if produit_obj.get("delivery_config").is_none() {
            validation
                .missing_fields
                .push("delivery_config".to_string());
            validation
                .errors
                .push("Configuration de livraison manquante".to_string());
            validation.is_valid = false;
        }
    } else {
        validation.is_valid = false;
        validation
            .errors
            .push(format!("Produit à l'index {} non trouvé", product_index));
    }

    Ok(validation)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_validate_product_name() {
        let mut result = ProductValidationResult::new();
        let data = json!({});
        validate_product_name(&data, &mut result);
        assert!(!result.is_valid);
        assert!(result.errors.iter().any(|e| e.contains("nom")));
    }

    #[test]
    fn test_validate_product_price() {
        let mut result = ProductValidationResult::new();
        let data = json!({ "prix": "-100" });
        validate_product_price(&data, &mut result);
        assert!(!result.is_valid);
        assert!(result.errors.iter().any(|e| e.contains("négatif")));
    }

    #[test]
    fn test_parse_price() {
        assert_eq!(parse_price("1000").unwrap(), 1000.0);
        assert_eq!(parse_price("1 000").unwrap(), 1000.0);
        assert_eq!(parse_price("1,000.50").unwrap(), 1000.50);
    }
}
