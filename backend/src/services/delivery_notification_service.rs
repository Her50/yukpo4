// ✅ RECOMMANDATION 3: Service pour notifications SMS/Email pour clients sans app
use crate::core::types::AppResult;
use sqlx::PgPool;

/// Envoyer une notification SMS (structure préparée pour intégration future)
pub async fn send_sms_notification(
    _pool: &PgPool,
    phone_number: &str,
    message: &str,
    _delivery_id: Option<&str>,
) -> AppResult<()> {
    // TODO: Intégrer un service SMS (ex: Twilio, Orange SMS API, etc.)
    log::info!(
        "[DeliveryNotification] 📱 SMS à envoyer à {}: {}",
        phone_number,
        message
    );
    
    // Pour l'instant, on log juste l'information
    // Dans le futur, on pourrait appeler :
    // - Twilio API
    // - Orange SMS API
    // - Autre service SMS
    
    Ok(())
}

/// Envoyer une notification Email (structure préparée pour intégration future)
pub async fn send_email_notification(
    _pool: &PgPool,
    email: &str,
    subject: &str,
    body: &str,
    _delivery_id: Option<&str>,
) -> AppResult<()> {
    // TODO: Intégrer un service Email (ex: SendGrid, AWS SES, etc.)
    log::info!(
        "[DeliveryNotification] 📧 Email à envoyer à {}: {} - {}",
        email,
        subject,
        body
    );
    
    // Pour l'instant, on log juste l'information
    // Dans le futur, on pourrait appeler :
    // - SendGrid API
    // - AWS SES
    // - Autre service Email
    
    Ok(())
}

/// Envoyer une notification SMS/Email pour un changement de statut de livraison
pub async fn notify_delivery_status_change(
    pool: &PgPool,
    delivery_id: &str,
    status: &str,
    recipient_phone: Option<&str>,
    recipient_email: Option<&str>,
    recipient_name: Option<&str>,
) -> AppResult<()> {
    let (subject, message) = match status {
        "accepted" => (
            "📦 Coursier assigné",
            format!(
                "Bonjour{},\n\nUn coursier a été assigné à votre livraison #{}. Vous serez informé des prochaines étapes.",
                recipient_name.map(|n| format!(" {}", n)).unwrap_or_default(),
                &delivery_id[..8]
            ),
        ),
        "picked_up" => (
            "✅ Colis récupéré",
            format!(
                "Bonjour{},\n\nLe coursier a récupéré votre colis. Livraison #{}. Il est maintenant en route vers vous.",
                recipient_name.map(|n| format!(" {}", n)).unwrap_or_default(),
                &delivery_id[..8]
            ),
        ),
        "en_route_delivery" => (
            "🚚 En route vers vous",
            format!(
                "Bonjour{},\n\nLe coursier est en route vers vous. Livraison #{}.",
                recipient_name.map(|n| format!(" {}", n)).unwrap_or_default(),
                &delivery_id[..8]
            ),
        ),
        "delivered" => (
            "✅ Livraison effectuée",
            format!(
                "Bonjour{},\n\nVotre livraison #{} a été livrée avec succès !",
                recipient_name.map(|n| format!(" {}", n)).unwrap_or_default(),
                &delivery_id[..8]
            ),
        ),
        _ => return Ok(()), // Ne pas envoyer pour les autres statuts
    };

    // Envoyer SMS si numéro disponible
    if let Some(phone) = recipient_phone {
        let _ = send_sms_notification(pool, phone, &message, Some(delivery_id)).await;
    }

    // Envoyer Email si email disponible
    if let Some(email) = recipient_email {
        let _ = send_email_notification(pool, email, &subject, &message, Some(delivery_id)).await;
    }

    Ok(())
}

