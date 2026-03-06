// ✅ NOUVEAU: Service de musique trending et librairies populaires
// Intégration avec Spotify API, TikTok trends, et librairies royalty-free

use crate::core::types::{AppError, AppResult};
use crate::services::audio_library_service;
use chrono::{DateTime, Utc};
use log::{error, info, warn};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::PgPool;
use std::collections::HashMap;
use std::sync::Arc;

/// Configuration pour les sources de musique
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MusicSource {
    pub name: String,
    pub api_endpoint: Option<String>,
    pub api_key: Option<String>,
    pub is_active: bool,
    pub rate_limit_per_hour: i32,
    pub supported_genres: Vec<String>,
}

/// Piste musicale avec métadonnées enrichies
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct MusicTrack {
    pub id: String,
    pub title: String,
    pub artist: String,
    pub album: Option<String>,
    pub genre: String,
    pub subgenre: Option<String>,
    pub mood: String,
    pub energy_level: f32, // 0.0 - 1.0
    pub tempo_bpm: Option<i32>,
    pub duration_seconds: i32,
    pub preview_url: String,
    pub full_track_url: String,
    pub waveform_data: Option<Vec<f32>>, // Pour visualisation
    pub is_explicit: bool,
    pub is_instrumental: bool,
    pub has_vocals: bool,
    pub language: Option<String>,
    pub popularity_score: f32,     // 0.0 - 1.0
    pub trending_score: f32,       // Score de tendance actuel
    pub license_type: String,      // "royalty_free", "commercial", "creative_commons"
    pub cost_credits: Option<i32>, // Coût en crédits si payant
    pub source: String,            // "spotify", "tiktok", "epidemic", "artlist"
    pub source_track_id: String,
    pub tags: Vec<String>,
    pub similar_tracks: Vec<String>, // IDs de pistes similaires
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub last_trending_update: Option<DateTime<Utc>>,
}

/// Playlist thématique pré-configurée
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct CuratedPlaylist {
    pub id: String,
    pub name: String,
    pub description: String,
    pub category: String, // "viral", "cinematic", "corporate", "trend"
    pub mood_tags: Vec<String>,
    pub energy_range: (f32, f32),
    pub tempo_range: (i32, i32),
    pub track_count: i32,
    pub total_duration_minutes: i32,
    pub cover_image_url: String,
    pub is_premium: bool,
    pub tracks: Vec<String>, // Track IDs
    pub created_by: String,
    pub popularity_score: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TrendDirection {
    Up,
    Down,
    Stable,
}

/// Métadonnées de trending
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrendingMetadata {
    pub track_id: String,
    pub title: String,
    pub artist: String,
    pub genre: String,
    pub tempo_bpm: Option<i32>,
    pub energy_level: f32,
    pub danceability: f32,
    pub valence: f32,
    pub duration_seconds: i32,
    pub preview_url: Option<String>,
    pub cover_art_url: Option<String>,
    pub is_explicit: bool,
    pub release_date: Option<DateTime<Utc>>,
    pub region: String,
    pub chart_position: Option<i32>,
    pub viral_score: f32,
    pub usage_count_videos: i64,
    pub peak_date: Option<DateTime<Utc>>,
    pub trend_direction: TrendDirection,
}

/// Service de musique trending
pub struct TrendingMusicService {
    pool: Arc<PgPool>,
    sources: HashMap<String, MusicSource>,
}

impl TrendingMusicService {
    pub fn new(pool: Arc<PgPool>) -> Self {
        let mut service = Self {
            pool,
            sources: HashMap::new(),
        };

        service.initialize_sources();
        service
    }

    /// Initialise les sources de musique
    fn initialize_sources(&mut self) {
        let sources = vec![
            MusicSource {
                name: "Spotify".to_string(),
                api_endpoint: Some("https://api.spotify.com/v1".to_string()),
                api_key: Some(std::env::var("SPOTIFY_API_KEY").unwrap_or_default()),
                is_active: true,
                rate_limit_per_hour: 1000,
                supported_genres: vec![
                    "pop".to_string(),
                    "rock".to_string(),
                    "hip_hop".to_string(),
                    "electronic".to_string(),
                    "r&b".to_string(),
                    "country".to_string(),
                    "jazz".to_string(),
                    "classical".to_string(),
                    "latin".to_string(),
                    "indie".to_string(),
                    "metal".to_string(),
                    "folk".to_string(),
                ],
            },
            MusicSource {
                name: "TikTok Trends".to_string(),
                api_endpoint: Some("https://open-api.tiktok.com/api".to_string()),
                api_key: Some(std::env::var("TIKTOK_API_KEY").unwrap_or_default()),
                is_active: true,
                rate_limit_per_hour: 500,
                supported_genres: vec![
                    "viral".to_string(),
                    "trending".to_string(),
                    "dance".to_string(),
                    "chill".to_string(),
                    "energy".to_string(),
                    "lofi".to_string(),
                    "phonk".to_string(),
                ],
            },
            MusicSource {
                name: "Epidemic Sound".to_string(),
                api_endpoint: Some("https://api.epidemicsound.com/v1".to_string()),
                api_key: Some(std::env::var("EPIDEMIC_API_KEY").unwrap_or_default()),
                is_active: false, // Souvent payant
                rate_limit_per_hour: 200,
                supported_genres: vec![
                    "cinematic".to_string(),
                    "corporate".to_string(),
                    "documentary".to_string(),
                    "vlog".to_string(),
                    "gaming".to_string(),
                    "sports".to_string(),
                ],
            },
            MusicSource {
                name: "Artlist".to_string(),
                api_endpoint: Some("https://api.artlist.io/v1".to_string()),
                api_key: Some(std::env::var("ARTLIST_API_KEY").unwrap_or_default()),
                is_active: false, // Souvent payant
                rate_limit_per_hour: 200,
                supported_genres: vec![
                    "indie".to_string(),
                    "folk".to_string(),
                    "ambient".to_string(),
                    "electronic".to_string(),
                    "orchestral".to_string(),
                    "world".to_string(),
                ],
            },
        ];

        for source in sources {
            self.sources.insert(source.name.clone(), source);
        }

        info!(
            "[TrendingMusic] ✅ {} sources de musique initialisées",
            self.sources.len()
        );
    }

    /// Récupère les pistes trending par région et genre
    pub async fn get_trending_tracks(
        &self,
        region: &str,
        genre: Option<&str>,
        mood: Option<&str>,
        limit: Option<u32>,
    ) -> AppResult<Vec<MusicTrack>> {
        let limit = limit.unwrap_or(50);

        let mut query = sqlx::QueryBuilder::new(
            "SELECT * FROM music_tracks 
             WHERE trending_score > 0.3
             AND is_explicit = false",
        );

        if let Some(genre_filter) = genre {
            query.push(" AND genre = ");
            query.push_bind(genre_filter);
        }

        if let Some(mood_filter) = mood {
            query.push(" AND mood = ");
            query.push_bind(mood_filter);
        }

        // Filtrer par région si disponible
        if region != "global" {
            query.push(" AND (region = ");
            query.push_bind(region);
            query.push(" OR region = 'global')");
        }

        query.push(" ORDER BY trending_score DESC, popularity_score DESC LIMIT ");
        query.push_bind(limit as i64);

        let tracks: Vec<MusicTrack> =
            query.build_query_as().fetch_all(self.pool.as_ref()).await.map_err(|e| {
                error!("[TrendingMusic] Erreur récupération trending tracks: {}", e);
                AppError::Database(e.to_string())
            })?;

        info!(
            "[TrendingMusic] {} pistes trending trouvées pour {}/{}",
            tracks.len(),
            region,
            genre.unwrap_or("tous")
        );

        Ok(tracks)
    }

    /// Récupère les playlists curées
    pub async fn get_curated_playlists(
        &self,
        category: Option<&str>,
        mood: Option<&str>,
        limit: Option<u32>,
    ) -> AppResult<Vec<CuratedPlaylist>> {
        let limit = limit.unwrap_or(20);

        let mut query = sqlx::QueryBuilder::new("SELECT * FROM curated_playlists WHERE 1=1");

        if let Some(cat_filter) = category {
            query.push(" AND category = ");
            query.push_bind(cat_filter);
        }

        if let Some(mood_filter) = mood {
            query.push(" AND mood_tags && ");
            query.push_bind(vec![mood_filter.to_string()]);
        }

        query.push(" ORDER BY popularity_score DESC LIMIT ");
        query.push_bind(limit as i64);

        let playlists: Vec<CuratedPlaylist> =
            query.build_query_as().fetch_all(self.pool.as_ref()).await.map_err(|e| {
                error!("[TrendingMusic] Erreur récupération playlists: {}", e);
                AppError::Database(e.to_string())
            })?;

        Ok(playlists)
    }

    /// Recherche de pistes par texte
    pub async fn search_tracks(
        &self,
        query_text: &str,
        genre: Option<&str>,
        mood: Option<&str>,
        energy_min: Option<f32>,
        energy_max: Option<f32>,
        tempo_min: Option<u32>,
        tempo_max: Option<u32>,
        limit: Option<u32>,
    ) -> AppResult<Vec<MusicTrack>> {
        let limit = limit.unwrap_or(30);

        let mut query = sqlx::QueryBuilder::new(
            "SELECT * FROM music_tracks 
             WHERE (title ILIKE $1 OR artist ILIKE $1 OR album ILIKE $1 OR tags && $2)",
        );

        let search_pattern = format!("%{}%", query_text);
        let search_tags = vec![query_text.to_string()];
        query.push_bind(&search_pattern);
        query.push_bind(&search_tags);

        if let Some(genre_filter) = genre {
            query.push(" AND genre = ");
            query.push_bind(genre_filter);
        }

        if let Some(mood_filter) = mood {
            query.push(" AND mood = ");
            query.push_bind(mood_filter);
        }

        if let Some(min_energy) = energy_min {
            query.push(" AND energy_level >= ");
            query.push_bind(min_energy);
        }

        if let Some(max_energy) = energy_max {
            query.push(" AND energy_level <= ");
            query.push_bind(max_energy);
        }

        if let Some(min_tempo) = tempo_min {
            query.push(" AND tempo_bpm >= ");
            query.push_bind(min_tempo as i32);
        }

        if let Some(max_tempo) = tempo_max {
            query.push(" AND tempo_bpm <= ");
            query.push_bind(max_tempo as i32);
        }

        query.push(" ORDER BY popularity_score DESC, trending_score DESC LIMIT ");
        query.push_bind(limit as i64);

        let tracks: Vec<MusicTrack> =
            query.build_query_as().fetch_all(self.pool.as_ref()).await.map_err(|e| {
                error!("[TrendingMusic] Erreur recherche pistes: {}", e);
                AppError::Database(e.to_string())
            })?;

        info!(
            "[TrendingMusic] {} pistes trouvées pour '{}'",
            tracks.len(),
            query_text
        );

        Ok(tracks)
    }

    /// Récupère les pistes similaires
    pub async fn get_similar_tracks(
        &self,
        track_id: &str,
        limit: Option<u32>,
    ) -> AppResult<Vec<MusicTrack>> {
        let limit = limit.unwrap_or(10);

        // D'abord récupérer les IDs de pistes similaires
        let similar_ids: Vec<String> =
            sqlx::query_scalar("SELECT similar_tracks FROM music_tracks WHERE id = $1")
                .bind(track_id)
                .fetch_one(self.pool.as_ref())
                .await
                .map_err(|e| {
                    error!("[TrendingMusic] Erreur récupération similar IDs: {}", e);
                    AppError::Database(e.to_string())
                })?;

        if similar_ids.is_empty() {
            return Ok(vec![]);
        }

        // Récupérer les pistes similaires
        let tracks: Vec<MusicTrack> = sqlx::query_as(
            "SELECT * FROM music_tracks 
             WHERE id = ANY($1) 
             ORDER BY popularity_score DESC 
             LIMIT $2",
        )
        .bind(&similar_ids)
        .bind(limit as i64)
        .fetch_all(self.pool.as_ref())
        .await
        .map_err(|e| {
            error!("[TrendingMusic] Erreur récupération similar tracks: {}", e);
            AppError::Database(e.to_string())
        })?;

        Ok(tracks)
    }

    /// Met à jour les scores de trending depuis les APIs externes
    pub async fn update_trending_scores(&self) -> AppResult<u32> {
        let mut updated_count = 0;

        // Mettre à jour depuis TikTok trends
        if let Some(tiktok_source) = self.sources.get("TikTok Trends") {
            if tiktok_source.is_active {
                match self.update_tiktok_trends().await {
                    Ok(count) => {
                        updated_count += count;
                        info!("[TrendingMusic] {} pistes TikTok mises à jour", count);
                    }
                    Err(e) => {
                        warn!("[TrendingMusic] Erreur mise à jour TikTok: {}", e);
                    }
                }
            }
        }

        // Mettre à jour depuis Spotify
        if let Some(spotify_source) = self.sources.get("Spotify") {
            if spotify_source.is_active {
                match self.update_spotify_trends().await {
                    Ok(count) => {
                        updated_count += count;
                        info!("[TrendingMusic] {} pistes Spotify mises à jour", count);
                    }
                    Err(e) => {
                        warn!("[TrendingMusic] Erreur mise à jour Spotify: {}", e);
                    }
                }
            }
        }

        info!(
            "[TrendingMusic] ✅ {} pistes trending mises à jour au total",
            updated_count
        );
        Ok(updated_count)
    }

    /// Met à jour les trends TikTok
    async fn update_tiktok_trends(&self) -> AppResult<u32> {
        // Simulation - en réalité, appeler l'API TikTok
        let mock_trends = vec![
            ("viral_dance_2024", "Dance Viral 2024", 0.95),
            ("chill_lofi_study", "Chill Lofi Study", 0.88),
            ("energy_workout", "Energy Workout Mix", 0.82),
            ("phonk_drift", "Phonk Drift", 0.91),
        ];

        let mut updated = 0;

        for (track_id, _title, trending_score) in mock_trends {
            let result = sqlx::query(
                "UPDATE music_tracks 
                 SET trending_score = $1, last_trending_update = NOW()
                 WHERE source_track_id = $2 AND source = 'TikTok Trends'",
            )
            .bind(trending_score)
            .bind(track_id)
            .execute(self.pool.as_ref())
            .await;

            if result.is_ok() && result.unwrap().rows_affected() > 0 {
                updated += 1;
            }
        }

        Ok(updated)
    }

    /// Met à jour les trends Spotify
    async fn update_spotify_trends(&self) -> AppResult<u32> {
        // Simulation - en réalité, appeler l'API Spotify
        let mock_trends = vec![
            ("spotify_viral_50", "Spotify Viral 50", 0.93),
            ("top_hits_global", "Top Hits Global", 0.97),
            ("chill_hits", "Chill Hits", 0.85),
            ("pop_rising", "Pop Rising", 0.79),
        ];

        let mut updated = 0;

        for (track_id, _title, trending_score) in mock_trends {
            let result = sqlx::query(
                "UPDATE music_tracks 
                 SET trending_score = $1, last_trending_update = NOW()
                 WHERE source_track_id = $2 AND source = 'Spotify'",
            )
            .bind(trending_score)
            .bind(track_id)
            .execute(self.pool.as_ref())
            .await;

            if result.is_ok() && result.unwrap().rows_affected() > 0 {
                updated += 1;
            }
        }

        Ok(updated)
    }

    /// Génère une playlist personnalisée basée sur les préférences
    pub async fn generate_personalized_playlist(
        &self,
        user_id: i64,
        preferences: &serde_json::Value,
        duration_minutes: u32,
    ) -> AppResult<Vec<MusicTrack>> {
        let _target_mood = preferences.get("mood").and_then(|v| v.as_str()).unwrap_or("energetic");
        let target_energy =
            preferences.get("energy").and_then(|v| v.as_f64()).unwrap_or(0.7) as f32;
        let preferred_genres: Vec<String> = preferences
            .get("genres")
            .and_then(|v| v.as_array())
            .map(|arr| arr.iter().filter_map(|v| v.as_str()).map(|s| s.to_string()).collect())
            .unwrap_or_default();

        let target_duration_seconds = duration_minutes * 60;
        let mut selected_tracks = Vec::new();
        let mut current_duration = 0;

        // Stratégie de sélection intelligente
        let mut query = sqlx::QueryBuilder::new(
            "SELECT * FROM music_tracks 
             WHERE is_explicit = false 
             AND energy_level BETWEEN $1 AND $2",
        );

        let energy_min = (target_energy - 0.2).max(0.0);
        let energy_max = (target_energy + 0.2).min(1.0);
        query.push_bind(energy_min);
        query.push_bind(energy_max);

        if !preferred_genres.is_empty() {
            query.push(" AND genre = ANY($3)");
            query.push_bind(&preferred_genres);
        }

        query.push(" ORDER BY trending_score DESC, popularity_score DESC");

        let available_tracks: Vec<MusicTrack> =
            query.build_query_as().fetch_all(self.pool.as_ref()).await.map_err(|e| {
                error!(
                    "[TrendingMusic] Erreur sélection pistes personnalisées: {}",
                    e
                );
                AppError::Database(e.to_string())
            })?;

        // Algorithme de sélection pour atteindre la durée cible
        for track in available_tracks {
            if current_duration + track.duration_seconds > target_duration_seconds as i32 {
                continue;
            }

            selected_tracks.push(track.clone());
            current_duration += track.duration_seconds;

            if current_duration >= (target_duration_seconds * 90 / 100) as i32 {
                break; // 90% de la durée cible est suffisant
            }
        }

        info!(
            "[TrendingMusic] Playlist générée: {} pistes, {}s pour utilisateur {}",
            selected_tracks.len(),
            current_duration,
            user_id
        );

        Ok(selected_tracks)
    }

    /// Analyse l'audio d'une vidéo pour recommander de la musique
    pub async fn analyze_video_for_music_recommendation(
        &self,
        video_url: &str,
        _user_preferences: Option<&serde_json::Value>,
    ) -> AppResult<Vec<MusicTrack>> {
        // Simuler l'analyse audio (en réalité, utiliser un service d'analyse audio)
        let video_analysis = json!({
            "tempo_bpm": 128,
            "energy_level": 0.75,
            "mood": "energetic",
            "genre": "electronic",
            "key": "C major",
            "has_speech": false
        });

        let tempo = video_analysis["tempo_bpm"].as_u64().unwrap_or(120) as u32;
        let energy = video_analysis["energy_level"].as_f64().unwrap_or(0.5) as f32;
        let mood = video_analysis["mood"].as_str().unwrap_or("neutral");
        let genre = video_analysis["genre"].as_str().unwrap_or("pop");

        // Rechercher des pistes compatibles
        let tracks = self
            .search_tracks(
                "", // Pas de recherche textuelle
                Some(genre),
                Some(mood),
                Some((energy - 0.2).max(0.0)),
                Some((energy + 0.2).min(1.0)),
                Some((tempo - 15).max(60)),
                Some((tempo + 15).min(180)),
                Some(20),
            )
            .await?;

        info!(
            "[TrendingMusic] {} pistes recommandées pour vidéo {}",
            tracks.len(),
            video_url
        );

        Ok(tracks)
    }

    /// Récupère une boucle curée basée sur le mode et hint
    pub async fn get_curated_loop(
        &self,
        mode: Option<&str>,
        _hint: Option<&str>,
    ) -> Option<audio_library_service::CuratedAudioLoop> {
        // Since CuratedAudioLoop expects &'static str, we need to use a different approach
        // For now, return None to avoid the lifetime issue
        None
    }

    /// Crée une playlist curée personnalisée
    pub async fn create_curated_playlist(
        &self,
        name: String,
        description: String,
        category: String,
        mood_tags: Vec<String>,
        track_ids: Vec<String>,
        created_by: String,
    ) -> AppResult<CuratedPlaylist> {
        let playlist_id = uuid::Uuid::new_v4().to_string();

        // Calculer les métadonnées
        let track_count = track_ids.len() as i32;
        let total_duration: i32 = sqlx::query_scalar!(
            "SELECT COALESCE(SUM(duration_seconds), 0) FROM music_tracks WHERE id = ANY($1)",
        )
        .bind(&track_ids)
        .fetch_one(self.pool.as_ref())
        .await
        .map_err(|e| {
            error!("[TrendingMusic] Erreur calcul durée playlist: {}", e);
            AppError::Database(e.to_string())
        })?;

        let playlist = CuratedPlaylist {
            id: playlist_id.clone(),
            name,
            description,
            category,
            mood_tags,
            energy_range: (0.0, 1.0), // À calculer depuis les pistes
            tempo_range: (60, 180),   // À calculer depuis les pistes
            track_count,
            total_duration_minutes: total_duration / 60,
            cover_image_url: format!(
                "https://storage.googleapis.com/yukpo-playlists/{}.jpg",
                playlist_id
            ),
            is_premium: false,
            tracks: track_ids,
            created_by,
            popularity_score: 0.0,
        };

        // Sauvegarder en base de données
        sqlx::query(
            "INSERT INTO curated_playlists (
                id, name, description, category, mood_tags, track_count,
                total_duration_minutes, cover_image_url, is_premium, tracks,
                created_by, popularity_score, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())",
        )
        .bind(&playlist.id)
        .bind(&playlist.name)
        .bind(&playlist.description)
        .bind(&playlist.category)
        .bind(&playlist.mood_tags)
        .bind(playlist.track_count as i32)
        .bind(playlist.total_duration_minutes as i32)
        .bind(&playlist.cover_image_url)
        .bind(playlist.is_premium)
        .bind(&playlist.tracks)
        .bind(&playlist.created_by)
        .bind(playlist.popularity_score)
        .execute(self.pool.as_ref())
        .await
        .map_err(|e| {
            error!("[TrendingMusic] Erreur création playlist: {}", e);
            AppError::Database(e.to_string())
        })?;

        info!("[TrendingMusic] ✅ Playlist créée: {}", playlist.name);

        Ok(playlist)
    }
}
