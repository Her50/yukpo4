use axum::{
    body::Body,
    http::Request,
    middleware::Next,
    response::Response,
    extract::State,
    Extension,
};
use crate::state::AppState;
use crate::middlewares::jwt::AuthenticatedUser;
use std::sync::Arc;
use std::convert::Infallible;
use log::{info, warn, error};
use sqlx;

/// ?? Co?t d'une interaction sur un service pour le prestataire (en XAF/10)
const COUT_INTERACTION_SERVICE_XAF_DIXIEME: i64 = 1; // 1 * 0.1 XAF = 0.1 XAF

/// Middleware pour g?rer les interactions sur les services avec anti-spam et d?bit du prestataire
pub async fn track_service_interaction(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    req: Request<Body>,
    next: Next,
) -> Result<Response, Infallible> {
    let user_id = user.id;
    
    // Extraire l'ID du service depuis l'URL
    let service_id = extract_service_id_from_path(req.uri().path());
    
    if let Some(service_id) = service_id {
        // D?terminer le type d'interaction selon la route
        let interaction_type = determine_interaction_type(req.uri().path(), req.method());
        
        // V?rifier si l'utilisateur a d?j? interagi r?cemment (anti-spam)
        // TODO: R?activer apr?s cr?ation de la table service_interactions_tracking
        let should_debit_provider = true; // Temporaire : toujours d?biter
        
        /*
        let recent_interaction = sqlx::query!(
            r#"
            SELECT id, tokens_debited FROM service_interactions_tracking 
            WHERE user_id = $1 AND service_id = $2 AND interaction_type = $3 
            AND created_at > NOW() - INTERVAL '1 hour'
            ORDER BY created_at DESC LIMIT 1
            "#,
            user_id,
            service_id,
            interaction_type
        )
        .fetch_optional(&state.pg)
        .await;
        
        let mut should_debit_provider = false;
        
        match recent_interaction {
            Ok(Some(interaction)) => {
                if !interaction.tokens_debited {
                    // Interaction r?cente existe mais pas encore d?bit?e
                    should_debit_provider = true;
                }
                info!("[track_service_interaction] Interaction r?cente trouv?e pour utilisateur {} sur service {}", user_id, service_id);
            },
            Ok(None) => {
                // Premi?re interaction ou interaction ancienne
                should_debit_provider = true;
                
                // Enregistrer la nouvelle interaction
                let insert_result = sqlx::query!(
                    r#"
                    INSERT INTO service_interactions_tracking 
                    (user_id, service_id, interaction_type, tokens_debited, ip_address, user_agent)
                    VALUES ($1, $2, $3, FALSE, NULL, NULL)
                    "#,
                    user_id,
                    service_id,
                    interaction_type
                )
                .execute(&state.pg)
                .await;
                
                if let Err(e) = insert_result {
                    error!("[track_service_interaction] Erreur insertion interaction: {}", e);
                }
            },
            Err(e) => {
                error!("[track_service_interaction] Erreur v?rification interaction: {}", e);
            }
        }
        */
        
        // D?biter le prestataire si n?cessaire
        if should_debit_provider {
            debit_service_provider(service_id, &state.pg, user_id, &interaction_type).await;
        }
    }
    
    // Continuer avec la requ?te normale
    Ok(next.run(req).await)
}

/// Extraire l'ID du service depuis le chemin de l'URL
fn extract_service_id_from_path(path: &str) -> Option<i32> {
    // Exemples de chemins : /services/123/message, /services/456/review
    let parts: Vec<&str> = path.split('/').collect();
    if parts.len() >= 3 && parts[1] == "services" {
        parts[2].parse().ok()
    } else {
        None
    }
}

/// D?terminer le type d'interaction selon la route et m?thode HTTP
fn determine_interaction_type(path: &str, method: &axum::http::Method) -> String {
    if path.contains("/message") {
        "message".to_string()
    } else if path.contains("/review") {
        "review".to_string()
    } else if path.contains("/call") {
        "call".to_string()
    } else if path.contains("/share") {
        "share".to_string()
    } else if method == axum::http::Method::GET {
        "view".to_string()
    } else {
        "interaction".to_string()
    }
}

/// D?biter le prestataire du service
async fn debit_service_provider(
    service_id: i32, 
    pool: &sqlx::PgPool, 
    interacting_user_id: i32,
    interaction_type: &str
) {
    // R?cup?rer l'ID du prestataire (propri?taire du service)
    let provider_result = sqlx::query!(
        "SELECT user_id FROM services WHERE id = $1",
        service_id
    )
    .fetch_optional(pool)
    .await;
    
    match provider_result {
        Ok(Some(service)) => {
            let provider_id = service.user_id;
            
            // Ne pas d?biter si l'utilisateur interagit avec son propre service
            if provider_id == interacting_user_id {
                info!("[debit_service_provider] Pas de d?bit: utilisateur {} interagit avec son propre service {}", interacting_user_id, service_id);
                return;
            }
            
            // V?rifier le solde du prestataire
            let balance_result = sqlx::query!(
                "SELECT tokens_balance FROM users WHERE id = $1",
                provider_id
            )
            .fetch_optional(pool)
            .await;
            
            match balance_result {
                Ok(Some(user)) => {
                    if user.tokens_balance >= COUT_INTERACTION_SERVICE_XAF_DIXIEME {
                        // D?biter le prestataire
                        let nouveau_solde = user.tokens_balance - COUT_INTERACTION_SERVICE_XAF_DIXIEME;
                        let update_result = sqlx::query!(
                            "UPDATE users SET tokens_balance = $1 WHERE id = $2",
                            nouveau_solde,
                            provider_id
                        )
                        .execute(pool)
                        .await;
                        
                        match update_result {
                            Ok(_) => {
                                info!("[debit_service_provider] Prestataire {} d?bit? de {}XAF pour interaction {} sur service {} par utilisateur {}", 
                                    provider_id, COUT_INTERACTION_SERVICE_XAF_DIXIEME as f64 / 10.0, interaction_type, service_id, interacting_user_id);
                                
                                // TODO: R?activer apr?s cr?ation de la table service_interactions_tracking
                                /*
                                // Marquer l'interaction comme d?bit?e
                                let mark_result = sqlx::query!(
                                    r#"
                                    UPDATE service_interactions_tracking 
                                    SET tokens_debited = TRUE 
                                    WHERE user_id = $1 AND service_id = $2 AND interaction_type = $3 
                                    AND created_at > NOW() - INTERVAL '1 hour'
                                    "#,
                                    interacting_user_id,
                                    service_id,
                                    interaction_type
                                )
                                .execute(pool)
                                .await;
                                
                                if let Err(e) = mark_result {
                                    error!("[debit_service_provider] Erreur marquage interaction: {}", e);
                                }
                                */
                            },
                            Err(e) => {
                                error!("[debit_service_provider] Erreur d?bit prestataire {}: {}", provider_id, e);
                            }
                        }
                    } else {
                        warn!("[debit_service_provider] Solde insuffisant pour prestataire {}: {} < {}", 
                            provider_id, user.tokens_balance, COUT_INTERACTION_SERVICE_XAF_DIXIEME);
                    }
                },
                Ok(None) => {
                    error!("[debit_service_provider] Prestataire {} introuvable", provider_id);
                },
                Err(e) => {
                    error!("[debit_service_provider] Erreur r?cup?ration solde prestataire {}: {}", provider_id, e);
                }
            }
        },
        Ok(None) => {
            error!("[debit_service_provider] Service {} introuvable", service_id);
        },
        Err(e) => {
            error!("[debit_service_provider] Erreur r?cup?ration service {}: {}", service_id, e);
        }
    }
}
