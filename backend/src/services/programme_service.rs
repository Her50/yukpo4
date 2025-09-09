use serde_json::Value;
use sqlx::PgPool;
use crate::core::types::AppResult;

/// Ajoute ou met ? jour un programme scolaire (par ?tablissement, classe, ann?e optionnelle)
pub async fn upsert_programme_scolaire(
    etablissement: &str,
    classe: &str,
    annee: Option<&str>,
    programme: &Value,
    pool: &PgPool,
) -> AppResult<()> {
    sqlx::query!(
        r#"
        INSERT INTO programmes_scolaires (etablissement, classe, annee, programme)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (etablissement, classe, annee)
        DO UPDATE SET programme = EXCLUDED.programme
        "#,
        etablissement,
        classe,
        annee,
        programme
    )
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
    let rec = sqlx::query!(
        r#"
        SELECT programme FROM programmes_scolaires
        WHERE etablissement = $1 AND classe = $2
        ORDER BY annee DESC NULLS LAST
        LIMIT 1
        "#,
        etablissement,
        classe
    )
    .fetch_optional(pool)
    .await?;
    if let Some(row) = rec {
        let programme: Value = serde_json::from_value(row.programme).unwrap_or(Value::Null);
        Ok(programme)
    } else {
        Ok(Value::Null)
    }
}
