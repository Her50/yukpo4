use crate::core::types::{AppError, AppResult};
use crate::state::AppState;
use serde::{Deserialize, Serialize};
use std::fmt::Write as _;
use std::sync::Arc;

#[derive(Debug, Deserialize)]
pub struct LiveTeaserRequest {
    pub live_title: String,
    pub product_name: Option<String>,
    #[serde(default)]
    pub product_highlights: Vec<String>,
    pub audience_segment: Option<String>,
    pub host_name: Option<String>,
    pub tone: Option<String>,
    pub offer: Option<String>,
    pub duration_minutes: Option<u32>,
    pub language: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LiveTeaserResponse {
    pub hook: String,
    pub teaser_script: String,
    pub cta: String,
    #[serde(default)]
    pub hashtags: Vec<String>,
    pub push_notification: String,
    pub email_subject: String,
    pub email_body: String,
    pub visual_direction: String,
    #[serde(default)]
    pub talking_points: Vec<String>,
    #[serde(default)]
    pub prep_checklist: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct LiveFollowupRequest {
    pub live_title: String,
    #[serde(default)]
    pub key_highlights: Vec<String>,
    pub audience_reactions: Option<String>,
    pub orders_count: Option<u32>,
    pub next_steps: Option<String>,
    pub language: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LiveFollowupResponse {
    pub executive_summary: String,
    #[serde(default)]
    pub highlight_recap: Vec<String>,
    pub social_post: String,
    pub email_followup: String,
    #[serde(default)]
    pub recommended_actions: Vec<String>,
    pub product_focus: String,
}

#[derive(Debug, Deserialize)]
pub struct LiveInviteRequest {
    pub live_title: String,
    pub product_name: Option<String>,
    #[serde(default)]
    pub audience_segments: Vec<String>,
    pub value_proposition: Option<String>,
    pub host_name: Option<String>,
    pub language: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LiveInviteResponse {
    pub push_notification: String,
    pub sms_copy: String,
    pub email_subject: String,
    pub email_body: String,
    pub social_post: String,
    #[serde(default)]
    pub hashtags: Vec<String>,
}

pub struct LiveAIAutomationService;

impl LiveAIAutomationService {
    pub async fn generate_teaser(
        state: Arc<AppState>,
        payload: &LiveTeaserRequest,
    ) -> AppResult<LiveTeaserResponse> {
        let mut prompt = String::new();
        writeln!(
            prompt,
            "Tu es l'assistant IA marketing de Yukpo, spécialisé dans les lives produits (pas du divertissement). \
            Génère un plan promotionnel en JSON STRICT pour un live shopping produit."
        )
        .ok();
        writeln!(prompt, "Structure de réponse attendue:").ok();
        writeln!(
            prompt,
            "{{\n  \"hook\": string,\n  \"teaser_script\": string,\n  \"cta\": string,\n  \
             \"hashtags\": [string,...],\n  \"push_notification\": string,\n  \
             \"email_subject\": string,\n  \"email_body\": string,\n  \"visual_direction\": string,\n  \
             \"talking_points\": [string,...],\n  \"prep_checklist\": [string,...]\n}}"
        )
        .ok();
        writeln!(prompt, "Contexte live:").ok();
        writeln!(prompt, "- Titre du live: {}", payload.live_title).ok();
        if let Some(name) = &payload.product_name {
            writeln!(prompt, "- Produit phare: {}", name).ok();
        }
        if !payload.product_highlights.is_empty() {
            writeln!(
                prompt,
                "- Points forts produits: {}",
                payload.product_highlights.join("; ")
            )
            .ok();
        }
        if let Some(audience) = &payload.audience_segment {
            writeln!(prompt, "- Audience cible: {}", audience).ok();
        }
        if let Some(host) = &payload.host_name {
            writeln!(prompt, "- Animateur/Prestataire: {}", host).ok();
        }
        if let Some(tone) = &payload.tone {
            writeln!(prompt, "- Ton souhaité: {}", tone).ok();
        }
        if let Some(offer) = &payload.offer {
            writeln!(prompt, "- Offre ou bonus: {}", offer).ok();
        }
        if let Some(duration) = payload.duration_minutes {
            writeln!(prompt, "- Durée estimée: {} minutes", duration).ok();
        }
        let language = payload.language.as_deref().unwrap_or("fr");
        writeln!(
            prompt,
            "Contraintes: réponse en {}, orientée conversion produit (pas de divertissement). \
             Propose un script court (max 90 secondes) et des actions prêtes à l'emploi.",
            language
        )
        .ok();
        writeln!(
            prompt,
            "Réponds UNIQUEMENT avec du JSON valide sans texte additionnel."
        )
        .ok();

        let (_, raw, _) = state.ia.predict(&prompt).await?;
        let parsed: LiveTeaserResponse = parse_ai_json(&raw)?;
        Ok(parsed)
    }

    pub async fn generate_followup(
        state: Arc<AppState>,
        payload: &LiveFollowupRequest,
    ) -> AppResult<LiveFollowupResponse> {
        let mut prompt = String::new();
        writeln!(
            prompt,
            "Tu es l'assistant IA de Yukpo. Génère un compte-rendu actionnable en JSON pour un live produit."
        )
        .ok();
        writeln!(
            prompt,
            "Structure JSON: {{\"executive_summary\": string, \"highlight_recap\": [string,...], \
             \"social_post\": string, \"email_followup\": string, \"recommended_actions\": [string,...], \
             \"product_focus\": string}}"
        )
        .ok();
        writeln!(prompt, "- Titre du live: {}", payload.live_title).ok();
        if !payload.key_highlights.is_empty() {
            writeln!(
                prompt,
                "- Moments clés: {}",
                payload.key_highlights.join("; ")
            )
            .ok();
        }
        if let Some(reactions) = &payload.audience_reactions {
            writeln!(prompt, "- Réactions audience: {}", reactions).ok();
        }
        if let Some(orders) = payload.orders_count {
            writeln!(prompt, "- Commandes enregistrées: {}", orders).ok();
        }
        if let Some(next_steps) = &payload.next_steps {
            writeln!(prompt, "- Étapes prévues: {}", next_steps).ok();
        }
        let language = payload.language.as_deref().unwrap_or("fr");
        writeln!(
            prompt,
            "Réponds uniquement en {} avec du JSON valide, focus sur impact business et actions concrètes.",
            language
        )
        .ok();

        let (_, raw, _) = state.ia.predict(&prompt).await?;
        let parsed: LiveFollowupResponse = parse_ai_json(&raw)?;
        Ok(parsed)
    }

    pub async fn generate_invites(
        state: Arc<AppState>,
        payload: &LiveInviteRequest,
    ) -> AppResult<LiveInviteResponse> {
        let mut prompt = String::new();
        writeln!(
            prompt,
            "Tu es l'IA marketing de Yukpo. Génère des invitations multicanales (push, SMS, email, social) en JSON."
        )
        .ok();
        writeln!(
            prompt,
            "Structure: {{\"push_notification\": string, \"sms_copy\": string, \"email_subject\": string, \
             \"email_body\": string, \"social_post\": string, \"hashtags\": [string,...]}}"
        )
        .ok();
        writeln!(prompt, "- Live: {}", payload.live_title).ok();
        if let Some(product) = &payload.product_name {
            writeln!(prompt, "- Produit phare: {}", product).ok();
        }
        if !payload.audience_segments.is_empty() {
            writeln!(
                prompt,
                "- Segments ciblés: {}",
                payload.audience_segments.join(", ")
            )
            .ok();
        }
        if let Some(value) = &payload.value_proposition {
            writeln!(prompt, "- Proposition de valeur: {}", value).ok();
        }
        if let Some(host) = &payload.host_name {
            writeln!(prompt, "- Animateur: {}", host).ok();
        }
        let language = payload.language.as_deref().unwrap_or("fr");
        writeln!(
            prompt,
            "Réponds en {} uniquement avec du JSON valide. Ton orienté conversion produit (pas de divertissement). \
             Limite le SMS à 140 caractères.",
            language
        )
        .ok();

        let (_, raw, _) = state.ia.predict(&prompt).await?;
        let parsed: LiveInviteResponse = parse_ai_json(&raw)?;
        Ok(parsed)
    }
}

fn parse_ai_json<T: for<'de> Deserialize<'de>>(output: &str) -> AppResult<T> {
    let trimmed = output.trim();
    match serde_json::from_str::<T>(trimmed) {
        Ok(parsed) => return Ok(parsed),
        Err(_) => {
            let start = trimmed.find('{').ok_or_else(|| {
                AppError::Internal(
                    "Réponse IA invalide: impossible de trouver le début d'un objet JSON"
                        .to_string(),
                )
            })?;
            let end = trimmed.rfind('}').ok_or_else(|| {
                AppError::Internal(
                    "Réponse IA invalide: impossible de trouver la fin d'un objet JSON".to_string(),
                )
            })?;
            let slice = &trimmed[start..=end];
            serde_json::from_str::<T>(slice)
                .map_err(|e| AppError::Internal(format!("Impossible de parser le JSON IA: {}", e)))
        }
    }
}
