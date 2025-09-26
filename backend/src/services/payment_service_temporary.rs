// Service de paiement temporaire - sera remplacé par le vrai service après création des tables
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct PaymentRequest {
    pub user_id: i32,
    pub amount: f64,
    pub currency: String,
    pub payment_method: PaymentMethod,
    pub description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub enum PaymentMethod {
    OrangeMoney {
        phone_number: String,
        country_code: String,
    },
    MTNMoney {
        phone_number: String,
        country_code: String,
    },
    Visa {
        card_number: String,
        expiry_date: String,
        cvv: String,
        cardholder_name: String,
    },
    PayPal {
        email: String,
    },
    BankTransfer {
        account_number: String,
        bank_code: String,
        account_name: String,
    },
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PaymentResponse {
    pub transaction_id: String,
    pub status: PaymentStatus,
    pub amount: f64,
    pub currency: String,
    pub payment_method: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub reference: Option<String>,
    pub gateway_response: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub enum PaymentStatus {
    Pending,
    Processing,
    Completed,
    Failed,
    Cancelled,
    Refunded,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PaymentReceipt {
    pub transaction_id: String,
    pub user_id: i32,
    pub amount: f64,
    pub currency: String,
    pub payment_method: String,
    pub status: PaymentStatus,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub tokens_added: i32,
    pub bonus_tokens: i32,
    pub total_tokens: i32,
    pub reference: Option<String>,
}

pub struct PaymentService {
    // Service temporaire - pas de pool de base de données
}

impl PaymentService {
    pub fn new(_pool: sqlx::PgPool) -> Self {
        Self {}
    }

    /// Traiter un paiement - version temporaire
    pub async fn process_payment(&self, _request: PaymentRequest) -> Result<PaymentResponse, String> {
        Err("Service de paiement temporairement indisponible - tables en cours de création".to_string())
    }

    /// Obtenir l'historique des paiements - version temporaire
    pub async fn get_payment_history(&self, _user_id: i32, _limit: i32, _offset: i32) -> Result<Vec<PaymentReceipt>, String> {
        Ok(vec![])
    }

    /// Obtenir un reçu de paiement - version temporaire
    pub async fn get_payment_receipt(&self, _transaction_id: &str) -> Result<Option<PaymentReceipt>, String> {
        Ok(None)
    }
}
