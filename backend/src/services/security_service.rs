// backend/src/services/security_service.rs
// Service de s?curit? ultra-moderne pour Yukpo

use std::sync::Arc;
use serde_json::{Value, json};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::sync::RwLock;
use crate::core::types::AppResult;
use crate::models::input_model::MultiModalInput;
use regex::Regex;

/// ??? Configuration de s?curit? ultra-moderne
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityConfig {
    pub enable_content_safety: bool,
    pub enable_rate_limiting: bool,
    pub enable_threat_detection: bool,
    pub enable_input_validation: bool,
    pub enable_behavioral_analysis: bool,
    pub max_input_size: usize,
    pub max_files_per_request: usize,
    pub allowed_file_types: Vec<String>,
    pub blocked_patterns: Vec<String>,
    pub suspicious_keywords: Vec<String>,
    pub rate_limit_per_minute: u32,
    pub security_threshold: f64,
}

/// ?? Types de menaces d?tect?es
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ThreatType {
    ContentViolation,
    RateLimitExceeded,
    SuspiciousPattern,
    MaliciousInput,
    BehavioralAnomaly,
    FileTypeViolation,
    SizeViolation,
    InjectionAttempt,
}

/// ?? R?sultat d'analyse de s?curit?
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityAnalysis {
    pub is_safe: bool,
    pub threat_level: String, // "low", "medium", "high", "critical"
    pub detected_threats: Vec<ThreatType>,
    pub security_score: f64,
    pub content_safety_score: f64,
    pub behavioral_score: f64,
    pub recommendations: Vec<String>,
    pub blocked_reason: Option<String>,
    pub risk_factors: HashMap<String, f64>,
}

/// ??? Service de s?curit? ultra-moderne
pub struct SecurityService {
    config: SecurityConfig,
    rate_limit_cache: Arc<RwLock<HashMap<String, Vec<u64>>>>,
    threat_patterns: Arc<RwLock<Vec<Regex>>>,
    behavioral_patterns: Arc<RwLock<HashMap<String, Vec<u64>>>>,
    blocked_users: Arc<RwLock<HashMap<String, u64>>>,
}

impl SecurityService {
    pub fn new() -> Self {
        let config = SecurityConfig {
            enable_content_safety: true,
            enable_rate_limiting: true,
            enable_threat_detection: true,
            enable_input_validation: true,
            enable_behavioral_analysis: true,
            max_input_size: 500 * 1024 * 1024, // 500MB (augment? de 200MB)
            max_files_per_request: 10,
            allowed_file_types: vec![
                "image/jpeg".to_string(),
                "image/png".to_string(),
                "image/gif".to_string(),
                "image/webp".to_string(),
                "audio/mpeg".to_string(),
                "audio/wav".to_string(),
                "video/mp4".to_string(),
                "application/pdf".to_string(),
                "text/plain".to_string(),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet".to_string(),
            ],
            blocked_patterns: vec![
                r"<script.*?>.*?</script>".to_string(),
                r"javascript:".to_string(),
                r"data:text/html".to_string(),
                r"eval\(".to_string(),
                r"document\.write".to_string(),
                r"onload=".to_string(),
                r"onerror=".to_string(),
                r"onclick=".to_string(),
            ],
            suspicious_keywords: vec![
                "hack".to_string(),
                "exploit".to_string(),
                "inject".to_string(),
                "bypass".to_string(),
                "crack".to_string(),
                "steal".to_string(),
                "ddos".to_string(),
                "sqlmap".to_string(),
            ],
            rate_limit_per_minute: 100,
            security_threshold: 0.7,
        };

        let threat_patterns = config.blocked_patterns.iter()
            .map(|pattern| Regex::new(pattern).unwrap())
            .collect();

        Self {
            config,
            rate_limit_cache: Arc::new(RwLock::new(HashMap::new())),
            threat_patterns: Arc::new(RwLock::new(threat_patterns)),
            behavioral_patterns: Arc::new(RwLock::new(HashMap::new())),
            blocked_users: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// ?? Analyse de s?curit? compl?te d'un input
    pub async fn analyze_input_security(
        &self,
        input: &MultiModalInput,
        user_id: Option<i32>,
        user_ip: &str,
    ) -> AppResult<SecurityAnalysis> {
        let mut threats = Vec::new();
        let mut risk_factors = HashMap::new();
        let mut recommendations = Vec::new();

        // 1. Validation de base
        if let Err(e) = self.validate_basic_input(input) {
            threats.push(ThreatType::ContentViolation);
            risk_factors.insert("input_validation".to_string(), 1.0);
            return Ok(SecurityAnalysis {
                is_safe: false,
                threat_level: "high".to_string(),
                detected_threats: threats,
                security_score: 0.0,
                content_safety_score: 0.0,
                behavioral_score: 0.0,
                recommendations: vec![e.to_string()],
                blocked_reason: Some(e.to_string()),
                risk_factors,
            });
        }

        // 2. Analyse de contenu textuel
        if let Some(texte) = &input.texte {
            let text_analysis = self.analyze_text_content(texte).await;
            if !text_analysis.is_safe {
                threats.extend(text_analysis.detected_threats);
                risk_factors.extend(text_analysis.risk_factors);
                recommendations.extend(text_analysis.recommendations);
            }
        }

        // 3. Analyse des fichiers
        let file_analysis = self.analyze_file_security(input).await;
        if !file_analysis.is_safe {
            threats.extend(file_analysis.detected_threats);
            risk_factors.extend(file_analysis.risk_factors);
            recommendations.extend(file_analysis.recommendations);
        }

        // 4. Rate limiting
        if self.config.enable_rate_limiting {
            if let Err(e) = self.check_rate_limit(user_ip).await {
                threats.push(ThreatType::RateLimitExceeded);
                risk_factors.insert("rate_limit".to_string(), 1.0);
                recommendations.push(e.to_string());
            }
        }

        // 5. Analyse comportementale
        if self.config.enable_behavioral_analysis {
            let behavioral_analysis = self.analyze_behavioral_patterns(user_id, user_ip).await;
            if !behavioral_analysis.is_safe {
                threats.extend(behavioral_analysis.detected_threats);
                risk_factors.extend(behavioral_analysis.risk_factors);
                recommendations.extend(behavioral_analysis.recommendations);
            }
        }

        // 6. Calcul du score de s?curit? global
        let security_score = self.calculate_security_score(&risk_factors);
        let content_safety_score = self.calculate_content_safety_score(&threats);
        let behavioral_score = self.calculate_behavioral_score(&risk_factors);

        let threat_level = if security_score >= 0.9 {
            "low".to_string()
        } else if security_score >= 0.7 {
            "medium".to_string()
        } else if security_score >= 0.5 {
            "high".to_string()
        } else {
            "critical".to_string()
        };

        let is_safe = security_score >= self.config.security_threshold && threats.is_empty();

        Ok(SecurityAnalysis {
            is_safe,
            threat_level,
            detected_threats: threats,
            security_score,
            content_safety_score,
            behavioral_score,
            recommendations,
            blocked_reason: if is_safe { None } else { Some("Contenu non conforme aux politiques de s?curit?".to_string()) },
            risk_factors,
        })
    }

    /// ? Validation de base des inputs
    fn validate_basic_input(&self, input: &MultiModalInput) -> AppResult<()> {
        // V?rification de la taille totale
        let total_size = self.calculate_input_size(input);
        if total_size > self.config.max_input_size {
            return Err(format!("Taille d'input d?pass?e: {} bytes (max: {})", total_size, self.config.max_input_size).into());
        }

        // V?rification du nombre de fichiers
        let file_count = self.count_files(input);
        if file_count > self.config.max_files_per_request {
            return Err(format!("Nombre de fichiers d?pass?: {} (max: {})", file_count, self.config.max_files_per_request).into());
        }

        Ok(())
    }

    /// ?? Analyse de contenu textuel
    async fn analyze_text_content(&self, text: &str) -> SecurityAnalysis {
        let mut threats = Vec::new();
        let mut risk_factors = HashMap::new();
        let mut recommendations = Vec::new();

        // V?rification des patterns malveillants
        let patterns = self.threat_patterns.read().await;
        for pattern in patterns.iter() {
            if pattern.is_match(text) {
                threats.push(ThreatType::SuspiciousPattern);
                risk_factors.insert("malicious_pattern".to_string(), 0.8);
                recommendations.push("Contenu contient des patterns suspects".to_string());
            }
        }

        // V?rification des mots-cl?s suspects
        let lower_text = text.to_lowercase();
        for keyword in &self.config.suspicious_keywords {
            if lower_text.contains(keyword) {
                threats.push(ThreatType::SuspiciousPattern);
                risk_factors.insert("suspicious_keyword".to_string(), 0.6);
                recommendations.push(format!("Mot-cl? suspect d?tect?: {}", keyword));
            }
        }

        // V?rification des tentatives d'injection
        if self.detect_injection_attempts(text) {
            threats.push(ThreatType::InjectionAttempt);
            risk_factors.insert("injection_attempt".to_string(), 0.9);
            recommendations.push("Tentative d'injection d?tect?e".to_string());
        }

        let security_score = if threats.is_empty() { 0.9 } else { 0.3 };
        let content_safety_score = if threats.is_empty() { 0.9 } else { 0.2 };

        SecurityAnalysis {
            is_safe: threats.is_empty(),
            threat_level: if threats.is_empty() { "low".to_string() } else { "high".to_string() },
            detected_threats: threats,
            security_score,
            content_safety_score,
            behavioral_score: 0.8,
            recommendations,
            blocked_reason: None,
            risk_factors,
        }
    }

    /// ?? Analyse de s?curit? des fichiers
    async fn analyze_file_security(&self, input: &MultiModalInput) -> SecurityAnalysis {
        let mut threats = Vec::new();
        let mut risk_factors = HashMap::new();
        let mut recommendations = Vec::new();

        // Analyse des images
        if let Some(images) = &input.base64_image {
            for (idx, image) in images.iter().enumerate() {
                if let Err(e) = self.validate_file_type(image, "image") {
                    threats.push(ThreatType::FileTypeViolation);
                    risk_factors.insert(format!("file_type_violation_{}", idx), 0.7);
                    recommendations.push(format!("Image {}: {}", idx + 1, e));
                }
            }
        }

        // Analyse des documents
        if let Some(docs) = &input.doc_base64 {
            for (idx, doc) in docs.iter().enumerate() {
                if let Err(e) = self.validate_file_type(doc, "document") {
                    threats.push(ThreatType::FileTypeViolation);
                    risk_factors.insert(format!("file_type_violation_{}", idx), 0.7);
                    recommendations.push(format!("Document {}: {}", idx + 1, e));
                }
            }
        }

        let security_score = if threats.is_empty() { 0.9 } else { 0.4 };

        SecurityAnalysis {
            is_safe: threats.is_empty(),
            threat_level: if threats.is_empty() { "low".to_string() } else { "medium".to_string() },
            detected_threats: threats,
            security_score,
            content_safety_score: 0.8,
            behavioral_score: 0.8,
            recommendations,
            blocked_reason: None,
            risk_factors,
        }
    }

    /// ?? V?rification du rate limiting
    async fn check_rate_limit(&self, user_ip: &str) -> AppResult<()> {
        let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();
        let window_start = now - 60; // Fen?tre de 1 minute

        let mut cache = self.rate_limit_cache.write().await;
        let user_requests = cache.entry(user_ip.to_string()).or_insert_with(Vec::new);

        // Nettoyer les anciennes requ?tes
        user_requests.retain(|&timestamp| timestamp >= window_start);

        // V?rifier la limite
        if user_requests.len() >= self.config.rate_limit_per_minute as usize {
            return Err("Limite de requ?tes d?pass?e".into());
        }

        // Ajouter la requ?te actuelle
        user_requests.push(now);

        Ok(())
    }

    /// ?? Analyse comportementale
    async fn analyze_behavioral_patterns(
        &self,
        _user_id: Option<i32>,
        user_ip: &str,
    ) -> SecurityAnalysis {
        let mut threats = Vec::new();
        let mut risk_factors = HashMap::new();
        let mut recommendations = Vec::new();

        // V?rifier si l'utilisateur est bloqu?
        let blocked_users = self.blocked_users.read().await;
        if let Some(blocked_until) = blocked_users.get(user_ip) {
            let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();
            if now < *blocked_until {
                threats.push(ThreatType::BehavioralAnomaly);
                risk_factors.insert("user_blocked".to_string(), 1.0);
                recommendations.push("Utilisateur temporairement bloqu?".to_string());
            }
        }

        // Analyser les patterns de comportement
        let behavioral_patterns = self.behavioral_patterns.read().await;
        if let Some(patterns) = behavioral_patterns.get(user_ip) {
            let recent_patterns = patterns.iter()
                .filter(|&&timestamp| {
                    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();
                    now - timestamp < 3600 // Derni?re heure
                })
                .count();

            if recent_patterns > 50 {
                threats.push(ThreatType::BehavioralAnomaly);
                risk_factors.insert("high_activity".to_string(), 0.6);
                recommendations.push("Activit? anormalement ?lev?e d?tect?e".to_string());
            }
        }

        let security_score = if threats.is_empty() { 0.8 } else { 0.4 };

        SecurityAnalysis {
            is_safe: threats.is_empty(),
            threat_level: if threats.is_empty() { "low".to_string() } else { "medium".to_string() },
            detected_threats: threats.clone(),
            security_score,
            content_safety_score: 0.8,
            behavioral_score: if threats.is_empty() { 0.8 } else { 0.3 },
            recommendations,
            blocked_reason: None,
            risk_factors,
        }
    }

    /// ?? Calcul du score de s?curit? global
    fn calculate_security_score(&self, risk_factors: &HashMap<String, f64>) -> f64 {
        if risk_factors.is_empty() {
            return 1.0;
        }

        let total_risk: f64 = risk_factors.values().sum();
        let max_risk = risk_factors.len() as f64;
        
        (max_risk - total_risk) / max_risk
    }

    /// ?? Calcul du score de s?curit? du contenu
    fn calculate_content_safety_score(&self, threats: &[ThreatType]) -> f64 {
        if threats.is_empty() {
            return 1.0;
        }

        let content_threats = threats.iter()
            .filter(|t| matches!(t, ThreatType::ContentViolation | ThreatType::SuspiciousPattern | ThreatType::InjectionAttempt))
            .count();

        1.0 - (content_threats as f64 * 0.3)
    }

    /// ?? Calcul du score comportemental
    fn calculate_behavioral_score(&self, risk_factors: &HashMap<String, f64>) -> f64 {
        let behavioral_risks = risk_factors.iter()
            .filter(|(key, _)| key.contains("behavioral") || key.contains("rate_limit") || key.contains("user_blocked"))
            .map(|(_, &value)| value)
            .sum::<f64>();

        if behavioral_risks == 0.0 {
            return 1.0;
        }

        1.0 - behavioral_risks.min(1.0)
    }

    /// ?? Calcul de la taille totale de l'input
    fn calculate_input_size(&self, input: &MultiModalInput) -> usize {
        let mut total_size = 0;

        if let Some(text) = &input.texte {
            total_size += text.len();
        }

        if let Some(images) = &input.base64_image {
            for image in images {
                total_size += image.len();
            }
        }

        if let Some(audio) = &input.audio_base64 {
            for audio_data in audio {
                total_size += audio_data.len();
            }
        }

        if let Some(video) = &input.video_base64 {
            for video_data in video {
                total_size += video_data.len();
            }
        }

        if let Some(docs) = &input.doc_base64 {
            for doc in docs {
                total_size += doc.len();
            }
        }

        if let Some(excel) = &input.excel_base64 {
            for excel_data in excel {
                total_size += excel_data.len();
            }
        }

        total_size
    }

    /// ?? Comptage du nombre de fichiers
    fn count_files(&self, input: &MultiModalInput) -> usize {
        let mut count = 0;

        if let Some(images) = &input.base64_image {
            count += images.len();
        }

        if let Some(audio) = &input.audio_base64 {
            count += audio.len();
        }

        if let Some(video) = &input.video_base64 {
            count += video.len();
        }

        if let Some(docs) = &input.doc_base64 {
            count += docs.len();
        }

        if let Some(excel) = &input.excel_base64 {
            count += excel.len();
        }

        count
    }

    /// ?? D?tection des tentatives d'injection
    fn detect_injection_attempts(&self, text: &str) -> bool {
        let injection_patterns = vec![
            r"'.*OR.*1=1",
            r"'.*AND.*1=1",
            r"<script",
            r"javascript:",
            r"data:text/html",
            r"vbscript:",
            r"onload=",
            r"onerror=",
            r"onclick=",
        ];

        for pattern in injection_patterns {
            if let Ok(regex) = Regex::new(pattern) {
                if regex.is_match(&text.to_lowercase()) {
                    return true;
                }
            }
        }

        false
    }

    /// ? Validation du type de fichier
    fn validate_file_type(&self, file_data: &str, _file_category: &str) -> AppResult<()> {
        // V?rification du header base64
        if !file_data.starts_with("data:") {
            return Err("Format de fichier invalide".into());
        }

        // Extraction du type MIME
        if let Some(mime_type) = file_data.split(';').next() {
            let mime_type = mime_type.replace("data:", "");
            
            if !self.config.allowed_file_types.contains(&mime_type) {
                return Err(format!("Type de fichier non autoris?: {}", mime_type).into());
            }
        } else {
            return Err("Type MIME non d?tect?".into());
        }

        Ok(())
    }

    /// ?? Bloquer un utilisateur temporairement
    pub async fn block_user(&self, user_ip: &str, duration_seconds: u64) {
        let mut blocked_users = self.blocked_users.write().await;
        let block_until = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs() + duration_seconds;
        blocked_users.insert(user_ip.to_string(), block_until);
    }

    /// ?? Obtenir les statistiques de s?curit?
    pub async fn get_security_stats(&self) -> Value {
        let rate_limit_cache = self.rate_limit_cache.read().await;
        let blocked_users = self.blocked_users.read().await;
        let behavioral_patterns = self.behavioral_patterns.read().await;

        json!({
            "active_rate_limits": rate_limit_cache.len(),
            "blocked_users": blocked_users.len(),
            "tracked_behavioral_patterns": behavioral_patterns.len(),
            "security_config": self.config,
        })
    }
} 
