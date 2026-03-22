//! Enrichissement de la réponse `POST /ai/chat` : tableau `attachments` (et alias `generated_files`)
//! avec URLs publiques après stockage. Contrats supportés :
//! - Objets avec `inline_base64` + `filename` / `mime_type` (remplacés par `url`, `id`, etc.)
//! - Tableau optionnel `tool_outputs` avec le même schéma (supprimé de la réponse après traitement)
//! - Fonction utilitaire pour les outils Rust : [`upload_chat_attachment_blob`]

use std::sync::Arc;

use base64::Engine;
use log::{info, warn};
use serde_json::{json, Value};
use uuid::Uuid;

use crate::state::AppState;

const MAX_INLINE_BYTES: usize = 15 * 1024 * 1024;

/// Upload des octets vers le stockage média et retourne l’objet attendu par le mobile.
pub async fn upload_chat_attachment_blob(
    state: &Arc<AppState>,
    user_id: i32,
    bytes: &[u8],
    filename: &str,
    mime: &str,
) -> Result<Value, String> {
    if bytes.len() > MAX_INLINE_BYTES {
        return Err("fichier trop volumineux (max 15 Mo)".into());
    }
    let safe = sanitize_filename(filename);
    let key = format!("yukpo_ia/{}/{}_{}", user_id, Uuid::new_v4(), safe);
    let stored = state
        .media_storage
        .store_bytes(bytes, &key, Some(mime))
        .await
        .map_err(|e| e.to_string())?;
    let format = infer_format(filename, mime);
    let id = format!("yukpo-ia-{}", Uuid::new_v4());
    Ok(json!({
        "id": id,
        "url": stored.public_url,
        "filename": filename,
        "mime_type": mime,
        "format": format,
    }))
}

/// Fusionne des pièces jointes supplémentaires dans `attachments` (sans dupliquer vers `generated_files`
/// pour éviter les doublons côté client qui agrège déjà les deux clés).
pub fn merge_extra_attachments(body: &mut Value, extras: &[Value]) {
    if extras.is_empty() {
        return;
    }
    let Some(root) = body.as_object_mut() else {
        return;
    };
    let attachments = root.entry("attachments").or_insert_with(|| Value::Array(vec![]));
    if let Some(arr) = attachments.as_array_mut() {
        for v in extras {
            arr.push(v.clone());
        }
    }
}

/// Post-traitement principal : inline_base64 → URL, sorties d’outils, nettoyage.
pub async fn enrich_response_attachments(state: &Arc<AppState>, user_id: i32, body: &mut Value) {
    if let Err(e) = resolve_inline_arrays(state, user_id, body).await {
        warn!("[YukpoIA enrich] resolve inline: {}", e);
    }

    if let Ok(extra) = materialize_tool_outputs(state, user_id, body).await {
        if !extra.is_empty() {
            merge_extra_attachments(body, &extra);
        }
    }

    // Nettoyage : ne pas exposer de gros payloads résiduels
    if let Some(root) = body.as_object_mut() {
        root.remove("tool_outputs");
    }
}

async fn resolve_inline_arrays(
    state: &Arc<AppState>,
    user_id: i32,
    body: &mut Value,
) -> Result<(), String> {
    for key in ["attachments", "generated_files"] {
        if let Some(arr) = body.get_mut(key).and_then(|v| v.as_array_mut()) {
            resolve_inline_in_array(state, user_id, arr).await?;
        }
    }
    Ok(())
}

async fn resolve_inline_in_array(
    state: &Arc<AppState>,
    user_id: i32,
    arr: &mut Vec<Value>,
) -> Result<(), String> {
    use std::mem;

    let mut i = 0;
    while i < arr.len() {
        let mut item = mem::take(&mut arr[i]);
        let Some(obj) = item.as_object_mut() else {
            arr[i] = item;
            i += 1;
            continue;
        };
        if !obj.contains_key("inline_base64") {
            arr[i] = item;
            i += 1;
            continue;
        }

        let inline = obj
            .get("inline_base64")
            .and_then(|v| v.as_str())
            .ok_or_else(|| "inline_base64 invalide".to_string())?;

        let filename = obj
            .get("filename")
            .or_else(|| obj.get("name"))
            .and_then(|v| v.as_str())
            .unwrap_or("attachment.bin");

        let mime = obj
            .get("mime_type")
            .or_else(|| obj.get("mimeType"))
            .and_then(|v| v.as_str())
            .unwrap_or("application/octet-stream");

        let bytes = base64::engine::general_purpose::STANDARD
            .decode(inline.trim().as_bytes())
            .map_err(|e| format!("décodage base64: {e}"))?;

        if bytes.is_empty() {
            warn!("[YukpoIA enrich] inline_base64 vide, entrée ignorée");
            arr.remove(i);
            continue;
        }

        let id = obj
            .get("id")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| format!("att-{}", Uuid::new_v4()));

        match upload_chat_attachment_blob(state, user_id, &bytes, filename, mime).await {
            Ok(mut v) => {
                if let Some(o) = v.as_object_mut() {
                    o.insert("id".to_string(), json!(id));
                }
                arr[i] = v;
                info!(
                    "[YukpoIA enrich] inline → stockage user_id={} filename={}",
                    user_id, filename
                );
            }
            Err(e) => {
                warn!("[YukpoIA enrich] échec upload: {}", e);
                arr.remove(i);
                continue;
            }
        }
        i += 1;
    }
    Ok(())
}

/// `tool_outputs` : même schéma que les pièces jointes (souvent produit par un orchestrateur / fonction).
async fn materialize_tool_outputs(
    state: &Arc<AppState>,
    user_id: i32,
    body: &mut Value,
) -> Result<Vec<Value>, String> {
    let Some(raw) = body.get("tool_outputs").cloned() else {
        return Ok(vec![]);
    };
    let arr = raw.as_array().cloned().unwrap_or_default();

    let mut out = Vec::with_capacity(arr.len());
    for item in arr {
        let Some(obj) = item.as_object() else {
            continue;
        };
        if let Some(inline) = obj.get("inline_base64").and_then(|v| v.as_str()) {
            let filename = obj
                .get("filename")
                .or_else(|| obj.get("name"))
                .and_then(|v| v.as_str())
                .unwrap_or("tool-output.bin");
            let mime = obj
                .get("mime_type")
                .or_else(|| obj.get("mimeType"))
                .and_then(|v| v.as_str())
                .unwrap_or("application/octet-stream");
            let bytes = base64::engine::general_purpose::STANDARD
                .decode(inline.trim().as_bytes())
                .map_err(|e| format!("tool_outputs base64: {e}"))?;
            let id = obj.get("id").and_then(|v| v.as_str()).unwrap_or("tool");
            let mut v = upload_chat_attachment_blob(state, user_id, &bytes, filename, mime).await?;
            if let Some(o) = v.as_object_mut() {
                o.insert("id".to_string(), json!(id));
            }
            out.push(v);
            continue;
        }

        // Déjà une URL complète (outil externe)
        if let Some(url) = obj.get("url").and_then(|v| v.as_str()) {
            if url.starts_with("http://") || url.starts_with("https://") {
                out.push(item);
            }
        }
    }

    Ok(out)
}

fn sanitize_filename(name: &str) -> String {
    let base = name.rsplit('/').next().unwrap_or(name);
    let base = base.rsplit('\\').next().unwrap_or(base);
    let s: String = base
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '.' || *c == '-' || *c == '_')
        .take(180)
        .collect();
    let t = s.trim();
    if t.is_empty() {
        "file.bin".to_string()
    } else {
        t.to_string()
    }
}

fn infer_format(filename: &str, mime: &str) -> String {
    if let Some(idx) = filename.rfind('.') {
        let ext = filename[idx + 1..].to_lowercase();
        if !ext.is_empty() && ext.len() <= 8 {
            return ext;
        }
    }
    match mime {
        "text/csv" => "csv".into(),
        "text/markdown" | "text/x-markdown" => "md".into(),
        "application/pdf" => "pdf".into(),
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" => "xlsx".into(),
        _ => "bin".into(),
    }
}

#[cfg(test)]
mod tests {
    use super::sanitize_filename;

    #[test]
    fn sanitize_strips_path() {
        assert_eq!(sanitize_filename("foo/bar/baz.csv"), "baz.csv");
    }
}
