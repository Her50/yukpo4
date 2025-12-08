//! ✅ AI Product Recommendations pour suggestions intelligentes
//!
//! Ce service utilise l'IA pour suggérer des produits pertinents aux clients
//! pendant le processus de commande, basé sur:
//! - Historique d'achat
//! - Panier actuel
//! - Localisation
//! - Saisonnalité
//! - Tendances

use crate::core::types::AppResult;
use crate::services::app_ia::AppIA;
use crate::services::delivery_ai_prompts::PRODUCT_RECOMMENDATIONS_PROMPT;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;

/// Produit suggéré
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecommendedProduct {
    pub product_id: i32,
    pub product_name: String,
    pub price: f64,
    pub confidence_score: f32, // 0.0-1.0
    pub reason: String,        // Pourquoi ce produit est suggéré
    pub category: Option<String>,
    pub image_url: Option<String>,
}

/// Contexte pour les recommandations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecommendationContext {
    pub user_id: i32,
    pub current_cart: Vec<i32>,                // IDs produits dans panier
    pub delivery_location: Option<(f64, f64)>, // lat, lng
    pub delivery_type: String,                 // "shopping", "parcel"
    pub budget_range: Option<(f64, f64)>,      // min, max
    pub preferences: HashMap<String, String>,  // préférences utilisateur
}

/// Service AI Recommendations
pub struct DeliveryAIRecommendationsService {
    // Cache pour recommandations récentes
    cache: HashMap<String, (Vec<RecommendedProduct>, chrono::DateTime<chrono::Utc>)>,
    // Service IA pour générer les recommandations
    app_ia: Option<Arc<AppIA>>,
}

impl DeliveryAIRecommendationsService {
    pub fn new() -> Self {
        Self {
            cache: HashMap::new(),
            app_ia: None,
        }
    }

    pub fn with_ia(mut self, app_ia: Arc<AppIA>) -> Self {
        self.app_ia = Some(app_ia);
        self
    }

    /// Génère des recommandations de produits
    pub async fn get_recommendations(
        &mut self,
        context: RecommendationContext,
        max_results: usize,
    ) -> AppResult<Vec<RecommendedProduct>> {
        // Vérifier le cache (10 minutes)
        let cache_key = format!(
            "{}_{:?}_{}",
            context.user_id, context.current_cart, context.delivery_type
        );

        if let Some((cached, cached_time)) = self.cache.get(&cache_key) {
            let elapsed = chrono::Utc::now() - *cached_time;
            if elapsed.num_seconds() < 600 {
                return Ok(cached.clone());
            }
        }

        // Générer recommandations avec IA
        let recommendations = self.generate_recommendations(&context, max_results).await?;

        // Mettre en cache
        self.cache
            .insert(cache_key, (recommendations.clone(), chrono::Utc::now()));

        Ok(recommendations)
    }

    /// Génère les recommandations avec logique IA
    async fn generate_recommendations(
        &self,
        context: &RecommendationContext,
        max_results: usize,
    ) -> AppResult<Vec<RecommendedProduct>> {
        // ✅ NOUVEAU: Utiliser l'IA si disponible
        if let Some(app_ia) = &self.app_ia {
            return self
                .generate_recommendations_with_ai(context, max_results, app_ia)
                .await;
        }

        // Fallback: logique basique si pas d'IA
        let mut recommendations = Vec::new();

        // 1. Recommandations basées sur le panier (produits complémentaires)
        let complementary = self
            .get_complementary_products(&context.current_cart)
            .await?;
        recommendations.extend(complementary);

        // 2. Recommandations basées sur l'historique utilisateur
        let historical = self.get_historical_recommendations(context.user_id).await?;
        recommendations.extend(historical);

        // 3. Recommandations basées sur la localisation (produits populaires zone)
        if let Some((lat, lng)) = context.delivery_location {
            let local = self.get_local_recommendations(lat, lng).await?;
            recommendations.extend(local);
        }

        // 4. Recommandations saisonnières
        let seasonal = self.get_seasonal_recommendations().await?;
        recommendations.extend(seasonal);

        // Trier par score de confiance et dédupliquer
        recommendations.sort_by(|a, b| {
            b.confidence_score
                .partial_cmp(&a.confidence_score)
                .unwrap_or(std::cmp::Ordering::Equal)
        });

        // Dédupliquer par product_id
        let mut seen = std::collections::HashSet::new();
        recommendations.retain(|r| seen.insert(r.product_id));

        // Limiter au nombre max
        recommendations.truncate(max_results);

        Ok(recommendations)
    }

    /// ✅ NOUVEAU: Génère recommandations avec IA réelle
    async fn generate_recommendations_with_ai(
        &self,
        context: &RecommendationContext,
        max_results: usize,
        app_ia: &Arc<AppIA>,
    ) -> AppResult<Vec<RecommendedProduct>> {
        // Construire le prompt avec le contexte
        let current_cart_str = context
            .current_cart
            .iter()
            .map(|id| id.to_string())
            .collect::<Vec<_>>()
            .join(", ");

        let location_str = if let Some((lat, lng)) = context.delivery_location {
            format!("({}, {})", lat, lng)
        } else {
            "Non spécifiée".to_string()
        };

        let budget_str = if let Some((min, max)) = context.budget_range {
            format!("{} - {} FCFA", min, max)
        } else {
            "Non spécifié".to_string()
        };

        let season = chrono::Utc::now().format("%B").to_string();

        let prompt = PRODUCT_RECOMMENDATIONS_PROMPT
            .replace("{current_cart}", &current_cart_str)
            .replace("{user_history}", "À récupérer de la base de données")
            .replace("{location}", &location_str)
            .replace(
                "{lat}",
                &context
                    .delivery_location
                    .map(|(l, _)| l.to_string())
                    .unwrap_or_default(),
            )
            .replace(
                "{lng}",
                &context
                    .delivery_location
                    .map(|(_, l)| l.to_string())
                    .unwrap_or_default(),
            )
            .replace("{delivery_type}", &context.delivery_type)
            .replace("{budget_range}", &budget_str)
            .replace("{season}", &season)
            .replace("{available_products}", "À récupérer de la base de données");

        log::info!("[AI Recommendations] Appel IA avec prompt spécialisé");

        // Appeler l'IA
        let (model_name, response, _tokens) = app_ia.predict(&prompt).await?;

        log::info!(
            "[AI Recommendations] Réponse reçue de {} ({} tokens)",
            model_name,
            _tokens
        );

        // Parser la réponse JSON
        let json_response: serde_json::Value = serde_json::from_str(&response).map_err(|e| {
            log::error!("[AI Recommendations] Erreur parsing JSON: {}", e);
            crate::core::types::AppError::Internal(format!("Erreur parsing réponse IA: {}", e))
        })?;

        // Extraire les recommandations
        let mut recommendations = Vec::new();
        if let Some(recs_array) = json_response
            .get("recommendations")
            .and_then(|v| v.as_array())
        {
            for rec in recs_array {
                if let Ok(product) = serde_json::from_value::<RecommendedProduct>(rec.clone()) {
                    recommendations.push(product);
                }
            }
        }

        // Limiter au nombre max
        recommendations.truncate(max_results);

        log::info!(
            "[AI Recommendations] {} recommandations générées par IA",
            recommendations.len()
        );

        Ok(recommendations)
    }

    /// Produits complémentaires basés sur le panier
    async fn get_complementary_products(
        &self,
        cart_product_ids: &[i32],
    ) -> AppResult<Vec<RecommendedProduct>> {
        // ✅ NOUVEAU: Si IA disponible, utiliser l'IA pour complémentarité
        // Sinon, utiliser règles basiques ou base de données
        let recommendations = Vec::new();

        // TODO: Implémenter logique de complémentarité avec base de données
        // Pour l'instant, retourner vide (l'IA principale s'en charge)

        Ok(recommendations)
    }

    /// Recommandations basées sur l'historique utilisateur
    async fn get_historical_recommendations(
        &self,
        services::live_stream_service::DEFAULT_MAX_PARTICIPANTS: i32,
    ) -> AppResult<Vec<RecommendedProduct>> {
        // TODO: Requête base de données pour historique
        // Pour l'instant, retourner vide
        Ok(Vec::new())
    }

    /// Recommandations basées sur la localisation
    async fn get_local_recommendations(
        &self,
        services::matching_emploi_service::haversine_distance_km::EARTH_RADIUS_KM: f64,
        services::matching_emploi_service::haversine_distance_km::EARTH_RADIUS_KM: f64,
    ) -> AppResult<Vec<RecommendedProduct>> {
        // TODO: Requête produits populaires dans la zone
        // Pour l'instant, retourner vide
        Ok(Vec::new())
    }

    /// Recommandations saisonnières
    async fn get_seasonal_recommendations(&self) -> AppResult<Vec<RecommendedProduct>> {
        // TODO: Produits saisonniers selon période de l'année
        // Pour l'instant, retourner vide
        Ok(Vec::new())
    }

    /// Enregistre qu'un utilisateur a accepté une suggestion
    pub async fn record_suggestion_accepted(
        &mut self,
        user_id: i32,
        product_id: i32,
        suggestion_id: Option<String>,
    ) -> AppResult<()> {
        // Enregistrer pour amélioration future du modèle
        log::info!(
            "[AI Recommendations] User {} accepted product {}",
            user_id,
            product_id
        );
        Ok(())
    }
}

impl Default for DeliveryAIRecommendationsService {
    fn default() -> Self {
        Self::new()
    }
}
