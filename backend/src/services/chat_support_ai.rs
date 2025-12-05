/**
 * Service IA pour chat support
 * Génère des réponses automatiques intelligentes
 */
use crate::core::types::{AppError, AppResult};
use crate::services::app_ia::AppIA;
use crate::state::AppState;
use log::{error, info};
use serde_json::json;
use std::sync::Arc;

/// Générer une réponse IA automatique pour le chat support
pub async fn generate_support_response(
    app_ia: Arc<AppIA>,
    user_message: &str,
    conversation_history: &[String],
    topic: Option<&str>,
) -> AppResult<String> {
    info!(
        "[ChatSupportAI] Génération réponse pour message: {}",
        user_message
    );

    // Construire le prompt système spécialisé pour le support
    let system_prompt = r#"
Tu es l'assistant support intelligent de Yukpomnang, la meilleure plateforme de réservation de tickets de bus en Afrique.

TON RÔLE :
- Répondre de manière utile, concise et professionnelle en français
- Aider les utilisateurs avec leurs questions sur les réservations, paiements, tickets, etc.
- Proposer des solutions concrètes
- Si tu ne peux pas résoudre le problème, proposer de transférer à un agent humain

TON STYLE :
- Professionnel mais amical
- Concis (maximum 3-4 phrases)
- Utilise des emojis avec modération (✅ ❌ ⚠️ 💡)
- Propose toujours des actions concrètes

IMPORTANT :
- Ne jamais inventer d'informations
- Si tu ne sais pas, dis-le clairement
- Propose toujours de contacter un agent humain pour les cas complexes
"#;

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
        "{}\n\n{}\n\nGénère une réponse utile et concise pour l'utilisateur.",
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
        user_message,
        if conversation_history.is_empty() {
            "Aucun historique"
        } else {
            &conversation_history.join("\n")
        }
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
