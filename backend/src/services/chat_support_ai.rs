/**
 * Service IA pour chat support
 * Génère des réponses automatiques intelligentes
 */
use crate::core::types::AppResult;
use crate::services::app_ia::AppIA;
use log::{error, info};
use std::sync::Arc;

/// Générer une réponse IA automatique pour le chat support
pub async fn generate_support_response(
    app_ia: Arc<AppIA>,
    user_message: &str,
    conversation_history: &[String],
    topic: Option<&str>,
    language: Option<&str>,
) -> AppResult<String> {
    info!(
        "[ChatSupportAI] Génération réponse pour message: {}",
        user_message
    );

    // ✅ i18n: Adapter la langue de réponse
    let lang = language.unwrap_or("fr");
    let lang_instruction = match lang {
        "en" => "You MUST respond in English.",
        "es" => "You MUST respond in Spanish.",
        "de" => "You MUST respond in German.",
        "pt" => "You MUST respond in Portuguese.",
        "ar" => "You MUST respond in Arabic.",
        "zh" => "You MUST respond in Chinese.",
        "hi" => "You MUST respond in Hindi.",
        "ja" => "You MUST respond in Japanese.",
        "ru" => "You MUST respond in Russian.",
        "sw" => "You MUST respond in Swahili.",
        _ => "You MUST respond in French.",
    };

    let system_prompt = format!(
        r#"
You are the intelligent support assistant of Yukpo, a leading multi-service platform.
{}

YOUR ROLE:
- Respond in a helpful, concise and professional manner
- Help users with their questions about reservations, payments, tickets, etc.
- Propose concrete solutions
- If you cannot resolve the problem, offer to transfer to a human agent

YOUR STYLE:
- Professional but friendly
- Concise (maximum 3-4 sentences)
- Use emojis sparingly (✅ ❌ ⚠️ 💡)
- Always propose concrete actions

IMPORTANT:
- Never invent information
- If you don't know, say so clearly
- Always offer to contact a human agent for complex cases
"#,
        lang_instruction
    );

    // Construire le contexte de conversation
    let conversation_context = if conversation_history.is_empty() {
        format!("Message utilisateur: {}", user_message)
    } else {
        let history = conversation_history
            .iter()
            .enumerate()
            .map(|(i, msg)| format!("Message {}: {}", i + 1, msg))
            .collect::<Vec<_>>()
            .join("\n");
        format!(
            "Historique conversation:\n{}\n\nDernier message utilisateur: {}",
            history, user_message
        )
    };

    // Ajouter le topic si disponible
    let full_context = if let Some(t) = topic {
        format!("Topic: {}\n\n{}", t, conversation_context)
    } else {
        conversation_context
    };

    // Construire le prompt final
    let user_prompt = format!(
        "{}\n\n{}\n\nGenerate a helpful and concise response for the user.",
        system_prompt, full_context
    );

    // Appeler l'IA
    match app_ia.predict(&user_prompt).await {
        Ok((model_name, response, tokens)) => {
            info!(
                "[ChatSupportAI] ✅ Réponse générée avec {} ({} tokens)",
                model_name, tokens
            );

            // Nettoyer la réponse (enlever les balises markdown si présentes)
            let cleaned_response = response
                .trim()
                .trim_start_matches("```")
                .trim_end_matches("```")
                .trim()
                .to_string();

            Ok(cleaned_response)
        }
        Err(e) => {
            error!("[ChatSupportAI] ❌ Erreur génération réponse: {}", e);
            // Fallback : réponse générique
            Ok("Merci pour votre message. Un agent de notre équipe vous répondra dans les plus brefs délais. En attendant, vous pouvez consulter notre FAQ ou nous contacter directement.".to_string())
        }
    }
}

/// Détecter l'intention de l'utilisateur
pub async fn detect_user_intent(app_ia: Arc<AppIA>, user_message: &str) -> AppResult<String> {
    info!("[ChatSupportAI] Détection intention pour: {}", user_message);

    let intent_prompt = format!(
        r#"
Analyse ce message utilisateur et détermine son intention principale.

Message: {}

Catégories possibles:
- reservation: Questions sur les réservations de tickets
- payment: Problèmes de paiement
- cancellation: Annulation ou remboursement
- ticket_info: Informations sur un ticket existant
- technical: Problème technique avec l'application
- complaint: Plainte ou réclamation
- other: Autre question

Réponds UNIQUEMENT avec le nom de la catégorie (ex: "reservation", "payment", etc.)
"#,
        user_message
    );

    match app_ia.predict(&intent_prompt).await {
        Ok((_, response, _)) => {
            let intent = response.trim().to_lowercase();
            info!("[ChatSupportAI] Intention détectée: {}", intent);
            Ok(intent)
        }
        Err(e) => {
            error!("[ChatSupportAI] Erreur détection intention: {}", e);
            Ok("other".to_string())
        }
    }
}

/// Déterminer si l'escalade vers un agent humain est nécessaire
pub async fn should_escalate_to_human(
    app_ia: Arc<AppIA>,
    user_message: &str,
    conversation_history: &[String],
) -> AppResult<bool> {
    info!("[ChatSupportAI] Évaluation escalade pour: {}", user_message);

    // Construire le texte d'historique avant le format! pour éviter le warning de durée de vie
    let history_text = if conversation_history.is_empty() {
        "Aucun historique".to_string()
    } else {
        conversation_history.join("\n")
    };

    let escalation_prompt = format!(
        r#"
Analyse ce message utilisateur et détermine si un agent humain est nécessaire.

Message: {}
Historique: {}

Réponds UNIQUEMENT "yes" ou "no".

Escalade nécessaire si:
- Problème complexe nécessitant une intervention manuelle
- Réclamation sérieuse
- Problème technique complexe
- Demande de remboursement
- Plainte formelle

Sinon réponds "no".
"#,
        user_message, history_text
    );

    match app_ia.predict(&escalation_prompt).await {
        Ok((_, response, _)) => {
            let should_escalate = response.trim().to_lowercase().contains("yes");
            info!("[ChatSupportAI] Escalade nécessaire: {}", should_escalate);
            Ok(should_escalate)
        }
        Err(e) => {
            error!("[ChatSupportAI] Erreur évaluation escalade: {}", e);
            // En cas d'erreur, escalader par sécurité
            Ok(true)
        }
    }
}
