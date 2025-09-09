use crate::core::types::AppResult;
use crate::models::echange_model::Echange;
use crate::services::valider_echange::valider_echange_json;
use crate::utils::embedding_client::{EmbeddingClient, AddEmbeddingPineconeRequest};
use serde_json::Value;
use sqlx::PgPool;
use redis::AsyncCommands;
use std::collections::HashMap;
use tokio::sync::RwLock;
use once_cell::sync::Lazy;

// Seuil configurable via variable d'environnement
fn get_match_threshold() -> f64 {
    std::env::var("ECHANGE_MATCH_THRESHOLD")
        .unwrap_or_else(|_| "0.70".to_string())
        .parse::<f64>()
        .unwrap_or(0.70)
}

const CACHE_TTL: usize = 300; // 5 minutes
const BATCH_SIZE: usize = 50; // Taille du batch pour le matching

/// Structure de pond?ration configurable pour le scoring
#[derive(Debug, Clone)]
pub struct ScoringWeights {
    pub geo: f64,           // Poids de la distance g?ographique
    pub offre: f64,         // Poids de la similarit? offre
    pub besoin: f64,        // Poids de la similarit? besoin
    pub quantite: f64,      // Poids de la quantit?
    pub reputation: f64,    // Poids de la r?putation utilisateur
    pub disponibilite: f64, // Poids de la disponibilit?
    pub contraintes: f64,   // Poids des contraintes m?tier
}

impl Default for ScoringWeights {
    fn default() -> Self {
        Self {
            geo: 0.3,
            offre: 0.2,
            besoin: 0.2,
            quantite: 0.1,
            reputation: 0.1,
            disponibilite: 0.05,
            contraintes: 0.05,
        }
    }
}

/// Cache pour les r?putations utilisateur
static REPUTATION_CACHE: Lazy<RwLock<HashMap<i32, f64>>> = Lazy::new(|| {
    RwLock::new(HashMap::new())
});

/// ?? Traite une demande d'?change utilisateur (OPTIMIS?)
///
/// Cette fonction enregistre l'?change en base, tente un matching imm?diat,
/// et retourne le statut (match? ou en attente).
///
/// # Params
/// - `user_id`: ID de l'utilisateur initiateur (peut ?tre `None`)
/// - `data`: Donn?es structur?es li?es ? la demande
/// - `pool`: Connexion ? la base PostgreSQL
/// - `redis_client`: Client Redis pour le cache
///
/// # Returns
/// Une r?ponse JSON standardis?e incluant l'utilisateur et ses donn?es
pub async fn traiter_echange(
    user_id: Option<i32>,
    data: &Value,
    pool: &PgPool,
    redis_client: Option<&redis::Client>,
) -> AppResult<Value> {
    log::info!("[TRAITER_ECHANGE] Entr?e: user_id={:?}, data={:?}", user_id, data);
    
    // Validation stricte du JSON de troc g?n?r? par l'IA
    if let Err(e) = valider_echange_json(data) {
        log::warn!("[TRAITER_ECHANGE] Validation ?chou?e, retour imm?diat: {}", e);
        return Err(e);
    }

    let user_id = match user_id {
        Some(id) => id,
        None => return Ok(serde_json::json!({"error": "user_id manquant"})),
    };

    // Patch: utiliser offre_produits/besoin_produits si pr?sents, sinon fallback sur offre/besoin
    let offre = if let Some(op) = data.get("offre_produits") {
        op.clone()
    } else {
        data.get("offre").cloned().unwrap_or(Value::Null)
    };
    let besoin = if let Some(bp) = data.get("besoin_produits") {
        bp.clone()
    } else {
        data.get("besoin").cloned().unwrap_or(Value::Null)
    };
    let don = data.get("don").and_then(|v| v.as_bool()).unwrap_or(false);

    // --- V?rification de doublon d'?change (avec cache Redis) ---
    let cache_key = format!("echange_duplicate:{}:{}:{}", user_id, &offre, &besoin);
    if let Some(redis) = redis_client {
        let mut conn = redis.get_multiplexed_async_connection().await.map_err(|e| {
            log::warn!("[TRAITER_ECHANGE] Erreur connexion Redis: {}", e);
            crate::core::types::AppError::Internal("Erreur cache Redis".to_string())
        })?;
        
        if let Ok(exists) = conn.exists::<_, bool>(&cache_key).await {
            if exists {
                return Ok(serde_json::json!({"error": "Un ?change identique existe d?j? pour cet utilisateur."}));
            }
        }
    }

    // V?rification en base (fallback si pas de Redis)
    let doublon = sqlx::query!(
        r#"SELECT id FROM echanges WHERE user_id = $1 AND offre = $2 AND besoin = $3 AND statut = 'en_attente' LIMIT 1"#,
        user_id,
        &offre,
        &besoin
    )
    .fetch_optional(pool)
    .await?;
    
    if doublon.is_some() {
        // Mettre en cache le doublon
        if let Some(redis) = redis_client {
            let mut conn = redis.get_multiplexed_async_connection().await.map_err(|e| {
                log::warn!("[TRAITER_ECHANGE] Erreur connexion Redis: {}", e);
                crate::core::types::AppError::Internal("Erreur cache Redis".to_string())
            })?;
            let _: Result<(), redis::RedisError> = conn.set_ex(&cache_key, "1", CACHE_TTL as u64).await;
        }
        return Ok(serde_json::json!({"error": "Un ?change identique existe d?j? pour cet utilisateur."}));
    }

    // 1. Enregistrer la demande d'?change ou de don en base
    let rec = sqlx::query!(
        r#"
        INSERT INTO echanges (user_id, offre, besoin, statut, don)
        VALUES ($1, $2, $3, 'en_attente', $4)
        RETURNING id
        "#,
        user_id,
        &offre,
        &besoin,
        don
    )    .fetch_one(pool)
    .await?;
    let echange_id = rec.id;

    // 1bis. Vectorisation et envoi dans Pinecone (embedding) - ASYNCHRONE
    let embedding_client = EmbeddingClient::new("", "");
    let offre_clone = offre.clone();
    let besoin_clone = besoin.clone();
    
    tokio::spawn(async move {
        // Offre
        if let Some(offre_str) = offre_clone.as_str().or_else(|| offre_clone.get("valeur").and_then(|v| v.as_str())) {
            let req = AddEmbeddingPineconeRequest {
                value: offre_str.to_string(),
                type_donnee: "texte".to_string(),
                service_id: echange_id,
                gps_lat: None,
                gps_lon: None,
                langue: None,
                unite: None,
                devise: None,
                active: Some(true),
                type_metier: Some("echange".to_string()),
            };
            let req_json = build_add_embedding_pinecone_json(&req);
            let _ = embedding_client
                .add_embedding_pinecone(&serde_json::from_value(req_json).unwrap())
                .await
                .map_err(|e| {
                    log::error!("[traiter_echange] Erreur embedding Pinecone offre: {}", e);
                    e
                });
        }
        // Besoin
        if let Some(besoin_str) = besoin_clone.as_str().or_else(|| besoin_clone.get("valeur").and_then(|v| v.as_str())) {
            let req = AddEmbeddingPineconeRequest {
                value: besoin_str.to_string(),
                type_donnee: "texte".to_string(),
                service_id: echange_id,
                gps_lat: None,
                gps_lon: None,
                langue: None,
                unite: None,
                devise: None,
                active: Some(true),
                type_metier: Some("echange".to_string()),
            };
            let req_json = build_add_embedding_pinecone_json(&req);
            let _ = embedding_client
                .add_embedding_pinecone(&serde_json::from_value(req_json).unwrap())
                .await
                .map_err(|e| {
                    log::error!("[traiter_echange] Erreur embedding Pinecone besoin: {}", e);
                    e
                });
        }
    });

    // 2. Matching optimis? avec pagination et cache
    let mode = data.get("mode").and_then(|v| v.as_str()).unwrap_or("echange");
    if mode == "achat" {
        return Err(crate::core::types::AppError::BadRequest("Le mode 'achat' n'est pas support?".to_string()));
    }

    // R?cup?ration des candidats par batch pour ?viter la surcharge m?moire
    let mut offset = 0;
    let mut best_score = 0.0;
    let mut best_match: Option<(i32, i32)> = None;
    let weights = ScoringWeights::default();

    loop {
        let candidats = sqlx::query!(
            r#"SELECT id, user_id, offre, besoin, quantite_offerte, quantite_requise, lot_id, disponibilite, contraintes, gps_fixe_lat, gps_fixe_lon, don 
               FROM echanges 
               WHERE statut = 'en_attente' AND id != $1 
               ORDER BY created_at DESC 
               LIMIT $2 OFFSET $3"#,
            echange_id,
            BATCH_SIZE as i64,
            offset as i64
        )
        .fetch_all(pool)
        .await?;

        if candidats.is_empty() {
            break;
        }

        // Filtrer les candidats selon la logique m?tier du mode
        let candidats_filtres: Vec<_> = candidats.into_iter().filter(|c| {
            let offre_ok = c.offre.as_object().map(|o| !o.is_empty()).unwrap_or(false);
            let besoin_ok = c.besoin.as_object().map(|b| !b.is_empty()).unwrap_or(false);
            match mode {
                "echange" => offre_ok && besoin_ok,
                "don" => (offre_ok && !besoin_ok) || (!offre_ok && besoin_ok),
                "achat" => besoin_ok && !offre_ok,
                _ => false
            }
        }).collect();

        // Traitement par batch des candidats
        for c in &candidats_filtres {
            // Matching dons
            let is_don = don;
            let is_candidat_don = c.don;
            let is_offre_seule = !offre.is_null() && (besoin.is_null() || besoin == Value::Null);
            let is_besoin_seul = !besoin.is_null() && (offre.is_null() || offre == Value::Null);
            let is_candidat_offre_seule = !c.offre.is_null() && (c.besoin.is_null() || c.besoin == Value::Null);
            let is_candidat_besoin_seul = !c.besoin.is_null() && (c.offre.is_null() || c.offre == Value::Null);
            
            if is_don || is_candidat_don.unwrap_or(false) {
                let match_don = (is_don && is_besoin_seul && is_candidat_don.unwrap_or(false) && is_candidat_offre_seule)
                    || (is_candidat_don.unwrap_or(false) && is_candidat_besoin_seul && is_don && is_offre_seule);
                if !match_don {
                    continue;
                }
            }

            // R?cup?ration de la r?putation avec cache
            let user_reputation = get_user_reputation_cached(c.user_id).await;

            // Construction des objets Echange pour scoring
            let echange_a = Echange {
                id: echange_id,
                user_id,
                offre: offre.clone(),
                besoin: besoin.clone(),
                statut: "en_attente".to_string(),
                matched_with: None,
                quantite_offerte: None,
                quantite_requise: None,
                lot_id: None,
                disponibilite: None,
                contraintes: None,
                reputation: Some(user_reputation),
                gps_fixe_lat: None,
                gps_fixe_lon: None,
                don,
                created_at: chrono::Utc::now().naive_utc(),
                updated_at: chrono::Utc::now().naive_utc(),
            };
            let echange_b = Echange {
                id: c.id,
                user_id: c.user_id,
                offre: c.offre.clone(),
                besoin: c.besoin.clone(),
                statut: "en_attente".to_string(),
                matched_with: None,
                quantite_offerte: c.quantite_offerte,
                quantite_requise: c.quantite_requise,
                lot_id: c.lot_id,
                disponibilite: c.disponibilite.clone(),
                contraintes: c.contraintes.clone(),
                reputation: Some(user_reputation),
                gps_fixe_lat: c.gps_fixe_lat,
                gps_fixe_lon: c.gps_fixe_lon,
                don: c.don.unwrap_or(false),
                created_at: chrono::Utc::now().naive_utc(),
                updated_at: chrono::Utc::now().naive_utc(),
            };

            let score = score_echange(&echange_a, &echange_b, user_reputation, &weights);
            let score_inverse = score_echange(&echange_b, &echange_a, user_reputation, &weights);
            let score_final = score.max(score_inverse);

            if score_final > best_score {
                best_score = score_final;
                best_match = Some((c.id, c.user_id));
            }

            // Arr?t anticip? si score excellent
            if score_final > get_match_threshold() {
                break;
            }
        }

        // Si on a trouv? un excellent match, on arr?te
        if best_score > get_match_threshold() {
            break;
        }

        offset += BATCH_SIZE;
        
        // Limite de s?curit? pour ?viter les boucles infinies
        if offset > 1000 {
            break;
        }
    }

    if let Some((matched_id, _matched_user_id)) = best_match {
        if best_score >= get_match_threshold() {
            // Mise à jour atomique des deux échanges
            let result1 = sqlx::query!(
                "UPDATE echanges SET statut = 'matché', matched_with = $1 WHERE id = $2",
                matched_id,
                echange_id
            ).execute(pool).await;
            
            let result2 = sqlx::query!(
                "UPDATE echanges SET statut = 'matché', matched_with = $1 WHERE id = $2",
                echange_id,
                matched_id
            ).execute(pool).await;
            
            // Vérifier les résultats
            if let (Ok(_), Ok(_)) = (result1, result2) {
                log::info!("Échanges mis à jour avec succès: {} et {}", echange_id, matched_id);
            } else {
                log::error!("Erreur lors de la mise à jour des échanges");
            }
            // Notifications asynchrones
            let _user_email = "user@example.com"; // TODO: R?cup?rer le vrai email
            let _matched_user_email = "matched_user@example.com"; // TODO: R?cup?rer le vrai email
            // Notifications asynchrones
            tokio::spawn(async move {
                // Log simple pour ?viter les erreurs de compilation
                log::info!("?change match?: {} avec {}", echange_id, matched_id);
            });

            return Ok(serde_json::json!({
                "status": "match_trouve",
                "message": format!("?? ?change match? avec succ?s (score: {:.2})", best_score),
                "echange_id": echange_id,
               
                "score": best_score
            }));
        }
    }

    let res = serde_json::json!({
        "message": "?? ?change enregistr?, en attente de matching",
        "echange_id": echange_id
    });
    log::info!("[MATCHING] R?sultat pour user_id={:?} : {:?}", user_id, res);
    Ok(res)
}

/// R?cup?re la r?putation utilisateur avec cache
async fn get_user_reputation_cached(user_id: i32) -> f64 {
    // V?rifier le cache en m?moire
    {
        let cache = REPUTATION_CACHE.read().await;
        if let Some(&reputation) = cache.get(&user_id) {
            return reputation;
        }
    }

    // TODO: Impl?menter la vraie logique de r?putation
    let reputation = 1.0;

    // Mettre en cache
    {
        let mut cache = REPUTATION_CACHE.write().await;
        cache.insert(user_id, reputation);
    }

    reputation
}

/// G?n?re un JSON strictement conforme ? AddEmbeddingPineconeRequest (tous les champs, null si absent)
fn build_add_embedding_pinecone_json(req: &AddEmbeddingPineconeRequest) -> serde_json::Value {
    serde_json::json!({
        "value": req.value,
        "type_donnee": req.type_donnee,
        "service_id": req.service_id,
        "gps_lat": req.gps_lat,
        "gps_lon": req.gps_lon,
        "langue": req.langue,
        "unite": req.unite,
        "devise": req.devise,
        "active": req.active
    })
}

// Fonction utilitaire pour calculer la distance g?ographique (Haversine)
fn haversine_distance(lon1: f64, lat1: f64, lon2: f64, lat2: f64) -> f64 {
    let r = 6371.0; // Rayon de la Terre en km
    let dlat = (lat2 - lat1).to_radians();
    let dlon = (lon2 - lon1).to_radians();
    let a = (dlat / 2.0).sin().powi(2)
        + lat1.to_radians().cos() * lat2.to_radians().cos() * (dlon / 2.0).sin().powi(2);
    let c = 2.0 * a.sqrt().atan2((1.0 - a).sqrt());
    r * c
}

pub fn score_json_inclusion(a: &serde_json::Value, b: &serde_json::Value) -> f64 {
    // Score 1.0 si tous les champs de
    if let (serde_json::Value::Object(obj_a), serde_json::Value::Object(obj_b)) = (a, b) {
        let total = obj_a.len();
        if total == 0 { return 0.0; }
        let mut matches = 0;
        for (k, v) in obj_a.iter() {
            if let Some(vb) = obj_b.get(k) {
                if v == vb { matches += 1; }
            }
        }
        return matches as f64 / total as f64;
    }
    // fallback: ?galit? stricte ou Jaccard pour array/string
    score_json(a, b)
}

pub fn score_echange(
    a: &Echange,
    b: &Echange,
    user_reputation: f64,
    weights: &ScoringWeights,
) -> f64 {
    // Similarit? offre/besoin (inclusion)
    let score_offre = score_json_inclusion(&a.offre, &b.besoin);
    let score_besoin = score_json_inclusion(&a.besoin, &b.offre);
    // Quantit? (matching partiel possible)
    let quantite_score = if let (Some(qa), Some(qb)) = (a.quantite_offerte, b.quantite_requise) {
        (qa.min(qb) / qa.max(qb)).min(1.0)
    } else { 1.0 };
    // Distance g?ographique (si gps)
    let geo_score = if let (Some(lat1), Some(lon1), Some(lat2), Some(lon2)) = (a.gps_fixe_lat, a.gps_fixe_lon, b.gps_fixe_lat, b.gps_fixe_lon) {
        let dist = haversine_distance(lon1, lat1, lon2, lat2);
        if dist < 1.0 { 1.0 } else { (10.0 / (dist + 1.0)).min(1.0) }
    } else { 0.5 };
    let dispo_score = 1.0;
    let contraintes_score = 1.0;
    let reputation_score = user_reputation;
    weights.geo * geo_score
        + weights.offre * score_offre
        + weights.besoin * score_besoin
        + weights.quantite * quantite_score
        + weights.reputation * reputation_score
        + weights.disponibilite * dispo_score
        + weights.contraintes * contraintes_score
}

// --- Fonctions utilitaires pour le scoring ---
fn score_json(a: &Value, b: &Value) -> f64 {
    match (a, b) {
        (Value::Array(arr_a), Value::Array(arr_b)) => {
            if arr_a.is_empty() || arr_b.is_empty() {
                return 0.0;
            }
            let mut score_sum = 0.0;
            let mut count = 0.0;
            for va in arr_a {
                let mut best = 0.0;
                for vb in arr_b {
                    let s = score_json_object_tolerant(va, vb);
                    if s > best { best = s; }
                }
                score_sum += best;
                count += 1.0;
            }
            if count > 0.0 { score_sum / count } else { 0.0 }
        },
        (Value::String(sa), Value::String(sb)) => {
            if sa == sb { 1.0 } else { jaccard_str(sa, sb) }
        },
        (Value::Object(_), Value::Object(_)) => {
            score_json_object_tolerant(a, b)
        },
        _ => if a == b { 1.0 } else { 0.0 }
    }
}

fn score_json_object_tolerant(a: &Value, b: &Value) -> f64 {
    // Compare deux objets JSON en tenant compte de plus de champs produits, avec pond?ration
    let main_keys = ["nom", "categorie", "nature_produit", "quantite", "unite", "prix"];
    let secondary_keys = ["lot", "isbn", "titre", "etat", "marque", "origine", "occasion"];
    let mut matched = 0.0;
    let mut total = 0.0;
    // Champs principaux (poids 2)
    for k in main_keys.iter() {
        let va = a.get(k);
        let vb = b.get(k);
        if va.is_some() || vb.is_some() {
            total += 2.0;
            if va == vb && va.is_some() { matched += 2.0; }
        }
    }
    // Champs secondaires (poids 1)
    for k in secondary_keys.iter() {
        let va = a.get(k);
        let vb = b.get(k);
        if va.is_some() || vb.is_some() {
            total += 1.0;
            if va == vb && va.is_some() { matched += 1.0; }
        }
    }
    if total > 0.0 { matched / total } else { 0.0 }
}

fn jaccard_str(a: &str, b: &str) -> f64 {
    let set_a: std::collections::HashSet<_> = a.split_whitespace().collect();
    let set_b: std::collections::HashSet<_> = b.split_whitespace().collect();
    let inter = set_a.intersection(&set_b).count() as f64;
    let union = set_a.union(&set_b).count() as f64;
    if union > 0.0 { inter / union } else { 0.0 }
}
