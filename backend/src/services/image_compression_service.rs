// ✅ NOUVEAU 2025-01-27 : Service de compression d'images
// Utilise le crate `image` pour compresser automatiquement les images uploadées

#[cfg(feature = "image")]
use crate::core::types::{AppError, AppResult};
#[cfg(feature = "image")]
use image::ImageOutputFormat;
#[cfg(feature = "image")]
use std::io::Cursor;

/// Configuration de compression
pub struct CompressionConfig {
    pub max_width: u32,
    pub max_height: u32,
    pub quality: u8, // 0-100 pour JPEG, 0-100 pour WebP
    pub format: CompressionFormat,
}

#[derive(Debug, Clone, Copy)]
pub enum CompressionFormat {
    Jpeg,
    WebP,
    Png,
    Auto, // Détecte automatiquement le meilleur format
}

impl Default for CompressionConfig {
    fn default() -> Self {
        Self {
            max_width: 1920,
            max_height: 1080,
            quality: 85,
            format: CompressionFormat::Auto,
        }
    }
}

/// Compresse une image depuis des bytes
#[cfg(feature = "image")]
pub async fn compress_image(image_bytes: &[u8], config: CompressionConfig) -> AppResult<Vec<u8>> {
    // Décoder l'image
    let img = image::load_from_memory(image_bytes)
        .map_err(|e| AppError::BadRequest(format!("Erreur décodage image: {}", e)))?;

    // Redimensionner si nécessaire
    let img = if img.width() > config.max_width || img.height() > config.max_height {
        img.resize(
            config.max_width,
            config.max_height,
            image::imageops::FilterType::Lanczos3,
        )
    } else {
        img
    };

    // Déterminer le format de sortie
    let output_format = match config.format {
        CompressionFormat::Jpeg => ImageOutputFormat::Jpeg(config.quality),
        CompressionFormat::WebP => {
            // WebP nécessite une conversion spéciale
            // Pour l'instant, on utilise JPEG si WebP n'est pas disponible
            ImageOutputFormat::Jpeg(config.quality)
        }
        CompressionFormat::Png => ImageOutputFormat::Png,
        CompressionFormat::Auto => {
            // Détecter le format optimal selon la taille
            let estimated_size = img.width() * img.height() * 3; // Estimation RGB
            if estimated_size > 1_000_000 {
                // Grande image : utiliser JPEG
                ImageOutputFormat::Jpeg(config.quality)
            } else {
                // Petite image : utiliser PNG
                ImageOutputFormat::Png
            }
        }
    };

    // Encoder l'image compressée
    let mut output = Cursor::new(Vec::new());
    img.write_to(&mut output, output_format)
        .map_err(|e| AppError::Internal(format!("Erreur encodage image: {}", e)))?;

    Ok(output.into_inner())
}

/// Compresse une image depuis un chemin de fichier
#[cfg(feature = "image")]
pub async fn compress_image_file(
    input_path: &std::path::Path,
    output_path: &std::path::Path,
    config: CompressionConfig,
) -> AppResult<()> {
    let image_bytes = tokio::fs::read(input_path).await?;
    let compressed = compress_image(&image_bytes, config).await?;
    tokio::fs::write(output_path, compressed).await?;
    Ok(())
}

/// Version sans feature image (no-op)
#[cfg(not(feature = "image"))]
use crate::core::types::AppResult;

#[cfg(not(feature = "image"))]
pub async fn compress_image(_image_bytes: &[u8], _config: CompressionConfig) -> AppResult<Vec<u8>> {
    // Sans le feature image, on retourne les bytes originaux
    Ok(_image_bytes.to_vec())
}

#[cfg(not(feature = "image"))]
pub async fn compress_image_file(
    _input_path: &std::path::Path,
    _output_path: &std::path::Path,
    _config: CompressionConfig,
) -> AppResult<()> {
    // Sans le feature image, on copie simplement le fichier
    tokio::fs::copy(_input_path, _output_path).await?;
    Ok(())
}
