// ✅ NOUVEAU: Service de filtres IA style artistique (style transfer neuronal)
// Transforme les vidéos en styles artistiques: Van Gogh, Picasso, Monet, etc.

use crate::core::types::{AppError, AppResult};
use log::{debug, error, info, warn};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::PgPool;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::process::Command;

/// Configuration pour les filtres artistiques
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArtisticFilterConfig {
    pub name: String,
    pub style_name: String,
    pub artist: String,
    pub description: String,
    pub intensity_range: (f32, f32), // min, max intensity
    pub processing_time_seconds: u32,
    pub gpu_required: bool,
    pub is_premium: bool,
    pub input_formats: Vec<String>,
    pub output_formats: Vec<String>,
    pub model_path: Option<String>,
    pub parameters: HashMap<String, Value>,
}

/// Résultat de l'application d'un filtre artistique
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FilteredVideoResult {
    pub original_video_url: String,
    pub filtered_video_url: String,
    pub filter_name: String,
    pub processing_time_ms: u64,
    pub thumbnail_url: Option<String>,
    pub metadata: FilterMetadata,
}

/// Métadonnées du filtre appliqué
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FilterMetadata {
    pub filter_id: String,
    pub intensity_used: f32,
    pub parameters_used: HashMap<String, Value>,
    pub model_version: String,
    pub gpu_used: bool,
    pub processing_stats: ProcessingStats,
}

/// Statistiques de processing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessingStats {
    pub frames_processed: u32,
    pub fps: f32,
    pub resolution: (u32, u32),
    pub memory_usage_mb: f32,
    pub gpu_utilization: Option<f32>,
}

/// Service de filtres artistiques IA
pub struct ArtisticFilterService {
    pool: Arc<PgPool>,
    available_filters: HashMap<String, ArtisticFilterConfig>,
}

impl ArtisticFilterService {
    pub fn new(pool: Arc<PgPool>) -> Self {
        let mut service = Self {
            pool,
            available_filters: HashMap::new(),
        };
        
        service.initialize_filters();
        service
    }

    /// Initialise les filtres artistiques disponibles
    fn initialize_filters(&mut self) {
        let filters = vec![
            // Styles Classiques
            ArtisticFilterConfig {
                name: "van_gogh_starry_night".to_string(),
                style_name: "Van Gogh - Nuit Étoilée".to_string(),
                artist: "Vincent van Gogh".to_string(),
                description: "Coups de pinceau expressifs et tourbillonnants comme la célèbre Nuit Étoilée".to_string(),
                intensity_range: (0.3, 1.0),
                processing_time_seconds: 45,
                gpu_required: true,
                is_premium: true,
                input_formats: vec!["mp4".to_string(), "mov".to_string()],
                output_formats: vec!["mp4".to_string()],
                model_path: Some("models/van_gogh_starry_night.onnx".to_string()),
                parameters: {
                    let mut params = HashMap::new();
                    params.insert("brush_size".to_string(), json!(15));
                    params.insert("color_intensity".to_string(), json!(0.8));
                    params.insert("stroke_frequency".to_string(), json!(0.9));
                    params
                },
            },
            
            ArtisticFilterConfig {
                name: "picasso_cubist".to_string(),
                style_name: "Picasso - Cubisme".to_string(),
                artist: "Pablo Picasso".to_string(),
                description: "Géométrie cubiste avec formes décomposées et perspectives multiples".to_string(),
                intensity_range: (0.4, 1.0),
                processing_time_seconds: 38,
                gpu_required: true,
                is_premium: true,
                input_formats: vec!["mp4".to_string(), "mov".to_string()],
                output_formats: vec!["mp4".to_string()],
                model_path: Some("models/picasso_cubist.onnx".to_string()),
                parameters: {
                    let mut params = HashMap::new();
                    params.insert("geometric_complexity".to_string(), json!(0.7));
                    params.insert("angle_displacement".to_string(), json!(45));
                    params.insert("color_palette".to_string(), json!("analytic_cubism"));
                    params
                },
            },

            ArtisticFilterConfig {
                name: "monet_waterlilies".to_string(),
                style_name: "Monet - Nymphéas".to_string(),
                artist: "Claude Monet".to_string(),
                description: "Impressionnisme fluide avec reflets aquatiques et lumière changeante".to_string(),
                intensity_range: (0.2, 0.9),
                processing_time_seconds: 42,
                gpu_required: true,
                is_premium: true,
                input_formats: vec!["mp4".to_string(), "mov".to_string()],
                output_formats: vec!["mp4".to_string()],
                model_path: Some("models/monet_waterlilies.onnx".to_string()),
                parameters: {
                    let mut params = HashMap::new();
                    params.insert("water_reflection".to_string(), json!(0.8));
                    params.insert("light_diffusion".to_string(), json!(0.6));
                    params.insert("color_harmony".to_string(), json!("pastel_impressionism"));
                    params
                },
            },

            // Styles Modernes
            ArtisticFilterConfig {
                name: "banksy_stencil".to_string(),
                style_name: "Banksy - Stencil".to_string(),
                artist: "Banksy".to_string(),
                description: "Art urbain stencil avec contraste noir et blanc et touches de couleur".to_string(),
                intensity_range: (0.5, 1.0),
                processing_time_seconds: 25,
                gpu_required: false,
                is_premium: false,
                input_formats: vec!["mp4".to_string(), "mov".to_string()],
                output_formats: vec!["mp4".to_string()],
                model_path: Some("models/banksy_stencil.onnx".to_string()),
                parameters: {
                    let mut params = HashMap::new();
                    params.insert("stencil_complexity".to_string(), json!(0.7));
                    params.insert("color_accent".to_string(), json!("red"));
                    params.insert("edge_detection".to_string(), json!(0.9));
                    params
                },
            },

            ArtisticFilterConfig {
                name: "warhol_pop_art".to_string(),
                style_name: "Warhol - Pop Art".to_string(),
                artist: "Andy Warhol".to_string(),
                description: "Pop art vibrant avec couleurs saturées et répétition de motifs".to_string(),
                intensity_range: (0.6, 1.0),
                processing_time_seconds: 30,
                gpu_required: false,
                is_premium: false,
                input_formats: vec!["mp4".to_string(), "mov".to_string()],
                output_formats: vec!["mp4".to_string()],
                model_path: Some("models/warhol_pop_art.onnx".to_string()),
                parameters: {
                    let mut params = HashMap::new();
                    params.insert("color_saturation".to_string(), json!(1.5));
                    params.insert("pattern_repetition".to_string(), json!(4));
                    params.insert("contrast_boost".to_string(), json!(1.2));
                    params
                },
            },

            // Styles Abstraits
            ArtisticFilterConfig {
                name: "kandinsky_abstract".to_string(),
                style_name: "Kandinsky - Abstrait".to_string(),
                artist: "Wassily Kandinsky".to_string(),
                description: "Abstraction géométrique avec formes et couleurs expressives".to_string(),
                intensity_range: (0.4, 1.0),
                processing_time_seconds: 35,
                gpu_required: true,
                is_premium: true,
                input_formats: vec!["mp4".to_string(), "mov".to_string()],
                output_formats: vec!["mp4".to_string()],
                model_path: Some("models/kandinsky_abstract.onnx".to_string()),
                parameters: {
                    let mut params = HashMap::new();
                    params.insert("geometric_abstraction".to_string(), json!(0.8));
                    params.insert("color_emotion".to_string(), json!("expressionist"));
                    params.insert("form_dissolution".to_string(), json!(0.6));
                    params
                },
            },

            ArtisticFilterConfig {
                name: "manga_anime".to_string(),
                style_name: "Manga/Anime".to_string(),
                artist: "Style Japonais".to_string(),
                description: "Esthétique manga avec traits nets et couleurs vives".to_string(),
                intensity_range: (0.3, 0.9),
                processing_time_seconds: 28,
                gpu_required: false,
                is_premium: false,
                input_formats: vec!["mp4".to_string(), "mov".to_string()],
                output_formats: vec!["mp4".to_string()],
                model_path: Some("models/manga_anime.onnx".to_string()),
                parameters: {
                    let mut params = HashMap::new();
                    params.insert("line_thickness".to_string(), json!(2.5));
                    params.insert("color_style".to_string(), json!("vibrant_anime"));
                    params.insert("eye_enhancement".to_string(), json!(0.8));
                    params
                },
            },

            // Styles Vintage
            ArtisticFilterConfig {
                name: "vintage_sepia".to_string(),
                style_name: "Vintage Sépia".to_string(),
                artist: "Style Vintage".to_string(),
                description: "Effet sépia vintage avec grain film et textures anciennes".to_string(),
                intensity_range: (0.1, 0.8),
                processing_time_seconds: 15,
                gpu_required: false,
                is_premium: false,
                input_formats: vec!["mp4".to_string(), "mov".to_string()],
                output_formats: vec!["mp4".to_string()],
                model_path: Some("models/vintage_sepia.onnx".to_string()),
                parameters: {
                    let mut params = HashMap::new();
                    params.insert("sepia_intensity".to_string(), json!(0.7));
                    params.insert("film_grain".to_string(), json!(0.4));
                    params.insert("vignette_strength".to_string(), json!(0.3));
                    params
                },
            },

            ArtisticFilterConfig {
                name: "cyberpunk_neon".to_string(),
                style_name: "Cyberpunk Néon".to_string(),
                artist: "Style Futuriste".to_string(),
                description: "Esthétique cyberpunk avec néons vibrants et ambiance futuriste".to_string(),
                intensity_range: (0.5, 1.0),
                processing_time_seconds: 32,
                gpu_required: true,
                is_premium: true,
                input_formats: vec!["mp4".to_string(), "mov".to_string()],
                output_formats: vec!["mp4".to_string()],
                model_path: Some("models/cyberpunk_neon.onnx".to_string()),
                parameters: {
                    let mut params = HashMap::new();
                    params.insert("neon_intensity".to_string(), json!(0.9));
                    params.insert("color_palette".to_string(), json!("cyan_magenta_pink"));
                    params.insert("glow_effect".to_string(), json!(0.8));
                    params
                },
            },
        ];

        for filter in filters {
            self.available_filters.insert(filter.name.clone(), filter);
        }

        info!("[ArtisticFilter] ✅ {} filtres artistiques initialisés", self.available_filters.len());
    }

    /// Liste tous les filtres disponibles
    pub fn list_filters(&self) -> Vec<&ArtisticFilterConfig> {
        self.available_filters.values().collect()
    }

    /// Récupère un filtre par son nom
    pub fn get_filter(&self, filter_name: &str) -> Option<&ArtisticFilterConfig> {
        self.available_filters.get(filter_name)
    }

    /// Applique un filtre artistique à une vidéo
    pub async fn apply_filter(
        &self,
        video_url: &str,
        filter_name: &str,
        intensity: f32,
        custom_parameters: Option<HashMap<String, Value>>,
    ) -> AppResult<FilteredVideoResult> {
        let filter_config = self.get_filter(filter_name)
            .ok_or_else(|| AppError::BadRequest(format!("Filtre '{}' non trouvé", filter_name)))?;

        // Valider l'intensité
        if intensity < filter_config.intensity_range.0 || intensity > filter_config.intensity_range.1 {
            return Err(AppError::BadRequest(format!(
                "Intensité {} hors limites [{}, {}] pour le filtre {}",
                intensity,
                filter_config.intensity_range.0,
                filter_config.intensity_range.1,
                filter_name
            )));
        }

        info!(
            "[ArtisticFilter] 🎨 Application filtre: {} (intensité: {}) sur {}",
            filter_name, intensity, video_url
        );

        let start_time = std::time::Instant::now();

        // Préparer les paramètres
        let mut parameters = filter_config.parameters.clone();
        parameters.insert("intensity".to_string(), json!(intensity));
        
        if let Some(custom_params) = custom_parameters {
            for (key, value) in custom_params {
                parameters.insert(key, value);
            }
        }

        // Générer un nom de fichier unique
        let output_filename = format!(
            "filtered_{}_{}_{:.2}.mp4",
            filter_name,
            chrono::Utc::now().timestamp(),
            intensity
        );

        let output_path = std::path::PathBuf::from(
            std::env::var("UPLOAD_STORAGE_PATH").unwrap_or_else(|_| "uploads".to_string())
        )
        .join("artistic_filters")
        .join(&output_filename);

        // Créer le dossier de sortie
        tokio::fs::create_dir_all(output_path.parent().unwrap()).await
            .map_err(|e| AppError::Internal(format!("Création dossier sortie: {}", e)))?;

        // Appliquer le filtre avec le modèle neuronal
        let processing_result = self.apply_neural_filter(
            video_url,
            &output_path,
            filter_config,
            &parameters,
        ).await?;

        let processing_time_ms = start_time.elapsed().as_millis() as u64;

        // Générer une miniature
        let thumbnail_url = self.generate_thumbnail(&output_path).await?;

        let result = FilteredVideoResult {
            original_video_url: video_url.to_string(),
            filtered_video_url: format!(
                "{}/api/media/files/artistic_filters/{}",
                std::env::var("PUBLIC_BASE_URL").unwrap_or_else(|_| "http://localhost:3000".to_string()),
                output_filename
            ),
            filter_name: filter_name.to_string(),
            processing_time_ms,
            thumbnail_url,
            metadata: FilterMetadata {
                filter_id: filter_name.to_string(),
                intensity_used: intensity,
                parameters_used: parameters,
                model_version: "1.0.0".to_string(),
                gpu_used: filter_config.gpu_required,
                processing_stats: processing_result,
            },
        };

        info!(
            "[ArtisticFilter] ✅ Filtre appliqué en {}ms: {} -> {}",
            processing_time_ms,
            video_url,
            result.filtered_video_url
        );

        Ok(result)
    }

    /// Applique le filtre neuronal avec Python/PyTorch
    async fn apply_neural_filter(
        &self,
        input_video_url: &str,
        output_path: &std::path::Path,
        filter_config: &ArtisticFilterConfig,
        parameters: &HashMap<String, Value>,
    ) -> AppResult<ProcessingStats> {
        let python_script = std::env::var("PYTHON_FILTER_SCRIPT")
            .unwrap_or_else(|_| "scripts/apply_artistic_filter.py".to_string());

        let mut cmd = Command::new("python3");
        cmd.arg(&python_script)
            .arg("--input")
            .arg(input_video_url)
            .arg("--output")
            .arg(output_path.to_string_lossy().to_string())
            .arg("--model")
            .arg(filter_config.model_path.as_deref().unwrap_or("default"))
            .arg("--filter")
            .arg(&filter_config.name)
            .arg("--intensity")
            .arg(parameters.get("intensity").unwrap_or(&json!(0.7)))
            .arg("--gpu")
            .arg(if filter_config.gpu_required { "1" } else { "0" });

        // Ajouter les paramètres supplémentaires
        for (key, value) in parameters {
            if key != "intensity" {
                cmd.arg("--param")
                    .arg(format!("{}={}", key, value));
            }
        }

        debug!("[ArtisticFilter] Exécution: {:?}", cmd);

        let output = cmd
            .output()
            .await
            .map_err(|e| AppError::Internal(format!("Exécution filtre neuronal: {}", e)))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            error!("[ArtisticFilter] Erreur traitement neuronal: {}", stderr);
            return Err(AppError::Internal(format!("Échec filtre neuronal: {}", stderr)));
        }

        // Parser les stats de traitement depuis stdout
        let stdout = String::from_utf8_lossy(&output.stdout);
        let stats = self.parse_processing_stats(&stdout)?;

        Ok(stats)
    }

    /// Parse les statistiques de traitement depuis la sortie Python
    fn parse_processing_stats(&self, output: &str) -> AppResult<ProcessingStats> {
        let mut stats = ProcessingStats {
            frames_processed: 0,
            fps: 30.0,
            resolution: (1920, 1080),
            memory_usage_mb: 0.0,
            gpu_utilization: None,
        };

        for line in output.lines() {
            if line.starts_with("STATS:") {
                let parts: Vec<&str> = line.split(':').collect();
                if parts.len() >= 3 {
                    match parts[1] {
                        "frames" => {
                            if let Ok(frames) = parts[2].parse::<u32>() {
                                stats.frames_processed = frames;
                            }
                        }
                        "fps" => {
                            if let Ok(fps) = parts[2].parse::<f32>() {
                                stats.fps = fps;
                            }
                        }
                        "resolution" => {
                            if let Some(res_str) = parts.get(2) {
                                let dims: Vec<&str> = res_str.split('x').collect();
                                if dims.len() == 2 {
                                    if let (Ok(w), Ok(h)) = (
                                        dims[0].parse::<u32>(),
                                        dims[1].parse::<u32>()
                                    ) {
                                        stats.resolution = (w, h);
                                    }
                                }
                            }
                        }
                        "memory_mb" => {
                            if let Ok(memory) = parts[2].parse::<f32>() {
                                stats.memory_usage_mb = memory;
                            }
                        }
                        "_gpu_util" => {
                            if let Ok(gpu) = parts[2].parse::<f32>() {
                                stats.gpu_utilization = Some(gpu);
                            }
                        }
                        _ => {}
                    }
                }
            }
        }

        Ok(stats)
    }

    /// Génère une miniature pour la vidéo filtrée
    async fn generate_thumbnail(&self, video_path: &std::path::Path) -> AppResult<Option<String>> {
        let thumbnail_path = video_path.with_extension("jpg");
        
        let output = Command::new("ffmpeg")
            .args([
                "-i", video_path.to_string_lossy().as_ref(),
                "-ss", "00:00:01",
                "-vframes", "1",
                "-vf", "scale=320:240",
                "-y",
                thumbnail_path.to_string_lossy().as_ref(),
            ])
            .output()
            .await
            .map_err(|e| AppError::Internal(format!("Génération miniature: {}", e)))?;

        if output.status.success() {
            let thumbnail_url = format!(
                "{}/api/media/files/artistic_filters/{}",
                std::env::var("PUBLIC_BASE_URL").unwrap_or_else(|_| "http://localhost:3000".to_string()),
                thumbnail_path.file_name().unwrap().to_string_lossy()
            );
            Ok(Some(thumbnail_url))
        } else {
            warn!("[ArtisticFilter] Échec génération miniature");
            Ok(None)
        }
    }

    /// Applique plusieurs filtres en chaîne
    pub async fn apply_filter_chain(
        &self,
        video_url: &str,
        filter_chain: Vec<(String, f32)>,
    ) -> AppResult<Vec<FilteredVideoResult>> {
        let mut results = Vec::new();
        let mut current_url = video_url.to_string();

        for (filter_name, intensity) in filter_chain {
            let result = self.apply_filter(&current_url, &filter_name, intensity, None).await?;
            current_url = result.filtered_video_url.clone();
            results.push(result);
        }

        Ok(results)
    }

    /// Crée un filtre personnalisé (pour les utilisateurs avancés)
    pub async fn create_custom_filter(
        &self,
        name: String,
        base_filter: String,
        modifications: HashMap<String, Value>,
    ) -> AppResult<ArtisticFilterConfig> {
        let base_config = self.get_filter(&base_filter)
            .ok_or_else(|| AppError::BadRequest(format!("Filtre de base '{}' non trouvé", base_filter)))?;

        let mut custom_config = base_config.clone();
        custom_config.name = name.clone();
        custom_config.style_name = format!("Custom - {}", base_config.style_name);
        
        // Appliquer les modifications
        for (key, value) in modifications {
            match key.as_str() {
                "description" => {
                    if let Some(desc) = value.as_str() {
                        custom_config.description = desc.to_string();
                    }
                }
                "processing_time_seconds" => {
                    if let Some(time) = value.as_u64() {
                        custom_config.processing_time_seconds = time as u32;
                    }
                }
                "is_premium" => {
                    if let Some(premium) = value.as_bool() {
                        custom_config.is_premium = premium;
                    }
                }
                _ => {
                    custom_config.parameters.insert(key, value);
                }
            }
        }

        // Sauvegarder en base de données
        sqlx::query(
            "INSERT INTO custom_artistic_filters (name, base_filter, modifications, created_at) 
             VALUES ($1, $2, $3, NOW())"
        )
        .bind(&name)
        .bind(&base_filter)
        .bind(serde_json::to_value(&modifications).unwrap_or(Value::Null))
        .execute(self.pool.as_ref())
        .await
        .map_err(|e| AppError::Database(format!("Sauvegarde filtre personnalisé: {}", e)))?;

        self.available_filters.insert(name.clone(), custom_config.clone());

        info!("[ArtisticFilter] ✅ Filtre personnalisé créé: {}", name);
        Ok(custom_config)
    }
}
