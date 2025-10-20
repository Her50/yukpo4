// Service de recherche avancée avec planifications
// Gère la recherche de pharmacies de garde et services médicaux disponibles

use sqlx::PgPool;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{Row, FromRow};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SchedulingSearchResult {
    pub service_id: i32,
    pub product_data: serde_json::Value,
    pub relevance_score: f64,
    pub distance_km: Option<f64>,
    pub is_available_now: bool,
    pub availability_info: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PharmacyOnDuty {
    pub service_id: i32,
    pub service_title: String,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub is_on_duty: bool,
    pub garde_days: Option<String>,
    pub opening_hours: Option<String>,
    pub closing_hours: Option<String>,
    pub emergency_phone: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MedicalServiceAvailability {
    pub service_id: i32,
    pub service_title: String,
    pub available_services: Vec<String>,
    pub current_schedule: Option<HashMap<String, serde_json::Value>>,
    pub is_24h: bool,
    pub has_blood_bank: bool,
}

pub struct SchedulingSearchService {
    pool: PgPool,
}

impl SchedulingSearchService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Recherche avancée avec planifications
    pub async fn search_with_scheduling(
        &self,
        search_query: &str,
        search_time: Option<DateTime<Utc>>,
        user_lat: Option<f64>,
        user_lng: Option<f64>,
        max_distance_km: Option<f64>,
    ) -> Result<Vec<SchedulingSearchResult>, String> {
        let search_time = search_time.unwrap_or_else(Utc::now);
        let max_distance = max_distance_km.unwrap_or(50.0);

        let query = r#"
            SELECT 
                service_id,
                product_data,
                relevance_score,
                distance_km,
                is_available_now,
                availability_info
            FROM search_products_with_scheduling($1, $2, $3, $4, $5)
            ORDER BY is_available_now DESC, relevance_score DESC, distance_km ASC
            LIMIT 50
        "#;

        let rows = sqlx::query(query)
            .bind(search_query)
            .bind(search_time)
            .bind(user_lat)
            .bind(user_lng)
            .bind(max_distance)
            .fetch_all(&self.pool)
            .await
            .map_err(|e| format!("Erreur recherche planifications: {}", e))?;

        let mut results = Vec::new();
        for row in rows {
            let result = SchedulingSearchResult {
                service_id: row.get("service_id"),
                product_data: row.get("product_data"),
                relevance_score: row.get("relevance_score"),
                distance_km: row.get("distance_km"),
                is_available_now: row.get("is_available_now"),
                availability_info: row.get("availability_info"),
            };
            results.push(result);
        }

        Ok(results)
    }

    /// Recherche spécifique de pharmacies de garde
    pub async fn search_pharmacies_on_duty(
        &self,
        user_lat: Option<f64>,
        user_lng: Option<f64>,
        max_distance_km: Option<f64>,
    ) -> Result<Vec<PharmacyOnDuty>, String> {
        let max_distance = max_distance_km.unwrap_or(50.0);

        let query = if user_lat.is_some() && user_lng.is_some() {
            r#"
                SELECT 
                    service_id,
                    service_title,
                    latitude,
                    longitude,
                    is_on_duty,
                    garde_days,
                    opening_hours,
                    closing_hours,
                    emergency_phone,
                    ST_Distance(
                        ST_Point($2, $1)::geography,
                        ST_Point(longitude, latitude)::geography
                    ) / 1000.0 as distance_km
                FROM pharmacies_on_duty
                WHERE is_on_duty = true
                AND ST_DWithin(
                    ST_Point($2, $1)::geography,
                    ST_Point(longitude, latitude)::geography,
                    $3 * 1000
                )
                ORDER BY distance_km ASC
                LIMIT 20
            "#
        } else {
            r#"
                SELECT 
                    service_id,
                    service_title,
                    latitude,
                    longitude,
                    is_on_duty,
                    garde_days,
                    opening_hours,
                    closing_hours,
                    emergency_phone,
                    0.0 as distance_km
                FROM pharmacies_on_duty
                WHERE is_on_duty = true
                ORDER BY service_title
                LIMIT 20
            "#
        };

        let rows = if user_lat.is_some() && user_lng.is_some() {
            sqlx::query(query)
                .bind(user_lat.unwrap())
                .bind(user_lng.unwrap())
                .bind(max_distance)
                .fetch_all(&self.pool)
                .await
        } else {
            sqlx::query(query)
                .fetch_all(&self.pool)
                .await
        }
        .map_err(|e| format!("Erreur recherche pharmacies de garde: {}", e))?;

        let mut results = Vec::new();
        for row in rows {
            let result = PharmacyOnDuty {
                service_id: row.get("service_id"),
                service_title: row.get("service_title"),
                latitude: row.get("latitude"),
                longitude: row.get("longitude"),
                is_on_duty: row.get("is_on_duty"),
                garde_days: row.get("garde_days"),
                opening_hours: row.get("opening_hours"),
                closing_hours: row.get("closing_hours"),
                emergency_phone: row.get("emergency_phone"),
            };
            results.push(result);
        }

        Ok(results)
    }

    /// Recherche de services médicaux disponibles
    pub async fn search_available_medical_services(
        &self,
        requested_service: Option<&str>,
        user_lat: Option<f64>,
        user_lng: Option<f64>,
        max_distance_km: Option<f64>,
    ) -> Result<Vec<MedicalServiceAvailability>, String> {
        let max_distance = max_distance_km.unwrap_or(50.0);
        let search_time = Utc::now();

        let query = if user_lat.is_some() && user_lng.is_some() {
            r#"
                SELECT DISTINCT
                    s.id as service_id,
                    s.data->'titre_service'->>'valeur' as service_title,
                    s.latitude,
                    s.longitude,
                    product->'prestationsMedicales' as available_services,
                    product->'planningHebdomadaire' as current_schedule,
                    (product->'planningHebdomadaire'->>'permanent')::boolean as is_24h,
                    (product->>'banqueSang')::boolean as has_blood_bank,
                    ST_Distance(
                        ST_Point($3, $2)::geography,
                        ST_Point(s.longitude, s.latitude)::geography
                    ) / 1000.0 as distance_km
                FROM services s,
                LATERAL jsonb_array_elements(
                    CASE 
                        WHEN jsonb_typeof(s.data->'produits') = 'array' 
                        THEN s.data->'produits'
                        ELSE '[]'::jsonb
                    END
                ) AS product
                WHERE 
                    s.is_active = true 
                    AND product->>'type' = 'hopital_clinique'
                    AND is_medical_service_available(product, $4, $1)
                    AND ST_DWithin(
                        ST_Point($3, $2)::geography,
                        ST_Point(s.longitude, s.latitude)::geography,
                        $5 * 1000
                    )
                ORDER BY distance_km ASC
                LIMIT 20
            "#
        } else {
            r#"
                SELECT DISTINCT
                    s.id as service_id,
                    s.data->'titre_service'->>'valeur' as service_title,
                    s.latitude,
                    s.longitude,
                    product->'prestationsMedicales' as available_services,
                    product->'planningHebdomadaire' as current_schedule,
                    (product->'planningHebdomadaire'->>'permanent')::boolean as is_24h,
                    (product->>'banqueSang')::boolean as has_blood_bank,
                    0.0 as distance_km
                FROM services s,
                LATERAL jsonb_array_elements(
                    CASE 
                        WHEN jsonb_typeof(s.data->'produits') = 'array' 
                        THEN s.data->'produits'
                        ELSE '[]'::jsonb
                    END
                ) AS product
                WHERE 
                    s.is_active = true 
                    AND product->>'type' = 'hopital_clinique'
                    AND is_medical_service_available(product, $2, $1)
                ORDER BY service_title
                LIMIT 20
            "#
        };

        let rows = if user_lat.is_some() && user_lng.is_some() {
            sqlx::query(query)
                .bind(requested_service)
                .bind(user_lat.unwrap())
                .bind(user_lng.unwrap())
                .bind(search_time)
                .bind(max_distance)
                .fetch_all(&self.pool)
                .await
        } else {
            sqlx::query(query)
                .bind(requested_service)
                .bind(search_time)
                .fetch_all(&self.pool)
                .await
        }
        .map_err(|e| format!("Erreur recherche services médicaux: {}", e))?;

        let mut results = Vec::new();
        for row in rows {
            let available_services: Option<serde_json::Value> = row.get("available_services");
            let current_schedule: Option<serde_json::Value> = row.get("current_schedule");
            
            let services_vec = if let Some(services) = available_services {
                if services.is_array() {
                    services.as_array()
                        .unwrap()
                        .iter()
                        .filter_map(|v| v.as_str())
                        .map(|s| s.to_string())
                        .collect()
                } else {
                    Vec::new()
                }
            } else {
                Vec::new()
            };

            let schedule_map = if let Some(schedule) = current_schedule {
                if schedule.is_object() {
                    schedule.as_object()
                        .unwrap()
                        .iter()
                        .map(|(k, v)| (k.clone(), v.clone()))
                        .collect()
                } else {
                    HashMap::new()
                }
            } else {
                HashMap::new()
            };

            let result = MedicalServiceAvailability {
                service_id: row.get("service_id"),
                service_title: row.get("service_title"),
                available_services: services_vec,
                current_schedule: Some(schedule_map),
                is_24h: row.get("is_24h"),
                has_blood_bank: row.get("has_blood_bank"),
            };
            results.push(result);
        }

        Ok(results)
    }

    /// Rafraîchit la vue matérialisée des pharmacies de garde
    pub async fn refresh_pharmacies_on_duty(&self) -> Result<(), String> {
        sqlx::query("SELECT refresh_pharmacies_on_duty()")
            .execute(&self.pool)
            .await
            .map_err(|e| format!("Erreur rafraîchissement pharmacies de garde: {}", e))?;

        Ok(())
    }

    /// Analyse une requête de recherche pour détecter les intentions de planification
    pub fn analyze_search_intent(&self, query: &str) -> SearchIntent {
        let query_lower = query.to_lowercase();
        
        // Détection de recherche de pharmacie de garde
        if query_lower.contains("pharmacie") && 
           (query_lower.contains("garde") || query_lower.contains("urgent") || 
            query_lower.contains("nuit") || query_lower.contains("24h")) {
            return SearchIntent::PharmacyOnDuty;
        }
        
        // Détection de recherche de service médical
        if (query_lower.contains("médecin") || query_lower.contains("docteur") || 
            query_lower.contains("gynécologue") || query_lower.contains("cardiologue") ||
            query_lower.contains("urgences") || query_lower.contains("hôpital") ||
            query_lower.contains("clinique")) && 
           (query_lower.contains("disponible") || query_lower.contains("ouvert") ||
            query_lower.contains("maintenant") || query_lower.contains("urgent")) {
            return SearchIntent::MedicalServiceAvailable;
        }
        
        // Détection de recherche avec contrainte temporelle
        if query_lower.contains("maintenant") || query_lower.contains("urgent") ||
           query_lower.contains("immédiat") || query_lower.contains("tout de suite") {
            return SearchIntent::TimeConstrained;
        }
        
        SearchIntent::General
    }
}

#[derive(Debug, Clone)]
pub enum SearchIntent {
    PharmacyOnDuty,
    MedicalServiceAvailable,
    TimeConstrained,
    General,
}

impl SearchIntent {
    pub fn should_use_scheduling_search(&self) -> bool {
        matches!(self, SearchIntent::PharmacyOnDuty | SearchIntent::MedicalServiceAvailable | SearchIntent::TimeConstrained)
    }
}
