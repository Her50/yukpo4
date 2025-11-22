use std::{path::PathBuf, sync::Arc};

use log::{error, info};
use serde::Serialize;
use sqlx::FromRow;
use tokio::io::AsyncWriteExt;
use uuid::Uuid;

use crate::{
    core::types::{AppError, AppResult},
    middlewares::jwt::AuthenticatedUser,
    state::AppState,
};

#[derive(FromRow)]
struct ServiceUserIdRow {
    user_id: i32,
}

#[derive(FromRow)]
struct MediaIdRow {
    id: i32,
}

#[derive(Debug, Serialize, Clone)]
pub struct CuratedAudioLoop {
    pub id: &'static str,
    pub title: &'static str,
    pub genre: &'static str,
    pub mood: &'static str,
    pub bpm: u16,
    pub url: &'static str,
    pub license: &'static str,
}

const AUDIO_LIBRARY: &[CuratedAudioLoop] = &[
    CuratedAudioLoop {
        id: "pulse_groove",
        title: "Pulse Groove 120",
        genre: "Electro Pop",
        mood: "Énergique",
        bpm: 120,
        url: "https://cdn.yukpomnang.com/audio/pulse_groove_120.mp3",
        license: "CC-BY 4.0",
    },
    CuratedAudioLoop {
        id: "lofi_sunset",
        title: "Lofi Sunset 80",
        genre: "Lofi",
        mood: "Relax",
        bpm: 80,
        url: "https://cdn.yukpomnang.com/audio/lofi_sunset_80.mp3",
        license: "CC-BY 4.0",
    },
    CuratedAudioLoop {
        id: "ambient_wave",
        title: "Ambient Wave 95",
        genre: "Ambient",
        mood: "Aérien",
        bpm: 95,
        url: "https://cdn.yukpomnang.com/audio/ambient_wave_95.mp3",
        license: "CC-BY 4.0",
    },
    CuratedAudioLoop {
        id: "cinematic_rise",
        title: "Cinematic Rise 100",
        genre: "Cinematic",
        mood: "Épique",
        bpm: 100,
        url: "https://cdn.yukpomnang.com/audio/cinematic_rise_100.mp3",
        license: "CC0",
    },
];

pub fn list_curated_audio_loops() -> &'static [CuratedAudioLoop] {
    AUDIO_LIBRARY
}

pub async fn attach_loop_to_service(
    state: Arc<AppState>,
    user: &AuthenticatedUser,
    service_id: i32,
    loop_id: &str,
) -> AppResult<i32> {
    let service_owner: Option<ServiceUserIdRow> = sqlx::query_as(
        "SELECT user_id FROM services WHERE id = $1"
    )
    .bind(service_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(AppError::from)?;
    
    let service_owner = service_owner
        .ok_or_else(|| AppError::NotFound("Service introuvable".to_string()))?
        .user_id;

    if service_owner != user.id {
        return Err(AppError::Unauthorized(
            "Accès interdit à ce service".to_string(),
        ));
    }

    let audio_loop = AUDIO_LIBRARY
        .iter()
        .find(|loop_item| loop_item.id == loop_id)
        .ok_or_else(|| AppError::NotFound("Boucle audio introuvable".to_string()))?;

    let response = reqwest::get(audio_loop.url).await.map_err(|err| {
        AppError::Internal(format!("Impossible de télécharger la boucle audio: {err}"))
    })?;

    if !response.status().is_success() {
        return Err(AppError::Internal(format!(
            "Téléchargement boucle audio impossible: statut {}",
            response.status()
        )));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|err| AppError::Internal(format!("Erreur lecture boucle audio: {err}")))?;

    let file_extension = audio_loop.url.rsplit('.').next().unwrap_or("mp3");

    let filename = format!(
        "audio_loop_{}_{}.{}",
        loop_id,
        Uuid::new_v4(),
        file_extension
    );
    let relative_path = PathBuf::from("uploads").join("services").join(&filename);
    let absolute_path = std::env::current_dir()
        .map_err(|err| {
            AppError::Internal(format!("Impossible d'obtenir le dossier courant: {err}"))
        })?
        .join(&relative_path);

    if let Some(parent) = absolute_path.parent() {
        tokio::fs::create_dir_all(parent).await.map_err(|err| {
            AppError::Internal(format!("Impossible de créer le dossier audio: {err}"))
        })?;
    }

    let mut file = tokio::fs::File::create(&absolute_path)
        .await
        .map_err(|err| {
            AppError::Internal(format!("Impossible de créer le fichier audio: {err}"))
        })?;
    file.write_all(&bytes).await.map_err(|err| {
        AppError::Internal(format!("Impossible d'écrire le fichier audio: {err}"))
    })?;

    let normalized_path = relative_path.to_string_lossy().replace('\\', "/");

    let inserted: MediaIdRow = sqlx::query_as(
        "INSERT INTO media (
            service_id,
            type,
            media_type,
            path,
            file_size,
            file_format,
            ai_description,
            ai_tags,
            uploaded_at
        )
        VALUES ($1, 'audio', 'audio', $2, $3, $4, $5, $6, NOW())
        RETURNING id"
    )
    .bind(service_id)
    .bind(&normalized_path)
    .bind(bytes.len() as i64)
    .bind(file_extension)
    .bind(format!("Boucle audio: {} ({})", audio_loop.title, audio_loop.genre))
    .bind(&vec![
        "audio".to_string(),
        audio_loop.genre.to_string(),
        audio_loop.mood.to_string()
    ])
    .fetch_one(&state.pg)
    .await
    .map_err(|err| {
        error!(
            "[AudioLibrary] Erreur insertion média audio service_id={} loop_id={}: {:?}",
            service_id, loop_id, err
        );
        AppError::from(err)
    })?;

    info!(
        "[AudioLibrary] Boucle {} attachée au service {} (media_id={})",
        loop_id, service_id, inserted.id
    );

    Ok(inserted.id)
}
