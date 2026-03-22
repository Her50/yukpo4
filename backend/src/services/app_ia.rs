// This file contains the implementation of the AppIA service.

use base64::{engine::general_purpose::STANDARD, Engine as _};
use redis::AsyncCommands;
use redis::Client as RedisClient;
use reqwest::header::HeaderValue;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::PgPool;
use std::fs;
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tokio::sync::{Mutex, RwLock};
use uuid::Uuid;
use whatlang::detect;

use crate::controllers::ia_status_controller::IAStats;
use crate::core::types::AppError;
use crate::core::types::AppResult;

/// Construit un en-tête Authorization valide pour l'API OpenAI.
/// Trim la clé, supprime les caractères de contrôle (CR, LF, BOM, etc.) qui peuvent
/// provenir de l'injection de secrets (GCP Secret Manager, etc.) et causer
/// "failed to parse header value". En cas d'échec, log un diagnostic (longueur, octets).
fn openai_auth_header_value(api_key: &str) -> Result<HeaderValue, String> {
    let key = api_key.trim();
    let key_clean: String = key.chars().filter(|c| !c.is_control()).collect();
    let value = format!("Bearer {}", key_clean);
    HeaderValue::from_str(&value).map_err(|e| {
        let bytes: Vec<u8> = key.bytes().collect();
        let len = bytes.len();
        let first5: Vec<u8> = bytes.iter().take(5).copied().collect();
        let last5: Vec<u8> = bytes[bytes.len().saturating_sub(5)..].to_vec();
        log::error!(
            "[AppIA] Authorization header invalid: {}. key_len={}, first5_bytes={:?}, last5_bytes={:?} (check CR/LF/BOM in OPENAI_API_KEY)",
            e,
            len,
            first5,
            last5
        );
        format!(
            "Invalid OPENAI_API_KEY (header parse failed): {} (key length {}, check CR/LF/BOM in secret)",
            e, len
        )
    })
}

/// **Point d’entrée unique** dans AppIA pour : sémaphore sortant + retries 429/503 (`yukpo_openai_outbound`).
/// Utilisé par YukpoIA (`chat_completion_*`) et par les helpers legacy `call_*` — **un** enchaînement par requête HTTP, pas de doublon.
async fn app_ia_resilient_request<F>(label: &str, build: F) -> Result<reqwest::Response, String>
where
    F: FnMut() -> reqwest::RequestBuilder,
{
    let _slot = crate::services::yukpo_openai_outbound::acquire_concurrency_permit().await;
    crate::services::yukpo_openai_outbound::send_request_with_retry(label, build).await
}

/// ?? Configuration avanc?e pour les mod?les IA
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelConfig {
    pub name: String,
    pub api_key: String,
    pub base_url: String,
    pub model: String,
    pub temperature: f32,
    pub max_tokens: u32,
    pub top_p: f32,
    pub frequency_penalty: f32,
    pub presence_penalty: f32,
    pub timeout: u64,
    pub retry_count: u32,
    pub priority: u8, // 1-10, 10 = plus prioritaire
    pub cost_per_token: f64,
    pub enabled: bool,
}

/// ?? M?triques de performance par mod?le
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ModelMetrics {
    pub total_requests: u64,
    pub successful_requests: u64,
    pub failed_requests: u64,
    pub total_tokens_used: u64,
    pub total_cost: f64,
    pub average_response_time: f64,
    pub last_used: Option<u64>,
    pub success_rate: f64,
}

/// ?? Feedback utilisateur pour l'apprentissage
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserFeedback {
    pub interaction_id: String,
    pub user_id: Option<i32>,
    pub prompt: String,
    pub response: String,
    pub model_used: String,
    pub rating: u8, // 1-5
    pub feedback_text: Option<String>,
    pub timestamp: u64,
    pub context: Value,
}

/// ?? Donn?es d'apprentissage pour fine-tuning
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrainingData {
    pub id: String,
    pub prompt: String,
    pub expected_response: String,
    pub actual_response: String,
    pub model_used: String,
    pub user_feedback: Option<UserFeedback>,
    pub quality_score: f64,
    pub created_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct VideoBrief {
    pub headline: Option<String>,
    pub call_to_action: Option<String>,
    pub script_outline: Vec<String>,
    pub hook: Option<String>,
    pub voiceover: Option<String>,
    pub hashtags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct VideoStyleSuggestion {
    pub effects: Vec<String>,
    pub transitions: Vec<String>,
    pub color_palette: Option<String>,
    pub overlay_tips: Vec<String>,
    pub music_hint: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct MediaAnalysisResult {
    pub dominant_colors: Vec<String>,
    pub detected_objects: Vec<String>,
    pub ambiance: Option<String>,
    pub marketing_angle: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DistributionSuggestion {
    pub summary: Option<String>,
    pub hashtags: Vec<String>,
    pub schedule: Vec<DistributionScheduleItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DistributionScheduleItem {
    pub channel: String,
    pub best_time: String,
    pub call_to_action: Option<String>,
}

#[derive(Debug, Clone)]
pub struct VideoBriefRequest {
    pub product_name: String,
    pub description: Option<String>,
    pub price: Option<String>,
    pub promotion: Option<String>,
    pub highlights: Vec<String>,
    pub target_audience: Option<String>,
    pub tone: Option<String>,
    pub lang: String,
    pub variant_count: usize,
}

#[derive(Debug, Clone)]
pub struct VideoStyleRequest {
    pub channel: String,
    pub product_type: Option<String>,
    pub tone: Option<String>,
    pub promotion: Option<String>,
    pub highlights: Vec<String>,
    pub lang: String,
}

#[derive(Debug, Clone)]
pub struct MediaAnalysisRequest {
    pub product_name: String,
    pub media_tags: Vec<String>,
    pub description: Option<String>,
    pub lang: String,
}

/// ✅ NOUVEAU: Structure pour une scène de timeline
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimelineScene {
    pub scene_index: usize,
    pub start_time: f64, // secondes
    pub duration: f64,   // secondes
    pub media_id: Option<String>,
    pub media_url: Option<String>,
    pub text: Option<String>,
    pub text_position: Option<String>, // 'top' | 'center' | 'bottom'
    pub transition: Option<String>,    // 'fade' | 'slide' | 'zoom' | 'none'
    pub effects: Vec<String>,          // Liste des effets à appliquer
    pub audio_cue: Option<f64>,        // Timing pour synchronisation audio (secondes)
}

/// ✅ NOUVEAU: Structure pour la timeline complète
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct VideoTimeline {
    pub total_duration: f64,
    pub scenes: Vec<TimelineScene>,
}

/// ✅ NOUVEAU: Requête pour générer une timeline
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimelineRequest {
    pub brief: TimelineBriefInput,
    pub style: TimelineStyleInput,
    pub available_media: Vec<TimelineMediaItem>,
    pub duration_seconds: f64,
    pub voiceover_script: Option<String>,
    pub music_track_id: Option<String>,
    pub lang: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimelineBriefInput {
    pub script_outline: Vec<String>,
    pub headline: Option<String>,
    pub call_to_action: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimelineStyleInput {
    pub effects: Vec<String>,
    pub transitions: Vec<String>,
    pub color_palette: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimelineMediaItem {
    pub id: String,
    pub url: Option<String>,
    pub media_type: String, // 'image' | 'video'
}

#[derive(Debug, Clone)]
pub struct DistributionRequest {
    pub product_name: String,
    pub channels: Vec<String>,
    pub target_audience: Option<String>,
    pub marketing_angle: Option<String>,
    pub lang: String,
}

/// ?? Service IA avanc? avec apprentissage autonome
pub struct AppIA {
    pub redis_client: RedisClient,
    pub http: Client,
    pub stats: Arc<Mutex<IAStats>>,
    pub models: Arc<RwLock<Vec<ModelConfig>>>,
    pub metrics: Arc<RwLock<std::collections::HashMap<String, ModelMetrics>>>,
    pub feedback_queue: Arc<Mutex<Vec<UserFeedback>>>,
    pub training_data: Arc<Mutex<Vec<TrainingData>>>,
    pub pool: PgPool,
}

impl AppIA {
    pub fn new(redis_client: RedisClient, stats: Arc<Mutex<IAStats>>, pool: PgPool) -> Self {
        let models = Self::initialize_models();
        let metrics = Arc::new(RwLock::new(std::collections::HashMap::new()));

        AppIA {
            redis_client,
            stats,
            // Même pool connexions / timeouts que YukpoIA (`yukpo_openai_outbound`)
            http: crate::services::yukpo_openai_outbound::http_client().clone(),
            models: Arc::new(RwLock::new(models)),
            metrics,
            feedback_queue: Arc::new(Mutex::new(Vec::new())),
            training_data: Arc::new(Mutex::new(Vec::new())),
            pool,
        }
    }

    pub fn from_arc(
        redis_client: Arc<RedisClient>,
        stats: Arc<Mutex<IAStats>>,
        pool: PgPool,
    ) -> Self {
        Self::new((*redis_client).clone(), stats, pool)
    }

    /// ?? Initialisation des mod?les IA avec configuration avanc?e
    fn initialize_models() -> Vec<ModelConfig> {
        // ✅ DIAGNOSTIC 2026-02-19: Logs immédiats sur stderr pour diagnostic Cloud Run
        eprintln!("[AppIA::initialize_models] 🚀 Début initialisation des modèles IA...");
        let mut models = Vec::new();

        // OpenAI GPT-4o (priorit? haute) - Mod?le multimodal le plus avanc?
        match std::env::var("OPENAI_API_KEY") {
            Ok(raw_key) => {
                let api_key = raw_key.trim().to_string();
                log::info!(
                    "[AppIA] ✅ OPENAI_API_KEY chargée (longueur: {}, préfixe: {}...)",
                    api_key.len(),
                    &api_key[..std::cmp::min(20, api_key.len())]
                );
                eprintln!(
                    "[AppIA::initialize_models] ✅ OPENAI_API_KEY trouvée (longueur: {}, préfixe: {}...)",
                    api_key.len(),
                    &api_key[..std::cmp::min(20, api_key.len())]
                );
                models.push(ModelConfig {
                    name: "openai-gpt4o".to_string(),
                    api_key,
                    base_url: "https://api.openai.com/v1".to_string(),
                    model: "gpt-4o".to_string(),
                    temperature: 0.2, // R?duit pour plus de coh?rence et rapidit?
                    max_tokens: 1500, // R?duit pour acc?l?rer
                    top_p: 0.8,       // R?duit pour plus de pr?cision
                    frequency_penalty: 0.0, // Supprim? pour acc?l?rer
                    presence_penalty: 0.0, // Supprim? pour acc?l?rer
                    timeout: 60, // ✅ Augmenté à 60s pour analyse complète des images (éviter timeouts)
                    retry_count: 2, // R?duit ? 2 tentatives
                    priority: 10,
                    cost_per_token: 0.000005, // GPT-4o est moins cher que GPT-4 Turbo
                    enabled: true,
                });
            }
            Err(e) => {
                log::error!("[AppIA] ❌ OPENAI_API_KEY non trouvée: {} - Les modèles OpenAI ne seront pas disponibles", e);
                eprintln!(
                    "[AppIA::initialize_models] ❌ OPENAI_API_KEY NON TROUVÉE: {} - Les modèles OpenAI ne seront pas disponibles",
                    e
                );
            }
        }

        // OpenAI GPT-4 Turbo (fallback)
        if let Ok(raw_key) = std::env::var("OPENAI_API_KEY") {
            let api_key = raw_key.trim().to_string();
            if !api_key.is_empty() {
                models.push(ModelConfig {
                    name: "openai-gpt4o-mini".to_string(),
                    api_key,
                    base_url: "https://api.openai.com/v1".to_string(),
                    model: "gpt-4o-mini".to_string(),
                    temperature: 0.3,       // R?duit pour plus de rapidit?
                    max_tokens: 2000,       // R?duit pour acc?l?rer
                    top_p: 0.8,             // R?duit pour plus de pr?cision
                    frequency_penalty: 0.0, // Supprim? pour acc?l?rer
                    presence_penalty: 0.0,  // Supprim? pour acc?l?rer
                    timeout: 60,            // ✅ Augmenté pour éviter timeouts extrêmes
                    retry_count: 2,         // R?duit ? 2 tentatives
                    priority: 9,
                    cost_per_token: 0.00000015,
                    enabled: true,
                });
            }
        }

        // OpenAI GPT-3.5 Turbo (priorit? moyenne)
        if let Ok(raw_key) = std::env::var("OPENAI_API_KEY") {
            let api_key = raw_key.trim().to_string();
            if !api_key.is_empty() {
                models.push(ModelConfig {
                    name: "openai-gpt35".to_string(),
                    api_key,
                    base_url: "https://api.openai.com/v1".to_string(),
                    model: "gpt-3.5-turbo".to_string(),
                    temperature: 0.7,
                    max_tokens: 4000,
                    top_p: 0.9,
                    frequency_penalty: 0.1,
                    presence_penalty: 0.1,
                    timeout: 60, // ✅ Augmenté pour éviter timeouts extrêmes
                    retry_count: 3,
                    priority: 8,
                    cost_per_token: 0.000002,
                    enabled: true,
                });
            }
        }

        // Mistral AI (priorit? haute)
        if let Ok(api_key) = std::env::var("MISTRAL_API_KEY") {
            models.push(ModelConfig {
                name: "mistral-large".to_string(),
                api_key,
                base_url: "https://api.mistral.ai/v1".to_string(),
                model: "mistral-large-latest".to_string(),
                temperature: 0.3,       // R?duit pour plus de rapidit?
                max_tokens: 2000,       // R?duit pour acc?l?rer
                top_p: 0.8,             // R?duit pour plus de pr?cision
                frequency_penalty: 0.0, // Supprim? pour acc?l?rer
                presence_penalty: 0.0,  // Supprim? pour acc?l?rer
                timeout: 60,            // ✅ Augmenté pour éviter timeouts extrêmes
                retry_count: 2,         // R?duit ? 2 tentatives
                priority: 3,
                cost_per_token: 0.000024,
                enabled: true,
            });
        }

        // Google Gemini Pro (priorit? haute) - Mod?le multimodal avanc?
        if let Ok(api_key) = std::env::var("GEMINI_API_KEY") {
            models.push(ModelConfig {
                name: "gemini-pro".to_string(),
                api_key,
                base_url: "https://generativelanguage.googleapis.com/v1beta".to_string(),
                model: "gemini-1.5-pro".to_string(),
                temperature: 0.7,
                max_tokens: 4000,
                top_p: 0.9,
                frequency_penalty: 0.1,
                presence_penalty: 0.1,
                timeout: 60, // ✅ Augmenté à 60s pour analyse complète des images (éviter timeouts)
                retry_count: 3,
                priority: 5,
                cost_per_token: 0.00000375, // Tr?s ?conomique
                enabled: true,
            });
        }

        // DeepSeek Chat (priorit? interm?diaire)
        if let Ok(api_key) = std::env::var("DEEPSEEK_API_KEY") {
            models.push(ModelConfig {
                name: "deepseek-chat".to_string(),
                api_key,
                base_url: std::env::var("DEEPSEEK_BASE_URL")
                    .unwrap_or_else(|_| "https://api.deepseek.com/v1".to_string()),
                model: std::env::var("DEEPSEEK_MODEL")
                    .unwrap_or_else(|_| "deepseek-chat".to_string()),
                temperature: 0.6,
                max_tokens: 4000,
                top_p: 0.9,
                frequency_penalty: 0.0,
                presence_penalty: 0.0,
                timeout: 40,
                retry_count: 3,
                priority: 4,
                cost_per_token: 0.000002,
                enabled: true,
            });
        }

        // Anthropic Claude 3.5 Sonnet (priorit? haute) - Mod?le multimodal avanc?
        if let Ok(api_key) = std::env::var("ANTHROPIC_API_KEY") {
            models.push(ModelConfig {
                name: "claude-3-5-sonnet".to_string(),
                api_key,
                base_url: "https://api.anthropic.com/v1".to_string(),
                model: "claude-3-5-sonnet-20241022".to_string(),
                temperature: 0.7,
                max_tokens: 4000,
                top_p: 0.9,
                frequency_penalty: 0.1,
                presence_penalty: 0.1,
                timeout: 60, // ✅ Augmenté à 60s pour analyse complète des images (éviter timeouts)
                retry_count: 3,
                priority: 7,
                cost_per_token: 0.000003, // Tr?s ?conomique
                enabled: true,
            });
        }

        // Anthropic Claude 3 Sonnet (fallback)
        if let Ok(api_key) = std::env::var("ANTHROPIC_API_KEY") {
            models.push(ModelConfig {
                name: "claude-3-sonnet".to_string(),
                api_key,
                base_url: "https://api.anthropic.com/v1".to_string(),
                model: "claude-3-sonnet-20240229".to_string(),
                temperature: 0.7,
                max_tokens: 4000,
                top_p: 0.9,
                frequency_penalty: 0.1,
                presence_penalty: 0.1,
                timeout: 60, // ✅ Augmenté pour éviter timeouts extrêmes
                retry_count: 3,
                priority: 6,
                cost_per_token: 0.000015,
                enabled: true,
            });
        }

        // Ollama local (fallback)
        if std::env::var("OLLAMA_URL").is_ok() {
            models.push(ModelConfig {
                name: "ollama-mistral".to_string(),
                api_key: String::new(),
                base_url: std::env::var("OLLAMA_URL")
                    .unwrap_or("http://localhost:11434".to_string()),
                model: "mistral".to_string(),
                temperature: 0.7,
                max_tokens: 4000,
                top_p: 0.9,
                frequency_penalty: 0.1,
                presence_penalty: 0.1,
                timeout: 60, // ✅ Augmenté pour éviter timeouts extrêmes
                retry_count: 3,
                priority: 2,
                cost_per_token: 0.0,
                enabled: true,
            });
        }

        // Ollama Llama2 (fallback local)
        if std::env::var("OLLAMA_URL").is_ok() {
            models.push(ModelConfig {
                name: "ollama-llama2".to_string(),
                api_key: String::new(),
                base_url: std::env::var("OLLAMA_URL")
                    .unwrap_or("http://localhost:11434".to_string()),
                model: "llama2".to_string(),
                temperature: 0.7,
                max_tokens: 4000,
                top_p: 0.9,
                frequency_penalty: 0.1,
                presence_penalty: 0.1,
                timeout: 60, // ✅ Augmenté pour éviter timeouts extrêmes
                retry_count: 3,
                priority: 1,
                cost_per_token: 0.0,
                enabled: true,
            });
        }

        // Cohere Command (alternative)
        if let Ok(api_key) = std::env::var("COHERE_API_KEY") {
            models.push(ModelConfig {
                name: "cohere-command".to_string(),
                api_key,
                base_url: "https://api.cohere.ai/v1".to_string(),
                model: "command".to_string(),
                temperature: 0.7,
                max_tokens: 4000,
                top_p: 0.9,
                frequency_penalty: 0.1,
                presence_penalty: 0.1,
                timeout: 60, // ✅ Augmenté pour éviter timeouts extrêmes
                retry_count: 3,
                priority: 2,
                cost_per_token: 0.000015,
                enabled: true,
            });
        }

        // Trier par priorit? d?croissante
        models.sort_by(|a, b| b.priority.cmp(&a.priority));

        // Log de debug pour voir quels modèles ont été initialisés
        let openai_models: Vec<&str> = models
            .iter()
            .filter(|m| m.name.starts_with("openai-"))
            .map(|m| m.name.as_str())
            .collect();
        if !openai_models.is_empty() {
            log::info!(
                "[AppIA] ✅ Modèles OpenAI initialisés: {:?} (total: {} modèles)",
                openai_models,
                models.len()
            );
            eprintln!(
                "[AppIA::initialize_models] ✅ Modèles OpenAI initialisés: {:?} (total: {} modèles)",
                openai_models,
                models.len()
            );
        } else {
            log::warn!(
                "[AppIA] ⚠️ Aucun modèle OpenAI initialisé (total: {} modèles)",
                models.len()
            );
            eprintln!(
                "[AppIA::initialize_models] ⚠️ Aucun modèle OpenAI initialisé (total: {} modèles) - Le système utilisera le fallback",
                models.len()
            );
        }

        // ✅ DIAGNOSTIC 2026-02-19: Lister tous les modèles initialisés
        let all_model_names: Vec<&str> = models.iter().map(|m| m.name.as_str()).collect();
        eprintln!(
            "[AppIA::initialize_models] 📋 Tous les modèles initialisés: {:?}",
            all_model_names
        );
        log::info!(
            "[AppIA] 📋 Tous les modèles initialisés: {:?}",
            all_model_names
        );

        models
    }

    pub fn detect_language(&self, texte: &str) -> Option<String> {
        detect(texte).map(|info| info.lang().code().to_string())
    }

    /// ?? Pr?diction intelligente avec s?lection automatique du meilleur mod?le
    pub async fn predict(&self, prompt: &str) -> AppResult<(String, String, u32)> {
        let start_time = SystemTime::now();
        let interaction_id = Uuid::new_v4().to_string();

        // ?? OPTIMISATION PERFORMANCE : Timeout augment? ? 20s
        log::info!("[AppIA] Tentative avec mod?les IA optimis?s");

        // 1. ✅ Vérification du cache Redis (ACTIVÉ)
        let cache_key = format!("ai:prompt:{}", Self::_hash_prompt(prompt));
        match self.redis_client.get_multiplexed_async_connection().await {
            Ok(mut conn) => match conn.get::<_, Option<String>>(&cache_key).await {
                Ok(Some(response_json)) => {
                    log::info!(
                        "[AppIA] ✅ Cache Redis HIT pour prompt hash: {}",
                        &cache_key[..16]
                    );
                    if let Ok(cached_data) = serde_json::from_str::<Value>(&response_json) {
                        let model_name = cached_data
                            .get("model")
                            .and_then(|v| v.as_str())
                            .unwrap_or("cached")
                            .to_string();
                        let response = cached_data
                            .get("response")
                            .and_then(|v| v.as_str())
                            .unwrap_or(&response_json)
                            .to_string();
                        let tokens =
                            cached_data.get("tokens").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
                        return Ok((model_name, response, tokens));
                    }
                }
                Ok(None) => {
                    log::debug!("[AppIA] Cache Redis MISS - continuation avec appel IA");
                }
                Err(e) => {
                    log::warn!(
                        "[AppIA] Erreur lecture cache Redis: {} - continuation sans cache",
                        e
                    );
                }
            },
            Err(e) => {
                log::warn!(
                    "[AppIA] Impossible de se connecter à Redis: {} - continuation sans cache",
                    e
                );
            }
        }

        // 2. S?lection intelligente du mod?le
        let models = self.models.read().await;
        let mut enabled_models: Vec<&ModelConfig> = models.iter().filter(|m| m.enabled).collect();
        enabled_models.sort_by(|a, b| b.priority.cmp(&a.priority));

        if enabled_models.is_empty() {
            log::warn!("[AppIA] Aucun mod?le activ?, utilisation du fallback");
            eprintln!("[AppIA::predict] ⚠️ Aucun modèle activé - Utilisation du fallback");
            eprintln!(
                "[AppIA::predict] 📊 Total modèles dans la liste: {}",
                models.len()
            );
            let all_model_names: Vec<&str> = models.iter().map(|m| m.name.as_str()).collect();
            eprintln!(
                "[AppIA::predict] 📋 Modèles dans la liste: {:?}",
                all_model_names
            );
            let (model_name, response) = self.generate_fallback_response(prompt)?;
            let response_string = response.to_string();
            // ?? CORRECTION : L'ordre de retour doit être (model_name, response, tokens)
            return Ok((model_name, response_string, 5));
        }

        // ✅ DIAGNOSTIC 2026-02-19: Log des modèles disponibles
        let model_names: Vec<&str> = enabled_models.iter().map(|m| m.name.as_str()).collect();
        log::info!(
            "[AppIA] 🔍 {} modèle(s) disponible(s) pour prédiction: {:?}",
            enabled_models.len(),
            model_names
        );
        eprintln!(
            "[AppIA::predict] 🔍 {} modèle(s) disponible(s) pour prédiction: {:?}",
            enabled_models.len(),
            model_names
        );

        // 3. ? OPTIMISATION : Timeout optimis? pour performance
        let mut _last_error = None;
        let enabled_models_count = enabled_models.len(); // ✅ Sauvegarder la longueur avant le déplacement

        for model in &enabled_models {
            log::info!(
                "[AppIA] Tentative avec mod?le: {} (timeout: 30s)",
                model.name
            );
            // ✅ Utilisation des timeouts adaptatifs selon type de requête
            use crate::config::ai_timeouts::{AIRequestType, AITimeoutConfig};
            let timeout_duration = AITimeoutConfig::get_timeout(AIRequestType::Standard);
            log::debug!(
                "[AppIA] Timeout adaptatif utilisé: {}s",
                timeout_duration.as_secs()
            );
            match tokio::time::timeout(timeout_duration, async {
                self.call_model(model, prompt, &interaction_id).await
            })
            .await
            {
                Ok(Ok((model_name, response, tokens))) => {
                    let processing_time =
                        SystemTime::now().duration_since(start_time).unwrap().as_millis();
                    log::info!(
                        "[AppIA] ? Succ?s avec {} en {}ms ({} tokens)",
                        model_name,
                        processing_time,
                        tokens
                    );

                    // ✅ Mise en cache Redis (TTL: 24h pour recommandations, 12h pour analyses, 6h pour prédictions)
                    let cache_ttl = 86400; // 24h par défaut
                    let cache_data = json!({
                        "model": model_name,
                        "response": response,
                        "tokens": tokens,
                        "timestamp": SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs()
                    });
                    if let Ok(cache_json) = serde_json::to_string(&cache_data) {
                        if let Ok(mut conn) =
                            self.redis_client.get_multiplexed_async_connection().await
                        {
                            if let Err(e) =
                                conn.set_ex::<_, _, ()>(&cache_key, &cache_json, cache_ttl).await
                            {
                                log::warn!("[AppIA] Erreur mise en cache Redis: {}", e);
                            } else {
                                log::debug!(
                                    "[AppIA] ✅ Réponse mise en cache Redis (TTL: {}s)",
                                    cache_ttl
                                );
                            }
                        }
                    }

                    return Ok((model_name, response, tokens));
                }
                Ok(Err(e)) => {
                    log::warn!("[AppIA] ? Erreur avec {}: {}", model.name, e);
                    _last_error = Some(e);
                }
                Err(_) => {
                    log::warn!("[AppIA] ⚠️ Timeout avec {} (60s)", model.name);
                    _last_error = Some(AppError::Internal("Timeout".to_string()));
                }
            }
        }

        // 4. Fallback intelligent si tous les mod?les ?chouent
        log::warn!("[AppIA] Tous les mod?les ont ?chou?, utilisation du fallback intelligent");
        eprintln!(
            "[AppIA::predict] ⚠️ Tous les {} modèle(s) ont échoué - Utilisation du fallback intelligent",
            enabled_models_count
        );
        if let Some(last_err) = _last_error {
            eprintln!("[AppIA::predict] 📋 Dernière erreur: {}", last_err);
        }
        let (model_name, response_json) = self.generate_fallback_response(prompt)?;
        let response_string = response_json.to_string();
        // Mise ? jour des m?triques pour le fallback
        self.update_metrics_with_tokens(&model_name, true, start_time, 5).await;
        self.record_interaction(&interaction_id, prompt, &response_string, &model_name)
            .await;
        // ?? CORRECTION : L'ordre de retour doit être (model_name, response, tokens)
        return Ok((model_name, response_string, 5));
    }

    /// ??? Pr?diction multimodale avec support des images
    pub async fn predict_multimodal(
        &self,
        prompt: &str,
        images: Option<Vec<String>>,
    ) -> AppResult<(String, String, u32)> {
        let start_time = SystemTime::now();
        let interaction_id = Uuid::new_v4().to_string();

        // ? NOUVEAU : Configuration adaptative
        let production_config = crate::config::production_config::ProductionConfig::new();

        log::info!("[AppIA] Tentative multimodale avec mod?les IA optimis?s");

        // ✅ Utilisation des timeouts adaptatifs
        use crate::config::ai_timeouts::AITimeoutConfig;
        let multimodal_timeout = AITimeoutConfig::get_multimodal_timeout();

        log::info!(
            "[AppIA] Configuration: GPU={}, Timeout adaptatif={}s",
            production_config.gpu_enabled,
            multimodal_timeout.as_secs()
        );

        // 1. S?lection intelligente du mod?le (priorit? aux mod?les multimodaux)
        let models = self.models.read().await;
        let mut enabled_models: Vec<&ModelConfig> =
            models.iter().filter(|m| m.enabled && self.supports_multimodal(m)).collect();
        enabled_models.sort_by(|a, b| b.priority.cmp(&a.priority));

        if enabled_models.is_empty() {
            log::warn!("[AppIA] Aucun mod?le multimodal activ?, fallback vers texte uniquement");
            return self.predict(prompt).await;
        }

        // 2. Test des mod?les multimodaux avec timeout adaptatif
        let mut _last_error = None;
        for model in enabled_models.iter().take(1) {
            // ✅ Timeout adaptatif : utilise toujours le timeout configuré (60s par défaut)
            // Augmenté pour permettre l'analyse complète des images même sans GPU
            let timeout_duration = multimodal_timeout;

            log::info!(
                "[AppIA] Test multimodal du mod?le: {} (timeout {}s)",
                model.name,
                timeout_duration.as_secs()
            );

            let timeout_future = tokio::time::timeout(
                timeout_duration,
                self.call_model_multimodal(model, prompt, images.as_ref(), &interaction_id),
            );

            match timeout_future.await {
                Ok(Ok((model_name, response, tokens_used))) => {
                    let elapsed = SystemTime::now().duration_since(start_time).unwrap().as_millis();
                    log::info!(
                        "[AppIA] ? Mod?le multimodal {} r?ussi en {}ms",
                        model_name,
                        elapsed
                    );
                    self.update_metrics_with_tokens(&model_name, true, start_time, tokens_used)
                        .await;
                    self.record_interaction(&interaction_id, prompt, &response, &model_name).await;
                    return Ok((model_name, response.to_string(), tokens_used));
                }
                Ok(Err(e)) => {
                    log::warn!("[AppIA] Mod?le multimodal {} ?chec: {}", model.name, e);
                    _last_error = Some(e);
                }
                Err(_) => {
                    log::warn!(
                        "[AppIA] ? Mod?le multimodal {} timeout apr?s {}s",
                        model.name,
                        timeout_duration.as_secs()
                    );
                    _last_error = Some("Timeout".into());
                }
            }

            self.update_metrics(&model.name, false, start_time).await;
        }

        // 3. Fallback vers texte uniquement si multimodal ?choue
        log::warn!("[AppIA] Mod?les multimodaux ont ?chou?, fallback vers texte uniquement");
        self.predict(prompt).await
    }

    /// Génère des sous-titres au format SRT via l'orchestrateur IA
    pub async fn generate_subtitles_srt(
        &self,
        product_name: &str,
        outline: &[String],
        lang: &str,
        duration_seconds: u32,
    ) -> AppResult<Option<String>> {
        if outline.is_empty() {
            return Ok(None);
        }

        let serialized_outline = outline
            .iter()
            .enumerate()
            .map(|(i, line)| format!("{}\\. {}", i + 1, line))
            .collect::<Vec<String>>()
            .join("\n");

        // ✅ CORRECTION: Prompt amélioré pour forcer un JSON pur sans markdown
        let prompt = format!(
            "Tu es l'assistant IA officiel de Yukpo. Génére des sous-titres professionnels en langue {lang} pour la vidéo d'un produit nommé \"{product_name}\".

IMPORTANT: Réponds UNIQUEMENT avec un JSON valide, SANS markdown, SANS code blocks, SANS texte avant ou après.

Durée approximative: {duration} secondes.
Format JSON attendu: {{\"subtitles\":[{{\"start\":\"00:00:00,000\",\"end\":\"00:00:04,500\",\"text\":\"...\"}}, ...]}}
Les timestamps doivent être au format HH:MM:SS,mmm (virgule comme séparateur millisecondes).

Voici l'outline chronologique des scènes:
{outline}

Réponds SEULEMENT le JSON, rien d'autre.",
            lang = lang,
            product_name = product_name,
            duration = duration_seconds,
            outline = serialized_outline
        );

        // ✅ CORRECTION: Gestion d'erreur robuste avec logging détaillé
        let response = match self.predict(&prompt).await {
            Ok((model_name, response, tokens)) => {
                log::info!(
                    "[AppIA::generate_subtitles_srt] ✅ Prédiction réussie avec {} ({} tokens)",
                    model_name,
                    tokens
                );
                response
            }
            Err(err) => {
                log::error!(
                    "[AppIA::generate_subtitles_srt] ❌ Échec prédiction IA: {} - Product: {}",
                    err,
                    product_name
                );
                return Err(err);
            }
        };

        // ✅ CORRECTION: Tentative d'extraction JSON avec nettoyage amélioré
        let json_block = match extract_json_block(&response) {
            Some(block) => {
                log::debug!(
                    "[AppIA::generate_subtitles_srt] ✅ JSON extrait ({} chars)",
                    block.len()
                );
                block
            }
            None => {
                // ✅ CORRECTION: Tentative de nettoyage supplémentaire avant d'échouer
                let cleaned = response.trim();
                // Essayer de parser directement si la réponse entière est du JSON
                if cleaned.starts_with('{') || cleaned.starts_with('[') {
                    if serde_json::from_str::<Value>(cleaned).is_ok() {
                        log::debug!(
                            "[AppIA::generate_subtitles_srt] ✅ JSON trouvé après nettoyage ({} chars)",
                            cleaned.len()
                        );
                        cleaned.to_string()
                    } else {
                        log::error!(
                    "[AppIA::generate_subtitles_srt] ❌ JSON manquant dans réponse IA ({} chars): {}",
                    response.len(),
                    if response.len() > 200 { format!("{}...", &response[..200]) } else { response.clone() }
                );
                        return Err(AppError::Internal(format!(
                            "Réponse IA sous-titres invalide (JSON manquant). Réponse reçue: {}",
                            if response.len() > 200 {
                                format!("{}...", &response[..200])
                            } else {
                                response
                            }
                        )));
                    }
                } else {
                    log::error!(
                        "[AppIA::generate_subtitles_srt] ❌ JSON manquant dans réponse IA ({} chars): {}",
                        response.len(),
                        if response.len() > 200 { format!("{}...", &response[..200]) } else { response.clone() }
                    );
                    return Err(AppError::Internal(format!(
                        "Réponse IA sous-titres invalide (JSON manquant). Réponse reçue: {}",
                        if response.len() > 200 {
                            format!("{}...", &response[..200])
                        } else {
                            response
                        }
                    )));
                }
            }
        };

        // ✅ CORRECTION: Utiliser explicitement &json_block pour le parsing
        let parsed: Value = match serde_json::from_str(&json_block) {
            Ok(value) => value,
            Err(err) => {
                log::error!(
                    "[AppIA::generate_subtitles_srt] ❌ JSON malformé: {} - JSON: {}",
                    err,
                    if json_block.len() > 500 {
                        format!("{}...", &json_block[..500])
                    } else {
                        json_block.clone()
                    }
                );
                return Err(AppError::Internal(format!(
                    "JSON sous-titres IA illisible: {}. JSON reçu: {}",
                    err,
                    if json_block.len() > 500 {
                        format!("{}...", &json_block[..500])
                    } else {
                        json_block
                    }
                )));
            }
        };

        let subtitles = parsed.get("subtitles").and_then(Value::as_array).ok_or_else(|| {
            AppError::Internal("JSON sous-titres IA sans champ 'subtitles'".to_string())
        })?;

        if subtitles.is_empty() {
            return Ok(None);
        }

        let mut srt = String::new();
        for (idx, entry) in subtitles.iter().enumerate() {
            let text = entry.get("text").and_then(Value::as_str).unwrap_or_default().trim();
            if text.is_empty() {
                continue;
            }

            let start_seconds = parse_time_value(
                entry.get("start"),
                idx,
                subtitles.len(),
                duration_seconds as f32,
            )?;
            let end_seconds = parse_time_value(
                entry.get("end"),
                idx + 1,
                subtitles.len(),
                duration_seconds as f32,
            )?;

            srt.push_str(&format!(
                "{}\n{} --> {}\n{}\n\n",
                idx + 1,
                format_timestamp(start_seconds),
                format_timestamp(end_seconds),
                text
            ));
        }

        if srt.trim().is_empty() {
            return Ok(None);
        }

        Ok(Some(srt))
    }

    /// Génère une voix-off (base64 mp3) via l'orchestrateur IA
    pub async fn generate_tts_audio(
        &self,
        script: &str,
        lang: &str,
    ) -> AppResult<Option<(Vec<u8>, String)>> {
        if script.trim().is_empty() {
            return Ok(None);
        }

        // ✅ CORRECTION: Prompt amélioré pour forcer un JSON pur sans markdown
        let prompt = format!(
            "Tu es le moteur TTS neural officiel de Yukpo.

IMPORTANT: Réponds UNIQUEMENT avec un JSON valide, SANS markdown, SANS code blocks, SANS texte avant ou après.

Format JSON attendu: {{\"audio_base64\":\"...\",\"format\":\"mp3\"}}
- audio_base64: audio encodé en base64 (mp3 48kHz, voix naturelle)
- format: \"mp3\"

Langue: {lang}
Texte à vocaliser: {script}

Réponds SEULEMENT le JSON, rien d'autre.",
            lang = lang,
            script = script
        );

        let (_, response, _) = self.predict(&prompt).await?;
        let json_block = match extract_json_block(&response) {
            Some(block) => block,
            None => return Ok(None),
        };

        // ✅ CORRECTION: Utiliser explicitement &json_block pour le parsing
        let parsed: Value = serde_json::from_str(&json_block).map_err(|err| {
            log::error!(
                "[AppIA::generate_tts_audio] ❌ JSON malformé: {} - JSON: {}",
                err,
                if json_block.len() > 500 {
                    format!("{}...", &json_block[..500])
                } else {
                    json_block.clone()
                }
            );
            AppError::Internal(format!("JSON TTS IA invalide: {err} - {json_block}"))
        })?;

        let audio_b64 = parsed
            .get("audio_base64")
            .and_then(Value::as_str)
            .ok_or_else(|| AppError::Internal("Réponse TTS IA sans audio_base64".to_string()))?;

        let format = parsed.get("format").and_then(Value::as_str).unwrap_or("mp3").to_string();

        let decoded = STANDARD
            .decode(audio_b64.trim())
            .map_err(|err| AppError::Internal(format!("Audio IA base64 invalide: {err}")))?;

        Ok(Some((decoded, format)))
    }

    /// ?? V?rifie si un mod?le supporte le multimodal
    fn supports_multimodal(&self, model: &ModelConfig) -> bool {
        match model.name.as_str() {
            "openai-gpt4o" | "openai-gpt4o-mini" => true,
            "gemini-pro" => true,
            "claude-3-5-sonnet" | "claude-3-sonnet" => true,
            _ => false,
        }
    }

    /// ?? Appel d'un mod?le sp?cifique avec gestion d'erreur avanc?e
    #[allow(dead_code)]
    async fn call_model(
        &self,
        model: &ModelConfig,
        prompt: &str,
        _interaction_id: &str,
    ) -> AppResult<(String, String, u32)> {
        let start_time = SystemTime::now();

        for attempt in 0..model.retry_count {
            match self.call_model_implementation(model, prompt).await {
                Ok((response, tokens_used)) => {
                    let response_time =
                        SystemTime::now().duration_since(start_time).unwrap().as_millis() as f64;

                    // ✅ Log structuré avec contexte
                    log::info!(
                        "[AppIA] ✅ Modèle {} réussi en {}ms, {} tokens (tentative {}/{})",
                        model.name,
                        response_time,
                        tokens_used,
                        attempt + 1,
                        model.retry_count
                    );

                    return Ok((model.name.clone(), response, tokens_used));
                }
                Err(e) => {
                    // ✅ Gestion d'erreur avancée avec backoff exponentiel
                    let error_msg = format!("{}", e);
                    log::warn!(
                        "[AppIA] ⚠️ Modèle {} échec tentative {}/{}: {}",
                        model.name,
                        attempt + 1,
                        model.retry_count,
                        error_msg
                    );

                    if attempt < model.retry_count - 1 {
                        // ✅ Backoff exponentiel : 100ms, 200ms, 400ms, etc.
                        let backoff_ms = 100 * (1 << attempt.min(4)) as u64;
                        log::debug!("[AppIA] Retry dans {}ms (backoff exponentiel)", backoff_ms);
                        tokio::time::sleep(Duration::from_millis(backoff_ms)).await;
                    } else {
                        // ✅ Dernière tentative échouée - log d'erreur structuré
                        log::error!(
                            "[AppIA] ❌ Modèle {} a échoué après {} tentatives. Erreur finale: {}",
                            model.name,
                            model.retry_count,
                            error_msg
                        );
                    }
                }
            }
        }

        Err(format!(
            "Mod?le {} a ?chou? apr?s {} tentatives",
            model.name, model.retry_count
        )
        .into())
    }

    /// ??? Appel de mod?le multimodal optimis?
    async fn call_model_multimodal(
        &self,
        model: &ModelConfig,
        prompt: &str,
        images: Option<&Vec<String>>,
        _interaction_id: &str,
    ) -> AppResult<(String, String, u32)> {
        let start_time = SystemTime::now();

        for attempt in 0..2.min(model.retry_count) {
            match self.call_model_multimodal_implementation(model, prompt, images).await {
                Ok((response, tokens_used)) => {
                    let response_time =
                        SystemTime::now().duration_since(start_time).unwrap().as_millis() as f64;

                    log::info!(
                        "[AppIA] ? Mod?le multimodal {} r?ussi en {}ms, {} tokens (tentative {})",
                        model.name,
                        response_time,
                        tokens_used,
                        attempt + 1
                    );

                    return Ok((model.name.clone(), response, tokens_used));
                }
                Err(e) => {
                    log::warn!(
                        "[AppIA] Mod?le multimodal {} ?chec tentative {}: {}",
                        model.name,
                        attempt + 1,
                        e
                    );

                    if attempt < 1 {
                        tokio::time::sleep(Duration::from_millis(50 * (attempt + 1) as u64)).await;
                    }
                }
            }
        }

        Err(format!(
            "Mod?le multimodal {} a ?chou? apr?s {} tentatives",
            model.name,
            2.min(model.retry_count)
        )
        .into())
    }

    /// ?? Impl?mentation sp?cifique par fournisseur
    #[allow(dead_code)]
    async fn call_model_implementation(
        &self,
        model: &ModelConfig,
        prompt: &str,
    ) -> AppResult<(String, u32)> {
        match model.name.as_str() {
            "openai-gpt4o" | "openai-gpt4o-mini" | "openai-gpt35" => {
                self.call_openai(model, prompt).await
            }
            "gemini-pro" => self.call_gemini(model, prompt).await,
            "claude-3-5-sonnet" | "claude-3-sonnet" => self.call_anthropic(model, prompt).await,
            "mistral-large" => self.call_mistral(model, prompt).await,
            "deepseek-chat" => self.call_deepseek(model, prompt).await,
            "ollama-mistral" | "ollama-llama2" => self.call_ollama(model, prompt).await,
            "cohere-command" => self.call_cohere(model, prompt).await,
            _ => Err("Mod?le non support?".into()),
        }
    }

    /// ?? Impl?mentation multimodale sp?cifique par fournisseur
    async fn call_model_multimodal_implementation(
        &self,
        model: &ModelConfig,
        prompt: &str,
        images: Option<&Vec<String>>,
    ) -> AppResult<(String, u32)> {
        match model.name.as_str() {
            "openai-gpt4o" | "openai-gpt4o-mini" => {
                self.call_openai_multimodal(model, prompt, images).await
            }
            "gemini-pro" => self.call_gemini_multimodal(model, prompt, images).await,
            "claude-3-5-sonnet" | "claude-3-sonnet" => {
                self.call_anthropic_multimodal(model, prompt, images).await
            }
            _ => Err("Mod?le multimodal non support?".into()),
        }
    }

    /// ?? Appel OpenAI avec configuration avanc?e
    #[allow(dead_code)]
    async fn call_openai(&self, model: &ModelConfig, prompt: &str) -> AppResult<(String, u32)> {
        let url = format!("{}/chat/completions", model.base_url);

        let payload = json!({
            "model": model.model,
            "messages": [
                {
                    "role": "system",
                    "content": "Tu es un assistant IA sp?cialis? pour la plateforme Yukpo. Tu analyses les demandes utilisateur et g?n?res des r?ponses JSON structur?es selon les instructions fournies."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "temperature": model.temperature,
            "max_tokens": model.max_tokens,
            "top_p": model.top_p,
            "frequency_penalty": model.frequency_penalty,
            "presence_penalty": model.presence_penalty,
            "stream": false
        });

        let auth = openai_auth_header_value(&model.api_key)
            .map_err(|e| format!("OpenAI API error: {}", e))?;
        let url_c = url.clone();
        let payload_c = payload.clone();
        let model_timeout = model.timeout;
        let label = format!("AppIA-call_openai-{}", model.name);
        let response = app_ia_resilient_request(&label, || {
            self.http
                .post(&url_c)
                .header("Authorization", auth.clone())
                .header("Content-Type", "application/json")
                .json(&payload_c)
                .timeout(Duration::from_secs(model_timeout))
        })
        .await
        .map_err(|e| format!("OpenAI API error: {}", e))?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();

            // ✅ Détection spécifique des erreurs de limite de tokens
            if error_text.contains("context_length_exceeded")
                || error_text.contains("maximum context length")
            {
                log::error!(
                    "[AppIA] ❌ Limite de tokens dépassée pour le modèle {}. Erreur: {}",
                    model.name,
                    error_text
                );
                return Err(format!(
                    "Le prompt est trop long pour le modèle {} (limite de tokens dépassée). Veuillez réduire la taille de votre demande.",
                    model.name
                ).into());
            }

            // ✅ Détection des erreurs de rate limit
            if error_text.contains("rate_limit_exceeded") || error_text.contains("TPM") {
                log::error!(
                    "[AppIA] ❌ Rate limit dépassé pour le modèle {}. Erreur: {}",
                    model.name,
                    error_text
                );
                return Err(format!(
                    "Limite de requêtes par minute dépassée pour le modèle {}. Veuillez réessayer dans quelques instants.",
                    model.name
                ).into());
            }

            return Err(format!("OpenAI API error: {}", error_text).into());
        }

        let body: Value =
            response.json().await.map_err(|e| format!("OpenAI JSON parse error: {}", e))?;

        // ✅ CORRECTION: Vérification robuste de la structure de réponse
        let content = body
            .get("choices")
            .and_then(|choices| choices.as_array())
            .and_then(|choices_array| choices_array.first())
            .and_then(|choice| choice.get("message"))
            .and_then(|message| message.get("content"))
            .and_then(|content_val| content_val.as_str())
            .ok_or_else(|| {
                let error_msg = format!(
                    "OpenAI response missing content. Response structure: {}",
                    serde_json::to_string(&body)
                        .unwrap_or_else(|_| "Unable to serialize".to_string())
                );
                log::error!("[OpenAI] {}", error_msg);
                error_msg
            })?;

        // Extraire les tokens r?ellement consomm?s depuis la r?ponse OpenAI
        let tokens_used = if let Some(usage) = body.get("usage") {
            let prompt_tokens = usage.get("prompt_tokens").and_then(|v| v.as_u64()).unwrap_or(0);
            let completion_tokens =
                usage.get("completion_tokens").and_then(|v| v.as_u64()).unwrap_or(0);
            let total_tokens = usage
                .get("total_tokens")
                .and_then(|v| v.as_u64())
                .unwrap_or(prompt_tokens + completion_tokens);

            log::info!(
                "[OpenAI] Tokens utilis?s: prompt={}, completion={}, total={}",
                prompt_tokens,
                completion_tokens,
                total_tokens
            );

            total_tokens as u32
        } else {
            // Estimation basique si pas d'info de usage
            let estimated = (prompt.len() / 4).max(10) + (content.len() / 4).max(5);
            log::warn!(
                "[OpenAI] Pas d'info usage, estimation: {} tokens",
                estimated
            );
            estimated as u32
        };

        Ok((content.to_string(), tokens_used))
    }

    /// ??? Appel Mistral AI
    #[allow(dead_code)]
    async fn call_mistral(&self, model: &ModelConfig, prompt: &str) -> AppResult<(String, u32)> {
        let url = format!("{}/chat/completions", model.base_url);

        let payload = json!({
            "model": model.model,
            "messages": [
                {
                    "role": "system",
                    "content": "Tu es un assistant IA sp?cialis? pour la plateforme Yukpo. Tu analyses les demandes utilisateur et g?n?res des r?ponses JSON structur?es selon les instructions fournies."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "temperature": model.temperature,
            "max_tokens": model.max_tokens,
            "top_p": model.top_p,
            "stream": false
        });

        let url_c = url.clone();
        let payload_c = payload.clone();
        let api_key = model.api_key.clone();
        let model_timeout = model.timeout;
        let label = format!("AppIA-call_mistral-{}", model.name);
        let response = app_ia_resilient_request(&label, || {
            self.http
                .post(&url_c)
                .header("Authorization", format!("Bearer {}", api_key))
                .header("Content-Type", "application/json")
                .json(&payload_c)
                .timeout(Duration::from_secs(model_timeout))
        })
        .await
        .map_err(|e| format!("Mistral API error: {}", e))?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("Mistral API error: {}", error_text).into());
        }

        let body: Value =
            response.json().await.map_err(|e| format!("Mistral JSON parse error: {}", e))?;

        // ✅ CORRECTION: Vérification robuste de la structure de réponse
        let content = body
            .get("choices")
            .and_then(|choices| choices.as_array())
            .and_then(|choices_array| choices_array.first())
            .and_then(|choice| choice.get("message"))
            .and_then(|message| message.get("content"))
            .and_then(|content_val| content_val.as_str())
            .ok_or_else(|| {
                let error_msg = format!(
                    "Mistral response missing content. Response structure: {}",
                    serde_json::to_string(&body)
                        .unwrap_or_else(|_| "Unable to serialize".to_string())
                );
                log::error!("[Mistral] {}", error_msg);
                error_msg
            })?;

        // Extraire les tokens pour Mistral (m?me format qu'OpenAI)
        let tokens_used = if let Some(usage) = body.get("usage") {
            let total_tokens = usage.get("total_tokens").and_then(|v| v.as_u64()).unwrap_or(0);
            log::info!("[Mistral] Tokens utilis?s: {}", total_tokens);
            total_tokens as u32
        } else {
            let estimated = (prompt.len() / 4).max(10) + (content.len() / 4).max(5);
            log::warn!(
                "[Mistral] Pas d'info usage, estimation: {} tokens",
                estimated
            );
            estimated as u32
        };

        Ok((content.to_string(), tokens_used))
    }

    /// 🔁 Appel DeepSeek (API compatible OpenAI)
    #[allow(dead_code)]
    async fn call_deepseek(&self, model: &ModelConfig, prompt: &str) -> AppResult<(String, u32)> {
        let base = model.base_url.trim_end_matches('/');
        let url = format!("{}/chat/completions", base);

        let payload = json!({
            "model": model.model,
            "messages": [
                {
                    "role": "system",
                    "content": "Tu es l'assistant DeepSeek optimisé pour Yukpo. Tu produis des réponses JSON strictement structurées selon les directives internes."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "temperature": model.temperature,
            "max_tokens": model.max_tokens,
            "top_p": model.top_p,
            "frequency_penalty": model.frequency_penalty,
            "presence_penalty": model.presence_penalty,
            "stream": false
        });

        let url_c = url.clone();
        let payload_c = payload.clone();
        let api_key = model.api_key.clone();
        let model_timeout = model.timeout;
        let label = format!("AppIA-call_deepseek-{}", model.name);
        let response = app_ia_resilient_request(&label, || {
            self.http
                .post(&url_c)
                .header("Authorization", format!("Bearer {}", api_key))
                .header("Content-Type", "application/json")
                .json(&payload_c)
                .timeout(Duration::from_secs(model_timeout))
        })
        .await
        .map_err(|e| format!("DeepSeek API error: {}", e))?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("DeepSeek API error: {}", error_text).into());
        }

        let body: Value =
            response.json().await.map_err(|e| format!("DeepSeek JSON parse error: {}", e))?;

        // ✅ CORRECTION: Vérification robuste de la structure de réponse
        let content = body
            .get("choices")
            .and_then(|choices| choices.as_array())
            .and_then(|choices_array| choices_array.first())
            .and_then(|choice| choice.get("message"))
            .and_then(|message| message.get("content"))
            .and_then(|content_val| content_val.as_str())
            .ok_or_else(|| {
                let error_msg = format!(
                    "DeepSeek response missing content. Response structure: {}",
                    serde_json::to_string(&body)
                        .unwrap_or_else(|_| "Unable to serialize".to_string())
                );
                log::error!("[DeepSeek] {}", error_msg);
                error_msg
            })?;

        let tokens_used = if let Some(usage) = body.get("usage") {
            let prompt_tokens = usage.get("prompt_tokens").and_then(|v| v.as_u64()).unwrap_or(0);
            let completion_tokens =
                usage.get("completion_tokens").and_then(|v| v.as_u64()).unwrap_or(0);
            let total_tokens = usage
                .get("total_tokens")
                .and_then(|v| v.as_u64())
                .unwrap_or(prompt_tokens + completion_tokens);

            log::info!(
                "[DeepSeek] Tokens utilisés: prompt={}, completion={}, total={}",
                prompt_tokens,
                completion_tokens,
                total_tokens
            );

            total_tokens as u32
        } else {
            let estimated = (prompt.len() / 4).max(10) + (content.len() / 4).max(5);
            log::warn!(
                "[DeepSeek] Pas d'info usage, estimation: {} tokens",
                estimated
            );
            estimated as u32
        };

        Ok((content.to_string(), tokens_used))
    }

    /// ?? Appel Google Gemini Pro
    #[allow(dead_code)]
    async fn call_gemini(&self, model: &ModelConfig, prompt: &str) -> AppResult<(String, u32)> {
        let url = format!(
            "{}/models/{}:generateContent?key={}",
            model.base_url, model.model, model.api_key
        );

        let request_body = json!({
            "contents": [{
                "parts": [{
                    "text": prompt
                }]
            }],
            "generationConfig": {
                "temperature": model.temperature,
                "topP": model.top_p,
                "topK": 40,
                "maxOutputTokens": model.max_tokens,
                "stopSequences": ["\n\n", "Human:", "Assistant:"]
            },
            "safetySettings": [
                {
                    "category": "HARM_CATEGORY_HARASSMENT",
                    "threshold": "BLOCK_MEDIUM_AND_ABOVE"
                },
                {
                    "category": "HARM_CATEGORY_HATE_SPEECH",
                    "threshold": "BLOCK_MEDIUM_AND_ABOVE"
                },
                {
                    "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                    "threshold": "BLOCK_MEDIUM_AND_ABOVE"
                },
                {
                    "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
                    "threshold": "BLOCK_MEDIUM_AND_ABOVE"
                }
            ]
        });

        let url_c = url.clone();
        let request_body_c = request_body.clone();
        let model_timeout = model.timeout;
        let label = format!("AppIA-call_gemini-{}", model.name);
        let response = app_ia_resilient_request(&label, || {
            self.http
                .post(&url_c)
                .header("Content-Type", "application/json")
                .json(&request_body_c)
                .timeout(Duration::from_secs(model_timeout))
        })
        .await
        .map_err(|e| format!("Gemini API error: {}", e))?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("Gemini API error: {}", error_text).into());
        }

        let body: Value =
            response.json().await.map_err(|e| format!("Gemini JSON parse error: {}", e))?;

        // ✅ CORRECTION: Vérification robuste de la structure de réponse Gemini
        let content = body
            .get("candidates")
            .and_then(|candidates| candidates.as_array())
            .and_then(|candidates_array| candidates_array.first())
            .and_then(|candidate| candidate.get("content"))
            .and_then(|content_obj| content_obj.get("parts"))
            .and_then(|parts| parts.as_array())
            .and_then(|parts_array| parts_array.first())
            .and_then(|part| part.get("text"))
            .and_then(|text_val| text_val.as_str())
            .ok_or_else(|| {
                let error_msg = format!(
                    "Gemini response missing content. Response structure: {}",
                    serde_json::to_string(&body)
                        .unwrap_or_else(|_| "Unable to serialize".to_string())
                );
                log::error!("[Gemini] {}", error_msg);
                error_msg
            })?;

        // Extraire les tokens pour Gemini
        let tokens_used = if let Some(usage) = body.get("usageMetadata") {
            let prompt_tokens = usage.get("promptTokenCount").and_then(|v| v.as_u64()).unwrap_or(0);
            let candidate_tokens =
                usage.get("candidatesTokenCount").and_then(|v| v.as_u64()).unwrap_or(0);
            let total_tokens = usage
                .get("totalTokenCount")
                .and_then(|v| v.as_u64())
                .unwrap_or(prompt_tokens + candidate_tokens);

            log::info!(
                "[Gemini] Tokens utilis?s: prompt={}, candidates={}, total={}",
                prompt_tokens,
                candidate_tokens,
                total_tokens
            );

            total_tokens as u32
        } else {
            let estimated = (prompt.len() / 4).max(10) + (content.len() / 4).max(5);
            log::warn!(
                "[Gemini] Pas d'info usage, estimation: {} tokens",
                estimated
            );
            estimated as u32
        };

        Ok((content.to_string(), tokens_used))
    }

    /// ?? Appel Ollama local
    #[allow(dead_code)]
    async fn call_ollama(&self, model: &ModelConfig, prompt: &str) -> AppResult<(String, u32)> {
        let url = format!("{}/api/generate", model.base_url);

        let payload = json!({
            "model": model.model,
            "prompt": prompt,
            "stream": false,
            "options": {
                "temperature": model.temperature,
                "top_p": model.top_p,
                "num_predict": model.max_tokens
            }
        });

        let url_c = url.clone();
        let payload_c = payload.clone();
        let model_timeout = model.timeout;
        let label = format!("AppIA-call_ollama-{}", model.name);
        let response = app_ia_resilient_request(&label, || {
            self.http
                .post(&url_c)
                .header("Content-Type", "application/json")
                .json(&payload_c)
                .timeout(Duration::from_secs(model_timeout))
        })
        .await
        .map_err(|e| format!("Ollama API error: {}", e))?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("Ollama API error: {}", error_text).into());
        }

        let body: Value =
            response.json().await.map_err(|e| format!("Ollama JSON parse error: {}", e))?;

        let content = body["response"].as_str().ok_or("Ollama response missing content")?;

        // Estimation pour Ollama (pas d'info tokens native)
        let tokens_used = (prompt.len() / 4).max(10) + (content.len() / 4).max(5);
        log::info!("[Ollama] Estimation tokens: {}", tokens_used);

        Ok((content.to_string(), tokens_used as u32))
    }

    /// ?? Appel Anthropic Claude
    #[allow(dead_code)]
    async fn call_anthropic(&self, model: &ModelConfig, prompt: &str) -> AppResult<(String, u32)> {
        let url = format!("{}/messages", model.base_url);

        let payload = json!({
            "model": model.model,
            "max_tokens": model.max_tokens,
            "temperature": model.temperature,
            "top_p": model.top_p,
            "messages": [
                {
                    "role": "user",
                    "content": prompt
                }
            ]
        });

        let url_c = url.clone();
        let payload_c = payload.clone();
        let api_key = model.api_key.clone();
        let model_timeout = model.timeout;
        let label = format!("AppIA-call_anthropic-{}", model.name);
        let response = app_ia_resilient_request(&label, || {
            self.http
                .post(&url_c)
                .header("Authorization", format!("Bearer {}", api_key))
                .header("Content-Type", "application/json")
                .header("anthropic-version", "2023-06-01")
                .json(&payload_c)
                .timeout(Duration::from_secs(model_timeout))
        })
        .await
        .map_err(|e| format!("Anthropic API error: {}", e))?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("Anthropic API error: {}", error_text).into());
        }

        let body: Value = response
            .json()
            .await
            .map_err(|e| format!("Anthropic JSON parse error: {}", e))?;

        // ✅ CORRECTION: Vérification robuste de la structure de réponse Anthropic
        let content = body
            .get("content")
            .and_then(|content_array| content_array.as_array())
            .and_then(|content_array| content_array.first())
            .and_then(|content_item| content_item.get("text"))
            .and_then(|text_val| text_val.as_str())
            .ok_or_else(|| {
                let error_msg = format!(
                    "Anthropic response missing content. Response structure: {}",
                    serde_json::to_string(&body)
                        .unwrap_or_else(|_| "Unable to serialize".to_string())
                );
                log::error!("[Anthropic] {}", error_msg);
                error_msg
            })?;

        // Extraire les tokens pour Anthropic
        let tokens_used = if let Some(usage) = body.get("usage") {
            let input_tokens = usage.get("input_tokens").and_then(|v| v.as_u64()).unwrap_or(0);
            let output_tokens = usage.get("output_tokens").and_then(|v| v.as_u64()).unwrap_or(0);
            let total_tokens = input_tokens + output_tokens;

            log::info!(
                "[Anthropic] Tokens utilis?s: input={}, output={}, total={}",
                input_tokens,
                output_tokens,
                total_tokens
            );

            total_tokens as u32
        } else {
            let estimated = (prompt.len() / 4).max(10) + (content.len() / 4).max(5);
            log::warn!(
                "[Anthropic] Pas d'info usage, estimation: {} tokens",
                estimated
            );
            estimated as u32
        };

        Ok((content.to_string(), tokens_used))
    }

    /// ?? Appel Cohere
    #[allow(dead_code)]
    async fn call_cohere(&self, model: &ModelConfig, prompt: &str) -> AppResult<(String, u32)> {
        let url = format!("{}/generate", model.base_url);

        let payload = json!({
            "model": model.model,
            "prompt": prompt,
            "max_tokens": model.max_tokens,
            "temperature": model.temperature,
            "p": model.top_p,
            "stream": false
        });

        let url_c = url.clone();
        let payload_c = payload.clone();
        let api_key = model.api_key.clone();
        let model_timeout = model.timeout;
        let label = format!("AppIA-call_cohere-{}", model.name);
        let response = app_ia_resilient_request(&label, || {
            self.http
                .post(&url_c)
                .header("Authorization", format!("Bearer {}", api_key))
                .header("Content-Type", "application/json")
                .json(&payload_c)
                .timeout(Duration::from_secs(model_timeout))
        })
        .await
        .map_err(|e| format!("Cohere API error: {}", e))?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("Cohere API error: {}", error_text).into());
        }

        let body: Value =
            response.json().await.map_err(|e| format!("Cohere JSON parse error: {}", e))?;

        let content = body["generations"][0]["text"]
            .as_str()
            .ok_or("Cohere response missing content")?;

        // Extraire les tokens pour Cohere
        let tokens_used = if let Some(meta) = body.get("meta") {
            if let Some(billed_units) = meta.get("billed_units") {
                let input_tokens =
                    billed_units.get("input_tokens").and_then(|v| v.as_u64()).unwrap_or(0);
                let output_tokens =
                    billed_units.get("output_tokens").and_then(|v| v.as_u64()).unwrap_or(0);
                let total_tokens = input_tokens + output_tokens;

                log::info!(
                    "[Cohere] Tokens utilis?s: input={}, output={}, total={}",
                    input_tokens,
                    output_tokens,
                    total_tokens
                );

                total_tokens as u32
            } else {
                let estimated = (prompt.len() / 4).max(10) + (content.len() / 4).max(5);
                log::warn!(
                    "[Cohere] Pas d'info billed_units, estimation: {} tokens",
                    estimated
                );
                estimated as u32
            }
        } else {
            let estimated = (prompt.len() / 4).max(10) + (content.len() / 4).max(5);
            log::warn!("[Cohere] Pas d'info meta, estimation: {} tokens", estimated);
            estimated as u32
        };

        Ok((content.to_string(), tokens_used))
    }

    /// ??? Appel OpenAI multimodal avec configuration avanc?e
    #[allow(dead_code)]
    async fn call_openai_multimodal(
        &self,
        model: &ModelConfig,
        prompt: &str,
        images: Option<&Vec<String>>,
    ) -> AppResult<(String, u32)> {
        let url = format!("{}/chat/completions", model.base_url);

        let mut content_parts: Vec<serde_json::Value> = vec![json!({
            "type": "text",
            "text": prompt
        })];

        // Ajouter les images si pr?sentes
        if let Some(image_data) = images {
            for (i, image_base64) in image_data.iter().enumerate() {
                let clean = Self::multimodal_image_base64_clean(image_base64);
                content_parts.push(json!({
                    "type": "image_url",
                    "image_url": {
                        "url": format!("data:image/jpeg;base64,{}", clean),
                        "detail": "high"
                    }
                }));
                log::info!(
                    "[OpenAI Multimodal] Image {} ajout?e (taille base64: {} chars)",
                    i + 1,
                    clean.len()
                );
            }
        }

        let payload = json!({
            "model": model.model,
            "messages": [
                {
                    "role": "system",
                    "content": "Tu es un assistant IA sp?cialis? pour la plateforme Yukpo. Tu analyses les demandes utilisateur et g?n?res des r?ponses JSON structur?es selon les instructions fournies. Tu peux analyser les images pour extraire des informations pertinentes."
                },
                {
                    "role": "user",
                    "content": content_parts
                }
            ],
            "temperature": model.temperature,
            "max_tokens": model.max_tokens,
            "top_p": model.top_p,
            "frequency_penalty": model.frequency_penalty,
            "presence_penalty": model.presence_penalty,
            "stream": false
        });

        let auth = openai_auth_header_value(&model.api_key)
            .map_err(|e| format!("OpenAI multimodal API error: {}", e))?;
        let response = self
            .http
            .post(&url)
            .header("Authorization", auth)
            .header("Content-Type", "application/json")
            .json(&payload)
            .timeout(Duration::from_secs(model.timeout))
            .send()
            .await
            .map_err(|e| format!("OpenAI multimodal API error: {}", e))?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("OpenAI multimodal API error: {}", error_text).into());
        }

        let body: Value = response
            .json()
            .await
            .map_err(|e| format!("OpenAI multimodal JSON parse error: {}", e))?;

        // ✅ CORRECTION: Vérification robuste de la structure de réponse
        let content = body
            .get("choices")
            .and_then(|choices| choices.as_array())
            .and_then(|choices_array| choices_array.first())
            .and_then(|choice| choice.get("message"))
            .and_then(|message| message.get("content"))
            .and_then(|content_val| content_val.as_str())
            .ok_or_else(|| {
                let error_msg = format!(
                    "OpenAI multimodal response missing content. Response structure: {}",
                    serde_json::to_string(&body)
                        .unwrap_or_else(|_| "Unable to serialize".to_string())
                );
                log::error!("[OpenAI Multimodal] {}", error_msg);
                error_msg
            })?;

        // Extraire les tokens r?ellement consomm?s depuis la r?ponse OpenAI
        let tokens_used = if let Some(usage) = body.get("usage") {
            let prompt_tokens = usage.get("prompt_tokens").and_then(|v| v.as_u64()).unwrap_or(0);
            let completion_tokens =
                usage.get("completion_tokens").and_then(|v| v.as_u64()).unwrap_or(0);
            let total_tokens = usage
                .get("total_tokens")
                .and_then(|v| v.as_u64())
                .unwrap_or(prompt_tokens + completion_tokens);

            log::info!(
                "[OpenAI Multimodal] Tokens utilis?s: prompt={}, completion={}, total={}",
                prompt_tokens,
                completion_tokens,
                total_tokens
            );

            total_tokens as u32
        } else {
            // Estimation basique si pas d'info de usage
            let estimated = (prompt.len() / 4).max(10) + (content.len() / 4).max(5);
            log::warn!(
                "[OpenAI Multimodal] Pas d'info usage, estimation: {} tokens",
                estimated
            );
            estimated as u32
        };

        Ok((content.to_string(), tokens_used))
    }

    /// ✅ NOUVEAU 2026-03-22: Chat completion avec tableau de messages complet (multi-provider)
    /// Utilisé par YukpoIA chat pour envoyer historique + system prompt + contenu multimodal
    /// Retourne (model_name, response_text, completion_tokens, total_tokens)
    pub async fn chat_completion_with_messages(
        &self,
        messages: &[Value],
        has_vision: bool,
        max_tokens: u32,
        temperature: f32,
    ) -> AppResult<(String, String, u64, u64)> {
        let models = self.models.read().await;
        let mut candidates: Vec<&ModelConfig> = if has_vision {
            models.iter().filter(|m| m.enabled && self.supports_multimodal(m)).collect()
        } else {
            models.iter().filter(|m| m.enabled).collect()
        };
        candidates.sort_by(|a, b| b.priority.cmp(&a.priority));

        if candidates.is_empty() && has_vision {
            candidates = models.iter().filter(|m| m.enabled).collect();
            candidates.sort_by(|a, b| b.priority.cmp(&a.priority));
        }

        if candidates.is_empty() {
            return Err("Aucun modèle IA disponible".into());
        }

        let model_names: Vec<&str> = candidates.iter().map(|m| m.name.as_str()).collect();
        log::info!(
            "[AppIA::chat_completion] {} modèle(s) candidat(s) (vision={}): {:?}",
            candidates.len(),
            has_vision,
            model_names
        );

        use crate::config::ai_timeouts::{AIRequestType, AITimeoutConfig};
        let timeout_dur = if has_vision {
            AITimeoutConfig::get_multimodal_timeout()
        } else {
            AITimeoutConfig::get_timeout(AIRequestType::Standard)
        };

        let mut last_error: Option<String> = None;
        for model in &candidates {
            log::info!(
                "[AppIA::chat_completion] Tentative avec {} (timeout {}s)",
                model.name,
                timeout_dur.as_secs()
            );

            let result = tokio::time::timeout(
                timeout_dur,
                self.chat_completion_for_provider(model, messages, max_tokens, temperature),
            )
            .await;

            match result {
                Ok(Ok((content, comp_tokens, total_tokens))) => {
                    log::info!(
                        "[AppIA::chat_completion] ✅ {} réussi ({} tokens)",
                        model.name,
                        total_tokens
                    );
                    return Ok((model.name.clone(), content, comp_tokens, total_tokens));
                }
                Ok(Err(e)) => {
                    log::warn!("[AppIA::chat_completion] ⚠️ {} échoué: {}", model.name, e);
                    last_error = Some(format!("{}", e));
                }
                Err(_) => {
                    log::warn!(
                        "[AppIA::chat_completion] ⏱️ {} timeout ({}s)",
                        model.name,
                        timeout_dur.as_secs()
                    );
                    last_error = Some("Timeout".into());
                }
            }
        }

        Err(format!(
            "Tous les modèles ont échoué. Dernière erreur: {}",
            last_error.unwrap_or_default()
        )
        .into())
    }

    /// Dispatch chat completion vers le bon fournisseur
    async fn chat_completion_for_provider(
        &self,
        model: &ModelConfig,
        messages: &[Value],
        max_tokens: u32,
        temperature: f32,
    ) -> AppResult<(String, u64, u64)> {
        match model.name.as_str() {
            // OpenAI-compatible: OpenAI, Mistral, DeepSeek, Ollama
            "openai-gpt4o" | "openai-gpt4o-mini" | "openai-gpt35" | "mistral-large"
            | "deepseek-chat" | "ollama-mistral" | "ollama-llama2" => {
                self.chat_completion_openai_compat(model, messages, max_tokens, temperature)
                    .await
            }
            // Anthropic Claude
            "claude-3-5-sonnet" | "claude-3-sonnet" => {
                self.chat_completion_anthropic(model, messages, max_tokens, temperature).await
            }
            // Gemini
            "gemini-pro" => {
                self.chat_completion_gemini(model, messages, max_tokens, temperature).await
            }
            // Cohere (fallback to OpenAI compat format)
            "cohere-command" => {
                self.chat_completion_openai_compat(model, messages, max_tokens, temperature)
                    .await
            }
            _ => Err(format!("Fournisseur non supporté: {}", model.name).into()),
        }
    }

    /// Chat completion pour fournisseurs compatibles OpenAI (OpenAI, Mistral, DeepSeek, Ollama)
    async fn chat_completion_openai_compat(
        &self,
        model: &ModelConfig,
        messages: &[Value],
        max_tokens: u32,
        temperature: f32,
    ) -> AppResult<(String, u64, u64)> {
        use crate::services::yukpo_openai_outbound::{
            acquire_concurrency_permit, http_client, send_request_with_retry,
        };

        let url = format!("{}/chat/completions", model.base_url);
        let payload = json!({
            "model": model.model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "stream": false
        });

        let auth_header: Option<reqwest::header::HeaderValue> = if !model.api_key.is_empty() {
            Some(
                openai_auth_header_value(&model.api_key)
                    .map_err(|e| format!("Auth error {}: {}", model.name, e))?,
            )
        } else {
            None
        };

        let model_timeout = model.timeout;
        let url_c = url.clone();
        let payload_c = payload.clone();
        let label = format!("AppIA-{}", model.name);

        let _slot = acquire_concurrency_permit().await;
        let client = http_client();

        let response = send_request_with_retry(&label, || {
            let mut req = client
                .post(&url_c)
                .header("Content-Type", "application/json")
                .json(&payload_c)
                .timeout(Duration::from_secs(model_timeout));
            if let Some(ref auth) = auth_header {
                req = req.header("Authorization", auth.clone());
            }
            req
        })
        .await
        .map_err(|e| format!("{} network error: {}", model.name, e))?;

        if !response.status().is_success() {
            let err = response.text().await.unwrap_or_default();
            return Err(format!("{} API error: {}", model.name, err).into());
        }

        let body: Value =
            response.json().await.map_err(|e| format!("{} JSON error: {}", model.name, e))?;

        let content = body["choices"][0]["message"]["content"]
            .as_str()
            .ok_or_else(|| format!("{}: missing content in response", model.name))?;

        let comp = body["usage"]["completion_tokens"].as_u64().unwrap_or(0);
        let total = body["usage"]["total_tokens"].as_u64().unwrap_or(comp);
        Ok((content.to_string(), comp, total))
    }

    /// Chat completion pour Anthropic Claude (format messages différent)
    async fn chat_completion_anthropic(
        &self,
        model: &ModelConfig,
        messages: &[Value],
        max_tokens: u32,
        temperature: f32,
    ) -> AppResult<(String, u64, u64)> {
        let url = format!("{}/messages", model.base_url);

        // Extraire system prompt et convertir les messages
        let mut system_text = String::new();
        let mut claude_messages: Vec<Value> = Vec::new();
        for msg in messages {
            let role = msg["role"].as_str().unwrap_or("user");
            if role == "system" {
                if let Some(s) = msg["content"].as_str() {
                    system_text.push_str(s);
                    system_text.push('\n');
                }
            } else {
                claude_messages.push(json!({
                    "role": role,
                    "content": msg["content"].clone()
                }));
            }
        }

        let payload = json!({
            "model": model.model,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "system": system_text.trim(),
            "messages": claude_messages
        });

        use crate::services::yukpo_openai_outbound::{
            acquire_concurrency_permit, http_client, send_request_with_retry,
        };
        let url_c = url.clone();
        let payload_c = payload.clone();
        let api_key = model.api_key.clone();
        let model_timeout = model.timeout;
        let _slot = acquire_concurrency_permit().await;
        let client = http_client();

        let response = send_request_with_retry("AppIA-anthropic", || {
            client
                .post(&url_c)
                .header("x-api-key", &api_key)
                .header("anthropic-version", "2023-06-01")
                .header("Content-Type", "application/json")
                .json(&payload_c)
                .timeout(Duration::from_secs(model_timeout))
        })
        .await
        .map_err(|e| format!("Anthropic network error: {}", e))?;

        if !response.status().is_success() {
            let err = response.text().await.unwrap_or_default();
            return Err(format!("Anthropic API error: {}", err).into());
        }

        let body: Value =
            response.json().await.map_err(|e| format!("Anthropic JSON error: {}", e))?;

        let content = body["content"][0]["text"]
            .as_str()
            .ok_or_else(|| "Anthropic: missing content in response".to_string())?;

        let input_tokens = body["usage"]["input_tokens"].as_u64().unwrap_or(0);
        let output_tokens = body["usage"]["output_tokens"].as_u64().unwrap_or(0);
        Ok((
            content.to_string(),
            output_tokens,
            input_tokens + output_tokens,
        ))
    }

    /// Chat completion pour Google Gemini (format contents)
    async fn chat_completion_gemini(
        &self,
        model: &ModelConfig,
        messages: &[Value],
        max_tokens: u32,
        temperature: f32,
    ) -> AppResult<(String, u64, u64)> {
        let url = format!(
            "{}/models/{}:generateContent?key={}",
            model.base_url, model.model, model.api_key
        );

        // Convertir messages en format Gemini contents
        let mut system_instruction = String::new();
        let mut contents: Vec<Value> = Vec::new();
        for msg in messages {
            let role = msg["role"].as_str().unwrap_or("user");
            if role == "system" {
                if let Some(s) = msg["content"].as_str() {
                    system_instruction.push_str(s);
                    system_instruction.push('\n');
                }
                continue;
            }
            let gemini_role = if role == "assistant" { "model" } else { "user" };
            let parts = if let Some(text) = msg["content"].as_str() {
                vec![json!({"text": text})]
            } else if let Some(arr) = msg["content"].as_array() {
                arr.iter().filter_map(|p| {
                    if p["type"].as_str() == Some("text") {
                        Some(json!({"text": p["text"].as_str().unwrap_or("")}))
                    } else if p["type"].as_str() == Some("image_url") {
                        let url_str = p["image_url"]["url"].as_str().unwrap_or("");
                        if url_str.starts_with("data:") {
                            let b64 = url_str.split(',').nth(1).unwrap_or("");
                            Some(json!({"inline_data": {"mime_type": "image/jpeg", "data": b64}}))
                        } else {
                            None
                        }
                    } else { None }
                }).collect()
            } else {
                vec![json!({"text": ""})]
            };
            contents.push(json!({"role": gemini_role, "parts": parts}));
        }

        let mut request_body = json!({
            "contents": contents,
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": max_tokens
            }
        });
        if !system_instruction.is_empty() {
            request_body["systemInstruction"] =
                json!({"parts": [{"text": system_instruction.trim()}]});
        }

        use crate::services::yukpo_openai_outbound::{
            acquire_concurrency_permit, http_client, send_request_with_retry,
        };
        let url_c = url.clone();
        let request_body_c = request_body.clone();
        let model_timeout = model.timeout;
        let _slot = acquire_concurrency_permit().await;
        let client = http_client();

        let response = send_request_with_retry("AppIA-gemini", || {
            client
                .post(&url_c)
                .header("Content-Type", "application/json")
                .json(&request_body_c)
                .timeout(Duration::from_secs(model_timeout))
        })
        .await
        .map_err(|e| format!("Gemini network error: {}", e))?;

        if !response.status().is_success() {
            let err = response.text().await.unwrap_or_default();
            return Err(format!("Gemini API error: {}", err).into());
        }

        let body: Value = response.json().await.map_err(|e| format!("Gemini JSON error: {}", e))?;

        let content = body["candidates"][0]["content"]["parts"][0]["text"]
            .as_str()
            .ok_or_else(|| "Gemini: missing content in response".to_string())?;

        let prompt_tokens = body["usageMetadata"]["promptTokenCount"].as_u64().unwrap_or(0);
        let comp_tokens = body["usageMetadata"]["candidatesTokenCount"].as_u64().unwrap_or(0);
        Ok((
            content.to_string(),
            comp_tokens,
            prompt_tokens + comp_tokens,
        ))
    }

    /// Nettoie une chaîne base64 (data-URI ou brut) pour les APIs multimodales.
    fn multimodal_image_base64_clean(raw: &str) -> String {
        let s = raw.trim();
        if s.starts_with("data:") {
            s.split(',').nth(1).unwrap_or(s).trim().to_string()
        } else {
            s.to_string()
        }
    }

    /// ?? Appel Google Gemini Pro multimodal
    #[allow(dead_code)]
    async fn call_gemini_multimodal(
        &self,
        model: &ModelConfig,
        prompt: &str,
        images: Option<&Vec<String>>,
    ) -> AppResult<(String, u32)> {
        let url = format!(
            "{}/models/{}:generateContent?key={}",
            model.base_url, model.model, model.api_key
        );

        // ✅ Texte + vraies images en inline_data (l'ancien code envoyait le base64 comme texte → pas de vision)
        let mut parts: Vec<Value> = vec![json!({ "text": prompt })];
        if let Some(imgs) = images {
            for (i, raw_b64) in imgs.iter().enumerate() {
                let b64 = Self::multimodal_image_base64_clean(raw_b64);
                if b64.is_empty() {
                    log::warn!("[Gemini Multimodal] Image {} ignorée (base64 vide)", i + 1);
                    continue;
                }
                log::info!(
                    "[Gemini Multimodal] Image {}: {} caractères base64 (inline JPEG)",
                    i + 1,
                    b64.len()
                );
                parts.push(json!({
                    "inline_data": {
                        "mime_type": "image/jpeg",
                        "data": b64
                    }
                }));
            }
        }

        let request_body = json!({
            "contents": [{
                "parts": parts
            }],
            "generationConfig": {
                "temperature": model.temperature,
                "topP": model.top_p,
                "topK": 40,
                "maxOutputTokens": model.max_tokens,
                "stopSequences": ["\n\n", "Human:", "Assistant:"]
            },
            "safetySettings": [
                {
                    "category": "HARM_CATEGORY_HARASSMENT",
                    "threshold": "BLOCK_MEDIUM_AND_ABOVE"
                },
                {
                    "category": "HARM_CATEGORY_HATE_SPEECH",
                    "threshold": "BLOCK_MEDIUM_AND_ABOVE"
                },
                {
                    "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                    "threshold": "BLOCK_MEDIUM_AND_ABOVE"
                },
                {
                    "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
                    "threshold": "BLOCK_MEDIUM_AND_ABOVE"
                }
            ]
        });

        let response = self
            .http
            .post(&url)
            .header("Content-Type", "application/json")
            .json(&request_body)
            .timeout(Duration::from_secs(model.timeout))
            .send()
            .await
            .map_err(|e| format!("Gemini multimodal API error: {}", e))?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("Gemini multimodal API error: {}", error_text).into());
        }

        let body: Value = response
            .json()
            .await
            .map_err(|e| format!("Gemini multimodal JSON parse error: {}", e))?;

        let content = body["candidates"][0]["content"]["parts"][0]["text"]
            .as_str()
            .ok_or("Gemini multimodal response missing content")?;

        // Extraire les tokens pour Gemini
        let tokens_used = if let Some(usage) = body.get("usageMetadata") {
            let prompt_tokens = usage.get("promptTokenCount").and_then(|v| v.as_u64()).unwrap_or(0);
            let candidate_tokens =
                usage.get("candidatesTokenCount").and_then(|v| v.as_u64()).unwrap_or(0);
            let total_tokens = usage
                .get("totalTokenCount")
                .and_then(|v| v.as_u64())
                .unwrap_or(prompt_tokens + candidate_tokens);

            log::info!(
                "[Gemini Multimodal] Tokens utilis?s: prompt={}, candidates={}, total={}",
                prompt_tokens,
                candidate_tokens,
                total_tokens
            );

            total_tokens as u32
        } else {
            let estimated = (prompt.len() / 4).max(10) + (content.len() / 4).max(5);
            log::warn!(
                "[Gemini Multimodal] Pas d'info usage, estimation: {} tokens",
                estimated
            );
            estimated as u32
        };

        Ok((content.to_string(), tokens_used))
    }

    /// ?? Appel Anthropic Claude multimodal
    #[allow(dead_code)]
    async fn call_anthropic_multimodal(
        &self,
        model: &ModelConfig,
        prompt: &str,
        images: Option<&Vec<String>>,
    ) -> AppResult<(String, u32)> {
        let url = format!("{}/messages", model.base_url);

        // ✅ Blocs image base64 + texte (l'ancien code passait le base64 en chaîne « Image URL: » → pas de vision)
        let mut content_blocks: Vec<Value> = Vec::new();
        if let Some(imgs) = images {
            for (i, raw_b64) in imgs.iter().enumerate() {
                let b64 = Self::multimodal_image_base64_clean(raw_b64);
                if b64.is_empty() {
                    log::warn!(
                        "[Anthropic Multimodal] Image {} ignorée (base64 vide)",
                        i + 1
                    );
                    continue;
                }
                log::info!(
                    "[Anthropic Multimodal] Image {}: {} caractères base64",
                    i + 1,
                    b64.len()
                );
                content_blocks.push(json!({
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": "image/jpeg",
                        "data": b64
                    }
                }));
            }
        }
        content_blocks.push(json!({
            "type": "text",
            "text": prompt
        }));

        let messages = vec![json!({
            "role": "user",
            "content": content_blocks
        })];

        let payload = json!({
            "model": model.model,
            "max_tokens": model.max_tokens,
            "temperature": model.temperature,
            "top_p": model.top_p,
            "messages": messages
        });

        let response = self
            .http
            .post(&url)
            .header("Authorization", format!("Bearer {}", model.api_key))
            .header("Content-Type", "application/json")
            .header("anthropic-version", "2023-06-01")
            .json(&payload)
            .timeout(Duration::from_secs(model.timeout))
            .send()
            .await
            .map_err(|e| format!("Anthropic multimodal API error: {}", e))?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("Anthropic multimodal API error: {}", error_text).into());
        }

        let body: Value = response
            .json()
            .await
            .map_err(|e| format!("Anthropic multimodal JSON parse error: {}", e))?;

        let content = body["content"][0]["text"]
            .as_str()
            .ok_or("Anthropic multimodal response missing content")?;

        // Extraire les tokens pour Anthropic
        let tokens_used = if let Some(usage) = body.get("usage") {
            let input_tokens = usage.get("input_tokens").and_then(|v| v.as_u64()).unwrap_or(0);
            let output_tokens = usage.get("output_tokens").and_then(|v| v.as_u64()).unwrap_or(0);
            let total_tokens = input_tokens + output_tokens;

            log::info!(
                "[Anthropic Multimodal] Tokens utilis?s: input={}, output={}, total={}",
                input_tokens,
                output_tokens,
                total_tokens
            );

            total_tokens as u32
        } else {
            let estimated = (prompt.len() / 4).max(10) + (content.len() / 4).max(5);
            log::warn!(
                "[Anthropic Multimodal] Pas d'info usage, estimation: {} tokens",
                estimated
            );
            estimated as u32
        };

        Ok((content.to_string(), tokens_used))
    }

    /// ?? R?ponse de fallback intelligente si aucun mod?le n'est disponible
    fn generate_fallback_response(&self, _prompt: &str) -> AppResult<(String, Value)> {
        let fallback_json = serde_json::json!({
            "intention": "creation_service",
            "titre": {
                "type_donnee": "string",
                "valeur": "Service propos?",
                "origine_champs": "fallback"
            },
            "description": {
                "type_donnee": "string",
                "valeur": "Description du service bas?e sur votre demande",
                "origine_champs": "fallback"
            },
            "category": {
                "type_donnee": "string",
                "valeur": "G?n?ral",
                "origine_champs": "fallback"
            },
            "is_tarissable": {
                "type_donnee": "boolean",
                "valeur": false,
                "origine_champs": "fallback"
            }
        });
        Ok(("fallback".to_string(), fallback_json))
    }

    /// ?? Mise ? jour des m?triques de performance
    #[allow(dead_code)]
    async fn update_metrics(&self, model_name: &str, success: bool, start_time: SystemTime) {
        let response_time =
            SystemTime::now().duration_since(start_time).unwrap().as_millis() as f64;

        let mut metrics = self.metrics.write().await;
        let model_metrics =
            metrics.entry(model_name.to_string()).or_insert_with(ModelMetrics::default);

        model_metrics.total_requests += 1;
        if success {
            model_metrics.successful_requests += 1;
        } else {
            model_metrics.failed_requests += 1;
        }

        // Calcul du temps de r?ponse moyen
        let total_time = model_metrics.average_response_time
            * (model_metrics.total_requests - 1) as f64
            + response_time;
        model_metrics.average_response_time = total_time / model_metrics.total_requests as f64;

        model_metrics.last_used =
            Some(SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs());
        model_metrics.success_rate =
            model_metrics.successful_requests as f64 / model_metrics.total_requests as f64;
    }

    /// ?? Mise ? jour des m?triques de performance avec tokens
    async fn update_metrics_with_tokens(
        &self,
        model_name: &str,
        success: bool,
        start_time: SystemTime,
        tokens_used: u32,
    ) {
        let response_time =
            SystemTime::now().duration_since(start_time).unwrap().as_millis() as f64;

        let mut metrics = self.metrics.write().await;
        let model_metrics =
            metrics.entry(model_name.to_string()).or_insert_with(ModelMetrics::default);

        model_metrics.total_requests += 1;
        model_metrics.total_tokens_used += tokens_used as u64;

        if success {
            model_metrics.successful_requests += 1;
        } else {
            model_metrics.failed_requests += 1;
        }

        // Calcul de la moyenne du temps de r?ponse
        model_metrics.average_response_time = (model_metrics.average_response_time
            * (model_metrics.total_requests - 1) as f64
            + response_time)
            / model_metrics.total_requests as f64;

        // Calcul du taux de succ?s
        model_metrics.success_rate =
            model_metrics.successful_requests as f64 / model_metrics.total_requests as f64 * 100.0;

        // Mise ? jour de la derni?re utilisation
        model_metrics.last_used =
            Some(SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs());

        log::info!(
            "[AppIA] M?triques mises ? jour pour {}: {} tokens, {}ms, {}% succ?s",
            model_name,
            tokens_used,
            response_time,
            model_metrics.success_rate
        );
    }

    /// ?? Enregistrement d'interaction pour apprentissage
    async fn record_interaction(
        &self,
        interaction_id: &str,
        prompt: &str,
        response: &str,
        model_name: &str,
    ) {
        let training_data = TrainingData {
            id: interaction_id.to_string(),
            prompt: prompt.to_string(),
            expected_response: String::new(), // Sera rempli par feedback utilisateur
            actual_response: response.to_string(),
            model_used: model_name.to_string(),
            user_feedback: None,
            quality_score: 0.0,
            created_at: SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs(),
        };

        let mut training_queue = self.training_data.lock().await;
        training_queue.push(training_data);

        // Limiter la taille de la queue
        if training_queue.len() > 10000 {
            training_queue.drain(0..1000);
        }
    }

    /// ?? Ajout de feedback utilisateur
    pub async fn add_feedback(&self, feedback: UserFeedback) -> AppResult<()> {
        let mut feedback_queue = self.feedback_queue.lock().await;
        feedback_queue.push(feedback);

        // Traitement asynchrone du feedback
        self.process_feedback_async().await;

        Ok(())
    }

    /// ?? Traitement asynchrone du feedback pour apprentissage
    async fn process_feedback_async(&self) {
        let mut feedback_queue = self.feedback_queue.lock().await;
        let mut training_queue = self.training_data.lock().await;

        while let Some(feedback) = feedback_queue.pop() {
            // Mise ? jour des donn?es d'entra?nement
            if let Some(training_data) =
                training_queue.iter_mut().find(|td| td.id == feedback.interaction_id)
            {
                training_data.user_feedback = Some(feedback.clone());
                training_data.quality_score = feedback.rating as f64 / 5.0;
            }

            // Sauvegarde en base de donn?es
            if let Err(e) = self.save_feedback_to_db(&feedback).await {
                log::error!("[AppIA] Erreur sauvegarde feedback: {}", e);
            }
        }
    }

    /// ?? Sauvegarde du feedback en base de donn?es (MongoDB uniquement)
    async fn save_feedback_to_db(&self, feedback: &UserFeedback) -> AppResult<()> {
        // Le feedback est maintenant g?r? par le service IAFeedbackService
        // qui utilise MongoDB pour l'historisation
        log::info!(
            "[AppIA] Feedback enregistr? via IAFeedbackService: {}",
            feedback.interaction_id
        );
        Ok(())
    }

    /// ?? G?n?ration de dataset pour fine-tuning
    pub async fn generate_training_dataset(&self, output_path: &str) -> AppResult<()> {
        let training_queue = self.training_data.lock().await;

        let high_quality_data: Vec<_> = training_queue
            .iter()
            .filter(|td| td.quality_score >= 0.8 && td.user_feedback.is_some())
            .collect();

        let formatted: Vec<_> = high_quality_data.iter()
            .map(|td| {
                json!({
                    "instruction": "Analyser la demande utilisateur et g?n?rer une r?ponse JSON structur?e pour Yukpo",
                    "input": td.prompt,
                    "output": td.actual_response,
                    "quality_score": td.quality_score,
                    "model_used": td.model_used
                })
            })
            .collect();

        let json_str = serde_json::to_string_pretty(&formatted)
            .map_err(|e| format!("Erreur s?rialisation dataset: {}", e))?;

        fs::create_dir_all(
            std::path::Path::new(output_path)
                .parent()
                .unwrap_or_else(|| std::path::Path::new(".")),
        )
        .map_err(|e| format!("Erreur cr?ation dossier: {}", e))?;

        fs::write(output_path, json_str).map_err(|e| format!("Erreur ?criture dataset: {}", e))?;

        log::info!(
            "[AppIA] Dataset g?n?r?: {} exemples de haute qualit?",
            formatted.len()
        );
        Ok(())
    }

    /// ?? R?cup?ration des statistiques avanc?es
    pub async fn get_advanced_stats(&self) -> AppResult<Value> {
        let metrics = self.metrics.read().await;
        let training_queue = self.training_data.lock().await;
        let feedback_queue = self.feedback_queue.lock().await;

        let mut models_stats = serde_json::Map::new();
        for (name, metric) in metrics.iter() {
            models_stats.insert(
                name.clone(),
                json!({
                    "total_requests": metric.total_requests,
                    "success_rate": metric.success_rate,
                    "average_response_time": metric.average_response_time,
                    "total_cost": metric.total_cost,
                    "last_used": metric.last_used
                }),
            );
        }

        let stats = json!({
            "models": models_stats,
            "learning": {
                "training_data_count": training_queue.len(),
                "feedback_queue_count": feedback_queue.len(),
                "high_quality_samples": training_queue.iter().filter(|td| td.quality_score >= 0.8).count()
            }
        });

        Ok(stats)
    }

    /// ?? Mise ? jour de la configuration des mod?les
    pub async fn update_model_config(
        &self,
        model_name: &str,
        config: ModelConfig,
    ) -> AppResult<()> {
        let mut models = self.models.write().await;

        if let Some(existing_model) = models.iter_mut().find(|m| m.name == model_name) {
            *existing_model = config;
        } else {
            models.push(config);
        }

        // Re-tri par priorit?
        models.sort_by(|a, b| b.priority.cmp(&a.priority));

        Ok(())
    }

    /// ✅ Hash du prompt pour le cache Redis
    fn _hash_prompt(prompt: &str) -> String {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};

        let mut hasher = DefaultHasher::new();
        prompt.hash(&mut hasher);
        format!("{:x}", hasher.finish())
    }

    /// ?? Nettoyage des donn?es anciennes
    pub async fn cleanup_old_data(&self) -> AppResult<()> {
        let cutoff_time =
            SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs() - (30 * 24 * 3600); // 30 jours

        let mut training_queue = self.training_data.lock().await;
        training_queue.retain(|td| td.created_at > cutoff_time);

        let mut feedback_queue = self.feedback_queue.lock().await;
        feedback_queue.retain(|f| f.timestamp > cutoff_time);

        log::info!("[AppIA] Nettoyage termin?");
        Ok(())
    }

    // M?thodes de compatibilit? avec l'ancienne interface
    pub fn prepare_finetune_dataset(
        &self,
        pairs: Vec<(String, String)>,
        output_path: &str,
    ) -> Result<(), String> {
        let formatted: Vec<_> = pairs
            .into_iter()
            .map(|(src, tgt)| {
                json!({
                    "instruction": "Traduire ou reformuler",
                    "input": src,
                    "output": tgt
                })
            })
            .collect();

        let json_str = serde_json::to_string_pretty(&formatted).map_err(|e| e.to_string())?;

        fs::create_dir_all(
            std::path::Path::new(output_path)
                .parent()
                .unwrap_or_else(|| std::path::Path::new(".")),
        )
        .map_err(|e| e.to_string())?;

        fs::write(output_path, json_str).map_err(|e| e.to_string())?;
        Ok(())
    }

    /// Test optimis? du mod?le avec timeout r?duit
    #[allow(dead_code)]
    async fn test_model_optimized(
        &self,
        model_name: &str,
        prompt: &str,
    ) -> AppResult<(String, u32, u32)> {
        let start_time = std::time::Instant::now();

        // ? OPTIMISATION : Timeout r?duit pour l'IA externe
        let timeout = Duration::from_secs(20);

        match tokio::time::timeout(timeout, async {
            match model_name {
                "openai-gpt4o" => {
                    let client = Client::new();
                    let api_key =
                        std::env::var("OPENAI_API_KEY").unwrap_or_default().trim().to_string();

                    if api_key.is_empty() {
                        return Err("OPENAI_API_KEY non configur?e".into());
                    }

                    let auth =
                        openai_auth_header_value(&api_key).map_err(|e| AppError::Internal(e))?;

                    let request_body = json!({
                        "model": "gpt-4o",
                        "messages": [{"role": "user", "content": prompt}],
                        "max_tokens": 1500, // R?duit pour plus de rapidit?
                        "temperature": 0.2, // R?duit pour plus de rapidit? et coh?rence
                        "stream": false
                    });

                    let response = client
                        .post("https://api.openai.com/v1/chat/completions")
                        .header("Authorization", auth)
                        .header("Content-Type", "application/json")
                        .json(&request_body)
                        .timeout(Duration::from_secs(10)) // Timeout HTTP r?duit
                        .send()
                        .await?;

                    if response.status().is_success() {
                        let result: Value = response.json().await?;
                        if let Some(content) = result["choices"][0]["message"]["content"].as_str() {
                            let prompt_tokens =
                                result["usage"]["prompt_tokens"].as_u64().unwrap_or(0) as u32;
                            let completion_tokens =
                                result["usage"]["completion_tokens"].as_u64().unwrap_or(0) as u32;
                            let total_tokens =
                                result["usage"]["total_tokens"].as_u64().unwrap_or(0) as u32;

                            log::info!(
                                "[OpenAI] Tokens utilis?s: prompt={}, completion={}, total={}",
                                prompt_tokens,
                                completion_tokens,
                                total_tokens
                            );

                            Ok((
                                content.to_string(),
                                total_tokens,
                                start_time.elapsed().as_millis() as u32,
                            ))
                        } else {
                            Err("R?ponse OpenAI invalide".into())
                        }
                    } else {
                        Err(format!("Erreur OpenAI: {}", response.status()).into())
                    }
                }
                _ => Err(format!("Mod?le {} non support?", model_name).into()),
            }
        })
        .await
        {
            Ok(result) => result,
            Err(_) => {
                log::warn!("[AppIA] ? Timeout mod?le {} (15s)", model_name);
                Err(format!("Timeout mod?le {}", model_name).into())
            }
        }
    }

    pub async fn generate_video_briefs(
        &self,
        request: &VideoBriefRequest,
    ) -> AppResult<Vec<VideoBrief>> {
        let highlights = if request.highlights.is_empty() {
            "- Mettre en avant les points forts classiques (qualité, rapidité, garantie)"
                .to_string()
        } else {
            request
                .highlights
                .iter()
                .enumerate()
                .map(|(idx, h)| format!("{}. {}", idx + 1, h))
                .collect::<Vec<String>>()
                .join("\n")
        };

        let variants = request.variant_count.clamp(1, 5);

        // ✅ CORRECTION: Prompt amélioré pour forcer un JSON pur sans markdown
        let prompt = format!(
            "Tu es le directeur marketing IA de Yukpo. Génère {variants} variantes pour une courte vidéo produit.

IMPORTANT: Réponds UNIQUEMENT avec un JSON valide, SANS markdown, SANS code blocks, SANS texte avant ou après.

Format JSON attendu:
{{\"variants\": [{{\"headline\": \"...\", \"call_to_action\": \"...\", \"script_outline\": [\"...\"], \"hook\": \"...\", \"voiceover\": \"...\", \"hashtags\": [\"...\"]}}]}}

Contraintes:
- 4 à 6 éléments dans script_outline
- CTA concret
- Hashtags (max 3) adaptés au canal
- Voix off <= 80 mots

Données produit:
- Nom: {name}
- Description: {description}
- Prix: {price}
- Promotion: {promotion}
- Points forts:
{highlights}
- Audience cible: {audience}
- Style attendu: {tone}
- Langue: {lang}

Réponds SEULEMENT le JSON, rien d'autre.",
            variants = variants,
            lang = request.lang,
            name = request.product_name,
            description = request.description.clone().unwrap_or_else(|| "Non renseignée".to_string()),
            price = request.price.clone().unwrap_or_else(|| "Non communiqué".to_string()),
            promotion = request.promotion.clone().unwrap_or_else(|| "Aucune".to_string()),
            highlights = highlights,
            audience = request
                .target_audience
                .clone()
                .unwrap_or_else(|| "Audience générale Yukpo".to_string()),
            tone = request.tone.clone().unwrap_or_else(|| "TikTok dynamique".to_string()),
        );

        // ✅ CORRECTION: Gestion d'erreur robuste avec logging détaillé
        let response = match self.predict(&prompt).await {
            Ok((model_name, response, tokens)) => {
                log::info!(
                    "[AppIA::generate_video_briefs] ✅ Prédiction réussie avec {} ({} tokens)",
                    model_name,
                    tokens
                );
                response
            }
            Err(err) => {
                log::error!(
                    "[AppIA::generate_video_briefs] ❌ Échec prédiction IA: {} - Product: {}",
                    err,
                    request.product_name
                );
                return Err(err);
            }
        };

        // ✅ CORRECTION: Tentative d'extraction JSON avec nettoyage amélioré
        let json_block = match extract_json_block(&response) {
            Some(block) => {
                log::debug!(
                    "[AppIA::generate_video_briefs] ✅ JSON extrait ({} chars)",
                    block.len()
                );
                block
            }
            None => {
                // ✅ CORRECTION: Tentative de nettoyage supplémentaire avant d'échouer
                let cleaned = response.trim();
                // Essayer de parser directement si la réponse entière est du JSON
                if cleaned.starts_with('{') || cleaned.starts_with('[') {
                    if serde_json::from_str::<Value>(cleaned).is_ok() {
                        log::debug!(
                            "[AppIA::generate_video_briefs] ✅ JSON trouvé après nettoyage ({} chars)",
                            cleaned.len()
                        );
                        cleaned.to_string()
                    } else {
                        log::error!(
                    "[AppIA::generate_video_briefs] ❌ JSON manquant dans réponse IA ({} chars): {}",
                    response.len(),
                    if response.len() > 200 { format!("{}...", &response[..200]) } else { response.clone() }
                );
                        return Err(AppError::Internal(format!(
                            "Réponse IA vidéo invalide (JSON manquant). Réponse reçue: {}",
                            if response.len() > 200 {
                                format!("{}...", &response[..200])
                            } else {
                                response
                            }
                        )));
                    }
                } else {
                    log::error!(
                        "[AppIA::generate_video_briefs] ❌ JSON manquant dans réponse IA ({} chars): {}",
                        response.len(),
                        if response.len() > 200 { format!("{}...", &response[..200]) } else { response.clone() }
                    );
                    return Err(AppError::Internal(format!(
                        "Réponse IA vidéo invalide (JSON manquant). Réponse reçue: {}",
                        if response.len() > 200 {
                            format!("{}...", &response[..200])
                        } else {
                            response
                        }
                    )));
                }
            }
        };

        let parsed: Value = match serde_json::from_str(&json_block) {
            Ok(value) => value,
            Err(err) => {
                log::error!(
                    "[AppIA::generate_video_briefs] ❌ JSON malformé: {} - JSON: {}",
                    err,
                    if json_block.len() > 500 {
                        format!("{}...", &json_block[..500])
                    } else {
                        json_block.clone()
                    }
                );
                return Err(AppError::Internal(format!(
                    "JSON vidéo IA illisible: {}. JSON reçu: {}",
                    err,
                    if json_block.len() > 500 {
                        format!("{}...", &json_block[..500])
                    } else {
                        json_block
                    }
                )));
            }
        };

        let variants = parsed
            .get("variants")
            .and_then(Value::as_array)
            .ok_or_else(|| AppError::Internal("JSON vidéo IA sans champ 'variants'".to_string()))?;

        let mut results: Vec<VideoBrief> = Vec::new();
        for entry in variants {
            let mut brief = VideoBrief::default();
            brief.headline =
                entry.get("headline").and_then(Value::as_str).map(|s| s.trim().to_string());
            brief.call_to_action = entry
                .get("call_to_action")
                .and_then(Value::as_str)
                .map(|s| s.trim().to_string());
            brief.hook = entry.get("hook").and_then(Value::as_str).map(|s| s.trim().to_string());
            brief.voiceover =
                entry.get("voiceover").and_then(Value::as_str).map(|s| s.trim().to_string());
            brief.hashtags = entry
                .get("hashtags")
                .and_then(Value::as_array)
                .map(|arr| {
                    arr.iter()
                        .filter_map(|v| v.as_str())
                        .map(|s| s.trim().to_string())
                        .collect::<Vec<String>>()
                })
                .unwrap_or_default();
            brief.script_outline = entry
                .get("script_outline")
                .and_then(Value::as_array)
                .map(|arr| {
                    arr.iter()
                        .filter_map(|v| v.as_str())
                        .map(|s| s.trim().to_string())
                        .filter(|s| !s.is_empty())
                        .collect::<Vec<String>>()
                })
                .unwrap_or_default();

            if brief.script_outline.is_empty() && brief.headline.is_some() {
                brief.script_outline = vec![
                    format!("Hook: {}", brief.headline.clone().unwrap()),
                    "Scene 2: Démonstration rapide".to_string(),
                    "Scene 3: Preuve sociale / témoignage".to_string(),
                    "Scene 4: CTA final".to_string(),
                ];
            }

            results.push(brief);
        }

        Ok(results)
    }

    pub async fn generate_video_style(
        &self,
        request: &VideoStyleRequest,
    ) -> AppResult<VideoStyleSuggestion> {
        let highlights = if request.highlights.is_empty() {
            "- Mettre en avant les bénéfices clés (qualité, disponibilité, rapidité)".to_string()
        } else {
            request
                .highlights
                .iter()
                .map(|item| format!("- {item}"))
                .collect::<Vec<String>>()
                .join("\n")
        };

        // ✅ CORRECTION: Prompt amélioré pour forcer un JSON pur sans markdown
        let prompt = format!(
            "Tu es le directeur artistique IA de Yukpo. Pour un format {channel}, propose une direction visuelle concise.

IMPORTANT: Réponds UNIQUEMENT avec un JSON valide, SANS markdown, SANS code blocks, SANS texte avant ou après.

Format JSON attendu:
{{\"effects\": [\"...\"], \"transitions\": [\"...\"], \"color_palette\": \"...\", \"overlay_tips\": [\"...\"], \"music_hint\": \"...\"}}

Contraintes:
- Maximum 4 éléments dans effects/transitions/overlay_tips
- Color_palette = 2-3 couleurs (hex ou noms)
- music_hint <= 15 mots

Données:
- Produit: {product_type}
- Ton: {tone}
- Promotion: {promotion}
- Points clés:
{highlights}
- Langue: {lang}

Réponds SEULEMENT le JSON, rien d'autre.",
            channel = request.channel,
            product_type = request.product_type.as_deref().unwrap_or("générique"),
            tone = request.tone.as_deref().unwrap_or("TikTok dynamique"),
            promotion = request.promotion.as_deref().unwrap_or("Aucune promotion"),
            highlights = highlights,
            lang = request.lang,
        );

        // ✅ CORRECTION: Gestion d'erreur robuste avec logging détaillé
        let response = match self.predict(&prompt).await {
            Ok((model_name, response, tokens)) => {
                log::info!(
                    "[AppIA::generate_video_style] ✅ Prédiction réussie avec {} ({} tokens)",
                    model_name,
                    tokens
                );
                response
            }
            Err(err) => {
                log::error!(
                    "[AppIA::generate_video_style] ❌ Échec prédiction IA: {} - Channel: {}, Product: {:?}",
                    err,
                    request.channel,
                    request.product_type
                );
                // Retourner l'erreur pour que le contrôleur utilise le fallback
                return Err(err);
            }
        };

        // ✅ CORRECTION: Tentative d'extraction JSON avec nettoyage amélioré
        let json_block = match extract_json_block(&response) {
            Some(block) => block,
            None => {
                // ✅ CORRECTION: Tentative de nettoyage supplémentaire avant d'échouer
                let cleaned = response.trim();
                // Essayer de parser directement si la réponse entière est du JSON
                if cleaned.starts_with('{') || cleaned.starts_with('[') {
                    if serde_json::from_str::<Value>(cleaned).is_ok() {
                        log::debug!(
                            "[AppIA::generate_video_style] ✅ JSON trouvé après nettoyage ({} chars)",
                            cleaned.len()
                        );
                        cleaned.to_string()
                    } else {
                        log::error!(
                    "[AppIA::generate_video_style] ❌ JSON manquant dans réponse IA ({} chars): {}",
                    response.len(),
                    if response.len() > 200 { format!("{}...", &response[..200]) } else { response.clone() }
                );
                        // Retourner l'erreur pour que le contrôleur utilise le fallback
                        return Err(AppError::Internal(format!(
                            "Réponse IA style invalide (JSON manquant). Réponse reçue: {}",
                            if response.len() > 200 {
                                format!("{}...", &response[..200])
                            } else {
                                response
                            }
                        )));
                    }
                } else {
                    log::error!(
                        "[AppIA::generate_video_style] ❌ JSON manquant dans réponse IA ({} chars): {}",
                        response.len(),
                        if response.len() > 200 { format!("{}...", &response[..200]) } else { response.clone() }
                    );
                    // Retourner l'erreur pour que le contrôleur utilise le fallback
                    return Err(AppError::Internal(format!(
                        "Réponse IA style invalide (JSON manquant). Réponse reçue: {}",
                        if response.len() > 200 {
                            format!("{}...", &response[..200])
                        } else {
                            response
                        }
                    )));
                }
            }
        };

        log::debug!(
            "[AppIA::generate_video_style] ✅ JSON extrait ({} chars): {}",
            json_block.len(),
            if json_block.len() > 300 {
                format!("{}...", &json_block[..300])
            } else {
                json_block.clone()
            }
        );

        let parsed: Value = match serde_json::from_str(&json_block) {
            Ok(value) => value,
            Err(err) => {
                log::error!(
                    "[AppIA::generate_video_style] ❌ JSON malformé: {} - JSON: {}",
                    err,
                    if json_block.len() > 500 {
                        format!("{}...", &json_block[..500])
                    } else {
                        json_block.clone()
                    }
                );
                // Retourner l'erreur pour que le contrôleur utilise le fallback
                return Err(AppError::Internal(format!(
                    "JSON style IA illisible: {}. JSON reçu: {}",
                    err,
                    if json_block.len() > 500 {
                        format!("{}...", &json_block[..500])
                    } else {
                        json_block
                    }
                )));
            }
        };

        let mut suggestion = VideoStyleSuggestion::default();
        suggestion.effects = parsed
            .get("effects")
            .and_then(Value::as_array)
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str())
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty())
                    .collect::<Vec<String>>()
            })
            .unwrap_or_default();
        suggestion.transitions = parsed
            .get("transitions")
            .and_then(Value::as_array)
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str())
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty())
                    .collect::<Vec<String>>()
            })
            .unwrap_or_default();
        suggestion.overlay_tips = parsed
            .get("overlay_tips")
            .and_then(Value::as_array)
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str())
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty())
                    .collect::<Vec<String>>()
            })
            .unwrap_or_default();
        suggestion.color_palette = parsed
            .get("color_palette")
            .and_then(Value::as_str)
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty());
        suggestion.music_hint = parsed
            .get("music_hint")
            .and_then(Value::as_str)
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty());

        Ok(suggestion)
    }

    pub async fn analyze_media(
        &self,
        request: &MediaAnalysisRequest,
    ) -> AppResult<MediaAnalysisResult> {
        // ✅ CORRECTION: Prompt amélioré pour forcer un JSON pur sans markdown
        let prompt = format!(
            "Tu es l'expert vision IA de Yukpo. À partir des informations suivantes, déduis le ressenti visuel.

IMPORTANT: Réponds UNIQUEMENT avec un JSON valide, SANS markdown, SANS code blocks, SANS texte avant ou après.

Format JSON attendu:
{{\"dominant_colors\": [\"...\"], \"detected_objects\": [\"...\"], \"ambiance\": \"...\", \"marketing_angle\": \"...\"}}

Contraintes:
- dominant_colors : max 3 valeurs (palette hex ou nom)
- detected_objects : liste de 3-5 éléments maximum
- ambiance : phrase <= 10 mots
- marketing_angle : phrase marketing <= 15 mots, orientée conversion

Données:
- Produit: {name}
- Description: {description}
- Tags: {tags}
- Langue: {lang}

Réponds SEULEMENT le JSON, rien d'autre.",
            name = request.product_name,
            description = request.description.clone().unwrap_or_else(|| "Non renseignée".to_string()),
            tags = if request.media_tags.is_empty() {
                "aucun tag fourni".to_string()
            } else {
                request.media_tags.join(", ")
            },
            lang = request.lang,
        );

        // ✅ CORRECTION: Gestion d'erreur robuste avec logging détaillé
        let response = match self.predict(&prompt).await {
            Ok((model_name, response, tokens)) => {
                log::info!(
                    "[AppIA::analyze_media] ✅ Prédiction réussie avec {} ({} tokens)",
                    model_name,
                    tokens
                );
                response
            }
            Err(err) => {
                log::error!(
                    "[AppIA::analyze_media] ❌ Échec prédiction IA: {} - Product: {}",
                    err,
                    request.product_name
                );
                return Err(err);
            }
        };

        // ✅ CORRECTION: Tentative d'extraction JSON avec nettoyage amélioré
        let json_block = match extract_json_block(&response) {
            Some(block) => {
                log::debug!(
                    "[AppIA::analyze_media] ✅ JSON extrait ({} chars)",
                    block.len()
                );
                block
            }
            None => {
                // ✅ CORRECTION: Tentative de nettoyage supplémentaire avant d'échouer
                let cleaned = response.trim();
                // Essayer de parser directement si la réponse entière est du JSON
                if cleaned.starts_with('{') || cleaned.starts_with('[') {
                    if serde_json::from_str::<Value>(cleaned).is_ok() {
                        log::debug!(
                            "[AppIA::analyze_media] ✅ JSON trouvé après nettoyage ({} chars)",
                            cleaned.len()
                        );
                        cleaned.to_string()
                    } else {
                        log::error!(
                    "[AppIA::analyze_media] ❌ JSON manquant dans réponse IA ({} chars): {}",
                    response.len(),
                    if response.len() > 200 { format!("{}...", &response[..200]) } else { response.clone() }
                );
                        return Err(AppError::Internal(format!(
                            "Réponse IA analyse média invalide (JSON manquant). Réponse reçue: {}",
                            if response.len() > 200 {
                                format!("{}...", &response[..200])
                            } else {
                                response
                            }
                        )));
                    }
                } else {
                    log::error!(
                        "[AppIA::analyze_media] ❌ JSON manquant dans réponse IA ({} chars): {}",
                        response.len(),
                        if response.len() > 200 {
                            format!("{}...", &response[..200])
                        } else {
                            response.clone()
                        }
                    );
                    return Err(AppError::Internal(format!(
                        "Réponse IA analyse média invalide (JSON manquant). Réponse reçue: {}",
                        if response.len() > 200 {
                            format!("{}...", &response[..200])
                        } else {
                            response
                        }
                    )));
                }
            }
        };

        // ✅ CORRECTION: Utiliser explicitement &json_block pour le parsing avec logging
        let parsed: Value = match serde_json::from_str(&json_block) {
            Ok(value) => value,
            Err(err) => {
                log::error!(
                    "[AppIA::analyze_media] ❌ JSON malformé: {} - JSON: {}",
                    err,
                    if json_block.len() > 500 {
                        format!("{}...", &json_block[..500])
                    } else {
                        json_block.clone()
                    }
                );
                return Err(AppError::Internal(format!(
                    "JSON analyse média illisible: {}. JSON reçu: {}",
                    err,
                    if json_block.len() > 500 {
                        format!("{}...", &json_block[..500])
                    } else {
                        json_block
                    }
                )));
            }
        };

        let mut result = MediaAnalysisResult::default();
        result.dominant_colors = parsed
            .get("dominant_colors")
            .and_then(Value::as_array)
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str())
                    .map(|s| s.trim().to_string())
                    .collect::<Vec<String>>()
            })
            .unwrap_or_default();
        result.detected_objects = parsed
            .get("detected_objects")
            .and_then(Value::as_array)
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str())
                    .map(|s| s.trim().to_string())
                    .collect::<Vec<String>>()
            })
            .unwrap_or_default();
        result.ambiance = parsed
            .get("ambiance")
            .and_then(Value::as_str)
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty());
        result.marketing_angle = parsed
            .get("marketing_angle")
            .and_then(Value::as_str)
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty());

        Ok(result)
    }

    pub async fn generate_distribution_plan(
        &self,
        request: &DistributionRequest,
    ) -> AppResult<DistributionSuggestion> {
        let channels = if request.channels.is_empty() {
            "chat, product, instagram, youtube".to_string()
        } else {
            request.channels.join(", ")
        };

        // ✅ CORRECTION: Prompt amélioré pour forcer un JSON pur sans markdown
        let prompt = format!(
            "Tu es le stratège diffusion de Yukpo. Produit un plan succinct.

IMPORTANT: Réponds UNIQUEMENT avec un JSON valide, SANS markdown, SANS code blocks, SANS texte avant ou après.

Format JSON attendu:
{{\"summary\": \"...\", \"hashtags\": [\"...\"], \"schedule\": [{{\"channel\": \"...\", \"best_time\": \"...\", \"call_to_action\": \"...\"}}]}}

Contraintes:
- summary <= 30 mots
- hashtags max 5
- best_time = format local (ex: \"Lundi 18h\")
- call_to_action <= 12 mots

Données:
- Produit: {product}
- Canaux: {channels}
- Audience: {audience}
- Angle marketing: {angle}
- Langue: {lang}

Réponds SEULEMENT le JSON, rien d'autre.",
            product = request.product_name,
            channels = channels,
            audience = request
                .target_audience
                .clone()
                .unwrap_or_else(|| "Audience générale Yukpo".to_string()),
            angle = request
                .marketing_angle
                .clone()
                .unwrap_or_else(|| "Mettre en avant la valeur et la confiance".to_string()),
            lang = request.lang,
        );

        // ✅ CORRECTION: Gestion d'erreur robuste avec logging détaillé
        let response = match self.predict(&prompt).await {
            Ok((model_name, response, tokens)) => {
                log::info!(
                    "[AppIA::generate_distribution_plan] ✅ Prédiction réussie avec {} ({} tokens)",
                    model_name,
                    tokens
                );
                response
            }
            Err(err) => {
                log::error!(
                    "[AppIA::generate_distribution_plan] ❌ Échec prédiction IA: {} - Product: {}",
                    err,
                    request.product_name
                );
                return Err(err);
            }
        };

        // ✅ CORRECTION: Tentative d'extraction JSON avec nettoyage amélioré
        let json_block = match extract_json_block(&response) {
            Some(block) => {
                log::debug!(
                    "[AppIA::generate_distribution_plan] ✅ JSON extrait ({} chars)",
                    block.len()
                );
                block
            }
            None => {
                // ✅ CORRECTION: Tentative de nettoyage supplémentaire avant d'échouer
                let cleaned = response.trim();
                // Essayer de parser directement si la réponse entière est du JSON
                if cleaned.starts_with('{') || cleaned.starts_with('[') {
                    if serde_json::from_str::<Value>(cleaned).is_ok() {
                        log::debug!(
                            "[AppIA::generate_distribution_plan] ✅ JSON trouvé après nettoyage ({} chars)",
                            cleaned.len()
                        );
                        cleaned.to_string()
                    } else {
                        log::error!(
                    "[AppIA::generate_distribution_plan] ❌ JSON manquant dans réponse IA ({} chars): {}",
                    response.len(),
                    if response.len() > 200 { format!("{}...", &response[..200]) } else { response.clone() }
                );
                        return Err(AppError::Internal(format!(
                            "Réponse IA diffusion invalide (JSON manquant). Réponse reçue: {}",
                            if response.len() > 200 {
                                format!("{}...", &response[..200])
                            } else {
                                response
                            }
                        )));
                    }
                } else {
                    log::error!(
                        "[AppIA::generate_distribution_plan] ❌ JSON manquant dans réponse IA ({} chars): {}",
                        response.len(),
                        if response.len() > 200 { format!("{}...", &response[..200]) } else { response.clone() }
                    );
                    return Err(AppError::Internal(format!(
                        "Réponse IA diffusion invalide (JSON manquant). Réponse reçue: {}",
                        if response.len() > 200 {
                            format!("{}...", &response[..200])
                        } else {
                            response
                        }
                    )));
                }
            }
        };

        let parsed: Value = match serde_json::from_str(&json_block) {
            Ok(value) => value,
            Err(err) => {
                log::error!(
                    "[AppIA::generate_distribution_plan] ❌ JSON malformé: {} - JSON: {}",
                    err,
                    if json_block.len() > 500 {
                        format!("{}...", &json_block[..500])
                    } else {
                        json_block.clone()
                    }
                );
                return Err(AppError::Internal(format!(
                    "JSON diffusion IA illisible: {}. JSON reçu: {}",
                    err,
                    if json_block.len() > 500 {
                        format!("{}...", &json_block[..500])
                    } else {
                        json_block
                    }
                )));
            }
        };

        let mut suggestion = DistributionSuggestion::default();
        suggestion.summary = parsed
            .get("summary")
            .and_then(Value::as_str)
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty());
        suggestion.hashtags = parsed
            .get("hashtags")
            .and_then(Value::as_array)
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str())
                    .map(|s| s.trim().trim_start_matches('#').to_string())
                    .filter(|s| !s.is_empty())
                    .collect::<Vec<String>>()
            })
            .unwrap_or_default();
        suggestion.schedule = parsed
            .get("schedule")
            .and_then(Value::as_array)
            .map(|arr| {
                arr.iter()
                    .filter_map(|item| {
                        let channel = item.get("channel")?.as_str()?.trim().to_string();
                        let best_time = item.get("best_time")?.as_str()?.trim().to_string();
                        let call_to_action = item
                            .get("call_to_action")
                            .and_then(Value::as_str)
                            .map(|s| s.trim().to_string())
                            .filter(|s| !s.is_empty());
                        Some(DistributionScheduleItem {
                            channel,
                            best_time,
                            call_to_action,
                        })
                    })
                    .collect::<Vec<DistributionScheduleItem>>()
            })
            .unwrap_or_default();

        Ok(suggestion)
    }

    /// ✅ NOUVEAU: Génère une timeline structurée pour le montage vidéo
    pub async fn generate_video_timeline(
        &self,
        request: &TimelineRequest,
    ) -> AppResult<VideoTimeline> {
        let script_lines = &request.brief.script_outline;
        let duration = request.duration_seconds;
        let lang = request.lang.as_deref().unwrap_or("fr");

        // Calculer la durée par scène (répartir équitablement)
        let num_scenes = script_lines.len().max(1);
        let duration_per_scene = duration / num_scenes as f64;
        // Minimum 2 secondes par scène, maximum 8 secondes
        let duration_per_scene = duration_per_scene.clamp(2.0, 8.0);

        // ✅ CORRIGÉ: Construire la liste des médias disponibles avec leurs IDs exacts
        let media_list = if request.available_media.is_empty() {
            "Aucun média disponible - utiliser des images générées IA".to_string()
        } else {
            request
                .available_media
                .iter()
                .map(|m| {
                    let url_preview = m
                        .url
                        .as_ref()
                        .map(|u| {
                            if u.len() > 50 {
                                format!("{}...", &u[..50])
                            } else {
                                u.clone()
                            }
                        })
                        .unwrap_or_else(|| "URL non disponible".to_string());
                    format!(
                        "media_id: '{}' | type: {} | url: {}",
                        m.id, m.media_type, url_preview
                    )
                })
                .collect::<Vec<String>>()
                .join("\n")
        };

        // ✅ NOUVEAU 2026-01-04: Extraire la liste complète des effets disponibles
        use crate::services::effect_preview_service::get_available_effect_names;
        let all_available_effects = get_available_effect_names();

        // ✅ CORRIGÉ: Filtrer les effets demandés pour ne garder que ceux supportés
        let requested_effects: Vec<String> = if request.style.effects.is_empty() {
            vec!["zoom".to_string(), "fade".to_string()] // Par défaut
        } else {
            request.style.effects
                .iter()
                .filter_map(|e| {
                    // Normaliser et vérifier si l'effet existe
                    let normalized = e.trim().to_lowercase();
                    if all_available_effects.iter().any(|a| a.to_lowercase() == normalized) {
                        Some(e.clone())
                    } else {
                        // ✅ CORRIGÉ: Logger en debug au lieu de warn (effets non supportés sont ignorés silencieusement)
                        log::debug!(
                            "[AppIA::generate_video_timeline] Effet '{}' non supporté, ignoré (normal)",
                            e
                        );
                        None
                    }
                })
                .collect()
        };

        // Construire la liste d'effets pour le prompt
        let effects_list = if requested_effects.is_empty() {
            // Si aucun effet valide, utiliser les effets par défaut
            "zoom, fade".to_string()
        } else {
            requested_effects.join(", ")
        };

        // ✅ NOUVEAU: Liste complète des effets disponibles pour l'IA
        let all_effects_list = all_available_effects.join(", ");

        let transitions_list = if request.style.transitions.is_empty() {
            "fade, slide".to_string()
        } else {
            request.style.transitions.join(", ")
        };

        let prompt = format!(
            "Tu es le monteur vidéo IA de Yukpo. Génère une timeline précise pour un montage vidéo.

IMPORTANT: Réponds UNIQUEMENT avec un JSON valide, SANS markdown, SANS code blocks, SANS texte avant ou après.

Format JSON attendu:
{{\"scenes\": [{{\"scene_index\": 0, \"start_time\": 0.0, \"duration\": 3.5, \"media_id\": \"...\", \"text\": \"...\", \"text_position\": \"center\", \"transition\": \"fade\", \"effects\": [\"zoom\"], \"audio_cue\": 0.0}}]}}

Contraintes:
- Durée totale: {duration} secondes
- Durée par scène: {duration_per_scene:.1} secondes (min 2s, max 8s)
- Nombre de scènes: {num_scenes}
- text_position: 'top' | 'center' | 'bottom'
- transition: 'fade' | 'slide' | 'zoom' | 'none'
- effects: ⚠️ CRITIQUE - Utilise UNIQUEMENT ces effets disponibles: {all_effects_list}
  Effets suggérés pour ce style: {effects_list}
  ⚠️ N'invente JAMAIS d'effets qui ne sont pas dans la liste ci-dessus
- transitions disponibles: {transitions_list}
- audio_cue: timing pour synchronisation (secondes depuis le début)

Script à mettre en scène:
{script_lines}

Médias disponibles (UTILISER EXACTEMENT ces media_id, ne pas inventer):
{media_list}

⚠️ CRITIQUE: Utilise UNIQUEMENT les media_id listés ci-dessus. Ne crée pas de nouveaux IDs comme 'image_1', 'image_2', etc.

Style:
- Effets: {effects_list}
- Transitions: {transitions_list}
- Palette couleurs: {color_palette}

Titre: {headline}
CTA: {cta}

Langue: {lang}

Réponds SEULEMENT le JSON, rien d'autre.",
            duration = duration,
            duration_per_scene = duration_per_scene,
            num_scenes = num_scenes,
            script_lines = script_lines
                .iter()
                .enumerate()
                .map(|(i, line)| format!("{}. {}", i + 1, line))
                .collect::<Vec<String>>()
                .join("\n"),
            media_list = media_list,
            effects_list = effects_list,
            all_effects_list = all_effects_list,
            transitions_list = transitions_list,
            color_palette = request
                .style
                .color_palette
                .as_deref()
                .unwrap_or("Couleurs vives et modernes"),
            headline = request
                .brief
                .headline
                .as_deref()
                .unwrap_or(""),
            cta = request
                .brief
                .call_to_action
                .as_deref()
                .unwrap_or(""),
            lang = lang,
        );

        // Appeler l'IA
        let response = match self.predict(&prompt).await {
            Ok((model_name, response, tokens)) => {
                log::info!(
                    "[AppIA::generate_video_timeline] ✅ Prédiction réussie avec {} ({} tokens)",
                    model_name,
                    tokens
                );
                response
            }
            Err(err) => {
                log::error!(
                    "[AppIA::generate_video_timeline] ❌ Échec prédiction IA: {}",
                    err
                );
                return Err(err);
            }
        };

        // Extraire le JSON
        let json_block = match extract_json_block(&response) {
            Some(block) => {
                log::debug!(
                    "[AppIA::generate_video_timeline] ✅ JSON extrait ({} chars)",
                    block.len()
                );
                block
            }
            None => {
                let cleaned = response.trim();
                if cleaned.starts_with('{') || cleaned.starts_with('[') {
                    if serde_json::from_str::<Value>(cleaned).is_ok() {
                        log::debug!(
                            "[AppIA::generate_video_timeline] ✅ JSON trouvé après nettoyage ({} chars)",
                            cleaned.len()
                        );
                        cleaned.to_string()
                    } else {
                        log::error!(
                            "[AppIA::generate_video_timeline] ❌ JSON manquant dans réponse IA ({} chars): {}",
                            response.len(),
                            if response.len() > 200 { format!("{}...", &response[..200]) } else { response.clone() }
                        );
                        return Err(AppError::Internal(format!(
                            "Réponse IA timeline invalide (JSON manquant). Réponse reçue: {}",
                            if response.len() > 200 {
                                format!("{}...", &response[..200])
                            } else {
                                response
                            }
                        )));
                    }
                } else {
                    log::error!(
                        "[AppIA::generate_video_timeline] ❌ JSON manquant dans réponse IA ({} chars): {}",
                        response.len(),
                        if response.len() > 200 { format!("{}...", &response[..200]) } else { response.clone() }
                    );
                    return Err(AppError::Internal(format!(
                        "Réponse IA timeline invalide (JSON manquant). Réponse reçue: {}",
                        if response.len() > 200 {
                            format!("{}...", &response[..200])
                        } else {
                            response
                        }
                    )));
                }
            }
        };

        // Parser le JSON
        let parsed: Value = match serde_json::from_str(&json_block) {
            Ok(value) => value,
            Err(err) => {
                log::error!(
                    "[AppIA::generate_video_timeline] ❌ JSON malformé: {} - JSON: {}",
                    err,
                    if json_block.len() > 500 {
                        format!("{}...", &json_block[..500])
                    } else {
                        json_block.clone()
                    }
                );
                return Err(AppError::Internal(format!(
                    "JSON timeline IA illisible: {}. JSON reçu: {}",
                    err,
                    if json_block.len() > 500 {
                        format!("{}...", &json_block[..500])
                    } else {
                        json_block
                    }
                )));
            }
        };

        // Extraire les scènes
        let scenes_array = parsed.get("scenes").and_then(Value::as_array).ok_or_else(|| {
            AppError::Internal("JSON timeline IA sans champ 'scenes'".to_string())
        })?;

        let mut scenes: Vec<TimelineScene> = Vec::new();
        let mut current_time = 0.0;

        for (idx, entry) in scenes_array.iter().enumerate() {
            let scene_duration = entry
                .get("duration")
                .and_then(Value::as_f64)
                .unwrap_or_else(|| {
                    // Si pas de durée, utiliser la durée calculée
                    if idx < script_lines.len() {
                        duration_per_scene
                    } else {
                        2.0
                    }
                })
                .clamp(1.0, 10.0);

            let start_time =
                entry.get("start_time").and_then(Value::as_f64).unwrap_or(current_time);

            let scene = TimelineScene {
                scene_index: entry
                    .get("scene_index")
                    .and_then(Value::as_u64)
                    .map(|v| v as usize)
                    .unwrap_or(idx),
                start_time,
                duration: scene_duration,
                media_id: entry
                    .get("media_id")
                    .and_then(Value::as_str)
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty()),
                media_url: entry
                    .get("media_url")
                    .and_then(Value::as_str)
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty()),
                text: entry
                    .get("text")
                    .and_then(Value::as_str)
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty())
                    .or_else(|| {
                        // Fallback: utiliser le script_outline correspondant
                        script_lines.get(idx).cloned()
                    }),
                text_position: entry
                    .get("text_position")
                    .and_then(Value::as_str)
                    .map(|s| s.trim().to_string())
                    .filter(|s| matches!(s.as_str(), "top" | "center" | "bottom")),
                transition: entry
                    .get("transition")
                    .and_then(Value::as_str)
                    .map(|s| s.trim().to_string())
                    .filter(|s| matches!(s.as_str(), "fade" | "slide" | "zoom" | "none")),
                effects: {
                    // ✅ NOUVEAU 2026-01-04: Valider et filtrer les effets générés par l'IA
                    use crate::services::effect_preview_service::{
                        get_available_effect_names, normalize_effect_name,
                    };
                    let available_effects: Vec<String> = get_available_effect_names()
                        .iter()
                        .map(|a| normalize_effect_name(a))
                        .collect();

                    let mut unsupported_effects: Vec<String> = Vec::new();
                    let mut valid_effects = entry
                        .get("effects")
                        .and_then(Value::as_array)
                        .map(|arr| {
                            arr.iter()
                                .filter_map(|v| v.as_str())
                                .map(|s| {
                                    let normalized = normalize_effect_name(s.trim());
                                    // Vérifier si l'effet normalisé existe dans la liste disponible
                                    if available_effects.contains(&normalized) {
                                        Some(normalized)
                                    } else {
                                        log::warn!(
                                            "[AppIA::generate_video_timeline] ⚠️ Effet généré '{}' (normalisé: '{}') non supporté, ignoré. Effets disponibles: {}",
                                            s.trim(),
                                            normalized,
                                            available_effects.join(", ")
                                        );
                                        // ✅ NOUVEAU 2026-01-04: Collecter les effets non supportés pour enregistrement asynchrone
                                        unsupported_effects.push(s.trim().to_string());
                                        None
                                    }
                                })
                                .flatten()
                                .collect::<Vec<String>>()
                        })
                        .unwrap_or_default();

                    // ✅ CORRIGÉ: Enregistrer les effets non supportés de manière asynchrone (non-bloquant)
                    if !unsupported_effects.is_empty() {
                        use crate::controllers::ia_controller::record_unsupported_effect;
                        for effect in unsupported_effects {
                            let effect_clone = effect.clone();
                            tokio::spawn(async move {
                                record_unsupported_effect(&effect_clone).await;
                            });
                        }
                    }

                    // Si aucun effet valide, utiliser un effet par défaut
                    if valid_effects.is_empty() {
                        valid_effects.push("zoom".to_string());
                        log::debug!(
                            "[AppIA::generate_video_timeline] ✅ Aucun effet valide, utilisation de 'zoom' par défaut"
                        );
                    }

                    // ✅ NOUVEAU 2026-01-04: Enregistrer la génération de timeline dans les métriques
                    use crate::controllers::ia_controller::record_timeline_generation;
                    record_timeline_generation(valid_effects.len()).await;

                    valid_effects
                },
                audio_cue: entry.get("audio_cue").and_then(Value::as_f64),
            };

            scenes.push(scene);
            current_time = start_time + scene_duration;
        }

        // ✅ CORRIGÉ: Mapper media_id vers media_url depuis available_media
        // Créer un HashMap pour le mapping rapide
        let media_map: std::collections::HashMap<String, String> = request
            .available_media
            .iter()
            .filter_map(|m| m.url.as_ref().map(|url| (m.id.clone(), url.clone())))
            .collect();

        // ✅ NOUVEAU 2026-01-04: Log pour diagnostic
        log::info!(
            "[AppIA::generate_video_timeline] 📊 Médias disponibles: {} items, {} avec URL",
            request.available_media.len(),
            media_map.len()
        );
        if !request.available_media.is_empty() {
            log::debug!(
                "[AppIA::generate_video_timeline] 📋 IDs disponibles: {:?}",
                request.available_media.iter().map(|m| &m.id).collect::<Vec<_>>()
            );
        }

        // ✅ CORRIGÉ: Mapper media_id vers media_url avec fallback intelligent
        for scene in &mut scenes {
            if scene.media_url.is_none() {
                if let Some(media_id) = scene.media_id.clone() {
                    // ✅ NOUVEAU 2026-01-04: Ignorer les IDs placeholder (>= 10000)
                    if let Ok(id_num) = media_id.parse::<i32>() {
                        if id_num >= 10000 {
                            log::debug!(
                                "[AppIA::generate_video_timeline] ⏭️ Ignoré media_id placeholder '{}' (>= 10000)",
                                media_id
                            );
                            // Utiliser le premier média disponible à la place
                            if !request.available_media.is_empty() {
                                if let Some(first_media) = request.available_media.first() {
                                    if let Some(url) = &first_media.url {
                                        scene.media_url = Some(url.clone());
                                        scene.media_id = Some(first_media.id.clone());
                                        log::info!(
                                            "[AppIA::generate_video_timeline] ✅ Remplacé placeholder '{}' par premier média disponible '{}'",
                                            media_id,
                                            url
                                        );
                                    }
                                }
                            }
                            continue;
                        }
                    }

                    if let Some(url) = media_map.get(&media_id) {
                        scene.media_url = Some(url.clone());
                        log::debug!(
                            "[AppIA::generate_video_timeline] Mapped media_id '{}' -> media_url '{}'",
                            media_id,
                            url
                        );
                    } else {
                        // ✅ CORRIGÉ: Logger en debug au lieu de warn (c'est normal si l'IA génère des media_id qui n'existent pas encore)
                        log::debug!(
                            "[AppIA::generate_video_timeline] media_id '{}' not found in available_media ({} items), utilisation fallback",
                            media_id,
                            media_map.len()
                        );

                        // ✅ FALLBACK: Utiliser le premier média disponible si media_id non trouvé
                        if !request.available_media.is_empty() {
                            if let Some(first_media) = request.available_media.first() {
                                if let Some(url) = &first_media.url {
                                    scene.media_url = Some(url.clone());
                                    scene.media_id = Some(first_media.id.clone());
                                    log::info!(
                                        "[AppIA::generate_video_timeline] ✅ Fallback: Utilisé premier média disponible pour media_id '{}' -> '{}'",
                                        media_id,
                                        url
                                    );
                                }
                            }
                        }
                    }
                } else {
                    // ✅ FALLBACK: Si pas de media_id, utiliser le premier média disponible
                    if !request.available_media.is_empty() {
                        if let Some(first_media) = request.available_media.first() {
                            if let Some(url) = &first_media.url {
                                scene.media_url = Some(url.clone());
                                scene.media_id = Some(first_media.id.clone());
                                log::info!(
                                    "[AppIA::generate_video_timeline] ✅ Fallback: Scène sans media_id, utilisé premier média disponible '{}'",
                                    url
                                );
                            }
                        }
                    }
                }
            }
        }

        // Si aucune scène n'a été générée, créer une timeline basique
        if scenes.is_empty() {
            log::warn!(
                "[AppIA::generate_video_timeline] ⚠️ Aucune scène générée, création timeline basique"
            );
            for (idx, line) in script_lines.iter().enumerate() {
                let scene_duration = duration_per_scene;
                scenes.push(TimelineScene {
                    scene_index: idx,
                    start_time: idx as f64 * scene_duration,
                    duration: scene_duration,
                    media_id: None,
                    media_url: None,
                    text: Some(line.clone()),
                    text_position: Some("center".to_string()),
                    transition: Some(if idx == 0 {
                        "none".to_string()
                    } else {
                        "fade".to_string()
                    }),
                    effects: vec!["zoom".to_string()],
                    audio_cue: Some(idx as f64 * scene_duration),
                });
            }
        }

        // Calculer la durée totale réelle
        let total_duration = scenes.iter().map(|s| s.start_time + s.duration).fold(0.0, f64::max);

        Ok(VideoTimeline {
            total_duration: total_duration.max(duration),
            scenes,
        })
    }
}

/// ✅ CORRECTION: Extraction JSON robuste qui gère les code blocks markdown
pub fn extract_json_block(response: &str) -> Option<String> {
    let trimmed = response.trim();

    // ✅ CORRECTION: Vérifier si la réponse est juste un nom de modèle (ex: "openai-gpt4o")
    // Si c'est le cas, c'est probablement une erreur de l'API, retourner None
    if trimmed.len() < 50 && !trimmed.contains('{') && !trimmed.contains('[') {
        // Probablement juste un nom de modèle ou un message d'erreur court
        return None;
    }

    // 1. Si la réponse est entourée de ```json ou ```, extraire le contenu
    if trimmed.starts_with("```json") || trimmed.starts_with("```") {
        let start_marker = if trimmed.starts_with("```json") {
            "```json"
        } else {
            "```"
        };

        // Trouver la fin du code block
        let start_idx = start_marker.len();
        let end_marker = "\n```";
        if let Some(end_idx) = trimmed[start_idx..].find(end_marker) {
            let json_content = &trimmed[start_idx..start_idx + end_idx];
            let cleaned = json_content.trim();
            // Vérifier que c'est bien du JSON valide
            if cleaned.starts_with('{') || cleaned.starts_with('[') {
                return Some(cleaned.to_string());
            }
        }
        // Si pas de ``` de fin, prendre jusqu'à la fin
        let json_content = &trimmed[start_idx..];
        let cleaned = json_content.trim();
        if cleaned.starts_with('{') || cleaned.starts_with('[') {
            return Some(cleaned.to_string());
        }
    }

    // 2. Chercher un bloc JSON entre { et } (méthode originale améliorée)
    if let Some(start) = trimmed.find('{') {
        // Compter les accolades pour trouver la fin correcte
        let mut depth = 0;
        let mut end_pos = None;

        for (idx, ch) in trimmed[start..].char_indices() {
            match ch {
                '{' => depth += 1,
                '}' => {
                    depth -= 1;
                    if depth == 0 {
                        end_pos = Some(start + idx);
                        break;
                    }
                }
                _ => {}
            }
        }

        if let Some(end) = end_pos {
            let json_candidate = trimmed[start..=end].to_string();
            // Vérifier que c'est du JSON valide en essayant de le parser
            if serde_json::from_str::<Value>(&json_candidate).is_ok() {
                return Some(json_candidate);
            }
        }
    }

    // 3. Chercher un tableau JSON entre [ et ]
    if let Some(start) = trimmed.find('[') {
        let mut depth = 0;
        let mut end_pos = None;

        for (idx, ch) in trimmed[start..].char_indices() {
            match ch {
                '[' => depth += 1,
                ']' => {
                    depth -= 1;
                    if depth == 0 {
                        end_pos = Some(start + idx);
                        break;
                    }
                }
                _ => {}
            }
        }

        if let Some(end) = end_pos {
            let json_candidate = trimmed[start..=end].to_string();
            if serde_json::from_str::<Value>(&json_candidate).is_ok() {
                return Some(json_candidate);
            }
        }
    }

    None
}

fn format_timestamp(value: f32) -> String {
    let total_ms = (value * 1000.0).round() as u64;
    let hours = total_ms / 3_600_000;
    let minutes = (total_ms % 3_600_000) / 60_000;
    let seconds = (total_ms % 60_000) / 1000;
    let millis = total_ms % 1000;

    format!("{:02}:{:02}:{:02},{:03}", hours, minutes, seconds, millis)
}

fn parse_time_value(
    value: Option<&Value>,
    index: usize,
    total: usize,
    duration_seconds: f32,
) -> AppResult<f32> {
    if let Some(val) = value {
        if let Some(s) = val.as_str() {
            return parse_timestamp_string(s)
                .ok_or_else(|| AppError::Internal(format!("Horodatage IA invalide: {}", s)));
        } else if let Some(n) = val.as_f64() {
            return Ok(n as f32);
        }
    }
    let segment = duration_seconds / total.max(1) as f32;
    Ok((index as f32 * segment).min(duration_seconds))
}

fn parse_timestamp_string(input: &str) -> Option<f32> {
    let sanitized = input.trim().replace(',', ".");
    let parts: Vec<&str> = sanitized.split(':').collect();
    if parts.len() != 3 {
        return None;
    }
    let hours: f32 = parts[0].parse().ok()?;
    let minutes: f32 = parts[1].parse().ok()?;
    let seconds: f32 = parts[2].parse().ok()?;
    Some(hours * 3600.0 + minutes * 60.0 + seconds)
}
