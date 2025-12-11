// ✅ Service pour gérer les trajets récurrents
// Date: 2025-01-29

use crate::core::types::{AppError, AppResult};
use chrono::{Datelike, Duration, Utc, Weekday};
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};
use std::collections::HashSet;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RecurrenceConfig {
    pub recurrence_type: RecurrenceType,
    pub recurrence_days: Option<Vec<u8>>, // 1=lundi, 7=dimanche
    pub recurrence_end_date: Option<chrono::NaiveDate>,
    pub recurrence_pattern: Option<serde_json::Value>, // Pattern flexible JSON
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "lowercase")]
pub enum RecurrenceType {
    Daily,
    Weekly,
    Monthly,
}

pub struct RecurringTripsService {
    pool: PgPool,
}

impl RecurringTripsService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Génère les instances de trajets récurrents pour les N prochains jours
    pub async fn generate_recurring_instances(&self, days_ahead: i32) -> AppResult<usize> {
        info!(
            "[RecurringTripsService] Génération instances récurrentes pour {} jours",
            days_ahead
        );

        // Valider days_ahead
        if days_ahead <= 0 || days_ahead > 365 {
            return Err(AppError::BadRequest(
                "days_ahead doit être entre 1 et 365".to_string(),
            ));
        }

        // Appeler la fonction PostgreSQL
        let _count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM generate_recurring_trips()")
            .fetch_one(&self.pool)
            .await
            .map_err(|e| {
                error!("[RecurringTripsService] Erreur génération: {}", e);
                AppError::Internal(format!("Erreur génération trajets récurrents: {}", e))
            })?;

        // Générer instances pour les N prochains jours
        let instances_created = self.generate_instances_for_period(days_ahead).await?;

        info!(
            "[RecurringTripsService] ✅ {} instances créées",
            instances_created
        );
        Ok(instances_created)
    }

    /// Génère les instances pour une période donnée
    async fn generate_instances_for_period(&self, days_ahead: i32) -> AppResult<usize> {
        let start_date = Utc::now().date_naive();
        let end_date = start_date + Duration::days(days_ahead as i64);

        // Récupérer tous les trajets récurrents actifs
        let recurring_trips_rows = sqlx::query(
            r#"
            SELECT 
                c.id,
                c.service_id,
                c.user_id,
                c.recurrence_type,
                c.recurrence_days,
                c.recurrence_end_date,
                c.date_depart::DATE as start_date
            FROM covoiturages c
            INNER JOIN services s ON s.id = c.service_id
            WHERE c.is_recurring = TRUE
            AND c.parent_trip_id IS NULL
            AND s.is_active = TRUE
            AND c.is_active = TRUE
            AND (c.recurrence_end_date IS NULL OR c.recurrence_end_date >= $1)
            "#,
        )
        .bind(start_date)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| {
            error!("[RecurringTripsService] Erreur récupération trajets: {}", e);
            AppError::Internal(format!("Erreur récupération trajets récurrents: {}", e))
        })?;

        let recurring_trips: Vec<RecurringTripRow> = recurring_trips_rows
            .into_iter()
            .map(|row| RecurringTripRow {
                id: row.get::<i32, _>("id"),
                service_id: row.get::<i32, _>("service_id"),
                user_id: row.get::<i32, _>("user_id"),
                recurrence_type: row.get::<Option<String>, _>("recurrence_type"),
                recurrence_days: row
                    .get::<Option<Vec<i32>>, _>("recurrence_days")
                    .map(|v| v.into_iter().map(|x| x as i16).collect()),
                recurrence_end_date: row.get::<Option<chrono::NaiveDate>, _>("recurrence_end_date"),
                start_date: row.get::<chrono::NaiveDate, _>("start_date"),
            })
            .collect();

        let mut total_instances = 0;

        for trip in recurring_trips {
            let instances = self
                .generate_instances_for_trip(&trip, start_date, end_date)
                .await?;
            total_instances += instances;
        }

        Ok(total_instances)
    }

    /// Génère les instances pour un trajet spécifique
    async fn generate_instances_for_trip(
        &self,
        trip: &RecurringTripRow,
        start_date: chrono::NaiveDate,
        end_date: chrono::NaiveDate,
    ) -> AppResult<usize> {
        let mut instances_created = 0;
        let mut current_date = start_date;

        let recurrence_type = trip.recurrence_type.as_deref().unwrap_or("weekly");
        let days_set: HashSet<i32> = trip
            .recurrence_days
            .as_ref()
            .map(|arr| arr.iter().map(|&d| d as i32).collect())
            .unwrap_or_default();

        while current_date <= end_date {
            // Vérifier date de fin
            if let Some(end) = trip.recurrence_end_date {
                if current_date > end {
                    break;
                }
            }

            let should_create = match recurrence_type {
                "daily" => true,
                "weekly" => {
                    // Convertir jour PostgreSQL (0=dimanche) vers notre format (1=lundi, 7=dimanche)
                    let weekday = current_date.weekday();
                    let day_num = match weekday {
                        Weekday::Mon => 1,
                        Weekday::Tue => 2,
                        Weekday::Wed => 3,
                        Weekday::Thu => 4,
                        Weekday::Fri => 5,
                        Weekday::Sat => 6,
                        Weekday::Sun => 7,
                    };
                    days_set.contains(&day_num) || days_set.is_empty()
                }
                "monthly" => {
                    // Même jour du mois
                    current_date.day() == trip.start_date.day()
                }
                _ => false,
            };

            if should_create {
                // Vérifier si instance existe déjà
                let exists: bool = sqlx::query_scalar(
                    "SELECT EXISTS(SELECT 1 FROM recurring_trip_instances WHERE parent_trip_id = $1 AND instance_date = $2)"
                )
                .bind(trip.id)
                .bind(current_date)
                .fetch_one(&self.pool)
                .await
                .unwrap_or(false);

                if !exists {
                    sqlx::query(
                        "INSERT INTO recurring_trip_instances (parent_trip_id, instance_date, status) VALUES ($1, $2, 'pending') ON CONFLICT DO NOTHING"
                    )
                    .bind(trip.id)
                    .bind(current_date)
                    .execute(&self.pool)
                    .await
                    .map_err(|e| {
                        error!("[RecurringTripsService] Erreur création instance: {}", e);
                        AppError::Internal(format!("Erreur création instance: {}", e))
                    })?;

                    instances_created += 1;
                }
            }

            current_date = current_date + Duration::days(1);
        }

        Ok(instances_created)
    }

    /// Crée un trajet réel depuis une instance récurrente
    pub async fn create_trip_from_instance(&self, instance_id: i32) -> AppResult<i32> {
        info!(
            "[RecurringTripsService] Création trajet depuis instance ID={}",
            instance_id
        );

        let covoiturage_id: i32 =
            sqlx::query_scalar("SELECT create_trip_from_recurring_instance($1)")
                .bind(instance_id)
                .fetch_one(&self.pool)
                .await
                .map_err(|e| {
                    error!("[RecurringTripsService] Erreur création trajet: {}", e);
                    AppError::Internal(format!("Erreur création trajet depuis instance: {}", e))
                })?;

        info!(
            "[RecurringTripsService] ✅ Trajet créé ID={}",
            covoiturage_id
        );
        Ok(covoiturage_id)
    }

    /// Active les instances en attente (crée les trajets réels)
    pub async fn activate_pending_instances(&self, days_ahead: i32) -> AppResult<usize> {
        info!(
            "[RecurringTripsService] Activation instances en attente pour {} jours",
            days_ahead
        );

        let end_date = Utc::now().date_naive() + Duration::days(days_ahead as i64);

        // Récupérer instances en attente
        let instances: Vec<i32> = sqlx::query_scalar(
            r#"
            SELECT id
            FROM recurring_trip_instances
            WHERE status = 'pending'
            AND instance_date <= $1
            ORDER BY instance_date ASC
            "#,
        )
        .bind(end_date)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| {
            error!(
                "[RecurringTripsService] Erreur récupération instances: {}",
                e
            );
            AppError::Internal(format!("Erreur récupération instances: {}", e))
        })?;

        let mut activated = 0;

        for instance_id in instances {
            match self.create_trip_from_instance(instance_id).await {
                Ok(_) => activated += 1,
                Err(e) => {
                    warn!(
                        "[RecurringTripsService] ⚠️ Erreur activation instance {}: {}",
                        instance_id, e
                    );
                    // Marquer comme erreur mais continuer
                    sqlx::query(
                        "UPDATE recurring_trip_instances SET status = 'cancelled' WHERE id = $1",
                    )
                    .bind(instance_id)
                    .execute(&self.pool)
                    .await
                    .ok();
                }
            }
        }

        info!(
            "[RecurringTripsService] ✅ {} instances activées",
            activated
        );
        Ok(activated)
    }

    /// Récupère les instances d'un trajet récurrent
    pub async fn get_trip_instances(
        &self,
        parent_trip_id: i32,
    ) -> AppResult<Vec<RecurringInstance>> {
        let instances_rows = sqlx::query(
            r#"
            SELECT 
                id,
                parent_trip_id,
                instance_date,
                instance_covoiturage_id,
                status,
                created_at,
                updated_at
            FROM recurring_trip_instances
            WHERE parent_trip_id = $1
            ORDER BY instance_date ASC
            "#,
        )
        .bind(parent_trip_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| {
            error!(
                "[RecurringTripsService] Erreur récupération instances: {}",
                e
            );
            AppError::Internal(format!("Erreur récupération instances: {}", e))
        })?;

        let instances: Vec<RecurringInstance> = instances_rows
            .into_iter()
            .map(|row| RecurringInstance {
                id: row.get::<i32, _>("id"),
                parent_trip_id: row.get::<i32, _>("parent_trip_id"),
                instance_date: row.get::<chrono::NaiveDate, _>("instance_date"),
                instance_covoiturage_id: row.get::<Option<i32>, _>("instance_covoiturage_id"),
                status: row.get::<String, _>("status"),
                created_at: row.get::<chrono::DateTime<chrono::Utc>, _>("created_at"),
                updated_at: row.get::<chrono::DateTime<chrono::Utc>, _>("updated_at"),
            })
            .collect();

        Ok(instances)
    }
}

#[derive(Debug, sqlx::FromRow)]
struct RecurringTripRow {
    id: i32,
    #[allow(dead_code)]
    service_id: i32,
    #[allow(dead_code)]
    user_id: i32,
    recurrence_type: Option<String>,
    recurrence_days: Option<Vec<i16>>,
    recurrence_end_date: Option<chrono::NaiveDate>,
    start_date: chrono::NaiveDate,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct RecurringInstance {
    pub id: i32,
    pub parent_trip_id: i32,
    pub instance_date: chrono::NaiveDate,
    pub instance_covoiturage_id: Option<i32>,
    pub status: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

use log::{error, info, warn};
