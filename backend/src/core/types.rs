use std::convert::Infallible;
use axum::{
    response::{IntoResponse, Response},
    http::StatusCode,
    Json,
};
use serde_json::json;
use thiserror::Error;
use axum::extract::multipart::MultipartError;


/// ? Type de retour standardis?
pub type AppResult<T> = Result<T, AppError>;

/// ? Alias pour r?ponse JSON uniformis?e
pub type AppJson = Json<serde_json::Value>;

/// ? Enum?ration des erreurs g?r?es
#[derive(Debug, Error)]
pub enum AppError {
    #[error("? Unauthorized: {0}")]
    Unauthorized(String),

    #[error("?? Not Found: {0}")]
    NotFound(String),

    #[error("?? Conflict: {0}")]
    Conflict(String),

    #[error("?? Bad Request: {0}")]
    BadRequest(String),

    #[error("?? Database error: {0}")]
    Database(String),

    #[error("?? Internal error: {0}")]
    Internal(String),
}

impl AppError {
    /// ? G?n?re une erreur 500 personnalis?e
    pub fn internal_server_error<E: ToString>(msg: E) -> Self {
        AppError::Internal(msg.to_string())
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let status = match self {
            AppError::Unauthorized(_) => StatusCode::UNAUTHORIZED,
            AppError::NotFound(_)     => StatusCode::NOT_FOUND,
            AppError::Conflict(_)     => StatusCode::CONFLICT,
            AppError::BadRequest(_)   => StatusCode::BAD_REQUEST,
            AppError::Database(_)     => StatusCode::INTERNAL_SERVER_ERROR,
            AppError::Internal(_)     => StatusCode::INTERNAL_SERVER_ERROR,
        };

        let msg = self.to_string();
        let body = Json(json!({ "error": msg }));
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
