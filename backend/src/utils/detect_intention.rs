// @ts-check
use crate::services::app_ia::AppIA;
use regex::Regex;
use serde_json::Value;

pub struct IntentionResult {
    pub intention: String,
    pub raw_response: String,
}

/// ?? Fonction de d?tection d?intention Yukpo avec AppIA
pub async fn detect_intention(
    app_ia: &AppIA,
    input: &Value, // ? Attendu : un JSON context enrichi
) -> Result<IntentionResult, Box<dyn std::error::Error + Send + Sync>> {
    let message = input
        .get("texte_libre")
        .and_then(Value::as_str)
        .unwrap_or_default();

    let prompt = format!(
        r#"
Tu es une IA pour la plateforme Yukpo. Classifie l?intention exprim?e ci-dessous :

Message :
"{message}"

Retourne uniquement : "intention": "creation_service" ou "recherche_besoin" ou "demande_echange" ou "assistance_generale"
Et ensuite g?n?re un JSON structur? correspondant ? l?intention d?tect?e.
"#
    );

    let (_, response, _tokens) = app_ia.predict(&prompt).await?;
    let re = Regex::new(r#""intention"\s*:\s*"(\w+)""#)?;
    let intention = re
        .captures(&response)
        .and_then(|caps| caps.get(1))
        .map(|m| m.as_str().to_string())
        .unwrap_or_else(|| "indeterminee".to_string());

    Ok(IntentionResult {
        intention,
        raw_response: response,
    })
}





