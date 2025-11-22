use crate::core::types::AppResult;
use serde_json::Value;
use sqlx::{FromRow, PgPool};

#[derive(FromRow)]
struct ProgrammeRow {
    programme: Value,
}

/// Ajoute ou met ? jour un programme scolaire (par ?tablissement, classe, ann?e optionnelle)
pub async fn upsert_programme_scolaire(
    etablissement: &str,
    classe: &str,
    annee: Option<&str>,
    programme: &Value,
    pool: &PgPool,
) -> AppResult<()> {
    sqlx::query(
        r#"
        INSERT INTO programmes_scolaires (etablissement, classe, annee, programme)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (etablissement, classe, annee)
        DO UPDATE SET programme = EXCLUDED.programme
        "#
    )
    .bind(etablissement)
    .bind(classe)
    .bind(annee)
    .bind(programme)
    .execute(pool)
    .await?;
    Ok(())
}

/// R?cup?re le programme scolaire officiel pour une classe/?tablissement
pub async fn get_programme_scolaire(
    etablissement: &str,
    classe: &str,
    pool: &PgPool,
) -> AppResult<Value> {
    let rec: Option<ProgrammeRow> = sqlx::query_as(
        r#"
        SELECT programme FROM programmes_scolaires
        WHERE etablissement = $1 AND classe = $2
        ORDER BY annee DESC NULLS LAST
        LIMIT 1
        "#
    )
    .bind(etablissement)
    .bind(classe)
    .fetch_optional(pool)
    .await?;
    if let Some(row) = rec {
        Ok(row.programme)
    } else {
        Ok(Value::Null)
    }
}
