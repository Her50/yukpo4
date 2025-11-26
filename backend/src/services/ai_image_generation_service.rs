use std::sync::Arc;

use log::{error, info, warn};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::core::types::{AppError, AppResult};
use crate::state::AppState;

#[derive(Debug, Serialize, Deserialize)]
struct DalleResponse {
    data: Vec<DalleImage>,
}

#[derive(Debug, Serialize, Deserialize)]
struct DalleImage {
    url: String,
    revised_prompt: Option<String>,
}

/// Service de génération d'images par IA (DALL-E 3)
pub struct AIImageGenerationService {
    client: Client,
    api_key: String,
    base_url: String,
}

impl AIImageGenerationService {
    pub fn new() -> AppResult<Self> {
        let api_key = std::env::var("OPENAI_API_KEY")
            .map_err(|_| AppError::Internal("OPENAI_API_KEY non configurée".to_string()))?;

        Ok(Self {
            client: Client::new(),
            api_key,
            base_url: "https://api.openai.com/v1".to_string(),
        })
    }

    /// Génère des images pour un produit/service basées sur la description
    /// 
    /// # Arguments
    /// * `description` - Description du produit/service
    /// * `count` - Nombre d'images à générer (1-5, DALL-E 3 limite à 1 par requête)
    /// 
    /// # Returns
    /// Vec de bytes d'images (JPEG)
    pub async fn generate_product_images(
        &self,
        description: &str,
        count: usize,
    ) -> AppResult<Vec<Vec<u8>>> {
        info!(
            "[AIImageGeneration] Génération de {} image(s) pour: {}",
            count,
            description.chars().take(100).collect::<String>()
        );

        let mut images = Vec::new();
        let max_count = count.min(5); // Limite à 5 images max

        // DALL-E 3 génère 1 image par requête, donc on fait plusieurs requêtes
        for i in 0..max_count {
            match self.generate_single_image(description, i + 1, max_count).await {
                Ok(image_bytes) => {
                    images.push(image_bytes);
                    info!("[AIImageGeneration] ✅ Image {} générée avec succès", i + 1);
                }
                Err(err) => {
                    warn!(
                        "[AIImageGeneration] ⚠️ Erreur génération image {}: {}",
                        i + 1, err
                    );
                    // Continuer même si une image échoue
                }
            }

            // Petit délai entre les requêtes pour éviter rate limiting
            if i < max_count - 1 {
                tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
            }
        }

        if images.is_empty() {
            return Err(AppError::Internal(
                "Impossible de générer des images avec l'IA".to_string(),
            ));
        }

        info!(
            "[AIImageGeneration] ✅ {} image(s) générée(s) avec succès",
            images.len()
        );

        Ok(images)
    }

    /// Génère une seule image avec DALL-E 3
    async fn generate_single_image(
        &self,
        description: &str,
        image_number: usize,
        total: usize,
    ) -> AppResult<Vec<u8>> {
        // Construire le prompt optimisé pour DALL-E 3
        let prompt = if total > 1 {
            format!(
                "Professional product photography, high quality, commercial style, well-lit, clean background, showcasing: {}. Image {} of {} variations.",
                description, image_number, total
            )
        } else {
            format!(
                "Professional product photography, high quality, commercial style, well-lit, clean background, showcasing: {}",
                description
            )
        };

        let request_body = json!({
            "model": "dall-e-3",
            "prompt": prompt,
            "n": 1,
            "size": "1024x1024",
            "quality": "standard",
            "response_format": "url"
        });

        let response = self
            .client
            .post(&format!("{}/images/generations", self.base_url))
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&request_body)
            .send()
            .await
            .map_err(|e| {
                error!("[AIImageGeneration] Erreur requête DALL-E: {}", e);
                AppError::Internal(format!("Erreur communication avec DALL-E: {}", e))
            })?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            error!(
                "[AIImageGeneration] Erreur DALL-E API: {} - {}",
                status, error_text
            );
            return Err(AppError::Internal(format!(
                "DALL-E API erreur {}: {}",
                status, error_text
            )));
        }

        let dalle_response: DalleResponse = response.json().await.map_err(|e| {
            error!("[AIImageGeneration] Erreur parsing réponse DALL-E: {}", e);
            AppError::Internal(format!("Erreur parsing réponse DALL-E: {}", e))
        })?;

        if dalle_response.data.is_empty() {
            return Err(AppError::Internal(
                "DALL-E n'a retourné aucune image".to_string(),
            ));
        }

        let image_url = &dalle_response.data[0].url;

        // Télécharger l'image depuis l'URL
        let image_response = self
            .client
            .get(image_url)
            .send()
            .await
            .map_err(|e| {
                error!("[AIImageGeneration] Erreur téléchargement image: {}", e);
                AppError::Internal(format!("Erreur téléchargement image: {}", e))
            })?;

        if !image_response.status().is_success() {
            return Err(AppError::Internal(
                "Impossible de télécharger l'image générée".to_string(),
            ));
        }

        let image_bytes = image_response.bytes().await.map_err(|e| {
            error!("[AIImageGeneration] Erreur lecture bytes image: {}", e);
            AppError::Internal(format!("Erreur lecture image: {}", e))
        })?;

        Ok(image_bytes.to_vec())
    }

    /// Estime le coût de génération d'images
    pub fn estimate_cost(count: usize) -> f64 {
        // DALL-E 3: $0.04 par image (1024x1024, standard quality)
        count as f64 * 0.04
    }
}

/// Génère des images IA et les sauvegarde dans la médiathèque du service
pub async fn generate_and_save_ai_images(
    state: &Arc<AppState>,
    service_id: i32,
    product_index: Option<i32>,
    description: &str,
    count: usize,
) -> AppResult<Vec<i32>> {
    info!(
        "[AIImageGeneration] Génération et sauvegarde de {} image(s) pour service_id={}, product_index={:?}",
        count, service_id, product_index
    );

    let ai_service = AIImageGenerationService::new()?;
    let images = ai_service.generate_product_images(description, count).await?;

    let mut saved_media_ids = Vec::new();

    // Utiliser le service de stockage média
    use crate::services::media_storage_service::MediaStorageService;
    use crate::config::storage::MediaStorageConfig;
    
    let storage_config = MediaStorageConfig::from_env();
    let storage_service = MediaStorageService::new(storage_config);

    // Sauvegarder chaque image dans la médiathèque
    for (index, image_bytes) in images.iter().enumerate() {
        // Déterminer le chemin de sauvegarde
        let filename = format!(
            "ai_generated_{}_{}_{}.jpg",
            service_id,
            product_index.unwrap_or(-1),
            index + 1
        );
        let storage_key = format!("services/{}/{}", service_id, filename);

        // Sauvegarder le fichier
        match storage_service
            .store_bytes(image_bytes, &storage_key, Some("image/jpeg"))
            .await
        {
            Ok(stored_location) => {
                // Insérer dans la table media
                let media_id: i32 = sqlx::query_scalar(
                    r#"
                    INSERT INTO media (service_id, product_index, type, path, media_type, ai_description, uploaded_at)
                    VALUES ($1, $2, 'image', $3, 'image', $4, NOW())
                    RETURNING id
                    "#
                )
                .bind(service_id)
                .bind(product_index)
                .bind(&stored_location.storage_path)
                .bind(Some("Image générée automatiquement par IA".to_string()))
                .fetch_one(&state.pg)
                .await
                .map_err(|e| {
                    error!("[AIImageGeneration] Erreur insertion media: {}", e);
                    AppError::from(e)
                })?;

                saved_media_ids.push(media_id);
                info!(
                    "[AIImageGeneration] ✅ Image {} sauvegardée avec media_id={}, path={}",
                    index + 1, media_id, stored_location.storage_path
                );
            }
            Err(err) => {
                error!(
                    "[AIImageGeneration] ❌ Erreur sauvegarde image {}: {}",
                    index + 1, err
                );
                // Continuer même si une sauvegarde échoue
            }
        }
    }

    if saved_media_ids.is_empty() {
        return Err(AppError::Internal(
            "Aucune image n'a pu être sauvegardée".to_string(),
        ));
    }

    info!(
        "[AIImageGeneration] ✅ {} image(s) sauvegardée(s) avec succès",
        saved_media_ids.len()
    );

    Ok(saved_media_ids)
}

