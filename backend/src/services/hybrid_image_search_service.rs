// 🔍 Service de recherche hybride intelligente par image
// Combine analyse IA + recherche vectorielle + matching multi-critères
// Stocke les analyses pour amélioration continue

use crate::core::types::{AppError, AppResult};
use crate::services::intelligent_image_analysis_service::{AICost, ImageAnalysis, IntelligentImageAnalysisService};
use crate::services::app_ia::AppIA;
use crate::utils::log::{log_error, log_info, log_warn};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::{PgPool, Row};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HybridSearchResult {
    pub service_id: i32,
    pub analysis_id: Option<i32>,
    pub media_id: Option<i32>,
    pub product_description: String,
    pub product_tags: Vec<String>,
    pub product_marque: Option<String>,
    pub product_couleurs: Vec<String>,
    pub match_score: f32,
    pub distance_km: Option<f32>,
    pub service_data: Value,
}

pub struct HybridImageSearchService {
    pool: PgPool,
}

impl HybridImageSearchService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Stocker une analyse d'image en base de données
    pub async fn store_image_analysis(
        &self,
        service_id: Option<i32>,
        media_id: Option<i32>,
        user_id: i32,
        analysis: &ImageAnalysis,
        cost: &AICost,
        analysis_type: &str, // "search" ou "cataloging"
    ) -> AppResult<i32> {
        log_info(&format!(
            "[HybridImageSearch] 💾 Stockage analyse {} - Service: {:?}, User: {}",
            analysis_type, service_id, user_id
        ));

        let caracteristiques_json = serde_json::to_value(&analysis.caracteristiques_cles)
            .map_err(|e| AppError::Internal(format!("Erreur conversion JSON: {}", e)))?;

        let result = sqlx::query(
            r#"
            INSERT INTO image_analyses (
                service_id, media_id, user_id,
                description, tags, category_detected, marque, couleurs,
                caracteristiques_cles,
                search_query_exact, search_query_broad, search_query_semantic,
                confiance, model_used, tokens_consumed, cost_usd,
                analysis_type
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
            RETURNING id
            "#
        )
        .bind(service_id)
        .bind(media_id)
        .bind(user_id)
        .bind(&analysis.description)
        .bind(&analysis.tags)
        .bind(&analysis.category_detected)
        .bind(&analysis.marque)
        .bind(&analysis.couleurs)
        .bind(caracteristiques_json)
        .bind(&analysis.search_query_exact)
        .bind(&analysis.search_query_broad)
        .bind(&analysis.search_query_semantic)
        .bind(analysis.confiance)
        .bind(&cost.model_used)
        .bind(cost.total_tokens as i32)
        .bind(cost.cost_usd)
        .bind(analysis_type)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| {
            log_error(&format!("[HybridImageSearch] Erreur stockage analyse: {}", e));
            AppError::Internal(format!("Erreur stockage analyse: {}", e))
        })?;

        let analysis_id: i32 = result.get("id");

        log_info(&format!(
            "[HybridImageSearch] ✅ Analyse stockée avec ID: {}",
            analysis_id
        ));

        Ok(analysis_id)
    }

    /// Recherche hybride: Analyse l'image de recherche + Compare avec analyses stockées
    pub async fn search_by_image(
        &self,
        app_ia: &AppIA,
        image_base64: &str,
        user_id: i32,
        category_filter: Option<&str>,
        gps_lat: Option<f64>,
        gps_lng: Option<f64>,
        search_radius_km: Option<i32>,
        max_results: i32,
    ) -> AppResult<(Vec<HybridSearchResult>, ImageAnalysis, AICost)> {
        log_info("[HybridImageSearch] 🔍 Recherche hybride par image");

        // 1️⃣ Analyser l'image de recherche avec IA
        log_info("[HybridImageSearch] Étape 1/3: Analyse IA de l'image...");
        let (analysis, cost) = IntelligentImageAnalysisService::analyze_image_multimodel(
            app_ia,
            image_base64,
            category_filter,
            true, // Mode recherche
        )
        .await?;

        log_info(&format!(
            "[HybridImageSearch] ✅ Analyse complétée: '{}' (confiance: {:.2})",
            &analysis.description[..analysis.description.len().min(50)],
            analysis.confiance
        ));

        // 2️⃣ Stocker l'analyse de recherche pour analytics
        log_info("[HybridImageSearch] Étape 2/3: Stockage analyse recherche...");
        let _analysis_id = self
            .store_image_analysis(None, None, user_id, &analysis, &cost, "search")
            .await
            .map_err(|e| {
                log_warn(&format!("Impossible de stocker analyse recherche: {}", e));
                e
            })
            .ok(); // Ne pas bloquer si erreur de stockage

        // 3️⃣ Rechercher avec la fonction SQL hybride
        log_info("[HybridImageSearch] Étape 3/3: Recherche dans les produits catalogués...");
        let results = self
            .hybrid_sql_search(
                &analysis,
                category_filter,
                gps_lat,
                gps_lng,
                search_radius_km,
                max_results,
            )
            .await?;

        log_info(&format!(
            "[HybridImageSearch] ✅ Trouvé {} résultats (seuil: 10.0)",
            results.len()
        ));

        Ok((results, analysis, cost))
    }

    /// Recherche SQL hybride utilisant la fonction PostgreSQL
    async fn hybrid_sql_search(
        &self,
        analysis: &ImageAnalysis,
        category_filter: Option<&str>,
        gps_lat: Option<f64>,
        gps_lng: Option<f64>,
        search_radius_km: Option<i32>,
        max_results: i32,
    ) -> AppResult<Vec<HybridSearchResult>> {
        let couleur_principale = analysis.couleurs.first().map(|s| s.as_str());

        let rows = sqlx::query(
            r#"
            SELECT * FROM hybrid_image_search(
                $1::TEXT[],
                $2::TEXT,
                $3::TEXT,
                $4::TEXT,
                $5::TEXT,
                $6::FLOAT,
                $7::FLOAT,
                $8::INTEGER,
                $9::INTEGER
            )
            "#,
        )
        .bind(&analysis.tags)
        .bind(category_filter)
        .bind(&analysis.marque)
        .bind(couleur_principale)
        .bind(&analysis.search_query_semantic)
        .bind(gps_lat)
        .bind(gps_lng)
        .bind(search_radius_km.unwrap_or(50))
        .bind(max_results)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| {
            log_error(&format!("[HybridImageSearch] Erreur recherche SQL: {}", e));
            AppError::Internal(format!("Erreur recherche hybride: {}", e))
        })?;

        let mut results = Vec::new();
        for row in rows {
            let analysis_id: Option<i32> = row.try_get("analysis_id").ok();
            let service_id: i32 = row.try_get("service_id").unwrap_or(0);
            let media_id: Option<i32> = row.try_get("media_id").ok();
            let product_description: String = row.try_get("product_description").unwrap_or_default();
            
            let product_tags: Vec<String> = row
                .try_get::<Vec<String>, _>("product_tags")
                .unwrap_or_default();
            
            let product_marque: Option<String> = row.try_get("product_marque").ok();
            
            let product_couleurs: Vec<String> = row
                .try_get::<Vec<String>, _>("product_couleurs")
                .unwrap_or_default();
            
            let match_score: f64 = row.try_get("match_score").unwrap_or(0.0);
            let distance_km: Option<f64> = row.try_get("distance_km").ok();
            let service_data: Value = row.try_get("service_data").unwrap_or(serde_json::json!({}));

            results.push(HybridSearchResult {
                service_id,
                analysis_id,
                media_id,
                product_description,
                product_tags,
                product_marque,
                product_couleurs,
                match_score: match_score as f32,
                distance_km: distance_km.map(|d| d as f32),
                service_data,
            });
        }

        Ok(results)
    }

    /// Cataloguer un produit: analyser et stocker pour recherche future
    pub async fn catalog_product_image(
        &self,
        app_ia: &AppIA,
        service_id: i32,
        media_id: i32,
        user_id: i32,
        image_base64: &str,
        category: Option<&str>,
    ) -> AppResult<(ImageAnalysis, AICost)> {
        log_info(&format!(
            "[HybridImageSearch] 📦 Catalogage produit - Service: {}, Media: {}",
            service_id, media_id
        ));

        // Analyser en mode catalogage
        let (analysis, cost) = IntelligentImageAnalysisService::analyze_image_multimodel(
            app_ia,
            image_base64,
            category,
            false, // Mode catalogage
        )
        .await?;

        // Stocker l'analyse
        self.store_image_analysis(
            Some(service_id),
            Some(media_id),
            user_id,
            &analysis,
            &cost,
            "cataloging",
        )
        .await?;

        log_info(&format!(
            "[HybridImageSearch] ✅ Produit catalogué: '{}' (tokens: {})",
            &analysis.description[..analysis.description.len().min(50)],
            cost.total_tokens
        ));

        Ok((analysis, cost))
    }

    /// Récupérer l'historique de recherche d'un utilisateur
    pub async fn get_user_search_history(
        &self,
        user_id: i32,
        limit: i32,
    ) -> AppResult<Vec<ImageAnalysis>> {
        let rows = sqlx::query(
            r#"
            SELECT 
                description, tags, category_detected, marque, couleurs,
                caracteristiques_cles, confiance,
                search_query_exact, search_query_broad, search_query_semantic,
                created_at
            FROM image_analyses
            WHERE user_id = $1 AND analysis_type = 'search'
            ORDER BY created_at DESC
            LIMIT $2
            "#
        )
        .bind(user_id)
        .bind(limit)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur historique: {}", e)))?;

        let mut history = Vec::new();
        for row in rows {
            let caracteristiques_cles_value: serde_json::Value = row.get("caracteristiques_cles");
            let caracteristiques_cles: std::collections::HashMap<String, String> =
                serde_json::from_value(caracteristiques_cles_value).unwrap_or_default();

            let description: String = row.get("description");
            let tags: Vec<String> = row.get("tags");
            let category_detected: Option<String> = row.get("category_detected");
            let marque: Option<String> = row.get("marque");
            let couleurs: Vec<String> = row.get("couleurs");
            let confiance: Option<f64> = row.get("confiance");
            let search_query_exact: Option<String> = row.get("search_query_exact");
            let search_query_broad: Option<String> = row.get("search_query_broad");
            let search_query_semantic: Option<String> = row.get("search_query_semantic");

            history.push(ImageAnalysis {
                description,
                tags,
                category_detected: category_detected.unwrap_or_default(),
                marque,
                couleurs,
                caracteristiques_cles,
                confiance: confiance.unwrap_or(0.0) as f32,
                search_query: search_query_exact.clone().unwrap_or_default(),
                search_query_exact: search_query_exact.unwrap_or_default(),
                search_query_broad: search_query_broad.unwrap_or_default(),
                search_query_semantic: search_query_semantic.unwrap_or_default(),
            });
        }

        Ok(history)
    }

    /// Statistiques des analyses pour amélioration continue
    pub async fn get_analysis_stats(&self) -> AppResult<Value> {
        let stats = sqlx::query(
            r#"
            SELECT 
                analysis_type,
                COUNT(*) as total,
                AVG(confiance) as avg_confiance,
                AVG(tokens_consumed) as avg_tokens,
                model_used
            FROM image_analyses
            GROUP BY analysis_type, model_used
            ORDER BY total DESC
            "#
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur stats: {}", e)))?;

        let stats_json: Vec<Value> = stats
            .into_iter()
            .map(|row| {
                let analysis_type: String = row.get("analysis_type");
                let total: Option<i64> = row.get("total");
                let avg_confiance: Option<f64> = row.get("avg_confiance");
                let avg_tokens: Option<f64> = row.get("avg_tokens");
                let model_used: Option<String> = row.get("model_used");
                
                serde_json::json!({
                    "analysis_type": analysis_type,
                    "total": total,
                    "avg_confiance": avg_confiance,
                    "avg_tokens": avg_tokens,
                    "model_used": model_used
                })
            })
            .collect();

        Ok(serde_json::json!({ "analyses": stats_json }))
    }
}

