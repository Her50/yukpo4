use std::collections::HashMap;
use tokio::fs;
use crate::core::types::AppResult;

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
            fs::read_to_string("src/services/ia/prompts/intention_detection.md").await
                .map_err(|e| format!("Erreur lecture prompt d?tection: {}", e))?,
        );
        
        prompts.insert(
            "creation_service".to_string(),
            fs::read_to_string("ia_prompts/creation_service_prompt.md").await
                .map_err(|e| format!("Erreur lecture prompt creation_service: {}", e))?,
        );
        
        prompts.insert(
            "recherche_besoin".to_string(),
            fs::read_to_string("ia_prompts/recherche_service_prompt.md").await
                .map_err(|e| format!("Erreur lecture prompt recherche_besoin: {}", e))?,
        );
        
        prompts.insert(
            "echange".to_string(),
            fs::read_to_string("ia_prompts/echange_prompt.md").await
                .map_err(|e| format!("Erreur lecture prompt echange: {}", e))?,
        );
        
        prompts.insert(
            "assistance_generale".to_string(),
            fs::read_to_string("ia_prompts/assistance_generale_prompt.md").await
                .map_err(|e| format!("Erreur lecture prompt assistance_generale: {}", e))?,
        );
        
        Ok(Self { prompts })
    }
    
    /// Obtient le prompt de d?tection d'intention
    pub fn get_intention_detection_prompt(&self, user_input: &str) -> String {
        let prompt = self.prompts.get("intention_detection")
            .expect("Prompt de d?tection d'intention manquant");
        
        prompt.replace("{user_input}", user_input)
    }
    
    /// Obtient le prompt sp?cifique pour une intention
    pub fn get_intention_prompt(&self, intention: &str, user_input: &str) -> Option<String> {
        self.prompts.get(intention)
            .map(|prompt| prompt.replace("{user_input}", user_input))
    }
    
    /// Obtient le prompt optimis? pour une intention
    pub async fn get_optimized_prompt(&self, intention: &str, user_input: &str) -> String {
        self.get_intention_prompt(intention, user_input)
            .unwrap_or_else(|| {
                // Fallback vers le prompt g?n?ral si l'intention n'est pas trouv?e
                self.prompts.get("assistance_generale")
                    .map(|p| p.replace("{user_input}", user_input))
                    .unwrap_or_else(|| format!("Question: {}", user_input))
            })
    }
    
    /// Liste toutes les intentions support?es
    pub fn get_supported_intentions(&self) -> Vec<String> {
        self.prompts.keys()
            .filter(|k| *k != "intention_detection")
            .cloned()
            .collect()
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
