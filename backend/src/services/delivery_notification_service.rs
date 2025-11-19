// ✅ RECOMMANDATION 3: Service pour notifications SMS/Email pour clients sans app
// ✅ Phase 10 - Intégration complète Twilio, SendGrid et notifications internes
use crate::core::types::AppResult;
use crate::services::sms_service::SmsService;
use crate::services::email_service::EmailService;
use crate::services::notification_service::{self, NotificationType};
use serde_json::json;
use sqlx::PgPool;

/// ✅ Phase 10 - Envoyer une notification SMS via Twilio
pub async fn send_sms_notification(
    _pool: &PgPool,
    phone_number: &str,
    message: &str,
    _delivery_id: Option<&str>,
) -> AppResult<()> {
    let sms_service = SmsService::new();
    
    match sms_service.send_sms(phone_number, message).await {
        Ok(result) => {
            if result.success {
                log::info!(
                    "[DeliveryNotification] ✅ SMS envoyé avec succès à {} (ID: {:?})",
                    phone_number,
                    result.message_id
                );
            } else {
                log::warn!(
                    "[DeliveryNotification] ⚠️ Échec envoi SMS à {}: {:?}",
                    phone_number,
                    result.error
                );
            }
        }
        Err(e) => {
            log::error!(
                "[DeliveryNotification] ❌ Erreur envoi SMS à {}: {}",
                phone_number,
                e
            );
        }
    }
    
    Ok(())
}

/// ✅ Phase 10 - Envoyer une notification Email via SendGrid
pub async fn send_email_notification(
    _pool: &PgPool,
    email: &str,
    subject: &str,
    body: &str,
    _delivery_id: Option<&str>,
) -> AppResult<()> {
    let email_service = EmailService::new();
    
    match email_service.send_simple_email(email, subject, body).await {
        Ok(result) => {
            if result.success {
                log::info!(
                    "[DeliveryNotification] ✅ Email envoyé avec succès à {} (ID: {:?})",
                    email,
                    result.message_id
                );
            } else {
                log::warn!(
                    "[DeliveryNotification] ⚠️ Échec envoi email à {}: {:?}",
                    email,
                    result.error
                );
            }
        }
        Err(e) => {
            log::error!(
                "[DeliveryNotification] ❌ Erreur envoi email à {}: {}",
                email,
                e
            );
        }
    }
    
    Ok(())
}

/// Envoyer une notification SMS/Email/Interne pour un changement de statut de livraison
/// ✅ Phase 10 - Intègre les notifications internes Yukpo en plus de SMS/Email
pub async fn notify_delivery_status_change(
    pool: &PgPool,
    delivery_id: &str,
    status: &str,
    recipient_user_id: Option<i32>, // ✅ Phase 10 - ID utilisateur pour notification interne
    recipient_phone: Option<&str>,
    recipient_email: Option<&str>,
    recipient_name: Option<&str>,
) -> AppResult<()> {
    let (notification_type, subject, message) = match status {
        "accepted" => (
            NotificationType::DeliveryAccepted,
            "📦 Coursier assigné",
            format!(
                "Bonjour{},\n\nUn coursier a été assigné à votre livraison #{}. Vous serez informé des prochaines étapes.",
                recipient_name.map(|n| format!(" {}", n)).unwrap_or_default(),
                &delivery_id[..8]
            ),
        ),
        "picked_up" => (
            NotificationType::DeliveryPickedUp,
            "✅ Colis récupéré",
            format!(
                "Bonjour{},\n\nLe coursier a récupéré votre colis. Livraison #{}. Il est maintenant en route vers vous.",
                recipient_name.map(|n| format!(" {}", n)).unwrap_or_default(),
                &delivery_id[..8]
            ),
        ),
        "en_route_delivery" => (
            NotificationType::DeliveryInTransit,
            "🚚 En route vers vous",
            format!(
                "Bonjour{},\n\nLe coursier est en route vers vous. Livraison #{}.",
                recipient_name.map(|n| format!(" {}", n)).unwrap_or_default(),
                &delivery_id[..8]
            ),
        ),
        "delivered" => (
            NotificationType::DeliveryDelivered,
            "✅ Livraison effectuée",
            format!(
                "Bonjour{},\n\nVotre livraison #{} a été livrée avec succès !",
                recipient_name.map(|n| format!(" {}", n)).unwrap_or_default(),
                &delivery_id[..8]
            ),
        ),
        "cancelled" => (
            NotificationType::DeliveryCancelled,
            "❌ Livraison annulée",
            format!(
                "Bonjour{},\n\nVotre livraison #{} a été annulée.",
                recipient_name.map(|n| format!(" {}", n)).unwrap_or_default(),
                &delivery_id[..8]
            ),
        ),
        _ => return Ok(()), // Ne pas envoyer pour les autres statuts
    };

    // ✅ Phase 10 - Créer une notification interne Yukpo si user_id disponible
    if let Some(user_id) = recipient_user_id {
        let notification_data = json!({
            "delivery_id": delivery_id,
            "status": status,
            "recipient_name": recipient_name,
        });

        if let Err(e) = notification_service::create_notification(
            pool,
            user_id,
            notification_type.clone(),
            subject.to_string(),
            message.clone(),
            Some(notification_data),
        )
        .await
        {
            log::warn!(
                "[DeliveryNotification] ⚠️ Erreur création notification interne pour user {}: {}",
                user_id,
                e
            );
        } else {
            log::info!(
                "[DeliveryNotification] ✅ Notification interne créée pour user {} (delivery: {})",
                user_id,
                delivery_id
            );
        }
    }

    // Envoyer SMS si numéro disponible
    if let Some(phone) = recipient_phone {
        let _ = send_sms_notification(pool, phone, &message, Some(delivery_id)).await;
    }

    // Envoyer Email si email disponible
    if let Some(email) = recipient_email {
        let _ = send_email_notification(pool, email, subject, &message, Some(delivery_id)).await;
    }

    Ok(())
}

