use crate::core::types::{AppError, AppResult};
use chrono::{DateTime, Datelike, NaiveTime, Utc, Weekday};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::{PgPool, Row};

/// Service pour vérifier la disponibilité des produits et suggérer des alternatives
pub struct ProductAvailabilityService {
    pool: PgPool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AvailabilityCheckResult {
    pub is_available: bool,
    pub reason: Option<String>,
    pub available_days: Option<Vec<i32>>,
    pub is_immediately_available: bool,
    pub preparation_time_minutes: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductAvailabilityInfo {
    pub service_id: i32,
    pub product_index: i32,
    pub is_available: bool,
    pub availability_days: Vec<i32>, // 0=dimanche, 1=lundi, ..., 6=samedi
    pub is_immediately_available: bool,
    pub preparation_time_minutes: Option<i32>,
    pub max_preparation_time_minutes: i32,
}

impl ProductAvailabilityService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Vérifie si un produit est disponible à un moment donné
    pub async fn check_availability(
        &self,
        service_id: i32,
        product_index: i32,
        requested_time: Option<DateTime<Utc>>,
    ) -> AppResult<AvailabilityCheckResult> {
        let now = requested_time.unwrap_or_else(Utc::now);
        let current_weekday = now.weekday().num_days_from_sunday() as i32;

        // Récupérer la configuration de livraison du produit
        struct Config {
            preparation_time_minutes: Option<i32>,
            _max_preparation_time_minutes: Option<i32>,
            availability_days: Option<Value>,
            is_immediately_available: Option<bool>,
            pickup_availability_schedule: Option<Value>,
        }

        let config: Option<Config> = sqlx::query(
            r#"
            SELECT 
                preparation_time_minutes,
                max_preparation_time_minutes,
                availability_days,
                is_immediately_available,
                pickup_availability_schedule
            FROM product_delivery_config
            WHERE service_id = $1 AND product_index = $2
            "#,
        )
        .bind(service_id)
        .bind(product_index)
        .map(|row: sqlx::postgres::PgRow| Config {
            preparation_time_minutes: row.get::<Option<_>, _>("preparation_time_minutes"),
            _max_preparation_time_minutes: row.get::<Option<_>, _>("max_preparation_time_minutes"),
            availability_days: row.get::<Option<_>, _>("availability_days"),
            is_immediately_available: row.get::<Option<_>, _>("is_immediately_available"),
            pickup_availability_schedule: row.get::<Option<_>, _>("pickup_availability_schedule"),
        })
        .fetch_optional(&self.pool)
        .await?;

        let config = match config {
            Some(c) => c,
            None => {
                return Ok(AvailabilityCheckResult {
                    is_available: false,
                    reason: Some("Configuration de livraison non trouvée".to_string()),
                    available_days: None,
                    is_immediately_available: false,
                    preparation_time_minutes: None,
                });
            }
        };

        // Vérifier les jours de disponibilité
        let availability_days: Vec<i32> = config
            .availability_days
            .and_then(|v| serde_json::from_value(v).ok())
            .unwrap_or_default();
        let is_available_today =
            availability_days.is_empty() || availability_days.contains(&current_weekday);

        if !is_available_today {
            let day_names = [
                "Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi",
            ];
            let available_days_str: Vec<String> = availability_days
                .iter()
                .map(|&d| day_names[d as usize].to_string())
                .collect();

            return Ok(AvailabilityCheckResult {
                is_available: false,
                reason: Some(format!(
                    "Produit non disponible le {}. Disponible: {}",
                    day_names[current_weekday as usize],
                    available_days_str.join(", ")
                )),
                available_days: Some(availability_days),
                is_immediately_available: config.is_immediately_available.unwrap_or(false),
                preparation_time_minutes: config.preparation_time_minutes,
            });
        }

        // ✅ NOUVEAU : Vérifier les plages horaires (pickup_availability_schedule)
        if let Some(schedule) = config.pickup_availability_schedule {
            let is_in_time_window = self.is_datetime_in_availability_window(&now, &schedule)?;

            if !is_in_time_window {
                let day_key = match now.weekday() {
                    Weekday::Mon => "monday",
                    Weekday::Tue => "tuesday",
                    Weekday::Wed => "wednesday",
                    Weekday::Thu => "thursday",
                    Weekday::Fri => "friday",
                    Weekday::Sat => "saturday",
                    Weekday::Sun => "sunday",
                };

                let day_schedule = schedule.get(day_key);
                let time_slots = if let Some(slots) = day_schedule.and_then(|v| v.as_array()) {
                    slots
                        .iter()
                        .filter_map(|slot| {
                            let obj = slot.as_object()?;
                            let start = obj.get("start")?.as_str()?;
                            let end = obj.get("end")?.as_str()?;
                            Some(format!("{} - {}", start, end))
                        })
                        .collect::<Vec<_>>()
                        .join(", ")
                } else {
                    "Aucune plage horaire".to_string()
                };

                return Ok(AvailabilityCheckResult {
                    is_available: false,
                    reason: Some(format!(
                        "Produit non disponible à cette heure. Plages horaires disponibles aujourd'hui: {}",
                        time_slots
                    )),
                    available_days: Some(availability_days),
                    is_immediately_available: config.is_immediately_available.unwrap_or(false),
                    preparation_time_minutes: config.preparation_time_minutes,
                });
            }
        }

        Ok(AvailabilityCheckResult {
            is_available: true,
            reason: None,
            available_days: Some(availability_days),
            is_immediately_available: config.is_immediately_available.unwrap_or(false),
            preparation_time_minutes: config.preparation_time_minutes,
        })
    }

    /// Récupère les informations de disponibilité d'un produit
    pub async fn get_availability_info(
        &self,
        service_id: i32,
        product_index: i32,
    ) -> AppResult<Option<ProductAvailabilityInfo>> {
        struct Config2 {
            preparation_time_minutes: Option<i32>,
            max_preparation_time_minutes: Option<i32>,
            availability_days: Option<Value>,
            is_immediately_available: Option<bool>,
        }

        let config: Option<Config2> = sqlx::query(
            r#"
            SELECT 
                preparation_time_minutes,
                max_preparation_time_minutes,
                availability_days,
                is_immediately_available
            FROM product_delivery_config
            WHERE service_id = $1 AND product_index = $2
            "#,
        )
        .bind(service_id)
        .bind(product_index)
        .map(|row: sqlx::postgres::PgRow| Config2 {
            preparation_time_minutes: row.get::<Option<_>, _>("preparation_time_minutes"),
            max_preparation_time_minutes: row.get::<Option<_>, _>("max_preparation_time_minutes"),
            availability_days: row.get::<Option<_>, _>("availability_days"),
            is_immediately_available: row.get::<Option<_>, _>("is_immediately_available"),
        })
        .fetch_optional(&self.pool)
        .await?;

        let config = match config {
            Some(c) => c,
            None => return Ok(None),
        };

        let availability_days: Vec<i32> = config
            .availability_days
            .and_then(|v| serde_json::from_value(v).ok())
            .unwrap_or_else(|| vec![0, 1, 2, 3, 4, 5, 6]);
        let now = Utc::now();
        let current_weekday = now.weekday().num_days_from_sunday() as i32;
        let is_available =
            availability_days.is_empty() || availability_days.contains(&current_weekday);

        Ok(Some(ProductAvailabilityInfo {
            service_id,
            product_index,
            is_available,
            availability_days,
            is_immediately_available: config.is_immediately_available.unwrap_or(false),
            preparation_time_minutes: config.preparation_time_minutes,
            max_preparation_time_minutes: config.max_preparation_time_minutes.unwrap_or(60) as i32,
        }))
    }

    /// Vérifie la disponibilité de plusieurs produits
    pub async fn check_multiple_products(
        &self,
        products: &[(i32, i32)], // Vec<(service_id, product_index)>
        requested_time: Option<DateTime<Utc>>,
    ) -> AppResult<Vec<(i32, i32, AvailabilityCheckResult)>> {
        let mut results = Vec::new();

        for (service_id, product_index) in products {
            let result = self
                .check_availability(*service_id, *product_index, requested_time)
                .await?;
            results.push((*service_id, *product_index, result));
        }

        Ok(results)
    }

    /// Vérifie si une datetime est dans une fenêtre de disponibilité (plages horaires)
    fn is_datetime_in_availability_window(
        &self,
        datetime: &DateTime<Utc>,
        schedule: &Value,
    ) -> AppResult<bool> {
        let weekday = datetime.weekday();
        let time = datetime.time();

        let day_key = match weekday {
            Weekday::Mon => "monday",
            Weekday::Tue => "tuesday",
            Weekday::Wed => "wednesday",
            Weekday::Thu => "thursday",
            Weekday::Fri => "friday",
            Weekday::Sat => "saturday",
            Weekday::Sun => "sunday",
        };

        let day_schedule = schedule.get(day_key);
        if day_schedule.is_none() || day_schedule.and_then(|v| v.as_array()).is_none() {
            // Pas de plage horaire définie pour ce jour = disponible toute la journée
            return Ok(true);
        }

        let slots = day_schedule
            .and_then(|v| v.as_array())
            .ok_or_else(|| AppError::Internal("Format schedule invalide".into()))?;

        // Si tableau vide, pas disponible ce jour
        if slots.is_empty() {
            return Ok(false);
        }

        for slot in slots {
            if let Some(slot_obj) = slot.as_object() {
                if let (Some(start_str), Some(end_str)) = (
                    slot_obj.get("start").and_then(|v| v.as_str()),
                    slot_obj.get("end").and_then(|v| v.as_str()),
                ) {
                    if let (Ok(start_time), Ok(end_time)) = (
                        NaiveTime::parse_from_str(start_str, "%H:%M"),
                        NaiveTime::parse_from_str(end_str, "%H:%M"),
                    ) {
                        // Vérifier si l'heure actuelle est dans la plage
                        if time >= start_time && time <= end_time {
                            return Ok(true);
                        }
                    }
                }
            }
        }

        Ok(false)
    }
}
