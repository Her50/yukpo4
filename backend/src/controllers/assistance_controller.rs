use crate::core::types::AppResult;
use crate::services::assistance::repondre_assistance;
use serde_json::Value;

/// Contr?leur d?di? ? l?assistance IA : relaye la r?ponse IA brute ? l?utilisateur, sans validation m?tier.
pub async fn traiter_assistance(user_id: Option<i32>, data: &Value) -> AppResult<Value> {
    repondre_assistance(user_id, data).await
}
