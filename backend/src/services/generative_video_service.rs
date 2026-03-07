// ✅ NOUVEAU Phase 3.1: Service de génération vidéo complète depuis texte

use crate::models::generative_video_model::{
    GenerateVideoRequest, GeneratedClip, GenerativeJob, GenerativeJobProgress, GenerativeJobStatus,
    GenerativeProvider, Storyboard, StoryboardScene,
};
use crate::services::app_ia::{extract_json_block, AppIA};
use chrono::{DateTime, Utc};
use log::{error, info, warn};
use serde_json::json;
use sqlx::{FromRow, PgPool};
use std::sync::Arc;
use uuid::Uuid;

#[derive(Debug, FromRow)]
struct GenerativeJobRow {
    job_id: String,
    user_id: i64,
    status: String,
    request_payload: Option<serde_json::Value>,
    result_payload: Option<serde_json::Value>,
    error_message: Option<String>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

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
        user_id: i32,
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

        let _ = tokio::spawn(async move {
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
            r#"Tu es un expert en création de storyboards vidéo pour la plateforme Yukpo.

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
    pub fn get_provider_credentials(
        provider: &GenerativeProvider,
    ) -> Result<(String, String), String> {
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
        pool: Arc<PgPool>,
        app_ia: Arc<AppIA>,
        http: reqwest::Client,
        job_id: String,
        user_id: i32,
        request: GenerateVideoRequest,
    ) -> Result<(), String> {
        info!(
            "[GenerativeVideo] Début pipeline génération: {} pour user {}",
            job_id, user_id
        );

        // Créer le job en DB s'il n'existe pas, ou mettre à jour le statut
        let _ = sqlx::query(
            r#"INSERT INTO generative_video_jobs (job_id, user_id, status, request_payload, created_at, updated_at)
            VALUES ($1, $2, 'processing', $3, NOW(), NOW())
            ON CONFLICT (job_id) DO UPDATE SET status = 'processing', updated_at = NOW()"#
        )
        .bind(&job_id)
        .bind(user_id)
        .bind(serde_json::to_value(&request).unwrap_or_default())
        .execute(pool.as_ref())
        .await;

        // ── ÉTAPE 1: Générer le storyboard avec l'IA ──
        info!(
            "[GenerativeVideo] [{}] Étape 1/5: Génération storyboard",
            job_id
        );
        let storyboard = match Self::generate_storyboard(&app_ia, &request).await {
            Ok(sb) => {
                info!(
                    "[GenerativeVideo] [{}] ✅ Storyboard généré: {} scènes, {}s total",
                    job_id,
                    sb.scenes.len(),
                    sb.total_duration
                );
                sb
            }
            Err(e) => {
                error!("[GenerativeVideo] [{}] ❌ Échec storyboard: {}", job_id, e);
                let _ = sqlx::query(
                    "UPDATE generative_video_jobs SET status = 'failed', error_message = $2, updated_at = NOW() WHERE job_id = $1"
                )
                .bind(&job_id)
                .bind(&format!("Échec storyboard: {}", e))
                .execute(pool.as_ref())
                .await;
                return Err(e);
            }
        };

        // ── ÉTAPE 2: Déterminer les providers et générer les clips avec fallback ──
        info!(
            "[GenerativeVideo] [{}] Étape 2/5: Génération clips vidéo IA",
            job_id
        );
        let available_providers = Self::get_available_providers();

        if available_providers.is_empty() {
            let msg = "Aucun provider IA vidéo configuré. Vérifiez les clés API (RUNWAY_API_KEY, SORA_API_KEY, PIKA_API_KEY).";
            error!("[GenerativeVideo] [{}] ❌ {}", job_id, msg);
            let _ = sqlx::query(
                "UPDATE generative_video_jobs SET status = 'failed', error_message = $2, updated_at = NOW() WHERE job_id = $1"
            )
            .bind(&job_id)
            .bind(msg)
            .execute(pool.as_ref())
            .await;
            return Err(msg.to_string());
        }

        let aspect_ratio = request.aspect_ratio.as_deref().unwrap_or("9:16");
        let mut generated_clips: Vec<GeneratedClip> = Vec::new();

        for scene in &storyboard.scenes {
            info!(
                "[GenerativeVideo] [{}] Génération clip scène {}/{}",
                job_id,
                scene.scene_number,
                storyboard.scenes.len()
            );

            // Tenter avec chaque provider disponible jusqu'à succès
            let mut clip_generated = false;
            for provider in &available_providers {
                match Self::generate_clip(&http, scene, provider, aspect_ratio).await {
                    Ok(Some(clip)) => {
                        info!(
                            "[GenerativeVideo] [{}] ✅ Clip scène {} généré avec {}: {}",
                            job_id,
                            scene.scene_number,
                            provider_name(provider),
                            clip.video_url
                        );
                        generated_clips.push(clip);
                        clip_generated = true;
                        break; // Succès, pas besoin d'essayer les autres providers
                    }
                    Ok(None) => {
                        warn!(
                            "[GenerativeVideo] [{}] ⚠️ Provider {} indisponible pour scène {}, tentative suivante...",
                            job_id, provider_name(provider), scene.scene_number
                        );
                    }
                    Err(e) => {
                        warn!(
                            "[GenerativeVideo] [{}] ⚠️ Erreur {} pour scène {}: {}, tentative suivante...",
                            job_id, provider_name(provider), scene.scene_number, e
                        );
                    }
                }
            }

            if !clip_generated {
                warn!(
                    "[GenerativeVideo] [{}] ❌ Échec génération scène {} avec tous les providers disponibles",
                    job_id, scene.scene_number
                );
            }
        }

        info!(
            "[GenerativeVideo] [{}] Clips générés: {}/{}",
            job_id,
            generated_clips.len(),
            storyboard.scenes.len()
        );

        if generated_clips.is_empty() {
            let msg = "Aucun clip vidéo n'a pu être généré. Vérifiez les clés API des providers (RUNWAY_API_KEY, SORA_API_KEY, PIKA_API_KEY).";
            error!("[GenerativeVideo] [{}] ❌ {}", job_id, msg);
            let _ = sqlx::query(
                "UPDATE generative_video_jobs SET status = 'failed', error_message = $2, updated_at = NOW() WHERE job_id = $1"
            )
            .bind(&job_id)
            .bind(msg)
            .execute(pool.as_ref())
            .await;
            return Err(msg.to_string());
        }

        // ── ÉTAPE 3: Télécharger les clips générés ──
        info!(
            "[GenerativeVideo] [{}] Étape 3/5: Téléchargement clips",
            job_id
        );
        let session_dir = std::path::PathBuf::from(
            std::env::var("UPLOAD_STORAGE_PATH").unwrap_or_else(|_| "uploads".to_string()),
        )
        .join("generative_videos")
        .join(&job_id);
        tokio::fs::create_dir_all(&session_dir)
            .await
            .map_err(|e| format!("Impossible de créer le dossier session: {}", e))?;

        let mut local_clip_paths: Vec<String> = Vec::new();
        for clip in &generated_clips {
            let filename = format!("scene_{}.mp4", clip.scene_number);
            let local_path = session_dir.join(&filename);
            match http.get(&clip.video_url).send().await {
                Ok(response) if response.status().is_success() => match response.bytes().await {
                    Ok(bytes) => {
                        if let Err(e) = tokio::fs::write(&local_path, &bytes).await {
                            warn!(
                                "[GenerativeVideo] [{}] ⚠️ Écriture clip {} échouée: {}",
                                job_id, filename, e
                            );
                            continue;
                        }
                        info!(
                            "[GenerativeVideo] [{}] ✅ Clip téléchargé: {} ({} bytes)",
                            job_id,
                            filename,
                            bytes.len()
                        );
                        local_clip_paths.push(local_path.to_string_lossy().to_string());
                    }
                    Err(e) => warn!(
                        "[GenerativeVideo] [{}] ⚠️ Lecture bytes clip {} échouée: {}",
                        job_id, filename, e
                    ),
                },
                Ok(response) => {
                    warn!(
                        "[GenerativeVideo] [{}] ⚠️ Téléchargement clip {} HTTP {}",
                        job_id,
                        filename,
                        response.status()
                    );
                }
                Err(e) => {
                    warn!(
                        "[GenerativeVideo] [{}] ⚠️ Téléchargement clip {} échoué: {}",
                        job_id, filename, e
                    );
                }
            }
        }

        if local_clip_paths.is_empty() {
            let msg = "Aucun clip n'a pu être téléchargé depuis les providers IA.";
            error!("[GenerativeVideo] [{}] ❌ {}", job_id, msg);
            let _ = sqlx::query(
                "UPDATE generative_video_jobs SET status = 'failed', error_message = $2, updated_at = NOW() WHERE job_id = $1"
            )
            .bind(&job_id)
            .bind(msg)
            .execute(pool.as_ref())
            .await;
            return Err(msg.to_string());
        }

        // ── ÉTAPE 4: Assembler les clips avec FFmpeg ──
        info!(
            "[GenerativeVideo] [{}] Étape 4/5: Assemblage FFmpeg",
            job_id
        );
        let concat_list_path = session_dir.join("concat_list.txt");
        let concat_content: String = local_clip_paths
            .iter()
            .map(|p| format!("file '{}'", p.replace('\\', "/")))
            .collect::<Vec<_>>()
            .join("\n");
        tokio::fs::write(&concat_list_path, &concat_content)
            .await
            .map_err(|e| format!("Écriture concat_list.txt: {}", e))?;

        let output_filename = format!("generative_{}.mp4", job_id);
        let output_path = session_dir.join(&output_filename);
        let ffmpeg_output = tokio::process::Command::new("ffmpeg")
            .current_dir(&session_dir)
            .args([
                "-y",
                "-f",
                "concat",
                "-safe",
                "0",
                "-i",
                &concat_list_path.to_string_lossy(),
                "-c:v",
                "libx264",
                "-preset",
                "fast",
                "-crf",
                "23",
                "-pix_fmt",
                "yuv420p",
                "-movflags",
                "+faststart",
                &output_path.to_string_lossy(),
            ])
            .output()
            .await
            .map_err(|e| format!("FFmpeg concat échoué: {}", e))?;

        if !ffmpeg_output.status.success() {
            let stderr = String::from_utf8_lossy(&ffmpeg_output.stderr);
            error!(
                "[GenerativeVideo] [{}] ❌ FFmpeg concat stderr: {}",
                job_id, stderr
            );
            let _ = sqlx::query(
                "UPDATE generative_video_jobs SET status = 'failed', error_message = $2, updated_at = NOW() WHERE job_id = $1"
            )
            .bind(&job_id)
            .bind(&format!("Assemblage vidéo échoué: {}", stderr.chars().take(500).collect::<String>()))
            .execute(pool.as_ref())
            .await;
            return Err(format!("FFmpeg concat échoué: {}", stderr));
        }

        info!(
            "[GenerativeVideo] [{}] ✅ Vidéo assemblée: {:?}",
            job_id, output_path
        );

        // ── ÉTAPE 5: Stocker le résultat et mettre à jour le job ──
        info!("[GenerativeVideo] [{}] Étape 5/5: Finalisation", job_id);
        let relative_path = format!("generative_videos/{}/{}", job_id, output_filename);
        let api_base_url = std::env::var("PUBLIC_BASE_URL")
            .or_else(|_| std::env::var("UPLOAD_BASE_URL"))
            .unwrap_or_else(|_| "http://localhost:3000".to_string());
        let video_url = format!(
            "{}/api/media/files/{}",
            api_base_url.trim_end_matches('/'),
            relative_path
        );

        let result_payload = json!({
            "video_url": video_url,
            "clips_count": generated_clips.len(),
            "total_duration": storyboard.total_duration,
            "provider": available_providers.first().map(provider_name).unwrap_or("unknown"),
            "storyboard_scenes": storyboard.scenes.len(),
        });

        let _ = sqlx::query(
            "UPDATE generative_video_jobs SET status = 'completed', result_payload = $2, updated_at = NOW() WHERE job_id = $1"
        )
        .bind(&job_id)
        .bind(&result_payload)
        .execute(pool.as_ref())
        .await;

        info!(
            "[GenerativeVideo] [{}] ✅ Génération terminée: {} clips, provider {}, URL: {}",
            job_id,
            generated_clips.len(),
            available_providers.first().map(provider_name).unwrap_or("unknown"),
            video_url
        );

        Ok(())
    }

    /// Retourne la liste des providers disponibles par ordre de priorité
    fn get_available_providers() -> Vec<GenerativeProvider> {
        let mut providers = Vec::new();

        if std::env::var("RUNWAY_API_KEY").is_ok() && std::env::var("RUNWAY_API_URL").is_ok() {
            providers.push(GenerativeProvider::Runway);
        }
        if std::env::var("SORA_API_KEY").is_ok() && std::env::var("SORA_API_URL").is_ok() {
            providers.push(GenerativeProvider::Sora);
        }
        if std::env::var("PIKA_API_KEY").is_ok() && std::env::var("PIKA_API_URL").is_ok() {
            providers.push(GenerativeProvider::Pika);
        }

        if providers.is_empty() {
            warn!("[GenerativeVideo] ⚠️ Aucun provider IA vidéo configuré");
        } else {
            info!(
                "[GenerativeVideo] Providers disponibles: {:?}",
                providers.iter().map(provider_name).collect::<Vec<_>>()
            );
        }

        providers
    }

    /// Récupère le statut d'un job de génération
    pub async fn get_job_status(
        &self,
        job_id: &str,
        user_id: i32,
    ) -> Result<GenerativeJob, String> {
        let row = sqlx::query_as::<_, GenerativeJobRow>(
            r#"SELECT job_id, user_id, status, request_payload, result_payload, error_message, created_at, updated_at
            FROM generative_video_jobs
            WHERE job_id = $1 AND user_id = $2"#
        )
        .bind(job_id)
        .bind(user_id)
        .fetch_optional(self.pool.as_ref())
        .await
        .map_err(|e| format!("Erreur DB get_job_status: {}", e))?
        .ok_or_else(|| format!("Job {} non trouvé", job_id))?;

        let status = match row.status.as_str() {
            "queued" => GenerativeJobStatus::Queued,
            "processing" | "generating_storyboard" => GenerativeJobStatus::GeneratingStoryboard,
            "generating_clips" => GenerativeJobStatus::GeneratingClips,
            "assembling" => GenerativeJobStatus::Assembling,
            "completed" => GenerativeJobStatus::Completed,
            "failed" => GenerativeJobStatus::Failed,
            _ => GenerativeJobStatus::Queued,
        };

        let request: GenerateVideoRequest = row
            .request_payload
            .as_ref()
            .and_then(|v| serde_json::from_value(v.clone()).ok())
            .unwrap_or(GenerateVideoRequest {
                description: String::new(),
                duration_seconds: None,
                style: None,
                mood: None,
                aspect_ratio: None,
                provider: None,
                music_style: None,
                resolution: None,
            });

        let final_video_url = row
            .result_payload
            .as_ref()
            .and_then(|v| v.get("video_url"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let progress_pct = match &status {
            GenerativeJobStatus::Queued => 0.0,
            GenerativeJobStatus::GeneratingStoryboard => 20.0,
            GenerativeJobStatus::GeneratingClips => 50.0,
            GenerativeJobStatus::Assembling => 80.0,
            GenerativeJobStatus::Completed => 100.0,
            GenerativeJobStatus::Failed => 0.0,
        };

        Ok(GenerativeJob {
            job_id: row.job_id,
            user_id: row.user_id as i64,
            request,
            status: status.clone(),
            progress: GenerativeJobProgress {
                progress: progress_pct,
                stage: status,
                current_scene: None,
                total_scenes: None,
                message: row.error_message.clone(),
                estimated_time_remaining: None,
            },
            storyboard: None,
            generated_clips: vec![],
            final_video_url,
            final_timeline_id: None,
            error: row.error_message,
            created_at: row.created_at,
            updated_at: row.updated_at,
            completed_at: if progress_pct >= 100.0 {
                Some(row.updated_at)
            } else {
                None
            },
        })
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
