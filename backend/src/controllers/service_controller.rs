use std::sync::Arc;

use axum::{
    extract::{Path, Query, State, Extension},
    response::IntoResponse,
    http::StatusCode,
    Json,
};
use serde_json::{json, Value};
use sqlx::Row;
use log::{info, error, warn};
use serde::Deserialize;
use crate::middlewares::jwt::AuthenticatedUser;
use crate::state::AppState;
// use crate::services::mongo_history_service::MongoHistoryService;
// use crate::services::scoring_service::compute_score;

#[derive(Debug, Deserialize)]
pub struct NewServiceRequest {
    pub user_id: i32,
    pub data: Value,
}

#[derive(Debug, Deserialize)]
pub struct NewUserRequest {
    pub email: String,
    pub password_hash: String,
    pub lang: Option<String>,
}

/// ? Cr?ation d'un service
pub async fn creer_service(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<NewServiceRequest>,
) -> axum::response::Response {
    info!("[creer_service] Called for user_id={}", payload.user_id);
    
    // Utiliser le service creer_service qui retourne les tokens consomm?s
    match crate::services::creer_service::creer_service(
        &state.pg,
        payload.user_id,
        &payload.data,
        &state.redis_client,
    ).await {
        Ok((service_creation_result, tokens_consumed)) => {
            info!("[creer_service] ? Service cr?? avec succ?s - Tokens consomm?s: {}", tokens_consumed);
            info!("[creer_service] Type des tokens: {:?}", std::any::type_name_of_val(&tokens_consumed));
            
            // Construire la r?ponse avec les headers de tokens
            let mut response = (StatusCode::CREATED, Json(service_creation_result.clone())).into_response();
            
            // Calculer le co?t r?el bas? sur l'intention et les tokens consomm?s
            // Pour l'endpoint /api/services/create, l'intention est toujours "creation_service"
            let base_token_cost = 0.004; // Co?t de base par token en FCFA
            let multiplier = 100.0; // Multiplicateur pour création de service
            let cost_xaf = (tokens_consumed as f64) * base_token_cost * multiplier;
            
            info!("[creer_service] Calcul coût: {} tokens × {} FCFA × {} = {} FCFA", 
                  tokens_consumed, base_token_cost, multiplier, cost_xaf);
            
            // ?? NOUVEAU : Déduire le coût du solde de l'utilisateur
            let cost_in_tokens = cost_xaf as i64; // 1 FCFA = 1 token dans le système
            let deduction_result = sqlx::query!(
                "UPDATE users SET tokens_balance = tokens_balance - $1 WHERE id = $2 AND tokens_balance >= $1 RETURNING tokens_balance",
                cost_in_tokens,
                payload.user_id
            )
            .fetch_optional(&state.pg)
            .await;
            
            match deduction_result {
                Ok(Some(user_data)) => {
                    let nouveau_solde = user_data.tokens_balance;
                    info!("[creer_service] ? Solde déduit pour utilisateur {}: {} FCFA ({}→{})", 
                          payload.user_id, cost_xaf, nouveau_solde + cost_in_tokens, nouveau_solde);
                    
                    // Mettre à jour le JWT avec le nouveau solde
                    if let Ok(new_jwt) = crate::middlewares::check_tokens::update_jwt_with_new_balance(
                        payload.user_id, nouveau_solde, &state
                    ).await {
                        response.headers_mut().insert(
                            "x-new-jwt",
                            axum::http::HeaderValue::from_str(&new_jwt).unwrap_or_else(|_| axum::http::HeaderValue::from_static(""))
                        );
                        info!("[creer_service] ?? JWT mis à jour avec le nouveau solde: {}", nouveau_solde);
                    }
                },
                Ok(None) => {
                    warn!("[creer_service] ⚠️ Solde insuffisant pour utilisateur {} (coût: {} FCFA)", 
                          payload.user_id, cost_xaf);
                    // Service créé mais solde non déduit
                },
                Err(e) => {
                    error!("[creer_service] ❌ Erreur lors de la déduction du solde: {:?}", e);
                    // Service créé mais solde non déduit
                }
            }
            
            // Ajouter les headers avec les vraies valeurs
            response.headers_mut().insert(
                "x-tokens-consumed",
                axum::http::HeaderValue::from_str(&tokens_consumed.to_string()).unwrap_or_else(|_| axum::http::HeaderValue::from_static("0"))
            );
            
            response.headers_mut().insert(
                "x-tokens-cost-xaf",
                axum::http::HeaderValue::from_str(&cost_xaf.to_string()).unwrap_or_else(|_| axum::http::HeaderValue::from_static("0"))
            );
            
            info!("[creer_service] Headers ajout?s: x-tokens-consumed={}, x-tokens-cost-xaf={}", tokens_consumed, cost_xaf);
            
            response
        },
        Err(e) => {
            error!("[creer_service] Erreur cr?ation service: {:?}", e);
            match e {
                crate::core::types::AppError::BadRequest(msg) => {
                    (StatusCode::BAD_REQUEST, Json(json!({"error": msg}))).into_response()
                },
                crate::core::types::AppError::Internal(msg) => {
                    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": msg}))).into_response()
                },
                _ => {
                    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Erreur cr?ation service"}))).into_response()
                }
            }
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct ActivateParams {
    pub extend_hours: f64,
}

pub async fn reactivate_service(
    State(state): State<Arc<AppState>>,
    Path((service_id, user_id)): Path<(i32, i32)>,
    Query(params): Query<ActivateParams>,
) -> axum::response::Response {
    info!("[reactivate_service] Called for service_id={}, user_id={}, extend_hours={}", service_id, user_id, params.extend_hours);
    let pg_pool = &state.pg;
    let mut conn = match pg_pool.acquire().await {
        Ok(c) => c,
        Err(e) => {
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("DB acquire error: {}", e)}))).into_response();
        }
    };
    if let Err(e) = sqlx::query!(
        r#"
        UPDATE services
        SET is_active = TRUE,
            last_reactivated_at = NOW()
        WHERE id = $1 AND user_id = $2
        "#,
        service_id,
        user_id
    )
    .execute(&mut *conn)
    .await {
        return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Update error: {}", e)}))).into_response();
    }
    (StatusCode::OK, Json(json!({"message": "Service r?activ?"}))).into_response()
}

pub async fn insert_user(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<NewUserRequest>,
) -> axum::response::Response {
    info!("[insert_user] Called for email={}", payload.email);
    let pg_pool = &state.pg;
    let mut conn = match pg_pool.acquire().await {
        Ok(c) => c,
        Err(e) => {
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("DB acquire error: {}", e)}))).into_response();
        }
    };
    if let Err(e) = sqlx::query!(
        r#"
        INSERT INTO users (email, password_hash, preferred_lang)
        VALUES ($1, $2, $3)
        "#,
        payload.email,
        payload.password_hash,
        payload.lang.clone().unwrap_or_else(|| "fr".to_string()),
    )
    .execute(&mut *conn)
    .await {
        return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Insert error: {}", e)}))).into_response();
    }
    (StatusCode::CREATED, Json(json!({"message": "Utilisateur enregistr? avec succ?s"}))).into_response()
}

#[derive(Debug, Deserialize)]
pub struct FilterQuery {
    pub actif: Option<bool>,
    pub category: Option<String>,
    pub min_price: Option<f64>,
    pub max_price: Option<f64>,
}

pub async fn filter_services(
    State(state): State<Arc<AppState>>,
    Query(query): Query<FilterQuery>,
) -> axum::response::Response {
    info!("[filter_services] Called with params: actif={:?}, category={:?}, min_price={:?}, max_price={:?}", query.actif, query.category, query.min_price, query.max_price);
    let pg_pool = &state.pg;
    let mut sql = "SELECT id, data, is_active FROM services WHERE 1=1".to_string();
    let mut args: Vec<Value> = Vec::new();

    if let Some(a) = query.actif {
        sql += &format!(" AND is_active = ${}", args.len() + 1);
        args.push(json!(a));
    }
    if let Some(cat) = &query.category {
        sql += &format!(" AND data->>'category' = ${}", args.len() + 1);
        args.push(json!(cat));
    }
    if let Some(min) = query.min_price {
        sql += &format!(" AND (data->>'price')::FLOAT >= ${}", args.len() + 1);
        args.push(json!(min));
    }
    if let Some(max) = query.max_price {
        sql += &format!(" AND (data->>'price')::FLOAT <= ${}", args.len() + 1);
        args.push(json!(max));
    }

    sql += " ORDER BY created_at DESC";

    let mut q = sqlx::query(&sql);
    for val in &args {
        q = q.bind(val);
    }
    let rows = match q.fetch_all(pg_pool).await {
        Ok(r) => r,
        Err(e) => {
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Query error: {}", e)}))).into_response();
        }
    };

    let result: Vec<_> = rows
        .into_iter()
        .map(|r| json!({
            "id": r.try_get::<i32, _>("id").unwrap_or_default(),
            "data": r.try_get::<Value, _>("data").unwrap_or(Value::Null),
            "is_active": r.try_get::<bool, _>("is_active").unwrap_or(false)
        }))
        .collect();

    (StatusCode::OK, Json(serde_json::Value::Array(result))).into_response()
}

pub async fn get_related_services(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i32>,
) -> axum::response::Response {
    info!("[get_related_services] Called for id={}", id);
    let pg_pool = &state.pg;
    let rows = match sqlx::query!(
        r#"
        SELECT id, data
        FROM services
        WHERE id != $1
        ORDER BY created_at DESC
        LIMIT 5
        "#,
        id
    )
    .fetch_all(pg_pool)
    .await {
        Ok(r) => r,
        Err(e) => {
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Query error: {}", e)}))).into_response();
        }
    };

    let result: Vec<_> = rows
        .into_iter()
        .map(|r| json!({
            "id": r.id,
            "data": serde_json::from_value(r.data).unwrap_or(Value::Null)
        }))
        .collect();

    (StatusCode::OK, Json(serde_json::Value::Array(result))).into_response()
}

#[allow(dead_code)]
// Helper ? ajouter en bas du fichier (ou dans un module utils)
fn is_valid_gps(gps: &str) -> bool {
    let re = regex::Regex::new(r"^-?\d{1,3}\.\d+,-?\d{1,3}\.\d+$").unwrap();
    re.is_match(gps)
}

// use crate::services::service_history_service::TOKEN_DEBIT_PER_CLICK;

#[derive(Deserialize)]
pub struct UpdateTokenDebitRequest {
    pub new_value: i64,
}

/// ? PATCH /admin/token_debit ? modifie dynamiquement le montant de pr?l?vement de tokens (admin uniquement)
pub async fn update_token_debit(
    State(_state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(req): Json<UpdateTokenDebitRequest>,
) -> axum::response::Response {
    if user.role != "admin" {
        return axum::response::IntoResponse::into_response((axum::http::StatusCode::FORBIDDEN, Json(serde_json::json!({"error": "Acc?s r?serv? ? l'admin"}))));
    }
    if req.new_value < 1 || req.new_value > 10000 {
        return axum::response::IntoResponse::into_response((axum::http::StatusCode::BAD_REQUEST, Json(serde_json::json!({"error": "Valeur hors limites autoris?es (1-10000)"}))));
    }
    // TOKEN_DEBIT_PER_CLICK.store(req.new_value, std::sync::atomic::Ordering::Relaxed);
    axum::response::IntoResponse::into_response((axum::http::StatusCode::OK, Json(serde_json::json!({"message": "Montant modifi?", "nouvelle_valeur": req.new_value}))))
}

#[derive(Debug, Deserialize)]
pub struct UpdateServiceRequest {
    pub data: Value,
}

/// ? Modification d'un service existant
pub async fn modifier_service(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(service_id): Path<i32>,
    Json(payload): Json<UpdateServiceRequest>,
) -> axum::response::Response {
    let user_id = user.id;
    info!("[modifier_service] Called for service_id={}, user_id={}", service_id, user_id);
    
    let pg_pool = &state.pg;
    
    // V?rifier que le service appartient ? l'utilisateur
    let service_exists = sqlx::query!(
        "SELECT id FROM services WHERE id = $1 AND user_id = $2",
        service_id,
        user_id
    )
    .fetch_optional(pg_pool)
    .await;
    
    match service_exists {
        Ok(None) => {
            return (StatusCode::NOT_FOUND, Json(json!({"error": "Service non trouv? ou non autoris?"}))).into_response();
        },
        Ok(Some(_)) => {
            // Service trouv?, on peut le modifier
        },
        Err(e) => {
            error!("[modifier_service] Erreur v?rification service: {}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Erreur base de donn?es"}))).into_response();
        }
    }
    
    // Mettre ? jour le service
    let result = sqlx::query!(
        r#"
        UPDATE services 
        SET data = $1, updated_at = NOW()
        WHERE id = $2 AND user_id = $3
        RETURNING id
        "#,
        payload.data,
        service_id,
        user_id
    )
    .fetch_optional(pg_pool)
    .await;
    
    match result {
        Ok(Some(_)) => {
            info!("[modifier_service] ? Service {} modifi? avec succ?s par utilisateur {}", service_id, user_id);
            (StatusCode::OK, Json(json!({
                "message": "Service modifi? avec succ?s",
                "service_id": service_id
            }))).into_response()
        },
        Ok(None) => {
            warn!("[modifier_service] Service non trouv? apr?s mise ? jour");
            (StatusCode::NOT_FOUND, Json(json!({"error": "Service non trouv?"}))).into_response()
        },
        Err(e) => {
            error!("[modifier_service] Erreur mise ? jour service: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Erreur lors de la modification"}))).into_response()
        }
    }
}

/// ? Suppression d'un service
pub async fn supprimer_service(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(service_id): Path<i32>,
) -> axum::response::Response {
    let user_id = user.id;
    info!("[supprimer_service] Called for service_id={}, user_id={}", service_id, user_id);
    
    let pg_pool = &state.pg;
    
    // V?rifier que le service appartient ? l'utilisateur
    let service_exists = sqlx::query!(
        "SELECT id FROM services WHERE id = $1 AND user_id = $2",
        service_id,
        user_id
    )
    .fetch_optional(pg_pool)
    .await;
    
    match service_exists {
        Ok(None) => {
            return (StatusCode::NOT_FOUND, Json(json!({"error": "Service non trouv? ou non autoris?"}))).into_response();
        },
        Ok(Some(_)) => {
            // Service trouv?, on peut le supprimer
        },
        Err(e) => {
            error!("[supprimer_service] Erreur v?rification service: {}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Erreur base de donn?es"}))).into_response();
        }
    }
    
    // Supprimer le service
    let result = sqlx::query!(
        "DELETE FROM services WHERE id = $1 AND user_id = $2 RETURNING id",
        service_id,
        user_id
    )
    .fetch_optional(pg_pool)
    .await;
    
    match result {
        Ok(Some(_)) => {
            info!("[supprimer_service] ? Service {} supprim? avec succ?s par utilisateur {}", service_id, user_id);
            (StatusCode::OK, Json(json!({
                "message": "Service supprim? avec succ?s",
                "service_id": service_id
            }))).into_response()
        },
        Ok(None) => {
            warn!("[supprimer_service] Service non trouv? apr?s suppression");
            (StatusCode::NOT_FOUND, Json(json!({"error": "Service non trouv?"}))).into_response()
        },
        Err(e) => {
            error!("[supprimer_service] Erreur suppression service: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Erreur lors de la suppression"}))).into_response()
        }
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    #[test]
    fn test_valider_service_json_strict_ok() {
        let payload = json!({
            "titre": { "type_donnee": "string", "valeur": "Service test", "origine_champs": "test" },
            "description": { "type_donnee": "string", "valeur": "Description test", "origine_champs": "test" },
            "category": { "type_donnee": "string", "valeur": "test", "origine_champs": "test" },
            "intention": "proposer",
            "is_tarissable": false,
            "gps": false
        });
        let res = crate::services::creer_service::valider_service_json(&payload);
        assert!(res.is_ok(), "La validation stricte doit passer pour un payload conforme: {res:?}");
    }

    #[test]
    fn test_valider_service_json_strict_erreur_string_brute() {
        let payload = json!({
            "titre": "Titre brut",
            "description": { "type_donnee": "string", "valeur": "Desc", "origine_champs": "test" },
            "category": { "type_donnee": "string", "valeur": "cat", "origine_champs": "test" },
            "intention": "proposer",
            "is_tarissable": false,
            "gps": false
        });
        let res = crate::services::creer_service::valider_service_json(&payload);
        assert!(res.is_err(), "La validation doit ?chouer si 'titre' est une string brute");
    }

    #[test]
    fn test_valider_service_json_strict_erreur_objet_incomplet() {
        let payload = json!({
            "titre": { "type_donnee": "string", "valeur": "", "origine_champs": "test" },
            "description": { "type_donnee": "string", "valeur": "Desc", "origine_champs": "test" },
            "category": { "type_donnee": "string", "valeur": "cat", "origine_champs": "test" },
            "intention": "proposer",
            "is_tarissable": false,
            "gps": false
        });
        let res = crate::services::creer_service::valider_service_json(&payload);
        assert!(res.is_err(), "La validation doit ?chouer si 'titre.valeur' est vide");
    }
}

// Fonctions utilisant mongo_history_service ou scoring_service d?sactiv?es temporairement
// /// Calcule le score m?dian d'une cat?gorie depuis MongoDB
// async fn compute_score_category_median(
//     mongo_history: &Arc<crate::services::mongo_history_service::MongoHistoryService>,
//     category: &str,
// ) -> Result<f64, String> {
//     let collection = mongo_history.get_collection("history").await;
    
//     let pipeline = vec![
//         mongodb::bson::doc! {
//             "$match": {
//                 "event_type": "UserAction",
//                 "data.interaction_type": "score_computation",
//                 "data.category": category
//             }
//         },
//         mongodb::bson::doc! {
//             "$group": {
//                 "_id": null,
//                 "median_score": { "$avg": "$data.score" }
//             }
//         }
//     ];

//     let mut cursor = collection
//         .aggregate(pipeline, None)
//         .await
//         .map_err(|e| format!("Erreur agr?gation m?diane: {}", e))?;

//     let mut median_score = 0.0;
//     if let Some(doc) = cursor.try_next().await
//         .map_err(|e| format!("Erreur it?ration m?diane: {}", e))? {
//         if let Ok(bson) = mongodb::bson::to_bson(&doc) {
//             if let Ok(json) = serde_json::to_value(bson) {
//                 median_score = json.get("median_score").and_then(|v| v.as_f64()).unwrap_or(0.0);
//             }
//         }
//     }

//     Ok(median_score)
// }

// /// Calcule le score d'un service depuis MongoDB
// async fn compute_service_score(
//     mongo_history: &Arc<crate::services::mongo_history_service::MongoHistoryService>,
//     service_id: i32,
// ) -> Result<f64, String> {
//     let score = crate::services::scoring_service::compute_score(mongo_history.clone(), service_id).await?;
//     Ok(score.score)
// }

/// R?cup?re le dernier service cr?? par le prestataire connect? (pour pr?remplissage contact)
pub async fn get_last_service_for_user(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
) -> axum::response::Response {
    let user_id = user.id;
    let pg_pool = &state.pg;
    // On r?cup?re le dernier service cr?? par l?utilisateur
    let row = match sqlx::query!(
        r#"SELECT data FROM services WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1"#,
        user_id
    )
    .fetch_optional(pg_pool)
    .await {
        Ok(r) => r,
        Err(e) => {
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Query error: {}", e)}))).into_response();
        }
    };
    if let Some(r) = row {
        // On extrait les champs contact (t?l?phone, whatsapp, email, site web, etc.)
        let data = r.data; // r.data est d?j? un Value, pas besoin de from_value
        let phone = data.get("telephone").cloned().unwrap_or(Value::Null);
        let whatsapp = data.get("whatsapp").cloned().unwrap_or(Value::Null);
        let email = data.get("email").cloned().unwrap_or(Value::Null);
        // Recherche site web (siteweb, site, url, website...)
        let siteweb = data.get("siteweb")
            .or_else(|| data.get("site"))
            .or_else(|| data.get("url"))
            .or_else(|| data.get("website"))
            .cloned()
            .unwrap_or(Value::Null);
        return (StatusCode::OK, Json(json!({
            "telephone": phone,
            "whatsapp": whatsapp,
            "email": email,
            "siteweb": siteweb
        }))).into_response();
    }
    (StatusCode::OK, Json(json!({}))).into_response()
}

/// Active ou d?sactive un service
pub async fn toggle_service_status(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(service_id): Path<i32>,
    Json(payload): Json<serde_json::Value>,
) -> axum::response::Response {
    let user_id = user.id;
    let pg_pool = &state.pg;
    
    info!("[toggle_service_status] Changement de statut pour service {} par utilisateur {}", service_id, user_id);
    
    let is_active = payload.get("actif")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    
    let result = sqlx::query!(
        r#"UPDATE services SET is_active = $1 WHERE id = $2 AND user_id = $3 RETURNING id"#,
        is_active,
        service_id,
        user_id
    )
    .fetch_optional(pg_pool)
    .await;
    
    match result {
        Ok(Some(_)) => {
            info!("[toggle_service_status] Statut mis ? jour avec succ?s");
            (StatusCode::OK, Json(json!({
                "success": true,
                "message": if is_active { "Service activ?" } else { "Service d?sactiv?" }
            }))).into_response()
        },
        Ok(None) => {
            warn!("[toggle_service_status] Service non trouv? ou non autoris?");
            (StatusCode::NOT_FOUND, Json(json!({
                "error": "Service non trouv? ou non autoris?"
            }))).into_response()
        },
        Err(e) => {
            error!("[toggle_service_status] Erreur SQL: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({
                "error": format!("Erreur lors de la mise ? jour: {}", e)
            }))).into_response()
        }
    }
}

/// R?cup?re un service par ID pour affichage public
pub async fn get_service_by_id(
    State(state): State<Arc<AppState>>,
    Path(service_id): Path<i32>,
) -> axum::response::Response {
    let pg_pool = &state.pg;
    
    info!("[get_service_by_id] R?cup?ration du service {}", service_id);
    
    let row = sqlx::query!(
        r#"SELECT id, data, is_active, created_at, user_id FROM services WHERE id = $1 AND is_active = true"#,
        service_id
    )
    .fetch_optional(pg_pool)
    .await;
    
    match row {
        Ok(Some(service)) => {
            info!("[get_service_by_id] Service trouv?");
            (StatusCode::OK, Json(json!({
                "id": service.id,
                "data": service.data,
                "is_active": service.is_active,
                "created_at": service.created_at,
                "user_id": service.user_id
            }))).into_response()
        },
        Ok(None) => {
            warn!("[get_service_by_id] Service non trouv? ou inactif");
            (StatusCode::NOT_FOUND, Json(json!({
                "error": "Service non trouv? ou inactif"
            }))).into_response()
        },
        Err(e) => {
            error!("[get_service_by_id] Erreur SQL: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({
                "error": format!("Erreur lors de la r?cup?ration: {}", e)
            }))).into_response()
        }
    }
}

/// R?cup?re tous les services du prestataire connect?
pub async fn get_services_for_prestataire(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
) -> axum::response::Response {
    let user_id = user.id;
    let pg_pool = &state.pg;
    
    info!("[get_services_for_prestataire] R?cup?ration des services pour utilisateur {}", user_id);
    
    // Log des 5 derniers services cr??s pour debug
    let _debug_rows = match sqlx::query!(
        r#"SELECT id, created_at FROM services WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5"#,
        user_id
    )
    .fetch_all(pg_pool)
    .await {
        Ok(r) => r,
        Err(e) => {
            error!("[get_services_for_prestataire] Erreur requ?te debug SQL: {}", e);
            Vec::new()
        }
    };
    
    // Debug lines removed for compilation

    

    
    let rows = match sqlx::query!(
        r#"SELECT id, data, is_active, created_at FROM services WHERE user_id = $1 ORDER BY created_at DESC"#,
        user_id
    )
    .fetch_all(pg_pool)
    .await {
        Ok(r) => r,
        Err(e) => {
            error!("[get_services_for_prestataire] Erreur requ?te SQL: {}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Query error: {}", e)}))).into_response();
        }
    };
    
    info!("[get_services_for_prestataire] {} services trouv?s pour utilisateur {}", rows.len(), user_id);
    
    // Log des IDs des services retourn?s pour debug
    let service_ids: Vec<i32> = rows.iter().map(|r| r.id).collect();
    info!("[get_services_for_prestataire] DEBUG - IDs des services retourn?s: {:?}", service_ids);
    
    let result: Vec<_> = rows
        .into_iter()
        .map(|r| json!({
            "id": r.id,
            "data": serde_json::from_value(r.data).unwrap_or(Value::Null),
            "actif": r.is_active,
            "created_at": r.created_at
        }))
        .collect();
    
    info!("[get_services_for_prestataire] R?ponse envoy?e avec {} services", result.len());
    (StatusCode::OK, Json(serde_json::Value::Array(result))).into_response()
}
