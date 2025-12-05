// ✅ NOUVEAU Phase 4: Service de version control pour vidéos
// Date: 2025-01-27

use chrono::{DateTime, Utc};
use log::{error, info};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, PgPool};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct VideoVersion {
    pub id: i64,
    pub timeline_id: String,
    pub version_number: i32,
    pub version_name: Option<String>,
    pub created_by: i64,
    pub created_at: DateTime<Utc>,
    pub snapshot_data: serde_json::Value, // Timeline snapshot
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateVersionRequest {
    pub timeline_id: String,
    pub version_name: Option<String>,
    pub description: Option<String>,
    pub snapshot_data: serde_json::Value,
}

pub struct VersionControlService {
    pool: PgPool,
}

impl VersionControlService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Crée une nouvelle version de la timeline
    pub async fn create_version(
        &self,
        user_id: i64,
        request: CreateVersionRequest,
    ) -> Result<VideoVersion, String> {
        info!(
            "[VersionControlService] Création version pour timeline {}",
            request.timeline_id
        );

        // Obtenir le numéro de version suivant
        let version_number: i32 = sqlx::query_scalar(
            "SELECT COALESCE(MAX(version_number), 0) + 1 FROM video_versions WHERE timeline_id = $1"
        )
        .bind(&request.timeline_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| {
            error!("[VersionControlService] Erreur récupération version: {}", e);
            format!("Erreur récupération version: {}", e)
        })?;

        let version = sqlx::query_as::<_, VideoVersion>(
            "INSERT INTO video_versions (timeline_id, version_number, version_name, created_by, snapshot_data, description)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *"
        )
        .bind(&request.timeline_id)
        .bind(version_number)
        .bind(&request.version_name)
        .bind(user_id)
        .bind(&request.snapshot_data)
        .bind(&request.description)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| {
            error!("[VersionControlService] Erreur création version: {}", e);
            format!("Erreur création version: {}", e)
        })?;

        info!(
            "[VersionControlService] Version {} créée pour timeline {}",
            version_number, request.timeline_id
        );

        Ok(version)
    }

    /// Liste toutes les versions d'une timeline
    pub async fn list_versions(&self, timeline_id: &str) -> Result<Vec<VideoVersion>, String> {
        let versions = sqlx::query_as::<_, VideoVersion>(
            "SELECT * FROM video_versions WHERE timeline_id = $1 ORDER BY version_number DESC",
        )
        .bind(timeline_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| {
            error!("[VersionControlService] Erreur liste versions: {}", e);
            format!("Erreur liste versions: {}", e)
        })?;

        Ok(versions)
    }

    /// Récupère une version spécifique
    pub async fn get_version(
        &self,
        timeline_id: &str,
        version_number: i32,
    ) -> Result<VideoVersion, String> {
        let version = sqlx::query_as::<_, VideoVersion>(
            "SELECT * FROM video_versions WHERE timeline_id = $1 AND version_number = $2",
        )
        .bind(timeline_id)
        .bind(version_number)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| {
            error!("[VersionControlService] Erreur récupération version: {}", e);
            format!("Erreur récupération version: {}", e)
        })?;

        version.ok_or_else(|| format!("Version {} non trouvée", version_number))
    }

    /// Compare deux versions et retourne les différences
    pub async fn compare_versions(
        &self,
        timeline_id: &str,
        version1: i32,
        version2: i32,
    ) -> Result<HashMap<String, serde_json::Value>, String> {
        let v1 = self.get_version(timeline_id, version1).await?;
        let v2 = self.get_version(timeline_id, version2).await?;

        // Comparer les snapshots
        let mut differences = HashMap::new();

        if v1.snapshot_data != v2.snapshot_data {
            differences.insert(
                "snapshot".to_string(),
                serde_json::json!({
                    "version1": v1.snapshot_data,
                    "version2": v2.snapshot_data
                }),
            );
        }

        if v1.description != v2.description {
            differences.insert(
                "description".to_string(),
                serde_json::json!({
                    "version1": v1.description,
                    "version2": v2.description
                }),
            );
        }

        Ok(differences)
    }

    /// Supprime une version
    pub async fn delete_version(
        &self,
        timeline_id: &str,
        version_number: i32,
        user_id: i64,
    ) -> Result<(), String> {
        // Vérifier que l'utilisateur est le créateur
        let version = self.get_version(timeline_id, version_number).await?;

        if version.created_by != user_id {
            return Err("Vous n'êtes pas autorisé à supprimer cette version".to_string());
        }

        sqlx::query("DELETE FROM video_versions WHERE timeline_id = $1 AND version_number = $2")
            .bind(timeline_id)
            .bind(version_number)
            .execute(&self.pool)
            .await
            .map_err(|e| {
                error!("[VersionControlService] Erreur suppression version: {}", e);
                format!("Erreur suppression version: {}", e)
            })?;

        info!(
            "[VersionControlService] Version {} supprimée pour timeline {}",
            version_number, timeline_id
        );

        Ok(())
    }
}
