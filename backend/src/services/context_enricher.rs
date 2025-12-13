use axum::extract::Multipart;
use base64::{engine::general_purpose, Engine as _};
use chrono::Utc;
use serde_json::{json, Value};
use std::env;
use std::fs::{create_dir_all, read_to_string, write, File};
use std::io::Write;
use std::path::Path;
use uuid::Uuid; // ? Import corrig?

use crate::core::types::AppResult;

// ✅ NOUVEAU: Limites de taille de fichiers pour éviter les problèmes de mémoire
const DEFAULT_MAX_IMAGE_SIZE: usize = 10 * 1024 * 1024; // 10 MB
const DEFAULT_MAX_AUDIO_SIZE: usize = 10 * 1024 * 1024; // 10 MB
const DEFAULT_MAX_VIDEO_SIZE: usize = 50 * 1024 * 1024; // 50 MB
const DEFAULT_MAX_EXCEL_SIZE: usize = 5 * 1024 * 1024; // 5 MB

fn get_max_file_size(file_type: &str) -> usize {
    let env_key = format!("MAX_{}_SIZE_MB", file_type.to_uppercase());
    env::var(&env_key)
        .ok()
        .and_then(|v| v.parse::<usize>().ok())
        .map(|mb| mb * 1024 * 1024)
        .unwrap_or_else(|| match file_type {
            "IMAGE" => DEFAULT_MAX_IMAGE_SIZE,
            "AUDIO" => DEFAULT_MAX_AUDIO_SIZE,
            "VIDEO" => DEFAULT_MAX_VIDEO_SIZE,
            "EXCEL" => DEFAULT_MAX_EXCEL_SIZE,
            _ => DEFAULT_MAX_IMAGE_SIZE,
        })
}

/// ?? Enrichit input_context.json avec champs texte + fichiers (Excel isol?)
pub async fn enrichir_input_context(mut multipart: Multipart) -> AppResult<()> {
    let path = "data/input_context.json";
    let upload_dir = "data/uploads/";
    create_dir_all(upload_dir)?; // ? Cr?e le dossier si non existant

    // Charge ou initialise la structure JSON
    let mut context: Value = if Path::new(path).exists() {
        serde_json::from_str(&read_to_string(path)?)?
    } else {
        json!({
            "texte_libre": null,
            "audio_base64": null,
            "video_base64": null,
            "gps_mobile": null,
            "images": [],
            "langue_preferee": null,
            "documents": [],
            "tableurs": []
        })
    };

    // ✅ OPTIMISÉ: Limites de taille pour éviter les problèmes de mémoire
    let max_image_size = get_max_file_size("IMAGE");
    let max_audio_size = get_max_file_size("AUDIO");
    let max_video_size = get_max_file_size("VIDEO");
    let max_excel_size = get_max_file_size("EXCEL");

    // Traitement de chaque champ du formulaire multipart
    while let Some(field) = multipart.next_field().await? {
        let name = field.name().unwrap_or("unknown").to_string();
        let file_name = field.file_name().unwrap_or("fichier").to_string();
        let ext = file_name
            .split('.')
            .next_back()
            .unwrap_or("bin")
            .to_lowercase();
        let bytes = field.bytes().await?;

        // ✅ NOUVEAU: Validation de taille avant traitement
        let file_size = bytes.len();
        let max_size = match name.as_str() {
            "image" => max_image_size,
            "audio" => max_audio_size,
            "video" => max_video_size,
            _ if ext == "xls" || ext == "xlsx" => max_excel_size,
            _ => 10 * 1024 * 1024, // 10 MB par défaut pour autres fichiers
        };

        if file_size > max_size {
            log::warn!(
                "[context_enricher] ⚠️ Fichier {} rejeté: {} MB > {} MB max",
                file_name,
                file_size / 1024 / 1024,
                max_size / 1024 / 1024
            );
            continue; // Ignorer le fichier trop volumineux
        }

        match name.as_str() {
            "texte" => {
                let texte = String::from_utf8(bytes.to_vec()).unwrap_or_default();
                context["texte_libre"] = json!(texte);
            }
            "audio" => {
                let audio = general_purpose::STANDARD.encode(&bytes);
                context["audio_base64"] = json!(audio);
            }
            "video" => {
                let video = general_purpose::STANDARD.encode(&bytes);
                context["video_base64"] = json!(video);
            }
            "image" => {
                let image = general_purpose::STANDARD.encode(&bytes);
                if let Some(images) = context.get_mut("images").and_then(|v| v.as_array_mut()) {
                    images.push(json!(image));
                }
            }
            _ => {
                // Cas des documents et fichiers
                let uuid_path = format!("{}{}.{}", upload_dir, Uuid::new_v4(), ext);
                let mut file = File::create(&uuid_path)?;
                file.write_all(&bytes)?;

                let fichier_json = json!({
                    "timestamp": Utc::now().to_rfc3339(),
                    "nom": file_name,
                    "extension": ext,
                    "chemin": uuid_path
                });

                if ext == "xls" || ext == "xlsx" {
                    if let Some(tableurs) =
                        context.get_mut("tableurs").and_then(|v| v.as_array_mut())
                    {
                        tableurs.push(fichier_json);
                    }
                } else if let Some(docs) =
                    context.get_mut("documents").and_then(|v| v.as_array_mut())
                {
                    docs.push(fichier_json);
                }
            }
        }
    }

    write(path, serde_json::to_string_pretty(&context)?)?;
    Ok(())
}
