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
                service_id: row.get::<i32, _>("service_id"),
                product_data: row.get::<serde_json::Value, _>("product_data"),
                relevance_score: row.get::<f64, _>("relevance_score"),
                distance_km: row.get::<Option<f64>, _>("distance_km"),
                is_available_now: row.get::<bool, _>("is_available_now"),
                availability_info: row.get::<String, _>("availability_info"),
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
                service_id: row.get::<i32, _>("service_id"),
                service_title: row.get::<String, _>("service_title"),
                latitude: row.get::<Option<f64>, _>("latitude"),
                longitude: row.get::<Option<f64>, _>("longitude"),
                is_on_duty: row.get::<bool, _>("is_on_duty"),
                garde_days: row.get::<Option<String>, _>("garde_days"),
                opening_hours: row.get::<Option<String>, _>("opening_hours"),
                closing_hours: row.get::<Option<String>, _>("closing_hours"),
                emergency_phone: row.get::<Option<String>, _>("emergency_phone"),
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
                    COALESCE(CAST(SPLIT_PART(s.gps, ',', 1) AS FLOAT), 0.0) as latitude,
                    COALESCE(CAST(SPLIT_PART(s.gps, ',', 2) AS FLOAT), 0.0) as longitude,
                    p.product_data->'prestationsMedicales' as available_services,
                    p.product_data->'planningHebdomadaire' as current_schedule,
                    (p.product_data->'planningHebdomadaire'->>'permanent')::boolean as is_24h,
                    (p.product_data->>'banqueSang')::boolean as has_blood_bank,
                    ST_Distance(
                        ST_Point($3, $2)::geography,
                        ST_Point(
                            COALESCE(CAST(SPLIT_PART(s.gps, ',', 2) AS FLOAT), 0.0),
                            COALESCE(CAST(SPLIT_PART(s.gps, ',', 1) AS FLOAT), 0.0)
                        )::geography
                    ) / 1000.0 as distance_km
                FROM services s
                INNER JOIN service_products p ON p.service_id = s.id AND p.is_active = true
                WHERE 
                    s.is_active = true 
                    AND s.gps IS NOT NULL
                    AND s.gps != ''
                    AND s.gps ~ '^-?\d+\.?\d*,-?\d+\.?\d*$'
                    AND p.product_data->>'type' = 'hopital_clinique'
                    AND is_medical_service_available(p.product_data, $4, $1)
                    AND ST_DWithin(
                        ST_Point($3, $2)::geography,
                        ST_Point(
                            COALESCE(CAST(SPLIT_PART(s.gps, ',', 2) AS FLOAT), 0.0),
                            COALESCE(CAST(SPLIT_PART(s.gps, ',', 1) AS FLOAT), 0.0)
                        )::geography,
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
                    COALESCE(CAST(SPLIT_PART(s.gps, ',', 1) AS FLOAT), 0.0) as latitude,
                    COALESCE(CAST(SPLIT_PART(s.gps, ',', 2) AS FLOAT), 0.0) as longitude,
                    p.product_data->'prestationsMedicales' as available_services,
                    p.product_data->'planningHebdomadaire' as current_schedule,
                    (p.product_data->'planningHebdomadaire'->>'permanent')::boolean as is_24h,
                    (p.product_data->>'banqueSang')::boolean as has_blood_bank,
                    0.0 as distance_km
                FROM services s
                INNER JOIN service_products p ON p.service_id = s.id AND p.is_active = true
                WHERE 
                    s.is_active = true 
                    AND p.product_data->>'type' = 'hopital_clinique'
                    AND is_medical_service_available(p.product_data, $2, $1)
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
            let available_services: Option<serde_json::Value> =
                row.get::<Option<serde_json::Value>, _>("available_services");
            let current_schedule: Option<serde_json::Value> =
                row.get::<Option<serde_json::Value>, _>("current_schedule");

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
                service_id: row.get::<i32, _>("service_id"),
                service_title: row.get::<String, _>("service_title"),
                available_services: services_vec,
                current_schedule: Some(schedule_map),
                is_24h: row.get::<bool, _>("is_24h"),
                has_blood_bank: row.get::<bool, _>("has_blood_bank"),
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

    /// Analyse une requête de recherche pour détecter les intentions de planification (UNIQUEMENT pour recherche générale)
    /// ✅ NETTOYÉ 2025-11-27 : Ne détecte QUE les intentions de planification (PharmacyOnDuty, MedicalServiceAvailable, TimeConstrained)
    /// Pas de détection de services spécialisés (c'est fait via le menu dédié)
    pub fn analyze_scheduling_intent_only(&self, query: &str) -> SearchIntent {
        let query_lower = query.to_lowercase();

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

    /// Analyse une requête de recherche pour détecter les intentions (complet - utilisé pour recherche spécialisée)
    /// ✅ UTILISÉ UNIQUEMENT pour recherche spécialisée dédiée (via menu)
    pub fn analyze_search_intent(&self, query: &str) -> SearchIntent {
        let query_lower = query.to_lowercase();
        let query_words: Vec<&str> = query_lower.split_whitespace().collect();

        // ✅ OPTIMISÉ : Détection spécialisée plus précise (exige plus de contexte)
        // Pharmacie : doit être le mot principal ou accompagné de mots-clés spécifiques
        if query_lower.contains("pharmacie")
            && !query_lower.contains("garde")
            && !query_lower.contains("urgent")
        {
            // Vérifier que "pharmacie" n'est pas dans un contexte de produit général
            let is_product_context = query_lower.contains("produit")
                || query_lower.contains("acheter")
                || query_lower.contains("vendre")
                || query_lower.contains("prix");

            // Si "pharmacie" est le mot principal (dans les 3 premiers mots) ou pas dans contexte produit
            let pharmacy_index = query_words.iter().position(|w| w.contains("pharmacie"));
            if !is_product_context && (pharmacy_index.is_none() || pharmacy_index.unwrap() < 3) {
                return SearchIntent::SpecializedPharmacy;
            }
        }

        // Hôpital/Clinique : doit être le mot principal (pas "clinique vétérinaire" ou "hôpital pour animaux")
        if query_lower.contains("hôpital")
            || query_lower.contains("hopital")
            || query_lower.contains("clinique")
        {
            // Exclure les contextes non-médicaux
            let is_non_medical = query_lower.contains("vétérinaire")
                || query_lower.contains("veterinaire")
                || query_lower.contains("animal")
                || query_lower.contains("chien")
                || query_lower.contains("chat");

            if !is_non_medical {
                let hospital_index = query_words.iter().position(|w| {
                    w.contains("hopital") || w.contains("hôpital") || w.contains("clinique")
                });
                if hospital_index.is_none() || hospital_index.unwrap() < 3 {
                    return SearchIntent::SpecializedHospital;
                }
            }
        }

        // Laboratoire/Imagerie : doit être accompagné de contexte médical ou être le mot principal
        if query_lower.contains("laboratoire") || query_lower.contains("imagerie") {
            let is_medical_context = query_lower.contains("médical")
                || query_lower.contains("medical")
                || query_lower.contains("sang")
                || query_lower.contains("radio")
                || query_lower.contains("scanner");

            // "analyse" seul n'est pas assez spécifique, doit être "analyse de sang" ou "analyse médicale"
            if query_lower.contains("analyse") {
                if is_medical_context
                    || query_lower.contains("analyse de")
                    || query_lower.contains("analyse du")
                {
                    return SearchIntent::SpecializedLaboratory;
                }
            } else {
                // "laboratoire" ou "imagerie" sont assez spécifiques
                return SearchIntent::SpecializedLaboratory;
            }
        }

        // Agence de voyage / Ticket bus : doit contenir "agence" ET ("voyage" OU "bus" OU "ticket")
        if query_lower.contains("agence")
            && (query_lower.contains("voyage")
                || query_lower.contains("bus")
                || query_lower.contains("ticket"))
        {
            return SearchIntent::SpecializedTravelAgency;
        }

        // Covoiturage : mot spécifique, détection OK
        if query_lower.contains("covoiturage") || query_lower.contains("covoit") {
            return SearchIntent::SpecializedCovoiturage;
        }

        // Taxi : mot spécifique, mais vérifier qu'il n'est pas dans un contexte général
        if query_lower.contains("taxi") {
            // Exclure "taxi moto" ou "taxi vélo" qui sont des produits, pas des services
            let is_product = query_lower.contains("moto")
                || query_lower.contains("vélo")
                || query_lower.contains("velo");
            if !is_product {
                return SearchIntent::SpecializedTaxi;
            }
        }

        // ✅ NOUVEAU 2025-11-27 : Détection de recherche de banque de sang
        if query_lower.contains("banque de sang")
            || query_lower.contains("don de sang")
            || query_lower.contains("groupe sanguin")
            || (query_lower.contains("sang")
                && (query_lower.contains("o+")
                    || query_lower.contains("o-")
                    || query_lower.contains("a+")
                    || query_lower.contains("a-")
                    || query_lower.contains("b+")
                    || query_lower.contains("b-")
                    || query_lower.contains("ab+")
                    || query_lower.contains("ab-")
                    || query_lower.contains("rh+")
                    || query_lower.contains("rh-")))
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

    /// ✅ NOUVEAU 2025-11-27 : Détection basée sur specialized_type en base (sans ambiguïté)
    /// ✅ OPTIMISÉ 2025-11-27 : Détection tolérante aux erreurs (casse, fautes de frappe, textes tronqués)
    /// Utilise similarity() de pg_trgm et unaccent pour une détection robuste
    /// Retourne le specialized_type correspondant si trouvé, None sinon
    pub async fn detect_specialized_type_from_database(
        &self,
        query: &str,
    ) -> Result<Option<String>, String> {
        use crate::utils::log::log_info;

        let query_lower = query.to_lowercase();

        // ✅ Mapping étendu avec variations et racines pour détection flexible
        // Inclut les variantes tronquées, fautes de frappe courantes, etc.
        let keyword_variations: Vec<(Vec<&str>, &str)> = vec![
            // Pharmacie : variations avec fautes de frappe courantes et textes tronqués
            (
                vec!["pharmacie", "pharmaci", "pharm", "pharma", "pharmac"],
                "pharmacie",
            ),
            // Hôpital/Clinique : variations multiples + spécialités médicales
            (
                vec![
                    "hopital",
                    "hôpital",
                    "hopit",
                    "hospital",
                    "clinique",
                    "cliniqu",
                    "clin",
                    // ✅ NOUVEAU: Spécialités médicales (mappées vers hopital_clinique)
                    "urologue",
                    "urologie",
                    "urolog",
                    "dermatologue",
                    "dermatologie",
                    "dermatolog",
                    "cardiologue",
                    "cardiologie",
                    "cardiolog",
                    "gynécologue",
                    "gynecologue",
                    "gynéco",
                    "gyneco",
                    "gynecol",
                    "pédiatre",
                    "pediatre",
                    "pediatri",
                    "ophtalmologue",
                    "ophtalmo",
                    "ophtalmolog",
                    "orthopédiste",
                    "orthopediste",
                    "orthoped",
                    "neurologue",
                    "neurologie",
                    "neurolog",
                    "médecin",
                    "medecin",
                    "docteur",
                    "urgences",
                    "urgence",
                ],
                "hopital_clinique",
            ),
            // Laboratoire/Imagerie
            (
                vec![
                    "laboratoire",
                    "laboratoir",
                    "labo",
                    "lab",
                    "imagerie",
                    "imag",
                    "imager",
                ],
                "laboratoire_imagerie",
            ),
            // Agence de voyage (nécessite contexte)
            (
                vec!["agence", "voyage", "voyag", "bus", "billet"],
                "agence_voyage",
            ),
            // Covoiturage
            (
                vec!["covoiturage", "covoit", "covoiturag", "covoitura"],
                "covoiturage",
            ),
            // Taxi
            (vec!["taxi", "taxis", "tax"], "taxi_ville"),
            // Banque de sang (phrases complètes)
            (
                vec![
                    "banque de sang",
                    "banque sang",
                    "don de sang",
                    "don sang",
                    "groupe sanguin",
                    "sang",
                ],
                "banque_sang",
            ),
        ];

        // Détecter le type potentiel avec recherche flexible (sans doublons)
        let mut potential_types: std::collections::HashSet<&str> = std::collections::HashSet::new();

        for (variations, specialized_type) in keyword_variations.iter() {
            // Vérifier si au moins une variation est présente dans la requête
            let matches = variations
                .iter()
                .any(|variation| query_lower.contains(variation));

            if matches {
                // Cas spéciaux pour agence_voyage (nécessite contexte)
                if *specialized_type == "agence_voyage" {
                    let has_agence = query_lower.contains("agence");
                    let has_voyage_context = query_lower.contains("voyage")
                        || query_lower.contains("voyag")
                        || query_lower.contains("bus")
                        || query_lower.contains("billet")
                        || query_lower.contains("ticket");

                    if has_agence && has_voyage_context {
                        potential_types.insert(specialized_type);
                    }
                } else {
                    potential_types.insert(specialized_type);
                }
            }
        }

        // ✅ OPTIMISÉ: Vérifier en base si des services avec ces specialized_type existent
        let specialized_types_vec: Vec<&str> = potential_types.into_iter().collect();
        if specialized_types_vec.is_empty() {
            // ✅ NOUVEAU: Tentative de détection fuzzy avec similarity() pour textes tronqués/erreurs
            log_info(&format!(
                "[SchedulingSearchService] 🔍 Aucun mot-clé spécialisé détecté directement, tentative fuzzy matching pour: '{}'",
                query
            ));

            // Recherche fuzzy en base avec similarity() de pg_trgm
            let fuzzy_match: Option<String> = sqlx::query_scalar(
                r#"
                SELECT specialized_type
                FROM services
                WHERE specialized_type IS NOT NULL
                AND is_active = TRUE
                AND (
                    -- Match direct sur specialized_type (casse insensible)
                    LOWER(specialized_type) ILIKE '%' || $1 || '%'
                    -- OU fuzzy match avec similarity (tolère fautes de frappe)
                    OR similarity(LOWER(specialized_type), LOWER($1)) > 0.5
                    -- OU match sur titre/catégorie avec unaccent (tolère accents)
                    OR unaccent(LOWER(COALESCE(data->>'titre_service', data->'titre_service'->>'valeur', ''))) ILIKE '%' || unaccent(LOWER($1)) || '%'
                    OR unaccent(LOWER(COALESCE(category, data->>'category', data->'category'->>'valeur', ''))) ILIKE '%' || unaccent(LOWER($1)) || '%'
                )
                ORDER BY 
                    -- Prioriser les matches exacts
                    CASE WHEN LOWER(specialized_type) = LOWER($1) THEN 1 ELSE 2 END,
                    -- Puis par similarity score décroissant
                    similarity(LOWER(specialized_type), LOWER($1)) DESC NULLS LAST
                LIMIT 1
                "#
            )
            .bind(query_lower.as_str())
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| format!("Erreur recherche fuzzy specialized_type: {}", e))?;

            if let Some(found) = fuzzy_match {
                log_info(&format!(
                    "[SchedulingSearchService] ✅ specialized_type '{}' détecté via fuzzy matching pour requête: '{}'",
                    found, query
                ));
                return Ok(Some(found));
            } else {
                log_info(&format!(
                    "[SchedulingSearchService] ⚠️ Aucun specialized_type détecté (ni direct ni fuzzy) pour: '{}'",
                    query
                ));
                return Ok(None);
            }
        }

        // Vérifier tous les types en une seule requête avec ANY pour performance
        let found_type: Option<String> = sqlx::query_scalar(
            r#"
            SELECT specialized_type
            FROM services
            WHERE specialized_type = ANY($1::text[])
            AND is_active = TRUE
            LIMIT 1
            "#,
        )
        .bind(&specialized_types_vec)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| format!("Erreur vérification specialized_type: {}", e))?;

        if let Some(found) = found_type {
            log_info(&format!(
                "[SchedulingSearchService] ✅ specialized_type '{}' détecté en base (services actifs présents) pour requête: '{}'",
                found, query
            ));
            Ok(Some(found))
        } else {
            log_info(&format!(
                "[SchedulingSearchService] ⚠️ Aucun service spécialisé actif trouvé en base pour types: {:?}, requête: '{}'",
                specialized_types_vec, query
            ));
            Ok(None)
        }
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
            let service_id: i32 = row.get::<i32, _>("service_id");
            let nom: String = row.get::<String, _>("nom");
            let distance: Option<f64> = row.get::<Option<f64>, _>("distance_km");
            let score: f64 = row.get::<f64, _>("relevance_score");
            let is_available: bool = row.get::<bool, _>("is_available_now");
            let stocks: serde_json::Value =
                row.get::<serde_json::Value, _>("stocks_groupes_sanguins");
            let urgence_24h: bool = row.get::<bool, _>("urgence_24h");

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
