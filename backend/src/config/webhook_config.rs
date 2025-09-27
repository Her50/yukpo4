use serde::{Deserialize, Serialize};
use std::env;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebhookConfig {
    pub orange_money: OrangeMoneyConfig,
    pub mtn_money: MTNMoneyConfig,
    pub generic: GenericWebhookConfig,
    pub security: SecurityConfig,
    pub limits: LimitsConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrangeMoneyConfig {
    pub webhook_secret: String,
    pub api_url: String,
    pub merchant_key: String,
    pub merchant_id: String,
    pub timeout_seconds: u64,
    pub retry_attempts: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MTNMoneyConfig {
    pub webhook_secret: String,
    pub api_url: String,
    pub subscription_key: String,
    pub target_environment: String,
    pub timeout_seconds: u64,
    pub retry_attempts: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenericWebhookConfig {
    pub webhook_secret: String,
    pub timeout_seconds: u64,
    pub retry_attempts: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityConfig {
    pub enable_signature_validation: bool,
    pub signature_algorithm: String,
    pub max_request_size: usize,
    pub rate_limit_requests_per_minute: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LimitsConfig {
    pub min_payment_amount_xaf: i64,
    pub max_payment_amount_xaf: i64,
    pub min_payment_amount_usd: i64,
    pub max_payment_amount_usd: i64,
    pub payment_timeout_seconds: u64,
    pub webhook_timeout_seconds: u64,
}

impl WebhookConfig {
    pub fn from_env() -> Result<Self, String> {
        Ok(WebhookConfig {
            orange_money: OrangeMoneyConfig {
                webhook_secret: env::var("ORANGE_MONEY_WEBHOOK_SECRET")
                    .unwrap_or_else(|_| "default_orange_secret".to_string()),
                api_url: env::var("ORANGE_MONEY_API_URL")
                    .unwrap_or_else(|_| "https://api.orange.com/orange-money-webpay/cm/v1".to_string()),
                merchant_key: env::var("ORANGE_MONEY_MERCHANT_KEY")
                    .unwrap_or_else(|_| "default_merchant_key".to_string()),
                merchant_id: env::var("ORANGE_MONEY_MERCHANT_ID")
                    .unwrap_or_else(|_| "default_merchant_id".to_string()),
                timeout_seconds: env::var("ORANGE_MONEY_TIMEOUT_SECONDS")
                    .unwrap_or_else(|_| "30".to_string())
                    .parse()
                    .map_err(|_| "Invalid ORANGE_MONEY_TIMEOUT_SECONDS")?,
                retry_attempts: env::var("ORANGE_MONEY_RETRY_ATTEMPTS")
                    .unwrap_or_else(|_| "3".to_string())
                    .parse()
                    .map_err(|_| "Invalid ORANGE_MONEY_RETRY_ATTEMPTS")?,
            },
            mtn_money: MTNMoneyConfig {
                webhook_secret: env::var("MTN_MONEY_WEBHOOK_SECRET")
                    .unwrap_or_else(|_| "default_mtn_secret".to_string()),
                api_url: env::var("MTN_MONEY_API_URL")
                    .unwrap_or_else(|_| "https://sandbox.momodeveloper.mtn.com".to_string()),
                subscription_key: env::var("MTN_MONEY_SUBSCRIPTION_KEY")
                    .unwrap_or_else(|_| "default_subscription_key".to_string()),
                target_environment: env::var("MTN_MONEY_TARGET_ENVIRONMENT")
                    .unwrap_or_else(|_| "sandbox".to_string()),
                timeout_seconds: env::var("MTN_MONEY_TIMEOUT_SECONDS")
                    .unwrap_or_else(|_| "30".to_string())
                    .parse()
                    .map_err(|_| "Invalid MTN_MONEY_TIMEOUT_SECONDS")?,
                retry_attempts: env::var("MTN_MONEY_RETRY_ATTEMPTS")
                    .unwrap_or_else(|_| "3".to_string())
                    .parse()
                    .map_err(|_| "Invalid MTN_MONEY_RETRY_ATTEMPTS")?,
            },
            generic: GenericWebhookConfig {
                webhook_secret: env::var("WEBHOOK_SECRET")
                    .unwrap_or_else(|_| "default_webhook_secret".to_string()),
                timeout_seconds: env::var("WEBHOOK_TIMEOUT_SECONDS")
                    .unwrap_or_else(|_| "30".to_string())
                    .parse()
                    .map_err(|_| "Invalid WEBHOOK_TIMEOUT_SECONDS")?,
                retry_attempts: env::var("WEBHOOK_RETRY_ATTEMPTS")
                    .unwrap_or_else(|_| "3".to_string())
                    .parse()
                    .map_err(|_| "Invalid WEBHOOK_RETRY_ATTEMPTS")?,
            },
            security: SecurityConfig {
                enable_signature_validation: env::var("ENABLE_WEBHOOK_SIGNATURE_VALIDATION")
                    .unwrap_or_else(|_| "true".to_string())
                    .parse()
                    .unwrap_or(true),
                signature_algorithm: env::var("WEBHOOK_SIGNATURE_ALGORITHM")
                    .unwrap_or_else(|_| "HMAC-SHA256".to_string()),
                max_request_size: env::var("WEBHOOK_MAX_REQUEST_SIZE")
                    .unwrap_or_else(|_| "1048576".to_string()) // 1MB
                    .parse()
                    .map_err(|_| "Invalid WEBHOOK_MAX_REQUEST_SIZE")?,
                rate_limit_requests_per_minute: env::var("WEBHOOK_RATE_LIMIT_PER_MINUTE")
                    .unwrap_or_else(|_| "60".to_string())
                    .parse()
                    .map_err(|_| "Invalid WEBHOOK_RATE_LIMIT_PER_MINUTE")?,
            },
            limits: LimitsConfig {
                min_payment_amount_xaf: env::var("MIN_PAYMENT_AMOUNT_XAF")
                    .unwrap_or_else(|_| "100".to_string())
                    .parse()
                    .map_err(|_| "Invalid MIN_PAYMENT_AMOUNT_XAF")?,
                max_payment_amount_xaf: env::var("MAX_PAYMENT_AMOUNT_XAF")
                    .unwrap_or_else(|_| "1000000".to_string())
                    .parse()
                    .map_err(|_| "Invalid MAX_PAYMENT_AMOUNT_XAF")?,
                min_payment_amount_usd: env::var("MIN_PAYMENT_AMOUNT_USD")
                    .unwrap_or_else(|_| "1".to_string())
                    .parse()
                    .map_err(|_| "Invalid MIN_PAYMENT_AMOUNT_USD")?,
                max_payment_amount_usd: env::var("MAX_PAYMENT_AMOUNT_USD")
                    .unwrap_or_else(|_| "10000".to_string())
                    .parse()
                    .map_err(|_| "Invalid MAX_PAYMENT_AMOUNT_USD")?,
                payment_timeout_seconds: env::var("PAYMENT_TIMEOUT_SECONDS")
                    .unwrap_or_else(|_| "300".to_string())
                    .parse()
                    .map_err(|_| "Invalid PAYMENT_TIMEOUT_SECONDS")?,
                webhook_timeout_seconds: env::var("WEBHOOK_TIMEOUT_SECONDS")
                    .unwrap_or_else(|_| "30".to_string())
                    .parse()
                    .map_err(|_| "Invalid WEBHOOK_TIMEOUT_SECONDS")?,
            },
        })
    }

    pub fn validate(&self) -> Result<(), String> {
        // Validation des montants
        if self.limits.min_payment_amount_xaf <= 0 {
            return Err("MIN_PAYMENT_AMOUNT_XAF must be greater than 0".to_string());
        }
        
        if self.limits.max_payment_amount_xaf <= self.limits.min_payment_amount_xaf {
            return Err("MAX_PAYMENT_AMOUNT_XAF must be greater than MIN_PAYMENT_AMOUNT_XAF".to_string());
        }

        if self.limits.min_payment_amount_usd <= 0 {
            return Err("MIN_PAYMENT_AMOUNT_USD must be greater than 0".to_string());
        }
        
        if self.limits.max_payment_amount_usd <= self.limits.min_payment_amount_usd {
            return Err("MAX_PAYMENT_AMOUNT_USD must be greater than MIN_PAYMENT_AMOUNT_USD".to_string());
        }

        // Validation des timeouts
        if self.limits.payment_timeout_seconds == 0 {
            return Err("PAYMENT_TIMEOUT_SECONDS must be greater than 0".to_string());
        }

        if self.limits.webhook_timeout_seconds == 0 {
            return Err("WEBHOOK_TIMEOUT_SECONDS must be greater than 0".to_string());
        }

        // Validation des secrets
        if self.orange_money.webhook_secret.is_empty() {
            return Err("ORANGE_MONEY_WEBHOOK_SECRET cannot be empty".to_string());
        }

        if self.mtn_money.webhook_secret.is_empty() {
            return Err("MTN_MONEY_WEBHOOK_SECRET cannot be empty".to_string());
        }

        if self.generic.webhook_secret.is_empty() {
            return Err("WEBHOOK_SECRET cannot be empty".to_string());
        }

        Ok(())
    }

    pub fn is_production(&self) -> bool {
        self.mtn_money.target_environment == "production"
    }

    pub fn get_webhook_secret(&self, provider: &str) -> Option<&str> {
        match provider {
            "orange_money" => Some(&self.orange_money.webhook_secret),
            "mtn_money" => Some(&self.mtn_money.webhook_secret),
            _ => Some(&self.generic.webhook_secret),
        }
    }
}

impl Default for WebhookConfig {
    fn default() -> Self {
        Self::from_env().unwrap_or_else(|_| {
            // Configuration par défaut en cas d'erreur
            WebhookConfig {
                orange_money: OrangeMoneyConfig {
                    webhook_secret: "default_orange_secret".to_string(),
                    api_url: "https://api.orange.com/orange-money-webpay/cm/v1".to_string(),
                    merchant_key: "default_merchant_key".to_string(),
                    merchant_id: "default_merchant_id".to_string(),
                    timeout_seconds: 30,
                    retry_attempts: 3,
                },
                mtn_money: MTNMoneyConfig {
                    webhook_secret: "default_mtn_secret".to_string(),
                    api_url: "https://sandbox.momodeveloper.mtn.com".to_string(),
                    subscription_key: "default_subscription_key".to_string(),
                    target_environment: "sandbox".to_string(),
                    timeout_seconds: 30,
                    retry_attempts: 3,
                },
                generic: GenericWebhookConfig {
                    webhook_secret: "default_webhook_secret".to_string(),
                    timeout_seconds: 30,
                    retry_attempts: 3,
                },
                security: SecurityConfig {
                    enable_signature_validation: true,
                    signature_algorithm: "HMAC-SHA256".to_string(),
                    max_request_size: 1048576,
                    rate_limit_requests_per_minute: 60,
                },
                limits: LimitsConfig {
                    min_payment_amount_xaf: 100,
                    max_payment_amount_xaf: 1000000,
                    min_payment_amount_usd: 1,
                    max_payment_amount_usd: 10000,
                    payment_timeout_seconds: 300,
                    webhook_timeout_seconds: 30,
                },
            }
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_webhook_config_validation() {
        let config = WebhookConfig::default();
        assert!(config.validate().is_ok());
    }

    #[test]
    fn test_webhook_secret_retrieval() {
        let config = WebhookConfig::default();
        assert!(config.get_webhook_secret("orange_money").is_some());
        assert!(config.get_webhook_secret("mtn_money").is_some());
        assert!(config.get_webhook_secret("unknown").is_some());
    }

    #[test]
    fn test_production_detection() {
        let mut config = WebhookConfig::default();
        assert!(!config.is_production());
        
        config.mtn_money.target_environment = "production".to_string();
        assert!(config.is_production());
    }
}

