use std::sync::Arc;
use axum::{extract::State, Json};
use serde::{Deserialize, Serialize};
use sqlx::{Row, query};
use log::{info, error};

use crate::{
    core::types::AppResult,
};

use crate::state::AppState;

#[derive(Debug, Serialize)]
pub struct TokenPack {
    pub id: i32,
    pub name: String,
    pub tokens: i32,
    pub price: i32, // ? correspond ? un INTEGER SQL
}

pub async fn list_token_packs(
    State(state): State<Arc<AppState>>,
) -> AppResult<Json<Vec<TokenPack>>> {
    info!("[list_token_packs] Called");
    let rows = match query("SELECT id, name, tokens, price FROM token_packs ORDER BY price ASC")
        .fetch_all(&state.pg)
        .await {
        Ok(r) => r,
        Err(e) => {
            error!("[list_token_packs] Query error: {e:?}");
            return Err(e.into());
        }
    };
    let packs: Vec<TokenPack> = rows
        .into_iter()
        .map(|row| TokenPack {
            id: row.try_get("id").unwrap_or_default(),
            name: row.try_get("name").unwrap_or_default(),
            tokens: row.try_get("tokens").unwrap_or_default(),
            price: row.try_get("price").unwrap_or_default(),
        })
        .collect();
    info!("[list_token_packs] Returned {} packs", packs.len());
    Ok(Json(packs))
}

#[derive(Debug, Deserialize)]
pub struct NewTokenPack {
    pub name: String,
    pub tokens: i32,
    pub price: f64, // re?u depuis l'interface utilisateur en euros
}

pub async fn create_token_pack(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<NewTokenPack>,
) -> AppResult<Json<TokenPack>> {
    info!("[create_token_pack] Called for name={}, tokens={}, price={}?", payload.name, payload.tokens, payload.price);
    let price_centimes = (payload.price * 100.0).round() as i32;
    let row = match query(
        r#"
        INSERT INTO token_packs (name, tokens, price)
        VALUES ($1, $2, $3)
        RETURNING id, name, tokens, price
        "#
    )
    .bind(&payload.name)
    .bind(payload.tokens)
    .bind(price_centimes)
    .fetch_one(&state.pg)
    .await {
        Ok(r) => r,
        Err(e) => {
            error!("[create_token_pack] Insert error: {e:?}");
            return Err(e.into());
        }
    };
    let pack = TokenPack {
        id: row.try_get("id")?,
        name: row.try_get("name")?,
        tokens: row.try_get("tokens")?,
        price: row.try_get("price")?,
    };
    info!("[create_token_pack] Created pack id={}", pack.id);
    Ok(Json(pack))
}
