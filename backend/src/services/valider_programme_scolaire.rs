// Service Rust : Validation stricte d'un JSON de programme scolaire
use crate::core::types::AppError;
use jsonschema::JSONSchema;
use serde_json::Value;
use std::fs;

/// Valide la structure d'un JSON de programme scolaire g?n?r? par l'IA externe
pub fn valider_programme_scolaire_json(data: &Value) -> Result<(), AppError> {
    // Charger le sch?ma JSON depuis le fichier
    let schema_str = fs::read_to_string("src/schemas/programme_scolaire_schema.json")
        .map_err(|e| AppError::Internal(format!("Erreur lecture sch?ma programme_scolaire: {e}")))?;
    let schema_json: Value = serde_json::from_str(&schema_str)
        .map_err(|e| AppError::Internal(format!("Erreur parsing sch?ma programme_scolaire: {e}")))?;
    let compiled = JSONSchema::compile(&schema_json)
        .map_err(|e| AppError::Internal(format!("Erreur compilation sch?ma programme_scolaire: {e}")))?;
    let result = compiled.validate(data);
    if let Err(errors) = result {
        let details: Vec<String> = errors.map(|e| e.to_string()).collect();
        return Err(AppError::BadRequest(format!("Validation JSON ?chou?e: {}", details.join(", "))));
    }
    Ok(())
}
