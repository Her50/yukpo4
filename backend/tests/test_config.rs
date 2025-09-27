use std::env;

pub struct TestConfig {
    pub database_url: String,
    pub mongodb_url: String,
    pub redis_url: String,
    pub webhook_secret: String,
    pub orange_money_secret: String,
    pub mtn_money_secret: String,
}

impl TestConfig {
    pub fn from_env() -> Self {
        Self {
            database_url: env::var("TEST_DATABASE_URL")
                .unwrap_or_else(|_| "postgresql://test:test@localhost:5432/yukpomnang_test".to_string()),
            mongodb_url: env::var("TEST_MONGODB_URL")
                .unwrap_or_else(|_| "mongodb://localhost:27017".to_string()),
            redis_url: env::var("TEST_REDIS_URL")
                .unwrap_or_else(|_| "redis://localhost:6379/1".to_string()),
            webhook_secret: env::var("TEST_WEBHOOK_SECRET")
                .unwrap_or_else(|_| "test_webhook_secret".to_string()),
            orange_money_secret: env::var("TEST_ORANGE_MONEY_SECRET")
                .unwrap_or_else(|_| "test_orange_money_secret".to_string()),
            mtn_money_secret: env::var("TEST_MTN_MONEY_SECRET")
                .unwrap_or_else(|_| "test_mtn_money_secret".to_string()),
        }
    }
}

impl Default for TestConfig {
    fn default() -> Self {
        Self::from_env()
    }
}

