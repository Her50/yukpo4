use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;

/// ? Repr?sente une ligne de l'historique de consultation (relation user/service)
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ConsultationHistorique {
    /// ID interne de la consultation (cl? primaire)
    pub id: i32,
    /// ID de l'utilisateur ayant consult?
    pub user_id: i32,
    /// ID du service consult?
    pub service_id: i32,
    /// Horodatage de la consultation
    pub timestamp: Option<DateTime<Utc>>, // ? ici Option<>
    /// Identifiant unique immuable de l'?v?nement (UUID)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub event_id: Option<String>,
    /// Indique si un d?bit de tokens a ?t? appliqu?
    #[serde(skip_serializing_if = "Option::is_none")]
    pub debit_applied: Option<bool>,
    /// Co?t du d?bit en tokens Yukpo
    #[serde(skip_serializing_if = "Option::is_none")]
    pub token_cost: Option<i64>,
    /// ?quivalent valeur en tokens IA externes
    #[serde(skip_serializing_if = "Option::is_none")]
    pub token_cost_ia_equivalent: Option<f64>,
    /// M?tadonn?es suppl?mentaires sur l'?v?nement
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<Value>,
    /// Instantan? du service consult?
    #[serde(skip_serializing_if = "Option::is_none")]
    pub service_snapshot: Option<ServiceHistorySnapshot>,
    /// Instantan? du prestataire/propri?taire lors de la consultation
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider_snapshot: Option<UserHistorySnapshot>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ServiceHistorySnapshot {
    pub id: i32,
    pub provider_id: i32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub short_description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cover_media: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub city: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub country: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_active: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub service_deleted: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UserHistorySnapshot {
    pub id: i32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub nom: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub prenom: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub nom_complet: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub avatar_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tokens_balance_before: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tokens_balance_after: Option<i64>,
}
