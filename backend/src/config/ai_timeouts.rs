//! ✅ Configuration des timeouts IA adaptatifs
//!
//! Timeouts optimisés selon le type de requête IA pour équilibrer
//! performance et qualité des réponses.

use std::time::Duration;

/// Type de requête IA pour déterminer le timeout approprié
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AIRequestType {
    /// Recommandations simples (livres, programmes) - rapide
    SimpleRecommendation,
    /// Analyses complexes (profil, CV) - plus long
    ComplexAnalysis,
    /// Comparaisons multiples - très long
    MultipleComparison,
    /// Prédictions (salaire, prix) - moyen
    Prediction,
    /// Matching intelligent - moyen
    IntelligentMatching,
    /// Génération de contenu - long
    ContentGeneration,
    /// Requête standard - par défaut
    Standard,
}

impl AIRequestType {
    /// Obtient le timeout recommandé pour ce type de requête
    pub fn get_timeout(&self) -> Duration {
        match self {
            AIRequestType::SimpleRecommendation => Duration::from_secs(25),
            AIRequestType::ComplexAnalysis => Duration::from_secs(45),
            AIRequestType::MultipleComparison => Duration::from_secs(60),
            AIRequestType::Prediction => Duration::from_secs(30),
            AIRequestType::IntelligentMatching => Duration::from_secs(35),
            AIRequestType::ContentGeneration => Duration::from_secs(50),
            AIRequestType::Standard => Duration::from_secs(40),
        }
    }

    /// Obtient le timeout depuis les variables d'environnement ou utilise la valeur par défaut
    pub fn get_timeout_from_env(&self) -> Duration {
        let env_key = match self {
            AIRequestType::SimpleRecommendation => "AI_TIMEOUT_SIMPLE",
            AIRequestType::ComplexAnalysis => "AI_TIMEOUT_COMPLEX",
            AIRequestType::MultipleComparison => "AI_TIMEOUT_COMPARISON",
            AIRequestType::Prediction => "AI_TIMEOUT_PREDICTION",
            AIRequestType::IntelligentMatching => "AI_TIMEOUT_MATCHING",
            AIRequestType::ContentGeneration => "AI_TIMEOUT_GENERATION",
            AIRequestType::Standard => "AI_TIMEOUT",
        };

        if let Ok(timeout_secs) = std::env::var(env_key) {
            if let Ok(secs) = timeout_secs.parse::<u64>() {
                return Duration::from_secs(secs);
            }
        }

        self.get_timeout()
    }
}

/// Configuration centralisée des timeouts IA
pub struct AITimeoutConfig;

impl AITimeoutConfig {
    /// Obtient le timeout pour un type de requête spécifique
    pub fn get_timeout(request_type: AIRequestType) -> Duration {
        request_type.get_timeout_from_env()
    }

    /// Obtient le timeout depuis la configuration globale
    pub fn get_global_timeout() -> Duration {
        std::env::var("AI_TIMEOUT")
            .ok()
            .and_then(|v| v.parse().ok())
            .map(Duration::from_secs)
            .unwrap_or_else(|| Duration::from_secs(60))
    }

    /// Obtient le timeout pour les requêtes multimodales
    pub fn get_multimodal_timeout() -> Duration {
        std::env::var("AI_TIMEOUT_MULTIMODAL")
            .ok()
            .and_then(|v| v.parse().ok())
            .map(Duration::from_secs)
            .unwrap_or_else(|| Duration::from_secs(60))
    }
}
