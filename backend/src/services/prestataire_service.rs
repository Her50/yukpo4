use crate::core::types::AppResult;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;

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
    // ✅ CORRIGÉ 2026-02-16: Utiliser nom_complet stocké au lieu de le reconstruire
    // Priorité: nom_complet > prenom + nom > email
    let result = sqlx::query_as!(
        PrestataireInfo,
        r#"
        SELECT 
            id,
            COALESCE(
                NULLIF(TRIM(nom_complet), ''),
                CASE 
                    WHEN TRIM(COALESCE(prenom, '') || ' ' || COALESCE(nom, '')) != '' 
                    THEN TRIM(COALESCE(prenom, '') || ' ' || COALESCE(nom, ''))
                    ELSE split_part(email, '@', 1)
                END
            ) as nom_complet,
            email,
            is_provider,
            gps,
            photo_profil,
            avatar_url,
            created_at AS "created_at: chrono::DateTime<chrono::Utc>"
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

    // ✅ CORRIGÉ 2026-02-16: Utiliser nom_complet stocké au lieu de le reconstruire
    let result = sqlx::query_as!(
        PrestataireInfo,
        r#"
        SELECT 
            id,
            COALESCE(
                NULLIF(TRIM(nom_complet), ''),
                CASE 
                    WHEN TRIM(COALESCE(prenom, '') || ' ' || COALESCE(nom, '')) != '' 
                    THEN TRIM(COALESCE(prenom, '') || ' ' || COALESCE(nom, ''))
                    ELSE split_part(email, '@', 1)
                END
            ) as nom_complet,
            email,
            is_provider,
            gps,
            photo_profil,
            avatar_url,
            created_at AS "created_at: chrono::DateTime<chrono::Utc>"
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
pub async fn get_all_prestataires(pool: &PgPool) -> AppResult<Vec<PrestataireInfo>> {
    // ✅ CORRIGÉ 2026-02-16: Utiliser nom_complet stocké au lieu de le reconstruire
    let result = sqlx::query_as!(
        PrestataireInfo,
        r#"
        SELECT 
            id,
            COALESCE(
                NULLIF(TRIM(nom_complet), ''),
                CASE 
                    WHEN TRIM(COALESCE(prenom, '') || ' ' || COALESCE(nom, '')) != '' 
                    THEN TRIM(COALESCE(prenom, '') || ' ' || COALESCE(nom, ''))
                    ELSE split_part(email, '@', 1)
                END
            ) as nom_complet,
            email,
            is_provider,
            gps,
            photo_profil,
            avatar_url,
            created_at AS "created_at: chrono::DateTime<chrono::Utc>"
        FROM users 
        WHERE is_provider = true
        ORDER BY COALESCE(
                NULLIF(TRIM(nom_complet), ''),
                CASE 
                    WHEN TRIM(COALESCE(prenom, '') || ' ' || COALESCE(nom, '')) != '' 
                    THEN TRIM(COALESCE(prenom, '') || ' ' || COALESCE(nom, ''))
                    ELSE split_part(email, '@', 1)
                END
            ), created_at
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
    // ✅ CORRIGÉ 2026-02-16: Utiliser build_full_name pour éviter les duplications
    use crate::utils::normalize_name::build_full_name;
    let nom_complet = build_full_name(nom, prenom, None);

    sqlx::query(
        r#"
        UPDATE users 
        SET 
            nom = COALESCE($1, nom),
            prenom = COALESCE($2, prenom),
            nom_complet = COALESCE($3, nom_complet),
            updated_at = NOW()
        WHERE id = $4
        "#,
    )
    .bind(nom.as_deref())
    .bind(prenom.as_deref())
    .bind(nom_complet.as_deref())
    .bind(user_id)
    .execute(pool)
    .await?;

    Ok(())
}
