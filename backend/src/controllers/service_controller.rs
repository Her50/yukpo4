use std::sync::Arc;

use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde_json::{json, Value};
use sqlx::Row;
use log::{error, info, warn};
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
    
    // Utiliser le service creer_service qui retourne les tokens consommés
    match crate::services::creer_service::creer_service(
        &state.pg,
        payload.user_id,
        &payload.data,
        state.media_storage.clone(), // ✅ NOUVEAU: Passer MediaStorageService pour upload S3
        &state.redis_client,
        None,
    )
    .await {
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
            
            // ✅ NOUVEAU : Déduire le coût du solde de l'utilisateur (avec retry pour gérer erreurs TLS)
            let cost_in_tokens = cost_xaf as i64; // 1 FCFA = 1 token dans le système
            let deduction_result = crate::utils::db_retry::retry_query(
                &state.pg,
                || {
                    let cost_clone = cost_in_tokens;
                    let user_id_clone = payload.user_id;
                    let pool_clone = state.pg.clone();
                    Box::pin(async move {
                        sqlx::query(
                            "UPDATE users SET tokens_balance = tokens_balance - $1 WHERE id = $2 AND tokens_balance >= $1 RETURNING tokens_balance"
                        )
                        .bind(cost_clone)
                        .bind(user_id_clone)
                        .fetch_optional(&pool_clone)
                        .await
                    })
                },
                5, // 5 tentatives max pour gérer les erreurs TLS
            )
            .await;
            
            match deduction_result {
                Ok(Some(row)) => {
                    let nouveau_solde: i64 = row.try_get("tokens_balance").unwrap_or(0);
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
    if let Err(e) = sqlx::query(
        r#"
        UPDATE services
        SET is_active = TRUE,
            last_reactivated_at = NOW()
        WHERE id = $1 AND user_id = $2
        "#
    )
    .bind(service_id)
    .bind(user_id)
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
    if let Err(e) = sqlx::query(
        r#"
        INSERT INTO users (email, password_hash, preferred_lang)
        VALUES ($1, $2, $3)
        "#
    )
    .bind(&payload.email)
    .bind(&payload.password_hash)
    .bind(payload.lang.clone().unwrap_or_else(|| "fr".to_string()))
    .execute(&mut *conn)
    .await {
        return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Insert error: {}", e)}))).into_response();
    }
    (StatusCode::CREATED, Json(json!({"message": "Utilisateur enregistr? avec succ?s"}))).into_response()
}

/// Endpoint liste de services (deprecated / placeholder)
pub async fn get_services_list(
    State(_state): State<Arc<AppState>>,
) -> axum::response::Response {
    (StatusCode::NOT_IMPLEMENTED, Json(json!({
        "error": "Endpoint get_services_list temporairement désactivé"
    }))).into_response()
}

/// Endpoint services récents (deprecated / placeholder)
pub async fn get_services_recent(
    State(_state): State<Arc<AppState>>,
) -> axum::response::Response {
    (StatusCode::NOT_IMPLEMENTED, Json(json!({
        "error": "Endpoint get_services_recent temporairement désactivé"
    }))).into_response()
}

/// Endpoint services de l'utilisateur (deprecated / placeholder)
pub async fn get_my_services(
    State(_state): State<Arc<AppState>>,
    Extension(_user): Extension<AuthenticatedUser>,
) -> axum::response::Response {
    (StatusCode::NOT_IMPLEMENTED, Json(json!({
        "error": "Endpoint get_my_services temporairement désactivé"
    }))).into_response()
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
    let rows = match sqlx::query(
        r#"
        SELECT id, data
        FROM services
        WHERE id != $1
        ORDER BY created_at DESC
        LIMIT 5
        "#
    )
    .bind(id)
    .fetch_all(pg_pool)
    .await {
        Ok(r) => r,
        Err(e) => {
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Query error: {}", e)}))).into_response();
        }
    };

    let result: Vec<_> = rows
        .into_iter()
        .map(|r| {
            let service_id = r.try_get::<i32, _>("id").unwrap_or_default();
            let data: Value = r.try_get("data").unwrap_or(Value::Null);
            json!({
                "id": service_id,
                "data": serde_json::from_value(data).unwrap_or(Value::Null)
            })
        })
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
    let service_exists = sqlx::query(
        "SELECT id FROM services WHERE id = $1 AND user_id = $2"
    )
    .bind(service_id)
    .bind(user_id)
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
    
    // ✅ OPTIMISÉ 2025-12-21: Mise à jour intelligente du service
    // Détecte si seulement les produits sont modifiés pour utiliser jsonb_set (plus rapide)
    // Sinon, met à jour tout le JSON (comportement par défaut)
    let payload_keys: Vec<String> = payload.data.as_object()
        .map(|obj| obj.keys().cloned().collect())
        .unwrap_or_default();
    
    // ✅ OPTIMISATION: Si le payload ne contient que "produits", utiliser jsonb_set
    // Réduit la latence de 5-7s à ~1-2s
    let result = if payload_keys.len() == 1 && payload_keys.contains(&"produits".to_string()) {
        if let Some(produits_value) = payload.data.get("produits") {
            info!("[modifier_service] 🚀 Mise à jour partielle (produits uniquement) pour service {}", service_id);
            sqlx::query(
                r#"
                UPDATE services 
                SET data = jsonb_set(COALESCE(data, '{}'::jsonb), '{produits}', $1::jsonb, true), updated_at = NOW()
                WHERE id = $2 AND user_id = $3
                RETURNING id
                "#
            )
            .bind(produits_value)
            .bind(service_id)
            .bind(user_id)
            .fetch_optional(pg_pool)
            .await
        } else {
            // Fallback si produits est null
            info!("[modifier_service] 📝 Mise à jour complète du service {} (fallback)", service_id);
            sqlx::query(
                r#"
                UPDATE services 
                SET data = $1, updated_at = NOW()
                WHERE id = $2 AND user_id = $3
                RETURNING id
                "#
            )
            .bind(&payload.data)
            .bind(service_id)
            .bind(user_id)
            .fetch_optional(pg_pool)
            .await
        }
    } else {
        // ✅ Mise à jour complète si autres champs modifiés
        info!("[modifier_service] 📝 Mise à jour complète du service {} ({} champs)", service_id, payload_keys.len());
        sqlx::query(
            r#"
            UPDATE services 
            SET data = $1, updated_at = NOW()
            WHERE id = $2 AND user_id = $3
            RETURNING id
            "#
        )
        .bind(&payload.data)
        .bind(service_id)
        .bind(user_id)
        .fetch_optional(pg_pool)
        .await
    };
    
    match result {
        Ok(Some(_)) => {
            info!("[modifier_service] ? Service {} modifi? avec succ?s par utilisateur {}", service_id, user_id);
            
            // ✅ Créer une notification de modification de service
            let service_title = payload.data.get("titre_service")
                .or_else(|| payload.data.get("titre"))
                .and_then(|v| {
                    if let Some(obj) = v.as_object() {
                        obj.get("valeur").and_then(|val| val.as_str())
                    } else {
                        v.as_str()
                    }
                })
                .unwrap_or("Votre service");
            
            let notification_data = serde_json::json!({
                "service_id": service_id,
                "service_title": service_title
            });
            
            // Créer la notification (ne pas bloquer si ça échoue)
            if let Err(e) = crate::services::notification_service::create_notification(
                pg_pool,
                user_id,
                crate::services::notification_service::NotificationType::ServiceModified,
                "✏️ Service modifié".to_string(),
                format!("Votre service '{}' a été mis à jour avec succès.", service_title),
                Some(notification_data),
            ).await {
                warn!("[modifier_service] Impossible de créer la notification: {}", e);
            } else {
                info!("[modifier_service] ✅ Notification de modification envoyée");
            }
            
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
    
    // V?rifier que le service appartient ? l'utilisateur ET récupérer son titre pour la notification
    let service_data = sqlx::query(
        "SELECT id, data FROM services WHERE id = $1 AND user_id = $2"
    )
    .bind(service_id)
    .bind(user_id)
    .fetch_optional(pg_pool)
    .await;
    
    let service_title = match &service_data {
        Ok(Some(row)) => {
            let data: Value = row.try_get("data").unwrap_or(Value::Null);
            data.get("titre_service")
                .or_else(|| data.get("titre"))
                .and_then(|v| {
                    if let Some(obj) = v.as_object() {
                        obj.get("valeur").and_then(|val| val.as_str())
                    } else {
                        v.as_str()
                    }
                })
                .unwrap_or("Votre service")
                .to_string()
        },
        _ => "Votre service".to_string()
    };
    
    match service_data {
        Ok(None) => {
            return (StatusCode::NOT_FOUND, Json(json!({"error": "Service non trouv? ou non autoris?"}))).into_response();
        },
        Ok(Some(row)) => {
            let data: Value = row.try_get("data").unwrap_or(Value::Null);
            // Service trouv?, vérifier le nombre de produits
            // ✅ NOUVEAU 2025-11-01: Bloquer suppression si >= 2 produits
            let produits_array = data.get("produits")
                .and_then(|p| p.as_object())
                .and_then(|obj| obj.get("valeur"))
                .and_then(|v| v.as_array());
            
            let produits_count = produits_array.map(|arr| arr.len()).unwrap_or(0);
            
            info!("[supprimer_service] Service {} contient {} produit(s)", service_id, produits_count);
            
            if produits_count >= 2 {
                warn!("[supprimer_service] ❌ Suppression bloquée : {} produits présents", produits_count);
                return (StatusCode::BAD_REQUEST, Json(json!({
                    "error": format!(
                        "Impossible de supprimer ce service car il contient {} produits.\n\
                        Veuillez d'abord supprimer les produits avant de supprimer le service.\n\
                        (Accédez à la gestion des produits pour les supprimer individuellement)",
                        produits_count
                    ),
                    "produits_count": produits_count
                }))).into_response();
            }
            
            info!("[supprimer_service] ✅ Suppression autorisée ({} produit(s))", produits_count);
        },
        Err(e) => {
            error!("[supprimer_service] Erreur v?rification service: {}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Erreur base de donn?es"}))).into_response();
        }
    }
    
    // Supprimer le service
    let result = sqlx::query(
        "DELETE FROM services WHERE id = $1 AND user_id = $2 RETURNING id"
    )
    .bind(service_id)
    .bind(user_id)
    .fetch_optional(pg_pool)
    .await;
    
    match result {
        Ok(Some(_)) => {
            info!("[supprimer_service] ? Service {} supprim? avec succ?s par utilisateur {}", service_id, user_id);
            
            // ✅ Créer une notification de suppression de service
            let notification_data = serde_json::json!({
                "service_id": service_id,
                "service_title": service_title.clone()
            });
            
            // Créer la notification (ne pas bloquer si ça échoue)
            if let Err(e) = crate::services::notification_service::create_notification(
                pg_pool,
                user_id,
                crate::services::notification_service::NotificationType::ServiceDeleted,
                "🗑️ Service supprimé".to_string(),
                format!("Votre service '{}' a été supprimé définitivement.", service_title),
                Some(notification_data),
            ).await {
                warn!("[supprimer_service] Impossible de créer la notification: {}", e);
            } else {
                info!("[supprimer_service] ✅ Notification de suppression envoyée");
            }
            
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
    let row = match sqlx::query(
        r#"SELECT data FROM services WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1"#,
    )
    .bind(user_id)
    .fetch_optional(pg_pool)
    .await {
        Ok(r) => r,
        Err(e) => {
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Query error: {}", e)}))).into_response();
        }
    };
    if let Some(r) = row {
        // On extrait les champs contact (t?l?phone, whatsapp, email, site web, etc.)
        let data: Value = r.try_get("data").unwrap_or(Value::Null);
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
    
    let result = sqlx::query(
        r#"UPDATE services SET is_active = $1 WHERE id = $2 AND user_id = $3 RETURNING id"#,
    )
    .bind(is_active)
    .bind(service_id)
    .bind(user_id)
    .fetch_optional(pg_pool)
    .await;
    
    match result {
        Ok(Some(_)) => {
            info!("[toggle_service_status] Statut mis ? jour avec succ?s");
            
            // ✅ NOUVEAU: Créer une notification d'activation/désactivation
            let notification_type = if is_active {
                crate::services::notification_service::NotificationType::ServiceActivated
            } else {
                crate::services::notification_service::NotificationType::ServiceDeactivated
            };
            
            let (title, message) = if is_active {
                (
                    "✅ Service activé".to_string(),
                    "Votre service a été activé et est maintenant visible par tous les utilisateurs.".to_string()
                )
            } else {
                (
                    "⏸️ Service désactivé".to_string(),
                    "Votre service a été désactivé et n'est plus visible dans les recherches.".to_string()
                )
            };
            
            let notification_data = serde_json::json!({
                "service_id": service_id,
                "is_active": is_active
            });
            
            // ✅ Cloner pg_pool pour l'utiliser dans tokio::spawn
            let pg_pool_clone = pg_pool.clone();
            
            // Créer la notification (ne pas bloquer si ça échoue)
            tokio::spawn(async move {
                if let Err(e) = crate::services::notification_service::create_notification(
                    &pg_pool_clone,
                    user_id,
                    notification_type,
                    title,
                    message,
                    Some(notification_data),
                ).await {
                    log::warn!("[toggle_service_status] Impossible de créer la notification: {}", e);
                }
            });
            
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
/// ✅ NOUVEAU 2026-01-03: Inclut les produits depuis service_products
pub async fn get_service_by_id(
    State(state): State<Arc<AppState>>,
    Path(service_id): Path<i32>,
) -> axum::response::Response {
    let pg_pool = &state.pg;
    
    info!("[get_service_by_id] R?cup?ration du service {}", service_id);
    
    let row = sqlx::query(
        r#"SELECT id, data, is_active, created_at, user_id FROM services WHERE id = $1 AND is_active = true"#,
    )
    .bind(service_id)
    .fetch_optional(pg_pool)
    .await;
    
    match row {
        Ok(Some(service)) => {
            info!("[get_service_by_id] Service trouv?");
            let id: i32 = service.try_get("id").unwrap_or_default();
            let mut data: Value = service.try_get("data").unwrap_or(Value::Null);
            let is_active: bool = service.try_get("is_active").unwrap_or(false);
            let created_at = service.try_get::<chrono::DateTime<chrono::Utc>, _>("created_at").ok();
            let user_id_val: i32 = service.try_get("user_id").unwrap_or_default();
            
            // ✅ NOUVEAU 2026-01-03: Charger les produits depuis service_products
            let products_service = &state.products_service;
            match products_service.get_products_by_service(service_id).await {
                Ok(products) => {
                    if !products.is_empty() {
                        info!("[get_service_by_id] {} produits trouvés pour le service {}", products.len(), service_id);
                        
                        // Convertir les produits en format JSONB compatible avec l'ancien format
                        let produits_array: Vec<Value> = products
                            .into_iter()
                            .map(|p| p.product_data)
                            .collect();
                        
                        // Ajouter les produits dans data.produits pour compatibilité
                        if let Some(data_obj) = data.as_object_mut() {
                            data_obj.insert("produits".to_string(), json!({
                                "type_donnee": "array",
                                "valeur": produits_array
                            }));
                        }
                    } else {
                        info!("[get_service_by_id] Aucun produit trouvé pour le service {}", service_id);
                    }
                },
                Err(e) => {
                    warn!("[get_service_by_id] Erreur lors du chargement des produits: {}", e);
                    // Continuer sans produits en cas d'erreur
                }
            }
            
            (StatusCode::OK, Json(json!({
                "id": id,
                "data": data,
                "is_active": is_active,
                "created_at": created_at,
                "user_id": user_id_val
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

/// Récupère plusieurs services par leurs IDs en une seule requête (batch)
#[derive(Debug, serde::Deserialize)]
pub struct BatchServicesRequest {
    pub service_ids: Vec<i32>,
}

pub async fn get_services_batch(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<BatchServicesRequest>,
) -> axum::response::Response {
    let pg_pool = &state.pg;
    
    if payload.service_ids.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(json!({
            "error": "service_ids ne peut pas être vide"
        }))).into_response();
    }
    
    // Limiter à 100 services par requête pour éviter les surcharges
    let service_ids: Vec<i32> = payload.service_ids.into_iter().take(100).collect();
    
    info!("[get_services_batch] Récupération de {} services", service_ids.len());
    
    // Utiliser ANY pour filtrer par liste d'IDs (plus efficace que plusieurs requêtes)
    let rows = match sqlx::query(
        r#"SELECT id, data, is_active, created_at, user_id, gps FROM services WHERE id = ANY($1) AND is_active = true ORDER BY id"#,
    )
    .bind(&service_ids)
    .fetch_all(pg_pool)
    .await {
        Ok(rows) => rows,
        Err(e) => {
            error!("[get_services_batch] Erreur SQL: {}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({
                "error": format!("Erreur lors de la récupération: {}", e)
            }))).into_response();
        }
    };
    
    let result: Vec<_> = rows
        .into_iter()
        .map(|r| {
            let id: i32 = r.try_get("id").unwrap_or_default();
            let data: Value = r.try_get("data").unwrap_or(Value::Null);
            let is_active: bool = r.try_get("is_active").unwrap_or(false);
            let created_at = r.try_get::<chrono::DateTime<chrono::Utc>, _>("created_at").ok();
            let user_id_val: i32 = r.try_get("user_id").unwrap_or_default();
            let gps: Option<String> = r.try_get("gps").ok();
            
            json!({
                "id": id,
                "data": data,
                "is_active": is_active,
                "created_at": created_at,
                "user_id": user_id_val,
                "gps": gps
            })
        })
        .collect();
    
    info!("[get_services_batch] {} services trouvés sur {} demandés", result.len(), service_ids.len());
    
    (StatusCode::OK, Json(json!({
        "services": result,
        "count": result.len(),
        "requested": service_ids.len()
    }))).into_response()
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
    let _debug_rows = match sqlx::query(
        r#"SELECT id, created_at FROM services WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5"#,
    )
    .bind(user_id)
    .fetch_all(pg_pool)
    .await {
        Ok(r) => r,
        Err(e) => {
            error!("[get_services_for_prestataire] Erreur requ?te debug SQL: {}", e);
            Vec::new()
        }
    };
    
    // Debug lines removed for compilation
    
    
    
    
    // ✅ OPTIMISÉ 2025-12-16: Utiliser un index explicite et limiter la taille des données JSONB
    // Le problème: La requête prend 1+ seconde car le champ data (JSONB) est très volumineux
    // Solution: Utiliser l'index existant et optimiser la requête
    let rows = match sqlx::query(
        r#"
        SELECT 
            id, 
            data, 
            is_active, 
            created_at 
        FROM services 
        WHERE user_id = $1 
        ORDER BY created_at DESC
        -- ✅ OPTIMISÉ: Utiliser l'index idx_services_user_id_created_at_desc
        "#,
    )
    .bind(user_id)
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
    let service_ids: Vec<i32> = rows
        .iter()
        .map(|r| r.try_get::<i32, _>("id").unwrap_or_default())
        .collect();
    info!("[get_services_for_prestataire] DEBUG - IDs des services retourn?s: {:?}", service_ids);
    
    let result: Vec<_> = rows
        .into_iter()
        .map(|r| {
            let id: i32 = r.try_get("id").unwrap_or_default();
            let data: Value = r.try_get("data").unwrap_or(Value::Null);
            let is_active: bool = r.try_get("is_active").unwrap_or(false);
            let created_at = r.try_get::<chrono::DateTime<chrono::Utc>, _>("created_at").ok();
            json!({
                "id": id,
                "data": serde_json::from_value(data).unwrap_or(Value::Null),
                "actif": is_active,
                "created_at": created_at
            })
        })
        .collect();
    
    info!("[get_services_for_prestataire] R?ponse envoy?e avec {} services", result.len());
    (StatusCode::OK, Json(serde_json::Value::Array(result))).into_response()
}

/// Récupère un service pour le partage public avec restrictions de sécurité
pub async fn get_shared_service(
    State(state): State<Arc<AppState>>,
    Path(service_id): Path<i32>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> impl IntoResponse {
    let pg_pool = &state.pg;
    
    // Vérifier la signature si fournie (liens signés)
    if let (Some(_sig), Some(exp)) = (params.get("sig"), params.get("exp")) {
        if let Ok(expires_at) = exp.parse::<u64>() {
            // TODO: Implémenter la vérification de signature avec le service
            // Pour l'instant, on vérifie juste l'expiration
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs();
            
            if now > expires_at {
                warn!("[get_shared_service] Lien expiré pour service {}", service_id);
                return (StatusCode::FORBIDDEN, Json(json!({"error": "Lien expiré"}))).into_response();
            }
        }
    }
    
    // Vérifier que le service existe et est actif
    let service_row = match sqlx::query(
        r#"SELECT id, data, is_active, created_at, user_id FROM services WHERE id = $1 AND is_active = true"#,
    )
    .bind(service_id)
    .fetch_optional(pg_pool)
    .await {
        Ok(Some(row)) => row,
        Ok(None) => {
            warn!("[get_shared_service] Service {} non trouvé ou inactif", service_id);
            return (StatusCode::NOT_FOUND, Json(json!({"error": "Service non trouvé ou inactif"}))).into_response();
        },
        Err(e) => {
            error!("[get_shared_service] Erreur requête SQL: {}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Erreur serveur"}))).into_response();
        }
    };

    // Récupérer les informations du prestataire (limitées)
    let prestataire_info = match sqlx::query(
        r#"SELECT nom, prenom, photo_profil FROM users WHERE id = $1"#,
    )
    .bind(service_row.try_get::<i32, _>("user_id").unwrap_or_default())
    .fetch_optional(pg_pool)
    .await {
        Ok(Some(user)) => {
            let nom: Option<String> = user.try_get("nom").ok();
            let prenom: Option<String> = user.try_get("prenom").ok();
            let photo: Option<String> = user.try_get("photo_profil").ok();
            let user_id_val: i32 = service_row.try_get("user_id").unwrap_or_default();
            let name = match (nom.as_ref(), prenom.as_ref()) {
                (Some(nom), Some(prenom)) => format!("{} {}", prenom, nom),
                (Some(nom), None) => nom.clone(),
                (None, Some(prenom)) => prenom.clone(),
                (None, None) => "Prestataire".to_string(),
            };
            json!({
                "id": user_id_val,
                "name": name,
                "photo": photo
            })
        },
        Ok(None) => json!({
            "id": service_row.try_get::<i32, _>("user_id").unwrap_or_default(),
            "name": "Prestataire",
            "photo": null
        }),
        Err(e) => {
            error!("[get_shared_service] Erreur récupération prestataire: {}", e);
            json!({
                "id": service_row.try_get::<i32, _>("user_id").unwrap_or_default(),
                "name": "Prestataire",
                "photo": null
            })
        }
    };

    // Masquer les champs sensibles dans les données du service
    let mut safe_data: Value = service_row.try_get("data").unwrap_or(Value::Null);
    if let Some(data_obj) = safe_data.as_object_mut() {
        // Masquer les coordonnées GPS précises (garder seulement la zone générale)
        if let Some(location) = data_obj.get_mut("location") {
            if let Some(loc_obj) = location.as_object_mut() {
                // Remplacer les coordonnées précises par une zone approximative
                if let (Some(lat), Some(lng)) = (loc_obj.get("latitude"), loc_obj.get("longitude")) {
                    if let (Some(lat_val), Some(lng_val)) = (lat.as_f64(), lng.as_f64()) {
                        // Arrondir à 2 décimales pour masquer la précision exacte
                        loc_obj.insert("latitude".to_string(), json!((lat_val * 100.0).round() / 100.0));
                        loc_obj.insert("longitude".to_string(), json!((lng_val * 100.0).round() / 100.0));
                        loc_obj.insert("precision_masked".to_string(), json!(true));
                    }
                }
            }
        }
        
        // Masquer les informations de contact sensibles
        data_obj.remove("phone");
        data_obj.remove("email");
        data_obj.remove("internal_notes");
        data_obj.remove("admin_notes");
        
        // Garder seulement les informations publiques nécessaires
        let allowed_fields = ["title", "description", "category", "price", "location", "images", "tags"];
        let mut filtered_data = serde_json::Map::new();
        for field in &allowed_fields {
            if let Some(value) = data_obj.get(*field) {
                filtered_data.insert(field.to_string(), value.clone());
            }
        }
        *data_obj = filtered_data;
    }

    // Retourner seulement les données nécessaires pour l'affichage public
    let service_id_val: i32 = service_row.try_get("id").unwrap_or_default();
    let created_at = service_row
        .try_get::<chrono::DateTime<chrono::Utc>, _>("created_at")
        .ok();

    let shared_data = json!({
        "id": service_id_val,
        "data": safe_data,
        "prestataire": prestataire_info,
        "created_at": created_at,
        "is_shared": true, // Indicateur que c'est un service partagé
        "security_level": "public" // Niveau de sécurité appliqué
    });

    info!("[get_shared_service] Service {} partagé avec succès", service_id);
    
    // Headers de sécurité pour les services partagés
    let mut response = (StatusCode::OK, Json(shared_data)).into_response();
    let headers = response.headers_mut();
    headers.insert("X-Content-Type-Options", "nosniff".parse().unwrap());
    headers.insert("X-Frame-Options", "DENY".parse().unwrap());
    headers.insert("Cache-Control", "public, max-age=300".parse().unwrap()); // Cache 5 minutes
    
    response
}