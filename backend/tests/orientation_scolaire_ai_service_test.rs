// ✅ Tests unitaires pour OrientationScolaireAIService

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;
    use yukpomnang_backend::services::app_ia::AppIA;
    use yukpomnang_backend::services::orientation_scolaire_ai_service::OrientationScolaireAIService;

    #[tokio::test]
    #[ignore] // Ignorer par défaut car nécessite AppIA configuré
    async fn test_analyze_student_profile() {
        // TODO: Implémenter test avec mock AppIA
    }

    #[tokio::test]
    #[ignore]
    async fn test_generate_program_recommendations() {
        // TODO: Implémenter test avec mock AppIA
    }

    #[tokio::test]
    #[ignore]
    async fn test_compare_programs() {
        // TODO: Implémenter test avec mock AppIA
    }
}
