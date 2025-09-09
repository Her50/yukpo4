// ?? src/services/multimodal_enricher.rs
// Remplacement automatique des r?f?rences multimodales (images, audio, vid?o, fichiers, etc.) par les vraies donn?es (base64 ou contenu r?el)
use serde_json::Value;
use std::fs;
use std::collections::HashMap;
use base64::Engine; // Pour .encode()

/// Remplace r?cursivement toutes les r?f?rences multimodales (xxx_etiquette, audio_etiquette, etc.) par leur contenu r?el (base64 ou fichier)
pub fn enrichir_multimodalites(json: &mut Value, dossier_uploads: &str) {
    if let Some(obj) = json.as_object_mut() {
        let mut remplacements: HashMap<String, Value> = HashMap::new();
        let keys: Vec<String> = obj.keys().cloned().collect();
        for k in keys {
            if let Some(v) = obj.get(&k) {
                // Si le champ est une ?tiquette multimodale (ex: image_etiquette, audio_etiquette, doc_etiquette...)
                if k.ends_with("_etiquette") {
                    if let Some(etiquette) = v.as_str() {
                        // Essayer plusieurs extensions de fichiers
                        let extensions = [".bin", ".jpg", ".jpeg", ".png", ".gif", ".mp3", ".wav", ".mp4", ".avi", ".pdf", ".doc", ".docx", ".txt"];
                        let mut fichier_trouve = false;
                        
                        for ext in &extensions {
                            let chemin = format!("{}/{}{}", dossier_uploads.trim_end_matches('/'), etiquette, ext);
                            if let Ok(bytes) = fs::read(&chemin) {
                                let base64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
                                let nouveau_nom = k.trim_end_matches("_etiquette").to_string();
                                remplacements.insert(nouveau_nom, Value::String(base64));
                                fichier_trouve = true;
                                break;
                            }
                        }
                        
                        // Si aucun fichier trouv?, essayer sans extension
                        if !fichier_trouve {
                            let chemin = format!("{}/{}", dossier_uploads.trim_end_matches('/'), etiquette);
                            if let Ok(bytes) = fs::read(&chemin) {
                                let base64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
                                let nouveau_nom = k.trim_end_matches("_etiquette").to_string();
                                remplacements.insert(nouveau_nom, Value::String(base64));
                            }
                        }
                    }
                } else if v.is_object() || v.is_array() {
                    // R?cursion sur les objets/arrays imbriqu?s
                    if let Some(child) = obj.get_mut(&k) {
                        enrichir_multimodalites(child, dossier_uploads);
                    }
                }
            }
        }
        // Appliquer les remplacements
        for (k, v) in remplacements {
            obj.insert(k, v);
        }
    } else if let Some(arr) = json.as_array_mut() {
        for v in arr.iter_mut() {
            enrichir_multimodalites(v, dossier_uploads);
        }
    }
}
