# 🔧 Corrections à Appliquer pour Améliorer les Prompts IA

## 📋 Corrections Prioritaires

### 1. ✅ Améliorer le Prompt d'Analyse Contextuelle (`orchestration_ia.rs`)

**Fichier** : `backend/src/services/orchestration_ia.rs`  
**Lignes** : 1250-1292

**Problème Actuel** :
- Prompt sans format JSON strict
- Parsing avec `unwrap_or_else` masquant les erreurs
- Pas de validation de schéma

**Correction à Appliquer** :

```rust
/// ?? Analyse contextuelle ultra-avanc?e
async fn analyser_contexte_ultra_avance(
    input_context: &Value,
    app_ia: Arc<AppIA>,
) -> AppResult<ContextAnalysis> {
    let prompt_analyse = format!(
        r#"
Tu es un expert en analyse contextuelle pour l'assistant IA Yukpomnang.

CONTEXTE UTILISATEUR:
{}

TÂCHE:
Analyse le contexte et fournis une analyse structurée complète.

FORMAT DE RÉPONSE (JSON STRICT - PAS DE MARKDOWN):
{{
    "user_intent_confidence": 0.85,
    "context_relevance_score": 0.90,
    "sentiment_score": 0.5,
    "language_detected": "fr",
    "user_expertise_level": "intermediate",
    "request_complexity": "medium",
    "security_risk_level": "low",
    "suggested_improvements": ["suggestion1", "suggestion2"],
    "context_enhancements": {{}},
    "ai_model_recommendation": "gpt-4o",
    "expected_response_quality": 0.85,
    "user_behavior_pattern": "standard",
    "content_safety_score": 0.95,
    "optimization_opportunities": ["opportunity1"]
}}

CONTRAINTES:
- user_intent_confidence: nombre entre 0.0 et 1.0
- context_relevance_score: nombre entre 0.0 et 1.0
- sentiment_score: nombre entre -1.0 et 1.0
- language_detected: code langue ISO (fr, en, es, pt)
- user_expertise_level: "beginner" | "intermediate" | "expert"
- request_complexity: "simple" | "medium" | "complex"
- security_risk_level: "low" | "medium" | "high"
- ai_model_recommendation: nom du modèle recommandé
- expected_response_quality: nombre entre 0.0 et 1.0
- content_safety_score: nombre entre 0.0 et 1.0

IMPORTANT:
- Retourne UNIQUEMENT du JSON valide
- Pas de texte avant ou après le JSON
- Pas de markdown (```json```)
- Pas de commentaires dans le JSON
"#,
        serde_json::to_string_pretty(input_context).unwrap_or_default()
    );

    let (model_name, response, _tokens_used) = app_ia.predict(&prompt_analyse).await?;

    // Nettoyer et parser la réponse avec validation stricte
    let cleaned_response = nettoyer_reponse_ia_ultra_avance(&response);
    
    // ✅ CORRECTION: Validation stricte au lieu de valeurs par défaut
    let json_value: Value = serde_json::from_str(&cleaned_response)
        .map_err(|e| {
            log::error!(
                "[orchestration_ia] Erreur parsing JSON analyse contextuelle: {} | Réponse: {}",
                e,
                &response.chars().take(200).collect::<String>()
            );
            crate::core::types::AppError::Internal(format!(
                "Réponse IA invalide pour analyse contextuelle: {}",
                e
            ))
        })?;

    // ✅ NOUVEAU: Validation des champs requis
    let required_fields = [
        "user_intent_confidence",
        "context_relevance_score",
        "sentiment_score",
        "language_detected",
        "user_expertise_level",
        "request_complexity",
    ];
    
    for field in &required_fields {
        if !json_value.get(field).is_some() {
            return Err(crate::core::types::AppError::Internal(format!(
                "Champ requis manquant dans réponse IA: {}",
                field
            )).into());
        }
    }

    // ✅ NOUVEAU: Validation des types et plages de valeurs
    if let Some(confidence) = json_value.get("user_intent_confidence").and_then(|v| v.as_f64()) {
        if !(0.0..=1.0).contains(&confidence) {
            return Err(crate::core::types::AppError::Internal(
                "user_intent_confidence doit être entre 0.0 et 1.0".to_string(),
            ).into());
        }
    }

    if let Some(sentiment) = json_value.get("sentiment_score").and_then(|v| v.as_f64()) {
        if !(-1.0..=1.0).contains(&sentiment) {
            return Err(crate::core::types::AppError::Internal(
                "sentiment_score doit être entre -1.0 et 1.0".to_string(),
            ).into());
        }
    }

    // Parser en structure typée
    let analysis: ContextAnalysis = serde_json::from_value(json_value)
        .map_err(|e| {
            log::error!(
                "[orchestration_ia] Erreur conversion JSON vers ContextAnalysis: {}",
                e
            );
            crate::core::types::AppError::Internal(format!(
                "Structure JSON invalide pour ContextAnalysis: {}",
                e
            ))
        })?;

    log::info!(
        "[orchestration_ia] ✅ Analyse contextuelle validée (modèle: {}, confiance: {:.2})",
        model_name,
        analysis.user_intent_confidence
    );

    Ok(analysis)
}
```

---

### 2. ✅ Créer une Fonction de Validation Universelle

**Nouveau Fichier** : `backend/src/services/ia/response_validator.rs`

```rust
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
    let json_block = extract_json_block(response)
        .ok_or_else(|| {
            AppError::Internal(format!(
                "JSON manquant dans réponse IA. Réponse reçue: {}",
                &response.chars().take(200).collect::<String>()
            ))
        })?;

    // 2. Parser en JSON Value
    let json_value: Value = serde_json::from_str(&json_block)
        .map_err(|e| {
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
    let result: T = serde_json::from_value(json_value)
        .map_err(|e| {
            AppError::Internal(format!(
                "Erreur conversion JSON vers type cible: {}",
                e
            ))
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
    let schema_str = std::fs::read_to_string(&schema_path_buf)
        .map_err(|e| {
            AppError::Internal(format!(
                "Erreur lecture schéma {}: {}",
                schema_path_buf.display(),
                e
            ))
        })?;

    let schema_json: Value = serde_json::from_str(&schema_str)
        .map_err(|e| {
            AppError::Internal(format!(
                "Erreur parsing schéma JSON {}: {}",
                schema_path_buf.display(),
                e
            ))
        })?;

    // Compiler le schéma
    let compiled = JSONSchema::compile(&schema_json)
        .map_err(|e| {
            AppError::Internal(format!("Erreur compilation schéma JSON: {}", e))
        })?;

    // Valider
    let validation_result = compiled.validate(json);
    if let Err(errors) = validation_result {
        let error_messages: Vec<String> = errors
            .map(|e| format!("{}", e))
            .collect();
        
        return Err(AppError::Internal(format!(
            "Validation schéma échouée pour {}: {}",
            schema_path,
            error_messages.join(", ")
        )).into());
    }

    Ok(())
}

/// Valide les champs requis dans un JSON Value
pub fn validate_required_fields(json: &Value, required_fields: &[&str]) -> AppResult<()> {
    for field in required_fields {
        if !json.get(field).is_some() {
            return Err(AppError::Internal(format!(
                "Champ requis manquant: {}",
                field
            )).into());
        }
    }
    Ok(())
}

/// Valide qu'une valeur numérique est dans une plage
pub fn validate_numeric_range(
    json: &Value,
    field: &str,
    min: f64,
    max: f64,
) -> AppResult<()> {
    if let Some(value) = json.get(field).and_then(|v| v.as_f64()) {
        if !(min..=max).contains(&value) {
            return Err(AppError::Internal(format!(
                "Champ {} doit être entre {} et {} (reçu: {})",
                field, min, max, value
            )).into());
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
            )).into());
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde::Deserialize;

    #[derive(Deserialize)]
    struct TestResponse {
        value: f64,
        name: String,
    }

    #[test]
    fn test_validate_required_fields() {
        let json = json!({
            "value": 42.0,
            "name": "test"
        });
        assert!(validate_required_fields(&json, &["value", "name"]).is_ok());
        assert!(validate_required_fields(&json, &["value", "name", "missing"]).is_err());
    }

    #[test]
    fn test_validate_numeric_range() {
        let json = json!({
            "value": 0.5
        });
        assert!(validate_numeric_range(&json, "value", 0.0, 1.0).is_ok());
        assert!(validate_numeric_range(&json, "value", 0.0, 0.4).is_err());
    }

    #[test]
    fn test_validate_string_enum() {
        let json = json!({
            "level": "intermediate"
        });
        assert!(validate_string_enum(&json, "level", &["beginner", "intermediate", "expert"]).is_ok());
        assert!(validate_string_enum(&json, "level", &["beginner", "expert"]).is_err());
    }
}
```

**Ajouter au `mod.rs`** :
```rust
pub mod response_validator;
```

---

### 3. ✅ Créer les Schémas JSON Manquants

**Nouveau Fichier** : `backend/src/schemas/ai_responses/context_analysis_schema.json`

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "title": "Context Analysis Response Schema",
  "description": "Schéma de validation pour les réponses d'analyse contextuelle IA",
  "required": [
    "user_intent_confidence",
    "context_relevance_score",
    "sentiment_score",
    "language_detected",
    "user_expertise_level",
    "request_complexity",
    "security_risk_level",
    "ai_model_recommendation",
    "expected_response_quality",
    "user_behavior_pattern",
    "content_safety_score"
  ],
  "properties": {
    "user_intent_confidence": {
      "type": "number",
      "minimum": 0.0,
      "maximum": 1.0,
      "description": "Confiance dans l'intention détectée (0-1)"
    },
    "context_relevance_score": {
      "type": "number",
      "minimum": 0.0,
      "maximum": 1.0,
      "description": "Pertinence du contexte (0-1)"
    },
    "sentiment_score": {
      "type": "number",
      "minimum": -1.0,
      "maximum": 1.0,
      "description": "Sentiment de la demande (-1 à 1)"
    },
    "language_detected": {
      "type": "string",
      "enum": ["fr", "en", "es", "pt", "ar", "sw"],
      "description": "Code langue ISO détectée"
    },
    "user_expertise_level": {
      "type": "string",
      "enum": ["beginner", "intermediate", "expert"],
      "description": "Niveau d'expertise de l'utilisateur"
    },
    "request_complexity": {
      "type": "string",
      "enum": ["simple", "medium", "complex"],
      "description": "Complexité de la demande"
    },
    "security_risk_level": {
      "type": "string",
      "enum": ["low", "medium", "high"],
      "description": "Niveau de risque sécurité"
    },
    "suggested_improvements": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "Suggestions d'amélioration"
    },
    "context_enhancements": {
      "type": "object",
      "description": "Enrichissements contextuels"
    },
    "ai_model_recommendation": {
      "type": "string",
      "description": "Modèle IA recommandé"
    },
    "expected_response_quality": {
      "type": "number",
      "minimum": 0.0,
      "maximum": 1.0,
      "description": "Qualité attendue de la réponse (0-1)"
    },
    "user_behavior_pattern": {
      "type": "string",
      "description": "Pattern de comportement utilisateur"
    },
    "content_safety_score": {
      "type": "number",
      "minimum": 0.0,
      "maximum": 1.0,
      "description": "Score de sécurité du contenu (0-1)"
    },
    "optimization_opportunities": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "Opportunités d'optimisation"
    }
  }
}
```

**Nouveau Fichier** : `backend/src/schemas/ai_responses/eta_prediction_schema.json`

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "title": "ETA Prediction Response Schema",
  "description": "Schéma de validation pour les prédictions ETA IA",
  "required": [
    "estimated_minutes",
    "confidence",
    "lower_bound_minutes",
    "upper_bound_minutes",
    "factors",
    "risk_factors"
  ],
  "properties": {
    "estimated_minutes": {
      "type": "number",
      "minimum": 0.0,
      "description": "Temps estimé en minutes"
    },
    "confidence": {
      "type": "number",
      "minimum": 0.0,
      "maximum": 1.0,
      "description": "Score de confiance (0-1)"
    },
    "lower_bound_minutes": {
      "type": "number",
      "minimum": 0.0,
      "description": "Borne inférieure en minutes"
    },
    "upper_bound_minutes": {
      "type": "number",
      "minimum": 0.0,
      "description": "Borne supérieure en minutes"
    },
    "factors": {
      "type": "object",
      "additionalProperties": {
        "type": "number"
      },
      "description": "Facteurs influençant la prédiction"
    },
    "risk_factors": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "Facteurs de risque identifiés"
    },
    "method": {
      "type": "string",
      "description": "Méthode utilisée (ai, ml, hybrid)"
    }
  }
}
```

---

### 4. ✅ Utiliser la Validation dans `delivery_ai_eta_service.rs`

**Fichier** : `backend/src/services/delivery_ai_eta_service.rs`  
**Lignes** : 493-569

**Modification** :

```rust
use crate::services::ia::response_validator::validate_ai_response;

// ... dans parse_eta_response ...

async fn parse_eta_response(
    &self,
    response: String,
    _origin: &Location,
    _destination: &Location,
    weather: &crate::services::delivery_weather_service::WeatherConditions,
    traffic: &crate::services::delivery_traffic_service::TrafficConditions,
) -> AppResult<EstimatedTime> {
    // ✅ NOUVEAU: Utiliser la validation universelle avec schéma
    let json: Value = validate_ai_response(
        &response,
        Some("ai_responses/eta_prediction_schema.json"),
    )
    .map_err(|e| {
        log::error!("[AI ETA] Erreur validation réponse IA: {}", e);
        crate::core::types::AppError::Internal(format!(
            "Réponse IA invalide pour ETA: {}",
            e
        ))
    })?;

    // Extraire les données (déjà validées)
    let estimated_minutes = json["estimated_minutes"]
        .as_f64()
        .expect("Champ validé par schéma");

    let confidence = json["confidence"]
        .as_f64()
        .expect("Champ validé par schéma") as f32;

    // ... reste du code ...
}
```

---

## 📝 Checklist d'Implémentation

- [ ] Créer `backend/src/services/ia/response_validator.rs`
- [ ] Ajouter `response_validator` au `mod.rs`
- [ ] Modifier `orchestration_ia.rs` ligne 1250-1292
- [ ] Créer `backend/src/schemas/ai_responses/context_analysis_schema.json`
- [ ] Créer `backend/src/schemas/ai_responses/eta_prediction_schema.json`
- [ ] Modifier `delivery_ai_eta_service.rs` pour utiliser validation
- [ ] Créer schémas pour autres services IA
- [ ] Ajouter tests unitaires pour validation
- [ ] Mettre à jour documentation

---

**Date de création** : 2025-01-27  
**Priorité** : Haute  
**Estimation** : 2-3 jours de développement

