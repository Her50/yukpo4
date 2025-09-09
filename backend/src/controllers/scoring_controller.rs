// Contr?leur pour le scoring intelligent
use axum::{Json, extract::{Path, Extension, State}};
use crate::models::service_score_model::ServiceScore;
use crate::state::AppState;
use std::sync::Arc;

// GET  /services/:id/score
// PATCH /services/:id/score/recompute
// ...

// ? compl?ter avec la logique m?tier
