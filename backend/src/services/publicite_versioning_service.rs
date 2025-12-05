use log;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::{PgPool, Row};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PubliciteVersion {
    pub id: i64,
    pub publicite_id: i32,
    pub version_number: i32,
    pub user_id: i32,
    pub data_snapshot: Value,
    pub change_type: String,
    pub changed_by: Option<i32>,
    pub change_description: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

/// Récupère toutes les versions d'une publicité
pub async fn get_publicite_versions(
    pool: &PgPool,
    publicite_id: i32,
) -> Result<Vec<PubliciteVersion>, sqlx::Error> {
    let rows = sqlx::query(
        r#"
        SELECT 
            id, publicite_id, version_number, user_id, data_snapshot,
            change_type, changed_by, change_description, created_at
        FROM publicite_versions
        WHERE publicite_id = $1
        ORDER BY version_number DESC
        "#,
    )
    .bind(publicite_id)
    .fetch_all(pool)
    .await?;

    let mut versions = Vec::new();
    for row in rows {
        versions.push(PubliciteVersion {
            id: row.get::<i64, _>("id"),
            publicite_id: row.get::<i32, _>("publicite_id"),
            version_number: row.get::<i32, _>("version_number"),
            user_id: row.get::<i32, _>("user_id"),
            data_snapshot: row.get::<Value, _>("data_snapshot"),
            change_type: row.get::<String, _>("change_type"),
            changed_by: row.get::<Option<i32>, _>("changed_by"),
            change_description: row.get::<Option<String>, _>("change_description"),
            created_at: row.get::<chrono::DateTime<chrono::Utc>, _>("created_at"),
        });
    }

    Ok(versions)
}

/// Récupère une version spécifique
pub async fn get_publicite_version(
    pool: &PgPool,
    publicite_id: i32,
    version_number: i32,
) -> Result<Option<PubliciteVersion>, sqlx::Error> {
    let row = sqlx::query(
        r#"
        SELECT 
            id, publicite_id, version_number, user_id, data_snapshot,
            change_type, changed_by, change_description, created_at
        FROM publicite_versions
        WHERE publicite_id = $1 AND version_number = $2
        "#,
    )
    .bind(publicite_id)
    .bind(version_number)
    .fetch_optional(pool)
    .await?;

    if let Some(row) = row {
        Ok(Some(PubliciteVersion {
            id: row.get::<i64, _>("id"),
            publicite_id: row.get::<i32, _>("publicite_id"),
            version_number: row.get::<i32, _>("version_number"),
            user_id: row.get::<i32, _>("user_id"),
            data_snapshot: row.get::<Value, _>("data_snapshot"),
            change_type: row.get::<String, _>("change_type"),
            changed_by: row.get::<Option<i32>, _>("changed_by"),
            change_description: row.get::<Option<String>, _>("change_description"),
            created_at: row.get::<chrono::DateTime<chrono::Utc>, _>("created_at"),
        }))
    } else {
        Ok(None)
    }
}

/// Restaure une version spécifique d'une publicité
pub async fn restore_publicite_version(
    pool: &PgPool,
    publicite_id: i32,
    version_number: i32,
) -> Result<bool, sqlx::Error> {
    // Appeler la fonction SQL de restauration
    let result: bool = sqlx::query_scalar("SELECT restore_publicite_version($1, $2)")
        .bind(publicite_id)
        .bind(version_number)
        .fetch_one(pool)
        .await?;

    if result {
        log::info!(
            "✅ Version {} restaurée pour publicité {}",
            version_number,
            publicite_id
        );
    } else {
        log::warn!(
            "⚠️ Impossible de restaurer la version {} pour publicité {}",
            version_number,
            publicite_id
        );
    }

    Ok(result)
}

/// Crée manuellement une version (pour les modifications importantes)
pub async fn create_manual_version(
    pool: &PgPool,
    publicite_id: i32,
    user_id: i32,
    change_description: Option<String>,
) -> Result<i32, sqlx::Error> {
    // Récupérer la publicité actuelle
    let pub_row = sqlx::query(
        r#"
        SELECT 
            id, user_id, titre, description, produits_indexes, videos, thumbnails,
            duree_jours, cout, devise_utilisateur, zone_geographique, rayon_km,
            status, date_debut, date_fin, vues, clics, impressions,
            targeting, ab_testing, schedule, placements, bid_strategy, retargeting,
            variant_performance, created_at, updated_at
        FROM publicites
        WHERE id = $1
        "#,
    )
    .bind(publicite_id)
    .fetch_one(pool)
    .await?;

    // Déterminer le prochain numéro de version
    let next_version: i32 = sqlx::query_scalar(
        r#"
        SELECT COALESCE(MAX(version_number), 0) + 1
        FROM publicite_versions
        WHERE publicite_id = $1
        "#,
    )
    .bind(publicite_id)
    .fetch_one(pool)
    .await?;

    // Créer le snapshot
    let snapshot = serde_json::json!({
        "id": pub_row.get::<i32, _>("id"),
        "user_id": pub_row.get::<i32, _>("user_id"),
        "titre": pub_row.get::<String, _>("titre"),
        "description": pub_row.get::<Option<String>, _>("description"),
        "produits_indexes": pub_row.get::<Vec<String>, _>("produits_indexes"),
        "videos": pub_row.get::<Vec<String>, _>("videos"),
        "thumbnails": pub_row.get::<Vec<String>, _>("thumbnails"),
        "duree_jours": pub_row.get::<i32, _>("duree_jours"),
        "cout": pub_row.get::<i32, _>("cout"),
        "devise_utilisateur": pub_row.get::<Option<String>, _>("devise_utilisateur"),
        "zone_geographique": pub_row.get::<String, _>("zone_geographique"),
        "rayon_km": pub_row.get::<Option<i32>, _>("rayon_km"),
        "status": pub_row.get::<String, _>("status"),
        "date_debut": pub_row.get::<chrono::DateTime<chrono::Utc>, _>("date_debut"),
        "date_fin": pub_row.get::<chrono::DateTime<chrono::Utc>, _>("date_fin"),
        "vues": pub_row.get::<i32, _>("vues"),
        "clics": pub_row.get::<i32, _>("clics"),
        "impressions": pub_row.get::<i32, _>("impressions"),
        "targeting": pub_row.get::<Value, _>("targeting"),
        "ab_testing": pub_row.get::<Value, _>("ab_testing"),
        "schedule": pub_row.get::<Option<Value>, _>("schedule"),
        "placements": pub_row.get::<Value, _>("placements"),
        "bid_strategy": pub_row.get::<Value, _>("bid_strategy"),
        "retargeting": pub_row.get::<Value, _>("retargeting"),
        "variant_performance": pub_row.get::<Value, _>("variant_performance"),
        "created_at": pub_row.get::<chrono::DateTime<chrono::Utc>, _>("created_at"),
        "updated_at": pub_row.get::<chrono::DateTime<chrono::Utc>, _>("updated_at"),
    });

    // Insérer la version
    sqlx::query(
        r#"
        INSERT INTO publicite_versions (
            publicite_id, version_number, user_id, data_snapshot,
            change_type, changed_by, change_description
        )
        VALUES ($1, $2, $3, $4, 'updated', $3, $5)
        RETURNING version_number
        "#,
    )
    .bind(publicite_id)
    .bind(next_version)
    .bind(user_id)
    .bind(&snapshot)
    .bind(change_description)
    .fetch_one(pool)
    .await
    .map(|row| row.get::<i32, _>("version_number"))?;

    Ok(next_version)
}

/// Compare deux versions et retourne les différences
pub async fn compare_versions(
    pool: &PgPool,
    publicite_id: i32,
    version1: i32,
    version2: i32,
) -> Result<Value, sqlx::Error> {
    let v1 = get_publicite_version(pool, publicite_id, version1).await?;
    let v2 = get_publicite_version(pool, publicite_id, version2).await?;

    if v1.is_none() || v2.is_none() {
        return Err(sqlx::Error::RowNotFound);
    }

    let v1_data = v1.unwrap().data_snapshot;
    let v2_data = v2.unwrap().data_snapshot;

    // Comparaison simple des champs principaux
    let mut differences = serde_json::json!({});

    let fields_to_compare = vec![
        "titre",
        "description",
        "cout",
        "duree_jours",
        "status",
        "zone_geographique",
        "targeting",
        "schedule",
        "placements",
        "bid_strategy",
        "retargeting",
    ];

    for field in fields_to_compare {
        let v1_val = v1_data.get(field);
        let v2_val = v2_data.get(field);

        if v1_val != v2_val {
            differences[field] = serde_json::json!({
                "from": v1_val,
                "to": v2_val
            });
        }
    }

    Ok(differences)
}
