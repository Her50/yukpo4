use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::Json as ResponseJson,
    routing::get,
    Router,
};
use serde::Serialize;
use sqlx::Row;
use std::collections::HashMap;
use std::sync::Arc;

use crate::state::AppState;

#[derive(Debug, Serialize)]
pub struct ABTestStat {
    pub variant_id: String,
    pub variant_name: String,
    pub views: i32,
    pub clicks: i32,
    pub conversions: i32,
    pub ctr: f64,
    pub conversion_rate: f64,
    pub cpc: f64,
    pub roi: f64,
    pub confidence_interval: ConfidenceInterval,
    pub statistical_significance: f64,
    pub is_winner: bool,
    pub recommendation: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ConfidenceInterval {
    pub lower: f64,
    pub upper: f64,
}

#[derive(Debug, Serialize)]
pub struct ABTestStatsResponse {
    pub stats: Vec<ABTestStat>,
}

/// Calculer les statistiques A/B testing pour une campagne
pub async fn get_ab_test_stats(
    State(state): State<Arc<AppState>>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<ResponseJson<ABTestStatsResponse>, StatusCode> {
    let pool = &state.pg;
    let campaign_id: i32 = params
        .get("campaign_id")
        .and_then(|v| v.parse().ok())
        .unwrap_or(0);

    if campaign_id == 0 {
        return Err(StatusCode::BAD_REQUEST);
    }

    // Récupérer les données A/B testing de la campagne
    let query = r#"
        SELECT 
            ab_testing
        FROM publicites
        WHERE id = $1
    "#;

    match sqlx::query(query)
        .bind(campaign_id)
        .fetch_optional(pool)
        .await
    {
        Ok(Some(row)) => {
            // Parser les données A/B testing
            let ab_testing: Option<serde_json::Value> = row.get("ab_testing");

            if let Some(ab_data) = ab_testing {
                // Extraire les variantes et leurs performances
                let variants = ab_data.get("variants").and_then(|v| v.as_array());

                if let Some(variants_array) = variants {
                    let mut stats = Vec::new();

                    for (idx, variant) in variants_array.iter().enumerate() {
                        let variant_id = variant
                            .get("id")
                            .and_then(|v| v.as_str())
                            .unwrap_or(&format!("variant_{}", idx))
                            .to_string();
                        let variant_name = variant
                            .get("titre")
                            .and_then(|v| v.as_str())
                            .unwrap_or(&format!("Variante {}", idx + 1))
                            .to_string();

                        // Récupérer les performances depuis la base de données
                        // Pour l'instant, on simule les données
                        let views = variant
                            .get("performance")
                            .and_then(|p| p.get("views"))
                            .and_then(|v| v.as_i64())
                            .unwrap_or(0) as i32;
                        let clicks = variant
                            .get("performance")
                            .and_then(|p| p.get("clicks"))
                            .and_then(|c| c.as_i64())
                            .unwrap_or(0) as i32;
                        let conversions = variant
                            .get("performance")
                            .and_then(|p| p.get("conversions"))
                            .and_then(|c| c.as_i64())
                            .unwrap_or(0) as i32;

                        let ctr = if views > 0 {
                            (clicks as f64 / views as f64) * 100.0
                        } else {
                            0.0
                        };

                        let conversion_rate = if clicks > 0 {
                            (conversions as f64 / clicks as f64) * 100.0
                        } else {
                            0.0
                        };

                        let cpc = if clicks > 0 {
                            // TODO: Récupérer le coût réel depuis la campagne
                            100.0
                        } else {
                            0.0
                        };

                        let roi = if conversions > 0 {
                            // TODO: Calculer le ROI réel
                            150.0
                        } else {
                            0.0
                        };

                        // Calculer l'intervalle de confiance (simplifié)
                        let confidence_interval = ConfidenceInterval {
                            lower: ctr * 0.9,
                            upper: ctr * 1.1,
                        };

                        // Calculer la significativité statistique (simplifié)
                        // En production, utiliser un test t ou chi-square
                        let statistical_significance = if views >= 1000 && clicks >= 50 {
                            0.85 + (idx as f64 * 0.05).min(0.1)
                        } else {
                            0.5
                        };

                        // Déterminer le gagnant (celui avec le meilleur CTR)
                        let is_winner = idx == 0; // Simplifié, en production comparer toutes les variantes

                        let recommendation = if is_winner {
                            Some("Variante recommandée - Meilleure performance".to_string())
                        } else if statistical_significance < 0.8 {
                            Some("Continuer le test - Données insuffisantes".to_string())
                        } else {
                            Some("Variante alternative".to_string())
                        };

                        stats.push(ABTestStat {
                            variant_id,
                            variant_name,
                            views,
                            clicks,
                            conversions,
                            ctr,
                            conversion_rate,
                            cpc,
                            roi,
                            confidence_interval,
                            statistical_significance,
                            is_winner,
                            recommendation,
                        });
                    }

                    // Trier par performance (CTR décroissant)
                    stats.sort_by(|a, b| {
                        b.ctr
                            .partial_cmp(&a.ctr)
                            .unwrap_or(std::cmp::Ordering::Equal)
                    });

                    // Marquer le meilleur comme gagnant
                    if let Some(first) = stats.first_mut() {
                        first.is_winner = true;
                    }

                    Ok(ResponseJson(ABTestStatsResponse { stats }))
                } else {
                    // Pas de variantes, retourner une liste vide
                    Ok(ResponseJson(ABTestStatsResponse { stats: vec![] }))
                }
            } else {
                Ok(ResponseJson(ABTestStatsResponse { stats: vec![] }))
            }
        }
        Err(e) => {
            log::error!("[get_ab_test_stats] Erreur DB: {:?}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
        Ok(None) => Ok(ResponseJson(ABTestStatsResponse { stats: vec![] })),
    }
}

pub fn publicite_ab_testing_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::<Arc<AppState>>::new()
        .route("/api/publicites/ab-testing/stats", get(get_ab_test_stats))
        .with_state(state)
}
