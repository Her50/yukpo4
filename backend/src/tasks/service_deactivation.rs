use chrono::Utc;
use sqlx::PgPool;
use log::{info};

/// ⚠️ DÉSACTIVÉ - La logique de désactivation automatique a été déplacée vers les PRODUITS
/// Les services ne sont plus désactivés automatiquement
/// Voir: backend/src/tasks/product_deactivation.rs pour la nouvelle logique
#[deprecated(note = "Logique de désactivation déplacée vers les produits. Utiliser product_deactivation::deactivate_expired_products()")]
pub async fn desactiver_services_tarissables(_pool: &PgPool) -> Result<(), sqlx::Error> {
    // Cette fonction est maintenant un no-op (ne fait rien)
    // La désactivation automatique est gérée au niveau des PRODUITS, pas des SERVICES
    log::info!("⚠️ [ServiceDeactivation] DEPRECATED - Utiliser product_deactivation pour désactiver les produits");
    Ok(())
}

/// ?? Envoie des alertes aux prestataires pour les services d?sactiv?s
pub async fn envoyer_alertes_prestataires(pool: &PgPool) -> Result<(), sqlx::Error> {
    let maintenant = Utc::now();
    let il_y_a_24_heures = (maintenant - chrono::Duration::hours(24)).naive_utc();

    // R?cup?rer les services d?sactiv?s sans alerte r?cente
    let services = sqlx::query!(
        r#"
        SELECT id, user_id, last_alert_sent_at
        FROM services
        WHERE is_active = FALSE
          AND is_tarissable = TRUE
          AND (last_alert_sent_at IS NULL OR last_alert_sent_at < $1)
        "#,
        il_y_a_24_heures
    )
    .fetch_all(pool)
    .await?;

    for service in services {
        // Envoyer une alerte au prestataire (par email ou notification)
        info!("Envoi d'une alerte pour le service {} au prestataire {}", service.id, service.user_id);

        // Correction pour convertir `maintenant` en NaiveDateTime
        let maintenant_naive = maintenant.naive_utc();

        // Mettre ? jour la date de la derni?re alerte
        sqlx::query!(
            "UPDATE services SET last_alert_sent_at = $1 WHERE id = $2",
            maintenant_naive,
            service.id
        )
        .execute(pool)
        .await?;
    }

    Ok(())
}

/// ?? Permet au prestataire de confirmer la d?sactivation d'un service
pub async fn confirmer_desactivation(
    pool: &PgPool,
    service_id: i32,
    user_id: i32,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        "UPDATE services SET is_active = FALSE WHERE id = $1 AND user_id = $2",
        service_id,
        user_id
    )
    .execute(pool)
    .await?;

    Ok(())
}

/// ?? Réactive un service désactivé avec paiement du coût de réactivation
pub async fn reactiver_service(
    pool: &PgPool,
    service_id: i32,
    user_id: i32,
) -> Result<bool, sqlx::Error> {
    const COUT_REACTIVATION: i64 = 1000; // 1000 FCFA pour la réactivation
    
    // Vérifier que le service existe et appartient à l'utilisateur
    let service = sqlx::query!(
        "SELECT id, user_id, is_active FROM services WHERE id = $1 AND user_id = $2",
        service_id,
        user_id
    )
    .fetch_optional(pool)
    .await?;

    match service {
        Some(service) => {
            if service.is_active {
                return Ok(false); // Service déjà actif
            }

            // Vérifier le solde de l'utilisateur
            let user_balance = sqlx::query!(
                "SELECT tokens_balance FROM users WHERE id = $1",
                user_id
            )
            .fetch_optional(pool)
            .await?;

            match user_balance {
                Some(user) => {
                    if user.tokens_balance >= COUT_REACTIVATION {
                        // Débiter le coût de réactivation
                        sqlx::query!(
                            "UPDATE users SET tokens_balance = tokens_balance - $1 WHERE id = $2",
                            COUT_REACTIVATION,
                            user_id
                        )
                        .execute(pool)
                        .await?;

                        // Réactiver le service
                        sqlx::query!(
                            "UPDATE services SET is_active = TRUE, updated_at = NOW() WHERE id = $1",
                            service_id
                        )
                        .execute(pool)
                        .await?;

                        info!("Service {} réactivé par l'utilisateur {} pour {} FCFA", service_id, user_id, COUT_REACTIVATION);
                        Ok(true)
                    } else {
                        Ok(false) // Solde insuffisant
                    }
                }
                None => Ok(false) // Utilisateur non trouvé
            }
        }
        None => Ok(false) // Service non trouvé
    }
}

/// ?? Récupère le coût de réactivation actuel
pub fn get_cout_reactivation() -> i32 {
    1000 // 1000 FCFA
}





