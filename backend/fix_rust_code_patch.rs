// PATCH POUR LE CODE RUST - Utiliser search_services_gps_final dans tous les cas
// =============================================================================

// Remplacer la fonction fulltext_search_with_gps dans native_search_service.rs

/// Recherche full-text intelligente avec filtrage GPS
async fn fulltext_search_with_gps(
    &self,
    query: &str,
    category_filter: Option<&str>,
    location_filter: Option<&str>,
    gps_zone: Option<&str>,
    search_radius_km: Option<i32>,
) -> AppResult<Vec<SearchResult>> {
    // TOUJOURS utiliser notre fonction PostgreSQL optimisée, même sans GPS
    let radius = search_radius_km.unwrap_or(50);
    
    if let Some(gps_zone) = gps_zone {
        log_info(&format!("[NativeSearch] Utilisation de search_services_gps_final AVEC GPS: {} et rayon: {}km", gps_zone, radius));
    } else {
        log_info(&format!("[NativeSearch] Utilisation de search_services_gps_final SANS GPS (recherche textuelle pure)"));
    }
    
    // Appeler notre fonction PostgreSQL optimisée (gère les deux cas)
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
        .bind(gps_zone)  // Peut être NULL
        .bind(radius)
        .bind(self.config.general.max_results)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| {
            log_error(&format!("[NativeSearch] Erreur recherche optimisée: {}", e));
            crate::core::types::AppError::Internal(format!("Erreur recherche optimisée: {}", e))
        })?;

    let mut search_results = Vec::new();
    for row in results {
        let service_id: i32 = row.get("service_id");
        let _titre_service: String = row.get("titre_service");
        let _category: Option<String> = row.get("category");
        let _gps_coords: Option<String> = row.get("gps_coords");
        let _distance_km: Option<f64> = row.get("distance_km");
        let relevance_score: f64 = row.get("relevance_score");  // Changé en f64 pour correspondre au SQL
        let _gps_source: Option<String> = row.get("gps_source");
        
        // Récupérer les données complètes du service
        let service_data = sqlx::query("SELECT data FROM services WHERE id = $1")
            .bind(service_id)
            .fetch_one(&self.pool)
            .await
            .map(|row| row.get::<Value, _>("data"))
            .unwrap_or_else(|_| serde_json::json!({}));

        // Déterminer la méthode de recherche
        let search_method = if gps_zone.is_some() { "gps_optimized" } else { "text_only" };
        let matched_fields = if gps_zone.is_some() { 
            vec!["gps".to_string(), "text".to_string()] 
        } else { 
            vec!["text".to_string()] 
        };

        search_results.push(SearchResult {
            service_id,
            data: service_data,
            total_score: relevance_score as f32,
            fulltext_score: relevance_score as f32,  // Utiliser relevance_score comme fulltext_score
            trigram_score: 0.0,
            recency_score: 0.0,
            category_score: 0.0,
            search_method: search_method.to_string(),
            matched_fields,
        });
        
        if gps_zone.is_some() {
            log_info(&format!("[NativeSearch] Service {} trouvé à {:.2}km (source: {})", 
                service_id, 
                _distance_km.unwrap_or(0.0), 
                _gps_source.unwrap_or_else(|| "unknown".to_string())));
        } else {
            log_info(&format!("[NativeSearch] Service {} trouvé (recherche textuelle)", service_id));
        }
    }
    
    let search_type = if gps_zone.is_some() { "GPS optimisée" } else { "textuelle pure" };
    log_info(&format!("[NativeSearch] Recherche {}: {} résultats trouvés", search_type, search_results.len()));
    
    Ok(search_results)
}

// FAIRE LA MÊME MODIFICATION POUR trigram_search_with_gps ET keyword_search_with_gps
// Remplacer le "if let Some(gps_zone)" par l'appel direct à search_services_gps_final 