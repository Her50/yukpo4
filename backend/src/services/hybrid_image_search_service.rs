// 🔍 Service de recherche hybride intelligente par image
// Combine analyse IA + recherche vectorielle + matching multi-critères
// Stocke les analyses pour amélioration continue

use crate::core::types::{AppError, AppResult};
use crate::services::app_ia::AppIA;
use crate::services::intelligent_image_analysis_service::{
    AICost, ImageAnalysis, IntelligentImageAnalysisService,
};
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
            "#,
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
            log_error(&format!(
                "[HybridImageSearch] Erreur stockage analyse: {}",
                e
            ));
            AppError::Internal(format!("Erreur stockage analyse: {}", e))
        })?;

        let analysis_id: i32 = result.get("id");

        log_info(&format!(
            "[HybridImageSearch] ✅ Analyse stockée avec ID: {}",
            analysis_id
        ));

        Ok(analysis_id)
    }

    /// ✅ CORRECTION 2025-11-01: Analyser l'image avec le MÊME prompt que la création pour matching optimal
    async fn analyze_image_like_creation(
        app_ia: &AppIA,
        image_base64: &str,
    ) -> AppResult<(ImageAnalysis, AICost)> {
        use crate::utils::log::log_info;

        log_info("[HybridImageSearch] 🔍 Analyse image avec prompt de recherche dédié...");

        // ✅ NOUVEAU 2025-11-04: Charger le nouveau prompt optimisé pour recherche par image
        // Ce prompt extrait uniquement le vecteur de caractéristiques (sans dépendances/combinaisons)
        let search_prompt = match tokio::fs::read_to_string(
            "ia_prompts/recherche_image_produit_prompt.md",
        )
        .await
        {
            Ok(content) => {
                log_info(
                    "[HybridImageSearch] ✅ Prompt de recherche par image chargé depuis fichier",
                );
                content
            }
            Err(e) => {
                log_warn(&format!("[HybridImageSearch] ⚠️ Impossible de charger prompt fichier: {}, utilisation embedded", e));
                // Fallback vers prompt embedded
                include_str!("../../ia_prompts/recherche_image_produit_prompt.md").to_string()
            }
        };

        // ✅ CORRECTION: Préparer l'image exactement comme lors de la création
        // Lors de la création, input.base64_image est un Option<Vec<String>> où chaque string est base64 pur
        // predict_multimodal formate automatiquement avec "data:image/jpeg;base64,{}" dans call_openai_multimodal
        // Donc on passe juste le base64 pur, comme lors de la création
        let image_base64_pure =
            if image_base64.starts_with("http://") || image_base64.starts_with("https://") {
                // URL directe - passer tel quel (rare cas)
                image_base64.to_string()
            } else if image_base64.starts_with("data:") {
                // Data URI - extraire le base64 pur pour être cohérent avec la création
                image_base64
                    .split("base64,")
                    .nth(1)
                    .unwrap_or(image_base64)
                    .to_string()
            } else {
                // Base64 pur - passer tel quel (format attendu comme lors de la création)
                image_base64.to_string()
            };

        // ✅ Appeler l'IA avec le même format que la création (base64 pur dans Vec)
        // ?? CORRECTION : L'ordre de retour est (model_name, response, tokens)
        let (model_name, json_response, tokens_used) = app_ia
            .predict_multimodal(&search_prompt, Some(vec![image_base64_pure]))
            .await?;

        // Parser le JSON
        let cleaned_json = json_response
            .replace("```json", "")
            .replace("```", "")
            .trim()
            .to_string();

        let parsed_json: serde_json::Value = serde_json::from_str(&cleaned_json).map_err(|e| {
            crate::core::types::AppError::Internal(format!("Erreur parsing JSON image: {}", e))
        })?;

        // ✅ NOUVEAU 2025-11-04: Parser le nouveau format avec vecteur_caracteristiques
        log_info(&format!(
            "[HybridImageSearch] JSON parsé: {}",
            &cleaned_json.chars().take(200).collect::<String>()
        ));

        // ✅ NOUVEAU 2025-11-04: Parser le nouveau format avec vecteur_caracteristiques
        let vecteur_caracteristiques = parsed_json
            .get("vecteur_caracteristiques")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str().map(|s| s.to_string()))
                    .collect::<Vec<String>>()
            })
            .unwrap_or_default();

        let labels_dimensions = parsed_json
            .get("labels_dimensions")
            .and_then(|l| l.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str().map(|s| s.to_string()))
                    .collect::<Vec<String>>()
            })
            .unwrap_or_default();

        let categorie = parsed_json
            .get("categorie_detectee")
            .and_then(|c| c.as_str())
            .unwrap_or("autre")
            .to_string();

        let nom = parsed_json
            .get("nom_produit")
            .and_then(|n| n.as_str())
            .unwrap_or("Produit recherché")
            .to_string();

        let description = parsed_json
            .get("description_produit")
            .and_then(|d| d.as_str())
            .unwrap_or(&nom)
            .to_string();

        let search_query_from_json = parsed_json
            .get("search_query")
            .and_then(|sq| sq.as_str())
            .unwrap_or("")
            .to_string();

        // Extraire marque depuis le vecteur (chercher index du label "marque")
        let mut marque: Option<String> = None;
        let mut couleurs: Vec<String> = Vec::new();

        for (i, label) in labels_dimensions.iter().enumerate() {
            if label == "marque" || label == "brand" {
                if i < vecteur_caracteristiques.len() {
                    marque = Some(vecteur_caracteristiques[i].clone());
                }
            }
            if label.contains("couleur") || label == "color" {
                if i < vecteur_caracteristiques.len() {
                    couleurs.push(vecteur_caracteristiques[i].clone());
                }
            }
        }

        // Construire tags depuis le vecteur complet
        let mut tags: Vec<String> = vecteur_caracteristiques.clone();

        // Ajouter nom et catégorie
        if !tags.contains(&nom) {
            tags.push(nom.clone());
        }
        if !tags.contains(&categorie) {
            tags.push(categorie.clone());
        }

        // Ajouter texte visible si présent
        if let Some(texte_visible_arr) = parsed_json
            .get("texte_visible")
            .and_then(|tv| tv.as_array())
        {
            tags.extend(
                texte_visible_arr
                    .iter()
                    .filter_map(|v| v.as_str().map(|s| s.to_string())),
            );
        }

        // Construire les requêtes de recherche
        let search_query_exact = if !search_query_from_json.is_empty() {
            search_query_from_json.clone()
        } else {
            vecteur_caracteristiques.join(" ")
        };

        let search_query_broad = format!(
            "{} {} {} {}",
            categorie,
            vecteur_caracteristiques.join(" "),
            nom,
            description.chars().take(50).collect::<String>()
        )
        .trim()
        .to_string();

        let search_query_semantic = description.clone();

        // Extraire confiance
        let confiance = parsed_json
            .get("confiance")
            .and_then(|c| c.as_f64())
            .unwrap_or(0.95) as f32;

        log_info(&format!(
            "[HybridImageSearch] ✅ Vecteur extrait: {} caractéristiques, Catégorie: {}, Marque: {:?}, Confiance: {:.2}",
            vecteur_caracteristiques.len(),
            categorie,
            marque,
            confiance
        ));

        // Construire caracteristiques_cles depuis vecteur + labels
        let mut caracteristiques_cles = std::collections::HashMap::new();
        for (i, label) in labels_dimensions.iter().enumerate() {
            if i < vecteur_caracteristiques.len() {
                caracteristiques_cles.insert(label.clone(), vecteur_caracteristiques[i].clone());
            }
        }

        // Construire ImageAnalysis compatible
        let analysis = ImageAnalysis {
            description,
            tags,
            category_detected: categorie,
            marque,
            couleurs,
            caracteristiques_cles,
            confiance,
            search_query: search_query_exact.clone(),
            search_query_exact,
            search_query_broad,
            search_query_semantic,
        };

        // Calculer le coût
        let cost = AICost {
            cost_usd: (tokens_used as f64) * 0.00001, // Estimation
            total_tokens: tokens_used,
            prompt_tokens: tokens_used / 2,
            completion_tokens: tokens_used / 2,
            model_used: model_name,
        };

        log_info(&format!(
            "[HybridImageSearch] ✅ Analyse nouveau format: '{}' (confiance: {:.2}, vecteur: {} dims)",
            &analysis.description[..analysis.description.len().min(50)],
            analysis.confiance,
            vecteur_caracteristiques.len()
        ));

        Ok((analysis, cost))
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

        // ✅ CORRECTION: Utiliser le MÊME système d'analyse que la création
        log_info("[HybridImageSearch] Étape 1/3: Analyse IA avec système création...");
        let (analysis, cost) = Self::analyze_image_like_creation(app_ia, image_base64).await?;

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

    /// ✅ CORRECTION: Recherche SQL hybride améliorée utilisant la fonction PostgreSQL
    /// Cherche dans image_analyses ET media.ai_* pour matching complet
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

        // ✅ CORRECTION: Utiliser search_query_semantic OU search_query_broad pour meilleur matching
        let search_query = if !analysis.search_query_semantic.is_empty() {
            &analysis.search_query_semantic
        } else if !analysis.search_query_broad.is_empty() {
            &analysis.search_query_broad
        } else {
            &analysis.description
        };

        log_info(&format!(
            "[HybridImageSearch] 🔍 Recherche avec {} tags, catégorie: {:?}, marque: {:?}, query: '{}'",
            analysis.tags.len(),
            category_filter,
            analysis.marque,
            &search_query.chars().take(50).collect::<String>()
        ));

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
        .bind(search_query) // ✅ CORRECTION: Utiliser search_query_semantic au lieu de description
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
            let analysis_id: Option<i32> = row.get::<Option<_>, _>("analysis_id");
            let service_id: i32 = row.get::<Option<_>, _>("service_id").unwrap_or(0);
            let media_id: Option<i32> = row.get::<Option<_>, _>("media_id");
            let product_description: String = row
                .get::<Option<_>, _>("product_description")
                .unwrap_or_default();

            let product_tags: Vec<String> = row
                .try_get::<Vec<String>, _>("product_tags")
                .unwrap_or_default();

            let product_marque: Option<String> = row.get::<Option<_>, _>("product_marque");

            let product_couleurs: Vec<String> = row
                .try_get::<Vec<String>, _>("product_couleurs")
                .unwrap_or_default();

            let match_score: f64 = row.get::<Option<_>, _>("match_score").unwrap_or(0.0);
            let distance_km: Option<f64> = row.get::<Option<_>, _>("distance_km");
            let service_data: Value = row
                .get::<Option<_>, _>("service_data")
                .unwrap_or(serde_json::json!({}));

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
            "#,
        )
        .bind(user_id)
        .bind(limit)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur historique: {}", e)))?;

        let mut history = Vec::new();
        for row in rows {
            let caracteristiques_cles_value: serde_json::Value =
                row.get::<serde_json::Value, _>("caracteristiques_cles");
            let caracteristiques_cles: std::collections::HashMap<String, String> =
                serde_json::from_value(caracteristiques_cles_value).unwrap_or_default();

            let description: String = row.get::<String, _>("description");
            let tags: Vec<String> = row.get::<Vec<String>, _>("tags");
            let category_detected: Option<String> =
                row.get::<Option<String>, _>("category_detected");
            let marque: Option<String> = row.get::<Option<String>, _>("marque");
            let couleurs: Vec<String> = row.get::<Vec<String>, _>("couleurs");
            let confiance: Option<f64> = row.get::<Option<f64>, _>("confiance");
            let search_query_exact: Option<String> =
                row.get::<Option<String>, _>("search_query_exact");
            let search_query_broad: Option<String> =
                row.get::<Option<String>, _>("search_query_broad");
            let search_query_semantic: Option<String> =
                row.get::<Option<String>, _>("search_query_semantic");

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
            "#,
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur stats: {}", e)))?;

        let stats_json: Vec<Value> = stats
            .into_iter()
            .map(|row| {
                let analysis_type: String = row.get::<String, _>("analysis_type");
                let total: Option<i64> = row.get::<Option<i64>, _>("total");
                let avg_confiance: Option<f64> = row.get::<Option<f64>, _>("avg_confiance");
                let avg_tokens: Option<f64> = row.get::<Option<f64>, _>("avg_tokens");
                let model_used: Option<String> = row.get::<Option<String>, _>("model_used");

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
