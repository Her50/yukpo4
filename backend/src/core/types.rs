use axum::extract::multipart::MultipartError;
use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use prometheus;
use redis;
use serde_json::json;
use std::convert::Infallible;
use thiserror::Error;

/// ? Type de retour standardis?
pub type AppResult<T> = Result<T, AppError>;

/// ? Alias pour r?ponse JSON uniformis?e
pub type AppJson = Json<serde_json::Value>;

/// ? Enum?ration des erreurs g?r?es
#[derive(Debug, Error)]
pub enum AppError {
    #[error("? Unauthorized: {0}")]
    Unauthorized(String),

    #[error("?? Forbidden: {0}")]
    Forbidden(String),

    #[error("?? Not Found: {0}")]
    NotFound(String),

    #[error("?? Conflict: {0}")]
    Conflict(String),

    #[error("?? Bad Request: {0}")]
    BadRequest(String),

    #[error("?? Too Many Requests: {0}")]
    TooManyRequests(String),

    #[error("?? Database error: {0}")]
    Database(String),

    #[error("?? Internal error: {0}")]
    Internal(String),

    #[error("?? Not Implemented: {0}")]
    NotImplemented(String),
}

impl AppError {
    /// ? G?n?re une erreur 500 personnalis?e
    pub fn internal_server_error<E: ToString>(msg: E) -> Self {
        AppError::Internal(msg.to_string())
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, error_code) = match &self {
            AppError::Unauthorized(_) => (StatusCode::UNAUTHORIZED, "UNAUTHORIZED"),
            AppError::Forbidden(_) => (StatusCode::FORBIDDEN, "FORBIDDEN"),
            AppError::NotFound(_) => (StatusCode::NOT_FOUND, "NOT_FOUND"),
            AppError::Conflict(_) => (StatusCode::CONFLICT, "CONFLICT"),
            AppError::BadRequest(_) => (StatusCode::BAD_REQUEST, "BAD_REQUEST"),
            AppError::TooManyRequests(_) => (StatusCode::TOO_MANY_REQUESTS, "TOO_MANY_REQUESTS"),
            AppError::Database(_) => (StatusCode::INTERNAL_SERVER_ERROR, "DATABASE_ERROR"),
            AppError::Internal(_) => (StatusCode::INTERNAL_SERVER_ERROR, "INTERNAL_ERROR"),
            AppError::NotImplemented(_) => (StatusCode::NOT_IMPLEMENTED, "NOT_IMPLEMENTED"),
        };

        let msg = self.to_string();
        // ✅ CORRECTION: Format d'erreur structuré avec code et message
        let body = Json(json!({
            "error": msg,
            "code": error_code,
            "status": status.as_u16()
        }));
        (status, body).into_response()
    }
}

//
// ?? Conversions automatiques vers AppError
//

impl From<sqlx::Error> for AppError {
    fn from(e: sqlx::Error) -> Self {
        AppError::Database(e.to_string())
    }
}

impl From<bcrypt::BcryptError> for AppError {
    fn from(e: bcrypt::BcryptError) -> Self {
        AppError::Internal(e.to_string())
    }
}

impl From<jsonwebtoken::errors::Error> for AppError {
    fn from(e: jsonwebtoken::errors::Error) -> Self {
        AppError::Internal(e.to_string())
    }
}

impl From<reqwest::Error> for AppError {
    fn from(e: reqwest::Error) -> Self {
        AppError::Internal(e.to_string())
    }
}

impl From<anyhow::Error> for AppError {
    fn from(e: anyhow::Error) -> Self {
        AppError::Internal(e.to_string())
    }
}

impl From<std::io::Error> for AppError {
    fn from(e: std::io::Error) -> Self {
        AppError::Internal(e.to_string())
    }
}

impl From<Infallible> for AppError {
    fn from(_: Infallible) -> Self {
        AppError::Internal("Unexpected error".into())
    }
}

impl From<&str> for AppError {
    fn from(message: &str) -> Self {
        AppError::Internal(message.to_string())
    }
}

impl From<String> for AppError {
    fn from(message: String) -> Self {
        AppError::Internal(message)
    }
}

impl From<MultipartError> for AppError {
    fn from(e: MultipartError) -> Self {
        AppError::Internal(format!("Erreur de traitement multipart: {}", e))
    }
}

impl From<serde_json::Error> for AppError {
    fn from(e: serde_json::Error) -> Self {
        AppError::Internal(format!("Erreur de JSON: {}", e))
    }
}

impl From<prometheus::Error> for AppError {
    fn from(e: prometheus::Error) -> Self {
        AppError::Internal(format!("Prometheus error: {}", e))
    }
}

impl From<redis::RedisError> for AppError {
    fn from(e: redis::RedisError) -> Self {
        AppError::Internal(format!("Redis error: {}", e))
    }
}
