// ✅ NOUVEAU 2025-11-01 : Contrôleur pour l'ajout incrémental de produits
// Ce contrôleur permet d'ajouter un nouveau produit à un service existant
// sans réenvoyer tout le service, avec un coût fixe de 3000 FCFA

use crate::core::types::{AppError, AppResult};
use crate::state::AppState;
use axum::{
    extract::{Path, State},
    Extension, Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::Row;
use std::sync::Arc;

#[derive(Debug, Deserialize)]
pub struct AddProductRequest {
    pub user_id: i32,
    pub product_data: Value, // Données du nouveau produit uniquement
}

#[derive(Debug, Serialize)]
pub struct AddProductResponse {
    pub success: bool,
    pub service_id: i32,
    pub product_index: usize,
    pub cost: i64,
    pub message: String,
}

/// Ajouter un nouveau produit à un service existant
/// Route : POST /api/services/{service_id}/products
#[axum::debug_handler]
pub async fn add_product_to_service(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<crate::middlewares::jwt::AuthenticatedUser>,
    Path(service_id): Path<i32>,
    Json(request): Json<AddProductRequest>,
) -> AppResult<Json<Value>> {
    use crate::utils::log::{log_error, log_info};

    log_info(&format!(
        "[add_product_to_service] 📦 Ajout d'un produit au service {}",
        service_id
    ));

    // ✅ Vérification : L'utilisateur est-il le propriétaire du service ?
    let service_row =
        sqlx::query("SELECT user_id, data FROM services WHERE id = $1 AND is_active = true")
            .bind(service_id)
            .fetch_optional(&state.pg)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur récupération service: {}", e)))?;

    let (owner_id, mut service_data): (i32, Value) = match service_row {
        Some(row) => (
            row.try_get("user_id")
                .map_err(|e| AppError::Internal(e.to_string()))?,
            row.try_get("data")
                .map_err(|e| AppError::Internal(e.to_string()))?,
        ),
        None => {
            log_error(&format!(
                "[add_product_to_service] Service {} introuvable",
                service_id
            ));
            return Err(AppError::NotFound(format!(
                "Service {} introuvable",
                service_id
            )));
        }
    };

    // Vérifier que l'utilisateur authentifié est bien le propriétaire
    if owner_id != user.id {
        log_error(&format!(
            "[add_product_to_service] User {} n'est pas propriétaire du service {}",
            user.id, service_id
        ));
        return Err(AppError::Unauthorized(
            "Vous n'êtes pas le propriétaire de ce service".to_string(),
        ));
    }

    // ✅ Coût fixe : 3000 FCFA pour ajouter un produit dupliqué
    mod service_costs {
        pub const COST_NEW_PRODUCT_DUPLICATE_XAF: i64 = 3000;
    }
    let cout_ajout = service_costs::COST_NEW_PRODUCT_DUPLICATE_XAF;

    // ✅ Vérifier le solde
    let current_balance_result = sqlx::query("SELECT tokens_balance FROM users WHERE id = $1")
        .bind(user.id)
        .fetch_one(&state.pg)
        .await;

    let current_balance = match current_balance_result {
        Ok(row) => row.try_get::<i64, _>("tokens_balance").unwrap_or(0),
        Err(e) => {
            log_error(&format!(
                "[add_product_to_service] Erreur récupération solde: {}",
                e
            ));
            return Err(AppError::Internal(format!(
                "Erreur récupération solde: {}",
                e
            )));
        }
    };

    if current_balance < cout_ajout {
        log_error(&format!(
            "[add_product_to_service] Solde insuffisant: {} < {}",
            current_balance, cout_ajout
        ));
        return Err(AppError::BadRequest(format!(
            "Solde insuffisant: {} FCFA disponible, {} FCFA requis",
            current_balance, cout_ajout
        )));
    }

    // ✅ Débiter le solde
    let debit_result = sqlx::query(
        "UPDATE users SET tokens_balance = tokens_balance - $1 WHERE id = $2 RETURNING tokens_balance"
    )
    .bind(cout_ajout)
    .bind(user.id)
    .fetch_one(&state.pg)
    .await;

    let new_balance = match debit_result {
        Ok(row) => row.try_get::<i64, _>("tokens_balance").unwrap_or(0),
        Err(e) => {
            log_error(&format!(
                "[add_product_to_service] Échec débit solde: {}",
                e
            ));
            return Err(AppError::Internal(format!("Erreur débit solde: {}", e)));
        }
    };

    log_info(&format!(
        "[add_product_to_service] ✅ Solde débité: {} FCFA (ancien: {}, nouveau: {})",
        cout_ajout, current_balance, new_balance
    ));

    // ✅ Ajouter le produit au JSON du service
    // ✅ CORRECTION 2025-11-06: Transformer product_data en string concaténée (format attendu par autocomplete)
    // Format: "nom_produit,categorie,prix,devise,lieu" (comme dans LinearAutocompleteEditor)
    let product_string = {
        let mut parts = vec![];

        // Extraire les champs dans l'ordre attendu
        if let Some(nom) = request
            .product_data
            .get("nom_produit")
            .or_else(|| request.product_data.get("produits"))
            .and_then(|v| v.as_str())
        {
            if !nom.is_empty() {
                parts.push(nom.to_string());
            }
        }

        if let Some(cat) = request
            .product_data
            .get("categorie_produit")
            .and_then(|v| v.as_str())
        {
            if !cat.is_empty() {
                parts.push(cat.to_string());
            }
        }

        if let Some(desc) = request
            .product_data
            .get("description_produit")
            .and_then(|v| v.as_str())
        {
            if !desc.is_empty() {
                parts.push(desc.to_string());
            }
        }

        if let Some(prix) = request
            .product_data
            .get("prix")
            .or_else(|| request.product_data.get("prix_produit"))
            .and_then(|v| v.as_str())
        {
            if !prix.is_empty() {
                parts.push(prix.to_string());
            }
        }

        if let Some(devise) = request.product_data.get("devise").and_then(|v| v.as_str()) {
            if !devise.is_empty() {
                parts.push(devise.to_string());
            }
        }

        parts.join(",")
    };

    log_info(&format!(
        "[add_product_to_service] 📝 Product string: '{}'",
        product_string
    ));

    let produits_array = service_data
        .get_mut("produits")
        .and_then(|p| p.as_object_mut())
        .and_then(|obj| obj.get_mut("valeur"))
        .and_then(|v| v.as_array_mut());

    let product_index = match produits_array {
        Some(arr) => {
            // Ajouter le nouveau produit au tableau existant (format string)
            arr.push(json!(product_string.clone()));
            arr.len() - 1
        }
        None => {
            // Créer le tableau de produits s'il n'existe pas
            service_data["produits"] = json!({
                "type_donnee": "autocomplete",
                "valeur": vec![product_string.clone()],
                "separateur": ",",
                "sous_caracteristiques": {},
                "filtrable": true,
                "origine_champs": "formulaire"
            });
            0
        }
    };

    // ✅ NOUVEAU 2025-11-06: Ajouter lieu_produit au service_data pour save_autocomplete_combination
    if let Some(lieu) = request
        .product_data
        .get("lieu_produit")
        .or_else(|| request.product_data.get("lieu_commercial"))
        .or_else(|| request.product_data.get("lieu_commercialisation"))
    {
        service_data["lieu_produit"] = json!({
            "type_donnee": "string",
            "valeur": lieu.as_str().unwrap_or(""),
            "origine_champs": "formulaire"
        });
    }

    // ✅ Mettre à jour le service en base
    let update_result =
        sqlx::query("UPDATE services SET data = $1, updated_at = NOW() WHERE id = $2")
            .bind(&service_data)
            .bind(service_id)
            .execute(&state.pg)
            .await;

    match update_result {
        Ok(_) => {
            log_info(&format!(
                "[add_product_to_service] ✅ Produit ajouté au service {} (index: {})",
                service_id, product_index
            ));

            // ✅ NOUVEAU 2025-11-06: Sauvegarder dans autocomplete_characteristics et autocomplete_combinations
            // Créer un data_obj temporaire avec SEULEMENT le nouveau produit (pas tous les produits du service)
            let temp_data_obj = {
                let mut obj = json!({
                    "produits": {
                        "type_donnee": "autocomplete",
                        "valeur": product_string,
                        "separateur": ",",
                        "filtrable": true,
                        "origine_champs": "formulaire"
                    }
                });

                // Ajouter lieu_produit si présent
                if let Some(lieu) = request
                    .product_data
                    .get("lieu_produit")
                    .or_else(|| request.product_data.get("lieu_commercial"))
                    .or_else(|| request.product_data.get("lieu_commercialisation"))
                {
                    obj["lieu_produit"] = json!({
                        "type_donnee": "string",
                        "valeur": lieu.as_str().unwrap_or(""),
                        "origine_champs": "formulaire"
                    });
                }

                obj
            };

            // Appeler save_autocomplete_combination pour indexer SEULEMENT le nouveau produit
            if let Err(e) = crate::services::creer_service::save_autocomplete_combination(
                &state.pg,
                service_id,
                &temp_data_obj,
            )
            .await
            {
                log_error(&format!(
                    "[add_product_to_service] ⚠️ Erreur sauvegarde autocomplete: {} (non bloquant)",
                    e
                ));
            } else {
                log_info(&format!("[add_product_to_service] ✅ Produit indexé dans autocomplete_characteristics + autocomplete_combinations"));
            }

            // ✅ Créer notification
            let _ = crate::services::notification_service::create_notification(
                &state.pg,
                user.id,
                crate::services::notification_service::NotificationType::ProductAdded,
                "✨ Produit ajouté à votre service".to_string(),
                format!(
                    "Un nouveau produit a été ajouté à votre service (index: {})",
                    product_index
                ),
                Some(json!({
                    "service_id": service_id,
                    "product_index": product_index,
                    "cost": cout_ajout
                })),
            )
            .await;

            Ok(Json(json!({
                "success": true,
                "service_id": service_id,
                "product_index": product_index,
                "cost": cout_ajout,
                "message": format!("Produit ajouté avec succès (coût: {} FCFA)", cout_ajout),
                "new_balance": new_balance
            })))
        }
        Err(e) => {
            log_error(&format!(
                "[add_product_to_service] Erreur mise à jour service: {}",
                e
            ));

            // ✅ ROLLBACK : Rembourser l'utilisateur en cas d'échec
            let _ =
                sqlx::query("UPDATE users SET tokens_balance = tokens_balance + $1 WHERE id = $2")
                    .bind(cout_ajout)
                    .bind(user.id)
                    .execute(&state.pg)
                    .await;

            Err(AppError::Internal(format!(
                "Erreur mise à jour service: {}",
                e
            )))
        }
    }
}
