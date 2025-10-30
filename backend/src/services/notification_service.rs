// Service de gestion des notifications en base de données
use sqlx::PgPool;
use serde::{Deserialize, Serialize};
use sqlx::Row;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum NotificationType {
    ServiceCreated,
    ServiceActivated,
    ServiceDeactivated,
    ServiceModified,
    ServiceDeleted,
    NewMessage,
    NewReview,
    SystemAlert,
    PaymentReceived,
}

impl NotificationType {
    pub fn as_str(&self) -> &str {
        match self {
            NotificationType::ServiceCreated => "service_created",
            NotificationType::ServiceActivated => "service_activated",
            NotificationType::ServiceDeactivated => "service_deactivated",
            NotificationType::ServiceModified => "service_modified",
            NotificationType::ServiceDeleted => "service_deleted",
            NotificationType::NewMessage => "new_message",
            NotificationType::NewReview => "new_review",
            NotificationType::SystemAlert => "system_alert",
            NotificationType::PaymentReceived => "payment_received",
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Notification {
    pub id: i32,
    pub user_id: i32,
    pub notification_type: String,
    pub title: String,
    pub message: String,
    pub data: Option<serde_json::Value>,
    pub is_read: bool,
    pub created_at: chrono::NaiveDateTime,
}

/// Créer une notification en base de données
pub async fn create_notification(
    pool: &PgPool,
    user_id: i32,
    notification_type: NotificationType,
    title: String,
    message: String,
    data: Option<serde_json::Value>,
) -> Result<i32, sqlx::Error> {
    log::info!("[NotificationService] Création notification pour user {}: {}", user_id, title);
    
    let row = sqlx::query(
        r#"
        INSERT INTO notifications (user_id, notification_type, title, message, data, is_read)
        VALUES ($1, $2, $3, $4, $5, FALSE)
        RETURNING id
        "#
    )
    .bind(user_id)
    .bind(notification_type.as_str())
    .bind(&title)
    .bind(&message)
    .bind(&data)
    .fetch_one(pool)
    .await?;
    
    let id: i32 = row.get("id");
    log::info!("[NotificationService] ✅ Notification créée: {}", id);
    
    Ok(id)
}

/// Récupérer les notifications d'un utilisateur
pub async fn get_user_notifications(
    pool: &PgPool,
    user_id: i32,
    limit: i64,
) -> Result<Vec<Notification>, sqlx::Error> {
    let rows = sqlx::query(
        r#"
        SELECT id, user_id, notification_type, title, message, data, is_read, created_at
        FROM notifications
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2
        "#
    )
    .bind(user_id)
    .bind(limit)
    .fetch_all(pool)
    .await?;
    
    let notifications = rows.iter().map(|row| Notification {
        id: row.get("id"),
        user_id: row.get("user_id"),
        notification_type: row.get("notification_type"),
        title: row.get("title"),
        message: row.get("message"),
        data: row.get("data"),
        is_read: row.get("is_read"),
        created_at: row.get("created_at"),
    }).collect();
    
    Ok(notifications)
}

/// Compter les notifications non lues
pub async fn count_unread_notifications(
    pool: &PgPool,
    user_id: i32,
) -> Result<i64, sqlx::Error> {
    let row = sqlx::query(
        "SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = FALSE"
    )
    .bind(user_id)
    .fetch_one(pool)
    .await?;
    
    let count: i64 = row.get("count");
    Ok(count)
}

/// Marquer une notification comme lue
pub async fn mark_notification_as_read(
    pool: &PgPool,
    notification_id: i32,
    user_id: i32,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query(
        "UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2"
    )
    .bind(notification_id)
    .bind(user_id)
    .execute(pool)
    .await?;
    
    Ok(result.rows_affected() > 0)
}

/// Marquer toutes les notifications comme lues
pub async fn mark_all_as_read(
    pool: &PgPool,
    user_id: i32,
) -> Result<u64, sqlx::Error> {
    let result = sqlx::query(
        "UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE"
    )
    .bind(user_id)
    .execute(pool)
    .await?;
    
    Ok(result.rows_affected())
}

/// Supprimer une notification spécifique
pub async fn delete_notification(
    pool: &PgPool,
    notification_id: i32,
    user_id: i32,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query(
        "DELETE FROM notifications WHERE id = $1 AND user_id = $2"
    )
    .bind(notification_id)
    .bind(user_id)
    .execute(pool)
    .await?;
    
    Ok(result.rows_affected() > 0)
}

/// Supprimer les anciennes notifications (nettoyage)
pub async fn cleanup_old_notifications(
    pool: &PgPool,
    days: i32,
) -> Result<u64, sqlx::Error> {
    log::info!("[NotificationService] Nettoyage des notifications de plus de {} jours", days);
    
    let result = sqlx::query(
        "DELETE FROM notifications WHERE created_at < NOW() - INTERVAL '1 day' * $1 AND is_read = TRUE"
    )
    .bind(days)
    .execute(pool)
    .await?;
    
    log::info!("[NotificationService] ✅ {} notifications supprimées", result.rows_affected());
    Ok(result.rows_affected())
}

