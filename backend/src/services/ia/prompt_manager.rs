use crate::core::types::AppResult;
use std::collections::HashMap;
use tokio::fs;

#[derive(Clone)]
/// Gestionnaire de prompts optimis? pour Yukpo
pub struct PromptManager {
    prompts: HashMap<String, String>,
}

impl PromptManager {
    /// Cr?e un nouveau gestionnaire de prompts
    pub async fn new() -> AppResult<Self> {
        let mut prompts = HashMap::new();

        // Charger tous les prompts sp?cifiques
        prompts.insert(
            "intention_detection".to_string(),
            fs::read_to_string("src/services/ia/prompts/intention_detection.md")
                .await
                .map_err(|e| format!("Erreur lecture prompt d?tection: {}", e))?,
        );

        prompts.insert(
            "creation_service".to_string(),
            fs::read_to_string("ia_prompts/creation_service_prompt.md")
                .await
                .map_err(|e| format!("Erreur lecture prompt creation_service: {}", e))?,
        );

        prompts.insert(
            "recherche_besoin".to_string(),
            fs::read_to_string("ia_prompts/recherche_service_prompt.md")
                .await
                .map_err(|e| format!("Erreur lecture prompt recherche_besoin: {}", e))?,
        );

        prompts.insert(
            "echange".to_string(),
            fs::read_to_string("ia_prompts/echange_prompt.md")
                .await
                .map_err(|e| format!("Erreur lecture prompt echange: {}", e))?,
        );

        prompts.insert(
            "assistance_generale".to_string(),
            fs::read_to_string("ia_prompts/assistance_generale_prompt.md")
                .await
                .map_err(|e| format!("Erreur lecture prompt assistance_generale: {}", e))?,
        );

        // ✅ NOUVEAU: Prompt pour création d'offre d'emploi
        prompts.insert(
            "creation_offre_emploi".to_string(),
            fs::read_to_string("ia_prompts/creation_offre_emploi_prompt.md")
                .await
                .map_err(|e| format!("Erreur lecture prompt creation_offre_emploi: {}", e))?,
        );

        // ✅ NOUVEAU 2026-03-14: Prompt pour classification d'équivalence produits (comparaison prix supermarché)
        prompts.insert(
            "comparaison_prix_equivalence".to_string(),
            fs::read_to_string("ia_prompts/comparaison_prix_equivalence_prompt.md")
                .await
                .map_err(|e| {
                    format!("Erreur lecture prompt comparaison_prix_equivalence: {}", e)
                })?,
        );

        Ok(Self { prompts })
    }

    /// Convertit un code de langue en nom lisible pour l'IA
    fn language_name(lang_code: Option<&str>) -> &str {
        match lang_code.unwrap_or("fr") {
            "en" => "English",
            "es" => "Español",
            "de" => "Deutsch",
            "pt" => "Português",
            "ar" => "العربية",
            "zh" => "中文",
            "ja" => "日本語",
            "hi" => "हिन्दी",
            "ru" => "Русский",
            "sw" => "Kiswahili",
            "wo" => "Wolof",
            "ha" => "Hausa",
            "yo" => "Yorùbá",
            "ig" => "Igbo",
            "ln" => "Lingála",
            "rw" => "Kinyarwanda",
            "ff" => "Fulfulde",
            "sn" => "chiShona",
            "so" => "Soomaali",
            "am" => "አማርኛ",
            "ti" => "ትግርኛ",
            "mg" => "Malagasy",
            "zu" => "isiZulu",
            "ht" => "Kreyòl ayisyen",
            "pap" => "Papiamentu",
            _ => "Français",
        }
    }

    /// Applique les remplacements standard (user_input + language)
    fn apply_replacements(prompt: &str, user_input: &str, language: Option<&str>) -> String {
        prompt
            .replace("{user_input}", user_input)
            .replace("{language}", Self::language_name(language))
    }

    /// Obtient le prompt de d?tection d'intention
    pub fn get_intention_detection_prompt(&self, user_input: &str) -> String {
        let prompt = self
            .prompts
            .get("intention_detection")
            .expect("Prompt de d?tection d'intention manquant");

        Self::apply_replacements(prompt, user_input, None)
    }

    /// Obtient le prompt sp?cifique pour une intention (avec langue optionnelle)
    pub fn get_intention_prompt(&self, intention: &str, user_input: &str) -> Option<String> {
        self.get_intention_prompt_with_lang(intention, user_input, None)
    }

    /// Obtient le prompt sp?cifique pour une intention avec langue
    pub fn get_intention_prompt_with_lang(
        &self,
        intention: &str,
        user_input: &str,
        language: Option<&str>,
    ) -> Option<String> {
        self.prompts
            .get(intention)
            .map(|prompt| Self::apply_replacements(prompt, user_input, language))
    }

    /// Obtient le prompt optimis? pour une intention
    pub async fn get_optimized_prompt(&self, intention: &str, user_input: &str) -> String {
        self.get_optimized_prompt_with_lang(intention, user_input, None).await
    }

    /// Obtient le prompt optimis? pour une intention avec langue
    pub async fn get_optimized_prompt_with_lang(
        &self,
        intention: &str,
        user_input: &str,
        language: Option<&str>,
    ) -> String {
        self.get_intention_prompt_with_lang(intention, user_input, language)
            .unwrap_or_else(|| {
                // Fallback vers le prompt g?n?ral si l'intention n'est pas trouv?e
                self.prompts
                    .get("assistance_generale")
                    .map(|p| Self::apply_replacements(p, user_input, language))
                    .unwrap_or_else(|| format!("Question: {}", user_input))
            })
    }

    /// ✅ NOUVEAU 2026-03-14: Obtient le prompt de classification d'équivalence pour comparaison de prix
    pub fn get_price_comparison_equivalence_prompt(&self, user_input: &str) -> Option<String> {
        self.prompts
            .get("comparaison_prix_equivalence")
            .map(|prompt| Self::apply_replacements(prompt, user_input, None))
    }

    /// Liste toutes les intentions support?es
    pub fn get_supported_intentions(&self) -> Vec<String> {
        self.prompts.keys().filter(|k| *k != "intention_detection").cloned().collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_prompt_manager_creation() {
        let manager = PromptManager::new().await;
        assert!(manager.is_ok());
    }

    #[tokio::test]
    async fn test_intention_detection_prompt() {
        let manager = PromptManager::new().await.unwrap();
        let prompt = manager.get_intention_detection_prompt("Je vends des v?tements");
        assert!(prompt.contains("Je vends des v?tements"));
        assert!(prompt.contains("creation_service"));
    }

    #[tokio::test]
    async fn test_intention_specific_prompt() {
        let manager = PromptManager::new().await.unwrap();
        let prompt = manager.get_intention_prompt("creation_service", "Je vends des v?tements");
        assert!(prompt.is_some());
        let prompt = prompt.unwrap();
        assert!(prompt.contains("Je vends des v?tements"));
        assert!(prompt.contains("creation_service"));
    }
}
