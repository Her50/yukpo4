use crate::config::search_config::SearchConfig;
use crate::core::types::AppResult;
use crate::services::scheduling_search_service::SchedulingSearchService;
use crate::utils::log::{log_error, log_info};
use serde_json::Value;
use sqlx::{PgPool, Row};
use std::sync::Arc;

/// Résultat de recherche avec score détaillé
#[derive(Debug, Clone)]
pub struct SearchResult {
    pub service_id: i32,
    pub data: Value,
    pub total_score: f32,
    pub fulltext_score: f32,
    pub trigram_score: f32,
    pub recency_score: f32,
    pub category_score: f32,
    pub search_method: String,
    pub matched_fields: Vec<String>,
    /// ✅ Phase 10 - Distance en km (calculée avec PostgreSQL ST_Distance ou enrichie avec Google Maps)
    pub distance_km: Option<f64>,
    /// ✅ Phase 10 - Coordonnées GPS du service (pour enrichissement Google Maps)
    pub gps_coords: Option<(f64, f64)>,
}

/// Service de recherche native PostgreSQL intelligente
pub struct NativeSearchService {
    pool: PgPool,
    config: SearchConfig,
    /// ✅ Phase 10 - Service de matching géographique pour enrichir les distances
    geographic_matching: Option<Arc<crate::services::geographic_matching_service::GeographicMatchingService>>,
}

impl NativeSearchService {
    pub fn new(pool: PgPool) -> Self {
        let config = SearchConfig::default();
        Self { 
            pool, 
            config,
            geographic_matching: None,
        }
    }

    pub fn with_config(pool: PgPool, config: SearchConfig) -> Self {
        Self { 
            pool, 
            config,
            geographic_matching: None,
        }
    }

    /// ✅ Phase 10 - Constructeur avec service de matching géographique
    pub fn with_geographic_matching(
        pool: PgPool,
        geographic_matching: Arc<crate::services::geographic_matching_service::GeographicMatchingService>,
    ) -> Self {
        let config = SearchConfig::default();
        Self {
            pool,
            config,
            geographic_matching: Some(geographic_matching),
        }
    }

    /// Charger la configuration depuis un fichier et les variables d'environnement
    pub async fn load_config(&mut self, _config_path: Option<&str>) -> Result<(), String> {
        // Configuration déjà chargée par défaut
        Ok(())
    }

    /// ✅ NOUVEAU 2025-11-04 : Vérifier si un lieu est mentionné dans l'input
    /// Utilise l'opérateur && (overlap) pour tester intersection entre arrays
    /// Retourne TRUE si au moins UN produit a un lieu qui matche
    /// Retourne FALSE si aucun lieu ne matche → Utiliser TOUTE la base
    async fn check_if_location_in_input(&self, user_input: &str) -> AppResult<bool> {
        // Découper l'input en mots pour créer un array
        let words: Vec<String> = user_input
            .to_lowercase()
            .split_whitespace()
            .map(|s| s.to_string())
            .collect();

        let result = sqlx::query_scalar::<_, bool>(
            r#"
            SELECT EXISTS (
                SELECT 1 FROM autocomplete_characteristics ac
                WHERE ac.is_real_product = TRUE
                AND (
                    -- ✅ OPTIMISÉ : Test d'intersection avec opérateur && (overlap)
                    -- Convertir location_vector en lowercase pour comparaison case-insensitive
                    -- array_agg(unnest) reconstruit un array lowercase pour && (plus rapide que unnest)
                    (
                        SELECT array_agg(LOWER(elem))::TEXT[]
                        FROM unnest(ac.location_vector) AS elem
                    ) && $1::TEXT[]
                    -- ✅ OU fuzzy match pour gestion fautes de frappe (si && échoue)
                    OR EXISTS (
                        SELECT 1 FROM unnest(ac.location_vector) AS loc_val,
                                     unnest($1::TEXT[]) AS input_word
                        WHERE similarity(LOWER(loc_val), input_word) > 0.6
                    )
                )
            )
            "#
        )
        .bind(&words)
        .fetch_one(&self.pool)
        .await
        .unwrap_or(false);

        log::info!(
            "[NativeSearch] Lieu dans input ? {} (input: '{}', words: {:?})",
            result,
            user_input,
            words
        );

        Ok(result)
    }

    /// ✅ NOUVEAU 2025-11-04 : Recherche avec PRÉ-FILTRE lieu bidirectionnel intelligent
    /// Vérifie si UN élément du location_vector de chaque produit est dans l'input utilisateur
    pub async fn intelligent_search_with_location_prefilter(
        &self,
        search_query: &str,    // Mot-clé principal : "Nike"
        user_input_full: &str, // Input COMPLET : "Nike Air Douala"
        category_filter: Option<&str>,
        _user_id: Option<i32>,
        gps_zone: Option<&str>,
        search_radius_km: Option<i32>,
        specialized_type: Option<&str>, // ✅ NOUVEAU : Paramètre pour recherche spécialisée dédiée
    ) -> AppResult<Vec<SearchResult>> {
        let _start_time = std::time::Instant::now();
        log_info(&format!(
            "[NativeSearch] Recherche avec pré-filtre lieu: '{}' (input complet: '{}', specialized_type: {:?})",
            search_query, user_input_full, specialized_type
        ));

        // ✅ NOUVELLE LOGIQUE : Vérifier si l'input contient un lieu
        // En vérifiant si UN élément du location_vector de n'importe quel produit matche
        let has_location_in_input = self.check_if_location_in_input(user_input_full).await?;

        // ✅ IMPORTANT : Si AUCUN lieu ne matche → Passer NULL pour utiliser TOUTE la base
        let location_filter = if has_location_in_input {
            log_info("[NativeSearch] 🗺️ Lieu détecté dans input → PRÉ-FILTRE activé");
            Some(user_input_full) // Passer input complet pour filtrage
        } else {
            log_info(
                "[NativeSearch] ⚠️ AUCUN lieu détecté → Recherche dans TOUTE la base de données",
            );
            None // ✅ NULL → Pas de filtre lieu → TOUTE la base
        };

        // Appel à la recherche intelligente existante avec filtre conditionnel
        self.intelligent_search_internal(
            search_query,
            category_filter,
            location_filter, // ✅ NULL si aucun lieu, Some(input) si lieu détecté
            _user_id,
            gps_zone,
            search_radius_km,
            specialized_type, // ✅ Transmettre specialized_type
        )
        .await
    }

    /// Recherche intelligente combinant full-text et trigram
    pub async fn intelligent_search(
        &self,
        search_query: &str,
        category_filter: Option<&str>,
        location_filter: Option<&str>,
        _user_id: Option<i32>,
        gps_zone: Option<&str>,        // Nouveau paramètre GPS
        search_radius_km: Option<i32>, // Nouveau paramètre rayon
        specialized_type: Option<&str>, // ✅ NOUVEAU : Paramètre pour recherche spécialisée dédiée
    ) -> AppResult<Vec<SearchResult>> {
        // Appel à la version interne
        self.intelligent_search_internal(
            search_query,
            category_filter,
            location_filter,
            _user_id,
            gps_zone,
            search_radius_km,
            specialized_type, // ✅ Transmettre specialized_type
        )
        .await
    }

    /// Fonction interne de recherche
    async fn intelligent_search_internal(
        &self,
        search_query: &str,
        category_filter: Option<&str>,
        location_or_input_filter: Option<&str>, // Peut être lieu OU input complet
        _user_id: Option<i32>,
        gps_zone: Option<&str>,
        search_radius_km: Option<i32>,
        specialized_type: Option<&str>, // ✅ NOUVEAU : Paramètre pour recherche spécialisée dédiée
    ) -> AppResult<Vec<SearchResult>> {
        let _start_time = std::time::Instant::now();
        log_info(&format!(
            "[NativeSearch] Début recherche: '{}' (GPS: {:?}, Rayon: {:?}km, specialized_type: {:?})",
            search_query, gps_zone, search_radius_km, specialized_type
        ));

        // Normaliser la requête
        let normalized_query = self.normalize_query_advanced(search_query);

        // Recherche full-text principale avec filtrage GPS
        let mut fulltext_results = self
            .fulltext_search_with_gps(
                &normalized_query,
                category_filter,
                location_or_input_filter, // ✅ Input complet pour pré-filtre lieu
                gps_zone,
                search_radius_km,
                specialized_type, // ✅ Transmettre specialized_type (None pour recherche générale)
            )
            .await?;

        // Recherche trigram de fallback si pas assez de résultats
        if fulltext_results.len() < self.config.max_results as usize {
            let trigram_results = self
                .trigram_search_with_gps(
                    &normalized_query,
                    category_filter,
                    location_or_input_filter, // ✅ Input complet pour pré-filtre lieu
                    gps_zone,
                    search_radius_km,
                )
                .await?;

            // Fusionner les résultats en évitant les doublons
            for result in trigram_results {
                if !fulltext_results
                    .iter()
                    .any(|r| r.service_id == result.service_id)
                {
                    fulltext_results.push(result);
                }
            }
        }

        // Recherche par mots clés individuels si encore pas assez de résultats
        if fulltext_results.len() < self.config.max_results as usize / 2 {
            let keyword_results = self
                .keyword_search_with_gps(
                    &normalized_query,
                    category_filter,
                    location_or_input_filter, // ✅ Input complet pour pré-filtre lieu
                    gps_zone,
                    search_radius_km,
                )
                .await?;

            // Fusionner les résultats en évitant les doublons
            for result in keyword_results {
                if !fulltext_results
                    .iter()
                    .any(|r| r.service_id == result.service_id)
                {
                    fulltext_results.push(result);
                }
            }
        }

        // ✅ NOUVEAU: Enrichir tous les résultats avec les données Google Places complètes
        for result in &mut fulltext_results {
            if let Err(e) = crate::services::enrich_google_places::enrich_service_with_google_places_data(
                &self.pool,
                result.service_id,
                &mut result.data
            ).await {
                log::warn!(
                    "[NativeSearch] Erreur enrichissement Google Places pour service {}: {}",
                    result.service_id,
                    e
                );
            }
        }

        // Trier les résultats (pas de limite)
        fulltext_results.sort_by(|a, b| {
            b.total_score
                .partial_cmp(&a.total_score)
                .unwrap_or(std::cmp::Ordering::Equal)
        });

        let duration = _start_time.elapsed();
        log_info(&format!(
            "[NativeSearch] Recherche terminée en {:?}: {} résultats (avec filtrage GPS: {})",
            duration,
            fulltext_results.len(),
            gps_zone.is_some()
        ));

        Ok(fulltext_results)
    }

    /// Recherche fulltext pour fallback
    #[allow(dead_code)]
    async fn fulltext_search(
        &self,
        query: &str,
        category_filter: Option<&str>,
        location_filter: Option<&str>,
    ) -> AppResult<Vec<SearchResult>> {
        // Appeler la nouvelle méthode avec GPS désactivé
        // ✅ NETTOYÉ : Pas de specialized_type dans la recherche générale
        self.fulltext_search_with_gps(query, category_filter, location_filter, None, None, None)
            .await
    }

    /// Recherche full-text intelligente avec filtrage GPS
    /// ✅ NETTOYÉ 2025-11-27 : Recherche 100% générale - Plus de détection/redirection vers services spécialisés
    /// Les services spécialisés sont accessibles UNIQUEMENT via la page dédiée (menu spécialisé)
    /// Paramètre specialized_type: uniquement pour recherche spécialisée dédiée (hors recherche générale)
    async fn fulltext_search_with_gps(
        &self,
        query: &str,
        category_filter: Option<&str>,
        location_filter: Option<&str>,
        gps_zone: Option<&str>,
        search_radius_km: Option<i32>,
        specialized_type: Option<&str>, // ✅ Utilisé uniquement pour recherche spécialisée dédiée (hors recherche générale)
    ) -> AppResult<Vec<SearchResult>> {
        // ✅ NETTOYÉ 2025-11-27 : Si specialized_type fourni → Recherche spécialisée dédiée (hors recherche générale)
        // Sinon → Recherche générale pure (sans aucune détection spécialisée)
        if let Some(ref st) = specialized_type {
            log_info(&format!(
                "[NativeSearch] 🔷 Recherche spécialisée dédiée: '{}'",
                st
            ));
            
            // Mapper specialized_type vers SearchIntent pour recherche spécialisée
            let intent = match *st {
                "pharmacie" => crate::services::scheduling_search_service::SearchIntent::SpecializedPharmacy,
                "hopital_clinique" => crate::services::scheduling_search_service::SearchIntent::SpecializedHospital,
                "laboratoire_imagerie" => crate::services::scheduling_search_service::SearchIntent::SpecializedLaboratory,
                "agence_voyage" => crate::services::scheduling_search_service::SearchIntent::SpecializedTravelAgency,
                "covoiturage" => crate::services::scheduling_search_service::SearchIntent::SpecializedCovoiturage,
                "taxi_ville" => crate::services::scheduling_search_service::SearchIntent::SpecializedTaxi,
                "banque_sang" => crate::services::scheduling_search_service::SearchIntent::SpecializedBloodBank,
                _ => {
                    return Err(crate::core::types::AppError::BadRequest(format!(
                        "Type spécialisé non reconnu: '{}'",
                        st
                    )));
                }
            };
            
            // ✅ RECHERCHE SPÉCIALISÉE avec planification et moment intégrés
            let scheduling_service = SchedulingSearchService::new(self.pool.clone());
            let radius = search_radius_km.unwrap_or(50);
            let mut specialized_results: Vec<SearchResult> = Vec::new();
            
            log_info(&format!(
                "[NativeSearch] 🔷 Recherche spécialisée dédiée avec planification/moment: {:?}",
                intent
            ));

            match intent {
                crate::services::scheduling_search_service::SearchIntent::SpecializedPharmacy => {
                    let sql = r#"
                        SELECT 
                            pharmacy_id as id,
                            service_id,
                            nom,
                            adresse,
                            quartier,
                            ville,
                            gps,
                            telephone,
                            whatsapp,
                            is_on_duty_now,
                            distance_km,
                            relevance_score
                        FROM search_pharmacies_with_moment($1, $2, $3, FALSE)
                    "#;
                    let rows = sqlx::query(sql)
                        .bind(query)
                        .bind(gps_zone)
                        .bind(radius)
                        .fetch_all(&self.pool)
                        .await
                        .map_err(|e| format!("Erreur recherche pharmacies: {}", e))?;

                    for row in rows {
                        let service_id: i32 = row.get("service_id");
                        let nom: String = row.get("nom");
                        let is_on_duty: bool = row.get("is_on_duty_now");
                        let distance: Option<f64> = row.get("distance_km");
                        let score: f64 = row.get("relevance_score");

                        // Construire data JSONB
                        let data = serde_json::json!({
                            "titre_service": {"valeur": nom},
                            "type": "pharmacie",
                            "is_on_duty_now": is_on_duty,
                            "adresse": row.get::<Option<String>, _>("adresse"),
                            "quartier": row.get::<Option<String>, _>("quartier"),
                            "ville": row.get::<Option<String>, _>("ville"),
                            "telephone": row.get::<Option<String>, _>("telephone"),
                            "whatsapp": row.get::<Option<String>, _>("whatsapp"),
                        });

                        specialized_results.push(SearchResult {
                            service_id,
                            data,
                            total_score: score as f32,
                            fulltext_score: score as f32,
                            trigram_score: 0.0,
                            recency_score: 0.0,
                            category_score: 0.0,
                            search_method: "specialized_pharmacy".to_string(),
                            matched_fields: vec!["nom".to_string(), "is_on_duty_now".to_string()],
                            distance_km: distance,
                            gps_coords: None,
                        });
                    }
                }
                crate::services::scheduling_search_service::SearchIntent::SpecializedHospital => {
                    let sql = r#"
                        SELECT 
                            hospital_id as id,
                            service_id,
                            nom,
                            type_etablissement,
                            adresse,
                            quartier,
                            ville,
                            gps,
                            telephone,
                            whatsapp,
                            is_available_now,
                            distance_km,
                            relevance_score
                        FROM search_hospitals_with_moment($1, $2, $3, FALSE)
                    "#;
                    let rows = sqlx::query(sql)
                        .bind(query)
                        .bind(gps_zone)
                        .bind(radius)
                        .fetch_all(&self.pool)
                        .await
                        .map_err(|e| format!("Erreur recherche hôpitaux: {}", e))?;

                    for row in rows {
                        let service_id: i32 = row.get("service_id");
                        let nom: String = row.get("nom");
                        let is_available: bool = row.get("is_available_now");
                        let distance: Option<f64> = row.get("distance_km");
                        let score: f64 = row.get("relevance_score");

                        let data = serde_json::json!({
                            "titre_service": {"valeur": nom},
                            "type": "hopital_clinique",
                            "is_available_now": is_available,
                            "type_etablissement": row.get::<Option<String>, _>("type_etablissement"),
                            "adresse": row.get::<Option<String>, _>("adresse"),
                            "telephone": row.get::<Option<String>, _>("telephone"),
                        });

                        specialized_results.push(SearchResult {
                            service_id,
                            data,
                            total_score: score as f32,
                            fulltext_score: score as f32,
                            trigram_score: 0.0,
                            recency_score: 0.0,
                            category_score: 0.0,
                            search_method: "specialized_hospital".to_string(),
                            matched_fields: vec!["nom".to_string(), "is_available_now".to_string()],
                            distance_km: distance,
                            gps_coords: None,
                        });
                    }
                }
                crate::services::scheduling_search_service::SearchIntent::SpecializedLaboratory => {
                    let sql = r#"
                        SELECT 
                            laboratory_id as id,
                            service_id,
                            nom,
                            type_laboratoire,
                            adresse,
                            quartier,
                            ville,
                            gps,
                            telephone,
                            whatsapp,
                            is_available_now,
                            distance_km,
                            relevance_score
                        FROM search_laboratories_with_moment($1, $2, $3)
                    "#;
                    let rows = sqlx::query(sql)
                        .bind(query)
                        .bind(gps_zone)
                        .bind(radius)
                        .fetch_all(&self.pool)
                        .await
                        .map_err(|e| format!("Erreur recherche laboratoires: {}", e))?;

                    for row in rows {
                        let service_id: i32 = row.get("service_id");
                        let nom: String = row.get("nom");
                        let distance: Option<f64> = row.get("distance_km");
                        let score: f64 = row.get("relevance_score");

                        let data = serde_json::json!({
                            "titre_service": {"valeur": nom},
                            "type": "laboratoire_imagerie",
                            "type_laboratoire": row.get::<Option<String>, _>("type_laboratoire"),
                            "adresse": row.get::<Option<String>, _>("adresse"),
                            "telephone": row.get::<Option<String>, _>("telephone"),
                        });

                        specialized_results.push(SearchResult {
                            service_id,
                            data,
                            total_score: score as f32,
                            fulltext_score: score as f32,
                            trigram_score: 0.0,
                            recency_score: 0.0,
                            category_score: 0.0,
                            search_method: "specialized_laboratory".to_string(),
                            matched_fields: vec!["nom".to_string()],
                            distance_km: distance,
                            gps_coords: None,
                        });
                    }
                }
                crate::services::scheduling_search_service::SearchIntent::SpecializedTravelAgency => {
                    let sql = r#"
                        SELECT 
                            agency_id as id,
                            service_id,
                            nom_agence,
                            adresse,
                            quartier,
                            ville,
                            gps,
                            telephone,
                            whatsapp,
                            peut_emettre_tickets_bus,
                            distance_km,
                            relevance_score
                        FROM search_travel_agencies_with_moment($1, $2, $3)
                    "#;
                    let rows = sqlx::query(sql)
                        .bind(query)
                        .bind(gps_zone)
                        .bind(radius)
                        .fetch_all(&self.pool)
                        .await
                        .map_err(|e| format!("Erreur recherche agences: {}", e))?;

                    for row in rows {
                        let service_id: i32 = row.get("service_id");
                        let nom: String = row.get("nom_agence");
                        let distance: Option<f64> = row.get("distance_km");
                        let score: f64 = row.get("relevance_score");

                        let data = serde_json::json!({
                            "titre_service": {"valeur": nom},
                            "type": "agence_voyage",
                            "peut_emettre_tickets_bus": row.get::<bool, _>("peut_emettre_tickets_bus"),
                            "adresse": row.get::<Option<String>, _>("adresse"),
                            "telephone": row.get::<Option<String>, _>("telephone"),
                        });

                        specialized_results.push(SearchResult {
                            service_id,
                            data,
                            total_score: score as f32,
                            fulltext_score: score as f32,
                            trigram_score: 0.0,
                            recency_score: 0.0,
                            category_score: 0.0,
                            search_method: "specialized_travel_agency".to_string(),
                            matched_fields: vec!["nom_agence".to_string()],
                            distance_km: distance,
                            gps_coords: None,
                        });
                    }
                }
                crate::services::scheduling_search_service::SearchIntent::SpecializedCovoiturage => {
                    let sql = r#"
                        SELECT 
                            covoiturage_id as id,
                            service_id,
                            depart,
                            destination,
                            gps_depart,
                            date_depart,
                            heure_depart,
                            nombre_places,
                            places_disponibles,
                            prix_par_place,
                            devise,
                            distance_km,
                            relevance_score
                        FROM search_covoiturages_with_moment($1, $2, $3, NULL)
                    "#;
                    let rows = sqlx::query(sql)
                        .bind(query)
                        .bind(gps_zone)
                        .bind(radius)
                        .fetch_all(&self.pool)
                        .await
                        .map_err(|e| format!("Erreur recherche covoiturages: {}", e))?;

                    for row in rows {
                        let service_id: i32 = row.get("service_id");
                        let depart: String = row.get("depart");
                        let destination: String = row.get("destination");
                        let distance: Option<f64> = row.get("distance_km");
                        let score: f64 = row.get("relevance_score");

                        let data = serde_json::json!({
                            "titre_service": {"valeur": format!("{} → {}", depart, destination)},
                            "type": "covoiturage",
                            "depart": depart,
                            "destination": destination,
                            "date_depart": row.get::<chrono::DateTime<chrono::Utc>, _>("date_depart").to_rfc3339(),
                            "places_disponibles": row.get::<i32, _>("places_disponibles"),
                            "prix_par_place": row.get::<i32, _>("prix_par_place"),
                        });

                        specialized_results.push(SearchResult {
                            service_id,
                            data,
                            total_score: score as f32,
                            fulltext_score: score as f32,
                            trigram_score: 0.0,
                            recency_score: 0.0,
                            category_score: 0.0,
                            search_method: "specialized_covoiturage".to_string(),
                            matched_fields: vec!["depart".to_string(), "destination".to_string()],
                            distance_km: distance,
                            gps_coords: None,
                        });
                    }
                }
                crate::services::scheduling_search_service::SearchIntent::SpecializedTaxi => {
                    let sql = r#"
                        SELECT 
                            taxi_id as id,
                            service_id,
                            nom_chauffeur,
                            telephone,
                            whatsapp,
                            zone_intervention,
                            gps_actuel,
                            is_available_now,
                            is_on_duty,
                            distance_km,
                            relevance_score
                        FROM search_taxis_with_moment($1, $2, $3, TRUE)
                    "#;
                    let rows = sqlx::query(sql)
                        .bind(query)
                        .bind(gps_zone)
                        .bind(radius)
                        .fetch_all(&self.pool)
                        .await
                        .map_err(|e| format!("Erreur recherche taxis: {}", e))?;

                    for row in rows {
                        let service_id: i32 = row.get("service_id");
                        let nom: Option<String> = row.get("nom_chauffeur");
                        let telephone: String = row.get("telephone");
                        let distance: Option<f64> = row.get("distance_km");
                        let score: f64 = row.get("relevance_score");

                        let data = serde_json::json!({
                            "titre_service": {"valeur": nom.clone().unwrap_or_else(|| format!("Taxi {}", telephone))},
                            "type": "taxi_ville",
                            "telephone": telephone,
                            "is_available_now": row.get::<bool, _>("is_available_now"),
                            "zone_intervention": row.get::<Option<Vec<String>>, _>("zone_intervention"),
                        });

                        specialized_results.push(SearchResult {
                            service_id,
                            data,
                            total_score: score as f32,
                            fulltext_score: score as f32,
                            trigram_score: 0.0,
                            recency_score: 0.0,
                            category_score: 0.0,
                            search_method: "specialized_taxi".to_string(),
                            matched_fields: vec!["telephone".to_string(), "is_available_now".to_string()],
                            distance_km: distance,
                            gps_coords: None,
                        });
                    }
                }
                crate::services::scheduling_search_service::SearchIntent::SpecializedBloodBank => {
                    // Utiliser la fonction du service scheduling
                    let scheduling_service = SchedulingSearchService::new(self.pool.clone());
                    let (user_lat, user_lng) = if let Some(zone) = gps_zone {
                        if let Some((lat_str, lng_str)) = zone.split_once(',') {
                            (lat_str.parse().ok(), lng_str.parse().ok())
                        } else {
                            (None, None)
                        }
                    } else {
                        (None, None)
                    };

                    let blood_bank_results = scheduling_service
                        .search_banques_sang_with_moment(query, user_lat, user_lng, Some(radius as f64))
                        .await
                        .map_err(|e| format!("Erreur recherche banques de sang: {}", e))?;

                    for r in blood_bank_results {
                        specialized_results.push(SearchResult {
                            service_id: r.service_id,
                            data: r.product_data,
                            total_score: r.relevance_score as f32,
                            fulltext_score: r.relevance_score as f32,
                            trigram_score: 0.0,
                            recency_score: 0.0,
                            category_score: 0.0,
                            search_method: "specialized_blood_bank".to_string(),
                            matched_fields: vec!["nom".to_string(), "stocks_groupes_sanguins".to_string()],
                            distance_km: r.distance_km,
                            gps_coords: None,
                        });
                    }
                }
                _ => {
                    // Ne devrait pas arriver ici
                    log::warn!("[NativeSearch] Intent spécialisé non géré: {:?}", intent);
                }
            }

            // Enrichir tous les résultats spécialisés avec Google Places
            for result in &mut specialized_results {
                if let Err(e) = crate::services::enrich_google_places::enrich_service_with_google_places_data(
                    &self.pool,
                    result.service_id,
                    &mut result.data
                ).await {
                    log::warn!(
                        "[NativeSearch] Erreur enrichissement Google Places pour service {}: {}",
                        result.service_id,
                        e
                    );
                }
            }
            
            // Enrichir les distances avec Google Maps si disponible
            if let Some(gps_zone_val) = gps_zone {
                if let Some((lat_str, lng_str)) = gps_zone_val.split_once(',') {
                    if let (Ok(user_lat), Ok(user_lng)) = (lat_str.parse::<f64>(), lng_str.parse::<f64>()) {
                        SearchResult::enrich_with_google_maps(
                            &mut specialized_results,
                            Some((user_lat, user_lng)),
                            self.geographic_matching.as_ref(),
                        ).await;
                    }
                }
            }

            log_info(&format!(
                "[NativeSearch] ✅ {} résultats spécialisés trouvés avec planification/moment",
                specialized_results.len()
            ));
            
            // ✅ Recherche spécialisée dédiée : retourner directement les résultats (pas de fallback)
            return Ok(specialized_results);
        }
        
        // ✅ RECHERCHE GÉNÉRALE : Avec planification (ex: "pharmacie de garde") mais SANS vérifier existence services spécialisés
        log_info(&format!(
            "[NativeSearch] 🔍 Recherche générale pure (sans vérification services spécialisés)"
        ));
        
        let scheduling_service = SchedulingSearchService::new(self.pool.clone());
        
        // ✅ NETTOYÉ 2025-11-27 : Analyser UNIQUEMENT les intentions de planification (pas de détection de services spécialisés)
        // Utiliser analyze_scheduling_intent_only() pour éviter de détecter SpecializedPharmacy, etc.
        let intent = scheduling_service.analyze_scheduling_intent_only(query);
        
        // Si recherche avec planification, utiliser la fonction spécialisée (dans la recherche générale)
        if intent.should_use_scheduling_search() {
            log_info(&format!(
                "[NativeSearch] Recherche avec planification détectée: {:?}",
                intent
            ));

            // Convertir gps_zone en coordonnées si nécessaire
            let (user_lat, user_lng) = if let Some(zone) = gps_zone {
                // Extraire lat/lng de la zone GPS (format: "lat,lng")
                if let Some((lat_str, lng_str)) = zone.split_once(',') {
                    (lat_str.parse().ok(), lng_str.parse().ok())
                } else {
                    (None, None)
                }
            } else {
                (None, None)
            };

            let scheduling_results = scheduling_service
                .search_with_scheduling(
                    query,
                    None, // Utilise NOW()
                    user_lat,
                    user_lng,
                    search_radius_km.map(|r| r as f64),
                )
                .await
                .map_err(|e| format!("Erreur recherche planifications: {}", e))?;

            // Convertir en SearchResult
            let mut results: Vec<SearchResult> = scheduling_results
                .into_iter()
                .map(|r| SearchResult {
                    service_id: r.service_id,
                    data: r.product_data,
                    total_score: r.relevance_score as f32,
                    fulltext_score: r.relevance_score as f32,
                    trigram_score: 0.0,
                    recency_score: 0.0,
                    category_score: 0.0,
                    search_method: "scheduling_search".to_string(),
                    matched_fields: vec!["planification".to_string(), "disponibilité".to_string()],
                    distance_km: r.distance_km,
                    gps_coords: None, // Sera enrichi si nécessaire
                })
                .collect();

            // ✅ NOUVEAU: Enrichir tous les résultats avec les données Google Places complètes
            for result in &mut results {
                if let Err(e) = crate::services::enrich_google_places::enrich_service_with_google_places_data(
                    &self.pool,
                    result.service_id,
                    &mut result.data
                ).await {
                    log::warn!(
                        "[NativeSearch] Erreur enrichissement Google Places pour service {}: {}",
                        result.service_id,
                        e
                    );
                }
            }
            
            // ✅ Phase 10 - Enrichir les distances avec Google Maps si disponible
            if let Some(gps_zone) = gps_zone {
                if let Some((lat_str, lng_str)) = gps_zone.split_once(',') {
                    if let (Ok(user_lat), Ok(user_lng)) = (lat_str.parse::<f64>(), lng_str.parse::<f64>()) {
                        SearchResult::enrich_with_google_maps(
                            &mut results,
                            Some((user_lat, user_lng)),
                            self.geographic_matching.as_ref(),
                        ).await;
                    }
                }
            }

            log_info(&format!(
                "[NativeSearch] {} résultats avec planifications trouvés",
                results.len()
            ));
            return Ok(results);
        }
        // Utiliser notre fonction PostgreSQL optimisée si GPS est fourni
        if let Some(gps_zone_val) = gps_zone {
            let radius = search_radius_km.unwrap_or(50);

            log_info(&format!("[NativeSearch] Utilisation de search_services_gps_final avec GPS: {} et rayon: {}km", gps_zone_val, radius));

            // Appeler notre fonction PostgreSQL optimisée
            let sql = r#"
                SELECT 
                    service_id,
                    titre_service,
                    category,
                    gps_coords,
                    distance_km,
                    relevance_score,
                    gps_source
                FROM search_services_gps_final($1, $2, $3, $4)
            "#;

            // ✅ CORRECTION 2025-11-26 : Retry avec backoff exponentiel pour les erreurs de connexion
            let mut results = None;
            let mut last_error = None;
            let max_retries = 3;
            
            for attempt in 1..=max_retries {
                match sqlx::query(sql)
                    .bind(query)
                    .bind(gps_zone_val)
                    .bind(radius)
                    .bind(100i32) // ✅ CORRIGÉ: max_results (4ème paramètre requis)
                    .fetch_all(&self.pool)
                    .await
                {
                    Ok(rows) => {
                        results = Some(rows);
                        if attempt > 1 {
                            log_info(&format!(
                                "[NativeSearch] Recherche GPS réussie après {} tentative(s)",
                                attempt
                            ));
                        }
                        break;
                    }
                    Err(e) => {
                        last_error = Some(e);
                        let error_str = last_error.as_ref().unwrap().to_string();
                        
                        // Vérifier si l'erreur est retryable (connexion fermée, timeout, etc.)
                        let is_retryable = error_str.contains("peer closed connection")
                            || error_str.contains("TLS close_notify")
                            || error_str.contains("connection")
                            || error_str.contains("timeout")
                            || error_str.contains("terminating connection");
                        
                        if is_retryable && attempt < max_retries {
                            let delay_ms = 100 * 2_u64.pow(attempt - 1); // Backoff exponentiel: 100ms, 200ms, 400ms
                            log::warn!(
                                "[NativeSearch] Erreur recherche GPS (tentative {}/{}): {}. Retry dans {}ms",
                                attempt,
                                max_retries,
                                error_str,
                                delay_ms
                            );
                            tokio::time::sleep(tokio::time::Duration::from_millis(delay_ms)).await;
                        } else {
                            // Erreur non-retryable ou dernière tentative
                            log_error(&format!(
                                "[NativeSearch] Erreur recherche GPS optimisée (tentative {}/{}): {}",
                                attempt,
                                max_retries,
                                error_str
                            ));
                            if attempt == max_retries {
                                break; // Sortir de la boucle pour utiliser le fallback
                            }
                        }
                    }
                }
            }
            
            let results = results.ok_or_else(|| {
                let error_msg = last_error
                    .as_ref()
                    .map(|e| e.to_string())
                    .unwrap_or_else(|| "Erreur inconnue".to_string());
                log_error(&format!(
                    "[NativeSearch] Échec recherche GPS après {} tentatives: {}",
                    max_retries,
                    error_msg
                ));
                crate::core::types::AppError::Internal(format!(
                    "Erreur recherche GPS optimisée: {}",
                    error_msg
                ))
            })?;

            let mut search_results = Vec::new();
            for row in results {
                let service_id: i32 = row.get("service_id");
                let _titre_service: String = row.get("titre_service");
                let _category: Option<String> = row.get("category");
                let _gps_coords: Option<String> = row.get("gps_coords");
                let _distance_km: Option<f64> = row.get("distance_km");
                let relevance_score: f32 = row.get("relevance_score");
                let _gps_source: Option<String> = row.get("gps_source");

                // Récupérer les données complètes du service
                let mut service_data = sqlx::query("SELECT data FROM services WHERE id = $1")
                    .bind(service_id)
                    .fetch_one(&self.pool)
                    .await
                    .map(|row| row.get::<Value, _>("data"))
                    .unwrap_or_else(|_| serde_json::json!({}));

                // ✅ NOUVEAU: Enrichir avec les données Google Places complètes
                if let Err(e) = crate::services::enrich_google_places::enrich_service_with_google_places_data(
                    &self.pool,
                    service_id,
                    &mut service_data
                ).await {
                    log::warn!(
                        "[NativeSearch] Erreur enrichissement Google Places pour service {}: {}",
                        service_id,
                        e
                    );
                }

                // ✅ Phase 10 - Extraire les coordonnées GPS pour enrichissement Google Maps
                let gps_coords = _gps_coords.as_ref()
                    .and_then(|coords| {
                        coords.split(',')
                            .map(|s| s.trim().parse::<f64>().ok())
                            .collect::<Option<Vec<_>>>()
                            .and_then(|v| if v.len() == 2 { Some((v[0], v[1])) } else { None })
                    });

                search_results.push(SearchResult {
                    service_id,
                    data: service_data,
                    total_score: relevance_score,
                    fulltext_score: 0.0,
                    trigram_score: 0.0,
                    recency_score: 0.0,
                    category_score: 0.0,
                    search_method: "gps_optimized".to_string(),
                    matched_fields: vec!["gps".to_string()],
                    distance_km: _distance_km,
                    gps_coords,
                });

                log_info(&format!(
                    "[NativeSearch] Service {} trouvé à {:.2}km (source: {})",
                    service_id,
                    _distance_km.unwrap_or(0.0),
                    _gps_source.unwrap_or_else(|| "unknown".to_string())
                ));
            }

            log_info(&format!(
                "[NativeSearch] Recherche GPS optimisée: {} résultats trouvés",
                search_results.len()
            ));
            
            // ✅ Phase 10 - Enrichir les distances avec Google Maps si disponible
            if let Some((lat_str, lng_str)) = gps_zone_val.split_once(',') {
                if let (Ok(user_lat), Ok(user_lng)) = (lat_str.parse::<f64>(), lng_str.parse::<f64>()) {
                    SearchResult::enrich_with_google_maps(
                        &mut search_results,
                        Some((user_lat, user_lng)),
                        self.geographic_matching.as_ref(),
                    ).await;
                }
            }
            
            return Ok(search_results);
        }

        // ✅ NETTOYÉ 2025-11-27 : Recherche générale pure (sans fusion avec résultats spécialisés)
        // Fallback vers l'ancienne méthode si pas de GPS
        let partial_conditions = self.create_partial_match_conditions(query);

        let sql = format!(
            r#"
SELECT DISTINCT
                s.id,
                s.data,
                s.created_at,
                s.user_id,
                s.gps,
                s.category,
                (
                    -- ✅ CORRECTION 2025-11-04: RÉDUIRE encore plus priorité SERVICE (total 3.5 au lieu de 7.0)
                    -- Priorité : CHAMPS PRODUIT >>> CHAMPS SERVICE
                    (
                        ts_rank(to_tsvector('french', COALESCE(s.data->'titre_service'->>'valeur', '')), plainto_tsquery('french', $1)) * 1.5 +
                        ts_rank(to_tsvector('french', COALESCE(s.data->'description'->>'valeur', '')), plainto_tsquery('french', $1)) * 1.0 +
                        ts_rank(to_tsvector('french', COALESCE(s.data->'category'->>'valeur', '')), plainto_tsquery('french', $1)) * 1.0
                    ) +
                    -- ✅ CORRECTION 2025-11-01: AUGMENTER priorité PRODUITS (10.0 au lieu de 3.0)
                    -- Les caractéristiques des produits sont maintenant PRIORITAIRES
                    (
                        SELECT COALESCE(SUM(
                            ts_rank(to_tsvector('french', extract_all_product_text(product)), plainto_tsquery('french', $1)) * 10.0
                        ), 0.0)
                        FROM jsonb_array_elements(
                            CASE 
                                WHEN jsonb_typeof(s.data->'produits') = 'array' 
                                THEN s.data->'produits'
                                WHEN jsonb_typeof(s.data->'produits'->'valeur') = 'array'
                                THEN s.data->'produits'->'valeur'
                                ELSE '[]'::jsonb
                            END
                        ) AS product
                    ) +
                    -- Score avec unaccent pour gestion des accents (RÉDUIT SERVICE)
                    (
                        ts_rank(to_tsvector('french', unaccent(COALESCE(s.data->'titre_service'->>'valeur', ''))), plainto_tsquery('french', unaccent($1))) * 2.0 +
                        ts_rank(to_tsvector('french', unaccent(COALESCE(s.data->'description'->>'valeur', ''))), plainto_tsquery('french', unaccent($1))) * 1.0 +
                        ts_rank(to_tsvector('french', unaccent(COALESCE(s.data->'category'->>'valeur', ''))), plainto_tsquery('french', unaccent($1))) * 1.5
                    ) +
                    -- Bonus pour correspondances exactes SERVICE (RÉDUIT car moins pertinent que produit)
                    CASE 
                        WHEN s.data->'titre_service'->>'valeur' ILIKE '%' || $1 || '%' THEN 3.0
                        WHEN s.data->'description'->>'valeur' ILIKE '%' || $1 || '%' THEN 2.0
                        WHEN s.data->'category'->>'valeur' ILIKE '%' || $1 || '%' THEN 2.5
                        ELSE 0.0
                    END +
                    -- ✅ CORRECTION 2025-11-04: BOOST MAJEUR pour champs PRODUIT spécifiques
                    -- nom_produit, categorie_produit, description_produit >>> titre/categorie/description service
                    (
                        SELECT COALESCE(SUM(
                            CASE 
                                -- 🔥 PRIORITÉ MAXIMALE: nom_produit (équivalent titre_service mais pour produit)
                                WHEN product->>'nom' ILIKE '%' || $1 || '%' THEN 15.0
                                -- 🔥 TRÈS IMPORTANT: categorie_produit (plus précis que category service)
                                WHEN product->>'categorie' ILIKE '%' || $1 || '%' THEN 12.0
                                -- 🔥 IMPORTANT: description_produit (détails spécifiques produit)
                                WHEN product->>'description' ILIKE '%' || $1 || '%' THEN 10.0
                                -- ✅ Correspondance dans le texte complet extrait
                                WHEN extract_all_product_text(product) ILIKE '%' || $1 || '%' THEN 6.0
                                WHEN product->>'type' ILIKE '%' || $1 || '%' THEN 5.0
                                WHEN product->>'marque' ILIKE '%' || $1 || '%' THEN 5.0
                                WHEN product->>'modele' ILIKE '%' || $1 || '%' THEN 5.0
                                WHEN product->>'titre' ILIKE '%' || $1 || '%' THEN 5.0
                                -- 🎓 FORMATION & ÉDUCATION: Boost spécifique pour typeFormation (+20%)
                                WHEN product->>'typeFormation' ILIKE '%' || $1 || '%' THEN 6.0
                                -- 📚 Boost pour matières enseignées (+15%)
                                WHEN product->>'matieresEnseignees' ILIKE '%' || $1 || '%' THEN 5.5
                                WHEN product->>'matieres_enseignees' ILIKE '%' || $1 || '%' THEN 5.5
                                -- 📖 Boost pour niveaux scolaires (+15%)
                                WHEN product->>'niveauxScolaires' ILIKE '%' || $1 || '%' THEN 5.5
                                WHEN product->>'niveaux_scolaires' ILIKE '%' || $1 || '%' THEN 5.5
                                -- 🎯 Boost pour concours cibles (+15%)
                                WHEN product->>'concoursCibles' ILIKE '%' || $1 || '%' THEN 5.5
                                WHEN product->>'concours_cibles' ILIKE '%' || $1 || '%' THEN 5.5
                                -- 💻 Boost pour format de formation
                                WHEN product->>'formatFormation' ILIKE '%' || $1 || '%' THEN 4.5
                                WHEN product->>'formats' ILIKE '%' || $1 || '%' THEN 4.5
                                -- 📖 Boost pour anciens sujets
                                WHEN product->>'anciensSujetsDisponibles' ILIKE '%' || $1 || '%' THEN 4.5
                                -- 🏥 CLINIQUE/HÔPITAL: Boost pour prestations médicales
                                WHEN product->'prestationsMedicales' IS NOT NULL AND EXISTS (
                                    SELECT 1 FROM jsonb_array_elements_text(product->'prestationsMedicales') prestation
                                    WHERE prestation ILIKE '%' || $1 || '%'
                                ) THEN 4.5
                                WHEN product->>'typeEtablissement' ILIKE '%' || $1 || '%' THEN 4.0
                                -- 🚚 DÉMÉNAGEMENT: Boost pour type véhicule et services
                                WHEN product->>'typeDemenagement' ILIKE '%' || $1 || '%' THEN 4.0
                                WHEN product->>'typeVehicule' ILIKE '%' || $1 || '%' THEN 3.0
                                WHEN product->>'volumeEstime' ILIKE '%' || $1 || '%' THEN 2.5
                                -- 📍 Localisation
                                WHEN product->>'quartier' ILIKE '%' || $1 || '%' THEN 2.5
                                WHEN product->>'ville' ILIKE '%' || $1 || '%' THEN 2.5
                                ELSE 0.0
                            END
                        ), 0.0)
                        FROM jsonb_array_elements(
                            CASE 
                                WHEN jsonb_typeof(s.data->'produits') = 'array' 
                                THEN s.data->'produits'
                                WHEN jsonb_typeof(s.data->'produits'->'valeur') = 'array'
                                THEN s.data->'produits'->'valeur'
                                ELSE '[]'::jsonb
                            END
                        ) AS product
                    ) +
                    -- ✅ NOUVEAU 2025-11-04: BONUS pour vecteur caractéristiques dans JSON produits
                    -- ⚠️ IMPORTANT: NE PAS scorer location_vector ici (déjà utilisé pour pré-filtre = biais)
                    -- On score UNIQUEMENT characteristic_vector (sans lieu)
                    (
                        CASE 
                            WHEN s.data->'produits'->'characteristic_vector' IS NOT NULL THEN
                                (
                                    -- ✅ Réduction 12.0 → 8.0 pour équilibrer à ~50% caractéristiques / 50% description
                                    SELECT COUNT(*)::REAL * 8.0
                                    FROM jsonb_array_elements_text(s.data->'produits'->'characteristic_vector') AS vec_val
                                    WHERE vec_val ILIKE '%' || $1 || '%'
                                )
                            ELSE 0.0
                        END
                    ) +
                    -- ✅ NOUVEAU 2025-11-04: BOOST pour autocomplete_characteristics (MODE VECTORIEL)
                    -- ⚠️ CORRECTION BIAIS: Recherche UNIQUEMENT dans characteristic_vector (SANS lieu)
                    -- Le lieu est déjà utilisé pour le PRÉ-FILTRE → ne pas le scorer 2 fois
                    -- Score: 8.0-24.0 par produit + boost popularité CLIENT (usage_count)
                    -- Réduction 15.0 → 8.0 pour équilibrer à ~50% caractéristiques / 50% description
                    (
                        SELECT COALESCE(SUM(
                            -- Score de base pour correspondance dans characteristic_vector (SANS lieu)
                            8.0 *
                            -- Recherche dans le vecteur caractéristiques UNIQUEMENT (produit, pas lieu)
                            (
                                SELECT COUNT(*)::REAL FROM unnest(ac.characteristic_vector) AS vec_val
                                WHERE vec_val ILIKE '%' || $1 || '%'
                            ) *
                            -- BOOST selon popularité CLIENT (usage_count)
                            -- 1 fois = 1.0x, 5 fois = 1.5x, 10 fois = 2.0x, 20+ fois = 3.0x
                            LEAST(3.0, 1.0 + (ac.usage_count::REAL / 10.0))
                        ), 0.0)
                        FROM autocomplete_characteristics ac
                        WHERE ac.service_id = s.id
                        AND ac.identifiant_base LIKE 'produit%'
                        AND ac.is_real_product = TRUE  -- Seulement les VRAIS produits prestataires
                        -- Recherche dans characteristic_vector UNIQUEMENT (pas lieu)
                        AND EXISTS (
                            SELECT 1 FROM unnest(ac.characteristic_vector) AS vec_val
                            WHERE vec_val ILIKE '%' || $1 || '%'
                        )
                    ) +
                    -- 🔥 NOUVEAU 2025-11-04: Bonus unaccent pour champs PRODUIT (PRIORITAIRE)
                    (
                        SELECT COALESCE(SUM(
                            CASE 
                                WHEN unaccent(COALESCE(product->>'nom', '')) ILIKE '%' || unaccent($1) || '%' THEN 12.0
                                WHEN unaccent(COALESCE(product->>'categorie', '')) ILIKE '%' || unaccent($1) || '%' THEN 10.0
                                WHEN unaccent(COALESCE(product->>'description', '')) ILIKE '%' || unaccent($1) || '%' THEN 8.0
                                ELSE 0.0
                            END
                        ), 0.0)
                        FROM jsonb_array_elements(
                            CASE 
                                WHEN jsonb_typeof(s.data->'produits') = 'array' 
                                THEN s.data->'produits'
                                WHEN jsonb_typeof(s.data->'produits'->'valeur') = 'array'
                                THEN s.data->'produits'->'valeur'
                                ELSE '[]'::jsonb
                            END
                        ) AS product
                    ) +
                    -- Bonus pour correspondances sans accents SERVICE (RÉDUIT)
                    CASE 
                        WHEN unaccent(s.data->'titre_service'->>'valeur') ILIKE '%' || unaccent($1) || '%' THEN 2.5
                        WHEN unaccent(s.data->'description'->>'valeur') ILIKE '%' || unaccent($1) || '%' THEN 1.5
                        WHEN unaccent(s.data->'category'->>'valeur') ILIKE '%' || unaccent($1) || '%' THEN 2.0
                    END +
                    -- Bonus pour correspondances partielles intelligentes
                    CASE 
                        WHEN ({}) THEN 2.0
                        ELSE 0.0
                    END +
                    -- 🔥 NOUVEAU 2025-11-04: Bonus mots individuels pour PRODUIT (PRIORITAIRE)
                    (
                        SELECT COALESCE(SUM(
                            CASE 
                                WHEN product->>'nom' ILIKE '%' || word || '%' THEN 8.0
                                WHEN product->>'categorie' ILIKE '%' || word || '%' THEN 6.0
                                WHEN product->>'description' ILIKE '%' || word || '%' THEN 5.0
                                ELSE 0.0
                            END
                        ), 0.0)
                        FROM jsonb_array_elements(
                            CASE 
                                WHEN jsonb_typeof(s.data->'produits') = 'array' 
                                THEN s.data->'produits'
                                WHEN jsonb_typeof(s.data->'produits'->'valeur') = 'array'
                                THEN s.data->'produits'->'valeur'
                                ELSE '[]'::jsonb
                            END
                        ) AS product,
                        unnest(string_to_array($1, ' ')) AS word
                    ) +
                    -- Bonus pour correspondance de mots individuels SERVICE (RÉDUIT)
                    (
                        SELECT COALESCE(SUM(
                            CASE 
                                WHEN s.data->'titre_service'->>'valeur' ILIKE '%' || word || '%' THEN 2.0
                                WHEN s.data->'description'->>'valeur' ILIKE '%' || word || '%' THEN 1.0
                                WHEN s.data->'category'->>'valeur' ILIKE '%' || word || '%' THEN 1.5
                                ELSE 0.0
                            END
                        ), 0.0)
                        FROM unnest(string_to_array($1, ' ')) AS word
                    ) +
                    -- Bonus pour correspondances multiples (titre + description)
                    CASE 
                        WHEN s.data->'titre_service'->>'valeur' ILIKE '%' || $1 || '%' 
                             AND s.data->'description'->>'valeur' ILIKE '%' || $1 || '%'
                        THEN 3.0
                        WHEN s.data->'titre_service'->>'valeur' ILIKE '%' || $1 || '%' 
                             AND s.data->'category'->>'valeur' ILIKE '%' || $1 || '%'
                        THEN 2.0
                        ELSE 0.0
                    END +
                    -- Bonus pour correspondances dans plusieurs champs (pertinence élevée)
                    CASE 
                        WHEN s.data->'titre_service'->>'valeur' ILIKE '%' || $1 || '%' 
                             AND s.data->'description'->>'valeur' ILIKE '%' || $1 || '%'
                             AND s.data->'category'->>'valeur' ILIKE '%' || $1 || '%'
                        THEN 5.0
                        ELSE 0.0
                    END +
                    -- Pénalité pour correspondances uniquement dans la description (moins pertinent)
                    CASE 
                        WHEN s.data->'titre_service'->>'valeur' NOT ILIKE '%' || $1 || '%' 
                             AND s.data->'description'->>'valeur' ILIKE '%' || $1 || '%'
                             AND s.data->'category'->>'valeur' NOT ILIKE '%' || $1 || '%'
                        THEN -1.0
                        ELSE 0.0
                    END +
                    -- Logique de scoring simplifiée et efficace
                    CASE 
                        -- Bonus pour correspondance exacte dans le titre (le plus important)
                        WHEN s.data->'titre_service'->>'valeur' ILIKE '%' || $1 || '%'
                        THEN 2.0
                        ELSE 0.0
                    END
                )::REAL as fulltext_score
            FROM services s
            WHERE s.is_active = true
            AND ({})
            AND ($2::text IS NULL OR s.category = $2 OR s.data->'category'->>'valeur' = $2)
            AND (
                $3::text IS NULL  -- Pas de filtre lieu → TOUTE la base
                OR (
                    -- ✅ NOUVEAU 2025-11-04 : PRÉ-FILTRE LIEU BIDIRECTIONNEL INTELLIGENT
                    -- Vérifie si location_vector et input_words ont AU MOINS UN élément commun
                    s.gps ILIKE '%' || $3 || '%'  -- GPS du service (gps_fixe/gps_courant)
                    OR EXISTS (
                        SELECT 1 FROM autocomplete_characteristics ac
                        WHERE ac.service_id = s.id
                        AND ac.is_real_product = TRUE
                        AND (
                            -- ✅ OPTIMISÉ : Opérateur && (overlap) pour test d'intersection
                            -- Convertir location_vector en lowercase pour comparaison case-insensitive
                            (
                                SELECT array_agg(LOWER(elem))::TEXT[]
                                FROM unnest(ac.location_vector) AS elem
                            ) && string_to_array(LOWER($3), ' ')
                            -- ✅ OU fuzzy match pour gestion fautes de frappe (si && échoue)
                            OR EXISTS (
                                SELECT 1 FROM unnest(ac.location_vector) AS loc_val,
                                             unnest(string_to_array(LOWER($3), ' ')) AS input_word
                                WHERE similarity(LOWER(loc_val), input_word) > 0.6
                            )
                        )
                    )
                )
            )
            ORDER BY fulltext_score DESC
        "#,
            partial_conditions, partial_conditions
        );

        let results = sqlx::query(&sql)
            .bind(query)
            .bind(category_filter)
            .bind(location_filter)
            .fetch_all(&self.pool)
            .await
            .map_err(|e| {
                log_error(&format!("[NativeSearch] Erreur recherche full-text: {}", e));
                crate::core::types::AppError::Internal(format!("Erreur recherche full-text: {}", e))
            })?;

        let mut search_results = Vec::new();
        for row in results {
            let service_id: i32 = row.get("id");
            let data: Value = row.get("data");
            let _created_at: chrono::DateTime<chrono::Utc> = row.get("created_at");
            let _user_id: i32 = row.get("user_id");
            let _gps: Option<String> = row.get("gps");
            let _category: Option<String> = row.get("category");
            // Gérer le cas où fulltext_score peut être NULL
            let fulltext_score: f32 = row.try_get("fulltext_score").unwrap_or(0.0);
            
            search_results.push(SearchResult {
                service_id,
                data,
                total_score: fulltext_score,
                fulltext_score,
                trigram_score: 0.0,
                recency_score: 0.0,
                category_score: 0.0,
                search_method: "fulltext".to_string(),
                matched_fields: vec!["fulltext".to_string()],
                distance_km: None,
                gps_coords: None,
            });
        }

        // ✅ NETTOYÉ 2025-11-27 : Recherche générale pure (pas de fusion avec résultats spécialisés)
        
        // Trier par score total
        search_results.sort_by(|a, b| {
            b.total_score
                .partial_cmp(&a.total_score)
                .unwrap_or(std::cmp::Ordering::Equal)
        });
        
        Ok(search_results)
    }

    /// Recherche trigram pour fallback et fautes de frappe
    #[allow(dead_code)]
    async fn trigram_search(
        &self,
        query: &str,
        category_filter: Option<&str>,
        location_filter: Option<&str>,
    ) -> AppResult<Vec<SearchResult>> {
        // Appeler la nouvelle méthode avec GPS désactivé
        self.trigram_search_with_gps(query, category_filter, location_filter, None, None)
            .await
    }

    /// Recherche trigram avec filtrage GPS
    async fn trigram_search_with_gps(
        &self,
        query: &str,
        category_filter: Option<&str>,
        location_filter: Option<&str>,
        gps_zone: Option<&str>,
        search_radius_km: Option<i32>,
    ) -> AppResult<Vec<SearchResult>> {
        // Utiliser notre fonction PostgreSQL optimisée si GPS est fourni
        if let Some(gps_zone_val) = gps_zone {
            let radius = search_radius_km.unwrap_or(50);

            log_info(&format!(
                "[NativeSearch] Trigram avec GPS optimisé: {} et rayon: {}km",
                gps_zone_val, radius
            ));

            // Appeler notre fonction PostgreSQL optimisée
            let sql = r#"
                SELECT 
                    service_id,
                    titre_service,
                    category,
                    gps_coords,
                    distance_km,
                    relevance_score,
                    gps_source
                FROM search_services_gps_final($1, $2, $3, $4)
            "#;

            let results = sqlx::query(sql)
                .bind(query)
                .bind(gps_zone_val)
                .bind(radius)
                .bind(100i32) // ✅ CORRIGÉ: max_results (4ème paramètre requis)
                .fetch_all(&self.pool)
                .await
                .map_err(|e| {
                    log_error(&format!(
                        "[NativeSearch] Erreur trigram GPS optimisé: {}",
                        e
                    ));
                    crate::core::types::AppError::Internal(format!(
                        "Erreur trigram GPS optimisé: {}",
                        e
                    ))
                })?;

            let mut search_results = Vec::new();
            for row in results {
                let service_id: i32 = row.get("service_id");
                let _titre_service: String = row.get("titre_service");
                let _category: Option<String> = row.get("category");
                let _gps_coords: Option<String> = row.get("gps_coords");
                let _distance_km: Option<f64> = row.get("distance_km");
                let relevance_score: f32 = row.get("relevance_score");
                let _gps_source: Option<String> = row.get("gps_source");

                // Récupérer les données complètes du service
                let mut service_data = sqlx::query("SELECT data FROM services WHERE id = $1")
                    .bind(service_id)
                    .fetch_one(&self.pool)
                    .await
                    .map(|row| row.get::<Value, _>("data"))
                    .unwrap_or_else(|_| serde_json::json!({}));

                // ✅ NOUVEAU: Enrichir avec les données Google Places complètes
                if let Err(e) = crate::services::enrich_google_places::enrich_service_with_google_places_data(
                    &self.pool,
                    service_id,
                    &mut service_data
                ).await {
                    log::warn!(
                        "[NativeSearch] Erreur enrichissement Google Places pour service {}: {}",
                        service_id,
                        e
                    );
                }

                // ✅ Phase 10 - Extraire les coordonnées GPS
                let gps_coords = _gps_coords.as_ref()
                    .and_then(|coords| {
                        coords.split(',')
                            .map(|s| s.trim().parse::<f64>().ok())
                            .collect::<Option<Vec<_>>>()
                            .and_then(|v| if v.len() == 2 { Some((v[0], v[1])) } else { None })
                    });

                search_results.push(SearchResult {
                    service_id,
                    data: service_data,
                    total_score: relevance_score,
                    fulltext_score: 0.0,
                    trigram_score: relevance_score,
                    recency_score: 0.0,
                    category_score: 0.0,
                    search_method: "trigram_gps_optimized".to_string(),
                    matched_fields: vec!["trigram".to_string(), "gps".to_string()],
                    distance_km: _distance_km,
                    gps_coords,
                });
            }

            // ✅ Phase 10 - Enrichir les distances avec Google Maps si disponible
            if let Some((lat_str, lng_str)) = gps_zone_val.split_once(',') {
                if let (Ok(user_lat), Ok(user_lng)) = (lat_str.parse::<f64>(), lng_str.parse::<f64>()) {
                    SearchResult::enrich_with_google_maps(
                        &mut search_results,
                        Some((user_lat, user_lng)),
                        self.geographic_matching.as_ref(),
                    ).await;
                }
            }

            return Ok(search_results);
        }

        // Fallback vers l'ancienne méthode si pas de GPS
        let sql = r#"
            SELECT DISTINCT
                s.id,
                s.data,
                s.created_at,
                s.user_id,
                s.gps,
                s.category,
                GREATEST(
                    similarity(COALESCE(s.data->'titre_service'->>'valeur', ''), $1),
                    similarity(COALESCE(s.data->'description'->>'valeur', ''), $1),
                    similarity(COALESCE(s.data->'category'->>'valeur', ''), $1)
                )::REAL as trigram_score
            FROM services s
            WHERE s.is_active = true
            AND (
                similarity(COALESCE(s.data->'titre_service'->>'valeur', ''), $1) > 0.1
                OR similarity(COALESCE(s.data->'description'->>'valeur', ''), $1) > 0.1
                OR similarity(COALESCE(s.data->'category'->>'valeur', ''), $1) > 0.1
            )
            AND ($2::text IS NULL OR s.category = $2 OR s.data->'category'->>'valeur' = $2)
            AND (
                $3::text IS NULL
                OR (
                    s.gps ILIKE '%' || $3 || '%'
                    OR EXISTS (
                        SELECT 1 FROM autocomplete_characteristics ac
                        WHERE ac.service_id = s.id
                        AND ac.is_real_product = TRUE
                        AND (
                            -- ✅ OPTIMISÉ : Opérateur && (overlap)
                            -- Convertir location_vector en lowercase pour comparaison case-insensitive
                            (
                                SELECT array_agg(LOWER(elem))::TEXT[]
                                FROM unnest(ac.location_vector) AS elem
                            ) && string_to_array(LOWER($3), ' ')
                            -- ✅ OU fuzzy match (si && échoue)
                            OR EXISTS (
                                SELECT 1 FROM unnest(ac.location_vector) AS loc_val,
                                             unnest(string_to_array(LOWER($3), ' ')) AS input_word
                                WHERE similarity(LOWER(loc_val), input_word) > 0.6
                            )
                        )
                    )
                )
            )
            ORDER BY trigram_score DESC
        "#;

        let results = sqlx::query(sql)
            .bind(query)
            .bind(category_filter)
            .bind(location_filter)
            .fetch_all(&self.pool)
            .await
            .map_err(|e| {
                log_error(&format!("[NativeSearch] Erreur recherche trigram: {}", e));
                crate::core::types::AppError::Internal(format!("Erreur recherche trigram: {}", e))
            })?;

        let mut search_results = Vec::new();
        for row in results {
            let service_id: i32 = row.get("id");
            let data: Value = row.get("data");
            let _created_at: chrono::DateTime<chrono::Utc> = row.get("created_at");
            let _user_id: i32 = row.get("user_id");
            let _gps: Option<String> = row.get("gps");
            let _category: Option<String> = row.get("category");
            // Gérer le cas où trigram_score peut être NULL
            let trigram_score: f32 = row.try_get("trigram_score").unwrap_or(0.0);

            search_results.push(SearchResult {
                service_id,
                data,
                total_score: trigram_score,
                fulltext_score: 0.0,
                trigram_score,
                recency_score: 0.0,
                category_score: 0.0,
                search_method: "trigram".to_string(),
                matched_fields: vec!["trigram".to_string()],
                distance_km: None,
                gps_coords: None,
            });
        }

        Ok(search_results)
    }

    /// Recherche par mots clés individuels pour fallback
    #[allow(dead_code)]
    async fn keyword_search(
        &self,
        query: &str,
        category_filter: Option<&str>,
        location_filter: Option<&str>,
    ) -> AppResult<Vec<SearchResult>> {
        // Appeler la nouvelle méthode avec GPS désactivé
        self.keyword_search_with_gps(query, category_filter, location_filter, None, None)
            .await
    }

    /// Recherche par mots clés individuels avec filtrage GPS
    async fn keyword_search_with_gps(
        &self,
        query: &str,
        category_filter: Option<&str>,
        location_filter: Option<&str>,
        gps_zone: Option<&str>,
        search_radius_km: Option<i32>,
    ) -> AppResult<Vec<SearchResult>> {
        // Utiliser notre fonction PostgreSQL optimisée si GPS est fourni
        if let Some(gps_zone_val) = gps_zone {
            let radius = search_radius_km.unwrap_or(50);

            log_info(&format!(
                "[NativeSearch] Mots-clés avec GPS optimisé: {} et rayon: {}km",
                gps_zone_val, radius
            ));

            // Appeler notre fonction PostgreSQL optimisée
            let sql = r#"
                SELECT 
                    service_id,
                    titre_service,
                    category,
                    gps_coords,
                    distance_km,
                    relevance_score,
                    gps_source
                FROM search_services_gps_final($1, $2, $3, $4)
            "#;

            let results = sqlx::query(sql)
                .bind(query)
                .bind(gps_zone_val)
                .bind(radius)
                .bind(100i32) // ✅ CORRIGÉ: max_results (4ème paramètre requis)
                .fetch_all(&self.pool)
                .await
                .map_err(|e| {
                    log_error(&format!(
                        "[NativeSearch] Erreur mots-clés GPS optimisé: {}",
                        e
                    ));
                    crate::core::types::AppError::Internal(format!(
                        "Erreur mots-clés GPS optimisé: {}",
                        e
                    ))
                })?;

            let mut search_results = Vec::new();
            for row in results {
                let service_id: i32 = row.get("service_id");
                let _titre_service: String = row.get("titre_service");
                let _category: Option<String> = row.get("category");
                let _gps_coords: Option<String> = row.get("gps_coords");
                let _distance_km: Option<f64> = row.get("distance_km");
                let relevance_score: f32 = row.get("relevance_score");
                let _gps_source: Option<String> = row.get("gps_source");

                // Récupérer les données complètes du service
                let mut service_data = sqlx::query("SELECT data FROM services WHERE id = $1")
                    .bind(service_id)
                    .fetch_one(&self.pool)
                    .await
                    .map(|row| row.get::<Value, _>("data"))
                    .unwrap_or_else(|_| serde_json::json!({}));

                // ✅ NOUVEAU: Enrichir avec les données Google Places complètes
                if let Err(e) = crate::services::enrich_google_places::enrich_service_with_google_places_data(
                    &self.pool,
                    service_id,
                    &mut service_data
                ).await {
                    log::warn!(
                        "[NativeSearch] Erreur enrichissement Google Places pour service {}: {}",
                        service_id,
                        e
                    );
                }

                // ✅ Phase 10 - Extraire les coordonnées GPS pour enrichissement Google Maps
                let gps_coords = _gps_coords.as_ref()
                    .and_then(|coords| {
                        coords.split(',')
                            .map(|s| s.trim().parse::<f64>().ok())
                            .collect::<Option<Vec<_>>>()
                            .and_then(|v| if v.len() == 2 { Some((v[0], v[1])) } else { None })
                    });

                search_results.push(SearchResult {
                    service_id,
                    data: service_data,
                    total_score: relevance_score,
                    fulltext_score: 0.0,
                    trigram_score: 0.0,
                    recency_score: 0.0,
                    category_score: relevance_score,
                    search_method: "keywords_gps_optimized".to_string(),
                    matched_fields: vec!["keywords".to_string(), "gps".to_string()],
                    distance_km: _distance_km,
                    gps_coords,
                });
            }

            // ✅ Phase 10 - Enrichir les distances avec Google Maps si disponible
            if let Some((lat_str, lng_str)) = gps_zone_val.split_once(',') {
                if let (Ok(user_lat), Ok(user_lng)) = (lat_str.parse::<f64>(), lng_str.parse::<f64>()) {
                    SearchResult::enrich_with_google_maps(
                        &mut search_results,
                        Some((user_lat, user_lng)),
                        self.geographic_matching.as_ref(),
                    ).await;
                }
            }

            return Ok(search_results);
        }

        // Fallback vers l'ancienne méthode si pas de GPS
        let words: Vec<&str> = query.split_whitespace().collect();
        if words.is_empty() {
            return Ok(Vec::new());
        }

        // Créer une requête qui matche au moins un mot clé
        let mut conditions = Vec::new();
        for word in words {
            conditions.push(format!(
                "s.data->'titre_service'->>'valeur' ILIKE '%{}%' OR s.data->'description'->>'valeur' ILIKE '%{}%' OR s.data->'category'->>'valeur' ILIKE '%{}%'",
                word, word, word
            ));

            // Ajouter variantes sans accents
            let without_accents = word
                .chars()
                .map(|c| match c {
                    'à' | 'â' | 'ä' => 'a',
                    'é' | 'è' | 'ê' | 'ë' => 'e',
                    'î' | 'ï' => 'i',
                    'ô' | 'ö' => 'o',
                    'ù' | 'û' | 'ü' => 'u',
                    'ÿ' => 'y',
                    'ç' => 'c',
                    _ => c,
                })
                .collect::<String>();

            if without_accents != word {
                conditions.push(format!(
                    "s.data->'titre_service'->>'valeur' ILIKE '%{}%' OR s.data->'description'->>'valeur' ILIKE '%{}%' OR s.data->'category'->>'valeur' ILIKE '%{}%'",
                    without_accents, without_accents, without_accents
                ));
            }
        }

        let sql = format!(
            r#"
            SELECT 
                s.id,
                s.data,
                s.created_at,
                s.user_id,
                s.gps,
                s.category,
                (
                    -- Score basé sur le nombre de mots clés trouvés
                    (
                        SELECT COALESCE(SUM(
                            CASE 
                                WHEN s.data->'titre_service'->>'valeur' ILIKE '%' || word || '%' THEN 3.0
                                WHEN s.data->'description'->>'valeur' ILIKE '%' || word || '%' THEN 2.0
                                WHEN s.data->'category'->>'valeur' ILIKE '%' || word || '%' THEN 2.5
                                ELSE 0.0
                            END
                        ), 0.0)
                        FROM unnest(string_to_array($1, ' ')) AS word
                    ) * 0.5
                )::REAL as keyword_score
            FROM services s
            WHERE s.is_active = true
            AND ({})
            AND ($2::text IS NULL OR s.category = $2 OR s.data->'category'->>'valeur' = $2)
            AND (
                $3::text IS NULL
                OR (
                    s.gps ILIKE '%' || $3 || '%'
                    OR EXISTS (
                        SELECT 1 FROM autocomplete_characteristics ac
                        WHERE ac.service_id = s.id
                        AND ac.is_real_product = TRUE
                        AND (
                            -- ✅ OPTIMISÉ : Opérateur && (overlap)
                            -- Convertir location_vector en lowercase pour comparaison case-insensitive
                            (
                                SELECT array_agg(LOWER(elem))::TEXT[]
                                FROM unnest(ac.location_vector) AS elem
                            ) && string_to_array(LOWER($3), ' ')
                            -- ✅ OU fuzzy match (si && échoue)
                            OR EXISTS (
                                SELECT 1 FROM unnest(ac.location_vector) AS loc_val,
                                             unnest(string_to_array(LOWER($3), ' ')) AS input_word
                                WHERE similarity(LOWER(loc_val), input_word) > 0.6
                            )
                        )
                    )
                )
            )
            ORDER BY keyword_score DESC
        "#,
            conditions.join(" OR ")
        );

        let results = sqlx::query(&sql)
            .bind(query)
            .bind(category_filter)
            .bind(location_filter)
            .fetch_all(&self.pool)
            .await
            .map_err(|e| {
                log_error(&format!(
                    "[NativeSearch] Erreur recherche par mots clés: {}",
                    e
                ));
                crate::core::types::AppError::Internal(format!(
                    "Erreur recherche par mots clés: {}",
                    e
                ))
            })?;

        let mut search_results = Vec::new();
        for row in results {
            let service_id: i32 = row.get("id");
            let data: Value = row.get("data");
            let _created_at: chrono::DateTime<chrono::Utc> = row.get("created_at");
            let _user_id: i32 = row.get("user_id");
            let _gps: Option<String> = row.get("gps");
            let _category: Option<String> = row.get("category");
            // Gérer le cas où keyword_score peut être NULL
            let keyword_score: f32 = row.try_get("keyword_score").unwrap_or(0.0);

            search_results.push(SearchResult {
                service_id,
                data,
                total_score: keyword_score,
                fulltext_score: 0.0,
                trigram_score: 0.0,
                recency_score: 0.0,
                category_score: keyword_score,
                search_method: "keywords".to_string(),
                matched_fields: vec!["keywords".to_string()],
                distance_km: None,
                gps_coords: None,
            });
        }

        Ok(search_results)
    }

    /// Calcul du score de récence
    fn calculate_recency_score(&self, created_at: chrono::DateTime<chrono::Utc>) -> f32 {
        let now = chrono::Utc::now();
        let days_old = now.signed_duration_since(created_at).num_days();

        if days_old <= self.config.recency_days {
            self.config.recency_boost
        } else {
            0.0
        }
    }

    /// Normalisation avancée avec gestion des accents et variantes
    fn normalize_query_advanced(&self, query: &str) -> String {
        // Normalisation de base
        let normalized = query
            .to_lowercase()
            .trim()
            .replace(|c: char| !c.is_alphanumeric() && c != ' ', " ");

        // Créer des variantes avec et sans accents
        let words: Vec<String> = normalized
            .split_whitespace()
            .flat_map(|word| self.create_word_variants(word))
            .collect();

        words.join(" ")
    }

    /// Créer des variantes de mots avec et sans accents
    fn create_word_variants(&self, word: &str) -> Vec<String> {
        let mut variants = vec![word.to_string()];

        // Variantes sans accents
        let without_accents = word
            .chars()
            .map(|c| match c {
                'à' | 'â' | 'ä' => 'a',
                'é' | 'è' | 'ê' | 'ë' => 'e',
                'î' | 'ï' => 'i',
                'ô' | 'ö' => 'o',
                'ù' | 'û' | 'ü' => 'u',
                'ÿ' => 'y',
                'ç' => 'c',
                _ => c,
            })
            .collect::<String>();

        if without_accents != word {
            variants.push(without_accents);
        }

        // Variantes avec accents (pour les mots sans accents)
        if !word.chars().any(|c| "àâäéèêëîïôöùûüÿç".contains(c)) {
            let with_accents = word
                .replace("a", "aàâä")
                .replace("e", "eéèêë")
                .replace("i", "iîï")
                .replace("o", "oôö")
                .replace("u", "uùûü")
                .replace("y", "yÿ")
                .replace("c", "cç");

            // Ajouter seulement si le mot original n'a pas d'accents
            if with_accents != word {
                variants.push(with_accents);
            }
        }

        variants
    }

    /// Créer une requête SQL avec correspondances partielles intelligentes
    fn create_partial_match_conditions(&self, query: &str) -> String {
        let words: Vec<&str> = query.split_whitespace().collect();
        let mut conditions = Vec::new();

        for word in words {
            // Correspondances exactes
            conditions.push(format!(
                "s.data->'titre_service'->>'valeur' ILIKE '%{}%' OR s.data->'description'->>'valeur' ILIKE '%{}%' OR s.data->'category'->>'valeur' ILIKE '%{}%'",
                word, word, word
            ));

            // Correspondances sans accents (uniquement si le mot a des accents)
            let without_accents = word
                .chars()
                .map(|c| match c {
                    'à' | 'â' | 'ä' => 'a',
                    'é' | 'è' | 'ê' | 'ë' => 'e',
                    'î' | 'ï' => 'i',
                    'ô' | 'ö' => 'o',
                    'ù' | 'û' | 'ü' => 'u',
                    'ÿ' => 'y',
                    'ç' => 'c',
                    _ => c,
                })
                .collect::<String>();

            if without_accents != word {
                conditions.push(format!(
                    "unaccent(s.data->'titre_service'->>'valeur') ILIKE '%{}%' OR unaccent(s.data->'description'->>'valeur') ILIKE '%{}%' OR unaccent(s.data->'category'->>'valeur') ILIKE '%{}%'",
                    without_accents, without_accents, without_accents
                ));
            }

            // Correspondances bidirectionnelles : mot sans accents dans base avec accents
            conditions.push(format!(
                "unaccent(s.data->'titre_service'->>'valeur') ILIKE '%{}%' OR unaccent(s.data->'description'->>'valeur') ILIKE '%{}%' OR unaccent(s.data->'category'->>'valeur') ILIKE '%{}%'",
                word, word, word
            ));

            // Correspondances partielles pour mots longs (ex: "gestionnaire" -> "gestion")
            let chars: Vec<char> = word.chars().collect();
            if chars.len() > 4 {
                // Prendre seulement les 4 premiers caractères pour éviter trop de correspondances
                let substring: String = chars[..4].iter().collect();
                conditions.push(format!(
                    "s.data->'titre_service'->>'valeur' ILIKE '%{}%' OR s.data->'description'->>'valeur' ILIKE '%{}%' OR s.data->'category'->>'valeur' ILIKE '%{}%'",
                    substring, substring, substring
                ));
            }
        }

        conditions.join(" OR ")
    }

    /// Recherche par catégorie spécifique
    pub async fn search_by_category(&self, category: &str) -> AppResult<Vec<SearchResult>> {
        let sql = r#"
                   SELECT 
                       s.id,
                       s.data,
                       s.created_at,
                       s.user_id,
                       s.gps,
                       s.category
                   FROM services s
                   WHERE s.is_active = true
                   AND (
                       s.category = $1 
                       OR s.data->'category'->>'valeur' = $1
                   )
                   ORDER BY s.created_at DESC
               "#;

        let results = sqlx::query(sql)
            .bind(category)
            .fetch_all(&self.pool)
            .await
            .map_err(|e| {
                log_error(&format!(
                    "[NativeSearch] Erreur recherche par catégorie: {}",
                    e
                ));
                crate::core::types::AppError::Internal(format!(
                    "Erreur recherche par catégorie: {}",
                    e
                ))
            })?;

        let mut search_results = Vec::new();
        for row in results {
            let service_id: i32 = row.get("id");
            let data: Value = row.get("data");
            let created_at: chrono::DateTime<chrono::Utc> = row.get("created_at");
            let _user_id: i32 = row.get("user_id");
            let _gps: Option<String> = row.get("gps");
            let _category: Option<String> = row.get("category");

            let recency_score = self.calculate_recency_score(created_at);

            search_results.push(SearchResult {
                service_id,
                data,
                total_score: 1.0 + recency_score,
                fulltext_score: 0.0,
                trigram_score: 0.0,
                recency_score,
                category_score: 1.0,
                search_method: "category".to_string(),
                matched_fields: vec!["category".to_string()],
                distance_km: None,
                gps_coords: None,
            });
        }

        Ok(search_results)
    }

    /// Recherche géospatiale intelligente avec calcul de distance
    pub async fn search_by_location(
        &self,
        location: &str,
        user_lat: Option<f64>,
        user_lng: Option<f64>,
    ) -> AppResult<Vec<SearchResult>> {
        let sql = if let (Some(_lat), Some(_lng)) = (user_lat, user_lng) {
            // Recherche avec calcul de distance géographique
            r#"
                SELECT 
                    s.id,
                    s.data,
                    s.created_at,
                    s.user_id,
                    s.gps,
                    s.category,
                    CASE 
                        WHEN s.data->>'gps_fixe' IS NOT NULL AND s.data->>'gps_fixe' != '' THEN
                            -- Utilise gps_fixe si disponible
                            similarity(s.data->>'gps_fixe', $1) * 2.0 +
                            CASE 
                                WHEN s.data->>'gps_fixe' ~ '^-?\d+\.\d+,-?\d+\.\d+$' THEN
                                    -- Calcul de distance si coordonnées valides
                                    GREATEST(0, 10 - (
                                        SQRT(
                                            POW(CAST(SPLIT_PART(s.data->>'gps_fixe', ',', 1) AS DECIMAL) - $2, 2) +
                                            POW(CAST(SPLIT_PART(s.data->>'gps_fixe', ',', 2) AS DECIMAL) - $3, 2)
                                        ) * 111000
                                    ))
                                ELSE 0
                            END
                        ELSE
                            -- Utilise la localisation du prestataire (gps)
                            similarity(s.gps, $1) * 1.5 +
                            CASE 
                                WHEN s.gps ~ '^-?\d+\.\d+,-?\d+\.\d+$' THEN
                                    -- Calcul de distance si coordonnées valides
                                    GREATEST(0, 10 - (
                                        SQRT(
                                            POW(CAST(SPLIT_PART(s.gps, ',', 1) AS DECIMAL) - $2, 2) +
                                            POW(CAST(SPLIT_PART(s.gps, ',', 2) AS DECIMAL) - $3, 2)
                                        ) * 111000
                                    ))
                                ELSE 0
                            END
                    END::REAL as location_score
                FROM services s
                WHERE s.is_active = true
                AND (
                    (s.data->>'gps_fixe' IS NOT NULL AND s.data->>'gps_fixe' != '') OR
                    (s.gps IS NOT NULL AND s.gps != '')
                )
                AND (
                    s.data->>'gps_fixe' % $1 OR s.gps % $1 OR
                    s.data->>'gps_fixe' ILIKE '%' || $1 || '%' OR s.gps ILIKE '%' || $1 || '%'
                )
                ORDER BY location_score DESC, s.created_at DESC
                LIMIT $4
            "#
        } else {
            // Recherche simple sans coordonnées
            r#"
                SELECT 
                    s.id,
                    s.data,
                    s.created_at,
                    s.user_id,
                    s.gps,
                    s.category,
                    GREATEST(
                        similarity(COALESCE(s.data->>'gps_fixe', ''), $1),
                        similarity(COALESCE(s.gps, ''), $1)
                    )::REAL as location_score
                FROM services s
                WHERE s.is_active = true
                AND (
                    (s.data->>'gps_fixe' IS NOT NULL AND s.data->>'gps_fixe' != '') OR
                    (s.gps IS NOT NULL AND s.gps != '')
                )
                AND (
                    s.data->>'gps_fixe' % $1 OR s.gps % $1 OR
                    s.data->>'gps_fixe' ILIKE '%' || $1 || '%' OR s.gps ILIKE '%' || $1 || '%'
                )
                ORDER BY location_score DESC, s.created_at DESC
            "#
        };

        let results = if let (Some(lat), Some(lng)) = (user_lat, user_lng) {
            sqlx::query(sql)
                .bind(location)
                .bind(lat)
                .bind(lng)
                .fetch_all(&self.pool)
                .await
        } else {
            sqlx::query(sql).bind(location).fetch_all(&self.pool).await
        }
        .map_err(|e| {
            log_error(&format!(
                "[NativeSearch] Erreur recherche géospatiale: {}",
                e
            ));
            crate::core::types::AppError::Internal(format!("Erreur recherche géospatiale: {}", e))
        })?;

        let mut search_results = Vec::new();
        for row in results {
            let service_id: i32 = row.get("id");
            let data: Value = row.get("data");
            let created_at: chrono::DateTime<chrono::Utc> = row.get("created_at");
            let _user_id: i32 = row.get("user_id");
            let _gps: Option<String> = row.get("gps");
            let _category: Option<String> = row.get("category");
            let location_score: f32 = row.get("location_score");

            let recency_score = self.calculate_recency_score(created_at);

            search_results.push(SearchResult {
                service_id,
                data,
                total_score: location_score + recency_score,
                fulltext_score: 0.0,
                trigram_score: location_score,
                recency_score,
                category_score: 0.0,
                search_method: "geospatial".to_string(),
                matched_fields: vec!["geospatial".to_string()],
                distance_km: None,
                gps_coords: None,
            });
        }

        Ok(search_results)
    }
}

/// Conversion des résultats de recherche en format JSON pour l'API
impl SearchResult {
    /// ✅ Phase 10 - Enrichit les distances avec Google Maps si disponible, fallback Haversine
    pub async fn enrich_with_google_maps(
        results: &mut [SearchResult],
        user_location: Option<(f64, f64)>,
        geographic_matching: Option<&Arc<crate::services::geographic_matching_service::GeographicMatchingService>>,
    ) {
        if let (Some(user_loc), Some(geo_service)) = (user_location, geographic_matching) {
            for result in results.iter_mut() {
                // Enrichir seulement si on a des coordonnées GPS
                if let Some(service_coords) = result.gps_coords {
                    // Enrichir si pas de distance ou si c'est une recherche GPS (pour améliorer la précision)
                    if result.distance_km.is_none() || result.search_method.contains("gps") {
                        // calculate_distance utilise Google Maps avec fallback Haversine automatique
                        match geo_service
                            .calculate_distance(user_loc, service_coords)
                            .await
                        {
                            Ok(distance_result) => {
                                let distance_km = distance_result.distance_meters / 1000.0;
                                
                                // Prioriser Google Maps si disponible, sinon utiliser Haversine
                                match distance_result.source {
                                    crate::services::geographic_matching_service::DistanceSource::GoogleMaps => {
                                        // Toujours utiliser Google Maps (meilleure précision)
                                        result.distance_km = Some(distance_km);
                                        log::debug!(
                                            "[NativeSearch] ✅ Distance enrichie Google Maps pour service {}: {:.2}km",
                                            result.service_id,
                                            distance_km
                                        );
                                    }
                                    crate::services::geographic_matching_service::DistanceSource::Haversine => {
                                        // Utiliser Haversine seulement si on n'a pas déjà de distance PostgreSQL
                                        // (PostgreSQL ST_Distance est généralement plus précis que Haversine simple)
                                        if result.distance_km.is_none() {
                                            result.distance_km = Some(distance_km);
                                            log::debug!(
                                                "[NativeSearch] ⚠️ Distance calculée Haversine (fallback) pour service {}: {:.2}km",
                                                result.service_id,
                                                distance_km
                                            );
                                        } else {
                                            // Garder la distance PostgreSQL existante (plus précise que Haversine)
                                            log::debug!(
                                                "[NativeSearch] ℹ️ Distance PostgreSQL conservée pour service {}: {:.2}km (Google Maps indisponible)",
                                                result.service_id,
                                                result.distance_km.unwrap()
                                            );
                                        }
                                    }
                                    crate::services::geographic_matching_service::DistanceSource::Cache => {
                                        // Le cache retourne le résultat original avec sa source (GoogleMaps ou Haversine)
                                        // Ce cas ne devrait normalement pas être atteint, mais on le gère pour sécurité
                                        if result.distance_km.is_none() {
                                            result.distance_km = Some(distance_km);
                                            log::debug!(
                                                "[NativeSearch] ℹ️ Distance depuis cache pour service {}: {:.2}km",
                                                result.service_id,
                                                distance_km
                                            );
                                        }
                                    }
                                }
                            }
                            Err(e) => {
                                // En cas d'erreur, garder la distance PostgreSQL existante ou utiliser Haversine local
                                if result.distance_km.is_none() {
                                    // Fallback ultime : calcul Haversine local
                                    use crate::services::delivery_service::haversine_distance;
                                    let haversine_km = haversine_distance(user_loc, service_coords);
                                    result.distance_km = Some(haversine_km);
                                    log::warn!(
                                        "[NativeSearch] ⚠️ Erreur calcul distance pour service {}: {:?}, utilisation Haversine local: {:.2}km",
                                        result.service_id,
                                        e,
                                        haversine_km
                                    );
                                } else {
                                    log::warn!(
                                        "[NativeSearch] ⚠️ Erreur enrichissement distance pour service {}: {:?}, conservation distance PostgreSQL: {:.2}km",
                                        result.service_id,
                                        e,
                                        result.distance_km.unwrap()
                                    );
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    pub fn to_json(&self) -> Value {
        serde_json::json!({
            "service_id": self.service_id,
            "data": self.data,
            "score": self.total_score,
            "semantic_score": self.total_score, // Compatibilité avec l'ancien format
            "interaction_score": 0.0,
            "gps": self.data.get("gps").and_then(|v| v.as_str()),
            "distance_km": self.distance_km, // ✅ Phase 10 - Distance enrichie
            "search_metadata": {
                "method": self.search_method,
                "fulltext_score": self.fulltext_score,
                "trigram_score": self.trigram_score,
                "recency_score": self.recency_score,
                "category_score": self.category_score,
                "matched_fields": self.matched_fields
            }
        })
    }
}
