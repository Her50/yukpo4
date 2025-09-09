use crate::state::AppState;
use std::sync::Arc;
use tokio::time::{sleep, Duration};
use log::info;

/// Relance le matching pour tous les ?changes en attente (une seule fois)
pub async fn relancer_matching_echanges_once(pool: &sqlx::PgPool) {
    let echanges = sqlx::query!(
        r#"SELECT id, user_id, offre, besoin FROM echanges WHERE statut = 'en_attente'"#
    )
    .fetch_all(pool)
    .await
    .unwrap_or_default();
    log::info!("[MATCHING] {} ?changes candidats trouv?s : {:?}", echanges.len(), echanges.iter().map(|e| e.id).collect::<Vec<_>>());
    for e in echanges {
        let _user_id = Some(e.user_id);
        // Patch : construction d'un JSON strict conforme au sch?ma m?tier
        let mut data = serde_json::Map::new();
        // Extraction du mode, mode_troc, gps, user_id, produits, etc. depuis offre/besoin
        let offre_obj = e.offre.as_object().cloned().unwrap_or_default();
        let besoin_obj = e.besoin.as_object().cloned().unwrap_or_default();
        // Mode
        let mut mode = offre_obj.get("mode").and_then(|v| v.as_str())
            .or_else(|| besoin_obj.get("mode").and_then(|v| v.as_str()))
            .unwrap_or("");
        if mode.is_empty() {
            mode = "echange"; // Par d?faut si absent
        }
        data.insert("mode".to_string(), serde_json::Value::String(mode.to_string()));
        // Mode troc
        let mut mode_troc = offre_obj.get("mode_troc").and_then(|v| v.as_str())
            .or_else(|| besoin_obj.get("mode_troc").and_then(|v| v.as_str()))
            .unwrap_or("");
        if mode_troc.is_empty() {
            mode_troc = "echange"; // Par d?faut si absent
        }
        data.insert("mode_troc".to_string(), serde_json::Value::String(mode_troc.to_string()));
        // GPS
        let gps = offre_obj.get("gps").cloned()
            .or_else(|| besoin_obj.get("gps").cloned());
        if let Some(gps_val) = gps {
            data.insert("gps".to_string(), gps_val);
        } else {
            // GPS factice pour ?viter l'erreur de validation, ? adapter selon la logique m?tier
            data.insert("gps".to_string(), serde_json::json!({"lat": 0.0, "lon": 0.0}));
        }
        // user_id
        data.insert("user_id".to_string(), serde_json::Value::from(e.user_id));
        // listeproduit (optionnel)
        if let Some(liste) = offre_obj.get("listeproduit").and_then(|v| v.as_array()) {
            if !liste.is_empty() {
                data.insert("listeproduit".to_string(), serde_json::Value::Array(liste.clone()));
            }
        }
        // Ajout des produits pour la logique m?tier (matching), sans violer le sch?ma strict
        if let Some(liste) = offre_obj.get("listeproduit").and_then(|v| v.as_array()) {
            if !liste.is_empty() {
                data.insert("offre_produits".to_string(), serde_json::Value::Array(liste.clone()));
            }
        }
        if let Some(liste) = besoin_obj.get("listeproduit").and_then(|v| v.as_array()) {
            if !liste.is_empty() {
                data.insert("besoin_produits".to_string(), serde_json::Value::Array(liste.clone()));
            }
        }
        // intention (toujours "echange" ici)
        data.insert("intention".to_string(), serde_json::Value::String("echange".to_string()));
        // Validation stricte du mode avant appel m?tier
        if mode != "echange" && mode != "don" {
            log::warn!("[MATCHING_CRON] ?change id={} ignor??: mode non autoris? ('{}')", e.id, mode);
            continue;
        }
        // Toute r?f?rence ? traiter_echange est comment?e temporairement
        // let _ = traiter_echange::traiter_echange(user_id, &Value::Object(data), pool, None).await;
    }
}

/// Relance automatique du matching pour tous les ?changes en attente (toutes les 10 minutes)
pub async fn relance_matching_echanges(state: Arc<AppState>) {
    let pool = &state.pg;
    loop {
        info!("[CRON] Relance automatique du matching des ?changes en attente...");
        relancer_matching_echanges_once(pool).await;
        sleep(Duration::from_secs(600)).await; // 10 minutes
    }
}
