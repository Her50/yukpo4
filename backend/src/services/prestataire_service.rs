use crate::core::types::AppResult;
use sqlx::PgPool;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct PrestataireInfo {
    pub id: i32,
    pub nom_complet: Option<String>,
    pub email: String,
    pub is_provider: bool,
    pub gps: Option<String>,
    pub photo_profil: Option<String>,
    pub avatar_url: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

/// Récupère les informations d'un prestataire par son ID
pub async fn get_prestataire_info(
    pool: &PgPool,
    user_id: i32,
) -> AppResult<Option<PrestataireInfo>> {
    let result = sqlx::query_as!(
        PrestataireInfo,
        r#"
        SELECT 
            id,
            CASE 
                WHEN TRIM(COALESCE(nom, '') || ' ' || COALESCE(prenom, '')) = '' 
                THEN split_part(email, '@', 1)
                ELSE TRIM(COALESCE(nom, '') || ' ' || COALESCE(prenom, ''))
            END as nom_complet,
            email,
            is_provider,
            gps,
            photo_profil,
            avatar_url,
            created_at
        FROM users 
        WHERE id = $1
        "#,
        user_id
    )
    .fetch_optional(pool)
    .await?;

    Ok(result)
}

/// Récupère les informations de plusieurs prestataires par leurs IDs
pub async fn get_prestataires_info_batch(
    pool: &PgPool,
    user_ids: &[i32],
) -> AppResult<Vec<PrestataireInfo>> {
    if user_ids.is_empty() {
        return Ok(Vec::new());
    }

    let result = sqlx::query_as!(
        PrestataireInfo,
        r#"
        SELECT 
            id,
            CASE 
                WHEN TRIM(COALESCE(nom, '') || ' ' || COALESCE(prenom, '')) = '' 
                THEN split_part(email, '@', 1)
                ELSE TRIM(COALESCE(nom, '') || ' ' || COALESCE(prenom, ''))
            END as nom_complet,
            email,
            is_provider,
            gps,
            photo_profil,
            avatar_url,
            created_at
        FROM users 
        WHERE id = ANY($1)
        ORDER BY id
        "#,
        user_ids
    )
    .fetch_all(pool)
    .await?;

    Ok(result)
}

/// Récupère tous les prestataires avec leurs informations
pub async fn get_all_prestataires(
    pool: &PgPool,
) -> AppResult<Vec<PrestataireInfo>> {
    let result = sqlx::query_as!(
        PrestataireInfo,
        r#"
        SELECT 
            id,
            CASE 
                WHEN TRIM(COALESCE(nom, '') || ' ' || COALESCE(prenom, '')) = '' 
                THEN split_part(email, '@', 1)
                ELSE TRIM(COALESCE(nom, '') || ' ' || COALESCE(prenom, ''))
            END as nom_complet,
            email,
            is_provider,
            gps,
            photo_profil,
            avatar_url,
            created_at
        FROM users 
        WHERE is_provider = true
        ORDER BY CASE 
                WHEN TRIM(COALESCE(nom, '') || ' ' || COALESCE(prenom, '')) = '' 
                THEN split_part(email, '@', 1)
                ELSE TRIM(COALESCE(nom, '') || ' ' || COALESCE(prenom, ''))
            END, created_at
        "#
    )
    .fetch_all(pool)
    .await?;

    Ok(result)
}

/// Met à jour le nom d'un utilisateur
pub async fn update_user_name(
    pool: &PgPool,
    user_id: i32,
    nom: Option<&str>,
    prenom: Option<&str>,
) -> AppResult<()> {
    let nom_complet = match (nom, prenom) {
        (Some(n), Some(p)) => Some(format!("{} {}", n, p)),
        (Some(n), None) => Some(n.to_string()),
        (None, Some(p)) => Some(p.to_string()),
        (None, None) => None,
    };

    sqlx::query!(
        r#"
        UPDATE users 
        SET 
            nom = COALESCE($1, nom),
            prenom = COALESCE($2, prenom),
            nom_complet = COALESCE($3, nom_complet),
            updated_at = NOW()
        WHERE id = $4
        "#,
        nom,
        prenom,
        nom_complet,
        user_id
    )
    .execute(pool)
    .await?;

    Ok(())
} 