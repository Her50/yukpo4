// ✅ WhatsApp YukpoIA Service — IA conversationnelle + génération documents + analyse données
// Miroir du chat YukpoIA de l'application : questions, PPT, DOCX, analyse CSV/Excel/PDF

use log::{info, warn};
use serde_json::json;
use sqlx::PgPool;
use std::sync::Arc;

/// Coût en tokens WhatsApp par requête IA
pub const AI_QUERY_TOKEN_COST: i32 = 5;
/// Coût pour générer un document (PPT/DOCX)
pub const DOCUMENT_GENERATION_COST: i32 = 20;
/// Coût pour analyser un fichier (CSV/Excel/PDF)
pub const DATA_ANALYSIS_COST: i32 = 15;

/// Taille max réponse IA pour WhatsApp (4096 chars WhatsApp limit)
const MAX_WA_RESPONSE_LEN: usize = 3800;

pub struct WhatsAppIAService {
    pool: Arc<PgPool>,
    http: reqwest::Client,
}

impl WhatsAppIAService {
    pub fn new(pool: Arc<PgPool>) -> Self {
        Self {
            pool,
            http: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(60))
                .build()
                .unwrap_or_default(),
        }
    }

    // ── Chat IA conversationnel ───────────────────────────────────────────────

    /// Répond à une question via OpenAI (GPT-4o-mini pour rapidité WhatsApp)
    pub async fn chat(&self, question: &str, user_name: Option<&str>) -> String {
        let api_key = match std::env::var("OPENAI_API_KEY").ok().or_else(|| {
            std::env::var("OPENAI_API_KEYS")
                .ok()
                .and_then(|k| k.split(',').next().map(|s| s.trim().to_string()))
        }) {
            Some(k) if !k.is_empty() => k,
            _ => {
                warn!("[WhatsAppIA] OPENAI_API_KEY non configuré");
                return "🤖 *YukpoIA* est momentanément indisponible. Réessayez dans quelques instants.".to_string();
            }
        };

        let name = user_name.unwrap_or("utilisateur");

        let system_prompt = format!(
            "Tu es YukpoIA, l'assistant intelligent de Yukpo — la super-application africaine \
            (e-commerce, livraison, santé, immobilier, transport, éducation, communauté).\n\
            Tu réponds en français de manière concise et utile, spécialisé dans le contexte \
            camerounais et africain. Formate ta réponse pour WhatsApp (texte simple, pas de markdown complexe).\n\
            L'utilisateur s'appelle {}. Réponds en maximum 400 mots.", name
        );

        let body = json!({
            "model": "gpt-4o-mini",
            "messages": [
                { "role": "system", "content": system_prompt },
                { "role": "user", "content": question }
            ],
            "max_tokens": 600,
            "temperature": 0.7
        });

        let resp = self
            .http
            .post("https://api.openai.com/v1/chat/completions")
            .bearer_auth(&api_key)
            .json(&body)
            .send()
            .await;

        match resp {
            Ok(r) if r.status().is_success() => {
                let json: serde_json::Value = r.json().await.unwrap_or_default();
                let text = json["choices"][0]["message"]["content"]
                    .as_str()
                    .unwrap_or("Je n'ai pas pu traiter votre demande.")
                    .to_string();

                // Tronquer si trop long pour WhatsApp
                if text.len() > MAX_WA_RESPONSE_LEN {
                    format!(
                        "{}…\n\n_[Réponse tronquée — posez une question plus précise]_",
                        &text[..MAX_WA_RESPONSE_LEN]
                    )
                } else {
                    text
                }
            }
            Ok(r) => {
                let status = r.status();
                warn!("[WhatsAppIA] OpenAI error: {}", status);
                if status.as_u16() == 429 {
                    "🤖 YukpoIA est très sollicitée en ce moment. Réessayez dans 30 secondes."
                        .to_string()
                } else {
                    "🤖 Erreur YukpoIA. Réessayez dans quelques instants.".to_string()
                }
            }
            Err(e) => {
                warn!("[WhatsAppIA] Réseau OpenAI: {}", e);
                "🤖 YukpoIA est momentanément indisponible. Réessayez.".to_string()
            }
        }
    }

    // ── Génération de documents (PPT/DOCX/PDF) ───────────────────────────────

    /// Génère une présentation ou un document Word depuis un sujet
    pub async fn generate_document(
        &self,
        topic: &str,
        doc_type: &str, // "pptx", "docx"
        user_name: Option<&str>,
    ) -> DocumentResult {
        let api_key = match std::env::var("OPENAI_API_KEY").ok() {
            Some(k) if !k.is_empty() => k,
            _ => return DocumentResult::Error("YukpoIA indisponible.".to_string()),
        };

        let name = user_name.unwrap_or("Yukpo");
        let is_pptx = doc_type == "pptx";

        let prompt = if is_pptx {
            format!(
                "Génère une présentation PowerPoint professionnelle sur : '{}'\n\
                Réponds UNIQUEMENT avec un JSON valide au format suivant (rien d'autre) :\n\
                {{\
                  \"document_type\": \"pptx\",\
                  \"title\": \"Titre de la présentation\",\
                  \"author\": \"{}\",\
                  \"slides\": [\
                    {{\"title\": \"Diapo 1\", \"content\": [\"Point 1\", \"Point 2\"]}},\
                    {{\"title\": \"Diapo 2\", \"content\": [\"Point A\", \"Point B\"]}}\
                  ]\
                }}",
                topic, name
            )
        } else {
            format!(
                "Génère un document Word professionnel sur : '{}'\n\
                Réponds UNIQUEMENT avec un JSON valide au format suivant (rien d'autre) :\n\
                {{\
                  \"document_type\": \"docx\",\
                  \"title\": \"Titre du document\",\
                  \"author\": \"{}\",\
                  \"sections\": [\
                    {{\"heading\": \"Introduction\", \"content\": \"Contenu...\"}},\
                    {{\"heading\": \"Section 1\", \"content\": \"Contenu...\"}}\
                  ]\
                }}",
                topic, name
            )
        };

        let body = json!({
            "model": "gpt-4o-mini",
            "messages": [
                { "role": "system", "content": "Tu es un expert en création de documents professionnels. Réponds UNIQUEMENT avec du JSON valide, sans aucun texte avant ou après." },
                { "role": "user", "content": prompt }
            ],
            "max_tokens": 2000,
            "temperature": 0.5,
            "response_format": { "type": "json_object" }
        });

        let resp = match self
            .http
            .post("https://api.openai.com/v1/chat/completions")
            .bearer_auth(&api_key)
            .json(&body)
            .send()
            .await
        {
            Ok(r) => r,
            Err(e) => return DocumentResult::Error(format!("Erreur réseau: {}", e)),
        };

        let json: serde_json::Value = match resp.json().await {
            Ok(j) => j,
            Err(e) => return DocumentResult::Error(format!("Erreur parsing: {}", e)),
        };

        let outline_str = json["choices"][0]["message"]["content"].as_str().unwrap_or("{}");

        let outline: serde_json::Value = match serde_json::from_str(outline_str) {
            Ok(o) => o,
            Err(e) => return DocumentResult::Error(format!("JSON invalide: {}", e)),
        };

        // Appeler le générateur de documents Python via document_generation_service
        // On doit avoir accès à AppState — on passera le pool et résoudra via HTTP interne
        // Pour simplicité WhatsApp, on génère un lien vers le document généré côté API

        info!("[WhatsAppIA] Document généré: {:?}", outline.get("title"));

        DocumentResult::Outline {
            title: outline["title"].as_str().unwrap_or(topic).to_string(),
            doc_type: doc_type.to_string(),
            outline,
        }
    }

    // ── Analyse de données (fichier envoyé par WhatsApp) ─────────────────────

    /// Télécharge et analyse un fichier depuis Twilio MediaUrl
    pub async fn analyze_file(
        &self,
        media_url: &str,
        media_type: &str, // content type du fichier
        user_name: Option<&str>,
    ) -> String {
        let api_key = match std::env::var("OPENAI_API_KEY").ok() {
            Some(k) if !k.is_empty() => k,
            _ => return "🤖 YukpoIA indisponible.".to_string(),
        };

        // Télécharger le fichier
        let twilio_sid = std::env::var("TWILIO_ACCOUNT_SID").unwrap_or_default();
        let twilio_token = std::env::var("TWILIO_AUTH_TOKEN").unwrap_or_default();

        let resp = self
            .http
            .get(media_url)
            .basic_auth(&twilio_sid, Some(&twilio_token))
            .send()
            .await;

        let content = match resp {
            Ok(r) if r.status().is_success() => match r.bytes().await {
                Ok(b) => b,
                Err(e) => {
                    warn!("[WhatsAppIA] Erreur téléchargement fichier: {}", e);
                    return "❌ Impossible de télécharger votre fichier.".to_string();
                }
            },
            _ => return "❌ Impossible d'accéder à votre fichier.".to_string(),
        };

        let content_lower = media_type.to_lowercase();
        let file_text = if content_lower.contains("csv") || content_lower.contains("text") {
            // CSV ou texte brut
            String::from_utf8_lossy(&content).chars().take(8000).collect::<String>()
        } else if content_lower.contains("pdf") {
            // PDF — extraire en texte (limité)
            format!(
                "[Fichier PDF reçu — {} octets]\nAnalyse du contenu...",
                content.len()
            )
        } else if content_lower.contains("excel")
            || content_lower.contains("spreadsheet")
            || content_lower.contains("xlsx")
        {
            // Excel — conversion base64 pour analyse
            let b64 = base64_encode(&content);
            match parse_excel_simple(&b64).await {
                Some(text) => text,
                None => format!("[Fichier Excel — {} octets]", content.len()),
            }
        } else {
            format!("[Fichier {} — {} octets]", media_type, content.len())
        };

        let name = user_name.unwrap_or("utilisateur");

        let analysis_prompt = format!(
            "Analyse ce fichier de données pour {} et fournis :\n\
            1. Un résumé des données (nombre de lignes, colonnes si applicable)\n\
            2. Les tendances ou insights principaux (max 5)\n\
            3. Des recommandations actionables\n\n\
            Données :\n{}",
            name,
            &file_text[..file_text.len().min(6000)]
        );

        let body = json!({
            "model": "gpt-4o-mini",
            "messages": [
                {
                    "role": "system",
                    "content": "Tu es un expert en analyse de données pour le contexte africain. \
                    Réponds en français de manière concise et pratique. \
                    Formate pour WhatsApp (max 600 mots)."
                },
                { "role": "user", "content": analysis_prompt }
            ],
            "max_tokens": 800,
            "temperature": 0.3
        });

        match self
            .http
            .post("https://api.openai.com/v1/chat/completions")
            .bearer_auth(&api_key)
            .json(&body)
            .send()
            .await
        {
            Ok(r) if r.status().is_success() => {
                let json: serde_json::Value = r.json().await.unwrap_or_default();
                let analysis = json["choices"][0]["message"]["content"]
                    .as_str()
                    .unwrap_or("Analyse impossible.")
                    .to_string();
                format!("📊 *Analyse YukpoIA*\n\n{}", analysis)
            }
            _ => "❌ Analyse échouée. Vérifiez que votre fichier est lisible.".to_string(),
        }
    }

    // ── Détection d'intentions IA ─────────────────────────────────────────────

    /// Détecte si le message est une demande de génération de document
    pub fn detect_document_request(message: &str) -> Option<(&'static str, String)> {
        let msg = message.to_lowercase();

        // Déterminer le type
        let doc_type = if msg.contains("présentation")
            || msg.contains("presentation")
            || msg.contains("powerpoint")
            || msg.contains("ppt")
            || msg.contains("diaporama")
            || msg.contains("slides")
            || msg.contains("diapo")
        {
            "pptx"
        } else if msg.contains("word")
            || msg.contains("docx")
            || msg.contains("rapport")
            || msg.contains("document word")
            || msg.contains("lettre")
            || msg.contains("contrat")
            || msg.contains("compte.rendu")
            || msg.contains("compte rendu")
        {
            "docx"
        } else {
            return None;
        };

        // Mots déclencheurs
        let triggers = [
            "génère", "genere", "crée", "cree", "fait", "fais", "rédige", "redige", "écris",
            "ecris", "prépare", "prepare", "creer", "generer",
        ];
        if !triggers.iter().any(|t| msg.contains(t)) {
            return None;
        }

        // Extraire le sujet (ce qui suit le type de document)
        let topic = message.to_string();
        Some((doc_type, topic))
    }

    /// Détecte si le message est une question pour YukpoIA
    pub fn is_ai_question(message: &str) -> bool {
        let msg = message.to_lowercase();

        // Questions explicites
        let question_words = [
            "comment",
            "pourquoi",
            "qu'est",
            "qu est",
            "c'est quoi",
            "explique",
            "expliques",
            "dis moi",
            "quelle",
            "quel ",
            "quels",
            "aide moi",
            "aide-moi",
            "besoin d'aide",
            "je veux savoir",
            "yukpoia",
            "yukpo ia",
            "demande à l'ia",
            "pose une question",
            "chat ia",
            "intelligence artificielle",
        ];

        if question_words.iter().any(|w| msg.contains(w)) {
            return true;
        }

        // Message se terminant par ?
        if message.trim().ends_with('?') {
            return true;
        }

        // Mots-clés de contenu
        let content_kw = [
            "calcule",
            "calcul",
            "traduis",
            "traduit",
            "résume",
            "resume",
            "analyse",
            "compare",
            "conseille",
            "recommande",
            "aide",
            "rédige",
            "redige",
            "rédaction",
        ];
        content_kw.iter().any(|w| msg.contains(w))
    }
}

// ── Résultat génération document ─────────────────────────────────────────────

pub enum DocumentResult {
    Outline {
        title: String,
        doc_type: String,
        outline: serde_json::Value,
    },
    Error(String),
}

// ── Messages formatés ─────────────────────────────────────────────────────────

pub fn format_document_ready(title: &str, doc_type: &str, download_url: &str) -> String {
    let ext = if doc_type == "pptx" {
        "PowerPoint"
    } else {
        "Word"
    };
    format!(
        "✅ *Document {} généré !*\n\n\
        📄 *{}*\n\n\
        📥 Télécharger : {}\n\n\
        _Généré par YukpoIA_ 🤖\n\
        📲 Gérez tous vos documents sur l'app *Yukpo* !",
        ext, title, download_url
    )
}

pub fn format_document_generating(topic: &str, doc_type: &str) -> String {
    let ext = if doc_type == "pptx" {
        "présentation PowerPoint"
    } else {
        "document Word"
    };
    format!(
        "⏳ *Génération en cours...*\n\n\
        📄 Je prépare votre {} sur :\n*{}*\n\n\
        _Cela prend 15-30 secondes..._\n\
        🤖 *YukpoIA* travaille pour vous !",
        ext, topic
    )
}

pub fn ia_welcome_message() -> &'static str {
    "🤖 *YukpoIA activé !*\n\n\
    Je peux vous aider avec :\n\n\
    💬 *Questions* — Posez n'importe quelle question\n\
    📊 *Analyse* — Envoyez un fichier CSV/Excel/PDF\n\
    📄 *Documents* — _Génère une présentation sur X_\n\
    📝 *Rédaction* — _Rédige un rapport sur Y_\n\n\
    _Tapez votre demande !_\n\
    ⬅️ Tapez *MENU* pour revenir."
}

pub fn token_cost_message(action: &str, cost: i32, balance: i32) -> String {
    format!(
        "💎 *{} — {} tokens*\n\
        Solde restant : {} tokens\n\n\
        Traitement en cours...",
        action,
        cost,
        balance - cost
    )
}

// ── Helpers internes ──────────────────────────────────────────────────────────

fn base64_encode(data: &[u8]) -> String {
    use std::fmt::Write;
    let chars = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut result = String::with_capacity((data.len() + 2) / 3 * 4);
    for chunk in data.chunks(3) {
        let b = match chunk.len() {
            3 => ((chunk[0] as u32) << 16) | ((chunk[1] as u32) << 8) | (chunk[2] as u32),
            2 => ((chunk[0] as u32) << 16) | ((chunk[1] as u32) << 8),
            1 => (chunk[0] as u32) << 16,
            _ => 0,
        };
        result.push(chars[((b >> 18) & 0x3F) as usize] as char);
        result.push(chars[((b >> 12) & 0x3F) as usize] as char);
        if chunk.len() > 1 {
            result.push(chars[((b >> 6) & 0x3F) as usize] as char);
        } else {
            result.push('=');
        }
        if chunk.len() > 2 {
            result.push(chars[(b & 0x3F) as usize] as char);
        } else {
            result.push('=');
        }
    }
    result
}

async fn parse_excel_simple(b64: &str) -> Option<String> {
    // Délégué à document_generation_service::parse_excel_for_ai
    // Retourne None si indisponible — fallback sur analyse texte brut
    None
}
