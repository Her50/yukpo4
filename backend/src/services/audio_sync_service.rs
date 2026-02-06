// ✅ NOUVEAU Phase 10: Service de synchronisation audio-vidéo avec IA
// Synchronise automatiquement l'audio avec la vidéo (lip-sync, beat sync, etc.)

use crate::core::types::{AppError, AppResult};
use crate::services::app_ia::{extract_json_block, AppIA};
use log::{error, info};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::Arc;
use tokio::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioSyncRequest {
    pub video_url: String,
    pub audio_url: Option<String>, // Audio à synchroniser (optionnel, peut être extrait de la vidéo)
    pub sync_type: AudioSyncType,
    pub target_accuracy: Option<f64>, // secondes, défaut: 0.1
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum AudioSyncType {
    LipSync,  // Synchronisation labiale (parole)
    BeatSync, // Synchronisation sur les beats musicaux
    Auto,     // Détection automatique du type
    Manual,   // Ajustement manuel avec suggestions IA
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioSyncResponse {
    pub success: bool,
    pub sync_offset: f64, // Décalage en secondes (positif = audio en avance, négatif = audio en retard)
    pub confidence: f64,  // 0.0-1.0
    pub sync_type_detected: AudioSyncType,
    pub adjustments: Vec<SyncAdjustment>,
    pub synced_video_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncAdjustment {
    pub timestamp: f64,  // Temps dans la vidéo
    pub offset: f64,     // Ajustement nécessaire
    pub reason: String,  // Raison de l'ajustement
    pub confidence: f64, // 0.0-1.0
}

/// ✅ NOUVEAU Phase 10: Synchronise l'audio avec la vidéo en utilisant IA
pub async fn sync_audio_video(
    request: AudioSyncRequest,
    app_ia: Arc<AppIA>,
) -> AppResult<AudioSyncResponse> {
    info!(
        "[AudioSync] Synchronisation audio-vidéo - video_url: {}, sync_type: {:?}",
        request.video_url, request.sync_type
    );

    let target_accuracy = request.target_accuracy.unwrap_or(0.1);

    // 1. Extraire métadonnées audio/vidéo avec FFprobe
    let video_metadata = extract_video_metadata(&request.video_url).await?;
    let audio_metadata = if let Some(audio_url) = &request.audio_url {
        extract_audio_metadata(audio_url).await?
    } else {
        extract_audio_from_video(&request.video_url).await?
    };

    // 2. Détecter le type de synchronisation si Auto
    let sync_type = if request.sync_type == AudioSyncType::Auto {
        detect_sync_type(&request.video_url, &app_ia).await?
    } else {
        request.sync_type
    };

    // 3. Analyser avec IA pour trouver le meilleur décalage
    let sync_analysis = analyze_sync_with_ia(
        &request.video_url,
        &sync_type,
        &video_metadata,
        &audio_metadata,
        target_accuracy,
        &app_ia,
    )
    .await?;

    // 4. Appliquer la synchronisation
    let synced_video_url = if sync_analysis.sync_offset.abs() > target_accuracy {
        apply_sync_adjustment(
            &request.video_url,
            request.audio_url.as_deref(),
            sync_analysis.sync_offset,
        )
        .await?
    } else {
        None // Pas besoin d'ajustement
    };

    Ok(AudioSyncResponse {
        success: true,
        sync_offset: sync_analysis.sync_offset,
        confidence: sync_analysis.confidence,
        sync_type_detected: sync_type,
        adjustments: sync_analysis.adjustments,
        synced_video_url,
    })
}

/// Extrait les métadonnées vidéo
async fn extract_video_metadata(video_url: &str) -> AppResult<Value> {
    let output = Command::new("ffprobe")
        .args(&[
            "-v",
            "error",
            "-show_entries",
            "format=duration,bit_rate",
            "-show_entries",
            "stream=codec_name,codec_type",
            "-of",
            "json",
            video_url,
        ])
        .output()
        .await
        .map_err(|e| AppError::Internal(format!("Erreur ffprobe vidéo: {}", e)))?;

    let metadata: Value = serde_json::from_slice(&output.stdout)
        .map_err(|e| AppError::Internal(format!("Erreur parsing métadonnées: {}", e)))?;

    Ok(metadata)
}

/// Extrait les métadonnées audio
async fn extract_audio_metadata(audio_url: &str) -> AppResult<Value> {
    let output = Command::new("ffprobe")
        .args(&[
            "-v",
            "error",
            "-show_entries",
            "format=duration,bit_rate",
            "-show_entries",
            "stream=codec_name,sample_rate",
            "-of",
            "json",
            audio_url,
        ])
        .output()
        .await
        .map_err(|e| AppError::Internal(format!("Erreur ffprobe audio: {}", e)))?;

    let metadata: Value = serde_json::from_slice(&output.stdout)
        .map_err(|e| AppError::Internal(format!("Erreur parsing métadonnées: {}", e)))?;

    Ok(metadata)
}

/// Extrait l'audio de la vidéo
async fn extract_audio_from_video(video_url: &str) -> AppResult<Value> {
    extract_audio_metadata(video_url).await
}

/// Détecte le type de synchronisation avec IA
async fn detect_sync_type(video_url: &str, app_ia: &Arc<AppIA>) -> AppResult<AudioSyncType> {
    let prompt = format!(
        r#"Tu es un expert en synchronisation audio-vidéo pour Yukpo.

OBJECTIF: Analyser une vidéo et déterminer le type de synchronisation nécessaire.

CONTEXTE:
- URL vidéo: {}

TYPES POSSIBLES:
- lip_sync: Vidéo avec parole (synchronisation labiale requise)
- beat_sync: Vidéo avec musique (synchronisation sur les beats)
- manual: Synchronisation complexe nécessitant ajustements manuels

IMPORTANT: Réponds UNIQUEMENT avec un JSON valide, SANS markdown.

Format JSON strict:
{{
    "sync_type": "lip_sync|beat_sync|manual",
    "confidence": 0.95,
    "reason": "Explication du choix"
}}

Réponds SEULEMENT le JSON, rien d'autre."#,
        video_url
    );

    let (_, response, _) = app_ia.predict(&prompt).await?;
    let json_block = extract_json_block(&response)
        .ok_or_else(|| AppError::Internal("JSON manquant dans réponse IA".to_string()))?;

    let parsed: Value = serde_json::from_str(&json_block)
        .map_err(|e| AppError::Internal(format!("JSON malformé: {}", e)))?;

    let sync_type_str = parsed.get("sync_type").and_then(|v| v.as_str()).unwrap_or("auto");

    let sync_type = match sync_type_str {
        "lip_sync" => AudioSyncType::LipSync,
        "beat_sync" => AudioSyncType::BeatSync,
        "manual" => AudioSyncType::Manual,
        _ => AudioSyncType::Auto,
    };

    Ok(sync_type)
}

/// Analyse la synchronisation avec IA
async fn analyze_sync_with_ia(
    _video_url: &str,
    sync_type: &AudioSyncType,
    video_metadata: &Value,
    audio_metadata: &Value,
    target_accuracy: f64,
    app_ia: &Arc<AppIA>,
) -> AppResult<AudioSyncResponse> {
    let sync_type_str = match sync_type {
        AudioSyncType::LipSync => "synchronisation labiale (parole)",
        AudioSyncType::BeatSync => "synchronisation sur les beats musicaux",
        AudioSyncType::Manual => "synchronisation manuelle avec ajustements",
        AudioSyncType::Auto => "synchronisation automatique",
    };

    let prompt = format!(
        r#"Tu es un expert en synchronisation audio-vidéo professionnel pour Yukpo.

OBJECTIF: Analyser et proposer le meilleur décalage pour synchroniser l'audio avec la vidéo.

CONTEXTE:
- Type de sync: {}
- Précision cible: {} secondes
- Métadonnées vidéo: {}
- Métadonnées audio: {}

INSTRUCTIONS:
1. Analyse le décalage optimal entre audio et vidéo
2. Propose des ajustements précis par segment si nécessaire
3. Indique la confiance de chaque ajustement
4. Explique la raison de chaque ajustement

IMPORTANT: Réponds UNIQUEMENT avec un JSON valide, SANS markdown.

Format JSON strict:
{{
    "sync_offset": 0.15,
    "confidence": 0.92,
    "adjustments": [
        {{
            "timestamp": 0.0,
            "offset": 0.15,
            "reason": "Décalage initial détecté",
            "confidence": 0.95
        }},
        {{
            "timestamp": 30.5,
            "offset": 0.05,
            "reason": "Ajustement fin nécessaire",
            "confidence": 0.80
        }}
    ]
}}

Réponds SEULEMENT le JSON, rien d'autre."#,
        sync_type_str,
        target_accuracy,
        serde_json::to_string(video_metadata).unwrap_or_default(),
        serde_json::to_string(audio_metadata).unwrap_or_default()
    );

    let (_, response, _) = app_ia.predict(&prompt).await?;
    let json_block = extract_json_block(&response)
        .ok_or_else(|| AppError::Internal("JSON manquant dans réponse IA".to_string()))?;

    let parsed: Value = serde_json::from_str(&json_block)
        .map_err(|e| AppError::Internal(format!("JSON malformé: {}", e)))?;

    let sync_offset = parsed.get("sync_offset").and_then(|v| v.as_f64()).unwrap_or(0.0);

    let confidence = parsed.get("confidence").and_then(|v| v.as_f64()).unwrap_or(0.8);

    let empty_vec: Vec<serde_json::Value> = vec![];
    let adjustments_array =
        parsed.get("adjustments").and_then(|a| a.as_array()).unwrap_or(&empty_vec);

    let mut adjustments = Vec::new();
    for adj_json in adjustments_array {
        adjustments.push(SyncAdjustment {
            timestamp: adj_json.get("timestamp").and_then(|v| v.as_f64()).unwrap_or(0.0),
            offset: adj_json.get("offset").and_then(|v| v.as_f64()).unwrap_or(0.0),
            reason: adj_json
                .get("reason")
                .and_then(|v| v.as_str())
                .unwrap_or("Ajustement")
                .to_string(),
            confidence: adj_json.get("confidence").and_then(|v| v.as_f64()).unwrap_or(0.8),
        });
    }

    Ok(AudioSyncResponse {
        success: true,
        sync_offset,
        confidence,
        sync_type_detected: sync_type.clone(),
        adjustments,
        synced_video_url: None, // Sera rempli par apply_sync_adjustment
    })
}

/// Applique l'ajustement de synchronisation avec FFmpeg
async fn apply_sync_adjustment(
    video_url: &str,
    audio_url: Option<&str>,
    offset: f64,
) -> AppResult<Option<String>> {
    info!("[AudioSync] Application ajustement: {} secondes", offset);

    let output_path = format!("{}_synced.mp4", video_url);

    let mut cmd = Command::new("ffmpeg");
    cmd.arg("-y").arg("-i").arg(video_url);

    if let Some(audio) = audio_url {
        cmd.arg("-i").arg(audio);
    }

    // Ajuster le décalage audio
    if offset.abs() > 0.01 {
        if offset > 0.0 {
            // Audio en avance, le retarder
            cmd.arg("-itsoffset").arg(format!("{}", offset));
        } else {
            // Audio en retard, l'avancer (nécessite réencodage)
            cmd.arg("-af").arg(format!("adelay={}S", (-offset * 1000.0) as i64));
        }
    }

    cmd.arg("-c:v").arg("copy"); // Copier vidéo sans réencodage
    cmd.arg("-c:a").arg("aac");
    cmd.arg(&output_path);

    let output = cmd.output().await.map_err(|e| {
        error!("[AudioSync] Erreur FFmpeg: {}", e);
        AppError::Internal(format!("Erreur synchronisation: {}", e))
    })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        error!("[AudioSync] FFmpeg échoué: {}", stderr);
        return Err(AppError::Internal(format!(
            "Erreur synchronisation: {}",
            stderr
        )));
    }

    info!("[AudioSync] Synchronisation appliquée: {}", output_path);
    Ok(Some(output_path))
}
