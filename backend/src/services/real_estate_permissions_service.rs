//! ✅ Service de permissions pour tous les biens immobiliers
//! 
//! Ce service fournit une fonction générique pour vérifier les permissions
//! de gestion d'un bien immobilier (propriétaire ou membre d'équipe)
//! 
//! Date: 2026-01-27

use crate::core::types::AppError;
use sqlx::PgPool;

/// Service de permissions pour biens immobiliers
pub struct RealEstatePermissionsService;

impl RealEstatePermissionsService {
    /// Vérifie qu'un utilisateur peut gérer une propriété immobilière
    /// 
    /// Cette fonction vérifie :
    /// 1. Si l'utilisateur est le propriétaire du service associé à la propriété
    /// 2. Si l'utilisateur est membre d'équipe avec permissions appropriées (admin, manager, editor)
    /// 
    /// Cette fonction est utilisée pour TOUS les types de biens immobiliers :
    /// - Hôtels et meublés
    /// - Appartements et maisons
    /// - Terrains
    /// - Autres biens immobiliers
    pub async fn ensure_user_can_manage_property(
        pool: &PgPool,
        acting_user_id: i32,
        property_id: i32,
    ) -> Result<(), AppError> {
        // Récupérer le service_id associé à la propriété
        let service_id: Option<i32> = sqlx::query_scalar(
            "SELECT service_id FROM real_estate_properties WHERE id = $1",
        )
        .bind(property_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| {
            log::error!(
                "[RealEstatePermissionsService] Erreur récupération service_id: {}",
                e
            );
            AppError::Internal("Erreur vérification propriété".to_string())
        })?;

        let service_id = match service_id {
            Some(id) => id,
            None => {
                return Err(AppError::NotFound(
                    "Propriété non trouvée".to_string(),
                ));
            }
        };

        // Vérifier si l'utilisateur est propriétaire du service
        let is_owner: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM services WHERE id = $1 AND user_id = $2)",
        )
        .bind(service_id)
        .bind(acting_user_id)
        .fetch_one(pool)
        .await
        .map_err(|e| {
            log::error!(
                "[RealEstatePermissionsService] Erreur vérification propriétaire: {}",
                e
            );
            AppError::Internal("Erreur vérification propriétaire".to_string())
        })?;

        if is_owner {
            return Ok(());
        }

        // Vérifier si l'utilisateur est membre d'équipe avec permissions
        let is_team_member: bool = sqlx::query_scalar(
            r#"
            SELECT EXISTS(
                SELECT 1 
                FROM service_team_members stm
                WHERE stm.service_id = $1 
                AND stm.user_id = $2 
                AND stm.is_active = TRUE
                AND stm.role_id IN ('admin', 'manager', 'editor')
            )
            "#,
        )
        .bind(service_id)
        .bind(acting_user_id)
        .fetch_one(pool)
        .await
        .map_err(|e| {
            log::error!(
                "[RealEstatePermissionsService] Erreur vérification membre équipe: {}",
                e
            );
            AppError::Internal("Erreur vérification membre équipe".to_string())
        })?;

        if is_team_member {
            return Ok(());
        }

        Err(AppError::Forbidden(
            "Vous n'avez pas les permissions nécessaires pour gérer cette propriété".to_string(),
        ))
    }
}



