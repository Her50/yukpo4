use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

/// ? Repr?sente un service stock? en base
#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Service {
    /// Cl? primaire
    pub id: i32,
    /// R?f?rence ? l'utilisateur (cl? ?trang?re)
    pub user_id: i32,
    /// Contenu JSON dynamique du service
    pub data: serde_json::Value,
    /// Active ou non
    pub is_active: bool,
    /// Date d'auto-d?sactivation programm?e
    pub auto_deactivate_at: Option<DateTime<Utc>>,
    /// Date de derni?re r?activation
    pub last_reactivated_at: Option<DateTime<Utc>>,
    /// Horodatage de cr?ation
    pub created_at: chrono::NaiveDateTime,
    /// Horodatage de derni?re mise ? jour
    pub updated_at: chrono::NaiveDateTime,
    /// Indique si le service est de nature tarissable
    pub is_tarissable: Option<bool>,
    /// Vitesse de tarissement (lente, moyenne, rapide)
    pub vitesse_tarissement: Option<String>,
    /// Coordonn?es GPS pour les services sp?cifiques comme l'immobilier, "immobilier" (real estate), "?v?nementiel", "services ? domicile, etc.
    pub gps: Option<String>,
    /// Cat?gorie du service
    pub category: Option<String>,
    /// Nombre de jours actifs sp?cifi? par le prestataire
    pub active_days: Option<i32>,
    /// Date de dernier envoi d'alerte
    pub last_alert_sent_at: Option<chrono::NaiveDateTime>,
    /// Statut du processus d'embedding: pending, processing, success, failed, retry
    pub embedding_status: Option<String>,
    /// Message d'erreur d?taill? en cas d'?chec d'embedding
    pub embedding_error: Option<String>,
    /// Timestamp de la derni?re tentative d'embedding
    pub embedding_last_attempt: Option<DateTime<Utc>>,
    /// Nombre de tentatives d'embedding effectu?es
    pub embedding_attempts: Option<i32>,
}

/// ? Donn?es re?ues via l'API pour cr?er un nouveau service
#[derive(Debug, Deserialize)]
pub struct NewServiceRequest {
    /// ID de l'utilisateur cr?ateur du service
    pub user_id: i32,
    /// Donn?es dynamiques JSON li?es au service
    pub data: serde_json::Value,
}

/// ? Statuts possibles pour l'embedding
#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum EmbeddingStatus {
    Pending,
    Processing,
    Success,
    Failed,
    Retry,
}

impl From<String> for EmbeddingStatus {
    fn from(s: String) -> Self {
        match s.as_str() {
            "pending" => EmbeddingStatus::Pending,
            "processing" => EmbeddingStatus::Processing,
            "success" => EmbeddingStatus::Success,
            "failed" => EmbeddingStatus::Failed,
            "retry" => EmbeddingStatus::Retry,
            _ => EmbeddingStatus::Pending,
        }
    }
}

impl From<EmbeddingStatus> for String {
    fn from(status: EmbeddingStatus) -> Self {
        match status {
            EmbeddingStatus::Pending => "pending".to_string(),
            EmbeddingStatus::Processing => "processing".to_string(),
            EmbeddingStatus::Success => "success".to_string(),
            EmbeddingStatus::Failed => "failed".to_string(),
            EmbeddingStatus::Retry => "retry".to_string(),
        }
    }
}
