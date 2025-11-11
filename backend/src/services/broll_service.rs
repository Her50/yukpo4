use std::fs::create_dir_all;
use std::path::{Path, PathBuf};
use std::time::SystemTime;

use log::{debug, info, warn};
use redis::AsyncCommands;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tokio::fs;
use tokio::io::AsyncWriteExt;
use tokio::process::Command;

use crate::config::broll_config::BrollConfig;
use crate::core::types::{AppError, AppResult};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum BrollSource {
    YukpoLibrary,
    ExternalStock,
    GenerativeAIRunway,
    GenerativeAIPika,
    GenerativeAISora,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrollVariant {
    pub format: String,
    pub path: PathBuf,
    pub duration_seconds: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrollClip {
    pub source: BrollSource,
    pub url: String,
    pub local_path: PathBuf,
    pub duration_seconds: f32,
    pub blend_mode: Option<String>,
    pub variants: Vec<BrollVariant>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrollRequest {
    pub category: String,
    pub location: Option<String>,
    pub mood: Option<String>,
    pub style: Option<String>,
    pub ratio: (u32, u32),
    pub target_duration: f32,
}

#[derive(Clone)]
pub struct BrollService {
    http: reqwest::Client,
    redis_client: redis::Client,
    config: BrollConfig,
}

impl BrollService {
    pub fn new(redis_client: redis::Client, config: BrollConfig) -> Self {
        let http = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(45))
            .build()
            .expect("création client HTTP b-roll");

        Self {
            http,
            redis_client,
            config,
        }
    }

    pub async fn select_or_generate_broll(&self, request: &BrollRequest) -> AppResult<BrollClip> {
        if let Some(clip) = self.try_cache(request).await? {
            info!("[Broll] cache hit pour {:?}", request.category);
            return Ok(clip);
        }

        if let Some(local) = self.find_local_clip(&request.category).await? {
            info!("[Broll] clip local trouvé pour {}", request.category);
            self.cache(request, &local).await?;
            return Ok(local);
        }

        if let Some(stock) = self.request_stock_clip(request).await? {
            info!("[Broll] clip stock téléchargé pour {}", request.category);
            self.cache(request, &stock).await?;
            return Ok(stock);
        }

        if let Some(ai_clip) = self.request_generative_clip(request).await? {
            info!("[Broll] clip généré via IA pour {}", request.category);
            self.cache(request, &ai_clip).await?;
            return Ok(ai_clip);
        }

        Err(AppError::Internal(
            "Impossible de récupérer un b-roll pour ce segment".to_string(),
        ))
    }

    async fn try_cache(&self, request: &BrollRequest) -> AppResult<Option<BrollClip>> {
        if !self.config.cache.enabled {
            return Ok(None);
        }

        let key = self.cache_key(request);
        let mut conn = self
            .redis_client
            .get_multiplexed_async_connection()
            .await
            .map_err(|err| {
                AppError::Internal(format!("Connexion Redis b-roll impossible: {err}"))
            })?;

        let cached: Option<Vec<u8>> = conn.get(&key).await.unwrap_or(None);
        if let Some(bytes) = cached {
            match serde_json::from_slice::<BrollClip>(&bytes) {
                Ok(mut clip) => {
                    if clip.local_path.exists() {
                        clip.variants.retain(|variant| variant.path.exists());
                        return Ok(Some(clip));
                    }
                }
                Err(err) => debug!("[Broll] cache invalide: {err:?}"),
            }
        }

        Ok(None)
    }

    async fn cache(&self, request: &BrollRequest, clip: &BrollClip) -> AppResult<()> {
        if !self.config.cache.enabled {
            return Ok(());
        }

        let key = self.cache_key(request);
        let mut conn = self
            .redis_client
            .get_multiplexed_async_connection()
            .await
            .map_err(|err| {
                AppError::Internal(format!("Connexion Redis b-roll impossible: {err}"))
            })?;

        let payload = serde_json::to_vec(clip).map_err(|err| {
            AppError::Internal(format!("Sérialisation cache b-roll impossible: {err}"))
        })?;
        let ttl = self.config.cache.ttl.as_secs();
        let _: () = conn
            .set_ex(key, payload, ttl)
            .await
            .map_err(|err| AppError::Internal(format!("Écriture cache b-roll: {err}")))?;
        Ok(())
    }

    fn cache_key(&self, request: &BrollRequest) -> String {
        let mut hasher = Sha256::new();
        hasher.update(&request.category);
        if let Some(loc) = &request.location {
            hasher.update(loc);
        }
        if let Some(mood) = &request.mood {
            hasher.update(mood);
        }
        if let Some(style) = &request.style {
            hasher.update(style);
        }
        hasher.update(request.ratio.0.to_le_bytes());
        hasher.update(request.ratio.1.to_le_bytes());
        hasher.update(request.target_duration.to_le_bytes());
        let digest = hasher.finalize();
        format!("broll:{}", hex::encode(digest))
    }

    async fn find_local_clip(&self, category: &str) -> AppResult<Option<BrollClip>> {
        let base_dir = PathBuf::from("assets/broll");
        if !base_dir.exists() {
            return Ok(None);
        }

        let mut dir = fs::read_dir(&base_dir).await?;
        while let Some(entry) = dir.next_entry().await? {
            let path = entry.path();
            if !path.is_file() {
                continue;
            }
            let filename = path
                .file_name()
                .and_then(|name| name.to_str())
                .unwrap_or("")
                .to_lowercase();
            if filename.contains(&category.to_lowercase()) {
                let variants = self.create_variants(&path).await?;
                return Ok(Some(BrollClip {
                    source: BrollSource::YukpoLibrary,
                    url: path.to_string_lossy().to_string(),
                    local_path: path,
                    duration_seconds: 4.0,
                    blend_mode: Some("overlay".to_string()),
                    variants,
                }));
            }
        }

        Ok(None)
    }

    async fn request_stock_clip(&self, request: &BrollRequest) -> AppResult<Option<BrollClip>> {
        let Some(api_url) = &self.config.stock_api_url else {
            return Ok(None);
        };
        let Some(api_key) = &self.config.stock_api_key else {
            return Ok(None);
        };

        let query = request
            .location
            .as_ref()
            .map(|loc| format!("{} {}", request.category, loc))
            .unwrap_or_else(|| request.category.clone());

        let response = self
            .http
            .get(api_url)
            .query(&[
                ("query", query.as_str()),
                ("orientation", "portrait"),
                ("per_page", "1"),
            ])
            .header("Authorization", api_key)
            .send()
            .await
            .map_err(|err| AppError::Internal(format!("Stock API error: {err}")))?;

        if !response.status().is_success() {
            warn!(
                "[Broll] Stock API retour {} pour catégorie {}",
                response.status(),
                request.category
            );
            return Ok(None);
        }

        let body = response
            .json::<serde_json::Value>()
            .await
            .map_err(|err| AppError::Internal(format!("Stock API invalid JSON: {err}")))?;

        let Some(video) = body
            .get("videos")
            .and_then(|videos| videos.as_array())
            .and_then(|arr| arr.first())
        else {
            return Ok(None);
        };

        let url = video
            .get("url")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        if url.is_empty() {
            return Ok(None);
        }

        let local_path = self.download_video(&url).await?;
        let variants = self.create_variants(&local_path).await?;

        Ok(Some(BrollClip {
            source: BrollSource::ExternalStock,
            url,
            local_path,
            duration_seconds: request.target_duration.max(3.5),
            blend_mode: Some("cover".to_string()),
            variants,
        }))
    }

    async fn request_generative_clip(
        &self,
        request: &BrollRequest,
    ) -> AppResult<Option<BrollClip>> {
        let providers = [
            (
                "runway",
                self.config.ai.runway_endpoint.as_ref(),
                self.config.ai.runway_api_key.as_ref(),
                BrollSource::GenerativeAIRunway,
            ),
            (
                "pika",
                self.config.ai.pika_endpoint.as_ref(),
                self.config.ai.pika_api_key.as_ref(),
                BrollSource::GenerativeAIPika,
            ),
            (
                "sora",
                self.config.ai.sora_endpoint.as_ref(),
                self.config.ai.sora_api_key.as_ref(),
                BrollSource::GenerativeAISora,
            ),
        ];

        for (provider_id, endpoint, api_key, source) in providers {
            let (Some(url), Some(key)) = (endpoint, api_key) else {
                continue;
            };

            match self
                .call_ai_provider(provider_id, url, key, request)
                .await?
            {
                Some(remote_url) => {
                    let local_path = self.download_video(&remote_url).await?;
                    let variants = self.create_variants(&local_path).await?;
                    return Ok(Some(BrollClip {
                        source,
                        url: remote_url,
                        local_path,
                        duration_seconds: request.target_duration.max(4.5),
                        blend_mode: Some("screen".to_string()),
                        variants,
                    }));
                }
                None => continue,
            }
        }

        Ok(None)
    }

    async fn call_ai_provider(
        &self,
        provider: &str,
        endpoint: &str,
        api_key: &str,
        request: &BrollRequest,
    ) -> AppResult<Option<String>> {
        let prompt = format!(
            "Category: {}. Mood: {}. Style: {}. Location: {}. Ratio {}:{}. Cinematic, vibrant lighting, focus on subject.",
            request.category,
            request.mood.clone().unwrap_or_else(|| "dynamique".to_string()),
            request.style.clone().unwrap_or_else(|| "immersive".to_string()),
            request
                .location
                .clone()
                .unwrap_or_else(|| "ville africaine moderne".to_string()),
            request.ratio.0,
            request.ratio.1
        );

        let payload = serde_json::json!({
            "prompt": prompt,
            "duration": request.target_duration.max(4.5),
            "ratio": format!("{}:{}", request.ratio.0, request.ratio.1),
        });

        let response = self
            .http
            .post(endpoint)
            .header("Authorization", format!("Bearer {api_key}"))
            .json(&payload)
            .send()
            .await
            .map_err(|err| {
                AppError::Internal(format!("[Broll::{provider}] appel API impossible: {err}"))
            })?;

        if !response.status().is_success() {
            warn!(
                "[Broll::{provider}] statut HTTP {} pour la génération AI",
                response.status()
            );
            return Ok(None);
        }

        let body = response
            .json::<serde_json::Value>()
            .await
            .map_err(|err| AppError::Internal(format!("Réponse IA invalide: {err}")))?;

        let remote_url = body
            .get("video_url")
            .or_else(|| body.get("url"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        Ok(remote_url)
    }

    async fn download_video(&self, remote_url: &str) -> AppResult<PathBuf> {
        create_dir_all(&self.config.download_dir).map_err(|err| {
            AppError::Internal(format!("Création dossier b-roll impossible: {err}"))
        })?;

        let filename = format!(
            "broll_{}_{}.mp4",
            SystemTime::now()
                .duration_since(SystemTime::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs(),
            rand::random::<u32>()
        );

        let dest_path = Path::new(&self.config.download_dir).join(filename);

        let response = self
            .http
            .get(remote_url)
            .send()
            .await
            .map_err(|err| AppError::Internal(format!("Téléchargement b-roll: {err}")))?;

        if !response.status().is_success() {
            return Err(AppError::Internal(format!(
                "Téléchargement b-roll échoué ({}): {}",
                response.status(),
                remote_url
            )));
        }

        let mut file = fs::File::create(&dest_path).await.map_err(|err| {
            AppError::Internal(format!("Création fichier b-roll impossible: {err}"))
        })?;

        let bytes = response
            .bytes()
            .await
            .map_err(|err| AppError::Internal(format!("Lecture flux b-roll impossible: {err}")))?;
        file.write_all(&bytes).await.map_err(|err| {
            AppError::Internal(format!("Écriture fichier b-roll impossible: {err}"))
        })?;

        file.flush()
            .await
            .map_err(|err| AppError::Internal(format!("Flush fichier b-roll: {err}")))?;

        Ok(dest_path)
    }

    async fn create_variants(&self, path: &Path) -> AppResult<Vec<BrollVariant>> {
        let mut variants = Vec::new();
        let base_dir = path
            .parent()
            .map(|parent| parent.join("variants"))
            .unwrap_or_else(|| PathBuf::from("storage/broll/variants"));

        if let Err(err) = create_dir_all(&base_dir) {
            warn!("[Broll] impossible de créer variants dir: {err}");
            return Ok(variants);
        }

        let profiles = [
            ("portrait", "1080:1920", "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(1080-iw)/2:(1920-ih)/2"),
            ("square", "1080:1080", "scale=1080:1080:force_original_aspect_ratio=decrease,pad=1080:1080:(1080-iw)/2:(1080-ih)/2"),
            ("landscape", "1920:1080", "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(1920-iw)/2:(1080-ih)/2"),
        ];

        for (label, _res, filter) in profiles {
            let variant_path = base_dir.join(format!(
                "{}_{}.mp4",
                path.file_stem()
                    .and_then(|s| s.to_str())
                    .unwrap_or("variant"),
                label
            ));

            let status = Command::new("ffmpeg")
                .args([
                    "-y",
                    "-i",
                    path.to_string_lossy().as_ref(),
                    "-vf",
                    filter,
                    "-c:a",
                    "copy",
                    variant_path.to_string_lossy().as_ref(),
                ])
                .status()
                .await
                .map_err(|err| AppError::Internal(format!("ffmpeg variant {label}: {err}")))?;

            if status.success() {
                variants.push(BrollVariant {
                    format: label.to_string(),
                    path: variant_path,
                    duration_seconds: 0.0,
                });
            } else {
                warn!(
                    "[Broll] ffmpeg variante {} a échoué (code={:?})",
                    label,
                    status.code()
                );
            }
        }

        Ok(variants)
    }
}
