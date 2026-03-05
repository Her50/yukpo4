// Service de gestion des notifications en base de données
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum NotificationType {
    ServiceCreated,
    ServiceActivated,
    ServiceDeactivated,
    ServiceModified,
    ServiceDeleted,
    ProductAdded, // ✅ NOUVEAU 2025-11-01
    NewMessage,
    NewReview,
    CommentReply,
    CommentMention,
    SystemAlert,
    PaymentReceived,
    LiveScheduled,
    LiveLiveNow,
    LiveReplayReady,
    LiveFlashSaleScheduled,
    LiveFlashSaleLive,
    LiveFlashSaleEndingSoon,
    LiveFlashSaleCommentary,
    GlobalPromoLive,
    GlobalPromoEntryPublished,
    GlobalPromoEntryEnded,
    GlobalPromoEntryApproved,
    GlobalPromoEntryRejected,
    GlobalPromoEventCreated, // ✅ NOUVEAU : Notification pour la création d'un événement Black Friday
    ProductDeliveryConfigMissing,
    // ✅ Phase 10 - Notifications de livraison
    DeliveryAccepted,
    DeliveryEnRoutePickup,
    DeliveryArrivalPickup,
    DeliveryPickedUp,
    DeliveryShoppingInProgress,
    DeliveryShoppingCompleted,
    DeliveryInTransit,
    DeliveryArrivalDestination,
    DeliveryDelivered,
    DeliveryCancelled,
    // ✅ NOUVEAU: Notifications de candidature coursier
    CourierApplicationApproved,
    CourierApplicationRejected,
    // ✅ NOUVEAU: Notifications de validation partenaire
    PartnerApplicationApproved,
    PartnerApplicationRejected,
}

impl NotificationType {
    pub fn as_str(&self) -> &str {
        match self {
            NotificationType::ServiceCreated => "service_created",
            NotificationType::ServiceActivated => "service_activated",
            NotificationType::ServiceDeactivated => "service_deactivated",
            NotificationType::ServiceModified => "service_modified",
            NotificationType::ServiceDeleted => "service_deleted",
            NotificationType::ProductAdded => "product_added", // ✅ NOUVEAU 2025-11-01
            NotificationType::NewMessage => "new_message",
            NotificationType::NewReview => "new_review",
            NotificationType::CommentReply => "comment_reply",
            NotificationType::CommentMention => "comment_mention",
            NotificationType::SystemAlert => "system_alert",
            NotificationType::PaymentReceived => "payment_received",
            NotificationType::LiveScheduled => "live_scheduled",
            NotificationType::LiveLiveNow => "live_live_now",
            NotificationType::LiveReplayReady => "live_replay_ready",
            NotificationType::LiveFlashSaleScheduled => "live_flash_sale_scheduled",
            NotificationType::LiveFlashSaleLive => "live_flash_sale_live",
            NotificationType::LiveFlashSaleEndingSoon => "live_flash_sale_ending_soon",
            NotificationType::LiveFlashSaleCommentary => "live_flash_sale_commentary",
            NotificationType::GlobalPromoLive => "global_promo_live",
            NotificationType::GlobalPromoEntryPublished => "global_promo_entry_published",
            NotificationType::GlobalPromoEntryEnded => "global_promo_entry_ended",
            NotificationType::GlobalPromoEntryApproved => "global_promo_entry_approved",
            NotificationType::GlobalPromoEntryRejected => "global_promo_entry_rejected",
            NotificationType::GlobalPromoEventCreated => "global_promo_event_created", // ✅ NOUVEAU
            NotificationType::ProductDeliveryConfigMissing => "product_delivery_config_missing",
            // ✅ Phase 10 - Notifications de livraison
            NotificationType::DeliveryAccepted => "delivery_accepted",
            NotificationType::DeliveryEnRoutePickup => "delivery_en_route_pickup",
            NotificationType::DeliveryArrivalPickup => "delivery_arrival_pickup",
            NotificationType::DeliveryPickedUp => "delivery_picked_up",
            NotificationType::DeliveryShoppingInProgress => "delivery_shopping_in_progress",
            NotificationType::DeliveryShoppingCompleted => "delivery_shopping_completed",
            NotificationType::DeliveryInTransit => "delivery_in_transit",
            NotificationType::DeliveryArrivalDestination => "delivery_arrival_destination",
            NotificationType::DeliveryDelivered => "delivery_delivered",
            NotificationType::DeliveryCancelled => "delivery_cancelled",
            // ✅ NOUVEAU: Notifications de candidature coursier
            NotificationType::CourierApplicationApproved => "courier_application_approved",
            NotificationType::CourierApplicationRejected => "courier_application_rejected",
            // ✅ NOUVEAU: Notifications de validation partenaire
            NotificationType::PartnerApplicationApproved => "partner_application_approved",
            NotificationType::PartnerApplicationRejected => "partner_application_rejected",
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
    pub created_at: DateTime<Utc>,
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
    log::info!(
        "[NotificationService] Création notification pour user {}: {}",
        user_id,
        title
    );

    // ✅ CORRECTION: Utiliser le bon nom de colonne (notification_type au lieu de type)
    let row = sqlx::query(
        r#"
        INSERT INTO notifications (user_id, notification_type, title, message, data, is_read)
        VALUES ($1, $2, $3, $4, $5, FALSE)
        RETURNING id
        "#,
    )
    .bind(user_id)
    .bind(notification_type.as_str())
    .bind(&title)
    .bind(&message)
    .bind(&data)
    .fetch_one(pool)
    .await?;

    let id: i32 = row.get::<i32, _>("id");
    log::info!("[NotificationService] ✅ Notification créée: {}", id);

    Ok(id)
}

/// Récupérer les notifications d'un utilisateur
pub async fn get_user_notifications(
    pool: &PgPool,
    user_id: i32,
    limit: i64,
) -> Result<Vec<Notification>, sqlx::Error> {
    // ✅ CORRECTION: Utiliser COALESCE pour gérer les deux noms de colonnes possibles (type ou notification_type)
    let rows = sqlx::query(
        r#"
        SELECT 
            id, 
            user_id, 
            COALESCE(notification_type, type) as notification_type,
            title, 
            message, 
            data, 
            is_read, 
            created_at
        FROM notifications
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2
        "#,
    )
    .bind(user_id)
    .bind(limit)
    .fetch_all(pool)
    .await?;

    let notifications: Result<Vec<Notification>, sqlx::Error> = rows
        .into_iter()
        .map(|row| {
            Ok(Notification {
                id: row.get::<i32, _>("id"),
                user_id: row.get::<i32, _>("user_id"),
                notification_type: row.get::<String, _>("notification_type"),
                title: row.get::<String, _>("title"),
                message: row.get::<String, _>("message"),
                data: row.get::<Option<serde_json::Value>, _>("data"),
                is_read: row.get::<bool, _>("is_read"),
                created_at: row.get::<DateTime<Utc>, _>("created_at"),
            })
        })
        .collect();

    notifications
}

/// Compter les notifications non lues
pub async fn count_unread_notifications(pool: &PgPool, user_id: i32) -> Result<i64, sqlx::Error> {
    let row = sqlx::query(
        "SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = FALSE",
    )
    .bind(user_id)
    .fetch_one(pool)
    .await?;

    let count: i64 = row.get::<i64, _>("count");
    Ok(count)
}

/// Marquer une notification comme lue
pub async fn mark_notification_as_read(
    pool: &PgPool,
    notification_id: i32,
    user_id: i32,
) -> Result<bool, sqlx::Error> {
    let result =
        sqlx::query("UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2")
            .bind(notification_id)
            .bind(user_id)
            .execute(pool)
            .await?;

    Ok(result.rows_affected() > 0)
}

/// Marquer toutes les notifications comme lues
pub async fn mark_all_as_read(pool: &PgPool, user_id: i32) -> Result<u64, sqlx::Error> {
    let result = sqlx::query(
        "UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE",
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
    let result = sqlx::query("DELETE FROM notifications WHERE id = $1 AND user_id = $2")
        .bind(notification_id)
        .bind(user_id)
        .execute(pool)
        .await?;

    Ok(result.rows_affected() > 0)
}

/// Supprimer les anciennes notifications (nettoyage)
pub async fn cleanup_old_notifications(pool: &PgPool, days: i32) -> Result<u64, sqlx::Error> {
    log::info!(
        "[NotificationService] Nettoyage des notifications de plus de {} jours",
        days
    );

    let result = sqlx::query(
        "DELETE FROM notifications WHERE created_at < NOW() - INTERVAL '1 day' * $1 AND is_read = TRUE"
    )
    .bind(days)
    .execute(pool)
    .await?;

    log::info!(
        "[NotificationService] ✅ {} notifications supprimées",
        result.rows_affected()
    );
    Ok(result.rows_affected())
}
