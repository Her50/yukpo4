// ✅ NOUVEAU 2025-01-27 : Service optimisé de traitement batch des médias
// Traitement parallèle amélioré, cache, thumbnails, compression adaptative

use crate::core::types::{AppError, AppResult};
#[cfg(feature = "image")]
use crate::services::image_compression_service::{
    compress_image, CompressionConfig, CompressionFormat,
};
use base64::{engine::general_purpose::STANDARD, Engine};
use chrono::Utc;
use futures::stream::{FuturesUnordered, StreamExt};
use md5;
use serde_json::Value;
use sqlx::PgPool;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::sync::Semaphore;
use uuid::Uuid;

/// Configuration du processeur de médias optimisé
#[derive(Debug, Clone)]
pub struct OptimizedMediaProcessorConfig {
    /// Nombre maximum de médias traités en parallèle
    pub max_concurrent: usize,
    /// Taille du batch pour les insertions DB
    pub db_batch_size: usize,
    /// Générer des thumbnails automatiquement
    pub generate_thumbnails: bool,
    /// Qualité de compression adaptative (true) ou fixe (false)
    pub adaptive_compression: bool,
    /// Utiliser le cache des signatures
    pub use_signature_cache: bool,
}

impl Default for OptimizedMediaProcessorConfig {
    fn default() -> Self {
        Self {
            max_concurrent: 10, // Traiter 10 médias en parallèle
            db_batch_size: 20,  // Insérer 20 médias par batch
            generate_thumbnails: true,
            adaptive_compression: true,
            use_signature_cache: true,
        }
    }
}

/// Résultat du traitement d'un média
#[derive(Debug, Clone)]
pub struct ProcessedMedia {
    pub file_path: String,
    pub thumbnail_path: Option<String>,
    pub image_signature: Value,
    pub image_hash: String,
    pub image_metadata: Value,
    pub compressed_size: Option<usize>,
    pub original_size: usize,
    pub compression_ratio: Option<f64>,
}

/// Service de traitement optimisé des médias
pub struct OptimizedMediaProcessor {
    config: OptimizedMediaProcessorConfig,
    pool: Arc<PgPool>,
    storage_root: PathBuf,
    semaphore: Arc<Semaphore>,
    signature_cache: Arc<tokio::sync::RwLock<HashMap<String, (Value, String, Value)>>>, // hash -> (signature, hash, metadata)
}

impl OptimizedMediaProcessor {
    pub fn new(
        pool: impl Into<Arc<PgPool>>,
        storage_root: impl AsRef<Path>,
        config: OptimizedMediaProcessorConfig,
    ) -> Self {
        let pool = pool.into();
        let semaphore = Arc::new(Semaphore::new(config.max_concurrent));
        Self {
            config,
            pool,
            storage_root: storage_root.as_ref().to_path_buf(),
            semaphore,
            signature_cache: Arc::new(tokio::sync::RwLock::new(HashMap::new())),
        }
    }

    /// Traite un batch de médias en parallèle optimisé
    pub async fn process_media_batch(
        &self,
        service_id: i32,
        product_index: Option<usize>,
        media_items: Vec<MediaItem>,
    ) -> AppResult<Vec<ProcessedMedia>> {
        use crate::utils::log::log_info;

        log_info(&format!(
            "[OptimizedMediaProcessor] 🚀 Traitement batch de {} médias (parallélisme: {})",
            media_items.len(),
            self.config.max_concurrent
        ));

        let start_time = std::time::Instant::now();
        let mut futures = FuturesUnordered::new();

        // Traiter tous les médias en parallèle avec contrôle du sémaphore
        for (index, item) in media_items.into_iter().enumerate() {
            let processor = self.clone_for_task();
            let semaphore = self.semaphore.clone();
            let product_id = product_index
                .map(|i| format!("prod_{}", i))
                .unwrap_or_else(|| "service".to_string());

            futures.push(tokio::spawn(async move {
                // Acquérir un permis du sémaphore (limite le parallélisme)
                let _permit = semaphore.acquire().await.ok();

                processor
                    .process_single_media(service_id, &product_id, product_index, index, item)
                    .await
            }));
        }

        // Collecter les résultats au fur et à mesure
        let mut processed: Vec<ProcessedMedia> = Vec::new();
        let mut errors = Vec::new();

        while let Some(result) = futures.next().await {
            match result {
                Ok(Ok(Some(media))) => processed.push(media),
                Ok(Ok(None)) => {
                    // Média ignoré (format non supporté, etc.)
                }
                Ok(Err(e)) => {
                    errors.push(format!("Erreur traitement média: {}", e));
                }
                Err(e) => {
                    errors.push(format!("Erreur task média: {}", e));
                }
            }
        }

        let duration = start_time.elapsed();
        log_info(&format!(
            "[OptimizedMediaProcessor] ✅ Batch traité: {} médias en {:.2}s ({} erreurs)",
            processed.len(),
            duration.as_secs_f64(),
            errors.len()
        ));

        if !errors.is_empty() {
            log::warn!(
                "[OptimizedMediaProcessor] ⚠️ Erreurs lors du traitement: {:?}",
                errors
            );
        }

        Ok(processed)
    }

    /// Traite un seul média avec toutes les optimisations
    async fn process_single_media(
        &self,
        service_id: i32,
        _product_id: &str,
        _product_index: Option<usize>,
        _media_index: usize,
        item: MediaItem,
    ) -> AppResult<Option<ProcessedMedia>> {
        if item.data.is_empty() {
            return Ok(None);
        }

        // 1. Sauvegarder le média sur disque
        let file_path = self
            .save_media_to_disk(service_id, &item.media_type, &item.data)
            .await?;
        let original_size = item.data.len();

        // 2. Décoder si base64 pour obtenir les bytes
        let media_bytes = if item.is_base64 {
            STANDARD
                .decode(&item.data)
                .map_err(|e| AppError::BadRequest(format!("Erreur décodage base64: {}", e)))?
        } else {
            tokio::fs::read(&file_path).await?
        };

        // 3. Compression adaptative si image
        #[cfg(feature = "image")]
        let (compressed_bytes, compression_ratio) = if item.media_type == "image" {
            self.compress_image_adaptive(&media_bytes, &file_path)
                .await?
        } else {
            (media_bytes, None)
        };

        #[cfg(not(feature = "image"))]
        let (compressed_bytes, compression_ratio) = (media_bytes, None);

        // 4. Générer thumbnail si configuré
        let thumbnail_path = if self.config.generate_thumbnails && item.media_type == "image" {
            self.generate_thumbnail(&compressed_bytes, service_id)
                .await
                .ok()
        } else {
            None
        };

        // 5. Générer signature avec cache si configuré
        let (image_signature, image_hash, image_metadata) = if item.media_type == "image" {
            self.generate_signature_cached(&compressed_bytes).await?
        } else {
            (Value::Null, String::new(), Value::Null)
        };

        Ok(Some(ProcessedMedia {
            file_path,
            thumbnail_path,
            image_signature,
            image_hash,
            image_metadata,
            compressed_size: compression_ratio.map(|_| compressed_bytes.len()),
            original_size,
            compression_ratio,
        }))
    }

    /// Compression adaptative : ajuste la qualité selon la taille
    #[cfg(feature = "image")]
    #[allow(dead_code)]
    async fn compress_image_adaptive(
        &self,
        image_bytes: &[u8],
        _file_path: &str,
    ) -> AppResult<(Vec<u8>, Option<f64>)> {
        // Déterminer la qualité selon la taille originale
        let size_mb = image_bytes.len() as f64 / (1024.0 * 1024.0);
        let quality = if self.config.adaptive_compression {
            // Qualité adaptative : plus l'image est grande, plus on compresse
            if size_mb > 5.0 {
                75 // Compression agressive pour grandes images
            } else if size_mb > 2.0 {
                85 // Compression modérée
            } else {
                90 // Compression légère pour petites images
            }
        } else {
            85 // Qualité fixe
        };

        let config = CompressionConfig {
            max_width: 1920,
            max_height: 1080,
            quality,
            format: CompressionFormat::Auto,
        };

        match compress_image(image_bytes, config).await {
            Ok(compressed) => {
                if compressed.len() < image_bytes.len() {
                    let ratio = compressed.len() as f64 / image_bytes.len() as f64;
                    // Sauvegarder la version compressée
                    if let Err(e) = tokio::fs::write(file_path, &compressed).await {
                        log::warn!(
                            "[OptimizedMediaProcessor] Erreur sauvegarde compressée: {}",
                            e
                        );
                        Ok((image_bytes.to_vec(), None))
                    } else {
                        Ok((compressed, Some(ratio)))
                    }
                } else {
                    Ok((image_bytes.to_vec(), None))
                }
            }
            Err(e) => {
                log::warn!(
                    "[OptimizedMediaProcessor] Erreur compression: {}, utilisation originale",
                    e
                );
                Ok((image_bytes.to_vec(), None))
            }
        }
    }

    #[cfg(not(feature = "image"))]
    #[allow(dead_code)]
    async fn compress_image_adaptive(
        &self,
        image_bytes: &[u8],
        _file_path: &str,
    ) -> AppResult<(Vec<u8>, Option<f64>)> {
        Ok((image_bytes.to_vec(), None))
    }

    /// Génère un thumbnail (200x200)
    async fn generate_thumbnail(&self, _image_bytes: &[u8], _max_size: i32) -> AppResult<String> {
        #[cfg(feature = "image")]
        {
            use image::ImageFormat;

            let img = image::load_from_memory(image_bytes)
                .map_err(|e| AppError::Internal(format!("Erreur décodage thumbnail: {}", e)))?;

            let thumbnail = img.resize_exact(200, 200, image::imageops::FilterType::Lanczos3);

            let thumbnail_dir = self
                .storage_root
                .join("services")
                .join(service_id.to_string())
                .join("thumbnails");
            tokio::fs::create_dir_all(&thumbnail_dir).await?;

            let thumbnail_name = format!("thumb_{}.jpg", Uuid::new_v4());
            let thumbnail_path = thumbnail_dir.join(&thumbnail_name);

            let mut output = std::io::Cursor::new(Vec::new());
            thumbnail
                .write_to(&mut output, ImageFormat::Jpeg)
                .map_err(|e| AppError::Internal(format!("Erreur encodage thumbnail: {}", e)))?;

            tokio::fs::write(&thumbnail_path, output.into_inner()).await?;

            let relative_path = Path::new("uploads")
                .join("services")
                .join(service_id.to_string())
                .join("thumbnails")
                .join(&thumbnail_name);
            Ok(relative_path.to_string_lossy().replace('\\', "/"))
        }

        #[cfg(not(feature = "image"))]
        {
            Err(AppError::Internal(
                "Génération thumbnail non disponible sans feature image".to_string(),
            ))
        }
    }

    /// Génère une signature avec cache pour éviter les recalculs
    async fn generate_signature_cached(
        &self,
        image_bytes: &[u8],
    ) -> AppResult<(Value, String, Value)> {
        // Calculer le hash MD5 pour le cache
        let image_hash = format!("{:x}", md5::compute(image_bytes));

        // Vérifier le cache
        if self.config.use_signature_cache {
            let cache = self.signature_cache.read().await;
            if let Some(cached) = cache.get(&image_hash) {
                return Ok(cached.clone());
            }
        }

        // Générer la signature
        #[cfg(feature = "image_search")]
        let (signature, metadata) = {
            match crate::services::image_search_service::ImageSearchService::generate_image_signature(image_bytes) {
                Ok(sig) => {
                    let meta = crate::services::image_search_service::ImageSearchService::extract_image_metadata(image_bytes).unwrap_or_else(|_| {
                        serde_json::json!({
                            "width": 0,
                            "height": 0,
                            "format": "jpeg",
                            "file_size": image_bytes.len(),
                        })
                    });
                    (serde_json::to_value(&sig).unwrap_or_default(), meta)
                }
                Err(e) => {
                    log::warn!("[OptimizedMediaProcessor] Erreur signature: {}", e);
                    (Value::Null, Value::Null)
                }
            }
        };

        #[cfg(not(feature = "image_search"))]
        let (signature, metadata) = (Value::Null, Value::Null);

        let result = (signature, image_hash.clone(), metadata);

        // Mettre en cache
        if self.config.use_signature_cache {
            let mut cache = self.signature_cache.write().await;
            cache.insert(image_hash.clone(), result.clone());
        }

        Ok(result)
    }

    /// Sauvegarde un média sur disque
    async fn save_media_to_disk(
        &self,
        service_id: i32,
        media_type: &str,
        data: &str,
    ) -> AppResult<String> {
        let subdir = match media_type {
            "image" => "images",
            "video" => "videos",
            "audio" => "audio",
            _ => "media",
        };

        let service_dir = self
            .storage_root
            .join("services")
            .join(service_id.to_string())
            .join(subdir);
        tokio::fs::create_dir_all(&service_dir).await?;

        let extension = match media_type {
            "image" => "jpg",
            "video" => "mp4",
            "audio" => "mp3",
            _ => "bin",
        };

        let file_name = format!(
            "{}_{}.{}",
            subdir.trim_end_matches('s'),
            Uuid::new_v4(),
            extension
        );
        let disk_path = service_dir.join(&file_name);

        // Décoder et sauvegarder
        if data.starts_with("data:") {
            // Base64 avec préfixe
            let payload = data.split(',').nth(1).unwrap_or(data);
            let decoded = STANDARD
                .decode(payload)
                .map_err(|e| AppError::BadRequest(format!("Erreur décodage base64: {}", e)))?;
            tokio::fs::write(&disk_path, decoded).await?;
        } else if data.starts_with("http://") || data.starts_with("https://") {
            // URL - télécharger
            let response = reqwest::get(data).await?;
            let bytes = response.bytes().await?;
            tokio::fs::write(&disk_path, bytes).await?;
        } else {
            // Base64 pur
            let decoded = STANDARD
                .decode(data)
                .map_err(|e| AppError::BadRequest(format!("Erreur décodage base64: {}", e)))?;
            tokio::fs::write(&disk_path, decoded).await?;
        }

        let relative_path = Path::new("uploads")
            .join("services")
            .join(service_id.to_string())
            .join(subdir)
            .join(&file_name);
        Ok(relative_path.to_string_lossy().replace('\\', "/"))
    }

    /// Clone pour utilisation dans les tasks async
    fn clone_for_task(&self) -> Self {
        Self {
            config: self.config.clone(),
            pool: self.pool.clone(),
            storage_root: self.storage_root.clone(),
            semaphore: self.semaphore.clone(),
            signature_cache: self.signature_cache.clone(),
        }
    }

    /// Insère un batch de médias dans la DB de manière optimisée
    pub async fn insert_media_batch(
        &self,
        service_id: i32,
        product_index: Option<i32>,
        processed_media: Vec<ProcessedMedia>,
    ) -> AppResult<usize> {
        use crate::utils::log::log_info;

        if processed_media.is_empty() {
            return Ok(0);
        }

        log_info(&format!(
            "[OptimizedMediaProcessor] 💾 Insertion batch de {} médias",
            processed_media.len()
        ));

        let start_time = std::time::Instant::now();

        // Insérer par batch pour optimiser les performances
        let mut inserted = 0;
        for chunk in processed_media.chunks(self.config.db_batch_size) {
            let mut batch_values = Vec::new();
            let mut param_index = 1;

            for (idx, _media) in chunk.iter().enumerate() {
                let _is_main = idx == 0;
                batch_values.push(format!(
                    "(${}, ${}, ${}, ${}, ${}, ${}, ${}, ${}, ${}, ${}, ${})",
                    param_index,      // service_id
                    param_index + 1,  // product_id
                    param_index + 2,  // product_index
                    param_index + 3,  // type
                    param_index + 4,  // path
                    param_index + 5,  // is_main_image
                    param_index + 6,  // display_order
                    param_index + 7,  // uploaded_at
                    param_index + 8,  // image_signature
                    param_index + 9,  // image_hash
                    param_index + 10, // image_metadata
                ));
                param_index += 11;
            }

            // Construire la requête batch
            let query = format!(
                r#"
                INSERT INTO media (
                    service_id, product_id, product_index, type, path,
                    is_main_image, display_order, uploaded_at,
                    image_signature, image_hash, image_metadata
                )
                VALUES {}
                "#,
                batch_values.join(", ")
            );

            // Exécuter avec les paramètres
            let mut query_builder = sqlx::query(&query);
            for (idx, media) in chunk.iter().enumerate() {
                let product_id_opt = product_index.map(|_| "prod");
                query_builder = query_builder
                    .bind(service_id)
                    .bind(product_id_opt)
                    .bind(product_index)
                    .bind("image")
                    .bind(&media.file_path)
                    .bind(idx == 0)
                    .bind(idx as i32)
                    .bind(Utc::now().naive_utc())
                    .bind(&media.image_signature)
                    .bind(&media.image_hash)
                    .bind(&media.image_metadata);
            }

            match query_builder.execute(&*self.pool).await {
                Ok(result) => {
                    inserted += result.rows_affected() as usize;
                }
                Err(e) => {
                    log::error!("[OptimizedMediaProcessor] Erreur insertion batch: {}", e);
                    // Continuer avec les autres batches
                }
            }
        }

        let duration = start_time.elapsed();
        log_info(&format!(
            "[OptimizedMediaProcessor] ✅ {} médias insérés en {:.2}s",
            inserted,
            duration.as_secs_f64()
        ));

        Ok(inserted)
    }
}

/// Item média à traiter
#[derive(Debug, Clone)]
pub struct MediaItem {
    pub data: String,
    pub media_type: String, // "image", "video", "audio"
    pub is_base64: bool,
}

impl MediaItem {
    pub fn new_image(data: String, is_base64: bool) -> Self {
        Self {
            data,
            media_type: "image".to_string(),
            is_base64,
        }
    }

    pub fn new_video(data: String, is_base64: bool) -> Self {
        Self {
            data,
            media_type: "video".to_string(),
            is_base64,
        }
    }
}
