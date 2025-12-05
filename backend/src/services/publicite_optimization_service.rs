use log;
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OptimizationSuggestion {
    pub suggestion_type: String, // "budget", "targeting", "schedule", "placement", "bid_strategy"
    pub priority: String,        // "high", "medium", "low"
    pub title: String,
    pub description: String,
    pub current_value: Option<serde_json::Value>,
    pub suggested_value: serde_json::Value,
    pub expected_improvement: f64, // Pourcentage d'amélioration attendu
    pub confidence: f64,           // Niveau de confiance (0-1)
}

#[derive(Debug, Serialize)]
pub struct OptimizationReport {
    pub campaign_id: i32,
    pub campaign_title: String,
    pub suggestions: Vec<OptimizationSuggestion>,
    pub overall_score: f64,        // Score de performance global (0-100)
    pub performance_trend: String, // "improving", "stable", "declining"
    pub risk_level: String,        // "low", "medium", "high"
}

/// Analyse une publicité et génère des suggestions d'optimisation
pub async fn analyze_and_suggest(
    pool: &PgPool,
    campaign_id: i32,
) -> Result<OptimizationReport, sqlx::Error> {
    // Récupérer les données de la publicité
    let pub_row = sqlx::query(
        r#"
        SELECT 
            id, titre, vues, clics, impressions, cout, status,
            targeting, ab_testing, schedule, placements, bid_strategy,
            date_debut, date_fin, created_at
        FROM publicites
        WHERE id = $1
        "#,
    )
    .bind(campaign_id)
    .fetch_one(pool)
    .await?;

    let titre: String = pub_row.get::<String, _>("titre");
    let vues: i32 = pub_row.get::<Option<i32>, _>("vues").unwrap_or(0);
    let clics: i32 = pub_row.get::<Option<i32>, _>("clics").unwrap_or(0);
    let impressions: i32 = pub_row.get::<Option<i32>, _>("impressions").unwrap_or(0);
    let cout: i32 = pub_row.get::<Option<i32>, _>("cout").unwrap_or(0);
    let status: String = pub_row.get::<String, _>("status");
    let targeting: serde_json::Value = pub_row
        .get::<Option<serde_json::Value>, _>("targeting")
        .unwrap_or(serde_json::json!({}));
    let schedule: Option<serde_json::Value> =
        pub_row.get::<Option<serde_json::Value>, _>("schedule");
    let placements: serde_json::Value = pub_row
        .get::<Option<serde_json::Value>, _>("placements")
        .unwrap_or(serde_json::json!([]));
    let bid_strategy: serde_json::Value = pub_row
        .get::<Option<serde_json::Value>, _>("bid_strategy")
        .unwrap_or(serde_json::json!({}));

    let mut suggestions = Vec::new();

    // 1. Analyse du budget
    if let Some(budget_suggestion) =
        analyze_budget(pool, campaign_id, vues, clics, cout, impressions).await?
    {
        suggestions.push(budget_suggestion);
    }

    // 2. Analyse du ciblage
    if let Some(targeting_suggestion) =
        analyze_targeting(pool, campaign_id, &targeting, vues, clics).await?
    {
        suggestions.push(targeting_suggestion);
    }

    // 3. Analyse de la planification
    if let Some(schedule_suggestion) = analyze_schedule(&schedule, vues, clics).await? {
        suggestions.push(schedule_suggestion);
    }

    // 4. Analyse des placements
    if let Some(placement_suggestion) = analyze_placements(pool, campaign_id, &placements).await? {
        suggestions.push(placement_suggestion);
    }

    // 5. Analyse de la stratégie d'enchères
    if let Some(bid_suggestion) = analyze_bid_strategy(&bid_strategy, vues, clics, cout).await? {
        suggestions.push(bid_suggestion);
    }

    // Calculer le score global et la tendance
    let overall_score = calculate_overall_score(vues, clics, impressions, cout);
    let performance_trend = calculate_trend(pool, campaign_id).await?;
    let risk_level = calculate_risk_level(&suggestions, overall_score);

    Ok(OptimizationReport {
        campaign_id,
        campaign_title: titre,
        suggestions,
        overall_score,
        performance_trend,
        risk_level,
    })
}

/// Analyse le budget et suggère des optimisations
async fn analyze_budget(
    pool: &PgPool,
    campaign_id: i32,
    vues: i32,
    clics: i32,
    cout: i32,
    impressions: i32,
) -> Result<Option<OptimizationSuggestion>, sqlx::Error> {
    // Calculer le coût par clic (CPC)
    let cpc = if clics > 0 {
        (cout as f64) / (clics as f64)
    } else {
        f64::MAX
    };

    // Comparer avec la moyenne des autres campagnes du même utilisateur
    let avg_cpc_row = sqlx::query(
        r#"
        SELECT 
            AVG(CASE WHEN clics > 0 THEN cout::float / clics::float ELSE NULL END) as avg_cpc
        FROM publicites
        WHERE user_id = (SELECT user_id FROM publicites WHERE id = $1)
        AND id != $1
        AND clics > 0
        "#,
    )
    .bind(campaign_id)
    .fetch_optional(pool)
    .await?;

    if let Some(row) = avg_cpc_row {
        let avg_cpc: Option<f64> = row.try_get::<Option<f64>, _>("avg_cpc").ok().flatten();
        if let Some(avg) = avg_cpc {
            if cpc > avg * 1.5 {
                // CPC trop élevé, suggérer de réduire le budget ou améliorer le ciblage
                let suggested_reduction = (cout as f64 * 0.2) as i32;
                return Ok(Some(OptimizationSuggestion {
                    suggestion_type: "budget".to_string(),
                    priority: "high".to_string(),
                    title: "Budget trop élevé par rapport aux performances".to_string(),
                    description: format!(
                        "Votre CPC ({:.2} FCFA) est {}% plus élevé que la moyenne. Réduire le budget de {} FCFA pourrait améliorer l'efficacité.",
                        cpc,
                        ((cpc / avg - 1.0) * 100.0) as i32,
                        suggested_reduction
                    ),
                    current_value: Some(serde_json::json!({ "cout": cout })),
                    suggested_value: serde_json::json!({ "cout": cout - suggested_reduction }),
                    expected_improvement: 15.0,
                    confidence: 0.75,
                }));
            }
        }
    }

    // Vérifier si le budget est sous-utilisé
    if impressions > 0 && vues < impressions / 2 {
        let suggested_increase = (cout as f64 * 0.3) as i32;
        return Ok(Some(OptimizationSuggestion {
            suggestion_type: "budget".to_string(),
            priority: "medium".to_string(),
            title: "Budget sous-utilisé".to_string(),
            description: format!(
                "Votre campagne pourrait bénéficier d'une augmentation de budget de {} FCFA pour atteindre plus d'utilisateurs.",
                suggested_increase
            ),
            current_value: Some(serde_json::json!({ "cout": cout })),
            suggested_value: serde_json::json!({ "cout": cout + suggested_increase }),
            expected_improvement: 25.0,
            confidence: 0.65,
        }));
    }

    Ok(None)
}

/// Analyse le ciblage et suggère des optimisations
async fn analyze_targeting(
    pool: &PgPool,
    campaign_id: i32,
    targeting: &serde_json::Value,
    vues: i32,
    clics: i32,
) -> Result<Option<OptimizationSuggestion>, sqlx::Error> {
    let conversion_rate = if vues > 0 {
        (clics as f64 / vues as f64) * 100.0
    } else {
        0.0
    };

    // Si le taux de conversion est faible (< 2%), suggérer d'affiner le ciblage
    if conversion_rate < 2.0 && targeting.is_object() {
        let targeting_obj = targeting.as_object().unwrap();

        // Vérifier si le ciblage est trop large
        if targeting_obj.get("gender").is_none() || targeting_obj.get("age_range").is_none() {
            return Ok(Some(OptimizationSuggestion {
                suggestion_type: "targeting".to_string(),
                priority: "high".to_string(),
                title: "Ciblage trop large".to_string(),
                description: "Votre ciblage est trop général. Ajouter des critères d'âge et de genre pourrait améliorer le taux de conversion de 20-30%.".to_string(),
                current_value: Some(targeting.clone()),
                suggested_value: serde_json::json!({
                    "age_range": { "min": 25, "max": 45 },
                    "gender": "all",
                    "interests": targeting_obj.get("interests").cloned().unwrap_or(serde_json::json!([])),
                    "behaviors": targeting_obj.get("behaviors").cloned().unwrap_or(serde_json::json!([]))
                }),
                expected_improvement: 25.0,
                confidence: 0.70,
            }));
        }
    }

    Ok(None)
}

/// Analyse la planification et suggère des optimisations
async fn analyze_schedule(
    schedule: &Option<serde_json::Value>,
    vues: i32,
    clics: i32,
) -> Result<Option<OptimizationSuggestion>, sqlx::Error> {
    // Si pas de planification, suggérer d'en ajouter une
    if schedule.is_none() || schedule.as_ref().unwrap().is_null() {
        return Ok(Some(OptimizationSuggestion {
            suggestion_type: "schedule".to_string(),
            priority: "medium".to_string(),
            title: "Ajouter une planification".to_string(),
            description: "Planifier votre campagne pour les heures de pointe (9h-12h, 18h-21h) pourrait augmenter les vues de 30-40%.".to_string(),
            current_value: None,
            suggested_value: serde_json::json!({
                "start_time": "09:00",
                "end_time": "21:00",
                "pause_on_weekends": false
            }),
            expected_improvement: 35.0,
            confidence: 0.80,
        }));
    }

    Ok(None)
}

/// Analyse les placements et suggère des optimisations
async fn analyze_placements(
    pool: &PgPool,
    campaign_id: i32,
    placements: &serde_json::Value,
) -> Result<Option<OptimizationSuggestion>, sqlx::Error> {
    let placements_array = placements.as_array();

    if placements_array.is_none() || placements_array.unwrap().is_empty() {
        // Pas de placements spécifiques, suggérer d'en ajouter
        return Ok(Some(OptimizationSuggestion {
            suggestion_type: "placement".to_string(),
            priority: "medium".to_string(),
            title: "Optimiser les placements".to_string(),
            description: "Cibler spécifiquement le feed principal et les stories pourrait améliorer les performances de 20-25%.".to_string(),
            current_value: Some(placements.clone()),
            suggested_value: serde_json::json!([
                { "type": "feed", "budget": 60 },
                { "type": "stories", "budget": 40 }
            ]),
            expected_improvement: 22.0,
            confidence: 0.75,
        }));
    }

    // Analyser les performances par placement
    let placement_perf = sqlx::query(
        r#"
        SELECT 
            jsonb_array_elements(placements)->>'type' as placement,
            AVG(CASE WHEN vues > 0 THEN (clics::float / vues::float) * 100.0 ELSE 0.0 END) as avg_conversion
        FROM publicites
        WHERE user_id = (SELECT user_id FROM publicites WHERE id = $1)
        AND placements IS NOT NULL
        GROUP BY placement
        ORDER BY avg_conversion DESC
        LIMIT 3
        "#,
    )
    .bind(campaign_id)
    .fetch_all(pool)
    .await?;

    if !placement_perf.is_empty() {
        let best_placement: String = placement_perf[0].get::<String, _>("placement");
        let best_conversion: f64 = placement_perf[0]
            .get::<Option<f64>, _>("avg_conversion")
            .unwrap_or(0.0);

        // Vérifier si le meilleur placement est utilisé
        let current_placements: Vec<String> = placements_array
            .unwrap()
            .iter()
            .filter_map(|p| {
                p.get("type")
                    .and_then(|t| t.as_str())
                    .map(|s| s.to_string())
            })
            .collect();

        if !current_placements.contains(&best_placement) {
            return Ok(Some(OptimizationSuggestion {
                suggestion_type: "placement".to_string(),
                priority: "high".to_string(),
                title: format!("Utiliser le placement '{}'", best_placement),
                description: format!(
                    "Le placement '{}' a un taux de conversion moyen de {:.2}% dans vos autres campagnes. L'ajouter pourrait améliorer les performances.",
                    best_placement, best_conversion
                ),
                current_value: Some(placements.clone()),
                suggested_value: {
                    let mut new_placements = placements_array.unwrap().clone();
                    new_placements.push(serde_json::json!({
                        "type": best_placement,
                        "budget": 30
                    }));
                    serde_json::Value::Array(new_placements)
                },
                expected_improvement: (best_conversion * 0.5).min(30.0),
                confidence: 0.70,
            }));
        }
    }

    Ok(None)
}

/// Analyse la stratégie d'enchères et suggère des optimisations
async fn analyze_bid_strategy(
    bid_strategy: &serde_json::Value,
    vues: i32,
    clics: i32,
    cout: i32,
) -> Result<Option<OptimizationSuggestion>, sqlx::Error> {
    let strategy_type = bid_strategy
        .get("type")
        .and_then(|v| v.as_str())
        .unwrap_or("auto");

    // Si stratégie auto mais performances faibles, suggérer CPC manuel
    if strategy_type == "auto" && vues > 0 {
        let ctr = (clics as f64 / vues as f64) * 100.0;
        if ctr < 1.0 {
            return Ok(Some(OptimizationSuggestion {
                suggestion_type: "bid_strategy".to_string(),
                priority: "medium".to_string(),
                title: "Passer à une stratégie CPC manuelle".to_string(),
                description: "Votre CTR est faible. Une stratégie CPC manuelle avec un montant optimisé pourrait améliorer les performances.".to_string(),
                current_value: Some(bid_strategy.clone()),
                suggested_value: serde_json::json!({
                    "type": "cpc",
                    "bid_amount": 50
                }),
                expected_improvement: 15.0,
                confidence: 0.65,
            }));
        }
    }

    Ok(None)
}

/// Calcule le score global de performance (0-100)
fn calculate_overall_score(vues: i32, clics: i32, impressions: i32, cout: i32) -> f64 {
    let mut score = 0.0;

    // Score basé sur le taux de conversion (40%)
    if vues > 0 {
        let conversion_rate = (clics as f64 / vues as f64) * 100.0;
        score += (conversion_rate / 10.0).min(40.0); // Max 40 points pour 10% de conversion
    }

    // Score basé sur le CTR (30%)
    if impressions > 0 {
        let ctr = (vues as f64 / impressions as f64) * 100.0;
        score += (ctr / 5.0).min(30.0); // Max 30 points pour 5% de CTR
    }

    // Score basé sur l'efficacité du budget (30%)
    if clics > 0 && cout > 0 {
        let cpc = (cout as f64) / (clics as f64);
        // Moins le CPC est élevé, meilleur est le score
        let efficiency = (1000.0 / cpc).min(30.0);
        score += efficiency;
    }

    score.min(100.0)
}

/// Calcule la tendance de performance
async fn calculate_trend(pool: &PgPool, campaign_id: i32) -> Result<String, sqlx::Error> {
    // Comparer les performances récentes avec les performances globales
    let recent_perf = sqlx::query(
        r#"
        SELECT 
            AVG(CASE WHEN vues > 0 THEN (clics::float / vues::float) * 100.0 ELSE 0.0 END) as recent_conversion
        FROM publicites
        WHERE id = $1
        AND created_at >= NOW() - INTERVAL '7 days'
        "#,
    )
    .bind(campaign_id)
    .fetch_optional(pool)
    .await?;

    // Pour simplifier, on retourne "stable" par défaut
    // Dans une implémentation complète, on comparerait avec les performances historiques
    Ok("stable".to_string())
}

/// Calcule le niveau de risque
fn calculate_risk_level(suggestions: &[OptimizationSuggestion], overall_score: f64) -> String {
    let high_priority_count = suggestions.iter().filter(|s| s.priority == "high").count();

    if overall_score < 30.0 || high_priority_count >= 3 {
        "high".to_string()
    } else if overall_score < 60.0 || high_priority_count >= 1 {
        "medium".to_string()
    } else {
        "low".to_string()
    }
}

/// Génère un rapport d'optimisation pour toutes les campagnes d'un utilisateur
pub async fn generate_user_optimization_report(
    pool: &PgPool,
    user_id: i32,
) -> Result<Vec<OptimizationReport>, sqlx::Error> {
    // Récupérer toutes les campagnes actives de l'utilisateur
    let campaigns = sqlx::query(
        r#"
        SELECT id
        FROM publicites
        WHERE user_id = $1
        AND status = 'active'
        ORDER BY created_at DESC
        LIMIT 20
        "#,
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;

    let mut reports = Vec::new();
    for row in campaigns {
        let campaign_id: i32 = row.get::<i32, _>("id");
        match analyze_and_suggest(pool, campaign_id).await {
            Ok(report) => reports.push(report),
            Err(e) => {
                log::error!("Erreur analyse campagne {}: {:?}", campaign_id, e);
            }
        }
    }

    Ok(reports)
}
