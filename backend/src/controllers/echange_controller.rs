use axum::{
    extract::{State, Path},
    Json,
};
use sqlx::PgPool;
use std::sync::Arc;

use crate::state::AppState;
use serde_json::json;
use crate::models::echange::CreerEchangeRequest;
use crate::tasks::matching_echange_cron::relancer_matching_echanges_once;

/// POST /echanges ? cr?e un nouvel ?change (production)
pub async fn creer_echange(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CreerEchangeRequest>,
) -> Json<serde_json::Value> {
    let _pool: &PgPool = &state.pg;
    // Validation minimale
    if payload.user_id == 0 {
        return Json(json!({"error": "user_id manquant ou invalide"}));
    }
    // Construction d'un JSON strict pour validation m?tier et matching
    let mut data = serde_json::Map::new();
    data.insert("intention".to_string(), serde_json::Value::String("echange".to_string()));
    // Mode : on tente de l'extraire de l'offre, sinon 'echange'

    // Extraction du mode : racine, puis offre, puis besoin
    let mode = serde_json::to_value(&payload).ok()
        .and_then(|v| v.get("mode").and_then(|v| v.as_str()).map(|s| s.to_string()))
        .or_else(|| payload.offre.get("mode").and_then(|v| v.as_str()).map(|s| s.to_string()))
        .or_else(|| payload.besoin.get("mode").and_then(|v| v.as_str()).map(|s| s.to_string()))
        .unwrap_or_else(|| "".to_string());
    // Refuser tout mode non autoris?
    if mode != "echange" && mode != "don" {
        return Json(json!({"error": "Le champ 'mode' doit ?tre 'echange' ou 'don'"}));
    }
    // Injection du champ 'mode' dans offre/besoin si absent
    let mut offre = payload.offre.clone();
    let mut besoin = payload.besoin.clone();
    if offre.get("mode").is_none() {
        offre.as_object_mut().map(|o| o.insert("mode".to_string(), serde_json::Value::String(mode.clone())));
    }
    if besoin.get("mode").is_none() {
        besoin.as_object_mut().map(|b| b.insert("mode".to_string(), serde_json::Value::String(mode.clone())));
    }
    data.insert("mode".to_string(), serde_json::Value::String(mode.clone()));
    // mode_troc : racine, puis offre, puis besoin
    let mode_troc = serde_json::to_value(&payload).ok()
        .and_then(|v| v.get("mode_troc").and_then(|v| v.as_str()).map(|s| s.to_string()))
        .or_else(|| offre.get("mode_troc").and_then(|v| v.as_str()).map(|s| s.to_string()))
        .or_else(|| besoin.get("mode_troc").and_then(|v| v.as_str()).map(|s| s.to_string()))
        .unwrap_or_else(|| "".to_string());
    if mode_troc.is_empty() {
        return Json(json!({"error": "Le champ 'mode_troc' est obligatoire"}));
    }
    data.insert("mode_troc".to_string(), serde_json::Value::String(mode_troc));
    // gps : racine, puis offre, puis besoin
    let gps = serde_json::to_value(&payload).ok()
        .and_then(|v| v.get("gps").cloned())
        .or_else(|| offre.get("gps").cloned())
        .or_else(|| besoin.get("gps").cloned());
    if gps.is_none() {
        return Json(json!({"error": "Le champ 'gps' est obligatoire"}));
    }
    data.insert("gps".to_string(), gps.unwrap());
    // user_id (optionnel dans le sch?ma)
    data.insert("user_id".to_string(), serde_json::Value::from(payload.user_id));
    // On n'impose plus la pr?sence de 'listeproduit' : on accepte offre/besoin libres
    if let Some(liste) = offre.get("listeproduit").and_then(|v| v.as_array()) {
        if !liste.is_empty() {
            data.insert("listeproduit".to_string(), serde_json::Value::Array(liste.clone()));
        }
    }
    // Ajout des produits pour la logique m?tier (matching), sans violer le sch?ma strict
    if let Some(liste) = offre.get("listeproduit").and_then(|v| v.as_array()) {
        if !liste.is_empty() {
            data.insert("offre_produits".to_string(), serde_json::Value::Array(liste.clone()));
        }
    }
    if let Some(liste) = besoin.get("listeproduit").and_then(|v| v.as_array()) {
        if !liste.is_empty() {
            data.insert("besoin_produits".to_string(), serde_json::Value::Array(liste.clone()));
        }
    }
    // On n'ajoute PAS 'offre' ni 'besoin' dans le JSON transmis ? la logique m?tier !
    // data ne doit contenir que les champs m?tier stricts (intention, mode, mode_troc, gps, user_id, listeproduit...)
    // Validation stricte selon le mode
    let offre_obj = offre.as_object();
    let besoin_obj = besoin.as_object();
    let offre_nonvide = offre_obj.map(|o| !o.is_empty()).unwrap_or(false);
    let besoin_nonvide = besoin_obj.map(|b| !b.is_empty()).unwrap_or(false);
    if mode == "don" {
        if (offre_nonvide && besoin_nonvide) || (!offre_nonvide && !besoin_nonvide) {
            return Json(json!({"error": "Pour un don, il faut soit une offre seule, soit un besoin seul, mais pas les deux ni aucun."}));
        }
    } else if mode == "echange" {
        if !offre_nonvide || !besoin_nonvide {
            return Json(json!({"error": "L'offre et le besoin doivent contenir au moins un bien (cl? non vide)"}));
        }
    }
    // Appels ? traiter_echange d?sactiv?s temporairement
    // match crate::services::traiter_echange::traiter_echange(Some(payload.user_id), &serde_json::Value::Object(data), pool, None).await {
    //     Ok(result) => {
    //         info!("[traiter_echange] ?change trait? avec succ?s: {:?}", result);
    //         (StatusCode::OK, Json(result)).into_response()
    //     },
    //     Err(e) => {
    //         error!("[traiter_echange] Erreur traitement ?change: {}", e);
    //         (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Erreur traitement: {}", e)}))).into_response()
    //     }
    // }
    Json(json!({"message": "Service temporairement d?sactiv?"}))
}

/// GET /echanges/:id/status ? consulte le statut d'un ?change
pub async fn get_echange_status(
    State(state): State<Arc<AppState>>,
    Path(echange_id): Path<i32>,
) -> Json<serde_json::Value> {
    let _pool: &PgPool = &state.pg;
    let rec = sqlx::query!(
        r#"SELECT id, user_id, statut, matched_with, created_at, updated_at FROM echanges WHERE id = $1"#,
        echange_id
    )
    .fetch_optional(_pool)
    .await;
    match rec {
        Ok(Some(e)) => {
            let match_id = e.matched_with;
            Json(json!({
                "echange_id": e.id,
                "user_id": e.user_id,
                "statut": e.statut,
                "matched_with": e.matched_with,
                "match_id": match_id,
                "created_at": e.created_at,
                "updated_at": e.updated_at
            }))
        },
        Ok(None) => Json(json!({"error": "Echange introuvable"})),
        Err(e) => Json(json!({"error": format!("Erreur DB: {}", e)})),
    }
}

/// POST /echanges/relancer-matching ? relance le matching automatique imm?diatement (pour tests)
pub async fn relancer_matching(
    State(state): State<Arc<AppState>>,
) -> Json<serde_json::Value> {
    let _pool: &PgPool = &state.pg;
    relancer_matching_echanges_once(_pool).await;
    Json(json!({"status": "matching d?clench?"}))
}
