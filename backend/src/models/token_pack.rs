use axum::{extract::State, Json};
use serde::{Deserialize, Serialize};
use sqlx::{query, Row};
use std::sync::Arc;

use crate::core::types::AppResult;
use crate::state::AppState;

#[derive(Debug, Serialize)]
pub struct TokenPack {
    pub id: i32,
    pub name: String,
    pub tokens: i32,
    pub price: i32, // en centimes
}

/// ? GET /token_packs ? liste tous les packs disponibles
pub async fn list_token_packs(
    State(state): State<Arc<AppState>>,
) -> AppResult<Json<Vec<TokenPack>>> {
    let rows = query("SELECT id, name, tokens, price FROM token_packs ORDER BY price ASC")
        .fetch_all(&state.pg)
        .await?;

    let packs = rows
        .into_iter()
        .map(|row| TokenPack {
            id: row.get::<Option<_>, _>("id").unwrap_or_default(),
            name: row.get::<Option<_>, _>("name").unwrap_or_default(),
            tokens: row.get::<Option<_>, _>("tokens").unwrap_or_default(),
            price: row.get::<Option<_>, _>("price").unwrap_or_default(),
        })
        .collect();

    Ok(Json(packs))
}

#[derive(Debug, Deserialize)]
pub struct NewTokenPack {
    pub name: String,
    pub tokens: i32,
    pub price: f64, // ex: 4.99 ?
}

/// ? POST /token_packs ? cr?er un nouveau pack (admin requis)
pub async fn create_token_pack(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<NewTokenPack>,
) -> AppResult<Json<TokenPack>> {
    let price_centimes = (payload.price * 100.0).round() as i32;

    let row = query(
        r#"
        INSERT INTO token_packs (name, tokens, price)
        VALUES ($1, $2, $3)
        RETURNING id, name, tokens, price
        "#,
    )
    .bind(&payload.name)
    .bind(payload.tokens)
    .bind(price_centimes)
    .fetch_one(&state.pg)
    .await?;

    let pack = TokenPack {
        id: row.get::<i32, _>("id"),
        name: row.get::<String, _>("name"),
        tokens: row.get::<i32, _>("tokens"),
        price: row.get::<i32, _>("price"),
    };

    Ok(Json(pack))
}
