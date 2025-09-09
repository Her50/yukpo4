use sqlx::PgPool;
use serde::{Deserialize, Serialize};

#[cfg(feature = "image_search")]
use sqlx::Row;
#[cfg(feature = "image_search")]
use std::collections::HashMap;
#[cfg(feature = "image_search")]
use std::fs;
#[cfg(feature = "image_search")]
use image::GenericImageView;
#[cfg(feature = "image_search")]
use image::imageops::resize;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ImageSignature {
    pub media_id: i32,
    pub service_id: i32,
    pub image_hash: String,
    pub image_signature: Vec<f32>,
    pub image_metadata: ImageMetadata,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ImageMetadata {
    pub width: u32,
    pub height: u32,
    pub format: String,
    pub file_size: usize,
    pub dominant_colors: Vec<[u8; 3]>,
    pub color_histogram: Vec<f32>, // Histogramme de couleurs amélioré
    pub edge_density: f32, // Densité de contours
    pub brightness: f32, // Luminosité moyenne
    pub contrast: f32, // Contraste
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ImageSearchResult {
    pub media_id: i32,
    pub service_id: i32,
    pub path: String,
    pub similarity_score: f32,
    pub image_metadata: ImageMetadata,
    pub service_data: Option<serde_json::Value>, // Données du service associé
}

pub struct ImageSearchService {
    pool: PgPool,
}

impl ImageSearchService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Retourne une référence au pool de connexions
    pub fn pool(&self) -> &PgPool {
        &self.pool
    }

    /// Génère une signature d'image avancée avec plusieurs algorithmes
    #[cfg(feature = "image_search")]
    pub async fn generate_image_signature(&self, image_data: &[u8]) -> Result<Vec<f32>, anyhow::Error> {
        // Charger l'image
        let img = image::load_from_memory(image_data)?;
        
        // Redimensionner à 128x128 pour plus de précision
        let resized = resize(&img.to_rgb8(), 128, 128, image::imageops::FilterType::Lanczos3);
        
        let mut signature = Vec::new();
        
        // 1. Signature par blocs de couleurs (16x16 blocs)
        signature.extend(self.extract_color_block_signature(&resized));
        
        // 2. Histogramme de couleurs global
        signature.extend(self.extract_color_histogram(&resized));
        
        // 3. Signature de contours (edge detection simplifiée)
        signature.extend(self.extract_edge_signature(&resized));
        
        // 4. Signature de texture (patterns locaux)
        signature.extend(self.extract_texture_signature(&resized));
        
        Ok(signature)
    }

    /// Extrait la signature par blocs de couleurs
    #[cfg(feature = "image_search")]
    fn extract_color_block_signature(&self, img: &image::RgbImage) -> Vec<f32> {
        let mut signature = Vec::new();
        
        // Diviser en 16x16 blocs (8x8 pixels chacun)
        for y in 0..16 {
            for x in 0..16 {
                let mut r_sum = 0u32;
                let mut g_sum = 0u32;
                let mut b_sum = 0u32;
                let mut count = 0u32;
                
                // Calculer la moyenne des pixels dans ce bloc
                for py in y * 8..(y + 1) * 8 {
                    for px in x * 8..(x + 1) * 8 {
                        if py < 128 && px < 128 {
                            let pixel = img.get_pixel(px, py);
                            r_sum += pixel[0] as u32;
                            g_sum += pixel[1] as u32;
                            b_sum += pixel[2] as u32;
                            count += 1;
                        }
                    }
                }
                
                if count > 0 {
                    signature.push((r_sum / count) as f32 / 255.0);
                    signature.push((g_sum / count) as f32 / 255.0);
                    signature.push((b_sum / count) as f32 / 255.0);
                } else {
                    signature.push(0.0);
                    signature.push(0.0);
                    signature.push(0.0);
                }
            }
        }
        
        signature
    }

    /// Extrait l'histogramme de couleurs
    #[cfg(feature = "image_search")]
    fn extract_color_histogram(&self, img: &image::RgbImage) -> Vec<f32> {
        let mut histogram = vec![0u32; 256 * 3]; // R, G, B séparés
        
        for pixel in img.pixels() {
            histogram[pixel[0] as usize] += 1;
            histogram[pixel[1] as usize + 256] += 1;
            histogram[pixel[2] as usize + 512] += 1;
        }
        
        // Normaliser
        let total_pixels = img.width() * img.height();
        histogram.into_iter()
            .map(|count| count as f32 / total_pixels as f32)
            .collect()
    }

    /// Extrait la signature de contours (simplifiée)
    #[cfg(feature = "image_search")]
    fn extract_edge_signature(&self, img: &image::RgbImage) -> Vec<f32> {
        let mut edge_signature = Vec::new();
        
        // Détection de contours simple par différence de pixels
        for y in 1..127 {
            for x in 1..127 {
                let current = img.get_pixel(x, y);
                let right = img.get_pixel(x + 1, y);
                let bottom = img.get_pixel(x, y + 1);
                
                // Différence horizontale
                let diff_h = (current[0] as i32 - right[0] as i32).abs() +
                            (current[1] as i32 - right[1] as i32).abs() +
                            (current[2] as i32 - right[2] as i32).abs();
                
                // Différence verticale
                let diff_v = (current[0] as i32 - bottom[0] as i32).abs() +
                            (current[1] as i32 - bottom[1] as i32).abs() +
                            (current[2] as i32 - bottom[2] as i32).abs();
                
                edge_signature.push((diff_h + diff_v) as f32 / (255.0 * 6.0));
            }
        }
        
        // Réduire à 64 valeurs en moyennant
        let mut reduced = Vec::new();
        for chunk in edge_signature.chunks(edge_signature.len() / 64) {
            let avg = chunk.iter().sum::<f32>() / chunk.len() as f32;
            reduced.push(avg);
        }
        
        reduced
    }

    /// Extrait la signature de texture
    #[cfg(feature = "image_search")]
    fn extract_texture_signature(&self, img: &image::RgbImage) -> Vec<f32> {
        let mut texture_signature = Vec::new();
        
        // Analyser les patterns locaux (simplifié)
        for y in 0..16 {
            for x in 0..16 {
                let mut variance = 0.0;
                let mut mean = 0.0;
                let mut count = 0;
                
                // Calculer la variance dans un bloc 8x8
                for py in y * 8..(y + 1) * 8 {
                    for px in x * 8..(x + 1) * 8 {
                        if py < 128 && px < 128 {
                            let pixel = img.get_pixel(px, py);
                            let intensity = (pixel[0] as f32 + pixel[1] as f32 + pixel[2] as f32) / 3.0;
                            mean += intensity;
                            count += 1;
                        }
                    }
                }
                
                if count > 0 {
                    mean /= count as f32;
                    
                    // Calculer la variance
                    for py in y * 8..(y + 1) * 8 {
                        for px in x * 8..(x + 1) * 8 {
                            if py < 128 && px < 128 {
                                let pixel = img.get_pixel(px, py);
                                let intensity = (pixel[0] as f32 + pixel[1] as f32 + pixel[2] as f32) / 3.0;
                                variance += (intensity - mean).powi(2);
                            }
                        }
                    }
                    
                    variance /= count as f32;
                    texture_signature.push(variance / 255.0);
                } else {
                    texture_signature.push(0.0);
                }
            }
        }
        
        texture_signature
    }

    /// Calcule la similarité avancée entre deux signatures
    pub fn calculate_advanced_similarity(&self, sig1: &[f32], sig2: &[f32]) -> f32 {
        if sig1.len() != sig2.len() {
            return 0.0;
        }
        
        // Distance euclidienne pondérée
        let mut weighted_sum = 0.0;
        let mut total_weight = 0.0;
        
        for (i, (a, b)) in sig1.iter().zip(sig2.iter()).enumerate() {
            let weight = self.get_feature_weight(i, sig1.len());
            let diff = (a - b).abs();
            weighted_sum += weight * (1.0 - diff);
            total_weight += weight;
        }
        
        if total_weight > 0.0 {
            weighted_sum / total_weight
        } else {
            0.0
        }
    }

    /// Retourne le poids d'une caractéristique selon sa position
    fn get_feature_weight(&self, index: usize, total_length: usize) -> f32 {
        // Les premières caractéristiques (couleurs) ont plus de poids
        if index < total_length / 4 {
            2.0
        } else if index < total_length / 2 {
            1.5
        } else {
            1.0
        }
    }

    /// Extrait les métadonnées avancées d'une image
    #[cfg(feature = "image_search")]
    pub async fn extract_image_metadata(&self, image_data: &[u8]) -> Result<ImageMetadata, anyhow::Error> {
        let img = image::load_from_memory(image_data)?;
        let dimensions = img.dimensions();
        
        // Calculer les couleurs dominantes
        let rgb_img = img.to_rgb8();
        let mut color_counts: HashMap<[u8; 3], u32> = HashMap::new();
        
        // Échantillonner des pixels pour les couleurs dominantes
        for y in (0..dimensions.1).step_by(10) {
            for x in (0..dimensions.0).step_by(10) {
                let pixel = rgb_img.get_pixel(x, y);
                let color = [pixel[0], pixel[1], pixel[2]];
                *color_counts.entry(color).or_insert(0) += 1;
            }
        }
        
        // Prendre les 8 couleurs les plus fréquentes
        let mut colors: Vec<_> = color_counts.into_iter().collect();
        colors.sort_by(|a, b| b.1.cmp(&a.1));
        let dominant_colors: Vec<[u8; 3]> = colors.into_iter().take(8).map(|(color, _)| color).collect();
        
        // Calculer l'histogramme de couleurs
        let color_histogram = self.extract_color_histogram(&rgb_img);
        
        // Calculer la densité de contours
        let edge_density = self.calculate_edge_density(&rgb_img);
        
        // Calculer la luminosité et le contraste
        let (brightness, contrast) = self.calculate_brightness_contrast(&rgb_img);
        
        Ok(ImageMetadata {
            width: dimensions.0,
            height: dimensions.1,
            format: "jpeg".to_string(), // Simplifié
            file_size: image_data.len(),
            dominant_colors,
            color_histogram,
            edge_density,
            brightness,
            contrast,
        })
    }

    /// Calcule la densité de contours
    #[cfg(feature = "image_search")]
    fn calculate_edge_density(&self, img: &image::RgbImage) -> f32 {
        let mut edge_count = 0;
        let mut total_pixels = 0;
        
        for y in 1..img.height() - 1 {
            for x in 1..img.width() - 1 {
                let current = img.get_pixel(x, y);
                let right = img.get_pixel(x + 1, y);
                let bottom = img.get_pixel(x, y + 1);
                
                let diff_h = (current[0] as i32 - right[0] as i32).abs() +
                            (current[1] as i32 - right[1] as i32).abs() +
                            (current[2] as i32 - right[2] as i32).abs();
                
                let diff_v = (current[0] as i32 - bottom[0] as i32).abs() +
                            (current[1] as i32 - bottom[1] as i32).abs() +
                            (current[2] as i32 - bottom[2] as i32).abs();
                
                if (diff_h + diff_v) > 50 {
                    edge_count += 1;
                }
                total_pixels += 1;
            }
        }
        
        edge_count as f32 / total_pixels as f32
    }

    /// Calcule la luminosité et le contraste
    #[cfg(feature = "image_search")]
    fn calculate_brightness_contrast(&self, img: &image::RgbImage) -> (f32, f32) {
        let mut brightness_sum = 0.0;
        let mut brightness_squared_sum = 0.0;
        let mut pixel_count = 0;
        
        for pixel in img.pixels() {
            let intensity = (pixel[0] as f32 + pixel[1] as f32 + pixel[2] as f32) / 3.0;
            brightness_sum += intensity;
            brightness_squared_sum += intensity * intensity;
            pixel_count += 1;
        }
        
        let brightness = brightness_sum / pixel_count as f32;
        let variance = (brightness_squared_sum / pixel_count as f32) - (brightness * brightness);
        let contrast = variance.sqrt();
        
        (brightness / 255.0, contrast / 255.0)
    }

    /// Met à jour la signature d'une image existante dans la table media
    #[cfg(feature = "image_search")]
    pub async fn update_media_image_signature(&self, media_id: i32) -> Result<(), anyhow::Error> {
        // Récupérer le chemin du fichier
        let media_record = sqlx::query!(
            "SELECT path FROM media WHERE id = $1 AND type = 'image'",
            media_id
        )
        .fetch_one(&self.pool)
        .await?;
        
        // Lire le fichier
        let image_data = fs::read(&media_record.path)?;
        
        // Générer la signature et les métadonnées
        let signature = self.generate_image_signature(&image_data).await?;
        let metadata = self.extract_image_metadata(&image_data).await?;
        let image_hash = format!("{:x}", md5::compute(&image_data));
        
        // Mettre à jour la base de données
        sqlx::query(
            r#"
            UPDATE media 
            SET image_signature = $1,
                image_hash = $2,
                image_metadata = $3
            WHERE id = $4
            "#
        )
        .bind(serde_json::to_string(&signature)?)
        .bind(image_hash)
        .bind(serde_json::to_string(&metadata)?)
        .bind(media_id)
        .execute(&self.pool)
        .await?;
        
        Ok(())
    }

    /// Recherche d'images similaires avec données de service
    #[cfg(feature = "image_search")]
    pub async fn search_similar_images_with_service_data(&self, query_image_data: &[u8], limit: i32) -> Result<Vec<ImageSearchResult>, anyhow::Error> {
        let query_signature = self.generate_image_signature(query_image_data).await?;
        
        // Utiliser la fonction PostgreSQL pour la recherche avec jointure sur les services
        let results = sqlx::query(
            r#"
            SELECT 
                m.media_id,
                m.service_id,
                m.path,
                m.similarity_score,
                m.image_metadata,
                s.data as service_data
            FROM search_similar_images($1, 0.3, $2) m
            LEFT JOIN services s ON m.service_id = s.id
            ORDER BY m.similarity_score DESC
            "#
        )
        .bind(serde_json::to_value(&query_signature)?)
        .bind(limit)
        .fetch_all(&self.pool)
        .await?;
        
        let mut search_results = Vec::new();
        
        for row in results {
            let media_id: i32 = row.try_get("media_id")?;
            let service_id: i32 = row.try_get("service_id")?;
            let path: String = row.try_get("path")?;
            let similarity_score: f64 = row.try_get("similarity_score")?;
            let image_metadata_str: String = row.try_get("image_metadata")?;
            let service_data: Option<serde_json::Value> = row.try_get("service_data").ok();
            
            let metadata: ImageMetadata = serde_json::from_str(&image_metadata_str)?;
            search_results.push(ImageSearchResult {
                media_id,
                service_id,
                path,
                similarity_score: similarity_score as f32,
                image_metadata: metadata,
                service_data,
            });
        }
        
        Ok(search_results)
    }

    /// Recherche par métadonnées avec données de service et filtrage GPS
    #[cfg(feature = "image_search")]
    pub async fn search_by_metadata_with_service_data(&self, metadata: &ImageMetadata, limit: i32) -> Result<Vec<ImageSearchResult>, anyhow::Error> {
        let results = sqlx::query(
            r#"
            SELECT 
                m.media_id,
                m.service_id,
                m.path,
                m.similarity_score,
                m.image_metadata,
                s.data as service_data
            FROM search_images_by_metadata($1, $2) m
            LEFT JOIN services s ON m.service_id = s.id
            ORDER BY m.similarity_score DESC
            "#
        )
        .bind(serde_json::to_string(&metadata)?)
        .bind(limit)
        .fetch_all(&self.pool)
        .await?;
        
        let mut search_results = Vec::new();
        
        for row in results {
            let media_id: i32 = row.try_get("media_id")?;
            let service_id: i32 = row.try_get("service_id")?;
            let path: String = row.try_get("path")?;
            let similarity_score: f64 = row.try_get("similarity_score")?;
            let image_metadata_str: String = row.try_get("image_metadata")?;
            let service_data: Option<serde_json::Value> = row.try_get("service_data").ok();
            
            let metadata: ImageMetadata = serde_json::from_str(&image_metadata_str)?;
            search_results.push(ImageSearchResult {
                media_id,
                service_id,
                path,
                similarity_score: similarity_score as f32,
                image_metadata: metadata,
                service_data,
            });
        }
        
        Ok(search_results)
    }

    /// Recherche par métadonnées avec données de service ET filtrage GPS
    #[cfg(feature = "image_search")]
    pub async fn search_by_metadata_with_gps_filter(
        &self, 
        metadata: &ImageMetadata, 
        user_gps_zone: Option<&str>,
        search_radius_km: Option<i32>,
        limit: i32
    ) -> Result<Vec<ImageSearchResult>, anyhow::Error> {
        // Utiliser la nouvelle fonction PostgreSQL avec filtrage GPS
        let results = sqlx::query(
            r#"
            SELECT 
                m.media_id,
                m.service_id,
                m.path,
                m.similarity_score,
                m.image_metadata,
                s.data as service_data,
                m.gps_distance_km,
                m.gps_coords
            FROM search_images_by_metadata_with_gps($1, $2, $3, $4) m
            LEFT JOIN services s ON m.service_id = s.id
            ORDER BY 
                CASE 
                    WHEN m.gps_distance_km IS NOT NULL THEN 
                        (100 - m.gps_distance_km) / 100  -- Priorité à la proximité GPS
                    ELSE 0 
                END DESC,
                m.similarity_score DESC
            "#
        )
        .bind(serde_json::to_string(&metadata)?)
        .bind(user_gps_zone)
        .bind(search_radius_km.unwrap_or(50))
        .bind(limit)
        .fetch_all(&self.pool)
        .await?;
        
        let mut search_results = Vec::new();
        
        for row in results {
            let media_id: i32 = row.try_get("media_id")?;
            let service_id: i32 = row.try_get("service_id")?;
            let path: String = row.try_get("path")?;
            let similarity_score: f64 = row.try_get("similarity_score")?;
            let image_metadata_str: String = row.try_get("image_metadata")?;
            let service_data: Option<serde_json::Value> = row.try_get("service_data").ok();
            let gps_distance_km: Option<f64> = row.try_get("gps_distance_km").ok();
            let gps_coords: Option<String> = row.try_get("gps_coords").ok();
            
            let metadata: ImageMetadata = serde_json::from_str(&image_metadata_str)?;
            
            // Créer un résultat enrichi avec les informations GPS
            let mut search_result = ImageSearchResult {
                media_id,
                service_id,
                path,
                similarity_score: similarity_score as f32,
                image_metadata: metadata,
                service_data,
            };
            
            // Ajouter les informations GPS si disponibles
            if let Some(distance) = gps_distance_km {
                // Log pour debug
                log::info!("[ImageSearch] Service {} à {:.2} km du point GPS utilisateur", service_id, distance);
            }
            
            search_results.push(search_result);
        }
        
        Ok(search_results)
    }

    /// Traite tous les médias d'images existants pour générer leurs signatures
    #[cfg(feature = "image_search")]
    pub async fn process_existing_images(&self) -> Result<i32, anyhow::Error> {
        // Récupérer tous les médias d'images sans signature
        let media_records = sqlx::query!(
            "SELECT id FROM media WHERE type = 'image' AND image_signature IS NULL"
        )
        .fetch_all(&self.pool)
        .await?;
        
        let mut processed_count = 0;
        
        for record in media_records {
            match self.update_media_image_signature(record.id).await {
                Ok(_) => {
                    processed_count += 1;
                    log::info!("Signature générée pour media_id: {}", record.id);
                }
                Err(e) => {
                    log::error!("Erreur lors du traitement de media_id {}: {}", record.id, e);
                }
            }
        }
        
        Ok(processed_count)
    }
} 