// ✅ NOUVEAU Phase 3.1: Service de génération vidéo complète depuis texte

use crate::models::generative_video_model::{
    GenerateVideoRequest, GeneratedClip, GenerativeJob, GenerativeProvider, Storyboard,
    StoryboardScene,
};
use crate::services::app_ia::{extract_json_block, AppIA};
use chrono::Utc;
use log::{error, info, warn};
use serde_json::json;
use sqlx::PgPool;
use std::sync::Arc;
use uuid::Uuid;

pub struct GenerativeVideoService {
    pool: Arc<PgPool>,
    app_ia: Arc<AppIA>,
    http: reqwest::Client,
}

impl GenerativeVideoService {
    pub fn new(pool: Arc<PgPool>, app_ia: Arc<AppIA>) -> Self {
        // ✅ NOUVEAU: Timeout configurable pour génération vidéo (600s = 10 minutes par défaut)
        let video_timeout = std::env::var("VIDEO_GENERATION_TIMEOUT_SECONDS")
            .ok()
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(600); // 10 minutes par défaut pour génération vidéo complète

        let http = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(video_timeout))
            .build()
            .expect("création client HTTP génératif");

        info!(
            "[GenerativeVideo] Timeout configuré: {} secondes",
            video_timeout
        );

        Self { pool, app_ia, http }
    }

    /// Démarre une génération vidéo complète depuis texte
    pub async fn generate_video(
        &self,
        user_id: i64,
        request: GenerateVideoRequest,
    ) -> Result<String, String> {
        let job_id = Uuid::new_v4().to_string();

        info!(
            "[GenerativeVideo] Nouveau job de génération: {} pour user {}",
            job_id, user_id
        );

        // Démarrer le traitement asynchrone
        let pool_clone = Arc::clone(&self.pool);
        let app_ia_clone = Arc::clone(&self.app_ia);
        let http_clone = self.http.clone();
        let job_id_clone = job_id.clone();

        tokio::spawn(async move {
            if let Err(e) = Self::process_generation(
                pool_clone,
                app_ia_clone,
                http_clone,
                job_id_clone,
                user_id,
                request,
            )
            .await
            {
                error!("[GenerativeVideo] Erreur génération: {}", e);
            }
        });

        Ok(job_id)
    }

    /// Génère un storyboard depuis la description
    /// Cette fonction peut être utilisée pour générer des storyboards de manière asynchrone
    pub async fn generate_storyboard(
        app_ia: &Arc<AppIA>,
        request: &GenerateVideoRequest,
    ) -> Result<Storyboard, String> {
        let duration = request.duration_seconds.unwrap_or(30.0);
        let num_scenes = (duration / 5.0).ceil() as u32; // ~5 secondes par scène

        let prompt = format!(
            r#"Tu es un expert en création de storyboards vidéo pour la plateforme Yukpomnang.

DESCRIPTION VIDÉO:
{}

PARAMÈTRES:
- Durée totale: {} secondes
- Style: {}
- Mood: {}
- Ratio d'aspect: {}
- Nombre de scènes: {}

TÂCHE:
Crée un storyboard détaillé divisé en {} scènes. Pour chaque scène, fournis:
1. Numéro de scène
2. Description visuelle détaillée
3. Durée en secondes
4. Style visuel
5. Mouvement de caméra
6. Ambiance/mood
7. Prompt optimisé pour génération IA

FORMAT DE RÉPONSE (JSON STRICT - PAS DE MARKDOWN):
{{
    "total_duration": {},
    "scenes": [
        {{
            "scene_number": 1,
            "description": "Description visuelle détaillée de la scène",
            "duration_seconds": 5.0,
            "visual_style": "Style visuel (ex: cinématique, dynamique, minimaliste)",
            "camera_movement": "Mouvement caméra (ex: fixe, travelling, zoom)",
            "mood": "Ambiance (ex: énergique, calme, dramatique)",
            "prompt": "Prompt optimisé pour génération IA vidéo (Runway/Pika/Sora)"
        }}
    ]
}}

CONTRAINTES:
- total_duration: nombre décimal positif (ex: 30.0)
- scenes: tableau de {} objets minimum
- scene_number: entier positif (1, 2, 3...)
- duration_seconds: nombre décimal entre 3.0 et 10.0
- description: string détaillée (50-200 caractères)
- visual_style: string (20-50 caractères)
- camera_movement: string (10-40 caractères)
- mood: string (10-30 caractères)
- prompt: string optimisé pour génération IA (30-100 caractères)

IMPORTANT:
- Retourne UNIQUEMENT du JSON valide
- Pas de texte avant ou après le JSON
- Pas de markdown (```json```)
- Pas de commentaires dans le JSON
- Tous les nombres doivent être des nombres (pas de strings)
- La somme des duration_seconds doit être proche de total_duration"#,
            request.description,
            duration,
            request.style.as_deref().unwrap_or("cinématique"),
            request.mood.as_deref().unwrap_or("dynamique"),
            request.aspect_ratio.as_deref().unwrap_or("16:9"),
            num_scenes,
            num_scenes,
            duration,
            num_scenes
        );

        // Utiliser AppIA pour générer le storyboard
        let (model_name, response, _tokens) = app_ia
            .predict(&prompt)
            .await
            .map_err(|e| format!("Erreur génération storyboard: {}", e))?;

        // Extraire le JSON de la réponse
        let json_block = extract_json_block(&response)
            .ok_or_else(|| format!("JSON manquant dans réponse IA (modèle: {})", model_name))?;

        // Parser le JSON
        let storyboard: Storyboard = serde_json::from_str(&json_block)
            .map_err(|e| format!("Erreur parsing storyboard JSON: {}", e))?;

        Ok(storyboard)
    }

    /// Génère un clip vidéo pour une scène
    /// Cette fonction peut être utilisée pour générer des clips individuels
    pub async fn generate_clip(
        http: &reqwest::Client,
        scene: &StoryboardScene,
        provider: &GenerativeProvider,
        aspect_ratio: &str,
    ) -> Result<Option<GeneratedClip>, String> {
        // Obtenir les credentials du provider
        let (endpoint, api_key) = Self::get_provider_credentials(provider)?;

        let payload = json!({
            "prompt": scene.prompt,
            "duration": scene.duration_seconds.min(10.0), // Limite à 10s par clip
            "ratio": aspect_ratio,
            "style": scene.visual_style,
            "mood": scene.mood,
        });

        let response = http
            .post(&endpoint)
            .header("Authorization", format!("Bearer {}", api_key))
            .header("Content-Type", "application/json")
            .json(&payload)
            .send()
            .await
            .map_err(|e| format!("Erreur appel API {}: {}", provider_name(provider), e))?;

        if !response.status().is_success() {
            warn!(
                "[GenerativeVideo] Statut HTTP {} pour génération clip scène {}",
                response.status(),
                scene.scene_number
            );
            return Ok(None);
        }

        let body = response
            .json::<serde_json::Value>()
            .await
            .map_err(|e| format!("Erreur parsing réponse {}: {}", provider_name(provider), e))?;

        // Extraire l'URL de la vidéo générée (varie selon le provider)
        let video_url = body
            .get("video_url")
            .or_else(|| body.get("url"))
            .or_else(|| body.get("output_url"))
            .and_then(|v| v.as_str())
            .ok_or_else(|| {
                format!(
                    "URL vidéo non trouvée dans réponse {}",
                    provider_name(provider)
                )
            })?
            .to_string();

        Ok(Some(GeneratedClip {
            scene_number: scene.scene_number,
            provider: provider.clone(),
            video_url,
            local_path: None,
            duration_seconds: scene.duration_seconds,
            thumbnail_url: None,
            generated_at: Utc::now(),
        }))
    }

    /// Obtient les credentials d'un provider depuis les variables d'environnement
    /// Récupère les credentials (endpoint et API key) pour un provider donné
    pub fn get_provider_credentials(provider: &GenerativeProvider) -> Result<(String, String), String> {
        match provider {
            GenerativeProvider::Runway => {
                let endpoint = std::env::var("RUNWAY_API_URL")
                    .ok()
                    .ok_or_else(|| "RUNWAY_API_URL non défini".to_string())?;
                let api_key = std::env::var("RUNWAY_API_KEY")
                    .ok()
                    .ok_or_else(|| "RUNWAY_API_KEY non défini".to_string())?;
                Ok((endpoint, api_key))
            }
            GenerativeProvider::Pika => {
                let endpoint = std::env::var("PIKA_API_URL")
                    .ok()
                    .ok_or_else(|| "PIKA_API_URL non défini".to_string())?;
                let api_key = std::env::var("PIKA_API_KEY")
                    .ok()
                    .ok_or_else(|| "PIKA_API_KEY non défini".to_string())?;
                Ok((endpoint, api_key))
            }
            GenerativeProvider::Sora => {
                let endpoint = std::env::var("SORA_API_URL")
                    .ok()
                    .ok_or_else(|| "SORA_API_URL non défini".to_string())?;
                let api_key = std::env::var("SORA_API_KEY")
                    .ok()
                    .ok_or_else(|| "SORA_API_KEY non défini".to_string())?;
                Ok((endpoint, api_key))
            }
            GenerativeProvider::StableVideoDiffusion => {
                Err("Stable Video Diffusion non encore implémenté".to_string())
            }
        }
    }

    /// Traite une génération vidéo de manière asynchrone
    async fn process_generation(
        _pool: Arc<PgPool>,
        _app_ia: Arc<AppIA>,
        _http: reqwest::Client,
        job_id: String,
        _user_id: i64,
        _request: GenerateVideoRequest,
    ) -> Result<(), String> {
        info!("[GenerativeVideo] Début génération: {}", job_id);

        // TODO: Implémenter le pipeline complet:
        // 1. Générer storyboard avec IA
        // 2. Générer clips pour chaque scène
        // 3. Télécharger les clips
        // 4. Assembler dans une timeline
        // 5. Upload vers S3
        // 6. Mettre à jour le job dans la DB

        // Pour l'instant, on simule
        warn!(
            "[GenerativeVideo] Génération non encore implémentée complètement pour job: {}",
            job_id
        );

        Ok(())
    }

    /// Récupère le statut d'un job de génération
    pub async fn get_job_status(
        &self,
        job_id: &str,
        _user_id: i64,
    ) -> Result<GenerativeJob, String> {
        // TODO: Récupérer depuis la DB
        Err(format!("Job {} non trouvé", job_id))
    }
}

/// Retourne le nom lisible d'un provider de génération vidéo
pub fn provider_name(provider: &GenerativeProvider) -> &str {
    match provider {
        GenerativeProvider::Runway => "Runway",
        GenerativeProvider::Pika => "Pika",
        GenerativeProvider::Sora => "Sora",
        GenerativeProvider::StableVideoDiffusion => "StableVideoDiffusion",
    }
}
