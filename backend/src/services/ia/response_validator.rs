//! ✅ Validateur universel pour réponses IA
//! Garantit que toutes les réponses IA sont conformes aux schémas attendus

use crate::core::types::{AppError, AppResult};
use crate::services::app_ia::extract_json_block;
use jsonschema::JSONSchema;
use serde::de::DeserializeOwned;
use serde_json::Value;
use std::path::PathBuf;

/// Valide une réponse IA avec extraction JSON et validation schéma
pub fn validate_ai_response<T: DeserializeOwned>(
    response: &str,
    schema_path: Option<&str>,
) -> AppResult<T> {
    // 1. Extraire le JSON de la réponse (peut contenir markdown)
    let json_block = extract_json_block(response).ok_or_else(|| {
        AppError::Internal(format!(
            "JSON manquant dans réponse IA. Réponse reçue: {}",
            &response.chars().take(200).collect::<String>()
        ))
    })?;

    // 2. Parser en JSON Value
    let json_value: Value = serde_json::from_str(&json_block).map_err(|e| {
        AppError::Internal(format!(
            "JSON invalide dans réponse IA: {} | JSON: {}",
            e,
            &json_block.chars().take(200).collect::<String>()
        ))
    })?;

    // 3. Valider avec schéma JSON si fourni
    if let Some(schema_path) = schema_path {
        validate_with_schema(&json_value, schema_path)?;
    }

    // 4. Convertir en type cible
    let result: T = serde_json::from_value(json_value).map_err(|e| {
        AppError::Internal(format!("Erreur conversion JSON vers type cible: {}", e))
    })?;

    Ok(result)
}

/// Valide un JSON Value contre un schéma JSON Schema
pub fn validate_with_schema(json: &Value, schema_path: &str) -> AppResult<()> {
    // Construire le chemin complet du schéma
    let mut schema_path_buf = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    schema_path_buf.push("src/schemas");
    schema_path_buf.push(schema_path);

    // Lire le schéma
    let schema_str = std::fs::read_to_string(&schema_path_buf).map_err(|e| {
        AppError::Internal(format!(
            "Erreur lecture schéma {}: {}",
            schema_path_buf.display(),
            e
        ))
    })?;

    let schema_json: Value = serde_json::from_str(&schema_str).map_err(|e| {
        AppError::Internal(format!(
            "Erreur parsing schéma JSON {}: {}",
            schema_path_buf.display(),
            e
        ))
    })?;

    // Compiler le schéma
    let compiled = JSONSchema::compile(&schema_json)
        .map_err(|e| AppError::Internal(format!("Erreur compilation schéma JSON: {}", e)))?;

    // Valider
    let validation_result = compiled.validate(json);
    if let Err(errors) = validation_result {
        let error_messages: Vec<String> = errors.map(|e| format!("{}", e)).collect();

        return Err(AppError::Internal(format!(
            "Validation schéma échouée pour {}: {}",
            schema_path,
            error_messages.join(", ")
        ))
        .into());
    }

    Ok(())
}

/// Valide les champs requis dans un JSON Value
pub fn validate_required_fields(json: &Value, required_fields: &[&str]) -> AppResult<()> {
    for field in required_fields {
        if !json.get(field).is_some() {
            return Err(AppError::Internal(format!("Champ requis manquant: {}", field)).into());
        }
    }
    Ok(())
}

/// Valide qu'une valeur numérique est dans une plage
pub fn validate_numeric_range(json: &Value, field: &str, min: f64, max: f64) -> AppResult<()> {
    if let Some(value) = json.get(field).and_then(|v| v.as_f64()) {
        if !(min..=max).contains(&value) {
            return Err(AppError::Internal(format!(
                "Champ {} doit être entre {} et {} (reçu: {})",
                field, min, max, value
            ))
            .into());
        }
    }
    Ok(())
}

/// Valide qu'une valeur string est dans une liste d'options
pub fn validate_string_enum(json: &Value, field: &str, allowed: &[&str]) -> AppResult<()> {
    if let Some(value) = json.get(field).and_then(|v| v.as_str()) {
        if !allowed.contains(&value) {
            return Err(AppError::Internal(format!(
                "Champ {} doit être l'un de: {} (reçu: {})",
                field,
                allowed.join(", "),
                value
            ))
            .into());
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde::Deserialize;
    use serde_json::Value;

    #[derive(Deserialize)]
    struct TestResponse {
        value: f64,
        name: String,
    }

    #[test]
    fn test_validate_required_fields() {
        let json: Value = serde_json::json!({
            "value": 42.0,
            "name": "test"
        });
        assert!(validate_required_fields(&json, &["value", "name"]).is_ok());
        assert!(validate_required_fields(&json, &["value", "name", "missing"]).is_err());
    }

    #[test]
    fn test_validate_numeric_range() {
        let json: Value = serde_json::json!({
            "value": 0.5
        });
        assert!(validate_numeric_range(&json, "value", 0.0, 1.0).is_ok());
        assert!(validate_numeric_range(&json, "value", 0.0, 0.4).is_err());
    }

    #[test]
    fn test_validate_string_enum() {
        let json: Value = serde_json::json!({
            "level": "intermediate"
        });
        assert!(
            validate_string_enum(&json, "level", &["beginner", "intermediate", "expert"]).is_ok()
        );
        assert!(validate_string_enum(&json, "level", &["beginner", "expert"]).is_err());
    }
}
