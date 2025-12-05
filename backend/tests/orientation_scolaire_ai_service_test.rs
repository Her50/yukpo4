// ✅ Tests unitaires pour OrientationScolaireAIService

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::app_ia::AppIA;
    use crate::services::orientation_scolaire_ai_service::OrientationScolaireAIService;
    use std::sync::Arc;

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
