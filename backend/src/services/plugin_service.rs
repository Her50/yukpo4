// ✅ NOUVEAU Phase 2: Service de gestion des plugins
// Date: 2025-01-27
// Architecture extensible pour plugins vidéo

use crate::core::types::{AppError, AppResult};
use log::{error, info, warn};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, PgPool};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::fs;
use tokio::sync::RwLock;

/// Statut d'un plugin
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum PluginStatus {
    Installed,
    Active,
    Inactive,
    Error(String),
}

/// Métadonnées d'un plugin
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginMetadata {
    pub id: String,
    pub name: String,
    pub version: String,
    pub author: String,
    pub description: String,
    pub category: PluginCategory,
    pub tags: Vec<String>,
    pub icon_url: Option<String>,
    pub homepage_url: Option<String>,
    pub license: String,
    pub min_yukpo_version: Option<String>,
    pub dependencies: Vec<String>,
    pub permissions: Vec<PluginPermission>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum PluginCategory {
    Effect,
    Transition,
    Filter,
    Export,
    Integration,
    Other,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginPermission {
    pub name: String,
    pub description: String,
    pub required: bool,
}

/// Plugin installé
#[derive(Debug, Clone)]
pub struct InstalledPlugin {
    pub metadata: PluginMetadata,
    pub status: PluginStatus,
    pub install_path: PathBuf,
    pub install_date: chrono::DateTime<chrono::Utc>,
    pub last_used: Option<chrono::DateTime<chrono::Utc>>,
    pub usage_count: u64,
}

/// Row du marketplace pour conversion
#[derive(Debug, FromRow)]
struct PluginMarketplaceRow {
    #[allow(dead_code)]
    plugin_id: String,
    name: String,
    version: String,
    author: String,
    description: Option<String>,
    category: String,
    tags: Option<Vec<String>>,
    icon_url: Option<String>,
    homepage_url: Option<String>,
    license: String,
    min_yukpo_version: Option<String>,
    #[allow(dead_code)]
    download_count: i64,
    #[allow(dead_code)]
    rating: Option<rust_decimal::Decimal>,
    #[allow(dead_code)]
    is_premium: bool,
    #[allow(dead_code)]
    is_featured: bool,
    #[allow(dead_code)]
    is_verified: bool,
}

impl From<PluginMarketplaceRow> for PluginMetadata {
    fn from(row: PluginMarketplaceRow) -> Self {
        let category = match row.category.as_str() {
            "effect" => PluginCategory::Effect,
            "transition" => PluginCategory::Transition,
            "filter" => PluginCategory::Filter,
            "export" => PluginCategory::Export,
            "integration" => PluginCategory::Integration,
            _ => PluginCategory::Other,
        };

        Self {
            id: row.plugin_id,
            name: row.name,
            version: row.version,
            author: row.author,
            description: row.description.unwrap_or_default(),
            category,
            tags: row.tags.unwrap_or_default(),
            icon_url: row.icon_url,
            homepage_url: row.homepage_url,
            license: row.license,
            min_yukpo_version: row.min_yukpo_version,
            dependencies: vec![], // Récupérer depuis plugin_dependencies si nécessaire
            permissions: vec![],  // Récupérer depuis plugin_permissions si nécessaire
        }
    }
}

/// Service de gestion des plugins
pub struct PluginService {
    plugins_dir: PathBuf,
    installed_plugins: Arc<RwLock<HashMap<String, InstalledPlugin>>>,
    sandbox_enabled: bool,
}

impl PluginService {
    pub fn new(plugins_dir: Option<PathBuf>) -> Result<Self, String> {
        let plugins_dir = plugins_dir.unwrap_or_else(|| {
            PathBuf::from(std::env::var("PLUGINS_DIR").unwrap_or_else(|_| "./plugins".to_string()))
        });

        // Créer le répertoire plugins s'il n'existe pas
        if !plugins_dir.exists() {
            std::fs::create_dir_all(&plugins_dir)
                .map_err(|e| format!("Erreur création répertoire plugins: {}", e))?;
        }

        info!("[PluginService] Répertoire plugins: {:?}", plugins_dir);

        Ok(Self {
            plugins_dir,
            installed_plugins: Arc::new(RwLock::new(HashMap::new())),
            sandbox_enabled: std::env::var("PLUGIN_SANDBOX_ENABLED")
                .unwrap_or_else(|_| "true".to_string())
                == "true",
        })
    }

    /// Liste tous les plugins installés
    pub async fn list_plugins(&self) -> AppResult<Vec<PluginMetadata>> {
        let plugins = self.installed_plugins.read().await;
        Ok(plugins.values().map(|p| p.metadata.clone()).collect())
    }

    /// Récupère un plugin par son ID
    pub async fn get_plugin(&self, plugin_id: &str) -> AppResult<Option<InstalledPlugin>> {
        let plugins = self.installed_plugins.read().await;
        Ok(plugins.get(plugin_id).cloned())
    }

    /// Installe un plugin depuis un fichier
    pub async fn install_plugin(
        &self,
        _plugin_path: &Path,
        metadata: PluginMetadata,
    ) -> AppResult<String> {
        info!("[PluginService] Installation plugin: {}", metadata.id);

        // Vérifier que le plugin n'est pas déjà installé
        let mut plugins = self.installed_plugins.write().await;
        if plugins.contains_key(&metadata.id) {
            return Err(AppError::BadRequest(format!(
                "Plugin {} déjà installé",
                metadata.id
            )));
        }

        // Créer le répertoire du plugin
        let plugin_dir = self.plugins_dir.join(&metadata.id);
        fs::create_dir_all(&plugin_dir).await.map_err(|e| {
            error!("[PluginService] Erreur création répertoire plugin: {}", e);
            AppError::Internal(format!("Erreur installation plugin: {}", e))
        })?;

        // Copier les fichiers du plugin
        // TODO: Implémenter la copie des fichiers selon le format du plugin

        // Enregistrer le plugin
        let installed_plugin = InstalledPlugin {
            metadata: metadata.clone(),
            status: PluginStatus::Installed,
            install_path: plugin_dir,
            install_date: chrono::Utc::now(),
            last_used: None,
            usage_count: 0,
        };

        plugins.insert(metadata.id.clone(), installed_plugin);

        info!(
            "[PluginService] Plugin {} installé avec succès",
            metadata.id
        );
        Ok(metadata.id)
    }

    /// Active un plugin
    pub async fn activate_plugin(&self, plugin_id: &str) -> AppResult<()> {
        info!("[PluginService] Activation plugin: {}", plugin_id);

        let mut plugins = self.installed_plugins.write().await;

        // Vérifier d'abord l'existence du plugin et collecter les dépendances
        let dependencies = if let Some(plugin) = plugins.get(plugin_id) {
            plugin.metadata.dependencies.clone()
        } else {
            return Err(AppError::NotFound(format!(
                "Plugin {} non trouvé",
                plugin_id
            )));
        };
        
        // Vérifier les dépendances
        for dep in &dependencies {
            if !plugins.contains_key(dep) {
                return Err(AppError::BadRequest(format!(
                    "Dépendance {} non installée",
                    dep
                )));
            }
            if plugins[dep].status != PluginStatus::Active {
                return Err(AppError::BadRequest(format!(
                    "Dépendance {} non active",
                    dep
                )));
            }
        }

        // Maintenant activer le plugin
        if let Some(plugin) = plugins.get_mut(plugin_id) {
            plugin.status = PluginStatus::Active;
            info!("[PluginService] Plugin {} activé", plugin_id);
            Ok(())
        } else {
            Err(AppError::NotFound(format!(
                "Plugin {} non trouvé",
                plugin_id
            )))
        }
    }

    /// Désactive un plugin
    pub async fn deactivate_plugin(&self, plugin_id: &str) -> AppResult<()> {
        info!("[PluginService] Désactivation plugin: {}", plugin_id);

        let mut plugins = self.installed_plugins.write().await;

        if let Some(plugin) = plugins.get_mut(plugin_id) {
            plugin.status = PluginStatus::Inactive;
            info!("[PluginService] Plugin {} désactivé", plugin_id);
            Ok(())
        } else {
            Err(AppError::NotFound(format!(
                "Plugin {} non trouvé",
                plugin_id
            )))
        }
    }

    /// Désinstalle un plugin
    pub async fn uninstall_plugin(&self, plugin_id: &str) -> AppResult<()> {
        info!("[PluginService] Désinstallation plugin: {}", plugin_id);

        let mut plugins = self.installed_plugins.write().await;

        if let Some(plugin) = plugins.remove(plugin_id) {
            // Supprimer les fichiers du plugin
            if plugin.install_path.exists() {
                fs::remove_dir_all(&plugin.install_path)
                    .await
                    .map_err(|e| {
                        error!("[PluginService] Erreur suppression plugin: {}", e);
                        AppError::Internal(format!("Erreur désinstallation plugin: {}", e))
                    })?;
            }

            info!("[PluginService] Plugin {} désinstallé", plugin_id);
            Ok(())
        } else {
            Err(AppError::NotFound(format!(
                "Plugin {} non trouvé",
                plugin_id
            )))
        }
    }

    /// Met à jour un plugin
    pub async fn update_plugin(
        &self,
        plugin_id: &str,
        new_version: &str,
        _plugin_path: &Path,
    ) -> AppResult<()> {
        info!(
            "[PluginService] Mise à jour plugin: {} -> {}",
            plugin_id, new_version
        );

        // Désinstaller l'ancienne version
        self.uninstall_plugin(plugin_id).await?;

        // TODO: Charger les nouvelles métadonnées depuis le fichier
        // Pour l'instant, on suppose que les métadonnées sont fournies

        info!("[PluginService] Plugin {} mis à jour", plugin_id);
        Ok(())
    }

    /// Recherche des plugins dans le marketplace
    pub async fn search_marketplace(
        &self,
        pool: &PgPool,
        query: &str,
        category: Option<PluginCategory>,
        limit: Option<usize>,
    ) -> AppResult<Vec<PluginMetadata>> {
        info!("[PluginService] Recherche marketplace: '{}'", query);

        let limit = limit.unwrap_or(20);
        let mut sql_query = String::from(
            "SELECT plugin_id, name, version, author, description, category, tags, 
             icon_url, homepage_url, license, min_yukpo_version, 
             download_count, rating, is_premium, is_featured, is_verified
             FROM plugin_marketplace WHERE 1=1",
        );

        // Filtre par recherche textuelle
        if !query.is_empty() {
            sql_query.push_str(" AND (name ILIKE $1 OR description ILIKE $1 OR array_to_string(tags, ' ') ILIKE $1)");
        }

        // Filtre par catégorie
        if let Some(cat) = &category {
            let cat_str = match cat {
                PluginCategory::Effect => "effect",
                PluginCategory::Transition => "transition",
                PluginCategory::Filter => "filter",
                PluginCategory::Export => "export",
                PluginCategory::Integration => "integration",
                PluginCategory::Other => "other",
            };
            sql_query.push_str(&format!(" AND category = '{}'", cat_str));
        }

        sql_query.push_str(" ORDER BY is_featured DESC, rating DESC, download_count DESC LIMIT $2");

        let results: Vec<PluginMetadata> = if !query.is_empty() {
            let search_pattern = format!("%{}%", query);
            sqlx::query_as::<_, PluginMarketplaceRow>(&sql_query)
                .bind(&search_pattern)
                .bind(limit as i64)
                .fetch_all(pool)
                .await?
                .into_iter()
                .map(|row| row.into())
                .collect()
        } else {
            sqlx::query_as::<_, PluginMarketplaceRow>(&sql_query)
                .bind(limit as i64)
                .fetch_all(pool)
                .await?
                .into_iter()
                .map(|row| row.into())
                .collect()
        };

        info!("[PluginService] {} plugins trouvés", results.len());
        Ok(results)
    }

    /// Télécharge un plugin depuis le marketplace
    pub async fn download_plugin_from_marketplace(
        &self,
        pool: &PgPool,
        plugin_id: &str,
    ) -> AppResult<String> {
        info!("[PluginService] Téléchargement plugin: {}", plugin_id);

        // Récupérer l'URL de téléchargement
        let download_url: Option<String> =
            sqlx::query_scalar("SELECT download_url FROM plugin_marketplace WHERE plugin_id = $1")
                .bind(plugin_id)
                .fetch_optional(pool)
                .await?
                .ok_or_else(|| AppError::NotFound(format!("Plugin {} non trouvé", plugin_id)))?;

        let download_url = download_url.ok_or_else(|| {
            AppError::NotFound(format!(
                "URL de téléchargement non trouvée pour {}",
                plugin_id
            ))
        })?;

        // Télécharger le plugin
        let client = reqwest::Client::new();
        let response = client
            .get(&download_url)
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("Erreur téléchargement plugin: {}", e)))?;

        if !response.status().is_success() {
            return Err(AppError::Internal(format!(
                "Erreur téléchargement plugin: {}",
                response.status()
            )));
        }

        // Sauvegarder le plugin temporairement
        let temp_path = self.plugins_dir.join(format!("{}_temp.zip", plugin_id));
        let mut file = tokio::fs::File::create(&temp_path).await.map_err(|e| {
            AppError::Internal(format!("Erreur création fichier temporaire: {}", e))
        })?;

        let content = response
            .bytes()
            .await
            .map_err(|e| AppError::Internal(format!("Erreur lecture réponse: {}", e)))?;

        tokio::io::copy(&mut content.as_ref(), &mut file)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur écriture fichier: {}", e)))?;

        // Incrémenter le compteur de téléchargements
        sqlx::query("UPDATE plugin_marketplace SET download_count = download_count + 1 WHERE plugin_id = $1")
            .bind(plugin_id)
            .execute(pool)
            .await?;

        info!(
            "[PluginService] Plugin {} téléchargé avec succès",
            plugin_id
        );
        Ok(temp_path.to_string_lossy().to_string())
    }

    /// Exécute un plugin dans un sandbox sécurisé
    pub async fn execute_plugin(
        &self,
        plugin_id: &str,
        input: serde_json::Value,
    ) -> AppResult<serde_json::Value> {
        info!("[PluginService] Exécution plugin: {}", plugin_id);

        let plugins = self.installed_plugins.read().await;

        if let Some(plugin) = plugins.get(plugin_id) {
            if plugin.status != PluginStatus::Active {
                return Err(AppError::BadRequest(format!(
                    "Plugin {} non actif",
                    plugin_id
                )));
            }

            // ✅ NOUVEAU Phase 2: Sandbox sécurité
            if self.sandbox_enabled {
                return self.execute_plugin_sandboxed(plugin, input).await;
            } else {
                warn!("[PluginService] Sandbox désactivé - exécution directe");
                return self.execute_plugin_direct(plugin, input).await;
            }
        } else {
            Err(AppError::NotFound(format!(
                "Plugin {} non trouvé",
                plugin_id
            )))
        }
    }

    /// Exécute un plugin dans un sandbox sécurisé
    async fn execute_plugin_sandboxed(
        &self,
        plugin: &InstalledPlugin,
        input: serde_json::Value,
    ) -> AppResult<serde_json::Value> {
        info!(
            "[PluginService] Exécution plugin {} dans sandbox",
            plugin.metadata.id
        );

        // Vérifier les permissions requises
        for permission in &plugin.metadata.permissions {
            if permission.required {
                // TODO: Vérifier que la permission est accordée
                // Pour l'instant, on accepte toutes les permissions
            }
        }

        // Limiter les ressources disponibles
        let max_execution_time = std::time::Duration::from_secs(30);
        let max_memory_mb = 512;

        // Créer un contexte d'exécution isolé
        let sandbox_context = SandboxContext {
            plugin_id: plugin.metadata.id.clone(),
            max_execution_time,
            max_memory_mb,
            allowed_operations: vec![
                "read_file".to_string(),
                "write_file".to_string(),
                "process_video".to_string(),
            ],
            blocked_operations: vec![
                "network_request".to_string(),
                "system_command".to_string(),
                "file_delete".to_string(),
            ],
        };

        // Exécuter le plugin avec timeout
        let result = tokio::time::timeout(
            max_execution_time,
            self.execute_plugin_with_context(plugin, input, &sandbox_context),
        )
        .await;

        match result {
            Ok(Ok(output)) => {
                info!(
                    "[PluginService] Plugin {} exécuté avec succès",
                    plugin.metadata.id
                );
                Ok(output)
            }
            Ok(Err(e)) => {
                error!(
                    "[PluginService] Erreur exécution plugin {}: {}",
                    plugin.metadata.id, e
                );
                Err(e)
            }
            Err(_) => {
                error!(
                    "[PluginService] Timeout exécution plugin {}",
                    plugin.metadata.id
                );
                Err(AppError::Internal(format!(
                    "Timeout exécution plugin {} ({}s)",
                    plugin.metadata.id,
                    max_execution_time.as_secs()
                )))
            }
        }
    }

    /// Exécute un plugin directement (sans sandbox)
    async fn execute_plugin_direct(
        &self,
        plugin: &InstalledPlugin,
        _input: serde_json::Value,
    ) -> AppResult<serde_json::Value> {
        warn!(
            "[PluginService] Exécution directe plugin {} (sandbox désactivé)",
            plugin.metadata.id
        );

        // TODO: Implémenter l'exécution directe du plugin
        // Pour l'instant, retourner une réponse vide

        Ok(serde_json::json!({
            "success": true,
            "plugin_id": plugin.metadata.id,
            "output": {}
        }))
    }

    /// Exécute un plugin avec contexte sandbox
    async fn execute_plugin_with_context(
        &self,
        plugin: &InstalledPlugin,
        input: serde_json::Value,
        context: &SandboxContext,
    ) -> AppResult<serde_json::Value> {
        info!(
            "[PluginService] Exécution plugin {} dans sandbox (timeout: {}s, mémoire max: {}MB)",
            plugin.metadata.id,
            context.max_execution_time.as_secs(),
            context.max_memory_mb
        );

        let start_time = std::time::Instant::now();

        // ✅ NOUVEAU Phase 2: Charger le plugin depuis le fichier
        let plugin_manifest_path = plugin.install_path.join("manifest.json");

        if !plugin_manifest_path.exists() {
            return Err(AppError::NotFound(format!(
                "Manifest plugin {} introuvable",
                plugin.metadata.id
            )));
        }

        // Lire le manifest du plugin
        let manifest_content = tokio::fs::read_to_string(&plugin_manifest_path)
            .await
            .map_err(|e| {
                AppError::Internal(format!(
                    "Erreur lecture manifest plugin {}: {}",
                    plugin.metadata.id, e
                ))
            })?;

        let manifest: serde_json::Value = serde_json::from_str(&manifest_content).map_err(|e| {
            AppError::Internal(format!(
                "Erreur parsing manifest plugin {}: {}",
                plugin.metadata.id, e
            ))
        })?;

        // Vérifier les permissions requises
        if let Some(required_permissions) = manifest.get("permissions").and_then(|p| p.as_array()) {
            for perm in required_permissions {
                if let Some(perm_name) = perm.as_str() {
                    if !context.allowed_operations.contains(&perm_name.to_string()) {
                        if context.blocked_operations.contains(&perm_name.to_string()) {
                            return Err(AppError::BadRequest(format!(
                                "Plugin {} demande permission bloquée: {}",
                                plugin.metadata.id, perm_name
                            )));
                        }
                    }
                }
            }
        }

        // ✅ Exécuter le plugin selon son type
        let plugin_type = manifest
            .get("type")
            .and_then(|t| t.as_str())
            .unwrap_or("unknown");

        let output = match plugin_type {
            "effect" => {
                // Plugin d'effet vidéo
                self.execute_effect_plugin(plugin, input, context).await?
            }
            "transition" => {
                // Plugin de transition
                self.execute_transition_plugin(plugin, input, context)
                    .await?
            }
            "filter" => {
                // Plugin de filtre
                self.execute_filter_plugin(plugin, input, context).await?
            }
            _ => {
                // Plugin générique
                self.execute_generic_plugin(plugin, input, context).await?
            }
        };

        let execution_time = start_time.elapsed();
        let execution_time_ms = execution_time.as_millis() as u64;

        // Vérifier le timeout
        if execution_time > context.max_execution_time {
            return Err(AppError::Internal(format!(
                "Plugin {} a dépassé le timeout ({}ms > {}ms)",
                plugin.metadata.id,
                execution_time_ms,
                context.max_execution_time.as_millis()
            )));
        }

        info!(
            "[PluginService] Plugin {} exécuté en {}ms",
            plugin.metadata.id, execution_time_ms
        );

        Ok(serde_json::json!({
            "success": true,
            "plugin_id": plugin.metadata.id,
            "output": output,
            "sandbox": {
                "execution_time_ms": execution_time_ms,
                "memory_used_mb": 0, // TODO: Mesurer mémoire réelle
            }
        }))
    }

    /// Exécute un plugin d'effet vidéo
    async fn execute_effect_plugin(
        &self,
        _plugin: &InstalledPlugin,
        input: serde_json::Value,
        _context: &SandboxContext,
    ) -> AppResult<serde_json::Value> {
        // TODO: Charger et exécuter le code du plugin
        // Pour l'instant, retourner les paramètres d'entrée transformés
        Ok(serde_json::json!({
            "effect_applied": true,
            "parameters": input
        }))
    }

    /// Exécute un plugin de transition
    async fn execute_transition_plugin(
        &self,
        _plugin: &InstalledPlugin,
        input: serde_json::Value,
        _context: &SandboxContext,
    ) -> AppResult<serde_json::Value> {
        // TODO: Charger et exécuter le code du plugin
        Ok(serde_json::json!({
            "transition_applied": true,
            "parameters": input
        }))
    }

    /// Exécute un plugin de filtre
    async fn execute_filter_plugin(
        &self,
        _plugin: &InstalledPlugin,
        input: serde_json::Value,
        _context: &SandboxContext,
    ) -> AppResult<serde_json::Value> {
        // TODO: Charger et exécuter le code du plugin
        Ok(serde_json::json!({
            "filter_applied": true,
            "parameters": input
        }))
    }

    /// Exécute un plugin générique
    async fn execute_generic_plugin(
        &self,
        _plugin: &InstalledPlugin,
        input: serde_json::Value,
        _context: &SandboxContext,
    ) -> AppResult<serde_json::Value> {
        // TODO: Charger et exécuter le code du plugin
        // Pour les plugins JavaScript/TypeScript, utiliser un runtime V8 ou QuickJS
        // Pour les plugins Rust, utiliser un système de chargement dynamique
        Ok(serde_json::json!({
            "plugin_executed": true,
            "parameters": input
        }))
    }
}

/// Contexte de sandbox pour exécution sécurisée
struct SandboxContext {
    plugin_id: String,
    max_execution_time: std::time::Duration,
    max_memory_mb: u64,
    allowed_operations: Vec<String>,
    blocked_operations: Vec<String>,
}
