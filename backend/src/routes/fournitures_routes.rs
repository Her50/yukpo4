// Fichier d?sactiv? car incompatible avec Axum et non utilis? dans la version actuelle du backend.
/*
use std::sync::Arc;
use axum::{
    routing::post,
    Router,
    Json,
    extract::State,
};
// use crate::services::programme_service::get_programme_scolaire;
// use crate::services::ocr_service::extract_livres_from_image; // Fonction non trouv?e
// use crate::services::besoin_service::generer_besoin_classe_superieure;
// use crate::services::traiter_echange::traiter_echange;
// use crate::services::rechercher_besoin::rechercher_besoin_librairie; // Fonction non trouv?e

// TODO: Ce fichier est obsol?te si tu utilises Axum uniquement pour la route fournitures/gestion.

#[post("/fournitures/gestion")]
pub async fn gestion_fournitures(
    pool: web::Data<PgPool>,
    payload: web::Json<Value>,
) -> impl Responder {
    // 1. Unifie l'intention : tout passe par "echange"
    let intention = payload.get("intention").and_then(|v| v.as_str()).unwrap_or("");
    if intention != "echange" {
        return HttpResponse::BadRequest().json({
            serde_json::json!({"error": "Intention non reconnue pour cette route (utilisez 'echange')"})
        });
    }
    // 2. D?tection du sc?nario rentr?e scolaire
    let scenario = payload.get("scenario").and_then(|v| v.as_str()).unwrap_or("");
    let is_rentree = scenario == "rentree_scolaire"
        || (payload.get("classe").is_some() && payload.get("etablissement").is_some());
    let user_id = payload.get("user_id").and_then(|v| v.as_i64()).map(|v| v as i32);
    let etablissement = payload.get("etablissement").and_then(|v| v.as_str()).unwrap_or("");
    let classe = payload.get("classe").and_then(|v| v.as_str()).unwrap_or("");
    let image = payload.get("image_base64").and_then(|v| v.as_str());
    // 3. OCR/NLP si image fournie
    let (classe_detectee, livres_possedes) = if let Some(img) = image {
        match extract_livres_from_image(img).await {
            Ok(res) => (res.classe, res.livres),
            Err(_) => (classe.to_string(), vec![]),
        }
    } else {
        (classe.to_string(), vec![])
    };
    let classe_finale = if !classe_detectee.is_empty() { &classe_detectee } else { classe };
    // 4. Si sc?nario rentr?e scolaire, r?cup?ration du programme et g?n?ration du besoin
    let (programme, besoin) = if is_rentree {
        let programme = match get_programme_scolaire(etablissement, classe_finale, &pool).await {
            Ok(p) => p,
            Err(e) => return HttpResponse::InternalServerError().json(serde_json::json!({"error": format!("Erreur programme: {}", e)})),
        };
        let besoin = match generer_besoin_classe_superieure(etablissement, classe_finale).await {
            Ok(b) => b,
            Err(e) => return HttpResponse::InternalServerError().json(serde_json::json!({"error": format!("Erreur besoin: {}", e)})),
        };
        (programme, besoin)
    } else {
        (Value::Null, payload.get("besoin").cloned().unwrap_or(Value::Null))
    };
    // 5. Matching ou achat selon le choix utilisateur
    let mode = payload.get("mode").and_then(|v| v.as_str()).unwrap_or("echange");
    let mut resultat = serde_json::json!({});
    if mode == "achat" {
        match rechercher_besoin_librairie(&besoin, etablissement, classe_finale).await {
            Ok(achats) => resultat = serde_json::json!({"mode": "achat", "resultat": achats}),
            Err(e) => return HttpResponse::InternalServerError().json(serde_json::json!({"error": format!("Erreur achat: {}", e)})),
        }
    } else {
        let data = serde_json::json!({
            "offre": livres_possedes,
            "besoin": besoin,
        });
        match traiter_echange(user_id, &data, pool.get_ref()).await {
            Ok(res) => resultat = serde_json::json!({"mode": "echange", "resultat": res}),
            Err(e) => return HttpResponse::InternalServerError().json(serde_json::json!({"error": format!("Erreur ?change: {}", e)})),
        }
    }
    // 6. R?ponse compl?te
    HttpResponse::Ok().json(serde_json::json!({
        "intention": intention,
        "scenario": scenario,
        "etablissement": etablissement,
        "classe": classe_finale,
        "programme": programme,
        "besoin": besoin,
        "resultat": resultat
    }))
}
*/
