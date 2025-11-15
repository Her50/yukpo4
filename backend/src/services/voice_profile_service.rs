use std::path::{Path, PathBuf};
use std::sync::Arc;

use chrono::{DateTime, Utc};
use log::warn;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::{FromRow, PgPool, Row};

use crate::core::types::{AppError, AppResult};
use crate::services::media_storage_service::MediaStorageService;

#[derive(Debug, Clone, Serialize, FromRow)]
pub struct VoiceProfile {
    pub id: i32,
    pub user_id: i32,
    pub service_id: Option<i32>,
    pub name: String,
    pub provider: String,
    pub description: Option<String>,
    pub sample_media_id: Option<i32>,
    pub metadata: Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize)]
pub struct VoiceProfileSummary {
    pub id: i32,
    pub name: String,
    pub provider: String,
}

#[derive(Debug, Clone)]
pub struct ResolvedVoiceProfile {
    pub profile: VoiceProfile,
    pub tts_voice_hint: Option<String>,
    pub metadata: Value,
    pub sample_path: Option<PathBuf>,
}

impl ResolvedVoiceProfile {
    pub fn summary(&self) -> VoiceProfileSummary {
        VoiceProfileSummary {
            id: self.profile.id,
            name: self.profile.name.clone(),
            provider: self.profile.provider.clone(),
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct CreateVoiceProfilePayload {
    pub name: String,
    pub provider: Option<String>,
    pub description: Option<String>,
    pub service_id: Option<i32>,
    pub sample_media_id: Option<i32>,
    pub metadata: Option<Value>,
}

pub struct VoiceProfileService {
    pool: PgPool,
    media_storage: Arc<MediaStorageService>,
}

impl VoiceProfileService {
    pub fn new(pool: PgPool, media_storage: Arc<MediaStorageService>) -> Self {
        Self {
            pool,
            media_storage,
        }
    }

    pub async fn list_for_user(&self, user_id: i32) -> AppResult<Vec<VoiceProfile>> {
        let records = sqlx::query_as::<_, VoiceProfile>(
            r#"
            SELECT *
            FROM voice_profiles
            WHERE user_id = $1
            ORDER BY updated_at DESC
            "#,
        )
        .bind(user_id)
        .fetch_all(&self.pool)
        .await
        .map_err(AppError::from)?;

        Ok(records)
    }

    pub async fn create_profile(
        &self,
        user_id: i32,
        payload: CreateVoiceProfilePayload,
    ) -> AppResult<VoiceProfile> {
        if payload.name.trim().is_empty() {
            return Err(AppError::BadRequest(
                "Le nom du profil audio est obligatoire.".to_string(),
            ));
        }

        let metadata = payload.metadata.unwrap_or_else(|| json!({}));

        let record = sqlx::query_as::<_, VoiceProfile>(
            r#"
            INSERT INTO voice_profiles (
                user_id,
                service_id,
                name,
                provider,
                description,
                sample_media_id,
                metadata
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
            "#,
        )
        .bind(user_id)
        .bind(payload.service_id)
        .bind(payload.name.trim())
        .bind(payload.provider.unwrap_or_else(|| "custom".to_string()))
        .bind(payload.description.unwrap_or_default())
        .bind(payload.sample_media_id)
        .bind(metadata)
        .fetch_one(&self.pool)
        .await
        .map_err(|err| {
            if let Some(code) = err.as_database_error().and_then(|db| db.code()) {
                if code == "23505" {
                    return AppError::BadRequest(
                        "Un profil audio portant ce nom existe déjà.".to_string(),
                    );
                }
            }
            AppError::from(err)
        })?;

        Ok(record)
    }

    pub async fn delete_profile(&self, user_id: i32, profile_id: i32) -> AppResult<()> {
        let rows_affected =
            sqlx::query("DELETE FROM voice_profiles WHERE id = $1 AND user_id = $2")
                .bind(profile_id)
                .bind(user_id)
                .execute(&self.pool)
                .await
                .map_err(AppError::from)?
                .rows_affected();

        if rows_affected == 0 {
            return Err(AppError::NotFound(
                "Profil audio introuvable ou accès refusé.".to_string(),
            ));
        }

        Ok(())
    }

    pub async fn resolve_for_generation(
        &self,
        profile_id: i32,
        owner_user_id: i32,
        service_id: i32,
    ) -> AppResult<ResolvedVoiceProfile> {
        let profile =
            sqlx::query_as::<_, VoiceProfile>("SELECT * FROM voice_profiles WHERE id = $1")
                .bind(profile_id)
                .fetch_optional(&self.pool)
                .await
                .map_err(AppError::from)?
                .ok_or_else(|| AppError::NotFound("Profil audio introuvable.".to_string()))?;

        if profile.user_id != owner_user_id {
            return Err(AppError::Unauthorized(
                "Ce profil audio appartient à un autre utilisateur.".to_string(),
            ));
        }

        if let Some(bound_service) = profile.service_id {
            if bound_service != service_id {
                return Err(AppError::Forbidden(
                    "Ce profil audio n'est pas lié à ce service.".to_string(),
                ));
            }
        }

        let tts_voice_hint = profile
            .metadata
            .get("tts_voice")
            .and_then(|value| value.as_str())
            .map(|s| s.to_string());

        let metadata_clone = profile.metadata.clone();

        let sample_path = match profile.sample_media_id {
            Some(media_id) => self
                .resolve_media_path(media_id)
                .await
                .map_err(|err| {
                    warn!(
                        "[VoiceProfileService] Impossible de résoudre le média {}: {:?}",
                        media_id, err
                    );
                    err
                })
                .ok()
                .flatten(),
            None => None,
        };

        Ok(ResolvedVoiceProfile {
            profile,
            tts_voice_hint,
            metadata: metadata_clone,
            sample_path,
        })
    }

    async fn resolve_media_path(&self, media_id: i32) -> AppResult<Option<PathBuf>> {
        let row = sqlx::query("SELECT path FROM media WHERE id = $1")
            .bind(media_id)
            .fetch_optional(&self.pool)
            .await
            .map_err(AppError::from)?;

        let Some(record) = row else {
            return Ok(None);
        };

        let path: String = record.try_get("path").unwrap_or_default();
        if path.is_empty() {
            return Ok(None);
        }

        let absolute = self.media_storage.local_path_for(&path);
        if Path::new(&absolute).exists() {
            Ok(Some(absolute))
        } else {
            Ok(None)
        }
    }
}
