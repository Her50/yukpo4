// src/test_utils.rs
// Test helpers for integration and unit tests
use std::env;
use crate::utils::jwt_manager;

/// Generate a JWT for tests (user or admin)
pub fn gen_jwt(role: &str, user_id: i32) -> String {
    let secret = env::var("JWT_SECRET").unwrap_or_else(|_| "dev_secret".to_string());
    jwt_manager::generate_jwt(
        user_id,
        role,
        &format!("test{}@example.com", user_id),
        100,
        &secret,
    ).unwrap()
}
