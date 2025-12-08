// ✅ Phase 6.1: Service de notifications intelligentes pour services spécialisés

use crate::services::gps_matching::{
    find_matching_carpools, find_taxis_in_zone, find_users_in_radius,
};
use crate::services::push_notification_service;
use log::{error, info, warn};
use serde_json::json;
use sqlx::PgPool;
use std::sync::Arc;

/// Types de notifications pour services spécialisés
#[derive(Debug, Clone)]
pub enum SpecializedNotificationType {
    PharmacyOnDuty, // Pharmacie de garde
    CarpoolMatch,   // Covoiturage correspondant
    TaxiNearby,     // Taxi dans la zone
    WeeklySummary,  // Résumé hebdomadaire
}

/// Données pour une notification
#[derive(Debug, Clone)]
pub struct SpecializedNotification {
    pub user_id: i32,
    pub notification_type: SpecializedNotificationType,
    pub title: String,
    pub message: String,
    pub data: serde_json::Value,
}

/// Service de notifications pour services spécialisés
pub struct SpecializedNotificationsService {
    pool: Arc<PgPool>,
}

impl SpecializedNotificationsService {
    pub fn new(pool: Arc<PgPool>) -> Self {
        Self { pool }
    }

    /// Envoyer une notification à un utilisateur
    pub async fn send_notification(
        &self,
        notification: SpecializedNotification,
    ) -> Result<(), Box<dyn std::error::Error>> {
        info!(
            "[SpecializedNotifications] Envoi notification type={:?} à user_id={}",
            notification.notification_type, notification.user_id
        );

        let notification_type_str = match notification.notification_type {
            SpecializedNotificationType::PharmacyOnDuty => "pharmacy_on_duty",
            SpecializedNotificationType::CarpoolMatch => "carpool_match",
            SpecializedNotificationType::TaxiNearby => "taxi_nearby",
            SpecializedNotificationType::WeeklySummary => "weekly_summary",
        };

        // ✅ Phase 6.1: Envoyer push notification via le service existant
        let _ = push_notification_service::send_push_notification(
            &*self.pool,
            notification.user_id,
            notification.title.clone(),
            notification.message.clone(),
            Some(notification.data.clone()),
            Some("default".to_string()),
        )
        .await;

        // Insérer dans la table notifications si elle existe
        let _ = sqlx::query(
            r#"
            INSERT INTO notifications (user_id, type, title, message, data, created_at)
            VALUES ($1, $2, $3, $4, $5, NOW())
            ON CONFLICT DO NOTHING
            "#,
        )
        .bind(notification.user_id)
        .bind(notification_type_str)
        .bind(&notification.title)
        .bind(&notification.message)
        .bind(&notification.data)
        .execute(&*self.pool)
        .await;

        info!("[SpecializedNotifications] ✅ Notification envoyée");
        Ok(())
    }

    /// Notifier les utilisateurs des pharmacies de garde
    /// ✅ Phase 6.1: Trouve automatiquement les utilisateurs dans la zone si coordonnées disponibles
    pub async fn notify_pharmacy_on_duty(
        &self,
        pharmacy_id: i32,
        pharmacy_name: String,
        user_ids: Option<Vec<i32>>,
        pharmacy_lat: Option<f64>,
        pharmacy_lon: Option<f64>,
        radius_km: f64,
    ) -> Result<(), Box<dyn std::error::Error>> {
        info!(
            "[SpecializedNotifications] Notification pharmacie de garde: {}",
            pharmacy_name
        );

        let mut final_user_ids = user_ids.unwrap_or_default();

        // ✅ Phase 6.1: Si coordonnées disponibles, trouver utilisateurs dans la zone
        if let (Some(lat), Some(lon)) = (pharmacy_lat, pharmacy_lon) {
            match find_users_in_radius(&*self.pool, lat, lon, radius_km).await {
                Ok(users_in_zone) => {
                    // Fusionner avec les user_ids fournis (éviter doublons)
                    for user_id in users_in_zone {
                        if !final_user_ids.contains(&user_id) {
                            final_user_ids.push(user_id);
                        }
                    }
                }
                Err(e) => {
                    warn!(
                        "[SpecializedNotifications] Erreur recherche utilisateurs zone: {}",
                        e
                    );
                }
            }
        }

        info!(
            "[SpecializedNotifications] Notification à {} utilisateurs",
            final_user_ids.len()
        );

        for user_id in final_user_ids {
            let notification = SpecializedNotification {
                user_id,
                notification_type: SpecializedNotificationType::PharmacyOnDuty,
                title: "💊 Pharmacie de garde disponible".to_string(),
                message: format!("{} est de garde maintenant", pharmacy_name),
                data: json!({
                    "pharmacy_id": pharmacy_id,
                    "pharmacy_name": pharmacy_name,
                    "type": "pharmacy_on_duty"
                }),
            };
            let _ = self.send_notification(notification).await;
        }

        Ok(())
    }

    /// Notifier les utilisateurs d'un covoiturage correspondant
    /// ✅ Phase 6.1: Trouve automatiquement les utilisateurs correspondants via GPS
    pub async fn notify_carpool_match(
        &self,
        carpool_id: i32,
        departure: String,
        destination: String,
        user_id: Option<i32>,
        user_lat: Option<f64>,
        user_lon: Option<f64>,
        destination_lat: Option<f64>,
        destination_lon: Option<f64>,
        max_distance_km: f64,
    ) -> Result<(), Box<dyn std::error::Error>> {
        info!(
            "[SpecializedNotifications] Notification covoiturage match: {} → {}",
            departure, destination
        );

        let mut user_ids = Vec::new();

        // ✅ Phase 6.1: Si coordonnées disponibles, trouver utilisateurs correspondants
        if let (Some(ulat), Some(ulon), Some(dlat), Some(dlon)) =
            (user_lat, user_lon, destination_lat, destination_lon)
        {
            match find_matching_carpools(&*self.pool, ulat, ulon, dlat, dlon, max_distance_km).await
            {
                Ok(matches) => {
                    for (matched_id, _, _) in matches {
                        if matched_id == carpool_id {
                            // Trouver les utilisateurs intéressés par ce trajet
                            // Pour l'instant, on notifie seulement l'utilisateur demandeur
                            if let Some(uid) = user_id {
                                user_ids.push(uid);
                            }
                        }
                    }
                }
                Err(e) => {
                    warn!(
                        "[SpecializedNotifications] Erreur recherche covoiturages: {}",
                        e
                    );
                    if let Some(uid) = user_id {
                        user_ids.push(uid);
                    }
                }
            }
        } else if let Some(uid) = user_id {
            user_ids.push(uid);
        }

        for uid in user_ids {
            let notification = SpecializedNotification {
                user_id: uid,
                notification_type: SpecializedNotificationType::CarpoolMatch,
                title: "🚗 Covoiturage correspondant trouvé".to_string(),
                message: format!(
                    "Un covoiturage {} → {} correspond à votre recherche",
                    departure, destination
                ),
                data: json!({
                    "carpool_id": carpool_id,
                    "departure": departure,
                    "destination": destination,
                    "type": "carpool_match"
                }),
            };
            let _ = self.send_notification(notification).await;
        }

        Ok(())
    }

    /// Notifier les utilisateurs d'un taxi dans la zone
    /// ✅ Phase 6.1: Trouve automatiquement les utilisateurs dans la zone
    pub async fn notify_taxi_nearby(
        &self,
        taxi_id: i32,
        taxi_name: String,
        latitude: f64,
        longitude: f64,
        user_id: Option<i32>,
        radius_km: f64,
    ) -> Result<(), Box<dyn std::error::Error>> {
        info!(
            "[SpecializedNotifications] Notification taxi nearby: {} à ({}, {})",
            taxi_name, latitude, longitude
        );

        let mut user_ids = Vec::new();

        // ✅ Phase 6.1: Trouver utilisateurs dans la zone
        match find_taxis_in_zone(&*self.pool, latitude, longitude, radius_km).await {
            Ok(taxis) => {
                // Pour chaque taxi trouvé, notifier les utilisateurs dans la zone
                match find_users_in_radius(&*self.pool, latitude, longitude, radius_km).await {
                    Ok(users) => {
                        user_ids.extend(users);
                    }
                    Err(e) => {
                        warn!(
                            "[SpecializedNotifications] Erreur recherche utilisateurs: {}",
                            e
                        );
                        if let Some(uid) = user_id {
                            user_ids.push(uid);
                        }
                    }
                }
            }
            Err(e) => {
                warn!("[SpecializedNotifications] Erreur recherche taxis: {}", e);
                if let Some(uid) = user_id {
                    user_ids.push(uid);
                }
            }
        }

        // Éviter doublons
        user_ids.sort();
        user_ids.dedup();

        for uid in user_ids {
            let notification = SpecializedNotification {
                user_id: uid,
                notification_type: SpecializedNotificationType::TaxiNearby,
                title: "🚕 Taxi disponible près de vous".to_string(),
                message: format!("{} est disponible dans votre zone", taxi_name),
                data: json!({
                    "taxi_id": taxi_id,
                    "taxi_name": taxi_name,
                    "latitude": latitude,
                    "longitude": longitude,
                    "type": "taxi_nearby"
                }),
            };
            let _ = self.send_notification(notification).await;
        }

        Ok(())
    }

    /// Envoyer le résumé hebdomadaire à un utilisateur
    pub async fn send_weekly_summary(
        &self,
        user_id: i32,
        stats: serde_json::Value,
    ) -> Result<(), Box<dyn std::error::Error>> {
        info!(
            "[SpecializedNotifications] Résumé hebdomadaire pour user_id={}",
            user_id
        );

        let total = stats.get("total").and_then(|v| v.as_i64()).unwrap_or(0);
        let active = stats.get("active").and_then(|v| v.as_i64()).unwrap_or(0);

        let notification = SpecializedNotification {
            user_id,
            notification_type: SpecializedNotificationType::WeeklySummary,
            title: "📊 Résumé hebdomadaire".to_string(),
            message: format!(
                "Vous avez {} service(s) spécialisé(s), dont {} actif(s)",
                total, active
            ),
            data: json!({
                "stats": stats,
                "type": "weekly_summary"
            }),
        };

        self.send_notification(notification).await
    }
}

/// ✅ Phase 6.1: Fonction pour vérifier et notifier les pharmacies de garde
/// À appeler via un cron job ou un trigger
pub async fn check_and_notify_pharmacies_on_duty(
    pool: Arc<PgPool>,
) -> Result<(), Box<dyn std::error::Error>> {
    info!("[check_and_notify_pharmacies_on_duty] Vérification pharmacies de garde...");

    // Récupérer les pharmacies de garde actuellement
    let pharmacies: Vec<(i32, String, i32)> = sqlx::query_as(
        r#"
        SELECT p.id, p.nom, s.user_id
        FROM pharmacies p
        INNER JOIN services s ON s.id = p.service_id
        WHERE p.is_on_duty_now = true
          AND s.is_active = true
        "#,
    )
    .fetch_all(&*pool)
    .await
    .map_err(|e| {
        error!("[check_and_notify_pharmacies_on_duty] Erreur DB: {}", e);
        e
    })?;

    if pharmacies.is_empty() {
        info!("[check_and_notify_pharmacies_on_duty] Aucune pharmacie de garde trouvée");
        return Ok(());
    }

    let notification_service = SpecializedNotificationsService::new(pool.clone());

    // Pour chaque pharmacie, trouver les utilisateurs à notifier
    // ✅ Phase 6.1: Utiliser GPS matching pour trouver utilisateurs dans la zone
    for (pharmacy_id, pharmacy_name, owner_id) in pharmacies {
        // Récupérer les coordonnées de la pharmacie depuis le service
        let pharmacy_coords: Option<(f64, f64)> = sqlx::query_as(
            r#"
            SELECT s.latitude, s.longitude
            FROM services s
            INNER JOIN pharmacies p ON p.service_id = s.id
            WHERE p.id = $1
            "#,
        )
        .bind(pharmacy_id)
        .fetch_optional(&*pool)
        .await
        .ok()
        .flatten();

        let (pharmacy_lat, pharmacy_lon) = pharmacy_coords.unwrap_or((0.0, 0.0));

        let _ = notification_service
            .notify_pharmacy_on_duty(
                pharmacy_id,
                pharmacy_name,
                Some(vec![owner_id]), // Toujours notifier le propriétaire
                if pharmacy_lat != 0.0 && pharmacy_lon != 0.0 {
                    Some(pharmacy_lat)
                } else {
                    None
                },
                if pharmacy_lat != 0.0 && pharmacy_lon != 0.0 {
                    Some(pharmacy_lon)
                } else {
                    None
                },
                10.0, // Rayon de 10 km par défaut
            )
            .await;
    }

    info!("[check_and_notify_pharmacies_on_duty] ✅ Notifications envoyées");
    Ok(())
}
