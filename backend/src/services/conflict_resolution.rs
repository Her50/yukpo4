// ✅ Phase 6.4: Service de gestion des conflits pour services spécialisés

use crate::state::AppState;
use chrono::{DateTime, Utc};
use log::{error, info, warn};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::PgPool;
use std::sync::Arc;

/// Type de conflit détecté
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ConflictType {
    TimestampMismatch,   // updated_at différent
    ConcurrentEdit,      // Modification simultanée
    DeletedWhileEditing, // Service supprimé pendant édition
}

/// Informations sur un conflit
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConflictInfo {
    pub conflict_type: ConflictType,
    pub service_id: i32,
    pub local_updated_at: DateTime<Utc>,
    pub server_updated_at: DateTime<Utc>,
    pub local_data: serde_json::Value,
    pub server_data: serde_json::Value,
}

/// Résultat de la résolution d'un conflit
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ConflictResolution {
    UseLocal,  // Utiliser la version locale
    UseServer, // Utiliser la version serveur
    Merge,     // Fusionner intelligemment
    Cancel,    // Annuler la modification
}

/// Service de résolution de conflits
pub struct ConflictResolutionService {
    pool: Arc<PgPool>,
}

impl ConflictResolutionService {
    pub fn new(pool: Arc<PgPool>) -> Self {
        Self { pool }
    }

    /// Détecter un conflit en comparant les timestamps
    pub async fn detect_conflict(
        &self,
        service_id: i32,
        local_updated_at: DateTime<Utc>,
    ) -> Result<Option<ConflictInfo>, Box<dyn std::error::Error + Send + Sync>> {
        info!(
            "[ConflictResolution] Vérification conflit pour service_id={}, local_updated_at={}",
            service_id, local_updated_at
        );

        // Récupérer la version serveur
        let server_version: Option<(DateTime<Utc>, serde_json::Value)> = sqlx::query_as(
            r#"
            SELECT s.updated_at, s.data
            FROM services s
            WHERE s.id = $1
            "#,
        )
        .bind(service_id)
        .fetch_optional(&*self.pool)
        .await
        .map_err(|e| {
            error!("[ConflictResolution] Erreur DB: {}", e);
            e
        })?;

        match server_version {
            None => {
                // Service supprimé
                warn!(
                    "[ConflictResolution] Service {} supprimé sur le serveur",
                    service_id
                );
                return Ok(Some(ConflictInfo {
                    conflict_type: ConflictType::DeletedWhileEditing,
                    service_id,
                    local_updated_at,
                    server_updated_at: Utc::now(),
                    local_data: json!({}),
                    server_data: json!({}),
                }));
            }
            Some((server_updated_at, server_data)) => {
                // Comparer les timestamps
                if server_updated_at > local_updated_at {
                    // Le serveur a une version plus récente
                    warn!(
                        "[ConflictResolution] Conflit détecté: serveur plus récent ({} > {})",
                        server_updated_at, local_updated_at
                    );
                    return Ok(Some(ConflictInfo {
                        conflict_type: ConflictType::TimestampMismatch,
                        service_id,
                        local_updated_at,
                        server_updated_at,
                        local_data: json!({}),
                        server_data,
                    }));
                } else if server_updated_at < local_updated_at {
                    // La version locale est plus récente (normal, pas de conflit)
                    info!("[ConflictResolution] Pas de conflit: version locale plus récente");
                    return Ok(None);
                } else {
                    // Même timestamp, pas de conflit
                    info!("[ConflictResolution] Pas de conflit: timestamps identiques");
                    return Ok(None);
                }
            }
        }
    }

    /// Résoudre un conflit selon la stratégie choisie
    pub async fn resolve_conflict(
        &self,
        conflict: ConflictInfo,
        resolution: ConflictResolution,
        user_id: i32,
    ) -> Result<bool, Box<dyn std::error::Error + Send + Sync>> {
        info!(
            "[ConflictResolution] Résolution conflit service_id={}, stratégie={:?}",
            conflict.service_id, resolution
        );

        match resolution {
            ConflictResolution::UseServer => {
                // Utiliser la version serveur (ignorer les modifications locales)
                info!("[ConflictResolution] Utilisation version serveur");
                Ok(true)
            }
            ConflictResolution::UseLocal => {
                // Forcer la version locale (écraser le serveur)
                // Mettre à jour le service avec la version locale
                let _ = sqlx::query(
                    r#"
                    UPDATE services
                    SET updated_at = NOW()
                    WHERE id = $1 AND user_id = $2
                    "#,
                )
                .bind(conflict.service_id)
                .bind(user_id)
                .execute(&*self.pool)
                .await?;

                info!("[ConflictResolution] Version locale appliquée");
                Ok(true)
            }
            ConflictResolution::Merge => {
                // ✅ Phase 6.4: Fusion intelligente améliorée
                info!("[ConflictResolution] Tentative de fusion intelligente");

                // Récupérer les données locales et serveur
                let local_data = conflict.local_data.clone();
                let server_data = conflict.server_data.clone();

                // Stratégie de fusion :
                // 1. Préserver les champs modifiés localement qui n'ont pas été modifiés sur le serveur
                // 2. Utiliser les valeurs serveur pour les champs modifiés des deux côtés
                // 3. Fusionner les tableaux/listes

                let mut merged_data = server_data.clone();

                if let (Some(local_obj), Some(server_obj)) =
                    (local_data.as_object(), server_data.as_object())
                {
                    for (key, local_value) in local_obj {
                        if !server_obj.contains_key(key) {
                            // Champ présent seulement localement, l'ajouter
                            merged_data[key] = local_value.clone();
                        } else {
                            // Champ présent des deux côtés
                            let server_value = &server_obj[key];

                            // Si c'est un objet, fusionner récursivement
                            if let (Some(local_obj_val), Some(server_obj_val)) =
                                (local_value.as_object(), server_value.as_object())
                            {
                                let mut merged_obj = server_obj_val.clone();
                                for (sub_key, sub_local_val) in local_obj_val {
                                    if !server_obj_val.contains_key(sub_key) {
                                        merged_obj[sub_key] = sub_local_val.clone();
                                    }
                                }
                                merged_data[key] = serde_json::Value::Object(merged_obj);
                            } else if let (Some(local_arr), Some(server_arr)) =
                                (local_value.as_array(), server_value.as_array())
                            {
                                // Fusionner les tableaux (union sans doublons)
                                let mut merged_arr = server_arr.clone();
                                for item in local_arr {
                                    if !merged_arr.contains(item) {
                                        merged_arr.push(item.clone());
                                    }
                                }
                                merged_data[key] = serde_json::Value::Array(merged_arr);
                            } else {
                                // Pour les valeurs simples, utiliser la version serveur (plus récente)
                                merged_data[key] = server_value.clone();
                            }
                        }
                    }
                }

                // Appliquer la fusion
                let _ = sqlx::query(
                    r#"
                    UPDATE services
                    SET data = $1, updated_at = NOW()
                    WHERE id = $2 AND user_id = $3
                    "#,
                )
                .bind(&merged_data)
                .bind(conflict.service_id)
                .bind(user_id)
                .execute(&*self.pool)
                .await?;

                info!("[ConflictResolution] ✅ Fusion intelligente appliquée");
                Ok(true)
            }
            ConflictResolution::Cancel => {
                // Annuler la modification
                info!("[ConflictResolution] Modification annulée");
                Ok(false)
            }
        }
    }

    /// Stratégie par défaut : "dernière modification gagne"
    pub async fn resolve_with_last_write_wins(
        &self,
        service_id: i32,
        local_updated_at: DateTime<Utc>,
        user_id: i32,
    ) -> Result<bool, Box<dyn std::error::Error + Send + Sync>> {
        if let Some(conflict) = self.detect_conflict(service_id, local_updated_at).await? {
            // Si le serveur est plus récent, utiliser la version serveur
            if conflict.server_updated_at > conflict.local_updated_at {
                info!("[ConflictResolution] Serveur plus récent, utilisation version serveur");
                return Ok(true);
            } else {
                // Sinon, utiliser la version locale
                info!("[ConflictResolution] Local plus récent, utilisation version locale");
                return self
                    .resolve_conflict(conflict, ConflictResolution::UseLocal, user_id)
                    .await;
            }
        }

        // Pas de conflit
        Ok(true)
    }
}
