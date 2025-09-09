use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

/// ? Repr?sente un log de modification de service
#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct ServiceLog {
    /// Cl? primaire
    pub id: i32,
    /// R?f?rence au service modifi?
    pub service_id: i32,
    /// R?f?rence ? l'utilisateur ayant effectu? la modification
    pub user_id: i32,
    /// Description de la modification
    pub modification: String,
    /// Date de cr?ation du log
    pub created_at: NaiveDateTime,
}
