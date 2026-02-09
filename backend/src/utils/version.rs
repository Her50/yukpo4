//! Module pour gérer la version de l'application
//! La version est lue depuis Cargo.toml au moment de la compilation

use chrono::Utc;
use serde::{Deserialize, Serialize};

/// Version de l'application (lue depuis Cargo.toml)
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

/// Nom de l'application
pub const APP_NAME: &str = env!("CARGO_PKG_NAME");

/// Structure pour la réponse de version
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VersionInfo {
    pub version: String,
    pub app_name: String,
    pub build_date: String,
    pub git_commit: String,
    pub git_branch: String,
}

impl VersionInfo {
    /// Crée une nouvelle instance de VersionInfo
    pub fn new() -> Self {
        Self {
            version: VERSION.to_string(),
            app_name: APP_NAME.to_string(),
            build_date: Self::get_build_date(),
            git_commit: Self::get_git_commit(),
            git_branch: Self::get_git_branch(),
        }
    }

    /// Récupère la date de build (date actuelle au runtime)
    fn get_build_date() -> String {
        Utc::now().to_rfc3339()
    }

    /// Récupère le commit Git depuis les variables d'environnement ou Git
    fn get_git_commit() -> String {
        // Essayer d'abord les variables d'environnement (utilisées par CI/CD)
        if let Ok(commit) = std::env::var("GIT_COMMIT") {
            return commit;
        }
        if let Ok(commit) = std::env::var("GITHUB_SHA") {
            return commit.chars().take(7).collect(); // Prendre les 7 premiers caractères
        }

        // Sinon, essayer de lire depuis Git directement (seulement si disponible)
        #[cfg(not(target_arch = "wasm32"))]
        {
            if let Ok(output) = std::process::Command::new("git")
                .args(["rev-parse", "--short", "HEAD"])
                .output()
            {
                if let Ok(commit) = String::from_utf8(output.stdout) {
                    return commit.trim().to_string();
                }
            }
        }

        "unknown".to_string()
    }

    /// Récupère la branche Git depuis les variables d'environnement ou Git
    fn get_git_branch() -> String {
        // Essayer d'abord les variables d'environnement (utilisées par CI/CD)
        if let Ok(branch) = std::env::var("GIT_BRANCH") {
            return branch;
        }
        if let Ok(branch) = std::env::var("GITHUB_REF_NAME") {
            return branch;
        }

        // Sinon, essayer de lire depuis Git directement (seulement si disponible)
        #[cfg(not(target_arch = "wasm32"))]
        {
            if let Ok(output) = std::process::Command::new("git")
                .args(["rev-parse", "--abbrev-ref", "HEAD"])
                .output()
            {
                if let Ok(branch) = String::from_utf8(output.stdout) {
                    return branch.trim().to_string();
                }
            }
        }

        "unknown".to_string()
    }
}

impl Default for VersionInfo {
    fn default() -> Self {
        Self::new()
    }
}
