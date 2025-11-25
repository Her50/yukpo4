// Service de recherche avancée avec planifications
// Gère la recherche de pharmacies de garde et services médicaux disponibles

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use sqlx::Row;
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
            sqlx::query(query).fetch_all(&self.pool).await
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
                    services
                        .as_array()
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
                    schedule
                        .as_object()
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

        // ✅ NOUVEAU 2025-11-26 : Détection spécialisée (prioritaire)
        // Pharmacie (simple mention, pas forcément garde)
        if query_lower.contains("pharmacie") && !query_lower.contains("garde") && !query_lower.contains("urgent") {
            return SearchIntent::SpecializedPharmacy;
        }

        // Hôpital/Clinique (simple mention)
        if query_lower.contains("hôpital") || query_lower.contains("hopital") || query_lower.contains("clinique") {
            return SearchIntent::SpecializedHospital;
        }

        // Laboratoire/Imagerie
        if query_lower.contains("laboratoire") || query_lower.contains("imagerie") || query_lower.contains("analyse") {
            return SearchIntent::SpecializedLaboratory;
        }

        // Agence de voyage / Ticket bus
        if query_lower.contains("agence") && (query_lower.contains("voyage") || query_lower.contains("bus") || query_lower.contains("ticket")) {
            return SearchIntent::SpecializedTravelAgency;
        }

        // Covoiturage
        if query_lower.contains("covoiturage") || query_lower.contains("covoit") {
            return SearchIntent::SpecializedCovoiturage;
        }

        // Taxi
        if query_lower.contains("taxi") {
            return SearchIntent::SpecializedTaxi;
        }

        // ✅ NOUVEAU 2025-11-27 : Détection de recherche de banque de sang
        if query_lower.contains("banque de sang")
            || query_lower.contains("don de sang")
            || query_lower.contains("groupe sanguin")
            || (query_lower.contains("sang") && (
                query_lower.contains("o+") || query_lower.contains("o-")
                || query_lower.contains("a+") || query_lower.contains("a-")
                || query_lower.contains("b+") || query_lower.contains("b-")
                || query_lower.contains("ab+") || query_lower.contains("ab-")
                || query_lower.contains("rh+") || query_lower.contains("rh-")
            ))
        {
            return SearchIntent::SpecializedBloodBank;
        }

        // Détection de recherche de pharmacie de garde (avec contrainte temporelle)
        if query_lower.contains("pharmacie")
            && (query_lower.contains("garde")
                || query_lower.contains("urgent")
                || query_lower.contains("nuit")
                || query_lower.contains("24h"))
        {
            return SearchIntent::PharmacyOnDuty;
        }

        // Détection de recherche de service médical (avec contrainte temporelle)
        if (query_lower.contains("médecin")
            || query_lower.contains("docteur")
            || query_lower.contains("gynécologue")
            || query_lower.contains("cardiologue")
            || query_lower.contains("urgences"))
            && (query_lower.contains("disponible")
                || query_lower.contains("ouvert")
                || query_lower.contains("maintenant")
                || query_lower.contains("urgent"))
        {
            return SearchIntent::MedicalServiceAvailable;
        }

        // Détection de recherche avec contrainte temporelle
        if query_lower.contains("maintenant")
            || query_lower.contains("urgent")
            || query_lower.contains("immédiat")
            || query_lower.contains("tout de suite")
        {
            return SearchIntent::TimeConstrained;
        }

        SearchIntent::General
    }

    /// ✅ NOUVEAU 2025-11-26 : Détecte si c'est une recherche spécialisée
    pub fn is_specialized_search(intent: &SearchIntent) -> bool {
        matches!(
            intent,
            SearchIntent::SpecializedPharmacy
                | SearchIntent::SpecializedHospital
                | SearchIntent::SpecializedLaboratory
                | SearchIntent::SpecializedTravelAgency
                | SearchIntent::SpecializedCovoiturage
                | SearchIntent::SpecializedTaxi
                | SearchIntent::SpecializedBloodBank
        )
    }

    /// ✅ NOUVEAU 2025-11-27 : Recherche de banques de sang avec moment
    pub async fn search_banques_sang_with_moment(
        &self,
        query: &str,
        user_lat: Option<f64>,
        user_lng: Option<f64>,
        radius_km: Option<f64>,
    ) -> Result<Vec<SchedulingSearchResult>, String> {
        let radius = radius_km.unwrap_or(50.0);
        let user_gps = if let (Some(lat), Some(lng)) = (user_lat, user_lng) {
            Some(format!("{},{}", lat, lng))
        } else {
            None
        };

        let sql = r#"
            SELECT 
                banque_id as id,
                service_id,
                nom,
                adresse,
                quartier,
                ville,
                gps,
                telephone,
                telephone_urgence,
                whatsapp,
                stocks_groupes_sanguins,
                accepte_dons,
                accepte_demandes,
                urgence_24h,
                is_available_now,
                distance_km,
                relevance_score
            FROM search_banques_sang_with_moment($1, $2, $3, NULL, FALSE, FALSE)
        "#;

        let rows = sqlx::query(sql)
            .bind(query)
            .bind(user_gps)
            .bind(radius as i32)
            .fetch_all(&self.pool)
            .await
            .map_err(|e| format!("Erreur recherche banques de sang: {}", e))?;

        let mut results = Vec::new();
        for row in rows {
            let service_id: i32 = row.get("service_id");
            let nom: String = row.get("nom");
            let distance: Option<f64> = row.get("distance_km");
            let score: f64 = row.get("relevance_score");
            let is_available: bool = row.get("is_available_now");
            let stocks: serde_json::Value = row.get("stocks_groupes_sanguins");
            let urgence_24h: bool = row.get("urgence_24h");

            let data = serde_json::json!({
                "titre_service": {"valeur": nom},
                "type": "banque_sang",
                "is_available_now": is_available,
                "urgence_24h": urgence_24h,
                "stocks_groupes_sanguins": stocks,
                "accepte_dons": row.get::<bool, _>("accepte_dons"),
                "accepte_demandes": row.get::<bool, _>("accepte_demandes"),
                "adresse": row.get::<Option<String>, _>("adresse"),
                "quartier": row.get::<Option<String>, _>("quartier"),
                "ville": row.get::<Option<String>, _>("ville"),
                "telephone": row.get::<Option<String>, _>("telephone"),
                "telephone_urgence": row.get::<Option<String>, _>("telephone_urgence"),
                "whatsapp": row.get::<Option<String>, _>("whatsapp"),
            });

            results.push(SchedulingSearchResult {
                service_id,
                product_data: data,
                relevance_score: score,
                distance_km: distance,
                is_available_now: is_available,
                availability_info: if urgence_24h {
                    "Urgence 24h/24".to_string()
                } else if is_available {
                    "Disponible maintenant".to_string()
                } else {
                    "Fermé".to_string()
                },
            });
        }

        Ok(results)
    }
}

#[derive(Debug, Clone)]
pub enum SearchIntent {
    PharmacyOnDuty,
    MedicalServiceAvailable,
    TimeConstrained,
    General,
    // ✅ NOUVEAU 2025-11-26 : Intentions spécialisées
    SpecializedPharmacy,
    SpecializedHospital,
    SpecializedLaboratory,
    SpecializedTravelAgency,
    SpecializedCovoiturage,
    SpecializedTaxi,
    // ✅ NOUVEAU 2025-11-27 : Banque de sang (service spécialisé isolé)
    SpecializedBloodBank,
}

impl SearchIntent {
    pub fn should_use_scheduling_search(&self) -> bool {
        matches!(
            self,
            SearchIntent::PharmacyOnDuty
                | SearchIntent::MedicalServiceAvailable
                | SearchIntent::TimeConstrained
        )
    }
}
