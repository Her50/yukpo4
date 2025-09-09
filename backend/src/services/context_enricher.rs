use chrono::Utc;
use serde_json::{json, Value};
use std::fs::{create_dir_all, read_to_string, write, File};
use std::io::Write;
use std::path::Path;
use uuid::Uuid;
use axum::extract::Multipart;
use base64::{engine::general_purpose, Engine as _}; // ? Import corrig?

use crate::core::types::AppResult;

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

    // Traitement de chaque champ du formulaire multipart
    while let Some(field) = multipart.next_field().await? {
        let name = field.name().unwrap_or("unknown").to_string();
        let file_name = field.file_name().unwrap_or("fichier").to_string();
        let ext = file_name.split('.').next_back().unwrap_or("bin").to_lowercase();
        let bytes = field.bytes().await?;

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
                    if let Some(tableurs) = context.get_mut("tableurs").and_then(|v| v.as_array_mut()) {
                        tableurs.push(fichier_json);
                    }
                } else if let Some(docs) = context.get_mut("documents").and_then(|v| v.as_array_mut()) {
                    docs.push(fichier_json);
                }
            }
        }
    }

    write(path, serde_json::to_string_pretty(&context)?)?;
    Ok(())
}
