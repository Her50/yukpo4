// Service Rust : Validation stricte d'un JSON de troc (?change)
use crate::core::types::AppError;
use jsonschema::JSONSchema;
use serde_json::Value;
use std::fs;

/// Valide la structure d'un JSON d'?change g?n?r? par l'IA externe
pub fn valider_echange_json(data: &Value) -> Result<(), AppError> {
    log::info!("[VALIDER_ECHANGE_JSON] Validation du JSON: {:?}", data);
    // Charger le sch?ma JSON depuis le fichier
    let schema_str = fs::read_to_string("src/schemas/echange_schema.json")
        .map_err(|e| AppError::Internal(format!("Erreur lecture sch?ma echange: {e}")))?;
    let schema_json: Value = serde_json::from_str(&schema_str)
        .map_err(|e| AppError::Internal(format!("Erreur parsing sch?ma echange: {e}")))?;
    let compiled = JSONSchema::compile(&schema_json)
        .map_err(|e| AppError::Internal(format!("Erreur compilation sch?ma echange: {e}")))?;
    let result = compiled.validate(data);
    if let Err(errors) = result {
        let details: Vec<String> = errors.map(|e| e.to_string()).collect();
        log::warn!("[VALIDER_ECHANGE_JSON] Erreurs de validation: {:?}", details);
        return Err(AppError::BadRequest(format!("Validation JSON ?chou?e: {}", details.join(", "))));
    }
    // Validation m?tier stricte du champ mode
    if let Some(mode) = data.get("mode").and_then(|v| v.as_str()) {
        if mode != "echange" && mode != "don" {
            log::warn!("[VALIDER_ECHANGE_JSON] Rejet du mode interdit: {}", mode);
            return Err(AppError::BadRequest(format!("Le mode '{mode}' n'est pas autoris? pour un ?change (seuls 'echange' et 'don' sont accept?s)")));
        }
    }
    Ok(())
}
