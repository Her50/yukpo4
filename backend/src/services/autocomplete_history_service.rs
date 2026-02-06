// Service pour gérer l'historique des caractéristiques autocomplete
use crate::core::types::AppError;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use sqlx::Row;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutocompleteCharacteristic {
    pub id: i32,
    pub identifiant_base: String,
    pub sous_caracteristique: String,
    pub valeur: String,
    pub origine_champs: String,
    pub user_id: Option<i32>,
    pub service_id: Option<i32>,
    pub usage_count: i32,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutocompleteSuggestion {
    pub valeur: String,
    pub usage_count: i32,
}

/// Insérer ou mettre à jour une caractéristique autocomplete
pub async fn upsert_autocomplete_characteristic(
    pool: &PgPool,
    identifiant_base: &str,
    sous_caracteristique: &str,
    valeur: &str,
    origine_champs: &str,
    user_id: Option<i32>,
    service_id: Option<i32>,
) -> Result<i32, AppError> {
    log::info!(
        "[AutocompleteHistoryService] Upsert caractéristique: {} > {} = {}",
        identifiant_base,
        sous_caracteristique,
        valeur
    );

    // Utiliser la fonction SQL upsert_autocomplete_characteristic
    let row = sqlx::query(
        r#"
        SELECT upsert_autocomplete_characteristic(
            $1, $2, $3, $4, $5, $6
        ) as id
        "#,
    )
    .bind(identifiant_base)
    .bind(sous_caracteristique)
    .bind(valeur)
    .bind(origine_champs)
    .bind(user_id)
    .bind(service_id)
    .fetch_one(pool)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur upsert caractéristique: {}", e)))?;

    let id: i32 = row.get::<i32, _>("id");
    log::info!(
        "[AutocompleteHistoryService] ✅ Caractéristique sauvegardée: {}",
        id
    );

    Ok(id)
}

/// Historiser plusieurs caractéristiques autocomplete depuis un champ autocomplete
pub async fn historize_autocomplete_field(
    pool: &PgPool,
    identifiant_base: &str,
    valeurs: &[String],
    separateur: &str,
    sous_caracteristiques: &serde_json::Value,
    origine_champs: &str,
    user_id: Option<i32>,
    service_id: Option<i32>,
) -> Result<Vec<i32>, AppError> {
    log::info!(
        "[AutocompleteHistoryService] Historisation champ autocomplete: {} ({} valeurs)",
        identifiant_base,
        valeurs.len()
    );

    let mut ids = Vec::new();

    // Extraire les noms des sous-caractéristiques depuis le JSON
    let sous_caracs_obj = if let Some(obj) = sous_caracteristiques.as_object() {
        obj
    } else {
        log::warn!("[AutocompleteHistoryService] sous_caracteristiques n'est pas un objet");
        return Ok(ids);
    };

    // Pour chaque valeur concaténée, la découper et historiser chaque sous-caractéristique
    for valeur_concat in valeurs {
        let parts: Vec<&str> = valeur_concat.split(separateur).map(|s| s.trim()).collect();

        // Historiser chaque sous-caractéristique
        for (idx, sous_carac_name) in sous_caracs_obj.keys().enumerate() {
            if let Some(valeur_part) = parts.get(idx) {
                if !valeur_part.is_empty() {
                    match upsert_autocomplete_characteristic(
                        pool,
                        identifiant_base,
                        sous_carac_name,
                        valeur_part,
                        origine_champs,
                        user_id,
                        service_id,
                    )
                    .await
                    {
                        Ok(id) => ids.push(id),
                        Err(e) => {
                            log::warn!(
                                "[AutocompleteHistoryService] Erreur historisation {}: {}",
                                sous_carac_name,
                                e
                            );
                        }
                    }
                }
            }
        }
    }

    log::info!(
        "[AutocompleteHistoryService] ✅ {} caractéristiques historisées",
        ids.len()
    );
    Ok(ids)
}

/// Récupérer les suggestions pour une sous-caractéristique donnée
pub async fn get_autocomplete_suggestions(
    pool: &PgPool,
    identifiant_base: &str,
    sous_caracteristique: &str,
    prefix: Option<&str>,
    limit: i64,
) -> Result<Vec<AutocompleteSuggestion>, AppError> {
    let rows = if let Some(prefix) = prefix {
        sqlx::query(
            r#"
            SELECT valeur, usage_count
            FROM autocomplete_characteristics
            WHERE identifiant_base = $1
            AND sous_caracteristique = $2
            AND LOWER(valeur) LIKE LOWER($3 || '%')
            ORDER BY usage_count DESC, valeur ASC
            LIMIT $4
            "#,
        )
        .bind(identifiant_base)
        .bind(sous_caracteristique)
        .bind(prefix)
        .bind(limit)
        .fetch_all(pool)
        .await
    } else {
        sqlx::query(
            r#"
            SELECT valeur, usage_count
            FROM autocomplete_characteristics
            WHERE identifiant_base = $1
            AND sous_caracteristique = $2
            ORDER BY usage_count DESC, valeur ASC
            LIMIT $3
            "#,
        )
        .bind(identifiant_base)
        .bind(sous_caracteristique)
        .bind(limit)
        .fetch_all(pool)
        .await
    }
    .map_err(|e| AppError::Internal(format!("Erreur récupération suggestions: {}", e)))?;

    let suggestions = rows
        .iter()
        .map(|row| AutocompleteSuggestion {
            valeur: row.get::<String, _>("valeur"),
            usage_count: row.get::<i32, _>("usage_count"),
        })
        .collect();

    Ok(suggestions)
}

/// Récupérer toutes les sous-caractéristiques disponibles pour un identifiant_base
pub async fn get_sub_characteristics(
    pool: &PgPool,
    identifiant_base: &str,
) -> Result<Vec<String>, AppError> {
    let rows = sqlx::query(
        r#"
        SELECT DISTINCT sous_caracteristique
        FROM autocomplete_characteristics
        WHERE identifiant_base = $1
        ORDER BY sous_caracteristique ASC
        "#,
    )
    .bind(identifiant_base)
    .fetch_all(pool)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur récupération sous-caractéristiques: {}", e)))?;

    let sub_chars: Vec<String> =
        rows.iter().map(|row| row.get::<String, _>("sous_caracteristique")).collect();
    Ok(sub_chars)
}

/// Récupérer toutes les valeurs pour une combinaison identifiant_base + sous_caracteristique
pub async fn get_all_values(
    pool: &PgPool,
    identifiant_base: &str,
    sous_caracteristique: &str,
) -> Result<Vec<String>, AppError> {
    let rows = sqlx::query(
        r#"
        SELECT DISTINCT valeur
        FROM autocomplete_characteristics
        WHERE identifiant_base = $1
        AND sous_caracteristique = $2
        ORDER BY usage_count DESC, valeur ASC
        "#,
    )
    .bind(identifiant_base)
    .bind(sous_caracteristique)
    .fetch_all(pool)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur récupération valeurs: {}", e)))?;

    let values: Vec<String> = rows.iter().map(|row| row.get::<String, _>("valeur")).collect();
    Ok(values)
}

/// Supprimer une caractéristique (pour nettoyage)
pub async fn delete_autocomplete_characteristic(pool: &PgPool, id: i32) -> Result<bool, AppError> {
    let result = sqlx::query("DELETE FROM autocomplete_characteristics WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur suppression caractéristique: {}", e)))?;

    Ok(result.rows_affected() > 0)
}
