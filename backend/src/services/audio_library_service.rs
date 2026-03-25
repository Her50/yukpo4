use std::{path::PathBuf, sync::Arc};

use log::{error, info, warn};
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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub url: Option<String>, // ✅ Modifié pour être dynamique
    pub audio_path: &'static str, // ✅ Chemin relatif du fichier audio
    pub license: &'static str,
}

const AUDIO_LIBRARY: &[CuratedAudioLoop] = &[
    CuratedAudioLoop {
        id: "pulse_groove",
        title: "Pulse Groove 120",
        genre: "Electro Pop",
        mood: "Énergique",
        bpm: 120,
        url: None, // ✅ Sera construit dynamiquement
        audio_path: "audio/pulse_groove_120.mp3",
        // ⚠️ AWS/Cloudflare (ancien, commenté pour utilisation future)
        // audio_path: "https://cdn.yukpomnang.com/audio/pulse_groove_120.mp3",
        license: "CC-BY 4.0",
    },
    CuratedAudioLoop {
        id: "lofi_sunset",
        title: "Lofi Sunset 80",
        genre: "Lofi",
        mood: "Relax",
        bpm: 80,
        url: None, // ✅ Sera construit dynamiquement
        audio_path: "audio/lofi_sunset_80.mp3",
        // ⚠️ AWS/Cloudflare (ancien, commenté pour utilisation future)
        // audio_path: "https://cdn.yukpomnang.com/audio/lofi_sunset_80.mp3",
        license: "CC-BY 4.0",
    },
    CuratedAudioLoop {
        id: "ambient_wave",
        title: "Ambient Wave 95",
        genre: "Ambient",
        mood: "Aérien",
        bpm: 95,
        url: None, // ✅ Sera construit dynamiquement
        audio_path: "audio/ambient_wave_95.mp3",
        // ⚠️ AWS/Cloudflare (ancien, commenté pour utilisation future)
        // audio_path: "https://cdn.yukpomnang.com/audio/ambient_wave_95.mp3",
        license: "CC-BY 4.0",
    },
    CuratedAudioLoop {
        id: "cinematic_rise",
        title: "Cinematic Rise 100",
        genre: "Cinematic",
        mood: "Épique",
        bpm: 100,
        url: None, // ✅ Sera construit dynamiquement
        audio_path: "audio/cinematic_rise_100.mp3",
        // ⚠️ AWS/Cloudflare (ancien, commenté pour utilisation future)
        // audio_path: "https://cdn.yukpomnang.com/audio/cinematic_rise_100.mp3",
        license: "CC0",
    },
];

/// ✅ 2026-02-14: Construit l'URL complète depuis le chemin relatif
/// Utilise PUBLIC_BASE_URL ou UPLOAD_BASE_URL (GCP Cloud CDN)
pub fn build_audio_url(audio_path: &str) -> String {
    let base_url = std::env::var("PUBLIC_BASE_URL")
        .or_else(|_| std::env::var("UPLOAD_BASE_URL"))
        .unwrap_or_else(|_| "http://34.54.117.97".to_string()); // ✅ GCP Cloud CDN par défaut

    format!(
        "{}/{}",
        base_url.trim_end_matches('/'),
        audio_path.trim_start_matches('/')
    )
}

/// ✅ Obtient l'URL complète d'une boucle audio
pub fn get_audio_loop_url(loop_item: &CuratedAudioLoop) -> String {
    loop_item.url.clone().unwrap_or_else(|| build_audio_url(loop_item.audio_path))
}

/// ✅ Retourne les boucles audio avec URLs construites dynamiquement
pub fn list_curated_audio_loops() -> Vec<CuratedAudioLoop> {
    AUDIO_LIBRARY
        .iter()
        .map(|loop_item| {
            let mut loop_clone = loop_item.clone();
            loop_clone.url = Some(build_audio_url(loop_item.audio_path));
            loop_clone
        })
        .collect()
}

/// Fichiers locaux à essayer si le CDN / HTTP échoue (ordre de priorité).
/// Doit rester aligné avec `audio_path` dans `AUDIO_LIBRARY` (ex. `audio/pulse_groove_120.mp3`),
/// pas seulement `{loop_id}.mp3`.
fn local_audio_file_candidates(audio_loop: &CuratedAudioLoop) -> Vec<PathBuf> {
    let rel = PathBuf::from(audio_loop.audio_path.trim_start_matches('/'));
    vec![
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("assets").join(&rel),
        PathBuf::from("assets").join(&rel),
        PathBuf::from("assets/audio").join(format!("{}.mp3", audio_loop.id)),
    ]
}

pub async fn attach_loop_to_service(
    state: Arc<AppState>,
    user: &AuthenticatedUser,
    service_id: i32,
    loop_id: &str,
) -> AppResult<i32> {
    let service_owner: Option<ServiceUserIdRow> =
        sqlx::query_as("SELECT user_id FROM services WHERE id = $1")
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

    // ✅ Construire l'URL complète depuis le chemin relatif
    let audio_url = build_audio_url(audio_loop.audio_path);

    // ✅ CORRECTION À LA SOURCE: Retry avec timeout et fallback vers stockage local si CDN inaccessible
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|err| AppError::Internal(format!("Impossible de créer le client HTTP: {err}")))?;

    let mut last_error = None;
    let mut response = None;
    let mut is_dns_error = false;

    // Tentative avec retry (3 tentatives)
    for attempt in 1..=3 {
        match client.get(&audio_url).send().await {
            Ok(resp) => {
                if resp.status().is_success() {
                    response = Some(resp);
                    break;
                } else {
                    last_error = Some(format!(
                        "Statut HTTP {} lors du téléchargement",
                        resp.status()
                    ));
                    if attempt < 3 {
                        info!(
                            "[AudioLibrary] Tentative {}/3 échouée (statut {}), retry...",
                            attempt,
                            resp.status()
                        );
                        tokio::time::sleep(std::time::Duration::from_millis(500 * attempt as u64))
                            .await;
                    }
                }
            }
            Err(err) => {
                let error_msg = err.to_string();
                last_error = Some(error_msg.clone());

                // Vérifier si c'est une erreur DNS
                if error_msg.contains("dns error")
                    || error_msg.contains("failed to lookup")
                    || error_msg.contains("Name or service not known")
                {
                    is_dns_error = true;
                    warn!(
                        "[AudioLibrary] Erreur DNS pour {}: {}. Tentative fallback local...",
                        audio_url, error_msg
                    );
                    break; // Sortir de la boucle pour essayer le fallback
                }

                if attempt < 3 {
                    info!(
                        "[AudioLibrary] Tentative {}/3 échouée ({}), retry...",
                        attempt, error_msg
                    );
                    tokio::time::sleep(std::time::Duration::from_millis(500 * attempt as u64))
                        .await;
                }
            }
        }
    }

    // ✅ Fallback local si CDN indisponible (DNS, timeout, 5xx, 404 après retries, etc.)
    let bytes = if is_dns_error || response.is_none() {
        let mut loaded: Option<(PathBuf, Vec<u8>)> = None;
        for candidate in local_audio_file_candidates(audio_loop) {
            if candidate.exists() {
                match tokio::fs::read(&candidate).await {
                    Ok(b) if !b.is_empty() => {
                        info!(
                            "[AudioLibrary] Utilisation du fichier audio local: {}",
                            candidate.display()
                        );
                        loaded = Some((candidate, b));
                        break;
                    }
                    Ok(_) => {
                        warn!(
                            "[AudioLibrary] Fichier local vide, ignoré: {}",
                            candidate.display()
                        );
                    }
                    Err(err) => {
                        warn!(
                            "[AudioLibrary] Lecture locale échouée pour {}: {}",
                            candidate.display(),
                            err
                        );
                    }
                }
            }
        }

        if let Some((_path, bytes)) = loaded {
            bytes
        } else {
            let tried: Vec<String> = local_audio_file_candidates(audio_loop)
                .iter()
                .map(|p| p.display().to_string())
                .collect();
            error!(
                "[AudioLibrary] HTTP indisponible et aucun fichier local valide. service_id={} loop_id={} essayé: {:?}",
                service_id, loop_id, tried
            );
            warn!(
                "[AudioLibrary] Déposez une copie sous le crate backend, par ex. {} (voir audio_path dans AUDIO_LIBRARY), ou corrigez PUBLIC_BASE_URL / UPLOAD_BASE_URL.",
                PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                    .join("assets")
                    .join(audio_loop.audio_path.trim_start_matches('/'))
                    .display()
            );
            return Err(AppError::BadRequest(format!(
                "Boucle audio « {} » indisponible : téléchargement impossible et aucun fichier local trouvé (chemins essayés : {}).",
                audio_loop.title,
                tried.join(", ")
            )));
        }
    } else {
        let response = response.ok_or_else(|| {
            AppError::Internal(format!(
                "Impossible de télécharger la boucle audio après 3 tentatives: {}",
                last_error.unwrap_or_else(|| "Erreur inconnue".to_string())
            ))
        })?;

        response
            .bytes()
            .await
            .map_err(|err| AppError::Internal(format!("Erreur lecture boucle audio: {err}")))?
            .to_vec()
    };

    let file_extension = audio_loop.audio_path.rsplit('.').next().unwrap_or("mp3");

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

    let mut file = tokio::fs::File::create(&absolute_path).await.map_err(|err| {
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
        RETURNING id",
    )
    .bind(service_id)
    .bind(&normalized_path)
    .bind(bytes.len() as i64)
    .bind(file_extension)
    .bind(format!(
        "Boucle audio: {} ({})",
        audio_loop.title, audio_loop.genre
    ))
    .bind(&vec![
        "audio".to_string(),
        audio_loop.genre.to_string(),
        audio_loop.mood.to_string(),
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
