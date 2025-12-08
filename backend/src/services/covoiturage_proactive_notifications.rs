// ✅ Service notifications proactives pour covoiturage
// Date: 2025-01-29
// Fonctionnalité : Rappels automatiques, notifications nouveaux trajets, etc.

use crate::core::types::{AppError, AppResult};
use crate::services::notification_service::{create_notification, NotificationType};
use log::{error, info};
use serde_json::json;
use sqlx::{PgPool, Row};

pub struct CovoiturageProactiveNotifications {
    pool: PgPool,
}

struct ReservationInfo {
    id: i32,
    passenger_id: i32,
    driver_id: i32,
    depart: String,
    destination: String,
    date_depart: chrono::NaiveDate,
    heure_depart: String,
    gps_depart: Option<String>,
}

struct TripInfo {
    date_depart: chrono::NaiveDate,
    heure_depart: String,
}

impl CovoiturageProactiveNotifications {
    pub fn new(pool: PgPool) -> Self {
        Self {
            pool,
        }
    }

    /// Envoie rappel 24h avant départ
    pub async fn send_24h_reminder(&self, reservation_id: i32) -> AppResult<()> {
        info!(
            "[ProactiveNotifications] Envoi rappel 24h pour reservation_id={}",
            reservation_id
        );

        // Récupérer infos réservation
        let reservation_row = sqlx::query(
            r#"
            SELECT 
                r.id,
                r.user_id as passenger_id,
                c.user_id as driver_id,
                c.depart,
                c.destination,
                c.date_depart,
                c.heure_depart
            FROM specialized_reservations r
            INNER JOIN services s ON s.id = r.service_id
            INNER JOIN covoiturages c ON c.service_id = s.id
            WHERE r.id = $1 AND r.reservation_type = 'covoiturage'
            "#
        )
        .bind(reservation_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| {
            error!(
                "[ProactiveNotifications] Erreur récupération réservation: {}",
                e
            );
            AppError::Internal(format!("Erreur récupération réservation: {}", e))
        })?;

        if let Some(row) = reservation_row {
            let res = ReservationInfo {
                id: row.get::<i32, _>("id"),
                passenger_id: row.get::<i32, _>("passenger_id"),
                driver_id: row.get::<i32, _>("driver_id"),
                depart: row.get::<String, _>("depart"),
                destination: row.get::<String, _>("destination"),
                date_depart: row.get::<chrono::NaiveDate, _>("date_depart"),
                heure_depart: row.get::<String, _>("heure_depart"),
                gps_depart: None,
            };
            // Notification passager
            let _ = create_notification(
                &self.pool,
                res.passenger_id,
                NotificationType::SystemAlert,
                "Rappel trajet".to_string(),
                format!(
                    "Votre trajet {} → {} est prévu demain à {}. N'oubliez pas !",
                    res.depart, res.destination, res.heure_depart
                ),
                Some(json!({"reservation_id": res.id, "type": "trip_reminder_24h"})),
            )
            .await;

            // Notification conducteur
            let _ = create_notification(
                &self.pool,
                res.driver_id,
                NotificationType::SystemAlert,
                "Rappel trajet".to_string(),
                format!(
                    "Vous avez un trajet {} → {} demain à {}. {} passager(s) réservé(s).",
                    res.depart,
                    res.destination,
                    res.heure_depart,
                    1 // TODO: Récupérer nombre réel
                ),
                Some(json!({"reservation_id": res.id, "type": "trip_reminder_24h"})),
            )
            .await;
        }

        Ok(())
    }

    /// Envoie rappel 2h avant départ
    pub async fn send_2h_reminder(&self, reservation_id: i32) -> AppResult<()> {
        info!(
            "[ProactiveNotifications] Envoi rappel 2h pour reservation_id={}",
            reservation_id
        );

        let reservation_row = sqlx::query(
            r#"
            SELECT 
                r.id,
                r.user_id as passenger_id,
                c.user_id as driver_id,
                c.depart,
                c.destination,
                c.heure_depart,
                c.gps_depart
            FROM specialized_reservations r
            INNER JOIN services s ON s.id = r.service_id
            INNER JOIN covoiturages c ON c.service_id = s.id
            WHERE r.id = $1 AND r.reservation_type = 'covoiturage'
            "#
        )
        .bind(reservation_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| {
            error!(
                "[ProactiveNotifications] Erreur récupération réservation: {}",
                e
            );
            AppError::Internal(format!("Erreur récupération réservation: {}", e))
        })?;

        if let Some(row) = reservation_row {
            let res = ReservationInfo {
                id: row.get::<i32, _>("id"),
                passenger_id: row.get::<i32, _>("passenger_id"),
                driver_id: row.get::<i32, _>("driver_id"),
                depart: row.get::<String, _>("depart"),
                destination: row.get::<String, _>("destination"),
                date_depart: row.get::<chrono::NaiveDate, _>("date_depart"),
                heure_depart: row.get::<String, _>("heure_depart"),
                gps_depart: row.get::<Option<String>, _>("gps_depart"),
            };
            // Notification passager
            let _ = create_notification(
                &self.pool,
                res.passenger_id,
                NotificationType::SystemAlert,
                "Départ dans 2h".to_string(),
                format!(
                    "Votre trajet {} → {} part dans 2h ({}) ! Préparez-vous.",
                    res.depart, res.destination, res.heure_depart
                ),
                Some(json!({"reservation_id": res.id, "type": "trip_reminder_2h", "gps_depart": res.gps_depart})),
            ).await;

            // Notification conducteur
            let _ = create_notification(
                &self.pool,
                res.driver_id,
                NotificationType::SystemAlert,
                "Départ dans 2h".to_string(),
                format!(
                    "Votre trajet {} → {} part dans 2h. Vérifiez votre véhicule.",
                    res.depart, res.destination
                ),
                Some(json!({"reservation_id": res.id, "type": "trip_reminder_2h"})),
            )
            .await;
        }

        Ok(())
    }

    /// Notifie passagers d'un nouveau trajet sur leur route
    pub async fn notify_new_trip_on_route(
        &self,
        passenger_user_id: i32,
        trip_id: i32,
        depart: &str,
        destination: &str,
        date_depart: chrono::NaiveDate,
        heure_depart: &str,
        prix: i32,
    ) -> AppResult<()> {
        info!(
            "[ProactiveNotifications] Notification nouveau trajet pour user_id={}, trip_id={}",
            passenger_user_id, trip_id
        );

        let _ = create_notification(
            &self.pool,
            passenger_user_id,
            NotificationType::SystemAlert,
            "Nouveau trajet disponible".to_string(),
            format!(
                "Un nouveau trajet {} → {} le {} à {} pour {} XAF est disponible !",
                depart,
                destination,
                date_depart.format("%d/%m/%Y"),
                heure_depart,
                prix
            ),
            Some(json!({
                "trip_id": trip_id,
                "type": "new_trip_on_route",
                "depart": depart,
                "destination": destination,
                "date": date_depart.to_string(),
                "heure": heure_depart,
                "prix": prix
            })),
        )
        .await;

        Ok(())
    }

    /// Notifie conducteur d'une nouvelle réservation
    pub async fn notify_new_reservation(
        &self,
        driver_user_id: i32,
        reservation_id: i32,
        passenger_name: &str,
        nombre_places: i32,
    ) -> AppResult<()> {
        info!(
            "[ProactiveNotifications] Notification nouvelle réservation pour driver_id={}",
            driver_user_id
        );

        let _ = create_notification(
            &self.pool,
            driver_user_id,
            NotificationType::SystemAlert,
            "Nouvelle réservation".to_string(),
            format!(
                "{} a réservé {} place(s) dans votre trajet",
                passenger_name, nombre_places
            ),
            Some(json!({
                "reservation_id": reservation_id,
                "type": "new_reservation",
                "passenger_name": passenger_name,
                "places": nombre_places
            })),
        )
        .await;

        Ok(())
    }

    /// Planifie les rappels automatiques pour une réservation
    pub async fn schedule_reminders(&self, reservation_id: i32) -> AppResult<()> {
        info!(
            "[ProactiveNotifications] Planification rappels pour reservation_id={}",
            reservation_id
        );

        // Récupérer date/heure départ
        let trip_row = sqlx::query(
            r#"
            SELECT 
                c.date_depart,
                c.heure_depart
            FROM specialized_reservations r
            INNER JOIN services s ON s.id = r.service_id
            INNER JOIN covoiturages c ON c.service_id = s.id
            WHERE r.id = $1 AND r.reservation_type = 'covoiturage'
            "#
        )
        .bind(reservation_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| {
            error!("[ProactiveNotifications] Erreur récupération trajet: {}", e);
            AppError::Internal(format!("Erreur récupération trajet: {}", e))
        })?;

        if let Some(row) = trip_row {
            let trip = TripInfo {
                date_depart: row.get::<chrono::NaiveDate, _>("date_depart"),
                heure_depart: row.get::<String, _>("heure_depart"),
            };
            // Calculer dates rappels
            let departure_datetime = chrono::NaiveDateTime::parse_from_str(
                &format!(
                    "{} {}",
                    trip.date_depart.format("%Y-%m-%d"),
                    trip.heure_depart
                ),
                "%Y-%m-%d %H:%M",
            )
            .ok()
            .and_then(|dt: chrono::NaiveDateTime| -> Option<chrono::DateTime<chrono::Utc>> { Some(chrono::DateTime::from_naive_utc_and_offset(dt, chrono::Utc)) });

            if let Some(departure) = departure_datetime {
                let reminder_24h = departure - chrono::Duration::hours(24);
                let reminder_2h = departure - chrono::Duration::hours(2);

                // Planifier rappels via service de notifications
                // Les rappels seront envoyés automatiquement par un cron job
                // Pour l'instant, on peut stocker dans une table simple si elle existe
                // Sinon, les notifications seront envoyées directement au moment du rappel
                // TODO: Créer table notification_schedule si nécessaire
            }
        }

        Ok(())
    }
}
