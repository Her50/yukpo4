use serde_json::Value;
use crate::core::types::AppResult;

/// ?? Simule une r?ponse d?assistance ? l?utilisateur
pub async fn repondre_assistance(
    user_id: Option<i32>,
    data: &Value,
) -> AppResult<Value> {
    Ok(serde_json::json!({
        "message": "?? Voici l?assistance demand?e",
        "user_id": user_id,
        "donnees": data
    }))
}
