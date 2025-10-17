// Service de notifications système
use sqlx::PgPool;
use serde_json::json;
use log::{info, error};

/// Type de notification
#[derive(Debug, Clone)]
pub enum NotificationType {
    ServiceCreated,
    ServiceActivated,
    ServiceDeactivated,
    ServiceDeleted,
    LowBalance,
    PaymentReceived,
    NewMessage,
    NewReview,
}

impl NotificationType {
    pub fn as_str(&self) -> &'static str {
        match self {
            NotificationType::ServiceCreated => "service_created",
            NotificationType::ServiceActivated => "service_activated",
            NotificationType::ServiceDeactivated => "service_deactivated",
            NotificationType::ServiceDeleted => "service_deleted",
            NotificationType::LowBalance => "low_balance",
            NotificationType::PaymentReceived => "payment_received",
            NotificationType::NewMessage => "new_message",
            NotificationType::NewReview => "new_review",
        }
    }
}

/// Créer une notification
pub async fn create_notification(
    pool: &PgPool,
    user_id: i32,
    notification_type: NotificationType,
    title: String,
    message: String,
    data: Option<serde_json::Value>,
) -> Result<i32, sqlx::Error> {
    let type_str = notification_type.as_str();
    
    info!("[NotificationService] Création notification pour user {}: {}", user_id, title);
    
    let result = sqlx::query_scalar!(
        r#"
        INSERT INTO notifications (user_id, type, title, message, data, is_read, created_at)
        VALUES ($1, $2, $3, $4, $5, FALSE, CURRENT_TIMESTAMP)
        RETURNING id
        "#,
        user_id,
        type_str,
        title,
        message,
        data
    )
    .fetch_one(pool)
    .await?;
    
    info!("[NotificationService] ✅ Notification créée avec ID: {}", result);
    Ok(result)
}

/// Récupérer toutes les notifications d'un utilisateur
pub async fn get_user_notifications(
    pool: &PgPool,
    user_id: i32,
    limit: i64,
) -> Result<Vec<serde_json::Value>, sqlx::Error> {
    info!("[NotificationService] Récupération notifications pour user {}", user_id);
    
    let rows = sqlx::query!(
        r#"
        SELECT id, type, title, message, data, is_read, created_at, read_at
        FROM notifications
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2
        "#,
        user_id,
        limit
    )
    .fetch_all(pool)
    .await?;
    
    let notifications: Vec<serde_json::Value> = rows
        .into_iter()
        .map(|row| {
            json!({
                "id": row.id,
                "type": row.r#type,
                "title": row.title,
                "message": row.message,
                "data": row.data,
                "isRead": row.is_read,
                "createdAt": row.created_at,
                "readAt": row.read_at
            })
        })
        .collect();
    
    info!("[NotificationService] ✅ {} notifications trouvées", notifications.len());
    Ok(notifications)
}

/// Marquer une notification comme lue
pub async fn mark_notification_as_read(
    pool: &PgPool,
    notification_id: i32,
    user_id: i32,
) -> Result<bool, sqlx::Error> {
    info!("[NotificationService] Marquage notification {} comme lue pour user {}", notification_id, user_id);
    
    let result = sqlx::query!(
        r#"
        UPDATE notifications
        SET is_read = TRUE, read_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND user_id = $2
        RETURNING id
        "#,
        notification_id,
        user_id
    )
    .fetch_optional(pool)
    .await?;
    
    Ok(result.is_some())
}

/// Marquer toutes les notifications d'un utilisateur comme lues
pub async fn mark_all_as_read(
    pool: &PgPool,
    user_id: i32,
) -> Result<u64, sqlx::Error> {
    info!("[NotificationService] Marquage de toutes les notifications comme lues pour user {}", user_id);
    
    let result = sqlx::query!(
        r#"
        UPDATE notifications
        SET is_read = TRUE, read_at = CURRENT_TIMESTAMP
        WHERE user_id = $1 AND is_read = FALSE
        "#,
        user_id
    )
    .execute(pool)
    .await?;
    
    let count = result.rows_affected();
    info!("[NotificationService] ✅ {} notifications marquées comme lues", count);
    Ok(count)
}

/// Compter les notifications non lues
pub async fn count_unread_notifications(
    pool: &PgPool,
    user_id: i32,
) -> Result<i64, sqlx::Error> {
    let count = sqlx::query_scalar!(
        r#"
        SELECT COUNT(*)::bigint as "count!"
        FROM notifications
        WHERE user_id = $1 AND is_read = FALSE
        "#,
        user_id
    )
    .fetch_one(pool)
    .await?;
    
    Ok(count)
}

/// Supprimer les anciennes notifications (plus de 90 jours)
pub async fn cleanup_old_notifications(
    pool: &PgPool,
    days: i32,
) -> Result<u64, sqlx::Error> {
    info!("[NotificationService] Nettoyage des notifications de plus de {} jours", days);
    
    let result = sqlx::query!(
        r#"
        DELETE FROM notifications
        WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '1 day' * $1
        "#,
        days
    )
    .execute(pool)
    .await?;
    
    let count = result.rows_affected();
    info!("[NotificationService] ✅ {} anciennes notifications supprimées", count);
    Ok(count)
}

// Pour push notification et emails, prévoir une intégration future
pub async fn send_email_notification(_pool: &PgPool, _user_id: i32, _subject: &str, _body: &str) {
    // TODO: Intégrer un vrai service SMTP ou API email (Mailgun, Sendgrid, etc.)
    // Pour l'instant, log seulement
    println!("[NOTIF] Email à {}: {} - {}", _user_id, _subject, _body);
}
