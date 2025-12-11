// ✅ NOUVEAU Phase 2.2: Service d'intégration YouTube Audio Library pour bibliothèque audio étendue

use crate::core::types::{AppError, AppResult};
use log::info;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Mutex;

/// Track de la bibliothèque YouTube Audio
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct YouTubeAudioTrack {
    pub id: String,
    pub title: String,
    pub artist: String,
    pub genre: Option<String>,
    pub mood: Option<String>,
    pub duration_seconds: u32,
    pub download_url: String,
    pub thumbnail_url: Option<String>,
    pub license: String, // "CC BY", "CC0", etc.
    pub category: Option<String>,
}

/// Métadonnées audio enrichies (format unifié avec Spotify)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioMetadata {
    pub track_id: String,
    pub title: String,
    pub artist: String,
    pub genre: Option<String>,
    pub mood: Option<String>,
    pub bpm: Option<u16>,
    pub duration_ms: u32,
    pub preview_url: Option<String>,
    pub thumbnail_url: Option<String>,
    pub license: String,
    pub source: String, // "youtube", "spotify", "epidemic"
    pub popularity_score: f64,
}

pub struct YouTubeAudioService {
    #[allow(dead_code)]
    client: Client,
    #[allow(dead_code)]
    api_key: Option<String>,
    cache: Arc<Mutex<HashMap<String, (Vec<AudioMetadata>, u64)>>>, // Cache avec timestamp
    cache_ttl: u64,                                                // TTL en secondes
}

impl YouTubeAudioService {
    pub fn new(api_key: Option<String>) -> Self {
        Self {
            client: Client::builder()
                .timeout(Duration::from_secs(10))
                .build()
                .unwrap_or_else(|_| Client::new()),
            api_key,
            cache: Arc::new(Mutex::new(HashMap::new())),
            cache_ttl: 3600, // 1 heure
        }
    }

    /// Recherche dans la bibliothèque YouTube Audio Library
    /// Note: YouTube Audio Library n'a pas d'API publique officielle,
    /// cette implémentation utilise une approche de scraping/crawling ou données statiques
    pub async fn search_tracks(
        &self,
        query: Option<&str>,
        genre: Option<&str>,
        mood: Option<&str>,
        license: Option<&str>,
        limit: Option<u32>,
        offset: Option<u32>,
    ) -> AppResult<(Vec<AudioMetadata>, u32)> {
        // Vérifier le cache
        let cache_key = format!("{:?}_{:?}_{:?}_{:?}", query, genre, mood, license);
        if let Some((cached_data, timestamp)) = self.cache.lock().await.get(&cache_key) {
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs();
            if now - timestamp < self.cache_ttl {
                info!("[YouTubeAudioService] ✅ Résultat depuis cache");
                return Ok((cached_data.clone(), cached_data.len() as u32));
            }
        }

        // Pour l'instant, retourner une bibliothèque statique de tracks YouTube Audio Library
        // Dans une implémentation réelle, on utiliserait le scraping ou une API tierce
        let tracks = self
            .get_curated_youtube_audio_tracks(query, genre, mood, license)
            .await?;

        let limit_val = limit.unwrap_or(20);
        let offset_val = offset.unwrap_or(0);
        let total = tracks.len() as u32;
        let paginated: Vec<_> = tracks
            .into_iter()
            .skip(offset_val as usize)
            .take(limit_val as usize)
            .collect();

        // Mettre en cache
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();
        self.cache
            .lock()
            .await
            .insert(cache_key, (paginated.clone(), now));

        Ok((paginated, total))
    }

    /// Bibliothèque statique de tracks YouTube Audio Library populaires
    /// Dans une implémentation réelle, cela devrait être une base de données ou un scraping
    async fn get_curated_youtube_audio_tracks(
        &self,
        query: Option<&str>,
        genre: Option<&str>,
        mood: Option<&str>,
        license: Option<&str>,
    ) -> AppResult<Vec<AudioMetadata>> {
        // Bibliothèque de référence YouTube Audio Library
        let all_tracks = vec![
            AudioMetadata {
                track_id: "youtube:yt_001".to_string(),
                title: "Upbeat Corporate".to_string(),
                artist: "YouTube Audio Library".to_string(),
                genre: Some("Corporate".to_string()),
                mood: Some("Energetic".to_string()),
                bpm: Some(120),
                duration_ms: 90000,
                preview_url: Some(
                    "https://www.youtube.com/audiolibrary_download?vid=...".to_string(),
                ),
                thumbnail_url: None,
                license: "CC BY".to_string(),
                source: "youtube".to_string(),
                popularity_score: 8.5,
            },
            AudioMetadata {
                track_id: "youtube:yt_002".to_string(),
                title: "Bittersweet".to_string(),
                artist: "YouTube Audio Library".to_string(),
                genre: Some("Cinematic".to_string()),
                mood: Some("Melancholic".to_string()),
                bpm: Some(90),
                duration_ms: 120000,
                preview_url: Some(
                    "https://www.youtube.com/audiolibrary_download?vid=...".to_string(),
                ),
                thumbnail_url: None,
                license: "CC BY".to_string(),
                source: "youtube".to_string(),
                popularity_score: 9.0,
            },
            AudioMetadata {
                track_id: "youtube:yt_003".to_string(),
                title: "Crimson Fly".to_string(),
                artist: "YouTube Audio Library".to_string(),
                genre: Some("Electronic".to_string()),
                mood: Some("Upbeat".to_string()),
                bpm: Some(128),
                duration_ms: 95000,
                preview_url: Some(
                    "https://www.youtube.com/audiolibrary_download?vid=...".to_string(),
                ),
                thumbnail_url: None,
                license: "CC BY".to_string(),
                source: "youtube".to_string(),
                popularity_score: 8.8,
            },
            AudioMetadata {
                track_id: "youtube:yt_004".to_string(),
                title: "Dreams".to_string(),
                artist: "YouTube Audio Library".to_string(),
                genre: Some("Ambient".to_string()),
                mood: Some("Relaxing".to_string()),
                bpm: Some(70),
                duration_ms: 150000,
                preview_url: Some(
                    "https://www.youtube.com/audiolibrary_download?vid=...".to_string(),
                ),
                thumbnail_url: None,
                license: "CC0".to_string(),
                source: "youtube".to_string(),
                popularity_score: 7.5,
            },
            AudioMetadata {
                track_id: "youtube:yt_005".to_string(),
                title: "Jazz Piano Bar".to_string(),
                artist: "YouTube Audio Library".to_string(),
                genre: Some("Jazz".to_string()),
                mood: Some("Smooth".to_string()),
                bpm: Some(100),
                duration_ms: 110000,
                preview_url: Some(
                    "https://www.youtube.com/audiolibrary_download?vid=...".to_string(),
                ),
                thumbnail_url: None,
                license: "CC BY".to_string(),
                source: "youtube".to_string(),
                popularity_score: 8.0,
            },
        ];

        // Filtrer selon les critères
        let filtered: Vec<AudioMetadata> = all_tracks
            .into_iter()
            .filter(|track| {
                if let Some(q) = query {
                    let query_lower = q.to_lowercase();
                    if !track.title.to_lowercase().contains(&query_lower)
                        && !track.artist.to_lowercase().contains(&query_lower)
                    {
                        return false;
                    }
                }
                if let Some(g) = genre {
                    if track.genre.as_ref().map(|s| s.to_lowercase()) != Some(g.to_lowercase()) {
                        return false;
                    }
                }
                if let Some(m) = mood {
                    if track.mood.as_ref().map(|s| s.to_lowercase()) != Some(m.to_lowercase()) {
                        return false;
                    }
                }
                if let Some(l) = license {
                    if !track.license.to_lowercase().contains(&l.to_lowercase()) {
                        return false;
                    }
                }
                true
            })
            .collect();

        Ok(filtered)
    }

    /// Récupère les détails d'un track spécifique
    pub async fn get_track_details(&self, track_id: &str) -> AppResult<AudioMetadata> {
        let tracks = self
            .get_curated_youtube_audio_tracks(None, None, None, None)
            .await?;

        tracks
            .into_iter()
            .find(|t| t.track_id == track_id)
            .ok_or_else(|| {
                AppError::NotFound(format!("Track YouTube Audio '{}' non trouvé", track_id))
            })
    }

    /// Récupère l'URL de téléchargement d'un track
    pub async fn get_download_url(&self, track_id: &str) -> AppResult<String> {
        let track = self.get_track_details(track_id).await?;

        // Pour YouTube Audio Library, l'URL de téléchargement est dans preview_url
        track.preview_url.ok_or_else(|| {
            AppError::Internal(format!(
                "URL de téléchargement non disponible pour '{}'",
                track_id
            ))
        })
    }
}
