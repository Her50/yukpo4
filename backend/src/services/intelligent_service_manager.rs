use sqlx::PgPool;
use chrono::{Utc, Duration};
use crate::core::types::AppError;
use log::info;

/// Coût de base pour la réactivation d'un service (1000 FCFA)
const COUT_REACTIVATION_BASE: i64 = 1000;

/// 🚀 Fonction publique pour traiter les services expirés intelligemment
pub async fn process_expired_services_intelligently(pool: &PgPool) -> Result<ProcessResult, AppError> {
    let now = Utc::now();
    let mut result = ProcessResult::new();

    // 1. Traiter les services non tarissables expirés
    let expired_non_tarissable = sqlx::query!(
        r#"
        SELECT s.id, s.user_id, u.tokens_balance
        FROM services s
        JOIN users u ON s.user_id = u.id
        WHERE s.is_active = TRUE
          AND s.is_tarissable = FALSE
          AND s.auto_deactivate_at IS NOT NULL
          AND s.auto_deactivate_at < $1
        "#,
        now
    )
    .fetch_all(pool)
    .await
    .map_err(AppError::from)?;

    for service in expired_non_tarissable {
        let balance = service.tokens_balance;
        
        if balance >= COUT_REACTIVATION_BASE {
            // 💰 Solde suffisant : Renouvellement automatique
            let updated_balance = sqlx::query!(
                "UPDATE users SET tokens_balance = tokens_balance - $1 WHERE id = $2 RETURNING tokens_balance",
                COUT_REACTIVATION_BASE,
                service.user_id
            )
            .fetch_one(pool)
            .await
            .map_err(AppError::from)?
            .tokens_balance;

            // Réactiver le service pour 30 jours
            let new_expiry = now + Duration::days(30);
            sqlx::query!(
                "UPDATE services SET is_active = TRUE, auto_deactivate_at = $1, updated_at = NOW() WHERE id = $2",
                new_expiry,
                service.id
            )
            .execute(pool)
            .await
            .map_err(AppError::from)?;

            // Logger l'action
            sqlx::query!(
                "INSERT INTO service_logs (service_id, user_id, action, reason, created_at) VALUES ($1, $2, $3, $4, $5)",
                service.id,
                service.user_id,
                "auto_renewal",
                &format!("Renouvellement automatique pour {} FCFA", COUT_REACTIVATION_BASE),
                Utc::now().naive_utc()
            )
            .execute(pool)
            .await
            .map_err(AppError::from)?;

            result.auto_renewed += 1;
            result.total_debited += COUT_REACTIVATION_BASE;
            
            info!("✅ Service {} (utilisateur {}) renouvelé automatiquement pour {} FCFA (solde restant: {})", 
                  service.id, service.user_id, COUT_REACTIVATION_BASE, updated_balance);
        } else {
            // 🚫 Solde insuffisant : Désactivation
            sqlx::query!(
                "UPDATE services SET is_active = FALSE, updated_at = NOW() WHERE id = $1",
                service.id
            )
            .execute(pool)
            .await
            .map_err(AppError::from)?;

            // Logger l'action
            sqlx::query!(
                "INSERT INTO service_logs (service_id, user_id, action, reason, created_at) VALUES ($1, $2, $3, $4, $5)",
                service.id,
                service.user_id,
                "deactivated_insufficient_balance",
                &format!("Solde insuffisant ({} FCFA < {} FCFA requis)", balance, COUT_REACTIVATION_BASE),
                Utc::now().naive_utc()
            )
            .execute(pool)
            .await
            .map_err(AppError::from)?;

            result.manually_deactivated += 1;
            
            info!("❌ Service {} (utilisateur {}) désactivé: Solde insuffisant ({} FCFA)", 
                  service.id, service.user_id, balance);
        }
    }

    // 2. Traiter les services tarissables selon leur vitesse de tarissement (version simplifiée)
    // Désactiver les services tarissables rapides (7 jours)
    let rapid_count = sqlx::query!(
        r#"
        UPDATE services 
        SET is_active = FALSE 
        WHERE is_active = TRUE 
          AND is_tarissable = TRUE 
          AND vitesse_tarissement = 'rapide'
          AND updated_at < NOW() - INTERVAL '7 days'
        RETURNING id
        "#,
    )
    .fetch_all(pool)
    .await
    .map_err(AppError::from)?;

    for service in rapid_count {
        result.tarissable_deactivated += 1;
        info!("🍎 Service tarissable rapide {} désactivé (7 jours)", service.id);
    }

    // Désactiver les services tarissables moyens (14 jours)
    let medium_count = sqlx::query!(
        r#"
        UPDATE services 
        SET is_active = FALSE 
        WHERE is_active = TRUE 
          AND is_tarissable = TRUE 
          AND vitesse_tarissement = 'moyenne'
          AND updated_at < NOW() - INTERVAL '14 days'
        RETURNING id
        "#,
    )
    .fetch_all(pool)
    .await
    .map_err(AppError::from)?;

    for service in medium_count {
        result.tarissable_deactivated += 1;
        info!("🍎 Service tarissable moyen {} désactivé (14 jours)", service.id);
    }

    // Désactiver les services tarissables lents (30 jours)
    let slow_count = sqlx::query!(
        r#"
        UPDATE services 
        SET is_active = FALSE 
        WHERE is_active = TRUE 
          AND is_tarissable = TRUE 
          AND vitesse_tarissement = 'lente'
          AND updated_at < NOW() - INTERVAL '30 days'
        RETURNING id
        "#,
    )
    .fetch_all(pool)
    .await
    .map_err(AppError::from)?;

    for service in slow_count {
        result.tarissable_deactivated += 1;
        info!("🍎 Service tarissable lent {} désactivé (30 jours)", service.id);
    }

    Ok(result)
}

/// 📊 Résultat du traitement des services
#[derive(Debug, Default)]
pub struct ProcessResult {
    pub auto_renewed: u32,
    pub manually_deactivated: u32,
    pub tarissable_deactivated: u32,
    pub total_debited: i64,
    pub errors: u32,
}

impl ProcessResult {
    fn new() -> Self {
        Self::default()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_process_result_creation() {
        let result = ProcessResult::new();
        assert_eq!(result.auto_renewed, 0);
        assert_eq!(result.manually_deactivated, 0);
        assert_eq!(result.tarissable_deactivated, 0);
        assert_eq!(result.total_debited, 0);
        assert_eq!(result.errors, 0);
        
        println!("✅ ProcessResult créé avec succès");
    }

    #[test]
    fn test_constants() {
        assert_eq!(COUT_REACTIVATION_BASE, 1000);
        println!("✅ Constantes définies correctement");
    }
}
