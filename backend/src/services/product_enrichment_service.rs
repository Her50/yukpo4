use crate::core::types::{AppError, AppResult};
use chrono::{Datelike, DateTime, Utc};
use log::info;
use serde_json::Value;
use sqlx::PgPool;

/// Service pour enrichir les produits avec les données de disponibilité depuis product_delivery_config
pub struct ProductEnrichmentService {
    pool: PgPool,
}

#[derive(Debug, Clone)]
pub struct ProductAvailabilityData {
    pub is_immediately_available: Option<bool>,
    pub preparation_time_minutes: Option<i32>,
    pub max_preparation_time_minutes: Option<i32>,
    pub availability_days: Option<Vec<i32>>,
    pub pickup_availability_schedule: Option<Value>,
    pub pickup_address: Option<String>,
    pub is_configured: bool,
    pub is_available_now: bool, // Calculé : disponible aujourd'hui et maintenant
}

impl ProductEnrichmentService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Récupère les données de disponibilité pour un produit
    pub async fn get_availability_data(
        &self,
        service_id: i32,
        product_index: i32,
    ) -> AppResult<Option<ProductAvailabilityData>> {
        let config = sqlx::query!(
            r#"
            SELECT 
                is_immediately_available,
                preparation_time_minutes,
                max_preparation_time_minutes,
                availability_days,
                pickup_availability_schedule,
                pickup_address,
                is_configured
            FROM product_delivery_config
            WHERE service_id = $1 
            AND product_index = $2
            AND is_configured = TRUE
            "#,
            service_id,
            product_index
        )
        .fetch_optional(&self.pool)
        .await?;

        let config = match config {
            Some(c) => c,
            None => {
                // Pas de configuration = produit non disponible pour livraison
                return Ok(Some(ProductAvailabilityData {
                    is_immediately_available: None,
                    preparation_time_minutes: None,
                    max_preparation_time_minutes: None,
                    availability_days: None,
                    pickup_availability_schedule: None,
                    pickup_address: None,
                    is_configured: false,
                    is_available_now: false,
                }));
            }
        };

        // Calculer si le produit est disponible maintenant
        let now = Utc::now();
        let current_weekday = now.weekday().num_days_from_sunday() as i32;
        
        // Vérifier les jours de disponibilité
        let availability_days: Vec<i32> = config.availability_days.unwrap_or_default();
        let is_available_today = availability_days.is_empty() || availability_days.contains(&current_weekday);

        // Vérifier les plages horaires
        let is_in_time_window = if let Some(schedule) = &config.pickup_availability_schedule {
            self.is_datetime_in_availability_window(&now, schedule)?
        } else {
            true // Pas de plage horaire = disponible toute la journée
        };

        let is_available_now = is_available_today && is_in_time_window;

        Ok(Some(ProductAvailabilityData {
            is_immediately_available: config.is_immediately_available,
            preparation_time_minutes: config.preparation_time_minutes,
            max_preparation_time_minutes: config.max_preparation_time_minutes,
            availability_days: Some(availability_days),
            pickup_availability_schedule: config.pickup_availability_schedule,
            pickup_address: config.pickup_address,
            is_configured: config.is_configured,
            is_available_now,
        }))
    }

    /// Enrichit un produit (Value JSON) avec les données de disponibilité
    pub async fn enrich_product(
        &self,
        service_id: i32,
        product_index: i32,
        product: &mut Value,
    ) -> AppResult<()> {
        let availability_data = self.get_availability_data(service_id, product_index).await?;

        if let Some(availability) = availability_data {
            if let Some(product_obj) = product.as_object_mut() {
                // Ajouter les données de disponibilité au produit
                product_obj.insert(
                    "delivery_availability".to_string(),
                    json!({
                        "is_immediately_available": availability.is_immediately_available,
                        "preparation_time_minutes": availability.preparation_time_minutes,
                        "max_preparation_time_minutes": availability.max_preparation_time_minutes,
                        "availability_days": availability.availability_days,
                        "pickup_address": availability.pickup_address,
                        "is_configured": availability.is_configured,
                        "is_available_now": availability.is_available_now,
                        // Ne pas inclure pickup_availability_schedule dans la réponse (trop volumineux)
                        // Il est déjà utilisé pour calculer is_available_now
                    }),
                );
            }
        }

        Ok(())
    }

    /// Enrichit tous les produits d'un service avec les données de disponibilité
    pub async fn enrich_service_products(
        &self,
        service_id: i32,
        service_data: &mut Value,
    ) -> AppResult<()> {
        // Les produits sont dans data->produits
        if let Some(data) = service_data.get_mut("data") {
            // Récupérer le tableau de produits
            let products = data
                .get_mut("produits")
                .and_then(|p| p.get_mut("valeur"))
                .and_then(|v| v.as_array_mut());

            if let Some(products_array) = products {
                for (index, product) in products_array.iter_mut().enumerate() {
                    self.enrich_product(service_id, index as i32, product).await?;
                }
            } else {
                // Format alternatif : produits directement dans un array
                let products = data
                    .get_mut("produits")
                    .and_then(|p| p.as_array_mut());

                if let Some(products_array) = products {
                    for (index, product) in products_array.iter_mut().enumerate() {
                        self.enrich_product(service_id, index as i32, product).await?;
                    }
                }
            }
        }

        Ok(())
    }

    /// Enrichit une liste de services avec les données de disponibilité de leurs produits
    pub async fn enrich_services(
        &self,
        services: &mut Vec<Value>,
    ) -> AppResult<()> {
        for service in services.iter_mut() {
            if let Some(service_id) = service.get("id").and_then(|v| v.as_i64()) {
                self.enrich_service_products(service_id as i32, service).await?;
            }
        }

        Ok(())
    }

    /// Vérifie si une datetime est dans une fenêtre de disponibilité
    fn is_datetime_in_availability_window(
        &self,
        datetime: &DateTime<Utc>,
        schedule: &Value,
    ) -> AppResult<bool> {
        use chrono::{NaiveTime, Weekday};

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

