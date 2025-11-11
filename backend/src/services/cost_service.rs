use std::env;

use log::{info, warn};
use serde::Serialize;
use sqlx::PgPool;

use crate::core::types::{AppError, AppResult};

#[derive(Debug, Clone, Serialize)]
pub struct CostBreakdown {
    pub tokens_cost_usd: f64,
    pub audio_mastering_usd: f64,
    pub broll_generation_usd: f64,
}

#[derive(Debug, Clone, Serialize)]
pub struct CostEstimation {
    pub estimated_tokens: i64,
    pub base_cost_usd: f64,
    pub margin_multiplier: f64,
    pub total_cost_usd: f64,
    pub total_cost_fcfa: f64,
    pub total_cost_local: f64,
    pub local_currency: String,
    pub breakdown: CostBreakdown,
    pub required_fcfa: i64,
    pub current_balance_fcfa: Option<i64>,
    pub affordable: bool,
}

pub struct CostEstimator {
    pool: PgPool,
    token_price_per_1k_usd: f64,
    usd_to_fcfa: f64,
    usd_to_eur: f64,
    default_tokens: i64,
    tokens_per_slide: i64,
    default_audio_cost_usd: f64,
    default_broll_cost_usd: f64,
    default_currency: String,
}

impl CostEstimator {
    pub fn new(pool: PgPool) -> Self {
        let token_price_per_1k_usd = env::var("IA_COST_PER_1K_TOKENS_USD")
            .ok()
            .and_then(|v| v.parse::<f64>().ok())
            .unwrap_or(0.015);

        let usd_to_fcfa = env::var("USD_TO_FCFA_RATE")
            .ok()
            .and_then(|v| v.parse::<f64>().ok())
            .unwrap_or(600.0);

        let usd_to_eur = env::var("USD_TO_EUR_RATE")
            .ok()
            .and_then(|v| v.parse::<f64>().ok())
            .unwrap_or(0.92);

        let default_tokens = env::var("VIDEO_DEFAULT_TOKENS_ESTIMATE")
            .ok()
            .and_then(|v| v.parse::<i64>().ok())
            .unwrap_or(2_400);

        let tokens_per_slide = env::var("VIDEO_TOKENS_PER_SLIDE_ESTIMATE")
            .ok()
            .and_then(|v| v.parse::<i64>().ok())
            .unwrap_or(220);

        let default_audio_cost_usd = env::var("VIDEO_AUDIO_MASTERING_COST_USD")
            .ok()
            .and_then(|v| v.parse::<f64>().ok())
            .unwrap_or(0.8);

        let default_broll_cost_usd = env::var("VIDEO_BROLL_AI_COST_USD")
            .ok()
            .and_then(|v| v.parse::<f64>().ok())
            .unwrap_or(1.2);

        let default_currency =
            env::var("VIDEO_DEFAULT_USER_CURRENCY").unwrap_or_else(|_| "XAF".to_string());

        Self {
            pool,
            token_price_per_1k_usd,
            usd_to_fcfa,
            usd_to_eur,
            default_tokens,
            tokens_per_slide,
            default_audio_cost_usd,
            default_broll_cost_usd,
            default_currency,
        }
    }

    pub async fn ensure_user_can_afford_video(
        &self,
        user_id: i32,
        script_outline_len: usize,
    ) -> AppResult<CostEstimation> {
        let estimation = self
            .estimate_video_generation_cost_only(user_id, script_outline_len)
            .await?;

        if !estimation.affordable {
            return Err(AppError::Forbidden(format!(
                "Solde insuffisant: coût estimé {} FCFA, solde actuel {} FCFA",
                estimation.required_fcfa,
                estimation.current_balance_fcfa.unwrap_or_default()
            )));
        }

        Ok(estimation)
    }

    pub async fn estimate_video_generation_cost_only(
        &self,
        user_id: i32,
        script_outline_len: usize,
    ) -> AppResult<CostEstimation> {
        let mut estimation = self
            .estimate_video_generation_cost(user_id, script_outline_len)
            .await?;

        let balance_row = sqlx::query!("SELECT tokens_balance FROM users WHERE id = $1", user_id)
            .fetch_one(&self.pool)
            .await
            .map_err(AppError::from)?;

        let balance_fcfa = balance_row.tokens_balance;
        estimation.current_balance_fcfa = Some(balance_fcfa);
        estimation.affordable = balance_fcfa >= estimation.required_fcfa;

        Ok(estimation)
    }

    async fn estimate_video_generation_cost(
        &self,
        user_id: i32,
        script_outline_len: usize,
    ) -> AppResult<CostEstimation> {
        let average_tokens = self.average_tokens_for_intention("video_immersif").await?;

        let mut estimated_tokens = if average_tokens > 0 {
            average_tokens
        } else {
            self.default_tokens
        };
        estimated_tokens += (script_outline_len as i64 * self.tokens_per_slide);

        let token_cost_usd = (estimated_tokens as f64 / 1_000.0) * self.token_price_per_1k_usd;
        let base_cost_usd =
            token_cost_usd + self.default_audio_cost_usd + self.default_broll_cost_usd;

        let (multiplier, total_cost_usd) = apply_margin(base_cost_usd);
        let total_cost_fcfa = total_cost_usd * self.usd_to_fcfa;

        let currency = self.resolve_user_currency(user_id).await;
        let total_cost_local = self.convert_currency(total_cost_usd, &currency);

        info!(
            "[CostEstimator] estimation utilisateur {} => tokens={}, base ${:.2}, total ${:.2} ({} {})",
            user_id, estimated_tokens, base_cost_usd, total_cost_usd, total_cost_local, currency
        );

        Ok(CostEstimation {
            estimated_tokens,
            base_cost_usd,
            margin_multiplier: multiplier,
            total_cost_usd,
            total_cost_fcfa,
            total_cost_local,
            local_currency: currency,
            breakdown: CostBreakdown {
                tokens_cost_usd: token_cost_usd,
                audio_mastering_usd: self.default_audio_cost_usd,
                broll_generation_usd: self.default_broll_cost_usd,
            },
            required_fcfa: total_cost_fcfa.ceil() as i64,
            current_balance_fcfa: None,
            affordable: true,
        })
    }

    async fn average_tokens_for_intention(&self, intention: &str) -> AppResult<i64> {
        let row = sqlx::query!(
            r#"
            SELECT COALESCE(AVG(tokens_ia_consumed)::numeric, 0)::BIGINT AS avg_tokens
            FROM token_usage_logs
            WHERE intention = $1
            "#,
            intention
        )
        .fetch_one(&self.pool)
        .await
        .map_err(AppError::from)?;

        Ok(row.avg_tokens.unwrap_or(0))
    }

    async fn resolve_user_currency(&self, _user_id: i32) -> String {
        // TODO: brancher sur les préférences utilisateur quand elles seront disponibles
        self.default_currency.clone()
    }

    fn convert_currency(&self, amount_usd: f64, currency: &str) -> f64 {
        match currency {
            "USD" => amount_usd,
            "EUR" => amount_usd * self.usd_to_eur,
            "XAF" | "FCFA" => amount_usd * self.usd_to_fcfa,
            other => {
                warn!(
                    "[CostEstimator] Devise {} inconnue, utilisation du taux FCFA par défaut",
                    other
                );
                amount_usd * self.usd_to_fcfa
            }
        }
    }
}

fn apply_margin(base_cost_usd: f64) -> (f64, f64) {
    if base_cost_usd < 1.0 {
        let total = base_cost_usd * 10.0;
        (10.0, total)
    } else if base_cost_usd <= 5.0 {
        let total = base_cost_usd * 5.0;
        (5.0, total)
    } else {
        let total = base_cost_usd * 2.0;
        (2.0, total)
    }
}
