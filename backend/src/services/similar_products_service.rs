use crate::core::types::{AppError, AppResult};
use chrono::Datelike;
use log::{info, warn};
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};
use std::sync::Arc;

/// Service pour rechercher des produits similaires
/// Utilise autocomplete_characteristics et la description des produits pour la similarité
/// ✅ AMÉLIORATION : Utilise les fonctions de recherche existantes (NativeSearchService) avec proximité
/// ✅ NOUVEAU : Utilise Google Maps en priorité pour calcul de distance, fallback calcul local
pub struct SimilarProductsService {
    pool: PgPool,
    /// ✅ NOUVEAU : Service géographique pour calcul de distance Google Maps (priorité) + fallback local
    geographic_matching: Option<Arc<crate::services::geographic_matching_service::GeographicMatchingService>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimilarProduct {
    pub service_id: i32,
    pub product_index: i32,
    pub product_id: String,
    pub name: String,
    pub description: Option<String>,
    pub category: Option<String>,
    pub price: Option<f64>,
    pub similarity_score: f64,
    pub is_available: bool,
    pub is_immediately_available: bool,
    pub preparation_time_minutes: Option<i32>,
    pub pickup_address: Option<String>,
    /// ✅ NOUVEAU : Distance en km depuis le client (si GPS fourni)
    pub distance_km: Option<f64>,
}

impl SimilarProductsService {
    pub fn new(pool: PgPool) -> Self {
        Self { 
            pool,
            geographic_matching: None,
        }
    }

    /// ✅ NOUVEAU : Constructeur avec service géographique pour calcul de distance Google Maps
    pub fn with_geographic_matching(
        pool: PgPool,
        geographic_matching: Arc<crate::services::geographic_matching_service::GeographicMatchingService>,
    ) -> Self {
        Self {
            pool,
            geographic_matching: Some(geographic_matching),
        }
    }

    /// Recherche des produits similaires basés sur autocomplete_characteristics et description
    /// ✅ AMÉLIORATION : Prend en compte la proximité géographique si GPS fourni
    pub async fn find_similar_products(
        &self,
        service_id: i32,
        product_index: i32,
        limit: i32,
    ) -> AppResult<Vec<SimilarProduct>> {
        // Appeler la version avec GPS (None par défaut pour compatibilité)
        self.find_similar_products_with_location(service_id, product_index, limit, None, None).await
    }

    /// Recherche des produits similaires avec prise en compte de la proximité
    /// Utilise les fonctions de recherche existantes (search_services_gps_final) pour le calcul de distance
    pub async fn find_similar_products_with_location(
        &self,
        service_id: i32,
        product_index: i32,
        limit: i32,
        client_latitude: Option<f64>,
        client_longitude: Option<f64>,
    ) -> AppResult<Vec<SimilarProduct>> {
        info!(
            "[SimilarProducts] Recherche produits similaires pour service_id={}, product_index={}",
            service_id, product_index
        );

        // Récupérer les caractéristiques du produit original depuis autocomplete_characteristics
        let original_characteristics = sqlx::query!(
            r#"
            SELECT 
                ac.characteristic_vector,
                ac.full_vector,
                ac.product_labels,
                s.data->'produits'->$2->>'nom' as product_name,
                s.data->'produits'->$2->>'description' as product_description,
                s.data->'produits'->$2->>'categorie_produit' as category,
                s.data->'produits'->$2->>'prix' as price,
                pdc.pickup_address
            FROM autocomplete_characteristics ac
            INNER JOIN services s ON s.id = ac.service_id
            LEFT JOIN product_delivery_config pdc ON s.id = pdc.service_id AND pdc.product_index = $2
            WHERE 
                ac.service_id = $1
                AND ac.identifiant_base LIKE 'produit%'
                AND ac.is_real_product = TRUE
                AND (
                    ac.product_id = $2::text
                    OR ac.product_id LIKE $2::text || '%'
                )
            LIMIT 1
            "#,
            service_id,
            product_index
        )
        .fetch_optional(&self.pool)
        .await?;

        let original = match original_characteristics {
            Some(c) => c,
            None => {
                warn!(
                    "[SimilarProducts] Caractéristiques non trouvées pour service_id={}, product_index={}",
                    service_id, product_index
                );
                // Fallback : récupérer depuis services directement
                return self.find_similar_products_fallback(service_id, product_index, limit).await;
            }
        };

        let characteristic_vector: Vec<String> = original.characteristic_vector.unwrap_or_default();
        let full_vector: Vec<String> = original.full_vector.unwrap_or_default();
        let product_description = original.product_description;

        // Rechercher des produits similaires en utilisant autocomplete_characteristics
        // Score basé sur :
        // 1. Correspondance dans characteristic_vector (poids fort)
        // 2. Correspondance dans full_vector
        // 3. Similarité de description (si disponible)
        // 4. Disponibilité aujourd'hui

        let now = chrono::Utc::now();
        let current_weekday = now.weekday().num_days_from_sunday() as i32;

        // ✅ AMÉLIORATION : Construire la requête avec calcul de distance si GPS fourni
        // Utiliser la même approche que NativeSearchService avec les fonctions existantes
        let has_gps = client_latitude.is_some() && client_longitude.is_some();
        
        let similar_products = if has_gps {
            // Requête avec calcul de distance (utilise la même logique que NativeSearchService)
            let client_lat = client_latitude.unwrap();
            let client_lng = client_longitude.unwrap();
            
            sqlx::query!(
                r#"
                WITH product_data AS (
                    SELECT 
                        s.id as service_id,
                        s.gps,
                        s.data->>'gps_fixe' as gps_fixe,
                        ac.product_id,
                        SPLIT_PART(ac.product_id, '_', 2)::integer as product_index,
                        jsonb_array_elements(
                            CASE 
                                WHEN jsonb_typeof(s.data->'produits') = 'array' 
                                THEN s.data->'produits'
                                WHEN jsonb_typeof(s.data->'produits'->'valeur') = 'array'
                                THEN s.data->'produits'->'valeur'
                                ELSE '[]'::jsonb
                            END
                        ) AS product_json,
                        (jsonb_array_elements(
                            CASE 
                                WHEN jsonb_typeof(s.data->'produits') = 'array' 
                                THEN s.data->'produits'
                                WHEN jsonb_typeof(s.data->'produits'->'valeur') = 'array'
                                THEN s.data->'produits'->'valeur'
                                ELSE '[]'::jsonb
                            END
                        )->>'index')::integer AS product_json_index
                    FROM autocomplete_characteristics ac
                    INNER JOIN services s ON s.id = ac.service_id
                    WHERE 
                        ac.service_id != $4
                        AND ac.is_real_product = TRUE
                        AND ac.identifiant_base LIKE 'produit%'
                        AND s.is_active = TRUE
                        AND (
                            EXISTS (
                                SELECT 1 FROM unnest($1::TEXT[]) AS orig_val
                                WHERE EXISTS (
                                    SELECT 1 FROM unnest(ac.characteristic_vector) AS vec_val
                                    WHERE LOWER(vec_val) LIKE '%' || LOWER(orig_val) || '%'
                                )
                            )
                            OR EXISTS (
                                SELECT 1 FROM unnest($2::TEXT[]) AS orig_val
                                WHERE EXISTS (
                                    SELECT 1 FROM unnest(ac.full_vector) AS vec_val
                                    WHERE LOWER(vec_val) LIKE '%' || LOWER(orig_val) || '%'
                                )
                            )
                        )
                )
                SELECT DISTINCT ON (pd.service_id, pd.product_index)
                    pd.service_id,
                    pd.product_id,
                    pd.product_index,
                    pd.product_json->>'nom' as product_name,
                    pd.product_json->>'description' as product_description,
                    pd.product_json->>'categorie_produit' as category,
                    (pd.product_json->>'prix')::text as price,
                    pdc.pickup_address,
                    pdc.is_immediately_available,
                    pdc.preparation_time_minutes,
                    pdc.availability_days,
                    -- ✅ Calcul de distance en km (formule Haversine simplifiée)
                    CASE 
                        WHEN pd.gps_fixe IS NOT NULL AND pd.gps_fixe != '' 
                             AND pd.gps_fixe ~ '^-?\d+\.\d+,-?\d+\.\d+$' THEN
                            (SQRT(
                                POW(CAST(SPLIT_PART(pd.gps_fixe, ',', 1) AS DECIMAL) - $7, 2) +
                                POW(CAST(SPLIT_PART(pd.gps_fixe, ',', 2) AS DECIMAL) - $8, 2)
                            ) * 111.0)
                        WHEN pd.gps IS NOT NULL AND pd.gps != '' 
                             AND pd.gps ~ '^-?\d+\.\d+,-?\d+\.\d+$' THEN
                            (SQRT(
                                POW(CAST(SPLIT_PART(pd.gps, ',', 1) AS DECIMAL) - $7, 2) +
                                POW(CAST(SPLIT_PART(pd.gps, ',', 2) AS DECIMAL) - $8, 2)
                            ) * 111.0)
                        ELSE NULL
                    END as distance_km,
                    -- Score de similarité avec bonus proximité
                    (
                        -- Score correspondance exacte dans characteristic_vector (poids fort)
                        (
                            SELECT COUNT(*)::REAL * 30.0
                            FROM unnest($1::TEXT[]) AS orig_val
                            WHERE EXISTS (
                                SELECT 1 FROM unnest(ac.characteristic_vector) AS vec_val
                                WHERE LOWER(vec_val) = LOWER(orig_val)
                            )
                        ) +
                        -- Score correspondance partielle dans characteristic_vector
                        (
                            SELECT COUNT(*)::REAL * 15.0
                            FROM unnest($1::TEXT[]) AS orig_val
                            WHERE EXISTS (
                                SELECT 1 FROM unnest(ac.characteristic_vector) AS vec_val
                                WHERE LOWER(vec_val) LIKE '%' || LOWER(orig_val) || '%'
                            )
                        ) +
                        -- Score correspondance dans full_vector
                        (
                            SELECT COUNT(*)::REAL * 10.0
                            FROM unnest($2::TEXT[]) AS orig_val
                            WHERE EXISTS (
                                SELECT 1 FROM unnest(ac.full_vector) AS vec_val
                                WHERE LOWER(vec_val) LIKE '%' || LOWER(orig_val) || '%'
                            )
                        ) +
                        -- Bonus si description similaire
                        CASE 
                            WHEN $3 IS NOT NULL 
                                 AND pd.product_json->>'description' IS NOT NULL
                            THEN 
                                similarity(
                                    LOWER(COALESCE($3, '')),
                                    LOWER(COALESCE(pd.product_json->>'description', ''))
                                ) * 20.0
                            ELSE 0.0
                        END +
                        -- Bonus popularité
                        (ac.usage_count::REAL * 2.0) +
                        -- ✅ Bonus proximité (jusqu'à 25 points pour produits proches)
                        CASE 
                            WHEN (
                                CASE 
                                    WHEN pd.gps_fixe IS NOT NULL AND pd.gps_fixe != '' 
                                         AND pd.gps_fixe ~ '^-?\d+\.\d+,-?\d+\.\d+$' THEN
                                        (SQRT(
                                            POW(CAST(SPLIT_PART(pd.gps_fixe, ',', 1) AS DECIMAL) - $7, 2) +
                                            POW(CAST(SPLIT_PART(pd.gps_fixe, ',', 2) AS DECIMAL) - $8, 2)
                                        ) * 111.0)
                                    WHEN pd.gps IS NOT NULL AND pd.gps != '' 
                                         AND pd.gps ~ '^-?\d+\.\d+,-?\d+\.\d+$' THEN
                                        (SQRT(
                                            POW(CAST(SPLIT_PART(pd.gps, ',', 1) AS DECIMAL) - $7, 2) +
                                            POW(CAST(SPLIT_PART(pd.gps, ',', 2) AS DECIMAL) - $8, 2)
                                        ) * 111.0)
                                    ELSE NULL
                                END
                            ) IS NOT NULL THEN
                                GREATEST(0, 50.0 - (
                                    CASE 
                                        WHEN pd.gps_fixe IS NOT NULL AND pd.gps_fixe != '' 
                                             AND pd.gps_fixe ~ '^-?\d+\.\d+,-?\d+\.\d+$' THEN
                                            (SQRT(
                                                POW(CAST(SPLIT_PART(pd.gps_fixe, ',', 1) AS DECIMAL) - $7, 2) +
                                                POW(CAST(SPLIT_PART(pd.gps_fixe, ',', 2) AS DECIMAL) - $8, 2)
                                            ) * 111.0)
                                        WHEN pd.gps IS NOT NULL AND pd.gps != '' 
                                             AND pd.gps ~ '^-?\d+\.\d+,-?\d+\.\d+$' THEN
                                            (SQRT(
                                                POW(CAST(SPLIT_PART(pd.gps, ',', 1) AS DECIMAL) - $7, 2) +
                                                POW(CAST(SPLIT_PART(pd.gps, ',', 2) AS DECIMAL) - $8, 2)
                                            ) * 111.0)
                                        ELSE NULL
                                    END
                                )) * 0.5
                            ELSE 0.0
                        END
                    ) as similarity_score
                FROM product_data pd
                INNER JOIN autocomplete_characteristics ac 
                    ON ac.service_id = pd.service_id 
                    AND ac.product_id = pd.product_id
                LEFT JOIN product_delivery_config pdc 
                    ON pdc.service_id = pd.service_id 
                    AND pdc.product_index = pd.product_index
                INNER JOIN services s ON s.id = pd.service_id
                WHERE 
                    pd.product_json_index = pd.product_index
                    AND (
                        pdc.availability_days IS NULL 
                        OR $5 = ANY(pdc.availability_days)
                    )
                ORDER BY 
                    -- ✅ Trier par similarité ET proximité (proximité d'abord si < 10km)
                    CASE 
                        WHEN (
                            CASE 
                                WHEN pd.gps_fixe IS NOT NULL AND pd.gps_fixe != '' 
                                     AND pd.gps_fixe ~ '^-?\d+\.\d+,-?\d+\.\d+$' THEN
                                    (SQRT(
                                        POW(CAST(SPLIT_PART(pd.gps_fixe, ',', 1) AS DECIMAL) - $7, 2) +
                                        POW(CAST(SPLIT_PART(pd.gps_fixe, ',', 2) AS DECIMAL) - $8, 2)
                                    ) * 111.0)
                                WHEN pd.gps IS NOT NULL AND pd.gps != '' 
                                     AND pd.gps ~ '^-?\d+\.\d+,-?\d+\.\d+$' THEN
                                    (SQRT(
                                        POW(CAST(SPLIT_PART(pd.gps, ',', 1) AS DECIMAL) - $7, 2) +
                                        POW(CAST(SPLIT_PART(pd.gps, ',', 2) AS DECIMAL) - $8, 2)
                                    ) * 111.0)
                                ELSE NULL
                            END
                        ) <= 10 THEN 0  -- Priorité aux produits proches (< 10km)
                        ELSE 1
                    END,
                    similarity_score DESC,
                    CASE 
                        WHEN (
                            CASE 
                                WHEN pd.gps_fixe IS NOT NULL AND pd.gps_fixe != '' 
                                     AND pd.gps_fixe ~ '^-?\d+\.\d+,-?\d+\.\d+$' THEN
                                    (SQRT(
                                        POW(CAST(SPLIT_PART(pd.gps_fixe, ',', 1) AS DECIMAL) - $7, 2) +
                                        POW(CAST(SPLIT_PART(pd.gps_fixe, ',', 2) AS DECIMAL) - $8, 2)
                                    ) * 111.0)
                                WHEN pd.gps IS NOT NULL AND pd.gps != '' 
                                     AND pd.gps ~ '^-?\d+\.\d+,-?\d+\.\d+$' THEN
                                    (SQRT(
                                        POW(CAST(SPLIT_PART(pd.gps, ',', 1) AS DECIMAL) - $7, 2) +
                                        POW(CAST(SPLIT_PART(pd.gps, ',', 2) AS DECIMAL) - $8, 2)
                                    ) * 111.0)
                                ELSE NULL
                            END
                        ) IS NOT NULL THEN (
                            CASE 
                                WHEN pd.gps_fixe IS NOT NULL AND pd.gps_fixe != '' 
                                     AND pd.gps_fixe ~ '^-?\d+\.\d+,-?\d+\.\d+$' THEN
                                    (SQRT(
                                        POW(CAST(SPLIT_PART(pd.gps_fixe, ',', 1) AS DECIMAL) - $7, 2) +
                                        POW(CAST(SPLIT_PART(pd.gps_fixe, ',', 2) AS DECIMAL) - $8, 2)
                                    ) * 111.0)
                                WHEN pd.gps IS NOT NULL AND pd.gps != '' 
                                     AND pd.gps ~ '^-?\d+\.\d+,-?\d+\.\d+$' THEN
                                    (SQRT(
                                        POW(CAST(SPLIT_PART(pd.gps, ',', 1) AS DECIMAL) - $7, 2) +
                                        POW(CAST(SPLIT_PART(pd.gps, ',', 2) AS DECIMAL) - $8, 2)
                                    ) * 111.0)
                                ELSE NULL
                            END
                        )
                        ELSE 999999.0
                    END ASC
                LIMIT $6
                "#,
                &characteristic_vector,
                &full_vector,
                product_description,
                service_id,
                current_weekday,
                limit,
                client_lat,
                client_lng
            )
            .fetch_all(&self.pool)
            .await?
        } else {
            // Requête sans calcul de distance (version originale)
            sqlx::query!(
                r#"
                WITH product_data AS (
                    SELECT 
                        s.id as service_id,
                        ac.product_id,
                        SPLIT_PART(ac.product_id, '_', 2)::integer as product_index,
                        jsonb_array_elements(
                            CASE 
                                WHEN jsonb_typeof(s.data->'produits') = 'array' 
                                THEN s.data->'produits'
                                WHEN jsonb_typeof(s.data->'produits'->'valeur') = 'array'
                                THEN s.data->'produits'->'valeur'
                                ELSE '[]'::jsonb
                            END
                        ) AS product_json,
                        (jsonb_array_elements(
                            CASE 
                                WHEN jsonb_typeof(s.data->'produits') = 'array' 
                                THEN s.data->'produits'
                                WHEN jsonb_typeof(s.data->'produits'->'valeur') = 'array'
                                THEN s.data->'produits'->'valeur'
                                ELSE '[]'::jsonb
                            END
                        )->>'index')::integer AS product_json_index
                    FROM autocomplete_characteristics ac
                    INNER JOIN services s ON s.id = ac.service_id
                    WHERE 
                        ac.service_id != $4
                        AND ac.is_real_product = TRUE
                        AND ac.identifiant_base LIKE 'produit%'
                        AND s.is_active = TRUE
                        AND (
                            EXISTS (
                                SELECT 1 FROM unnest($1::TEXT[]) AS orig_val
                                WHERE EXISTS (
                                    SELECT 1 FROM unnest(ac.characteristic_vector) AS vec_val
                                    WHERE LOWER(vec_val) LIKE '%' || LOWER(orig_val) || '%'
                                )
                            )
                            OR EXISTS (
                                SELECT 1 FROM unnest($2::TEXT[]) AS orig_val
                                WHERE EXISTS (
                                    SELECT 1 FROM unnest(ac.full_vector) AS vec_val
                                    WHERE LOWER(vec_val) LIKE '%' || LOWER(orig_val) || '%'
                                )
                            )
                        )
                )
                SELECT DISTINCT ON (pd.service_id, pd.product_index)
                    pd.service_id,
                    pd.product_id,
                    pd.product_index,
                    pd.product_json->>'nom' as product_name,
                    pd.product_json->>'description' as product_description,
                    pd.product_json->>'categorie_produit' as category,
                    (pd.product_json->>'prix')::text as price,
                    pdc.pickup_address,
                    pdc.is_immediately_available,
                    pdc.preparation_time_minutes,
                    pdc.availability_days,
                    NULL::REAL as distance_km,
                    -- Score de similarité basé sur characteristic_vector et full_vector
                    (
                        -- Score correspondance exacte dans characteristic_vector (poids fort)
                        (
                            SELECT COUNT(*)::REAL * 30.0
                            FROM unnest($1::TEXT[]) AS orig_val
                            WHERE EXISTS (
                                SELECT 1 FROM unnest(ac.characteristic_vector) AS vec_val
                                WHERE LOWER(vec_val) = LOWER(orig_val)
                            )
                        ) +
                        -- Score correspondance partielle dans characteristic_vector
                        (
                            SELECT COUNT(*)::REAL * 15.0
                            FROM unnest($1::TEXT[]) AS orig_val
                            WHERE EXISTS (
                                SELECT 1 FROM unnest(ac.characteristic_vector) AS vec_val
                                WHERE LOWER(vec_val) LIKE '%' || LOWER(orig_val) || '%'
                            )
                        ) +
                        -- Score correspondance dans full_vector
                        (
                            SELECT COUNT(*)::REAL * 10.0
                            FROM unnest($2::TEXT[]) AS orig_val
                            WHERE EXISTS (
                                SELECT 1 FROM unnest(ac.full_vector) AS vec_val
                                WHERE LOWER(vec_val) LIKE '%' || LOWER(orig_val) || '%'
                            )
                        ) +
                        -- Bonus si description similaire (si disponible)
                        CASE 
                            WHEN $3 IS NOT NULL 
                                 AND pd.product_json->>'description' IS NOT NULL
                            THEN 
                                similarity(
                                    LOWER(COALESCE($3, '')),
                                    LOWER(COALESCE(pd.product_json->>'description', ''))
                                ) * 20.0
                            ELSE 0.0
                        END +
                        -- Bonus popularité (usage_count)
                        (ac.usage_count::REAL * 2.0)
                    ) as similarity_score
                FROM product_data pd
                INNER JOIN autocomplete_characteristics ac 
                    ON ac.service_id = pd.service_id 
                    AND ac.product_id = pd.product_id
                LEFT JOIN product_delivery_config pdc 
                    ON pdc.service_id = pd.service_id 
                    AND pdc.product_index = pd.product_index
                WHERE 
                    pd.product_json_index = pd.product_index
                    AND (
                        pdc.availability_days IS NULL 
                        OR $5 = ANY(pdc.availability_days)
                    )
                ORDER BY pd.service_id, pd.product_index, similarity_score DESC
                LIMIT $6
                "#,
                &characteristic_vector,
                &full_vector,
                product_description,
                service_id,
                current_weekday,
                limit
            )
            .fetch_all(&self.pool)
            .await?
        };

        let mut results = Vec::new();

        for row in similar_products {
            let price = row.price.and_then(|p| p.parse::<f64>().ok());
            let availability_days: Option<Vec<i32>> = row.availability_days;
            let is_available = availability_days
                .as_ref()
                .map(|days| days.is_empty() || days.contains(&current_weekday))
                .unwrap_or(true);

            let product_index = row.product_index.unwrap_or_else(|| {
                // Extraire product_index depuis product_id (format: "serviceId_productIndex")
                row.product_id
                    .split('_')
                    .nth(1)
                    .and_then(|s| s.parse::<i32>().ok())
                    .unwrap_or(0)
            });

            // ✅ NOUVEAU : Récupérer distance_km si disponible
            let distance_km = row.distance_km;

            results.push(SimilarProduct {
                service_id: row.service_id,
                product_index,
                product_id: row.product_id,
                name: row.product_name.unwrap_or_default(),
                description: row.product_description,
                category: row.category,
                price,
                similarity_score: row.similarity_score.unwrap_or(0.0) as f64,
                is_available,
                is_immediately_available: row.is_immediately_available.unwrap_or(false),
                preparation_time_minutes: row.preparation_time_minutes,
                pickup_address: row.pickup_address,
                distance_km, // ✅ NOUVEAU : Distance en km
            });
        }

        // ✅ AMÉLIORATION : Enrichir les distances avec Google Maps si disponible (priorité)
        // Sinon, utiliser les distances calculées localement (fallback)
        if let (Some(client_lat), Some(client_lng), Some(geo_service)) = 
            (client_latitude, client_longitude, self.geographic_matching.as_ref()) 
        {
            info!("[SimilarProducts] Enrichissement des distances avec Google Maps (priorité) + fallback local");
            
            for product in &mut results {
                // Récupérer les coordonnées GPS du service/produit
                let service_gps = sqlx::query!(
                    r#"
                    SELECT 
                        COALESCE(s.data->>'gps_fixe', s.gps) as gps_coords
                    FROM services s
                    WHERE s.id = $1
                    "#,
                    product.service_id
                )
                .fetch_optional(&self.pool)
                .await?;

                if let Some(gps_row) = service_gps {
                    if let Some(gps_str) = gps_row.gps_coords {
                        // Parser les coordonnées GPS (format: "lat,lng")
                        if let Some((lat_str, lng_str)) = gps_str.split_once(',') {
                            if let (Ok(service_lat), Ok(service_lng)) = 
                                (lat_str.trim().parse::<f64>(), lng_str.trim().parse::<f64>()) 
                            {
                                // ✅ PRIORITÉ : Utiliser Google Maps pour calcul de distance routière précise
                                // Fallback automatique vers Haversine si Google Maps échoue
                                match geo_service.calculate_distance(
                                    (client_lat, client_lng),
                                    (service_lat, service_lng),
                                ).await {
                                    Ok(distance_result) => {
                                        // Convertir mètres en km
                                        product.distance_km = Some(distance_result.distance_meters / 1000.0);
                                        info!(
                                            "[SimilarProducts] Distance {} calculée via {}: {:.2}km",
                                            product.product_id,
                                            match distance_result.source {
                                                crate::services::geographic_matching_service::DistanceSource::GoogleMaps => "Google Maps",
                                                crate::services::geographic_matching_service::DistanceSource::Cache => "Cache (Google Maps)",
                                                crate::services::geographic_matching_service::DistanceSource::Haversine => "Haversine (fallback)",
                                            },
                                            product.distance_km.unwrap()
                                        );
                                    }
                                    Err(e) => {
                                        warn!(
                                            "[SimilarProducts] Erreur calcul distance pour produit {}: {:?}",
                                            product.product_id, e
                                        );
                                        // Garder la distance locale calculée par SQL si disponible
                                        if product.distance_km.is_none() {
                                            // Calcul Haversine de secours
                                            product.distance_km = Some(
                                                Self::haversine_distance_fallback(
                                                    client_lat, client_lng,
                                                    service_lat, service_lng
                                                )
                                            );
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // Trier par score de similarité décroissant, puis par distance (si disponible)
        results.sort_by(|a, b| {
            // Priorité aux produits proches (< 10km) si distance disponible
            let a_priority = a.distance_km.map(|d| if d <= 10.0 { 0 } else { 1 }).unwrap_or(1);
            let b_priority = b.distance_km.map(|d| if d <= 10.0 { 0 } else { 1 }).unwrap_or(1);
            
            match a_priority.cmp(&b_priority) {
                std::cmp::Ordering::Equal => {
                    // Ensuite par score de similarité
                    match b.similarity_score.partial_cmp(&a.similarity_score) {
                        Some(std::cmp::Ordering::Equal) => {
                            // Enfin par distance (plus proche d'abord)
                            match (a.distance_km, b.distance_km) {
                                (Some(a_dist), Some(b_dist)) => a_dist.partial_cmp(&b_dist).unwrap_or(std::cmp::Ordering::Equal),
                                _ => std::cmp::Ordering::Equal,
                            }
                        }
                        Some(ordering) => ordering,
                        None => std::cmp::Ordering::Equal,
                    }
                }
                other => other,
            }
        });

        info!(
            "[SimilarProducts] Trouvé {} produits similaires ({} avec distance calculée)",
            results.len(),
            results.iter().filter(|p| p.distance_km.is_some()).count()
        );

        Ok(results)
    }

    /// ✅ NOUVEAU : Calcul de distance Haversine de secours (fallback local)
    /// Utilise la fonction existante de delivery_service
    fn haversine_distance_fallback(lat1: f64, lon1: f64, lat2: f64, lon2: f64) -> f64 {
        use crate::services::delivery_service::haversine_distance;
        // haversine_distance retourne en mètres, convertir en km
        haversine_distance((lat1, lon1), (lat2, lon2)) / 1000.0
    }

    /// Fallback : recherche basique si autocomplete_characteristics n'est pas disponible
    async fn find_similar_products_fallback(
        &self,
        service_id: i32,
        product_index: i32,
        limit: i32,
    ) -> AppResult<Vec<SimilarProduct>> {
        warn!(
            "[SimilarProducts] Utilisation du fallback pour service_id={}, product_index={}",
            service_id, product_index
        );

        // Récupérer le produit original depuis services
        let product_index_str = product_index.to_string();
        let original_product = sqlx::query!(
            r#"
            SELECT 
                s.data->'produits'->$2->>'nom' as product_name,
                s.data->'produits'->$2->>'description' as product_description,
                s.data->'produits'->$2->>'categorie_produit' as category
            FROM services s
            WHERE s.id = $1
            "#,
            service_id,
            product_index_str
        )
        .fetch_optional(&self.pool)
        .await?;

        let original = match original_product {
            Some(p) => p,
            None => {
                return Err(AppError::NotFound(format!(
                    "Produit {}/{} non trouvé",
                    service_id, product_index
                )));
            }
        };

        let product_name = original.product_name.unwrap_or_default();
        let product_description = original.product_description;
        let category = original.category;

        let now = chrono::Utc::now();
        let current_weekday = now.weekday().num_days_from_sunday() as i32;

        // Recherche basique par nom et description
        let similar_products = sqlx::query!(
            r#"
            SELECT DISTINCT
                s.id as service_id,
                (jsonb_array_elements(s.data->'produits')->>'index')::integer as product_index,
                jsonb_array_elements(s.data->'produits')->>'nom' as product_name,
                jsonb_array_elements(s.data->'produits')->>'description' as product_description,
                jsonb_array_elements(s.data->'produits')->>'categorie_produit' as category,
                (jsonb_array_elements(s.data->'produits')->>'prix')::text as price,
                pdc.pickup_address,
                pdc.is_immediately_available,
                pdc.preparation_time_minutes,
                pdc.availability_days,
                (
                    CASE 
                        WHEN jsonb_array_elements(s.data->'produits')->>'nom' ILIKE '%' || $3 || '%' THEN 0.8
                        WHEN jsonb_array_elements(s.data->'produits')->>'description' ILIKE '%' || $3 || '%' THEN 0.6
                        WHEN jsonb_array_elements(s.data->'produits')->>'categorie_produit' = $4 THEN 0.5
                        ELSE 0.3
                    END +
                    CASE 
                        WHEN $5 IS NOT NULL 
                             AND jsonb_array_elements(s.data->'produits')->>'description' IS NOT NULL
                        THEN similarity(
                            LOWER(COALESCE($5, '')),
                            LOWER(COALESCE(jsonb_array_elements(s.data->'produits')->>'description', ''))
                        ) * 0.4
                        ELSE 0.0
                    END
                ) as similarity_score
            FROM services s
            LEFT JOIN product_delivery_config pdc 
                ON s.id = pdc.service_id 
                AND (jsonb_array_elements(s.data->'produits')->>'index')::integer = pdc.product_index
            WHERE 
                s.id != $1
                AND s.is_active = TRUE
                AND (
                    jsonb_array_elements(s.data->'produits')->>'nom' ILIKE '%' || $3 || '%'
                    OR jsonb_array_elements(s.data->'produits')->>'description' ILIKE '%' || $3 || '%'
                    OR jsonb_array_elements(s.data->'produits')->>'categorie_produit' = $4
                )
                AND (
                    pdc.availability_days IS NULL 
                    OR $6 = ANY(pdc.availability_days)
                )
            ORDER BY similarity_score DESC
            LIMIT $2
            "#,
            service_id,
            limit,
            product_name,
            category,
            product_description,
            current_weekday
        )
        .fetch_all(&self.pool)
        .await?;

        let mut results = Vec::new();

        for row in similar_products {
            let price = row.price.and_then(|p| p.parse::<f64>().ok());
            let availability_days: Option<Vec<i32>> = row.availability_days;
            let is_available = availability_days
                .as_ref()
                .map(|days| days.is_empty() || days.contains(&current_weekday))
                .unwrap_or(true);

            results.push(SimilarProduct {
                service_id: row.service_id,
                product_index: row.product_index.unwrap_or(0),
                product_id: row.product_index.unwrap_or(0).to_string(),
                name: row.product_name.unwrap_or_default(),
                description: row.product_description,
                category: row.category,
                price,
                similarity_score: row.similarity_score.unwrap_or(0.0) as f64,
                is_available,
                is_immediately_available: row.is_immediately_available.unwrap_or(false),
                preparation_time_minutes: row.preparation_time_minutes,
                pickup_address: row.pickup_address,
                distance_km: None, // Fallback n'a pas de calcul de distance
            });
        }

        results.sort_by(|a, b| {
            b.similarity_score
                .partial_cmp(&a.similarity_score)
                .unwrap_or(std::cmp::Ordering::Equal)
        });

        Ok(results)
    }

    /// Recherche des produits similaires avec filtres supplémentaires
    /// ✅ AMÉLIORATION : Utilise maintenant la recherche avec proximité
    pub async fn find_similar_products_with_filters(
        &self,
        service_id: i32,
        product_index: i32,
        limit: i32,
        min_price: Option<f64>,
        max_price: Option<f64>,
        category: Option<String>,
        max_distance_km: Option<f64>,
        client_latitude: Option<f64>,
        client_longitude: Option<f64>,
    ) -> AppResult<Vec<SimilarProduct>> {
        // Utiliser la méthode avec proximité puis appliquer les filtres
        let mut results = self.find_similar_products_with_location(
            service_id, 
            product_index, 
            limit * 2,
            client_latitude,
            client_longitude,
        ).await?;

        // Appliquer les filtres
        if let Some(min) = min_price {
            results.retain(|p| p.price.map(|pr| pr >= min).unwrap_or(true));
        }
        if let Some(max) = max_price {
            results.retain(|p| p.price.map(|pr| pr <= max).unwrap_or(true));
        }
        if let Some(cat) = category {
            results.retain(|p| {
                p.category
                    .as_ref()
                    .map(|c| c.eq_ignore_ascii_case(&cat))
                    .unwrap_or(false)
            });
        }
        // ✅ NOUVEAU : Filtrer par distance maximale
        if let Some(max_dist) = max_distance_km {
            results.retain(|p| {
                p.distance_km.map(|d| d <= max_dist).unwrap_or(true)
            });
        }

        // Limiter les résultats
        results.truncate(limit as usize);

        Ok(results)
    }
}

