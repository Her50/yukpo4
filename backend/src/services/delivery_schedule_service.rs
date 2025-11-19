// ✅ Phase 3 - Amélioration 7 : Service pour gérer les contraintes horaires de livraison
use crate::core::types::{AppError, AppResult};
use crate::models::delivery_model::{ClientDeliveryPreferences, ProductDeliveryConfig};
use chrono::{DateTime, Datelike, Duration, NaiveDate, NaiveDateTime, NaiveTime, Utc, Weekday};
use serde_json::Value;
use sqlx::PgPool;

/// Créneau horaire pour pickup ou delivery
#[derive(Debug, Clone)]
pub struct TimeSlot {
    pub start: DateTime<Utc>,
    pub end: DateTime<Utc>,
}

/// Résultat du calcul de créneau acceptable
#[derive(Debug, Clone)]
pub struct AcceptableTimeSlot {
    pub pickup_slot: TimeSlot,
    pub delivery_slot: Option<TimeSlot>,
    pub is_flexible: bool,
}

/// Service pour gérer les contraintes horaires
pub struct DeliveryScheduleService {
    pool: PgPool,
}

impl DeliveryScheduleService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// ✅ Phase 3 - Amélioration 7 : Calcule un créneau de pickup acceptable en tenant compte des contraintes
    pub async fn calculate_acceptable_pickup_slot(
        &self,
        product_config: Option<&ProductDeliveryConfig>,
        client_preferences: Option<&ClientDeliveryPreferences>,
        estimated_transit_hours: f64,
    ) -> AppResult<AcceptableTimeSlot> {
        let now = Utc::now();

        // Si client a spécifié une préférence de livraison
        if let Some(prefs) = client_preferences {
            let preferred_delivery_date = prefs.preferred_delivery_date;
            let preferred_delivery_time_start = prefs.preferred_delivery_time_start;
            let preferred_delivery_window_hours = prefs.preferred_delivery_window_hours;
            
            if let Some(delivery_date) = preferred_delivery_date {
                // Calculer quand récupérer pour livrer à cette date/heure
                let delivery_time_start = preferred_delivery_time_start
                    .unwrap_or_else(|| NaiveTime::from_hms_opt(14, 0, 0).unwrap());
                
                let delivery_datetime = NaiveDateTime::new(delivery_date, delivery_time_start);
                let delivery_datetime_utc = DateTime::<Utc>::from_naive_utc_and_offset(
                    delivery_datetime,
                    Utc,
                );

                // Estimer temps de transport
                let pickup_datetime = delivery_datetime_utc - Duration::hours(estimated_transit_hours as i64);

                // Vérifier si pickup_datetime est dans les plages horaires du prestataire
                if let Some(config) = product_config {
                    if self.is_datetime_in_availability_window(
                        &pickup_datetime,
                        &config.pickup_availability_schedule,
                    )? {
                        let pickup_end = pickup_datetime + Duration::hours(1); // Fenêtre de 1h
                        let delivery_end = delivery_datetime_utc
                            + Duration::hours(preferred_delivery_window_hours as i64);

                        return Ok(AcceptableTimeSlot {
                            pickup_slot: TimeSlot {
                                start: pickup_datetime,
                                end: pickup_end,
                            },
                            delivery_slot: Some(TimeSlot {
                                start: delivery_datetime_utc,
                                end: delivery_end,
                            }),
                            is_flexible: prefs.is_flexible,
                        });
                    }
                }

                // Si pas compatible, chercher le prochain créneau disponible
                if prefs.is_flexible {
                    return self
                        .find_next_available_slot(
                            &pickup_datetime,
                            product_config,
                            prefs.flexibility_window_days,
                            estimated_transit_hours,
                        )
                        .await;
                }
            }
        }

        // Pas de préférence client : utiliser prochaine disponibilité prestataire
        if let Some(config) = product_config {
            return self
                .find_next_available_slot(&now, Some(config), 7, estimated_transit_hours)
                .await;
        }

        // Pas de config : pickup immédiat
        Ok(AcceptableTimeSlot {
            pickup_slot: TimeSlot {
                start: now,
                end: now + Duration::hours(1),
            },
            delivery_slot: None,
            is_flexible: true,
        })
    }

    /// Vérifie si une datetime est dans une fenêtre de disponibilité
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
            return Ok(false);
        }

        let slots = day_schedule
            .and_then(|v| v.as_array())
            .ok_or_else(|| AppError::Internal("Format schedule invalide".into()))?;

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
                        if time >= start_time && time <= end_time {
                            return Ok(true);
                        }
                    }
                }
            }
        }

        Ok(false)
    }

    /// Trouve le prochain créneau disponible
    async fn find_next_available_slot(
        &self,
        from: &DateTime<Utc>,
        product_config: Option<&ProductDeliveryConfig>,
        max_days: i32,
        estimated_transit_hours: f64,
    ) -> AppResult<AcceptableTimeSlot> {
        let mut current = *from;

        for _day in 0..max_days {
            if let Some(config) = product_config {
                let weekday = current.weekday();
                let day_key = match weekday {
                    Weekday::Mon => "monday",
                    Weekday::Tue => "tuesday",
                    Weekday::Wed => "wednesday",
                    Weekday::Thu => "thursday",
                    Weekday::Fri => "friday",
                    Weekday::Sat => "saturday",
                    Weekday::Sun => "sunday",
                };

                let day_schedule = config.pickup_availability_schedule.get(day_key);
                if let Some(slots) = day_schedule.and_then(|v| v.as_array()) {
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
                                    let slot_start = current
                                        .date_naive()
                                        .and_time(start_time)
                                        .and_utc();
                                    let slot_end = current
                                        .date_naive()
                                        .and_time(end_time)
                                        .and_utc();

                                    if slot_start > current {
                                        return Ok(AcceptableTimeSlot {
                                            pickup_slot: TimeSlot {
                                                start: slot_start,
                                                end: slot_start + Duration::hours(1),
                                            },
                                            delivery_slot: Some(TimeSlot {
                                                start: slot_start + Duration::hours(estimated_transit_hours as i64),
                                                end: slot_end + Duration::hours(estimated_transit_hours as i64),
                                            }),
                                            is_flexible: true,
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Passer au jour suivant
            current = current + Duration::days(1);
            current = current.date_naive().and_hms_opt(8, 0, 0).unwrap().and_utc();
        }

        // Si aucun créneau trouvé, retourner pickup immédiat
        Ok(AcceptableTimeSlot {
            pickup_slot: TimeSlot {
                start: *from,
                end: *from + Duration::hours(1),
            },
            delivery_slot: None,
            is_flexible: true,
        })
    }
}

