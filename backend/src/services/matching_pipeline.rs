// Rust: Pipeline de matching dynamique Yukpo (pseudo-code simplifi?)
use sqlx::PgPool;
use crate::utils::embedding_client::{EmbeddingClient, SearchEmbeddingPineconeRequest};
// use crate::services::semantic_exclusion::is_excluded_semantic_field;

pub struct MatchedService {
    pub service_id: i32,
    pub data: serde_json::Value,
    pub score: f64, // combined score
    pub semantic_score: f64,
    pub interaction_score: f64,
    pub gps: Option<String>,
}

/// Pour chaque champ du besoin, g?n?re embedding_nom et embedding_contenu, puis match sur la base
pub async fn match_services(
    pool: &PgPool,
    besoin_json: &serde_json::Value,
    __embedding_client: &EmbeddingClient
) -> anyhow::Result<Vec<MatchedService>> {
    let besoin_obj = besoin_json.as_object().ok_or_else(|| anyhow::anyhow!("Besoin non objet"))?;

    // Extraction du point de r?f?rence g?ospatial (gps_souhaite ou gps)
    let mut _point_ref: Option<(f64, f64)> = None;
    if let Some(gps) = besoin_obj.get("gps_souhaite").or_else(|| besoin_obj.get("gps")) {
        if let Some(arr) = gps.as_array() {
            if arr.len() == 2 {
                let lon = arr[0].as_f64().unwrap_or(0.0);
                let lat = arr[1].as_f64().unwrap_or(0.0);
                _point_ref = Some((lon, lat));
            }
        } else if let Some(s) = gps.as_str() {
            let parts: Vec<&str> = s.split(',').collect();
            if parts.len() == 2 {
                let lon = parts[0].trim().parse().unwrap_or(0.0);
                let lat = parts[1].trim().parse().unwrap_or(0.0);
                _point_ref = Some((lon, lat));
            }
        }
    }

    // Support du champ zone_gps (cercle ou polygone)
    let mut _zone_cercle: Option<((f64, f64), f64)> = None;
    let mut _zone_polygone: Option<Vec<(f64, f64)>> = None;
    if let Some(zone) = besoin_obj.get("zone_gps") {
        if let Some(obj) = zone.as_object() {
            // Cercle : { centre: [lon,lat], rayon: 5000 }
            if let (Some(centre), Some(rayon)) = (obj.get("centre"), obj.get("rayon")) {
                if let Some(arr) = centre.as_array() {
                    if arr.len() == 2 {
                        let lon = arr[0].as_f64().unwrap_or(0.0);
                        let lat = arr[1].as_f64().unwrap_or(0.0);
                        let rayon = rayon.as_f64().unwrap_or(0.0);
                        _zone_cercle = Some(((lon, lat), rayon));
                    }
                }
            }
        } else if let Some(arr) = zone.as_array() {
            // Polygone : array de points [ [lon,lat], ... ]
            let mut points = vec![];
            for pt in arr {
                if let Some(ptarr) = pt.as_array() {
                    if ptarr.len() == 2 {
                        let lon = ptarr[0].as_f64().unwrap_or(0.0);
                        let lat = ptarr[1].as_f64().unwrap_or(0.0);
                        points.push((lon, lat));
                    }
                }
            }
            if points.len() >= 3 {
                _zone_polygone = Some(points);
            }
        }
    }

    let scored_services: Vec<(i32, f64)> = Vec::new(); // (service_id, semantic_score)
    // NOTE: Exclusion stricte centralis?e : les champs 'reponse_intelligente' et 'suggestions_complementaires' sont exclus de toute recherche s?mantique (voir semantic_exclusion.rs)
    // Seuls les champs pertinents pour la recherche sémantique
    let champs_pertinents = ["titre", "description", "category", "titre_service"];
    
    for (champ_besoin, valeur_besoin) in besoin_obj.iter() {
        // Filtrer uniquement les champs pertinents
        if !champs_pertinents.contains(&champ_besoin.as_str()) {
            log::info!("[MATCHING][EXCLUSION] Champ '{}' exclu de la recherche s?mantique (non pertinent)", champ_besoin);
            continue;
        }
        
        let type_donnee = "texte"; // ? adapter dynamiquement
        log::info!("[MATCHING][DEBUG] Recherche Pinecone pour champ '{}' : {}", champ_besoin, valeur_besoin);
        // Appel ? la fonction de recherche d'embedding (? remplacer par l'impl?mentation r?elle)
        // TODO: Remplacer par l'appel r?el ? Pinecone/embedding_client
        let _req = SearchEmbeddingPineconeRequest {
            query: valeur_besoin.to_string(),
            type_donnee: type_donnee.to_string(),
            top_k: Some(20), // Réduit de 50 à 20 pour plus de précision
            gps_lat: None,
            gps_lon: None,
            gps_radius_km: None,
            active: Some(true), // Correction : champ obligatoire
        };
        // NOTE: PINECONE SUSPENDU - Utilisation de la recherche native PostgreSQL
        log::info!("[MATCHING][DEBUG] Pinecone suspendu - Recherche native PostgreSQL utilisée");
        
        // Simuler des résultats vides pour compatibilité (Pinecone suspendu)
        // TODO: Remplacer par la recherche native PostgreSQL quand nécessaire
    }
    // Remove duplicates, keep max semantic_score per service_id
    use std::collections::HashMap;
    let mut best_scores: HashMap<i32, f64> = HashMap::new();
    for (sid, sem) in scored_services {
        best_scores.entry(sid).and_modify(|e| { if sem > *e { *e = sem; } }).or_insert(sem);
    }
    // Fetch real service data and interaction score
    let mut results = Vec::new();
    for (&service_id, &semantic_score) in &best_scores {
        let rec = sqlx::query!("SELECT id, data, gps FROM services WHERE id = $1", service_id)
            .fetch_optional(pool).await?;
        if let Some(svc) = rec {
            // R?cup?rer le score depuis MongoDB au lieu de PostgreSQL
            let interaction_score = 1.0; // Valeur par d?faut, sera calcul?e via le service de scoring MongoDB
            // Combine scores avec une formule plus robuste
            let final_score = if semantic_score >= 0.7 {
                // Si le score sémantique est élevé, l'utiliser principalement
                0.9 * semantic_score + 0.1 * interaction_score
            } else if semantic_score >= 0.5 {
                // Score moyen : équilibre
                0.7 * semantic_score + 0.3 * interaction_score
            } else {
                // Score faible : favoriser l'interaction
                0.4 * semantic_score + 0.6 * interaction_score
            };
            log::info!("[MATCHING][DEBUG] service_id={} | semantic_score={:.4} | interaction_score={:.4} | final_score={:.4}", service_id, semantic_score, interaction_score, final_score);
            results.push(MatchedService {
                service_id,
                data: svc.data,
                score: final_score,
                semantic_score,
                interaction_score,
                gps: svc.gps,
            });
        } else {
            log::warn!("[MATCHING][DEBUG] service_id={} ignor? : service non trouv? en base", service_id);
        }
    }
    // Sort by final score descending, limit to 10
    let seuil_final = std::env::var("FINAL_SCORE_THRESHOLD")
        .unwrap_or_else(|_| "0.40".to_string())
        .parse::<f64>()
        .unwrap_or(0.40);
    let mut results: Vec<_> = results.into_iter().filter(|r| r.score >= seuil_final).collect();
    if results.is_empty() {
        log::info!("[MATCHING][DEBUG] Aucun service match? (score final < seuil: {:.2})", seuil_final);
    }
    results.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
    results.truncate(10);
    log::info!("[MATCHING][DEBUG] R?sultats finaux (apr?s filtrage/tri): {:?}", results.iter().map(|r| (r.service_id, r.score)).collect::<Vec<_>>());
    Ok(results)
}


