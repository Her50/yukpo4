// ✅ Tests unitaires pour EmploiAIService

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;
    use yukpomnang_backend::services::app_ia::AppIA;
    use yukpomnang_backend::services::emploi_ai_service::EmploiAIService;

    #[tokio::test]
    #[ignore] // Ignorer par défaut car nécessite AppIA configuré
    async fn test_generate_improved_matching() {
        // TODO: Implémenter test avec mock AppIA
    }

    #[tokio::test]
    #[ignore]
    async fn test_analyze_cv() {
        // TODO: Implémenter test avec mock AppIA
    }

    #[tokio::test]
    #[ignore]
    async fn test_predict_salary() {
        // TODO: Implémenter test avec mock AppIA
    }
}
