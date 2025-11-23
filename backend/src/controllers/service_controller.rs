use std::sync::Arc;

use crate::middlewares::jwt::AuthenticatedUser;
use crate::state::AppState;
use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use log::{error, info, warn};
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::{FromRow, Row};
use serde_json::Value as JsonValue;

// use crate::services::mongo_history_service::MongoHistoryService;
// use crate::services::scoring_service::compute_score;

#[derive(FromRow)]
struct UserBalanceRow {
    tokens_balance: i64,
}

#[derive(FromRow)]
struct ServiceIdRow {
    id: i32,
}

#[derive(FromRow)]
struct ServiceDataOnlyRow {
    data: JsonValue,
}

#[derive(FromRow)]
struct ServiceDataIdRow {
    id: i32,
    data: JsonValue,
}

#[derive(FromRow)]
struct ServiceFullRow {
    id: i32,
    data: JsonValue,
    is_active: bool,
    created_at: sqlx::types::chrono::DateTime<sqlx::types::chrono::Utc>,
    user_id: i32,
    #[sqlx(default)]
    gps: Option<String>,
    #[sqlx(default)]
    category: Option<String>,
}

#[derive(FromRow)]
#[derive(sqlx::FromRow)]
struct ServiceIdCreatedRow {
    id: i32,
    created_at: sqlx::types::chrono::DateTime<sqlx::types::chrono::Utc>,
}

#[derive(FromRow)]
struct ServiceIdActiveRow {
    id: i32,
    data: JsonValue,
    is_active: bool,
    created_at: sqlx::types::chrono::DateTime<sqlx::types::chrono::Utc>,
}

#[derive(FromRow)]
struct UserInfoRow {
    #[sqlx(default)]
    nom: Option<String>,
    #[sqlx(default)]
    prenom: Option<String>,
    #[sqlx(default)]
    photo_profil: Option<String>,
}

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
    )
    .await
    {
        Ok((service_creation_result, tokens_consumed)) => {
            info!(
                "[creer_service] ? Service cr?? avec succ?s - Tokens consomm?s: {}",
                tokens_consumed
            );
            info!(
                "[creer_service] Type des tokens: {:?}",
                std::any::type_name_of_val(&tokens_consumed)
            );

            // Construire la r?ponse avec les headers de tokens
            let mut response =
                (StatusCode::CREATED, Json(service_creation_result.clone())).into_response();

            // ✅ CORRECTION : Le débit du solde est déjà fait dans creer_service.rs
            // On récupère juste le solde actuel pour mettre à jour le JWT
            let current_balance_result: Option<UserBalanceRow> = sqlx::query_as(
                "SELECT tokens_balance FROM users WHERE id = $1"
            )
            .bind(payload.user_id)
            .fetch_optional(&state.pg)
            .await
            .unwrap_or(None);

            if let Some(user_data) = current_balance_result {
                let nouveau_solde = user_data.tokens_balance;
                info!(
                    "[creer_service] ✅ Solde actuel pour utilisateur {}: {} FCFA (débit déjà effectué dans creer_service)",
                    payload.user_id,
                    nouveau_solde
                );

                // Mettre à jour le JWT avec le nouveau solde
                if let Ok(new_jwt) =
                    crate::middlewares::check_tokens::update_jwt_with_new_balance(
                        payload.user_id,
                        nouveau_solde,
                        &state,
                    )
                    .await
                {
                    response.headers_mut().insert(
                        "x-new-jwt",
                        axum::http::HeaderValue::from_str(&new_jwt)
                            .unwrap_or_else(|_| axum::http::HeaderValue::from_static("")),
                    );
                    info!(
                        "[creer_service] ?? JWT mis à jour avec le nouveau solde: {}",
                        nouveau_solde
                    );
                }
            }

            // ✅ CORRIGÉ : Calculer le coût depuis les tokens IA du payload
            let ia_tokens_consumed = payload.data
                .get("tokens_ia_externe")
                .and_then(|v| v.as_u64())
                .or_else(|| payload.data.get("tokens_consumed").and_then(|v| v.as_u64()))
                .unwrap_or(0) as i64;
            
            // Déterminer si c'est le premier produit (si tokens IA > 0)
            let is_first_product = ia_tokens_consumed > 0;
            
            // Calculer le coût en utilisant la même logique que creer_service
            let cost_xaf = if is_first_product {
                let cost = (ia_tokens_consumed as f64) * 0.004 * 100.0;
                cost.round() as i64
            } else {
                3000 // COST_NEW_PRODUCT_DUPLICATE_XAF
            };

            // Ajouter les headers avec les vraies valeurs
            response.headers_mut().insert(
                "x-tokens-consumed",
                axum::http::HeaderValue::from_str(&tokens_consumed.to_string())
                    .unwrap_or_else(|_| axum::http::HeaderValue::from_static("0")),
            );

            response.headers_mut().insert(
                "x-tokens-cost-xaf",
                axum::http::HeaderValue::from_str(&cost_xaf.to_string())
                    .unwrap_or_else(|_| axum::http::HeaderValue::from_static("0")),
            );

            info!(
                "[creer_service] Headers ajoutés: x-tokens-consumed={}, x-tokens-cost-xaf={}",
                tokens_consumed, cost_xaf
            );

            response
        }
        Err(e) => {
            error!("[creer_service] Erreur cr?ation service: {:?}", e);
            match e {
                crate::core::types::AppError::BadRequest(msg) => {
                    (StatusCode::BAD_REQUEST, Json(json!({"error": msg}))).into_response()
                }
                crate::core::types::AppError::Internal(msg) => (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({"error": msg})),
                )
                    .into_response(),
                _ => (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({"error": "Erreur cr?ation service"})),
                )
                    .into_response(),
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
    info!(
        "[reactivate_service] Called for service_id={}, user_id={}, extend_hours={}",
        service_id, user_id, params.extend_hours
    );
    let pg_pool = &state.pg;
    let mut conn = match pg_pool.acquire().await {
        Ok(c) => c,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": format!("DB acquire error: {}", e)})),
            )
                .into_response();
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
    .await
    {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": format!("Update error: {}", e)})),
        )
            .into_response();
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
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": format!("DB acquire error: {}", e)})),
            )
                .into_response();
        }
    };
    let lang = payload.lang.clone().unwrap_or_else(|| "fr".to_string());
    if let Err(e) = sqlx::query(
        r#"
        INSERT INTO users (email, password_hash, preferred_lang)
        VALUES ($1, $2, $3)
        "#
    )
    .bind(&payload.email)
    .bind(&payload.password_hash)
    .bind(&lang)
    .execute(&mut *conn)
    .await
    {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": format!("Insert error: {}", e)})),
        )
            .into_response();
    }
    (
        StatusCode::CREATED,
        Json(json!({"message": "Utilisateur enregistr? avec succ?s"})),
    )
        .into_response()
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
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": format!("Query error: {}", e)})),
            )
                .into_response();
        }
    };

    let result: Vec<_> = rows
        .into_iter()
        .map(|r| {
            json!({
                "id": r.try_get::<i32, _>("id").unwrap_or_default(),
                "data": r.try_get::<Value, _>("data").unwrap_or(Value::Null),
                "is_active": r.try_get::<bool, _>("is_active").unwrap_or(false)
            })
        })
        .collect();

    (StatusCode::OK, Json(serde_json::Value::Array(result))).into_response()
}

pub async fn get_related_services(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i32>,
) -> axum::response::Response {
    info!("[get_related_services] Called for id={}", id);
    let pg_pool = &state.pg;
    let rows: Vec<ServiceDataIdRow> = match sqlx::query_as(
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
    .await
    {
        Ok(r) => r,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": format!("Query error: {}", e)})),
            )
                .into_response();
        }
    };

    let result: Vec<_> = rows
        .into_iter()
        .map(|r| {
            json!({
                "id": r.id,
                "data": serde_json::from_value(r.data).unwrap_or(Value::Null)
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
        return axum::response::IntoResponse::into_response((
            axum::http::StatusCode::FORBIDDEN,
            Json(serde_json::json!({"error": "Acc?s r?serv? ? l'admin"})),
        ));
    }
    if req.new_value < 1 || req.new_value > 10000 {
        return axum::response::IntoResponse::into_response((
            axum::http::StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error": "Valeur hors limites autoris?es (1-10000)"})),
        ));
    }
    // TOKEN_DEBIT_PER_CLICK.store(req.new_value, std::sync::atomic::Ordering::Relaxed);
    axum::response::IntoResponse::into_response((
        axum::http::StatusCode::OK,
        Json(serde_json::json!({"message": "Montant modifi?", "nouvelle_valeur": req.new_value})),
    ))
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
    info!(
        "[modifier_service] Called for service_id={}, user_id={}",
        service_id, user_id
    );

    let pg_pool = &state.pg;

    // V?rifier que le service appartient ? l'utilisateur
    let service_exists: Option<ServiceIdRow> = match sqlx::query_as(
        "SELECT id FROM services WHERE id = $1 AND user_id = $2"
    )
    .bind(service_id)
    .bind(user_id)
    .fetch_optional(pg_pool)
    .await {
        Ok(row) => row,
        Err(e) => {
            error!("[modifier_service] Erreur v?rification service: {}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Erreur base de donn?es"})),
            )
                .into_response();
        }
    };

    if service_exists.is_none() {
        return (
            StatusCode::NOT_FOUND,
            Json(json!({"error": "Service non trouv? ou non autoris?"})),
        )
            .into_response();
    }

    // Mettre ? jour le service
    let result: Option<ServiceIdRow> = match sqlx::query_as(
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
    .await {
        Ok(row) => row,
        Err(e) => {
            error!("[modifier_service] Erreur mise ? jour service: {}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Erreur lors de la modification"})),
            )
                .into_response();
        }
    };

    match result {
        Some(_) => {
            info!(
                "[modifier_service] ? Service {} modifi? avec succ?s par utilisateur {}",
                service_id, user_id
            );

            // ✅ Créer une notification de modification de service
            let service_title = payload
                .data
                .get("titre_service")
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
                format!(
                    "Votre service '{}' a été mis à jour avec succès.",
                    service_title
                ),
                Some(notification_data),
            )
            .await
            {
                warn!(
                    "[modifier_service] Impossible de créer la notification: {}",
                    e
                );
            } else {
                info!("[modifier_service] ✅ Notification de modification envoyée");
            }

            (
                StatusCode::OK,
                Json(json!({
                    "message": "Service modifi? avec succ?s",
                    "service_id": service_id
                })),
            )
                .into_response()
        }
        None => {
            warn!("[modifier_service] Service non trouv? apr?s mise ? jour");
            (
                StatusCode::NOT_FOUND,
                Json(json!({"error": "Service non trouv?"})),
            )
                .into_response()
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
    info!(
        "[supprimer_service] Called for service_id={}, user_id={}",
        service_id, user_id
    );

    let pg_pool = &state.pg;

    // V?rifier que le service appartient ? l'utilisateur ET récupérer son titre pour la notification
    let service_data: Option<ServiceDataIdRow> = match sqlx::query_as(
        "SELECT id, data FROM services WHERE id = $1 AND user_id = $2"
    )
    .bind(service_id)
    .bind(user_id)
    .fetch_optional(pg_pool)
    .await {
        Ok(row) => row,
        Err(e) => {
            error!("[supprimer_service] Erreur v?rification service: {}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Erreur base de donn?es"})),
            )
                .into_response();
        }
    };

    let service_title = match &service_data {
        Some(row) => row
            .data
            .get("titre_service")
            .or_else(|| row.data.get("titre"))
            .and_then(|v| {
                if let Some(obj) = v.as_object() {
                    obj.get("valeur").and_then(|val| val.as_str())
                } else {
                    v.as_str()
                }
            })
            .unwrap_or("Votre service")
            .to_string(),
        None => "Votre service".to_string(),
    };

    match service_data {
        None => {
            return (
                StatusCode::NOT_FOUND,
                Json(json!({"error": "Service non trouv? ou non autoris?"})),
            )
                .into_response();
        }
        Some(row) => {
            // Service trouv?, vérifier le nombre de produits
            // ✅ NOUVEAU 2025-11-01: Bloquer suppression si >= 2 produits
            let produits_array = row
                .data
                .get("produits")
                .and_then(|p| p.as_object())
                .and_then(|obj| obj.get("valeur"))
                .and_then(|v| v.as_array());

            let produits_count = produits_array.map(|arr| arr.len()).unwrap_or(0);

            info!(
                "[supprimer_service] Service {} contient {} produit(s)",
                service_id, produits_count
            );

            if produits_count >= 2 {
                warn!(
                    "[supprimer_service] ❌ Suppression bloquée : {} produits présents",
                    produits_count
                );
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

            info!(
                "[supprimer_service] ✅ Suppression autorisée ({} produit(s))",
                produits_count
            );
        }
    }

    // Supprimer le service
    let result: Option<ServiceIdRow> = sqlx::query_as(
        "DELETE FROM services WHERE id = $1 AND user_id = $2 RETURNING id"
    )
    .bind(service_id)
    .bind(user_id)
    .fetch_optional(pg_pool)
    .await
    .unwrap_or(None);

    match result {
        Some(_) => {
            info!(
                "[supprimer_service] ? Service {} supprim? avec succ?s par utilisateur {}",
                service_id, user_id
            );

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
                format!(
                    "Votre service '{}' a été supprimé définitivement.",
                    service_title
                ),
                Some(notification_data),
            )
            .await
            {
                warn!(
                    "[supprimer_service] Impossible de créer la notification: {}",
                    e
                );
            } else {
                info!("[supprimer_service] ✅ Notification de suppression envoyée");
            }

            (
                StatusCode::OK,
                Json(json!({
                    "message": "Service supprim? avec succ?s",
                    "service_id": service_id
                })),
            )
                .into_response()
        }
        None => {
            warn!("[supprimer_service] Service non trouv? apr?s suppression");
            (
                StatusCode::NOT_FOUND,
                Json(json!({"error": "Service non trouv?"})),
            )
                .into_response()
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
        assert!(
            res.is_ok(),
            "La validation stricte doit passer pour un payload conforme: {res:?}"
        );
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
        assert!(
            res.is_err(),
            "La validation doit ?chouer si 'titre' est une string brute"
        );
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
        assert!(
            res.is_err(),
            "La validation doit ?chouer si 'titre.valeur' est vide"
        );
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
    let row: Option<ServiceDataOnlyRow> = match sqlx::query_as(
        r#"SELECT data FROM services WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1"#
    )
    .bind(user_id)
    .fetch_optional(pg_pool)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": format!("Query error: {}", e)})),
            )
                .into_response();
        }
    };
    if let Some(r) = row {
        // On extrait les champs contact (t?l?phone, whatsapp, email, site web, etc.)
        let data = r.data; // r.data est d?j? un Value, pas besoin de from_value
        let phone = data.get("telephone").cloned().unwrap_or(Value::Null);
        let whatsapp = data.get("whatsapp").cloned().unwrap_or(Value::Null);
        let email = data.get("email").cloned().unwrap_or(Value::Null);
        // Recherche site web (siteweb, site, url, website...)
        let siteweb = data
            .get("siteweb")
            .or_else(|| data.get("site"))
            .or_else(|| data.get("url"))
            .or_else(|| data.get("website"))
            .cloned()
            .unwrap_or(Value::Null);
        return (
            StatusCode::OK,
            Json(json!({
                "telephone": phone,
                "whatsapp": whatsapp,
                "email": email,
                "siteweb": siteweb
            })),
        )
            .into_response();
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

    info!(
        "[toggle_service_status] Changement de statut pour service {} par utilisateur {}",
        service_id, user_id
    );

    let is_active = payload
        .get("actif")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);

    let result: Option<ServiceIdRow> = sqlx::query_as(
        r#"UPDATE services SET is_active = $1 WHERE id = $2 AND user_id = $3 RETURNING id"#
    )
    .bind(is_active)
    .bind(service_id)
    .bind(user_id)
    .fetch_optional(pg_pool)
    .await
    .unwrap_or(None);

    match result {
        Some(_) => {
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
                    "Votre service a été désactivé et n'est plus visible dans les recherches."
                        .to_string(),
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
                )
                .await
                {
                    log::warn!(
                        "[toggle_service_status] Impossible de créer la notification: {}",
                        e
                    );
                }
            });

            (
                StatusCode::OK,
                Json(json!({
                    "success": true,
                    "message": if is_active { "Service activ?" } else { "Service d?sactiv?" }
                })),
            )
                .into_response()
        }
        None => {
            warn!("[toggle_service_status] Service non trouv? ou non autoris?");
            (
                StatusCode::NOT_FOUND,
                Json(json!({
                    "error": "Service non trouv? ou non autoris?"
                })),
            )
                .into_response()
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

    let row: Option<ServiceFullRow> = match sqlx::query_as(
        r#"SELECT id, data, is_active, created_at, user_id FROM services WHERE id = $1 AND is_active = true"#
    )
    .bind(service_id)
    .fetch_optional(pg_pool)
    .await {
        Ok(row) => row,
        Err(e) => {
            error!("[get_service_by_id] Erreur SQL: {}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({
                    "error": format!("Erreur lors de la r?cup?ration: {}", e)
                })),
            )
                .into_response();
        }
    };

    match row {
        Some(service) => {
            info!("[get_service_by_id] Service trouv?");
            (
                StatusCode::OK,
                Json(json!({
                    "id": service.id,
                    "data": service.data,
                    "is_active": service.is_active,
                    "created_at": service.created_at,
                    "user_id": service.user_id
                })),
            )
                .into_response()
        }
        None => {
            warn!("[get_service_by_id] Service non trouv? ou inactif");
            (
                StatusCode::NOT_FOUND,
                Json(json!({
                    "error": "Service non trouv? ou inactif"
                })),
            )
                .into_response()
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

    info!(
        "[get_services_for_prestataire] R?cup?ration des services pour utilisateur {}",
        user_id
    );

    // ✅ DEBUG: Vérifier si l'utilisateur existe et est provider
    let user_is_provider: Option<bool> = match sqlx::query_scalar::<_, bool>(
        r#"SELECT is_provider FROM users WHERE id = $1"#
    )
    .bind(user_id)
    .fetch_optional(pg_pool)
    .await {
        Ok(Some(is_provider)) => {
            info!(
                "[get_services_for_prestataire] ✅ Utilisateur {} trouvé: is_provider={}",
                user_id, is_provider
            );
            Some(is_provider)
        },
        Ok(None) => {
            error!("[get_services_for_prestataire] ❌ Utilisateur {} introuvable dans la base de données", user_id);
            None
        },
        Err(e) => {
            error!("[get_services_for_prestataire] ❌ Erreur vérification utilisateur: {}", e);
            None
        }
    };

    // ✅ DEBUG: Log des 5 derniers services créés pour debug
    let debug_rows: Vec<ServiceIdCreatedRow> = match sqlx::query_as::<_, ServiceIdCreatedRow>(
        r#"SELECT id, created_at FROM services WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5"#
    )
    .bind(user_id)
    .fetch_all(pg_pool)
    .await {
        Ok(r) => {
            info!(
                "[get_services_for_prestataire] 🔍 DEBUG - {} service(s) trouvé(s) dans la requête de debug (derniers 5)",
                r.len()
            );
            for row in &r {
                info!("[get_services_for_prestataire] 🔍   - Service ID: {}, créé le: {}", row.id, row.created_at);
            }
            r
        },
        Err(e) => {
            error!("[get_services_for_prestataire] Erreur requ?te debug SQL: {}", e);
            Vec::new()
        }
    };

    // ✅ DEBUG: Compter tous les services (actifs et inactifs)
    let total_services_count: i64 = match sqlx::query_scalar::<_, i64>(
        r#"SELECT COUNT(*) FROM services WHERE user_id = $1"#
    )
    .bind(user_id)
    .fetch_one(pg_pool)
    .await {
        Ok(count) => {
            info!("[get_services_for_prestataire] 📊 Total services dans DB pour user {}: {}", user_id, count);
            count
        },
        Err(e) => {
            error!("[get_services_for_prestataire] Erreur comptage services: {}", e);
            0
        }
    };

    let rows: Vec<ServiceIdActiveRow> = match sqlx::query_as(
        r#"SELECT id, data, is_active, created_at FROM services WHERE user_id = $1 ORDER BY created_at DESC"#
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

    info!(
        "[get_services_for_prestataire] {} services trouv?s pour utilisateur {}",
        rows.len(),
        user_id
    );

    // Log des IDs des services retourn?s pour debug
    let service_ids: Vec<i32> = rows.iter().map(|r| r.id).collect();
    info!(
        "[get_services_for_prestataire] DEBUG - IDs des services retourn?s: {:?}",
        service_ids
    );

    let result: Vec<_> = rows
        .into_iter()
        .map(|r| {
            json!({
                "id": r.id,
                "data": serde_json::from_value(r.data).unwrap_or(Value::Null),
                "actif": r.is_active,
                "created_at": r.created_at
            })
        })
        .collect();

    info!(
        "[get_services_for_prestataire] R?ponse envoy?e avec {} services",
        result.len()
    );
    (StatusCode::OK, Json(serde_json::Value::Array(result))).into_response()
}

/// ✅ NOUVEAU : Liste des services avec pagination
#[derive(Debug, Deserialize)]
pub struct ServicesListQuery {
    pub limit: Option<i32>,
    pub offset: Option<i32>,
}

pub async fn get_services_list(
    State(state): State<Arc<AppState>>,
    Query(query): Query<ServicesListQuery>,
) -> axum::response::Response {
    let limit = query.limit.unwrap_or(20);
    let offset = query.offset.unwrap_or(0);
    let pg_pool = &state.pg;

    info!(
        "[get_services_list] Récupération {} services (offset: {})",
        limit, offset
    );

    let result: Vec<ServiceFullRow> = match sqlx::query_as(
        r#"
        SELECT id, data, created_at, user_id, gps, category, is_active
        FROM services
        WHERE is_active = TRUE
        ORDER BY created_at DESC
        LIMIT $1 OFFSET $2
        "#
    )
    .bind(limit as i64)
    .bind(offset as i64)
    .fetch_all(pg_pool)
    .await {
        Ok(rows) => rows,
        Err(e) => {
            error!("[get_services_list] ❌ Erreur: {}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({
                    "success": false,
                    "error": "Erreur lors de la récupération des services"
                })),
            )
                .into_response();
        }
    };

    let mut services: Vec<Value> = result
        .iter()
        .map(|row| {
            let service_data = json!({
                "id": row.id,
                "data": row.data,
                "created_at": row.created_at,
                "user_id": row.user_id,
                "gps": row.gps,
                "category": row.category,
                "is_active": row.is_active
            });
            service_data
        })
        .collect();

    {

        // ✅ NOUVEAU : Enrichir les produits avec les données de disponibilité
        let enrichment_service = crate::services::product_enrichment_service::ProductEnrichmentService::new(pg_pool.clone());
        if let Err(e) = enrichment_service.enrich_services(&mut services).await {
            error!("[get_services_list] ⚠️ Erreur enrichissement produits: {}", e);
            // Continuer même en cas d'erreur d'enrichissement
        }

        info!("[get_services_list] ✅ {} services trouvés", services.len());
        (
            StatusCode::OK,
            Json(json!({
                "success": true,
                "data": services,
                "count": services.len()
            })),
        )
            .into_response()
    }
}

/// ✅ NOUVEAU : Services récents avec produits
#[derive(Debug, Deserialize)]
pub struct ServicesRecentQuery {
    pub limit: Option<i32>,
    pub include_products: Option<bool>,
}

pub async fn get_services_recent(
    State(state): State<Arc<AppState>>,
    Query(query): Query<ServicesRecentQuery>,
) -> axum::response::Response {
    let limit = query.limit.unwrap_or(20);
    let include_products = query.include_products.unwrap_or(true);
    let pg_pool = &state.pg;

    info!(
        "[get_services_recent] Récupération {} services récents (include_products: {})",
        limit, include_products
    );

    let result: Vec<ServiceFullRow> = match sqlx::query_as(
        r#"
        SELECT id, data, created_at, user_id, gps, category, is_active
        FROM services
        WHERE is_active = TRUE
        AND created_at >= NOW() - INTERVAL '30 days'
        ORDER BY created_at DESC
        LIMIT $1
        "#
    )
    .bind(limit as i64)
    .fetch_all(pg_pool)
    .await {
        Ok(rows) => rows,
        Err(e) => {
            error!("[get_services_recent] ❌ Erreur: {}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({
                    "success": false,
                    "error": "Erreur lors de la récupération des services récents"
                })),
            )
                .into_response();
        }
    };

    let mut services: Vec<Value> = result
        .iter()
        .map(|row| {
            json!({
                "id": row.id,
                "data": row.data,
                "created_at": row.created_at,
                "user_id": row.user_id,
                "gps": row.gps,
                "category": row.category,
                "is_active": row.is_active
            })
        })
        .collect();

    // ✅ NOUVEAU : Enrichir les produits avec les données de disponibilité
    let enrichment_service = crate::services::product_enrichment_service::ProductEnrichmentService::new(pg_pool.clone());
    if let Err(e) = enrichment_service.enrich_services(&mut services).await {
        error!("[get_services_recent] ⚠️ Erreur enrichissement produits: {}", e);
        // Continuer même en cas d'erreur d'enrichissement
    }

    info!(
        "[get_services_recent] ✅ {} services récents trouvés",
        services.len()
    );
    (
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": services,
            "count": services.len()
        })),
    )
        .into_response()
}

/// ✅ NOUVEAU : Alias pour mes services (compatibilité mobile)
pub async fn get_my_services(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
) -> axum::response::Response {
    info!(
        "[get_my_services] Redirection vers get_services_for_prestataire pour user_id={}",
        user.id
    );
    get_services_for_prestataire(State(state), Extension(user)).await
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
                warn!(
                    "[get_shared_service] Lien expiré pour service {}",
                    service_id
                );
                return (StatusCode::FORBIDDEN, Json(json!({"error": "Lien expiré"})))
                    .into_response();
            }
        }
    }

    // Vérifier que le service existe et est actif
    let service_row: Option<ServiceFullRow> = match sqlx::query_as(
        r#"SELECT id, data, is_active, created_at, user_id FROM services WHERE id = $1 AND is_active = true"#
    )
    .bind(service_id)
    .fetch_optional(pg_pool)
    .await {
        Ok(row) => row,
        Err(e) => {
            error!("[get_shared_service] Erreur requête SQL: {}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Erreur serveur"}))).into_response();
        }
    };

    let service_row = match service_row {
        Some(row) => row,
        None => {
            warn!("[get_shared_service] Service {} non trouvé ou inactif", service_id);
            return (StatusCode::NOT_FOUND, Json(json!({"error": "Service non trouvé ou inactif"}))).into_response();
        }
    };

    // Récupérer les informations du prestataire (limitées)
    let prestataire_info: Option<UserInfoRow> = match sqlx::query_as(
        r#"SELECT nom, prenom, photo_profil FROM users WHERE id = $1"#
    )
    .bind(service_row.user_id)
    .fetch_optional(pg_pool)
    .await
    {
        Ok(user) => user,
        Err(e) => {
            error!(
                "[get_shared_service] Erreur récupération prestataire: {}",
                e
            );
            None
        }
    };

    let prestataire_info = match prestataire_info {
        Some(user) => {
            let name = match (user.nom.as_ref(), user.prenom.as_ref()) {
                (Some(nom), Some(prenom)) => format!("{} {}", prenom, nom),
                (Some(nom), None) => nom.clone(),
                (None, Some(prenom)) => prenom.clone(),
                (None, None) => "Prestataire".to_string(),
            };
            json!({
                "id": service_row.user_id,
                "name": name,
                "photo": user.photo_profil
            })
        }
        None => json!({
            "id": service_row.user_id,
            "name": "Prestataire",
            "photo": null
        })
    };

    // Masquer les champs sensibles dans les données du service
    let mut safe_data = service_row.data.clone();
    if let Some(data_obj) = safe_data.as_object_mut() {
        // Masquer les coordonnées GPS précises (garder seulement la zone générale)
        if let Some(location) = data_obj.get_mut("location") {
            if let Some(loc_obj) = location.as_object_mut() {
                // Remplacer les coordonnées précises par une zone approximative
                if let (Some(lat), Some(lng)) = (loc_obj.get("latitude"), loc_obj.get("longitude"))
                {
                    if let (Some(lat_val), Some(lng_val)) = (lat.as_f64(), lng.as_f64()) {
                        // Arrondir à 2 décimales pour masquer la précision exacte
                        loc_obj.insert(
                            "latitude".to_string(),
                            json!((lat_val * 100.0).round() / 100.0),
                        );
                        loc_obj.insert(
                            "longitude".to_string(),
                            json!((lng_val * 100.0).round() / 100.0),
                        );
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
        let allowed_fields = [
            "title",
            "description",
            "category",
            "price",
            "location",
            "images",
            "tags",
        ];
        let mut filtered_data = serde_json::Map::new();
        for field in &allowed_fields {
            if let Some(value) = data_obj.get(*field) {
                filtered_data.insert(field.to_string(), value.clone());
            }
        }
        *data_obj = filtered_data;
    }

    // Retourner seulement les données nécessaires pour l'affichage public
    let shared_data = json!({
        "id": service_row.id,
        "data": safe_data,
        "prestataire": prestataire_info,
        "created_at": service_row.created_at,
        "is_shared": true, // Indicateur que c'est un service partagé
        "security_level": "public" // Niveau de sécurité appliqué
    });

    info!(
        "[get_shared_service] Service {} partagé avec succès",
        service_id
    );

    // Headers de sécurité pour les services partagés
    let mut response = (StatusCode::OK, Json(shared_data)).into_response();
    let headers = response.headers_mut();
    headers.insert("X-Content-Type-Options", "nosniff".parse().unwrap());
    headers.insert("X-Frame-Options", "DENY".parse().unwrap());
    headers.insert("Cache-Control", "public, max-age=300".parse().unwrap()); // Cache 5 minutes

    response
}
