use crate::config::production_config::ProductionConfig;
use crate::core::types::AppResult;
use crate::services::orchestration_ia::convert_all_modals_to_images;
use crate::models::input_model::MultiModalInput;
use futures::stream::FuturesUnordered;
use futures::StreamExt;
#[cfg(feature = "gpu")]
use image::{DynamicImage, ImageBuffer, ImageFormat};
use std::time::Instant;

/// ?? Optimiseur GPU avec fallback CPU automatique
pub struct GPUOptimizer {
    config: ProductionConfig,
}

impl GPUOptimizer {
    pub fn new() -> Self {
        let config = ProductionConfig::new();
        log::info!("[GPUOptimizer] Initialis? avec: {}", config.get_optimization_info());
        
        Self { config }
    }
    
    /// ?? Conversion optimis?e des modaux vers images
    pub async fn convert_all_modals_to_images_optimized(&self, input: &MultiModalInput) -> Vec<String> {
        let start_time = Instant::now();
        
        if self.config.gpu_enabled {
            log::info!("[GPUOptimizer] ?? Pipeline GPU activ?");
            let result = self.convert_all_modals_to_images_gpu_parallel(input).await;
            log::info!("[GPUOptimizer] ? Conversion GPU termin?e en {:?}", start_time.elapsed());
            result
        } else {
            log::info!("[GPUOptimizer] ?? Pipeline CPU activ?");
            let result = convert_all_modals_to_images(input).await;
            log::info!("[GPUOptimizer] ? Conversion CPU termin?e en {:?}", start_time.elapsed());
            result
        }
    }
    
    /// ?? Version GPU parall?le (fallback vers CPU si GPU indisponible)
    async fn convert_all_modals_to_images_gpu_parallel(&self, input: &MultiModalInput) -> Vec<String> {
        let mut all_images = Vec::new();
        
        // Traitement parall?le des diff?rents types de modaux
        let (images, pdfs, excels) = tokio::join!(
            self.process_images_optimized(&input.base64_image),
            self.process_pdfs_optimized(&input.doc_base64),
            self.process_excels_optimized(&input.excel_base64)
        );
        
        // Collecter les r?sultats
        if let Ok(imgs) = images {
            all_images.extend(imgs);
        }
        if let Ok(pdf_imgs) = pdfs {
            all_images.extend(pdf_imgs);
        }
        if let Ok(excel_imgs) = excels {
            all_images.extend(excel_imgs);
        }
        
        log::info!("[GPUOptimizer] Total images g?n?r?es: {}", all_images.len());
        all_images
    }
    
    /// ??? Optimisation des images existantes
    async fn process_images_optimized(&self, images: &Option<Vec<String>>) -> AppResult<Vec<String>> {
        if let Some(imgs) = images {
            log::info!("[GPUOptimizer] Optimisation de {} images", imgs.len());
            
            let mut futures = FuturesUnordered::new();
            
            for (i, img_base64) in imgs.iter().enumerate() {
                let config = self.config.clone();
                let img_data = img_base64.clone();
                
                futures.push(tokio::spawn(async move {
                    let result = Self::optimize_single_image(&img_data, &config).await;
                    (i, result)
                }));
            }
            
            let mut optimized_images = Vec::new();
            while let Some(result) = futures.next().await {
                if let Ok((_, Ok(optimized))) = result {
                    optimized_images.push(optimized);
                }
            }
            
            Ok(optimized_images)
        } else {
            Ok(vec![])
        }
    }
    
    /// ?? Traitement optimis? des PDFs
    async fn process_pdfs_optimized(&self, pdfs: &Option<Vec<String>>) -> AppResult<Vec<String>> {
        if let Some(pdf_list) = pdfs {
            log::info!("[GPUOptimizer] Traitement de {} PDFs", pdf_list.len());
            
            // Fallback vers la m?thode CPU existante pour les PDFs
            let mut all_pdf_images = Vec::new();
            for pdf_base64 in pdf_list {
                if let Ok(pdf_images) = self.convert_pdf_to_images_fallback(pdf_base64).await {
                    all_pdf_images.extend(pdf_images);
                }
            }
            
            Ok(all_pdf_images)
        } else {
            Ok(vec![])
        }
    }
    
    /// ?? Traitement optimis? des Excels
    async fn process_excels_optimized(&self, excels: &Option<Vec<String>>) -> AppResult<Vec<String>> {
        if let Some(excel_list) = excels {
            log::info!("[GPUOptimizer] Traitement de {} fichiers Excel", excel_list.len());
            
            // Fallback vers la m?thode CPU existante pour les Excels
            let mut all_excel_images = Vec::new();
            for excel_base64 in excel_list {
                if let Ok(excel_images) = self.convert_excel_to_images_fallback(excel_base64).await {
                    all_excel_images.extend(excel_images);
                }
            }
            
            Ok(all_excel_images)
        } else {
            Ok(vec![])
        }
    }
    
    /// ??? Optimisation d'une image individuelle
    async fn optimize_single_image(img_base64: &str, _config: &ProductionConfig) -> AppResult<String> {
        #[cfg(feature = "gpu")]
        {
            let img_data = base64::engine::general_purpose::STANDARD.decode(img_base64)
                .map_err(|e| format!("Erreur d?codage base64: {}", e))?;
            let mut image = image::load_from_memory(&img_data)
                .map_err(|e| format!("Erreur chargement image: {}", e))?;
            let (width, height) = image.dimensions();
            if width > _config.image_optimization.max_size || height > _config.image_optimization.max_size {
                image = image.resize(
                    _config.image_optimization.max_size,
                    _config.image_optimization.max_size,
                    image::imageops::FilterType::Lanczos3
                );
            }
            let mut output = Vec::new();
            image.write_with_encoder(
                image::codecs::jpeg::JpegEncoder::new_with_quality(
                    &mut output,
                    (_config.image_optimization.quality * 100.0) as u8
                )
            ).map_err(|e| format!("Erreur compression image: {}", e))?;
            let optimized_base64 = base64::engine::general_purpose::STANDARD.encode(&output);
            Ok(optimized_base64)
        }
        #[cfg(not(feature = "gpu"))]
        {
            Ok(img_base64.to_string())
        }
    }
    
    /// ?? Fallback PDF vers images (m?thode CPU)
    async fn convert_pdf_to_images_fallback(&self, pdf_base64: &str) -> Result<Vec<String>, Box<dyn std::error::Error + Send + Sync>> {
        crate::services::orchestration_ia::convert_pdf_to_images(pdf_base64).await
    }
    
    /// ?? Fallback Excel vers images (m?thode CPU)
    async fn convert_excel_to_images_fallback(&self, excel_base64: &str) -> Result<Vec<String>, Box<dyn std::error::Error + Send + Sync>> {
        crate::services::orchestration_ia::convert_excel_to_images(excel_base64).await
    }
    
    /// ?? Statistiques d'optimisation
    pub fn get_stats(&self) -> String {
        format!(
            "GPU Optimizer - Mode: {}, MaxSize: {}px, Quality: {}, Parallel: {}",
            if self.config.gpu_enabled { "GPU" } else { "CPU" },
            self.config.image_optimization.max_size,
            self.config.image_optimization.quality,
            if self.config.image_optimization.parallel_processing { "YES" } else { "NO" }
        )
    }
}

impl Default for GPUOptimizer {
    fn default() -> Self {
        Self::new()
    }
} 
