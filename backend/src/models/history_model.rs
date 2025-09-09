use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

/// ? Repr?sente une ligne de l'historique de consultation (relation user/service)
#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct ConsultationHistorique {
    /// ID interne de la consultation (cl? primaire)
    pub id: i32,
    /// ID de l'utilisateur ayant consult?
    pub user_id: i32,
    /// ID du service consult?
    pub service_id: i32,
    /// Horodatage de la consultation
    pub timestamp: Option<DateTime<Utc>>, // ? ici Option<>
}
