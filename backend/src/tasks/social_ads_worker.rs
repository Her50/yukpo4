// Worker Meta Ads — Monitoring et optimisation automatique des campagnes
// Toutes les heures: sync métriques, pause si budget dépassé, boost si ROAS élevé

use std::sync::Arc;
use tokio::time::{interval, Duration};

use crate::services::meta_ads_service::{
    self, fetch_campaign_insights, update_adset_budget, update_campaign_status,
};
use crate::state::AppState;
use sqlx::Row;

pub fn start_social_ads_worker(state: Arc<AppState>) {
    tokio::spawn(async move {
        log::info!("[AdsWorker] 📊 Démarrage du worker Meta Ads");

        // Sync métriques toutes les heures
        let mut ticker = interval(Duration::from_secs(3600));
        loop {
            ticker.tick().await;
            if let Err(e) = sync_all_campaigns_metrics(&state).await {
                log::error!("[AdsWorker] Erreur sync métriques: {}", e);
            }
            if let Err(e) = check_budget_rules(&state).await {
                log::error!("[AdsWorker] Erreur vérification budget: {}", e);
            }
            if let Err(e) = process_automation_rules(&state).await {
                log::error!("[AdsWorker] Erreur rules automation: {}", e);
            }
        }
    });
}

/// Synchronise les métriques de toutes les campagnes actives
async fn sync_all_campaigns_metrics(state: &Arc<AppState>) -> Result<(), String> {
    let campaigns = sqlx::query(
        r#"SELECT c.id, c.external_campaign_id, c.user_id,
                  a.access_token, a.currency
           FROM meta_ad_campaigns c
           JOIN meta_ad_accounts a ON a.id = c.ad_account_id
           WHERE c.status = 'active'
             AND c.external_campaign_id IS NOT NULL"#,
    )
    .fetch_all(&state.pg)
    .await
    .map_err(|e| e.to_string())?;

    log::info!(
        "[AdsWorker] Sync métriques pour {} campagnes actives",
        campaigns.len()
    );

    for campaign in &campaigns {
        let campaign_id: i32 = campaign.try_get("id").unwrap_or(0);
        let ext_id_opt: Option<String> = campaign.try_get("external_campaign_id").ok().flatten();
        let campaign_user_id: i32 = campaign.try_get("user_id").unwrap_or(0);
        let access_token_opt: Option<String> = campaign.try_get("access_token").ok().flatten();

        if let (Some(ext_id), Some(token)) = (ext_id_opt, access_token_opt) {
            match fetch_campaign_insights(&ext_id, &token, "today").await {
                Ok(perf) => {
                    // Mettre à jour les métriques en BDD
                    let _ = sqlx::query(
                        r#"UPDATE meta_ad_campaigns
                           SET impressions = $1,
                               clicks = $2,
                               spent_fcfa = $3,
                               cpm_fcfa = $4,
                               cpc_fcfa = $5,
                               roas = $6,
                               conversions = $7,
                               updated_at = NOW()
                           WHERE id = $8"#,
                    )
                    .bind(perf.impressions)
                    .bind(perf.clicks)
                    .bind(perf.spend_fcfa)
                    .bind(perf.cpm as f64)
                    .bind(perf.cpc as f64)
                    .bind(perf.roas as f64)
                    .bind(perf.conversions)
                    .bind(campaign_id)
                    .execute(&state.pg)
                    .await;

                    // Log journalier des dépenses
                    let _ = sqlx::query(
                        r#"INSERT INTO meta_ads_spend_log
                           (user_id, campaign_id, date, spend_fcfa, impressions, clicks, conversions)
                           VALUES ($1, $2, CURRENT_DATE, $3, $4, $5, $6)
                           ON CONFLICT (campaign_id, date)
                           DO UPDATE SET
                             spend_fcfa = EXCLUDED.spend_fcfa,
                             impressions = EXCLUDED.impressions,
                             clicks = EXCLUDED.clicks,
                             conversions = EXCLUDED.conversions"#,
                    )
                    .bind(campaign_user_id)
                    .bind(campaign_id)
                    .bind(perf.spend_fcfa)
                    .bind(perf.impressions)
                    .bind(perf.clicks)
                    .bind(perf.conversions)
                    .execute(&state.pg)
                    .await;
                }
                Err(e) => {
                    log::warn!("[AdsWorker] Erreur fetch insights pour {}: {}", ext_id, e);
                }
            }
        }
    }

    Ok(())
}

/// Vérifie les budgets et met en pause les campagnes qui dépassent le budget mensuel
async fn check_budget_rules(state: &Arc<AppState>) -> Result<(), String> {
    // Comptes qui ont dépassé leur budget mensuel
    let over_budget = sqlx::query(
        r#"SELECT a.id, a.user_id, a.ad_account_id, a.access_token,
                  a.monthly_budget_fcfa, a.monthly_spent_fcfa
           FROM meta_ad_accounts a
           WHERE a.monthly_budget_fcfa > 0
             AND a.monthly_spent_fcfa >= a.monthly_budget_fcfa"#,
    )
    .fetch_all(&state.pg)
    .await
    .map_err(|e| e.to_string())?;

    for account in &over_budget {
        let account_id: i32 = account.try_get("id").unwrap_or(0);
        let ext_account_id: String = account.try_get("ad_account_id").unwrap_or_default();
        let monthly_spent: i64 = account.try_get("monthly_spent_fcfa").unwrap_or(0);
        let monthly_budget: i64 = account.try_get("monthly_budget_fcfa").unwrap_or(0);
        let access_token_opt: Option<String> = account.try_get("access_token").ok().flatten();

        log::warn!(
            "[AdsWorker] Budget mensuel dépassé pour account {} (dépensé: {} / max: {} FCFA)",
            ext_account_id,
            monthly_spent,
            monthly_budget
        );

        // Mettre en pause toutes les campagnes actives du compte
        let active_campaigns = sqlx::query(
            "SELECT external_campaign_id FROM meta_ad_campaigns WHERE ad_account_id = $1 AND status = 'active'",
        )
        .bind(account_id)
        .fetch_all(&state.pg)
        .await
        .unwrap_or_default();

        for campaign in &active_campaigns {
            let ext_id_opt: Option<String> =
                campaign.try_get("external_campaign_id").ok().flatten();
            if let Some(ext_id) = ext_id_opt {
                if let Some(ref token) = access_token_opt {
                    let _ = update_campaign_status(&ext_id, token, "PAUSED").await;
                    let _ = sqlx::query(
                        "UPDATE meta_ad_campaigns SET status = 'paused', updated_at = NOW() WHERE external_campaign_id = $1",
                    )
                    .bind(&ext_id)
                    .execute(&state.pg)
                    .await;
                }
            }
        }
    }

    Ok(())
}

/// Traite les règles d'automatisation (ex: créer campagne quand nouvelle promo)
async fn process_automation_rules(state: &Arc<AppState>) -> Result<(), String> {
    let rules = sqlx::query(
        r#"SELECT r.id, r.user_id, r.service_id, r.ad_account_id,
                  r.trigger_event, r.trigger_config, r.action_type, r.action_config,
                  r.max_daily_budget_fcfa, r.max_monthly_budget_fcfa,
                  a.ad_account_id as ext_account_id, a.access_token, a.currency
           FROM meta_ads_automation_rules r
           LEFT JOIN meta_ad_accounts a ON a.id = r.ad_account_id
           WHERE r.is_active = true
             AND (r.last_triggered_at IS NULL
                  OR r.last_triggered_at < NOW() - INTERVAL '1 hour')"#,
    )
    .fetch_all(&state.pg)
    .await
    .map_err(|e| e.to_string())?;

    for rule in &rules {
        let rule_id: i32 = rule.try_get("id").unwrap_or(0);
        let rule_user_id: i32 = rule.try_get("user_id").unwrap_or(0);
        let rule_service_id: i32 = rule.try_get("service_id").unwrap_or(0);
        let rule_ad_account_id: Option<i32> = rule.try_get("ad_account_id").ok().flatten();
        let trigger_event: String = rule.try_get("trigger_event").unwrap_or_default();
        let trigger_config: Option<serde_json::Value> =
            rule.try_get("trigger_config").ok().flatten();
        let action_type: String = rule.try_get("action_type").unwrap_or_default();
        let max_daily_budget: i64 = rule.try_get("max_daily_budget_fcfa").unwrap_or(0);
        let access_token: Option<String> = rule.try_get("access_token").ok().flatten();

        let triggered = match trigger_event.as_str() {
            "new_promo" => check_new_promos_trigger(&state.pg, rule_service_id).await,
            "daily_schedule" => is_scheduled_time(&trigger_config),
            "low_roas" => check_low_roas_trigger(&state.pg, rule_ad_account_id).await,
            _ => false,
        };

        if triggered {
            log::info!(
                "[AdsWorker] Règle {} déclenchée pour user={} service={}",
                trigger_event,
                rule_user_id,
                rule_service_id
            );

            // Exécuter l'action
            match action_type.as_str() {
                "create_promo_campaign" => {
                    // Récupérer les promos actives et créer une campagne
                    let _ = auto_create_promo_campaigns(
                        state,
                        rule_user_id,
                        rule_service_id,
                        rule_ad_account_id,
                        max_daily_budget,
                    )
                    .await;
                }
                "pause_low_roas" => {
                    // Mettre en pause les campagnes avec ROAS < 1.0
                    let _ = pause_low_performance_campaigns(
                        &state.pg,
                        rule_user_id,
                        access_token.as_deref(),
                    )
                    .await;
                }
                "increase_budget" => {
                    // Augmenter le budget des campagnes performantes
                    let _ = boost_high_roas_campaigns(
                        &state.pg,
                        rule_user_id,
                        access_token.as_deref(),
                        1.2, // +20%
                    )
                    .await;
                }
                _ => {}
            }

            // Mettre à jour last_triggered_at
            let _ = sqlx::query(
                "UPDATE meta_ads_automation_rules SET last_triggered_at = NOW(), trigger_count = trigger_count + 1 WHERE id = $1",
            )
            .bind(rule_id)
            .execute(&state.pg)
            .await;
        }
    }

    Ok(())
}

async fn auto_create_promo_campaigns(
    state: &Arc<AppState>,
    user_id: i32,
    service_id: i32,
    ad_account_db_id: Option<i32>,
    budget_daily: i64,
) -> Result<(), String> {
    let account = meta_ads_service::load_ad_account(&state.pg, user_id, service_id)
        .await
        .ok_or("Compte publicitaire non configuré")?;

    // Produits en promotion actifs
    let promos = sqlx::query(
        r#"SELECT id, name, price, sale_price, image_url
           FROM service_products
           WHERE service_id = $1 AND is_active = true AND sale_price IS NOT NULL
             AND sale_price < price
           LIMIT 5"#,
    )
    .bind(service_id)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| e.to_string())?;

    let service_row = sqlx::query("SELECT name, phone FROM services WHERE id = $1")
        .bind(service_id)
        .fetch_optional(&state.pg)
        .await
        .ok()
        .flatten();

    let store_name_owned: String = service_row
        .as_ref()
        .and_then(|r| r.try_get::<String, _>("name").ok())
        .unwrap_or_else(|| "Boutique".to_string());
    let store_name = store_name_owned.as_str();
    let targeting = meta_ads_service::TargetingSpec::default();

    for promo in &promos {
        let promo_id: i32 = promo.try_get("id").unwrap_or(0);
        let promo_name: String = promo.try_get("name").unwrap_or_default();
        let promo_price: Option<f64> = promo.try_get("price").ok().flatten();
        let sale_price_opt: Option<f64> = promo.try_get("sale_price").ok().flatten();
        let image_url_opt: Option<String> = promo.try_get("image_url").ok().flatten();

        if let Some(sale_price) = sale_price_opt {
            let yukpo_url = format!(
                "https://yukpomnang.com/produit/{}?utm_source=meta_ads&utm_medium=promo",
                promo_id
            );

            match meta_ads_service::create_promo_campaign(
                &account,
                &promo_name,
                image_url_opt.as_deref(),
                promo_price.unwrap_or(0.0),
                sale_price,
                &yukpo_url,
                budget_daily,
                &targeting,
                store_name,
            )
            .await
            {
                Ok(created) => {
                    // Enregistrer la campagne en BDD
                    let _ = sqlx::query(
                        r#"INSERT INTO meta_ad_campaigns
                           (user_id, service_id, ad_account_id, external_campaign_id, name,
                            objective, campaign_type, status, budget_daily_fcfa, target_product_ids)
                           VALUES ($1, $2, $3, $4, $5, 'OUTCOME_SALES', 'auto_promo', 'active', $6, $7)"#,
                    )
                    .bind(user_id)
                    .bind(service_id)
                    .bind(ad_account_db_id)
                    .bind(&created.external_campaign_id)
                    .bind(format!("Auto-promo: {}", promo_name))
                    .bind(budget_daily)
                    .bind(&[promo_id][..])
                    .execute(&state.pg)
                    .await;

                    log::info!(
                        "[AdsWorker] ✅ Campagne auto-promo créée pour produit {}",
                        promo_name
                    );
                }
                Err(e) => log::error!("[AdsWorker] Erreur création campagne promo: {}", e),
            }
        }
    }

    Ok(())
}

async fn pause_low_performance_campaigns(
    pg: &sqlx::PgPool,
    user_id: i32,
    access_token: Option<&str>,
) -> Result<(), String> {
    let token = access_token.ok_or("Token manquant")?;
    let low_roas = sqlx::query(
        r#"SELECT external_campaign_id FROM meta_ad_campaigns
           WHERE user_id = $1 AND status = 'active'
             AND roas IS NOT NULL AND roas < 0.5
             AND spent_fcfa > 2000"#,
    )
    .bind(user_id)
    .fetch_all(pg)
    .await
    .unwrap_or_default();

    for c in &low_roas {
        let ext_id_opt: Option<String> = c.try_get("external_campaign_id").ok().flatten();
        if let Some(ext_id) = ext_id_opt {
            let _ = update_campaign_status(&ext_id, token, "PAUSED").await;
            let _ = sqlx::query(
                "UPDATE meta_ad_campaigns SET status = 'paused' WHERE external_campaign_id = $1",
            )
            .bind(&ext_id)
            .execute(pg)
            .await;
            log::info!("[AdsWorker] Campagne {} mise en pause (ROAS < 0.5)", ext_id);
        }
    }
    Ok(())
}

async fn boost_high_roas_campaigns(
    pg: &sqlx::PgPool,
    user_id: i32,
    access_token: Option<&str>,
    multiplier: f64,
) -> Result<(), String> {
    let _token = access_token.ok_or("Token manquant")?;
    let high_roas = sqlx::query(
        r#"SELECT external_campaign_id, budget_daily_fcfa FROM meta_ad_campaigns
           WHERE user_id = $1 AND status = 'active'
             AND roas IS NOT NULL AND roas > 3.0
             AND budget_daily_fcfa IS NOT NULL"#,
    )
    .bind(user_id)
    .fetch_all(pg)
    .await
    .unwrap_or_default();

    for c in &high_roas {
        let ext_id_opt: Option<String> = c.try_get("external_campaign_id").ok().flatten();
        let budget_opt: Option<i64> = c.try_get("budget_daily_fcfa").ok().flatten();
        if let (Some(ext_id), Some(budget)) = (ext_id_opt, budget_opt) {
            let new_budget = (budget as f64 * multiplier) as i64;
            // Chercher l'adset associé pour update le budget
            log::info!(
                "[AdsWorker] Campagne {} boostée (ROAS > 3) budget {} → {} FCFA",
                ext_id,
                budget,
                new_budget
            );
            let _ = sqlx::query(
                "UPDATE meta_ad_campaigns SET budget_daily_fcfa = $1 WHERE external_campaign_id = $2",
            )
            .bind(new_budget)
            .bind(&ext_id)
            .execute(pg)
            .await;
        }
    }
    Ok(())
}

async fn check_new_promos_trigger(pg: &sqlx::PgPool, service_id: i32) -> bool {
    // Chercher des promos créées dans les dernières 2 heures sans campagne associée
    let count: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM service_products
           WHERE service_id = $1
             AND sale_price IS NOT NULL
             AND is_active = true
             AND NOT EXISTS (
               SELECT 1 FROM meta_ad_campaigns c
               WHERE $1 = ANY(c.target_product_ids)
                 AND c.campaign_type = 'auto_promo'
                 AND c.created_at > NOW() - INTERVAL '24 hours'
             )
             AND created_at > NOW() - INTERVAL '2 hours'"#,
    )
    .bind(service_id)
    .fetch_one(pg)
    .await
    .unwrap_or(0);

    count > 0
}

fn is_scheduled_time(config: &Option<serde_json::Value>) -> bool {
    if let Some(cfg) = config {
        if let Some(hour) = cfg["hour"].as_i64() {
            let current_hour = chrono::Utc::now().hour() as i64;
            return current_hour == hour;
        }
    }
    false
}

async fn check_low_roas_trigger(pg: &sqlx::PgPool, ad_account_id: Option<i32>) -> bool {
    if let Some(id) = ad_account_id {
        let count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM meta_ad_campaigns WHERE ad_account_id = $1 AND status = 'active' AND roas IS NOT NULL AND roas < 0.5 AND spent_fcfa > 2000",
        )
        .bind(id)
        .fetch_one(pg)
        .await
        .unwrap_or(0);
        count > 0
    } else {
        false
    }
}

use chrono::Timelike;
