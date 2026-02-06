//! ✅ Chargeur de prompts IA depuis fichiers markdown
//!
//! Permet de charger et utiliser les prompts depuis les fichiers markdown
//! sans recompilation, avec support de versioning et de templates.

use crate::core::types::AppError;
use crate::core::types::AppResult;
use regex::Regex;
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Structure pour un prompt chargé
#[derive(Debug, Clone)]
pub struct Prompt {
    pub content: String,
    pub version: String,
    pub metadata: HashMap<String, String>,
}

/// Chargeur de prompts avec cache
pub struct PromptLoader {
    prompts: Arc<RwLock<HashMap<String, Prompt>>>,
    prompts_dir: String,
}

impl PromptLoader {
    /// Crée un nouveau chargeur de prompts
    pub fn new(prompts_dir: Option<String>) -> Self {
        let dir = prompts_dir.unwrap_or_else(|| {
            // Essayer plusieurs chemins possibles
            if Path::new("src/services/ia/prompts").exists() {
                "src/services/ia/prompts".to_string()
            } else if Path::new("backend/src/services/ia/prompts").exists() {
                "backend/src/services/ia/prompts".to_string()
            } else {
                "src/services/ia/prompts".to_string()
            }
        });

        Self {
            prompts: Arc::new(RwLock::new(HashMap::new())),
            prompts_dir: dir,
        }
    }

    /// Charge un prompt depuis un fichier markdown
    pub async fn load_prompt(&self, prompt_name: &str) -> AppResult<Prompt> {
        // Vérifier le cache
        {
            let prompts = self.prompts.read().await;
            if let Some(prompt) = prompts.get(prompt_name) {
                return Ok(prompt.clone());
            }
        }

        // Charger depuis le fichier
        let file_path = format!("{}/{}.md", self.prompts_dir, prompt_name);

        let content = fs::read_to_string(&file_path).map_err(|e| {
            AppError::Internal(format!(
                "Impossible de charger le prompt {}: {}",
                prompt_name, e
            ))
        })?;

        // Parser le prompt (extraire les sections si nécessaire)
        let prompt = self.parse_prompt(&content, prompt_name)?;

        // Mettre en cache
        {
            let mut prompts = self.prompts.write().await;
            prompts.insert(prompt_name.to_string(), prompt.clone());
        }

        Ok(prompt)
    }

    /// Charge un prompt avec remplacement de variables
    pub async fn load_prompt_with_vars(
        &self,
        prompt_name: &str,
        variables: &HashMap<String, String>,
    ) -> AppResult<String> {
        let prompt = self.load_prompt(prompt_name).await?;
        let mut content = prompt.content.clone();

        // Remplacer les variables {variable_name}
        for (key, value) in variables {
            let pattern = format!("{{{}}}", key);
            content = content.replace(&pattern, value);
        }

        Ok(content)
    }

    /// Charge une section spécifique d'un prompt (ex: "Recommandations de Livres")
    pub async fn load_prompt_section(
        &self,
        prompt_name: &str,
        section_name: &str,
    ) -> AppResult<String> {
        let prompt = self.load_prompt(prompt_name).await?;

        // Extraire la section (entre ## Section Name et ## suivant)
        let section_pattern = format!(r"##\s*{}\s*\n(.*?)(?=\n##|\z)", regex::escape(section_name));
        let re = Regex::new(&section_pattern)
            .map_err(|e| AppError::Internal(format!("Erreur regex: {}", e)))?;

        if let Some(captures) = re.captures(&prompt.content) {
            Ok(captures[1].trim().to_string())
        } else {
            // Si section non trouvée, retourner le prompt complet
            log::warn!(
                "[PromptLoader] Section '{}' non trouvée dans {}, utilisation du prompt complet",
                section_name,
                prompt_name
            );
            Ok(prompt.content.clone())
        }
    }

    /// Charge une section avec remplacement de variables
    pub async fn load_prompt_section_with_vars(
        &self,
        prompt_name: &str,
        section_name: &str,
        variables: &HashMap<String, String>,
    ) -> AppResult<String> {
        let mut content = self.load_prompt_section(prompt_name, section_name).await?;

        // Remplacer les variables
        for (key, value) in variables {
            let pattern = format!("{{{}}}", key);
            content = content.replace(&pattern, value);
        }

        Ok(content)
    }

    /// Parse un prompt markdown
    fn parse_prompt(&self, content: &str, _prompt_name: &str) -> AppResult<Prompt> {
        // Extraire la version si présente (format: # Version: 1.0)
        let version_re = Regex::new(r"#\s*Version:\s*(\S+)")
            .map_err(|e| AppError::Internal(format!("Erreur regex version: {}", e)))?;

        let version = version_re
            .captures(content)
            .and_then(|c| c.get(1))
            .map(|m| m.as_str().to_string())
            .unwrap_or_else(|| "1.0".to_string());

        // Extraire les métadonnées (format: key: value)
        let mut metadata = HashMap::new();
        let metadata_re = Regex::new(r"^(\w+):\s*(.+)$")
            .map_err(|e| AppError::Internal(format!("Erreur regex metadata: {}", e)))?;

        for line in content.lines() {
            if let Some(captures) = metadata_re.captures(line) {
                metadata.insert(captures[1].to_string(), captures[2].trim().to_string());
            }
        }

        Ok(Prompt {
            content: content.to_string(),
            version,
            metadata,
        })
    }

    /// Recharge tous les prompts (utile pour développement)
    pub async fn reload_all(&self) -> AppResult<()> {
        let mut prompts = self.prompts.write().await;
        prompts.clear();
        Ok(())
    }

    /// Liste tous les prompts disponibles
    pub async fn list_prompts(&self) -> AppResult<Vec<String>> {
        let entries = fs::read_dir(&self.prompts_dir).map_err(|e| {
            AppError::Internal(format!("Impossible de lire le répertoire prompts: {}", e))
        })?;

        let mut prompts = Vec::new();
        for entry in entries {
            if let Ok(entry) = entry {
                if let Some(name) = entry.file_name().to_str() {
                    if name.ends_with(".md") {
                        prompts.push(name.trim_end_matches(".md").to_string());
                    }
                }
            }
        }

        Ok(prompts)
    }
}

// Instance globale du chargeur de prompts
lazy_static::lazy_static! {
    pub static ref PROMPT_LOADER: PromptLoader = PromptLoader::new(None);
}

/// Fonction utilitaire pour charger un prompt
pub async fn load_prompt(prompt_name: &str) -> AppResult<Prompt> {
    PROMPT_LOADER.load_prompt(prompt_name).await
}

/// Fonction utilitaire pour charger un prompt avec variables
pub async fn load_prompt_with_vars(
    prompt_name: &str,
    variables: &HashMap<String, String>,
) -> AppResult<String> {
    PROMPT_LOADER.load_prompt_with_vars(prompt_name, variables).await
}

/// Fonction utilitaire pour charger une section de prompt
pub async fn load_prompt_section(prompt_name: &str, section_name: &str) -> AppResult<String> {
    PROMPT_LOADER.load_prompt_section(prompt_name, section_name).await
}

/// Fonction utilitaire pour charger une section avec variables
pub async fn load_prompt_section_with_vars(
    prompt_name: &str,
    section_name: &str,
    variables: &HashMap<String, String>,
) -> AppResult<String> {
    PROMPT_LOADER
        .load_prompt_section_with_vars(prompt_name, section_name, variables)
        .await
}
