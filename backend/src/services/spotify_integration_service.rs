// ✅ NOUVEAU Phase 2.2: Service d'intégration Spotify API pour bibliothèque audio étendue

use crate::core::types::{AppError, AppResult};
use log::{info, warn};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

/// Token d'accès Spotify avec expiration
#[derive(Debug, Clone, Serialize, Deserialize)]
struct SpotifyAccessToken {
    access_token: String,
    token_type: String,
    expires_in: u64,
    expires_at: u64,
}

/// Résultat de recherche Spotify
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpotifyTrack {
    pub id: String,
    pub name: String,
    pub artists: Vec<SpotifyArtist>,
    pub album: SpotifyAlbum,
    pub preview_url: Option<String>,
    pub duration_ms: u32,
    pub popularity: u8,
    pub external_urls: HashMap<String, String>,
    pub uri: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpotifyArtist {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpotifyAlbum {
    pub id: String,
    pub name: String,
    pub images: Vec<SpotifyImage>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpotifyImage {
    pub url: String,
    pub height: Option<u32>,
    pub width: Option<u32>,
}

/// Réponse de recherche Spotify
#[derive(Debug, Deserialize)]
struct SpotifySearchResponse {
    tracks: SpotifyTracksResponse,
}

#[derive(Debug, Deserialize)]
struct SpotifyTracksResponse {
    items: Vec<SpotifyTrack>,
    total: u32,
    limit: u32,
    offset: u32,
}

/// Métadonnées audio enrichies
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
    pub source: String, // "spotify", "youtube", "epidemic"
    pub popularity_score: f64,
}

pub struct SpotifyIntegrationService {
    client: Client,
    client_id: String,
    client_secret: String,
    access_token: Arc<tokio::sync::RwLock<Option<SpotifyAccessToken>>>,
}

impl SpotifyIntegrationService {
    pub fn new(client_id: String, client_secret: String) -> Self {
        Self {
            client: Client::builder()
                .timeout(Duration::from_secs(10))
                .build()
                .unwrap_or_else(|_| Client::new()),
            client_id,
            client_secret,
            access_token: Arc::new(tokio::sync::RwLock::new(None)),
        }
    }

    /// Obtient ou rafraîchit le token d'accès Spotify
    async fn get_access_token(&self) -> AppResult<String> {
        // Vérifier si le token est valide
        {
            let token_guard = self.access_token.read().await;
            if let Some(token) = token_guard.as_ref() {
                let now = SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap()
                    .as_secs();
                if now < token.expires_at {
                    return Ok(token.access_token.clone());
                }
            }
        }

        // Obtenir un nouveau token
        use base64::engine::general_purpose::STANDARD;
        use base64::Engine as _;
        let credentials = format!("{}:{}", self.client_id, self.client_secret);
        let auth_string = STANDARD.encode(credentials.as_bytes());
        let response = self
            .client
            .post("https://accounts.spotify.com/api/token")
            .header("Authorization", format!("Basic {}", auth_string))
            .header("Content-Type", "application/x-www-form-urlencoded")
            .body("grant_type=client_credentials")
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("Erreur authentification Spotify: {}", e)))?;

        if !response.status().is_success() {
            return Err(AppError::Internal(
                "Échec authentification Spotify".to_string(),
            ));
        }

        let token_data: serde_json::Value = response
            .json()
            .await
            .map_err(|e| AppError::Internal(format!("Erreur parsing token Spotify: {}", e)))?;

        let expires_in = token_data["expires_in"].as_u64().unwrap_or(3600);
        let expires_at = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs()
            + expires_in
            - 300; // Marge de 5 minutes

        let access_token = SpotifyAccessToken {
            access_token: token_data["access_token"]
                .as_str()
                .unwrap_or("")
                .to_string(),
            token_type: token_data["token_type"]
                .as_str()
                .unwrap_or("Bearer")
                .to_string(),
            expires_in,
            expires_at,
        };

        let access_token_string = access_token.access_token.clone();
        {
            let mut token_guard = self.access_token.write().await;
            *token_guard = Some(access_token);
        }

        Ok(access_token_string)
    }

    /// Recherche de tracks sur Spotify
    pub async fn search_tracks(
        &self,
        query: &str,
        limit: Option<u32>,
        offset: Option<u32>,
        genre: Option<&str>,
        mood: Option<&str>,
        _bpm_min: Option<u16>,
        _bpm_max: Option<u16>,
    ) -> AppResult<(Vec<AudioMetadata>, u32)> {
        let access_token = self.get_access_token().await?;

        // Construire la requête de recherche
        let mut search_query = query.to_string();
        if let Some(g) = genre {
            search_query.push_str(&format!(" genre:{}", g));
        }

        let limit = limit.unwrap_or(20).min(50);
        let offset = offset.unwrap_or(0);

        let url = format!(
            "https://api.spotify.com/v1/search?q={}&type=track&limit={}&offset={}",
            urlencoding::encode(&search_query),
            limit,
            offset
        );

        let response = self
            .client
            .get(&url)
            .header("Authorization", format!("Bearer {}", access_token))
            .send()
            .await
            .map_err(|e| {
                warn!("[SpotifyService] Erreur recherche: {}", e);
                AppError::Internal(format!("Erreur recherche Spotify: {}", e))
            })?;

        if !response.status().is_success() {
            return Err(AppError::Internal(format!(
                "Échec recherche Spotify: {}",
                response.status()
            )));
        }

        let search_response: SpotifySearchResponse = response.json().await.map_err(|e| {
            warn!("[SpotifyService] Erreur parsing réponse: {}", e);
            AppError::Internal(format!("Erreur parsing réponse Spotify: {}", e))
        })?;

        // Convertir les tracks en métadonnées audio
        let metadata: Vec<AudioMetadata> = search_response
            .tracks
            .items
            .into_iter()
            .map(|track| {
                let artist_name = track
                    .artists
                    .first()
                    .map(|a| a.name.clone())
                    .unwrap_or_else(|| "Unknown".to_string());

                AudioMetadata {
                    track_id: format!("spotify:{}", track.id),
                    title: track.name,
                    artist: artist_name,
                    genre: genre.map(|g| g.to_string()),
                    mood: mood.map(|m| m.to_string()),
                    bpm: None, // Spotify ne fournit pas directement le BPM via l'API standard
                    duration_ms: track.duration_ms,
                    preview_url: track.preview_url,
                    thumbnail_url: track.album.images.first().map(|img| img.url.clone()),
                    license: "Spotify Preview (Usage limité)".to_string(),
                    source: "spotify".to_string(),
                    popularity_score: track.popularity as f64,
                }
            })
            .collect();

        info!(
            "[SpotifyService] ✅ Recherche réussie: {} résultats",
            metadata.len()
        );

        Ok((metadata, search_response.tracks.total))
    }

    /// Récupère les détails d'un track spécifique
    pub async fn get_track_details(&self, track_id: &str) -> AppResult<AudioMetadata> {
        let access_token = self.get_access_token().await?;

        // Enlever le préfixe "spotify:" si présent
        let spotify_id = track_id.strip_prefix("spotify:").unwrap_or(track_id);

        let url = format!("https://api.spotify.com/v1/tracks/{}", spotify_id);

        let response = self
            .client
            .get(&url)
            .header("Authorization", format!("Bearer {}", access_token))
            .send()
            .await
            .map_err(|e| {
                warn!("[SpotifyService] Erreur récupération track: {}", e);
                AppError::Internal(format!("Erreur récupération track Spotify: {}", e))
            })?;

        if !response.status().is_success() {
            return Err(AppError::NotFound(format!(
                "Track Spotify '{}' non trouvé",
                track_id
            )));
        }

        let track: SpotifyTrack = response.json().await.map_err(|e| {
            warn!("[SpotifyService] Erreur parsing track: {}", e);
            AppError::Internal(format!("Erreur parsing track Spotify: {}", e))
        })?;

        let artist_name = track
            .artists
            .first()
            .map(|a| a.name.clone())
            .unwrap_or_else(|| "Unknown".to_string());

        Ok(AudioMetadata {
            track_id: format!("spotify:{}", track.id),
            title: track.name,
            artist: artist_name,
            genre: None,
            mood: None,
            bpm: None,
            duration_ms: track.duration_ms,
            preview_url: track.preview_url,
            thumbnail_url: track.album.images.first().map(|img| img.url.clone()),
            license: "Spotify Preview (Usage limité)".to_string(),
            source: "spotify".to_string(),
            popularity_score: track.popularity as f64,
        })
    }

    /// Recherche par genre/mood (utilise les playlists Spotify comme proxy)
    pub async fn search_by_genre_mood(
        &self,
        genre: &str,
        mood: Option<&str>,
        limit: Option<u32>,
    ) -> AppResult<Vec<AudioMetadata>> {
        // Recherche dans les playlists Spotify
        let query = if let Some(m) = mood {
            format!("{} {}", genre, m)
        } else {
            genre.to_string()
        };

        let (metadata, _) = self
            .search_tracks(&query, limit, Some(0), Some(genre), mood, None, None)
            .await?;

        Ok(metadata)
    }
}
