// Contr?leur pour les alertes persistantes
use axum::{Json, extract::{Path, Extension, State}};
use crate::models::alert_model::Alert;
use crate::state::AppState;
use std::sync::Arc;

// POST /services/:id/alert
// GET  /users/:id/alerts
// ...

// ? compl?ter avec la logique m?tier
