// This file contains the implementation of the AppIA service.

use redis::{Client as RedisClient};
use reqwest::Client;
use serde_json::{json, Value};
use std::fs;
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tokio::sync::{Mutex, RwLock};
use whatlang::detect;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::controllers::ia_status_controller::IAStats;
use crate::core::types::AppResult;
use crate::core::types::AppError;

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
            http: Client::new(),
            models: Arc::new(RwLock::new(models)),
            metrics,
            feedback_queue: Arc::new(Mutex::new(Vec::new())),
            training_data: Arc::new(Mutex::new(Vec::new())),
            pool,
        }
    }

    pub fn from_arc(redis_client: Arc<RedisClient>, stats: Arc<Mutex<IAStats>>, pool: PgPool) -> Self {
        Self::new((*redis_client).clone(), stats, pool)
    }

    /// ?? Initialisation des mod?les IA avec configuration avanc?e
    fn initialize_models() -> Vec<ModelConfig> {
        let mut models = Vec::new();
        
        // OpenAI GPT-4o (priorit? haute) - Mod?le multimodal le plus avanc?
        if let Ok(api_key) = std::env::var("OPENAI_API_KEY") {
            models.push(ModelConfig {
                name: "openai-gpt4o".to_string(),
                api_key,
                base_url: "https://api.openai.com/v1".to_string(),
                model: "gpt-4o".to_string(),
                temperature: 0.2,  // R?duit pour plus de coh?rence et rapidit?
                max_tokens: 1500,  // R?duit pour acc?l?rer
                top_p: 0.8,        // R?duit pour plus de pr?cision
                frequency_penalty: 0.0,  // Supprim? pour acc?l?rer
                presence_penalty: 0.0,   // Supprim? pour acc?l?rer
                timeout: 40,       // Augment? ? 40s pour analyse compl?te des images
                retry_count: 2,    // R?duit ? 2 tentatives
                priority: 10,
                cost_per_token: 0.000005, // GPT-4o est moins cher que GPT-4 Turbo
                enabled: true,
            });
        }

        // OpenAI GPT-4 Turbo (fallback)
        if let Ok(api_key) = std::env::var("OPENAI_API_KEY") {
            models.push(ModelConfig {
                name: "openai-gpt4-turbo".to_string(),
                api_key,
                base_url: "https://api.openai.com/v1".to_string(),
                model: "gpt-4-turbo-preview".to_string(),
                temperature: 0.3,  // R?duit pour plus de rapidit?
                max_tokens: 2000,  // R?duit pour acc?l?rer
                top_p: 0.8,        // R?duit pour plus de pr?cision
                frequency_penalty: 0.0,  // Supprim? pour acc?l?rer
                presence_penalty: 0.0,   // Supprim? pour acc?l?rer
                timeout: 20,       // R?duit de 30s ? 20s
                retry_count: 2,    // R?duit ? 2 tentatives
                priority: 9,
                cost_per_token: 0.00003,
                enabled: true,
            });
        }

        // OpenAI GPT-3.5 Turbo (priorit? moyenne)
        if let Ok(api_key) = std::env::var("OPENAI_API_KEY") {
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
                timeout: 30,
                retry_count: 3,
                priority: 7,
                cost_per_token: 0.000002,
                enabled: true,
            });
        }

        // Mistral AI (priorit? haute)
        if let Ok(api_key) = std::env::var("MISTRAL_API_KEY") {
            models.push(ModelConfig {
                name: "mistral-large".to_string(),
                api_key,
                base_url: "https://api.mistral.ai/v1".to_string(),
                model: "mistral-large-latest".to_string(),
                temperature: 0.3,  // R?duit pour plus de rapidit?
                max_tokens: 2000,  // R?duit pour acc?l?rer
                top_p: 0.8,        // R?duit pour plus de pr?cision
                frequency_penalty: 0.0,  // Supprim? pour acc?l?rer
                presence_penalty: 0.0,   // Supprim? pour acc?l?rer
                timeout: 20,       // R?duit de 30s ? 20s
                retry_count: 2,    // R?duit ? 2 tentatives
                priority: 9,
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
                timeout: 40,       // Augment? ? 40s pour analyse compl?te des images
                retry_count: 3,
                priority: 8,
                cost_per_token: 0.00000375, // Tr?s ?conomique
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
                timeout: 40,       // Augment? ? 40s pour analyse compl?te des images
                retry_count: 3,
                priority: 8,
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
                timeout: 30,
                retry_count: 3,
                priority: 7,
                cost_per_token: 0.000015,
                enabled: true,
            });
        }

        // Ollama local (fallback)
        if std::env::var("OLLAMA_URL").is_ok() {
            models.push(ModelConfig {
                name: "ollama-mistral".to_string(),
                api_key: String::new(),
                base_url: std::env::var("OLLAMA_URL").unwrap_or("http://localhost:11434".to_string()),
                model: "mistral".to_string(),
                temperature: 0.7,
                max_tokens: 4000,
                top_p: 0.9,
                frequency_penalty: 0.1,
                presence_penalty: 0.1,
                timeout: 30,
                retry_count: 3,
                priority: 5,
                cost_per_token: 0.0,
                enabled: true,
            });
        }

        // Ollama Llama2 (fallback local)
        if std::env::var("OLLAMA_URL").is_ok() {
            models.push(ModelConfig {
                name: "ollama-llama2".to_string(),
                api_key: String::new(),
                base_url: std::env::var("OLLAMA_URL").unwrap_or("http://localhost:11434".to_string()),
                model: "llama2".to_string(),
                temperature: 0.7,
                max_tokens: 4000,
                top_p: 0.9,
                frequency_penalty: 0.1,
                presence_penalty: 0.1,
                timeout: 30,
                retry_count: 3,
                priority: 4,
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
                timeout: 30,
                retry_count: 3,
                priority: 6,
                cost_per_token: 0.000015,
                enabled: true,
            });
        }

        // Trier par priorit? d?croissante
        models.sort_by(|a, b| b.priority.cmp(&a.priority));
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

        // 1. V?rification du cache Redis (d?sactiv? temporairement)
        log::info!("[AppIA] Redis d?sactiv? - continuation sans cache");

        // 2. S?lection intelligente du mod?le
        let models = self.models.read().await;
        let enabled_models: Vec<&ModelConfig> = models.iter()
            .filter(|m| m.enabled)
            .collect();

        if enabled_models.is_empty() {
            log::warn!("[AppIA] Aucun mod?le activ?, utilisation du fallback");
            let (model_name, response) = self.generate_fallback_response(prompt)?;
            let response_string = response.to_string();
            return Ok((model_name, response_string, 5));
        }

        // 3. ? OPTIMISATION : Timeout optimis? pour performance
        let mut _last_error = None;
        
        for model in enabled_models {
            log::info!("[AppIA] Tentative avec mod?le: {} (timeout: 15s)", model.name);
            let timeout_duration = Duration::from_secs(15);
            match tokio::time::timeout(timeout_duration, async {
                self.call_model(model, prompt, &interaction_id).await
            }).await {
                Ok(Ok((response, model_name, tokens))) => {
                    let processing_time = start_time.elapsed().unwrap().as_millis();
                    log::info!("[AppIA] ? Succ?s avec {} en {}ms ({} tokens)", model_name, processing_time, tokens);
                    return Ok((model_name, response, tokens));
                }
                Ok(Err(e)) => {
                    log::warn!("[AppIA] ? Erreur avec {}: {}", model.name, e);
                    _last_error = Some(e);
                }
                Err(_) => {
                    log::warn!("[AppIA] ? Timeout avec {} (15s)", model.name);
                    _last_error = Some(AppError::Internal("Timeout".to_string()));
                }
            }
        }

        // 4. Fallback intelligent si tous les mod?les ?chouent
        log::warn!("[AppIA] Tous les mod?les ont ?chou?, utilisation du fallback intelligent");
        let (model_name, response_json) = self.generate_fallback_response(prompt)?;
        let response_string = response_json.to_string();
        // Mise ? jour des m?triques pour le fallback
        self.update_metrics_with_tokens(&model_name, true, start_time, 5).await;
        self.record_interaction(&interaction_id, prompt, &response_string, &model_name).await;
        return Ok((model_name, response_string, 5));
    }

    /// ??? Pr?diction multimodale avec support des images
    pub async fn predict_multimodal(&self, prompt: &str, images: Option<Vec<String>>) -> AppResult<(String, String, u32)> {
        let start_time = SystemTime::now();
        let interaction_id = Uuid::new_v4().to_string();
        
        // ? NOUVEAU : Configuration adaptative
        let production_config = crate::config::production_config::ProductionConfig::new();
        
        log::info!("[AppIA] Tentative multimodale avec mod?les IA optimis?s");
        log::info!("[AppIA] Configuration: GPU={}, Timeout={}s", 
                  production_config.gpu_enabled, 
                  production_config.api_timeouts.multimodal);

        // 1. S?lection intelligente du mod?le (priorit? aux mod?les multimodaux)
        let models = self.models.read().await;
        let enabled_models: Vec<&ModelConfig> = models.iter()
            .filter(|m| m.enabled && self.supports_multimodal(m))
            .collect();

        if enabled_models.is_empty() {
            log::warn!("[AppIA] Aucun mod?le multimodal activ?, fallback vers texte uniquement");
            return self.predict(prompt).await;
        }

        // 2. Test des mod?les multimodaux avec timeout adaptatif
        let mut _last_error = None;
        for model in enabled_models.iter().take(1) {
            // ? NOUVEAU : Timeout adaptatif selon GPU
            let timeout_duration = if production_config.gpu_enabled {
                Duration::from_secs(production_config.api_timeouts.multimodal)
            } else {
                Duration::from_secs(30)
            };
            
            log::info!("[AppIA] Test multimodal du mod?le: {} (timeout {}s)", model.name, timeout_duration.as_secs());
            
            let timeout_future = tokio::time::timeout(
                timeout_duration,
                self.call_model_multimodal(model, prompt, images.as_ref(), &interaction_id)
            );
            
            match timeout_future.await {
                Ok(Ok((response, model_name, tokens_used))) => {
                    let elapsed = start_time.elapsed().unwrap().as_millis();
                    log::info!("[AppIA] ? Mod?le multimodal {} r?ussi en {}ms", model_name, elapsed);
                    self.update_metrics_with_tokens(&model_name, true, start_time, tokens_used).await;
                    self.record_interaction(&interaction_id, prompt, &response, &model_name).await;
                    return Ok((model_name, response.to_string(), tokens_used));
                }
                Ok(Err(e)) => {
                    log::warn!("[AppIA] Mod?le multimodal {} ?chec: {}", model.name, e);
                    _last_error = Some(e);
                }
                Err(_) => {
                    log::warn!("[AppIA] ? Mod?le multimodal {} timeout apr?s {}s", model.name, timeout_duration.as_secs());
                    _last_error = Some("Timeout".into());
                }
            }
            
            self.update_metrics(&model.name, false, start_time).await;
        }

        // 3. Fallback vers texte uniquement si multimodal ?choue
        log::warn!("[AppIA] Mod?les multimodaux ont ?chou?, fallback vers texte uniquement");
        self.predict(prompt).await
    }

    /// ?? V?rifie si un mod?le supporte le multimodal
    fn supports_multimodal(&self, model: &ModelConfig) -> bool {
        match model.name.as_str() {
            "openai-gpt4o" | "openai-gpt4-turbo" => true,
            "gemini-pro" => true,
            "claude-3-5-sonnet" | "claude-3-sonnet" => true,
            _ => false,
        }
    }

    /// ?? Appel d'un mod?le sp?cifique avec gestion d'erreur avanc?e
    #[allow(dead_code)]
    async fn call_model(&self, model: &ModelConfig, prompt: &str, _interaction_id: &str) -> AppResult<(String, String, u32)> {
        let start_time = SystemTime::now();
        
        for attempt in 0..model.retry_count {
            match self.call_model_implementation(model, prompt).await {
                Ok((response, tokens_used)) => {
                    let response_time = start_time.elapsed().unwrap().as_millis() as f64;
                    
                    // Log de performance avec tokens
                    log::info!(
                        "[AppIA] Mod?le {} r?ussi en {}ms, {} tokens (tentative {})",
                        model.name, response_time, tokens_used, attempt + 1
                    );
                    
                    return Ok((model.name.clone(), response, tokens_used));
                }
                Err(e) => {
                    log::warn!(
                        "[AppIA] Mod?le {} ?chec tentative {}: {}",
                        model.name, attempt + 1, e
                    );
                    
                    if attempt < model.retry_count - 1 {
                        tokio::time::sleep(Duration::from_millis(100 * (attempt + 1) as u64)).await;
                    }
                }
            }
        }
        
        Err(format!("Mod?le {} a ?chou? apr?s {} tentatives", model.name, model.retry_count).into())
    }

    /// ??? Appel de mod?le multimodal optimis?
    async fn call_model_multimodal(&self, model: &ModelConfig, prompt: &str, images: Option<&Vec<String>>, _interaction_id: &str) -> AppResult<(String, String, u32)> {
        let start_time = SystemTime::now();
        
        for attempt in 0..2.min(model.retry_count) {
            match self.call_model_multimodal_implementation(model, prompt, images).await {
                Ok((response, tokens_used)) => {
                    let response_time = start_time.elapsed().unwrap().as_millis() as f64;
                    
                    log::info!(
                        "[AppIA] ? Mod?le multimodal {} r?ussi en {}ms, {} tokens (tentative {})",
                        model.name, response_time, tokens_used, attempt + 1
                    );
                    
                    return Ok((model.name.clone(), response, tokens_used));
                }
                Err(e) => {
                    log::warn!(
                        "[AppIA] Mod?le multimodal {} ?chec tentative {}: {}",
                        model.name, attempt + 1, e
                    );
                    
                    if attempt < 1 {
                        tokio::time::sleep(Duration::from_millis(50 * (attempt + 1) as u64)).await;
                    }
                }
            }
        }
        
        Err(format!("Mod?le multimodal {} a ?chou? apr?s {} tentatives", model.name, 2.min(model.retry_count)).into())
    }

    /// ?? Impl?mentation sp?cifique par fournisseur
    #[allow(dead_code)]
    async fn call_model_implementation(&self, model: &ModelConfig, prompt: &str) -> AppResult<(String, u32)> {
        match model.name.as_str() {
            "openai-gpt4o" | "openai-gpt4-turbo" | "openai-gpt35" => self.call_openai(model, prompt).await,
            "gemini-pro" => self.call_gemini(model, prompt).await,
            "claude-3-5-sonnet" | "claude-3-sonnet" => self.call_anthropic(model, prompt).await,
            "mistral-large" => self.call_mistral(model, prompt).await,
            "ollama-mistral" | "ollama-llama2" => self.call_ollama(model, prompt).await,
            "cohere-command" => self.call_cohere(model, prompt).await,
            _ => Err("Mod?le non support?".into()),
        }
    }

    /// ?? Impl?mentation multimodale sp?cifique par fournisseur
    async fn call_model_multimodal_implementation(&self, model: &ModelConfig, prompt: &str, images: Option<&Vec<String>>) -> AppResult<(String, u32)> {
        match model.name.as_str() {
            "openai-gpt4o" | "openai-gpt4-turbo" => self.call_openai_multimodal(model, prompt, images).await,
            "gemini-pro" => self.call_gemini_multimodal(model, prompt, images).await,
            "claude-3-5-sonnet" | "claude-3-sonnet" => self.call_anthropic_multimodal(model, prompt, images).await,
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

        let response = self.http
            .post(&url)
            .header("Authorization", format!("Bearer {}", model.api_key))
            .header("Content-Type", "application/json")
            .json(&payload)
            .timeout(Duration::from_secs(model.timeout))
            .send()
            .await
            .map_err(|e| format!("OpenAI API error: {}", e))?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("OpenAI API error: {}", error_text).into());
        }

        let body: Value = response.json().await
            .map_err(|e| format!("OpenAI JSON parse error: {}", e))?;

        let content = body["choices"][0]["message"]["content"]
            .as_str()
            .ok_or("OpenAI response missing content")?;

        // Extraire les tokens r?ellement consomm?s depuis la r?ponse OpenAI
        let tokens_used = if let Some(usage) = body.get("usage") {
            let prompt_tokens = usage.get("prompt_tokens").and_then(|v| v.as_u64()).unwrap_or(0);
            let completion_tokens = usage.get("completion_tokens").and_then(|v| v.as_u64()).unwrap_or(0);
            let total_tokens = usage.get("total_tokens").and_then(|v| v.as_u64()).unwrap_or(prompt_tokens + completion_tokens);
            
            log::info!("[OpenAI] Tokens utilis?s: prompt={}, completion={}, total={}", 
                      prompt_tokens, completion_tokens, total_tokens);
            
            total_tokens as u32
        } else {
            // Estimation basique si pas d'info de usage
            let estimated = (prompt.len() / 4).max(10) + (content.len() / 4).max(5);
            log::warn!("[OpenAI] Pas d'info usage, estimation: {} tokens", estimated);
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

        let response = self.http
            .post(&url)
            .header("Authorization", format!("Bearer {}", model.api_key))
            .header("Content-Type", "application/json")
            .json(&payload)
            .timeout(Duration::from_secs(model.timeout))
            .send()
            .await
            .map_err(|e| format!("Mistral API error: {}", e))?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("Mistral API error: {}", error_text).into());
        }

        let body: Value = response.json().await
            .map_err(|e| format!("Mistral JSON parse error: {}", e))?;

        let content = body["choices"][0]["message"]["content"]
            .as_str()
            .ok_or("Mistral response missing content")?;

        // Extraire les tokens pour Mistral (m?me format qu'OpenAI)
        let tokens_used = if let Some(usage) = body.get("usage") {
            let total_tokens = usage.get("total_tokens").and_then(|v| v.as_u64()).unwrap_or(0);
            log::info!("[Mistral] Tokens utilis?s: {}", total_tokens);
            total_tokens as u32
        } else {
            let estimated = (prompt.len() / 4).max(10) + (content.len() / 4).max(5);
            log::warn!("[Mistral] Pas d'info usage, estimation: {} tokens", estimated);
            estimated as u32
        };

        Ok((content.to_string(), tokens_used))
    }

    /// ?? Appel Google Gemini Pro
    #[allow(dead_code)]
    async fn call_gemini(&self, model: &ModelConfig, prompt: &str) -> AppResult<(String, u32)> {
        let url = format!("{}/models/{}:generateContent?key={}", 
            model.base_url, model.model, model.api_key);
        
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

        let response = self.http
            .post(&url)
            .header("Content-Type", "application/json")
            .json(&request_body)
            .timeout(Duration::from_secs(model.timeout))
            .send()
            .await
            .map_err(|e| format!("Gemini API error: {}", e))?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("Gemini API error: {}", error_text).into());
        }

        let body: Value = response.json().await
            .map_err(|e| format!("Gemini JSON parse error: {}", e))?;

        let content = body["candidates"][0]["content"]["parts"][0]["text"]
            .as_str()
            .ok_or("Gemini response missing content")?;

        // Extraire les tokens pour Gemini
        let tokens_used = if let Some(usage) = body.get("usageMetadata") {
            let prompt_tokens = usage.get("promptTokenCount").and_then(|v| v.as_u64()).unwrap_or(0);
            let candidate_tokens = usage.get("candidatesTokenCount").and_then(|v| v.as_u64()).unwrap_or(0);
            let total_tokens = usage.get("totalTokenCount").and_then(|v| v.as_u64()).unwrap_or(prompt_tokens + candidate_tokens);
            
            log::info!("[Gemini] Tokens utilis?s: prompt={}, candidates={}, total={}", 
                      prompt_tokens, candidate_tokens, total_tokens);
            
            total_tokens as u32
        } else {
            let estimated = (prompt.len() / 4).max(10) + (content.len() / 4).max(5);
            log::warn!("[Gemini] Pas d'info usage, estimation: {} tokens", estimated);
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

        let response = self.http
            .post(&url)
            .header("Content-Type", "application/json")
            .json(&payload)
            .timeout(Duration::from_secs(model.timeout))
            .send()
            .await
            .map_err(|e| format!("Ollama API error: {}", e))?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("Ollama API error: {}", error_text).into());
        }

        let body: Value = response.json().await
            .map_err(|e| format!("Ollama JSON parse error: {}", e))?;

        let content = body["response"]
            .as_str()
            .ok_or("Ollama response missing content")?;

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

        let response = self.http
            .post(&url)
            .header("Authorization", format!("Bearer {}", model.api_key))
            .header("Content-Type", "application/json")
            .header("anthropic-version", "2023-06-01")
            .json(&payload)
            .timeout(Duration::from_secs(model.timeout))
            .send()
            .await
            .map_err(|e| format!("Anthropic API error: {}", e))?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("Anthropic API error: {}", error_text).into());
        }

        let body: Value = response.json().await
            .map_err(|e| format!("Anthropic JSON parse error: {}", e))?;

        let content = body["content"][0]["text"]
            .as_str()
            .ok_or("Anthropic response missing content")?;

        // Extraire les tokens pour Anthropic
        let tokens_used = if let Some(usage) = body.get("usage") {
            let input_tokens = usage.get("input_tokens").and_then(|v| v.as_u64()).unwrap_or(0);
            let output_tokens = usage.get("output_tokens").and_then(|v| v.as_u64()).unwrap_or(0);
            let total_tokens = input_tokens + output_tokens;
            
            log::info!("[Anthropic] Tokens utilis?s: input={}, output={}, total={}", 
                      input_tokens, output_tokens, total_tokens);
            
            total_tokens as u32
        } else {
            let estimated = (prompt.len() / 4).max(10) + (content.len() / 4).max(5);
            log::warn!("[Anthropic] Pas d'info usage, estimation: {} tokens", estimated);
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

        let response = self.http
            .post(&url)
            .header("Authorization", format!("Bearer {}", model.api_key))
            .header("Content-Type", "application/json")
            .json(&payload)
            .timeout(Duration::from_secs(model.timeout))
            .send()
            .await
            .map_err(|e| format!("Cohere API error: {}", e))?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("Cohere API error: {}", error_text).into());
        }

        let body: Value = response.json().await
            .map_err(|e| format!("Cohere JSON parse error: {}", e))?;

        let content = body["generations"][0]["text"]
            .as_str()
            .ok_or("Cohere response missing content")?;

        // Extraire les tokens pour Cohere
        let tokens_used = if let Some(meta) = body.get("meta") {
            if let Some(billed_units) = meta.get("billed_units") {
                let input_tokens = billed_units.get("input_tokens").and_then(|v| v.as_u64()).unwrap_or(0);
                let output_tokens = billed_units.get("output_tokens").and_then(|v| v.as_u64()).unwrap_or(0);
                let total_tokens = input_tokens + output_tokens;
                
                log::info!("[Cohere] Tokens utilis?s: input={}, output={}, total={}", 
                          input_tokens, output_tokens, total_tokens);
                
                total_tokens as u32
            } else {
                let estimated = (prompt.len() / 4).max(10) + (content.len() / 4).max(5);
                log::warn!("[Cohere] Pas d'info billed_units, estimation: {} tokens", estimated);
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
    async fn call_openai_multimodal(&self, model: &ModelConfig, prompt: &str, images: Option<&Vec<String>>) -> AppResult<(String, u32)> {
        let url = format!("{}/chat/completions", model.base_url);
        
        let mut content_parts: Vec<serde_json::Value> = vec![
            json!({
                "type": "text",
                "text": prompt
            })
        ];

        // Ajouter les images si pr?sentes
        if let Some(image_data) = images {
            for (i, image_base64) in image_data.iter().enumerate() {
                content_parts.push(json!({
                    "type": "image_url",
                    "image_url": {
                        "url": format!("data:image/jpeg;base64,{}", image_base64),
                        "detail": "high"
                    }
                }));
                log::info!("[OpenAI Multimodal] Image {} ajout?e (taille: {} bytes)", i + 1, image_base64.len());
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

        let response = self.http
            .post(&url)
            .header("Authorization", format!("Bearer {}", model.api_key))
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

        let body: Value = response.json().await
            .map_err(|e| format!("OpenAI multimodal JSON parse error: {}", e))?;

        let content = body["choices"][0]["message"]["content"]
            .as_str()
            .ok_or("OpenAI multimodal response missing content")?;

        // Extraire les tokens r?ellement consomm?s depuis la r?ponse OpenAI
        let tokens_used = if let Some(usage) = body.get("usage") {
            let prompt_tokens = usage.get("prompt_tokens").and_then(|v| v.as_u64()).unwrap_or(0);
            let completion_tokens = usage.get("completion_tokens").and_then(|v| v.as_u64()).unwrap_or(0);
            let total_tokens = usage.get("total_tokens").and_then(|v| v.as_u64()).unwrap_or(prompt_tokens + completion_tokens);
            
            log::info!("[OpenAI Multimodal] Tokens utilis?s: prompt={}, completion={}, total={}", 
                      prompt_tokens, completion_tokens, total_tokens);
            
            total_tokens as u32
        } else {
            // Estimation basique si pas d'info de usage
            let estimated = (prompt.len() / 4).max(10) + (content.len() / 4).max(5);
            log::warn!("[OpenAI Multimodal] Pas d'info usage, estimation: {} tokens", estimated);
            estimated as u32
        };

        Ok((content.to_string(), tokens_used))
    }

    /// ?? Appel Google Gemini Pro multimodal
    #[allow(dead_code)]
    async fn call_gemini_multimodal(&self, model: &ModelConfig, prompt: &str, images: Option<&Vec<String>>) -> AppResult<(String, u32)> {
        let url = format!("{}/models/{}:generateContent?key={}", 
            model.base_url, model.model, model.api_key);
        
        let mut request_body = json!({
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

        if let Some(image_urls) = images {
            request_body["contents"] = serde_json::json!([{
                "parts": [{
                    "text": image_urls.iter().map(|url| format!("Image URL: {}", url)).collect::<Vec<String>>().join("\n")
                }]
            }]);
        }

        let response = self.http
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

        let body: Value = response.json().await
            .map_err(|e| format!("Gemini multimodal JSON parse error: {}", e))?;

        let content = body["candidates"][0]["content"]["parts"][0]["text"]
            .as_str()
            .ok_or("Gemini multimodal response missing content")?;

        // Extraire les tokens pour Gemini
        let tokens_used = if let Some(usage) = body.get("usageMetadata") {
            let prompt_tokens = usage.get("promptTokenCount").and_then(|v| v.as_u64()).unwrap_or(0);
            let candidate_tokens = usage.get("candidatesTokenCount").and_then(|v| v.as_u64()).unwrap_or(0);
            let total_tokens = usage.get("totalTokenCount").and_then(|v| v.as_u64()).unwrap_or(prompt_tokens + candidate_tokens);
            
            log::info!("[Gemini Multimodal] Tokens utilis?s: prompt={}, candidates={}, total={}", 
                      prompt_tokens, candidate_tokens, total_tokens);
            
            total_tokens as u32
        } else {
            let estimated = (prompt.len() / 4).max(10) + (content.len() / 4).max(5);
            log::warn!("[Gemini Multimodal] Pas d'info usage, estimation: {} tokens", estimated);
            estimated as u32
        };

        Ok((content.to_string(), tokens_used))
    }

    /// ?? Appel Anthropic Claude multimodal
    #[allow(dead_code)]
    async fn call_anthropic_multimodal(&self, model: &ModelConfig, prompt: &str, images: Option<&Vec<String>>) -> AppResult<(String, u32)> {
        let url = format!("{}/messages", model.base_url);
        
        let mut messages: Vec<serde_json::Value> = vec![
            json!({
                "role": "user",
                "content": prompt
            })
        ];

        if let Some(image_urls) = images {
            messages.push(json!({
                "role": "user",
                "content": image_urls.iter().map(|url| format!("Image URL: {}", url)).collect::<Vec<String>>().join("\n")
            }));
        }

        let payload = json!({
            "model": model.model,
            "max_tokens": model.max_tokens,
            "temperature": model.temperature,
            "top_p": model.top_p,
            "messages": messages
        });

        let response = self.http
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

        let body: Value = response.json().await
            .map_err(|e| format!("Anthropic multimodal JSON parse error: {}", e))?;

        let content = body["content"][0]["text"]
            .as_str()
            .ok_or("Anthropic multimodal response missing content")?;

        // Extraire les tokens pour Anthropic
        let tokens_used = if let Some(usage) = body.get("usage") {
            let input_tokens = usage.get("input_tokens").and_then(|v| v.as_u64()).unwrap_or(0);
            let output_tokens = usage.get("output_tokens").and_then(|v| v.as_u64()).unwrap_or(0);
            let total_tokens = input_tokens + output_tokens;
            
            log::info!("[Anthropic Multimodal] Tokens utilis?s: input={}, output={}, total={}", 
                      input_tokens, output_tokens, total_tokens);
            
            total_tokens as u32
        } else {
            let estimated = (prompt.len() / 4).max(10) + (content.len() / 4).max(5);
            log::warn!("[Anthropic Multimodal] Pas d'info usage, estimation: {} tokens", estimated);
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
        let response_time = start_time.elapsed().unwrap().as_millis() as f64;
        
        let mut metrics = self.metrics.write().await;
        let model_metrics = metrics.entry(model_name.to_string()).or_insert_with(ModelMetrics::default);
        
        model_metrics.total_requests += 1;
        if success {
            model_metrics.successful_requests += 1;
        } else {
            model_metrics.failed_requests += 1;
        }
        
        // Calcul du temps de r?ponse moyen
        let total_time = model_metrics.average_response_time * (model_metrics.total_requests - 1) as f64 + response_time;
        model_metrics.average_response_time = total_time / model_metrics.total_requests as f64;
        
        model_metrics.last_used = Some(SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs());
        model_metrics.success_rate = model_metrics.successful_requests as f64 / model_metrics.total_requests as f64;
    }

    /// ?? Mise ? jour des m?triques de performance avec tokens
    async fn update_metrics_with_tokens(&self, model_name: &str, success: bool, start_time: SystemTime, tokens_used: u32) {
        let response_time = start_time.elapsed().unwrap().as_millis() as f64;
        
        let mut metrics = self.metrics.write().await;
        let model_metrics = metrics.entry(model_name.to_string()).or_insert_with(ModelMetrics::default);
        
        model_metrics.total_requests += 1;
        model_metrics.total_tokens_used += tokens_used as u64;
        
        if success {
            model_metrics.successful_requests += 1;
        } else {
            model_metrics.failed_requests += 1;
        }
        
        // Calcul de la moyenne du temps de r?ponse
        model_metrics.average_response_time = 
            (model_metrics.average_response_time * (model_metrics.total_requests - 1) as f64 + response_time) 
            / model_metrics.total_requests as f64;
        
        // Calcul du taux de succ?s
        model_metrics.success_rate = 
            model_metrics.successful_requests as f64 / model_metrics.total_requests as f64 * 100.0;
        
        // Mise ? jour de la derni?re utilisation
        model_metrics.last_used = Some(
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs()
        );
        
        log::info!(
            "[AppIA] M?triques mises ? jour pour {}: {} tokens, {}ms, {}% succ?s",
            model_name, tokens_used, response_time, model_metrics.success_rate
        );
    }

    /// ?? Enregistrement d'interaction pour apprentissage
    async fn record_interaction(&self, interaction_id: &str, prompt: &str, response: &str, model_name: &str) {
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
            if let Some(training_data) = training_queue.iter_mut()
                .find(|td| td.id == feedback.interaction_id) {
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
        log::info!("[AppIA] Feedback enregistr? via IAFeedbackService: {}", feedback.interaction_id);
        Ok(())
    }

    /// ?? G?n?ration de dataset pour fine-tuning
    pub async fn generate_training_dataset(&self, output_path: &str) -> AppResult<()> {
        let training_queue = self.training_data.lock().await;
        
        let high_quality_data: Vec<_> = training_queue.iter()
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

        fs::write(output_path, json_str)
            .map_err(|e| format!("Erreur ?criture dataset: {}", e))?;

        log::info!("[AppIA] Dataset g?n?r?: {} exemples de haute qualit?", formatted.len());
        Ok(())
    }

    /// ?? R?cup?ration des statistiques avanc?es
    pub async fn get_advanced_stats(&self) -> AppResult<Value> {
        let metrics = self.metrics.read().await;
        let training_queue = self.training_data.lock().await;
        let feedback_queue = self.feedback_queue.lock().await;

        let mut models_stats = serde_json::Map::new();
        for (name, metric) in metrics.iter() {
            models_stats.insert(name.clone(), json!({
                "total_requests": metric.total_requests,
                "success_rate": metric.success_rate,
                "average_response_time": metric.average_response_time,
                "total_cost": metric.total_cost,
                "last_used": metric.last_used
            }));
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
    pub async fn update_model_config(&self, model_name: &str, config: ModelConfig) -> AppResult<()> {
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

    /// ?? Hash du prompt pour le cache
    fn _hash_prompt(prompt: &str) -> String {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};
        
        let mut hasher = DefaultHasher::new();
        prompt.hash(&mut hasher);
        format!("{:x}", hasher.finish())
    }

    /// ?? Nettoyage des donn?es anciennes
    pub async fn cleanup_old_data(&self) -> AppResult<()> {
        let cutoff_time = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs() - (30 * 24 * 3600); // 30 jours
        
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
    async fn test_model_optimized(&self, model_name: &str, prompt: &str) -> AppResult<(String, u32, u32)> {
        let start_time = std::time::Instant::now();
        
        // ? OPTIMISATION : Timeout r?duit pour l'IA externe
        let timeout = Duration::from_secs(15); // R?duit de 20s ? 15s
        
        match tokio::time::timeout(timeout, async {
            match model_name {
                "openai-gpt4o" => {
                    let client = Client::new();
                    let api_key = std::env::var("OPENAI_API_KEY").unwrap_or_default();
                    
                    if api_key.is_empty() {
                        return Err("OPENAI_API_KEY non configur?e".into());
                    }
                    
                    let request_body = json!({
                        "model": "gpt-4o",
                        "messages": [{"role": "user", "content": prompt}],
                        "max_tokens": 1500, // R?duit pour plus de rapidit?
                        "temperature": 0.2, // R?duit pour plus de rapidit? et coh?rence
                        "stream": false
                    });
                    
                    let response = client
                        .post("https://api.openai.com/v1/chat/completions")
                        .header("Authorization", format!("Bearer {}", api_key))
                        .header("Content-Type", "application/json")
                        .json(&request_body)
                        .timeout(Duration::from_secs(10)) // Timeout HTTP r?duit
                        .send()
                        .await?;
                    
                    if response.status().is_success() {
                        let result: Value = response.json().await?;
                        if let Some(content) = result["choices"][0]["message"]["content"].as_str() {
                            let prompt_tokens = result["usage"]["prompt_tokens"].as_u64().unwrap_or(0) as u32;
                            let completion_tokens = result["usage"]["completion_tokens"].as_u64().unwrap_or(0) as u32;
                            let total_tokens = result["usage"]["total_tokens"].as_u64().unwrap_or(0) as u32;
                            
                            log::info!("[OpenAI] Tokens utilis?s: prompt={}, completion={}, total={}", prompt_tokens, completion_tokens, total_tokens);
                            
                            Ok((content.to_string(), total_tokens, start_time.elapsed().as_millis() as u32))
                        } else {
                            Err("R?ponse OpenAI invalide".into())
                        }
                    } else {
                        Err(format!("Erreur OpenAI: {}", response.status()).into())
                    }
                },
                _ => Err(format!("Mod?le {} non support?", model_name).into())
            }
        }).await {
            Ok(result) => result,
            Err(_) => {
                log::warn!("[AppIA] ? Timeout mod?le {} (15s)", model_name);
                Err(format!("Timeout mod?le {}", model_name).into())
            }
        }
    }
}
