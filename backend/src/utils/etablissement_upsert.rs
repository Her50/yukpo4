//! Upsert idempotent d'un établissement scolaire.
//!
//! Stratégie de déduplication :
//!   1) Match GPS (≤ 500m) + similarité de nom (lower/trim) ≥ 0.7
//!   2) Match (pays, ville, nom normalisé) exact
//!   3) Sinon INSERT
//!
//! Utilisé par le contrôleur bourse_livre_v2 lors d'un scan où l'IA extrait
//! nom + ville d'une liste scolaire et où l'utilisateur n'a pas sélectionné
//! d'école dans l'autocomplete.

use sqlx::PgPool;

use crate::core::types::{AppError, AppResult};

#[derive(Debug, Clone)]
pub struct EtablissementUpsertInput {
    pub nom: String,
    pub ville: String,
    pub pays: String, // ISO-2
    pub type_etablissement: String,
    pub gps: Option<(f64, f64)>, // (lat, lon)
    pub user_id: i32,
    pub service_id: i32,
}

/// Upsert : retourne l'id de l'établissement correspondant (existant ou créé).
pub async fn upsert_etablissement(
    pool: &PgPool,
    input: &EtablissementUpsertInput,
) -> AppResult<i32> {
    let nom_norm = normalize_name(&input.nom);

    // 1) Match GPS + nom
    if let Some((lat, lon)) = input.gps {
        let row: Option<(i32,)> = sqlx::query_as(
            r#"
            SELECT id FROM etablissements_scolaires
            WHERE pays = $1
              AND is_active = true
              AND location_point IS NOT NULL
              AND ST_DWithin(location_point, ST_GeogFromText($2), 500)
              AND similarity(lower(unaccent(nom_etablissement)), $3) >= 0.5
            ORDER BY ST_Distance(location_point, ST_GeogFromText($2)) ASC
            LIMIT 1
            "#,
        )
        .bind(&input.pays)
        .bind(format!("POINT({} {})", lon, lat))
        .bind(&nom_norm)
        .fetch_optional(pool)
        .await
        .ok()
        .flatten();

        if let Some((id,)) = row {
            return Ok(id);
        }
    }

    // 2) Match pays + ville + nom normalisé
    let row: Option<(i32,)> = sqlx::query_as(
        r#"
        SELECT id FROM etablissements_scolaires
        WHERE pays = $1
          AND is_active = true
          AND lower(unaccent(ville)) = lower(unaccent($2))
          AND lower(unaccent(nom_etablissement)) = $3
        LIMIT 1
        "#,
    )
    .bind(&input.pays)
    .bind(&input.ville)
    .bind(&nom_norm)
    .fetch_optional(pool)
    .await
    .ok()
    .flatten();

    if let Some((id,)) = row {
        return Ok(id);
    }

    // 3) Insert
    let location_point = input.gps.map(|(lat, lon)| format!("POINT({} {})", lon, lat));
    let gps_str = input.gps.map(|(lat, lon)| format!("{},{}", lat, lon));

    let (id,): (i32,) = sqlx::query_as(
        r#"
        INSERT INTO etablissements_scolaires (
            service_id, user_id, nom_etablissement, type_etablissement,
            ville, pays, gps, location_point, is_active, is_verified
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7,
            CASE WHEN $8 IS NOT NULL THEN ST_GeogFromText($8) ELSE NULL END,
            true, false
        )
        RETURNING id
        "#,
    )
    .bind(input.service_id)
    .bind(input.user_id)
    .bind(&input.nom)
    .bind(&input.type_etablissement)
    .bind(&input.ville)
    .bind(&input.pays)
    .bind(gps_str)
    .bind(location_point)
    .fetch_one(pool)
    .await
    .map_err(|e| AppError::Internal(format!("etablissement upsert: {}", e)))?;

    Ok(id)
}

/// Trouve l'établissement "programme national" d'un pays (seed migration).
pub async fn find_national_etablissement(pool: &PgPool, pays: &str) -> AppResult<Option<i32>> {
    let row: Option<(i32,)> = sqlx::query_as(
        r#"
        SELECT id FROM etablissements_scolaires
        WHERE pays = $1 AND is_national = true AND is_active = true
        ORDER BY id ASC LIMIT 1
        "#,
    )
    .bind(pays)
    .fetch_optional(pool)
    .await
    .map_err(|e| AppError::Internal(format!("national lookup: {}", e)))?;

    Ok(row.map(|(id,)| id))
}

fn normalize_name(s: &str) -> String {
    // Normalisation simple : lowercase, trim, squash whitespace.
    // L'extension unaccent côté SQL gère les accents.
    let mut out = String::with_capacity(s.len());
    let mut prev_space = true;
    for c in s.to_lowercase().chars() {
        if c.is_whitespace() {
            if !prev_space {
                out.push(' ');
                prev_space = true;
            }
        } else {
            out.push(c);
            prev_space = false;
        }
    }
    out.trim().to_string()
}
