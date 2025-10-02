use axum::{
    extract::{Path, Query, State},
    response::Json,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::services::payment_service::{PaymentRequest, PaymentService, PaymentResponse, PaymentReceipt, PaymentMethod, PaymentStatus};
use crate::controllers::payment_controller::{
    validate_phone_number,
};

#[derive(Debug, Deserialize)]
pub struct ProcessPaymentRequest {
    pub amount: f64,
    pub currency: String,
    pub _payment_method: serde_json::Value,
    pub description: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ProcessPaymentResponse {
    pub success: bool,
    pub data: Option<PaymentResponse>,
    pub error: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct PaymentHistoryQuery {
    pub limit: Option<i32>,
    pub offset: Option<i32>,
}

#[derive(Debug, Serialize)]
pub struct PaymentHistoryResponse {
    pub success: bool,
    pub data: Option<Vec<PaymentReceipt>>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct PaymentReceiptResponse {
    pub success: bool,
    pub data: Option<PaymentReceipt>,
    pub error: Option<String>,
}

/// Traiter un paiement
pub async fn process_payment(
    State(payment_service): State<PaymentService>,
    user_id: i32, // Extrait du middleware d'authentification
    Json(request): Json<ProcessPaymentRequest>,
) -> Json<ProcessPaymentResponse> {
    // Valider le montant
    if request.amount <= 0.0 {
        return Json(ProcessPaymentResponse {
            success: false,
            data: None,
            error: Some("Le montant doit être supérieur à 0".to_string()),
        });
    }

    // Valider la devise
    if !["XAF", "USD", "EUR", "GBP"].contains(&request.currency.as_str()) {
        return Json(ProcessPaymentResponse {
            success: false,
            data: None,
            error: Some("Devise non supportée".to_string()),
        });
    }

    // Créer la requête de paiement
    let payment_method = match serde_json::from_value::<PaymentMethod>(request._payment_method) {
        Ok(method) => method,
        Err(_) => {
            return Json(ProcessPaymentResponse {
                success: false,
                data: None,
                error: Some("Méthode de paiement invalide".to_string()),
            });
        }
    };

    let payment_request = PaymentRequest {
        user_id,
        amount: request.amount,
        currency: request.currency,
        payment_method,
        description: request.description,
    };

    // Traiter le paiement
    match payment_service.process_payment(payment_request).await {
        Ok(response) => Json(ProcessPaymentResponse {
            success: true,
            data: Some(response),
            error: None,
        }),
        Err(error) => {
            eprintln!("Erreur traitement paiement: {}", error);
            Json(ProcessPaymentResponse {
                success: false,
                data: None,
                error: Some("Erreur lors du traitement du paiement".to_string()),
            })
        }
    }
}

/// Obtenir l'historique des paiements
pub async fn get_payment_history(
    State(payment_service): State<PaymentService>,
    user_id: i32, // Extrait du middleware d'authentification
    Query(params): Query<PaymentHistoryQuery>,
) -> Json<PaymentHistoryResponse> {
    let limit = params.limit.unwrap_or(20).min(100); // Limite max de 100
    let offset = params.offset.unwrap_or(0);

    match payment_service.get_payment_history(user_id, limit, offset).await {
        Ok(history) => Json(PaymentHistoryResponse {
            success: true,
            data: Some(history),
            error: None,
        }),
        Err(error) => {
            eprintln!("Erreur récupération historique: {}", error);
            Json(PaymentHistoryResponse {
                success: false,
                data: None,
                error: Some("Erreur lors de la récupération de l'historique".to_string()),
            })
        }
    }
}

/// Obtenir un reçu de paiement
pub async fn get_payment_receipt(
    State(payment_service): State<PaymentService>,
    user_id: i32, // Extrait du middleware d'authentification
    Path(transaction_id): Path<String>,
) -> Json<PaymentReceiptResponse> {
    match payment_service.get_payment_receipt(&transaction_id).await {
        Ok(Some(receipt)) => {
            // Vérifier que le reçu appartient à l'utilisateur
            if receipt.user_id != user_id {
                return Json(PaymentReceiptResponse {
                    success: false,
                    data: None,
                    error: Some("Accès non autorisé à ce reçu".to_string()),
                });
            }

            Json(PaymentReceiptResponse {
                success: true,
                data: Some(receipt),
                error: None,
            })
        }
        Ok(None) => Json(PaymentReceiptResponse {
            success: false,
            data: None,
            error: Some("Reçu non trouvé".to_string()),
        }),
        Err(error) => {
            eprintln!("Erreur récupération reçu: {}", error);
            Json(PaymentReceiptResponse {
                success: false,
                data: None,
                error: Some("Erreur lors de la récupération du reçu".to_string()),
            })
        }
    }
}

/// Obtenir les méthodes de paiement disponibles
pub async fn get_available_payment_methods() -> Json<serde_json::Value> {
    let methods = serde_json::json!({
        "success": true,
        "data": {
            "mobile_money": {
                "orange_money": {
                    "name": "Orange Money",
                    "icon": "🍊",
                    "countries": ["CM", "CI", "BF", "ML", "NE", "SN", "TG", "MG"],
                    "fees": 0,
                    "processing_time": "Instantané",
                    "min_amount": 100,
                    "max_amount": 1000000
                },
                "mtn_money": {
                    "name": "MTN Money",
                    "icon": "📱",
                    "countries": ["CM", "CI", "GH", "UG", "RW", "ZA"],
                    "fees": 0,
                    "processing_time": "Instantané",
                    "min_amount": 100,
                    "max_amount": 1000000
                }
            },
            "international": {
                "visa": {
                    "name": "Visa",
                    "icon": "💳",
                    "fees": 2.5,
                    "processing_time": "Instantané",
                    "min_amount": 1000,
                    "max_amount": 10000000
                },
                "paypal": {
                    "name": "PayPal",
                    "icon": "🅿️",
                    "fees": 3.0,
                    "processing_time": "Instantané",
                    "min_amount": 1000,
                    "max_amount": 10000000
                }
            },
            "bank_transfer": {
                "bank_transfer": {
                    "name": "Virement bancaire",
                    "icon": "🏦",
                    "fees": 0,
                    "processing_time": "1-2 jours",
                    "min_amount": 5000,
                    "max_amount": 50000000
                }
            }
        }
    });

    Json(methods)
}

/// Obtenir les statistiques de paiement d'un utilisateur
pub async fn get_payment_stats(
    State(payment_service): State<PaymentService>,
    user_id: i32, // Extrait du middleware d'authentification
) -> Json<serde_json::Value> {
    // Récupérer l'historique complet pour calculer les stats
    match payment_service.get_payment_history(user_id, 1000, 0).await {
        Ok(history) => {
            let total_transactions = history.len();
            let total_amount: f64 = history.iter().map(|p| p.amount).sum();
            let total_tokens: i32 = history.iter().map(|p| p.total_tokens).sum();
            let successful_transactions = history.iter().filter(|p| matches!(p.status, PaymentStatus::Completed)).count();
            let failed_transactions = history.iter().filter(|p| matches!(p.status, PaymentStatus::Failed)).count();

            let stats = serde_json::json!({
                "success": true,
                "data": {
                    "total_transactions": total_transactions,
                    "total_amount": total_amount,
                    "total_tokens": total_tokens,
                    "successful_transactions": successful_transactions,
                    "failed_transactions": failed_transactions,
                    "success_rate": if total_transactions > 0 { (successful_transactions as f64 / total_transactions as f64) * 100.0 } else { 0.0 },
                    "average_transaction_amount": if total_transactions > 0 { total_amount / total_transactions as f64 } else { 0.0 }
                }
            });

            Json(stats)
        }
        Err(error) => {
            eprintln!("Erreur récupération stats: {}", error);
            Json(serde_json::json!({
                "success": false,
                "error": "Erreur lors de la récupération des statistiques"
            }))
        }
    }
}

pub fn payment_routes(state: Arc<crate::AppState>) -> Router<Arc<crate::AppState>> {
    Router::new()
        .route("/methods", get(get_available_payment_methods))
        .route("/validate-phone", post(validate_phone_number))
        .with_state(state)
}