// backend/src/services/ia_feedback_service.rs
// Service de feedback IA avanc? pour apprentissage autonome

use crate::core::types::{AppResult};
use crate::services::mongo_history_service::MongoHistoryService;
use serde_json::Value;
use std::sync::Arc;
use serde::{Deserialize, Serialize};

/// ?? Types de feedback utilisateur
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FeedbackType {
    Rating(u8), // 1-5
    ThumbsUp,
    ThumbsDown,
    Detailed(String), // Feedback textuel d?taill?
    Correction(Value), // Correction du JSON g?n?r?
    Suggestion(String), // Suggestion d'am?lioration
}

/// ?? M?triques de feedback avanc?es
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FeedbackMetrics {
    pub total_feedback: u64,
    pub positive_feedback: u64,
    pub negative_feedback: u64,
    pub average_rating: f64,
    pub feedback_distribution: std::collections::HashMap<u8, u64>,
    pub improvement_suggestions: Vec<String>,
    pub common_issues: Vec<String>,
    pub user_satisfaction_trend: Vec<f64>,
}

/// ?? Service de feedback IA avanc?
pub struct IAFeedbackService {
    mongo_history: Arc<MongoHistoryService>,
    metrics_cache: Arc<tokio::sync::RwLock<FeedbackMetrics>>,
}

impl IAFeedbackService {
    pub fn new(mongo_history: Arc<MongoHistoryService>) -> Self {
        Self {
            mongo_history,
            metrics_cache: Arc::new(tokio::sync::RwLock::new(FeedbackMetrics {
                total_feedback: 0,
                positive_feedback: 0,
                negative_feedback: 0,
                average_rating: 0.0,
                feedback_distribution: std::collections::HashMap::new(),
                improvement_suggestions: Vec::new(),
                common_issues: Vec::new(),
                user_satisfaction_trend: Vec::new(),
            })),
        }
    }

    /// ?? Enregistrer un feedback utilisateur
    pub async fn record_feedback(
        &self,
        interaction_id: &str,
        user_id: Option<i32>,
        prompt: &str,
        response: &str,
        model_used: &str,
        feedback_type: FeedbackType,
        context: Value,
    ) -> AppResult<()> {
        let (rating, feedback_text) = match feedback_type {
            FeedbackType::Rating(r) => (r, None),
            FeedbackType::ThumbsUp => (5, Some("?? Excellent".to_string())),
            FeedbackType::ThumbsDown => (1, Some("?? Insatisfaisant".to_string())),
            FeedbackType::Detailed(text) => (3, Some(text)),
            FeedbackType::Correction(correction) => {
                (2, Some(format!("Correction sugg?r?e: {}", serde_json::to_string(&correction)?)))
            }
            FeedbackType::Suggestion(suggestion) => (4, Some(format!("Suggestion: {}", suggestion))),
        };

        // Enregistrer dans MongoDB
        self.mongo_history
            .log_feedback(
                user_id.unwrap_or_default(),
                interaction_id,
                prompt,
                response,
                model_used,
                rating,
                feedback_text.as_deref(),
                Some(context.clone()),
            )
            .await?;

        // Mettre ? jour les m?triques (en m?moire)
        self.update_metrics(rating, &feedback_text).await?;

        Ok(())
    }

    /// ?? Mettre ? jour les m?triques de feedback (en m?moire)
    async fn update_metrics(&self, rating: u8, feedback_text: &Option<String>) -> AppResult<()> {
        let mut metrics = self.metrics_cache.write().await;
        metrics.total_feedback += 1;
        if rating >= 4 {
            metrics.positive_feedback += 1;
        } else if rating <= 2 {
            metrics.negative_feedback += 1;
        }
        *metrics.feedback_distribution.entry(rating).or_insert(0) += 1;
        let total_rating: u64 = metrics.feedback_distribution.iter()
            .map(|(rating, count)| (*rating as u64) * count)
            .sum();
        metrics.average_rating = total_rating as f64 / metrics.total_feedback as f64;
        let avg_rating = metrics.average_rating;
        metrics.user_satisfaction_trend.push(avg_rating);
        if metrics.user_satisfaction_trend.len() > 100 {
            metrics.user_satisfaction_trend.remove(0);
        }
        // Suggestions et probl?mes
        if let Some(text) = feedback_text {
            if rating <= 2 {
                let issues = self.extract_common_issues(text);
                for issue in issues {
                    if !metrics.common_issues.contains(&issue) {
                        metrics.common_issues.push(issue);
                    }
                }
            }
            if rating >= 4 {
                let suggestions = self.extract_improvement_suggestions(text);
                for suggestion in suggestions {
                    if !metrics.improvement_suggestions.contains(&suggestion) {
                        metrics.improvement_suggestions.push(suggestion);
                    }
                }
            }
        }
        Ok(())
    }

    fn extract_common_issues(&self, feedback_text: &str) -> Vec<String> {
        let mut issues = Vec::new();
        let text = feedback_text.to_lowercase();
        if text.contains("erreur") || text.contains("error") {
            issues.push("Erreurs de g?n?ration".to_string());
        }
        if text.contains("incomplet") || text.contains("incomplete") {
            issues.push("R?ponses incompl?tes".to_string());
        }
        if text.contains("confus") || text.contains("confusing") {
            issues.push("R?ponses confuses".to_string());
        }
        if text.contains("lent") || text.contains("slow") {
            issues.push("Lenteur de r?ponse".to_string());
        }
        if text.contains("hors sujet") || text.contains("off topic") {
            issues.push("R?ponses hors sujet".to_string());
        }
        issues
    }

    fn extract_improvement_suggestions(&self, feedback_text: &str) -> Vec<String> {
        let mut suggestions = Vec::new();
        let text = feedback_text.to_lowercase();
        if text.contains("plus de d?tails") || text.contains("more details") {
            suggestions.push("Ajouter plus de d?tails".to_string());
        }
        if text.contains("plus rapide") || text.contains("faster") {
            suggestions.push("Am?liorer la vitesse".to_string());
        }
        if text.contains("plus pr?cis") || text.contains("more accurate") {
            suggestions.push("Am?liorer la pr?cision".to_string());
        }
        if text.contains("plus simple") || text.contains("simpler") {
            suggestions.push("Simplifier les r?ponses".to_string());
        }
        suggestions
    }

    /// ?? R?cup?rer les m?triques de feedback (en m?moire)
    pub async fn get_feedback_metrics(&self) -> AppResult<FeedbackMetrics> {
        let metrics = self.metrics_cache.read().await.clone();
        Ok(metrics)
    }

    /// ?? R?cup?rer les statistiques de feedback (Mongo)
    pub async fn get_feedback_stats(&self, model_used: Option<&str>) -> AppResult<Value> {
        self.mongo_history.get_feedback_stats(model_used).await
    }

    /// ?? Nettoyer les anciens feedbacks (Mongo)
    pub async fn cleanup_old_feedback(&self, days_old: i64) -> AppResult<u64> {
        self.mongo_history.cleanup_old_events(days_old).await
    }
} 
