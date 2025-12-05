// ✅ Tests unitaires pour BookExchangeAIService

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::app_ia::AppIA;
    use crate::services::book_exchange_ai_service::BookExchangeAIService;
    use std::sync::Arc;

    // Note: Ces tests nécessitent une instance AppIA configurée
    // Pour les tests d'intégration, utiliser un mock ou une instance de test

    #[tokio::test]
    #[ignore] // Ignorer par défaut car nécessite AppIA configuré
    async fn test_generate_book_recommendations() {
        // TODO: Implémenter test avec mock AppIA
        // let app_ia = Arc::new(AppIA::new(...));
        // let service = BookExchangeAIService::new(app_ia);
        // let result = service.generate_book_recommendations(
        //     "6ème", "5ème", "Mathématiques", Some("Collège"), Some("Douala")
        // ).await;
        // assert!(result.is_ok());
    }

    #[tokio::test]
    #[ignore]
    async fn test_generate_book_matching() {
        // TODO: Implémenter test avec mock AppIA
    }

    #[tokio::test]
    #[ignore]
    async fn test_generate_price_suggestions() {
        // TODO: Implémenter test avec mock AppIA
    }
}
