// ✅ NOUVEAU 2026-01-04: Service de cache pour les previews vidéo
// Optimise les performances en évitant de régénérer les previews identiques

use crate::core::types::{AppError, AppResult};
use log::{debug, info, warn};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::PgPool;
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CachedPreview {
    pub preview_url: String,
    pub preview_duration: f64,
    pub quality: String,
    pub thumbnail_url: Option<String>,
    pub created_at: i64,
    pub access_count: i32,
    pub file_size: Option<i64>,
}

/// ✅ Génère une clé de cache basée sur le hash de la timeline
pub fn generate_preview_cache_key(
    timeline: &Value,
    quality: &str,
    max_duration: Option<f64>,
) -> String {
    let mut hasher = DefaultHasher::new();

    // Hasher les éléments essentiels de la timeline
    if let Some(scenes) = timeline.get("scenes").and_then(|s| s.as_array()) {
        for scene in scenes {
            // Hasher les éléments qui affectent le rendu
            if let Some(media_url) = scene.get("media_url").and_then(|m| m.as_str()) {
                media_url.hash(&mut hasher);
            }
            if let Some(duration) = scene.get("duration").and_then(|d| d.as_f64()) {
                duration.to_bits().hash(&mut hasher);
            }
            if let Some(effects) = scene.get("effects").and_then(|e| e.as_array()) {
                for effect in effects {
                    if let Some(effect_str) = effect.as_str() {
                        effect_str.hash(&mut hasher);
                    }
                }
            }
        }
    }

    quality.hash(&mut hasher);
    if let Some(max_dur) = max_duration {
        max_dur.to_bits().hash(&mut hasher);
    }

    let hash = hasher.finish();
    format!("preview:{}:{}", quality, hash)
}

/// ✅ Récupère une preview depuis le cache
pub async fn get_cached_preview(
    pool: &PgPool,
    cache_key: &str,
) -> AppResult<Option<CachedPreview>> {
    let _now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;

    // Vérifier si la preview est en cache et non expirée
    let result = sqlx::query_scalar::<_, Option<Value>>(
        r#"
        SELECT get_cache($1)
        "#,
    )
    .bind(cache_key)
    .fetch_optional(pool)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur récupération cache preview: {}", e)))?;

    // ✅ CORRIGÉ: result est Option<Option<Value>>, utiliser flatten() pour obtenir Option<Value>
    if let Some(cache_value) = result.flatten() {
        match serde_json::from_value::<CachedPreview>(cache_value) {
            Ok(cached) => {
                // Vérifier que le fichier existe toujours
                let file_exists = std::path::Path::new(&cached.preview_url).exists();
                if file_exists {
                    info!(
                        "[PreviewCache] ✅ Cache hit pour preview: {} (accès #{})",
                        cache_key,
                        cached.access_count + 1
                    );
                    return Ok(Some(cached));
                } else {
                    warn!(
                        "[PreviewCache] ⚠️ Fichier preview introuvable, invalidation cache: {}",
                        cached.preview_url
                    );
                    // Invalider le cache
                    let _ = invalidate_preview_cache(pool, cache_key).await;
                }
            }
            Err(e) => {
                warn!("[PreviewCache] ⚠️ Erreur désérialisation cache: {}", e);
            }
        }
    }

    Ok(None)
}

/// ✅ Met une preview en cache
pub async fn cache_preview(
    pool: &PgPool,
    cache_key: &str,
    preview: &CachedPreview,
    ttl_seconds: i32,
) -> AppResult<()> {
    let preview_json = serde_json::to_value(preview)
        .map_err(|e| AppError::Internal(format!("Erreur sérialisation preview: {}", e)))?;

    sqlx::query(
        r#"
        SELECT set_cache($1, $2, $3)
        "#,
    )
    .bind(cache_key)
    .bind(preview_json)
    .bind(ttl_seconds)
    .execute(pool)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur mise en cache preview: {}", e)))?;

    info!(
        "[PreviewCache] ✅ Preview mise en cache: {} (TTL: {}s)",
        cache_key, ttl_seconds
    );

    Ok(())
}

/// ✅ Invalide une preview du cache
pub async fn invalidate_preview_cache(pool: &PgPool, cache_key: &str) -> AppResult<()> {
    sqlx::query(
        r#"
        SELECT delete_cache($1)
        "#,
    )
    .bind(cache_key)
    .execute(pool)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur invalidation cache preview: {}", e)))?;

    debug!("[PreviewCache] Cache invalidé: {}", cache_key);
    Ok(())
}

/// ✅ Invalide toutes les previews d'une session
pub async fn invalidate_session_previews(pool: &PgPool, session_id: &str) -> AppResult<()> {
    let pattern = format!("preview:*:{}:*", session_id);

    sqlx::query(
        r#"
        SELECT delete_cache_pattern($1)
        "#,
    )
    .bind(&pattern)
    .execute(pool)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur invalidation previews session: {}", e)))?;

    info!(
        "[PreviewCache] Previews de session invalidées: {}",
        session_id
    );
    Ok(())
}

/// ✅ Calcule le TTL optimal selon la qualité
pub fn get_preview_ttl(quality: &str) -> i32 {
    match quality {
        "low" => 3600,    // 1 heure pour previews basse qualité
        "medium" => 7200, // 2 heures pour previews moyenne qualité
        "high" => 14400,  // 4 heures pour previews haute qualité
        _ => 3600,
    }
}

/// ✅ Nettoie les previews expirées
pub async fn cleanup_expired_previews(pool: &PgPool) -> AppResult<i32> {
    let deleted = sqlx::query_scalar::<_, i32>(
        r#"
        SELECT cleanup_expired_cache()
        "#,
    )
    .fetch_one(pool)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur nettoyage cache previews: {}", e)))?;

    if deleted > 0 {
        info!(
            "[PreviewCache] ✅ {} preview(s) expirée(s) nettoyée(s)",
            deleted
        );
    }

    Ok(deleted)
}
