use crate::core::types::{AppError, AppResult};
use crate::models::offres_emploi_model::StatistiquesOffre;
use crate::utils::redis_helper;
use bigdecimal::BigDecimal;
use log::{error, info};
use serde_json::{json, Value};
use sqlx::{PgPool, Row};
use std::str::FromStr;

// Helper pour convertir f64 en BigDecimal
fn f64_to_bigdecimal(value: f64) -> BigDecimal {
    BigDecimal::from_str(&value.to_string()).unwrap_or_default()
}

/// Service pour les statistiques d'emploi
pub struct StatistiquesEmploiService {
    pool: PgPool,
    redis_client: Option<redis::Client>,
}

impl StatistiquesEmploiService {
    pub fn new(pool: PgPool, redis_client: Option<redis::Client>) -> Self {
        Self { pool, redis_client }
    }

    /// Calcule les statistiques d'une offre
    pub async fn calculate_offre_stats(&self, offre_id: i32) -> AppResult<StatistiquesOffre> {
        info!(
            "[calculate_offre_stats] Calcul stats pour offre_id={}",
            offre_id
        );

        // Vérifier le cache
        let cache_key = format!("emploi:stats:{}", offre_id);
        if let Some(redis) = &self.redis_client {
            if let Ok(Some(cached)) = redis_helper::get_with_retry(redis, &cache_key).await {
                if let Ok(stats) = serde_json::from_str::<StatistiquesOffre>(&cached) {
                    return Ok(stats);
                }
            }
        }

        // Récupérer les métriques de base
        let offre = sqlx::query!(
            "SELECT nombre_vues, nombre_candidatures FROM offres_emploi WHERE id = $1",
            offre_id
        )
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| {
            error!("[calculate_offre_stats] Erreur: {}", e);
            AppError::Internal(format!("Erreur récupération offre: {}", e))
        })?
        .ok_or_else(|| AppError::NotFound("Offre non trouvée".to_string()))?;

        let nombre_vues = offre.nombre_vues.unwrap_or(0);
        let nombre_candidatures = offre.nombre_candidatures.unwrap_or(0);

        // Compter les candidatures qualifiées (score > 70)
        let nombre_candidatures_qualifiees: i32 = sqlx::query_scalar(
            "SELECT COUNT(*)::int FROM candidatures WHERE offre_id = $1 AND score_matching > 70",
        )
        .bind(offre_id)
        .fetch_one(&self.pool)
        .await
        .unwrap_or(0);

        // Calculer le taux de conversion
        let taux_conversion = if nombre_vues > 0 {
            let value = (nombre_candidatures as f64 / nombre_vues as f64) * 100.0;
            Some(f64_to_bigdecimal(value))
        } else {
            None
        };

        // Répartition par expérience
        let repartition_experience_rows = sqlx::query(
            r#"
            SELECT
                CASE
                    WHEN p.experience_annees < 2 THEN '0-2'
                    WHEN p.experience_annees < 5 THEN '3-5'
                    WHEN p.experience_annees < 10 THEN '6-10'
                    ELSE '10+'
                END as tranche,
                COUNT(*)::bigint as count
            FROM candidatures c
            JOIN profils_candidats p ON p.id = c.profil_id
            WHERE c.offre_id = $1
            GROUP BY
                CASE
                    WHEN p.experience_annees < 2 THEN '0-2'
                    WHEN p.experience_annees < 5 THEN '3-5'
                    WHEN p.experience_annees < 10 THEN '6-10'
                    ELSE '10+'
                END
            "#,
        )
        .bind(offre_id)
        .fetch_all(&self.pool)
        .await
        .unwrap_or_default();

        let mut repartition_experience = json!({});
        for row in repartition_experience_rows {
            let tranche: String = row.get("tranche");
            let count: i64 = row.get("count");
            repartition_experience[tranche] = json!(count);
        }

        // Répartition par niveau d'étude
        let repartition_niveau_etude: Value = sqlx::query_scalar(
            r#"
            SELECT jsonb_object_agg(p.niveau_etude, COUNT(*)::text)
            FROM candidatures c
            JOIN profils_candidats p ON p.id = c.profil_id
            WHERE c.offre_id = $1 AND p.niveau_etude IS NOT NULL
            GROUP BY p.niveau_etude
            "#,
        )
        .bind(offre_id)
        .fetch_optional(&self.pool)
        .await
        .unwrap_or(None)
        .unwrap_or(json!({}));

        // Répartition par localisation
        let repartition_localisation: Value = sqlx::query_scalar(
            r#"
            SELECT jsonb_object_agg(COALESCE(p.ville, 'Non renseigné'), COUNT(*)::text)
            FROM candidatures c
            JOIN profils_candidats p ON p.id = c.profil_id
            WHERE c.offre_id = $1
            GROUP BY p.ville
            "#,
        )
        .bind(offre_id)
        .fetch_optional(&self.pool)
        .await
        .unwrap_or(None)
        .unwrap_or(json!({}));

        // Créer ou mettre à jour les statistiques
        let stats = sqlx::query_as::<_, StatistiquesOffre>(
            r#"
            INSERT INTO statistiques_offres (
                offre_id, nombre_vues, nombre_candidatures, nombre_candidatures_qualifiees,
                taux_conversion, repartition_experience, repartition_niveau_etude,
                repartition_localisation
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (offre_id)
            DO UPDATE SET
                nombre_vues = EXCLUDED.nombre_vues,
                nombre_candidatures = EXCLUDED.nombre_candidatures,
                nombre_candidatures_qualifiees = EXCLUDED.nombre_candidatures_qualifiees,
                taux_conversion = EXCLUDED.taux_conversion,
                repartition_experience = EXCLUDED.repartition_experience,
                repartition_niveau_etude = EXCLUDED.repartition_niveau_etude,
                repartition_localisation = EXCLUDED.repartition_localisation,
                date_calcul = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *
            "#,
        )
        .bind(offre_id)
        .bind(nombre_vues)
        .bind(nombre_candidatures)
        .bind(nombre_candidatures_qualifiees)
        .bind(taux_conversion)
        .bind(serde_json::to_string(&repartition_experience).unwrap_or_default())
        .bind(serde_json::to_string(&repartition_niveau_etude).unwrap_or_default())
        .bind(serde_json::to_string(&repartition_localisation).unwrap_or_default())
        .fetch_one(&self.pool)
        .await
        .map_err(|e| {
            error!("[calculate_offre_stats] Erreur: {}", e);
            AppError::Internal(format!("Erreur calcul stats: {}", e))
        })?;

        // Mettre en cache
        if let Some(redis) = &self.redis_client {
            let cache_data = serde_json::to_string(&stats).unwrap_or_default();
            let _ = redis_helper::set_with_retry(redis, &cache_key, &cache_data, Some(3600)).await;
            // TTL 1 heure
        }

        info!("[calculate_offre_stats] ✅ Stats calculées");
        Ok(stats)
    }

    /// Tableau de bord employeur
    pub async fn get_dashboard_employeur(&self, entreprise_id: i32) -> AppResult<Value> {
        info!(
            "[get_dashboard_employeur] Dashboard pour entreprise_id={}",
            entreprise_id
        );

        // Vérifier le cache
        let cache_key = format!("emploi:dashboard:employeur:{}", entreprise_id);
        if let Some(redis) = &self.redis_client {
            if let Ok(Some(cached)) = redis_helper::get_with_retry(redis, &cache_key).await {
                if let Ok(dashboard) = serde_json::from_str::<Value>(&cached) {
                    return Ok(dashboard);
                }
            }
        }

        // Nombre total d'offres
        let total_offres: i64 = sqlx::query_scalar(
            "SELECT COUNT(*)::bigint FROM offres_emploi WHERE entreprise_id = $1",
        )
        .bind(entreprise_id)
        .fetch_one(&self.pool)
        .await
        .unwrap_or(0);

        // Offres actives
        let offres_actives: i64 = sqlx::query_scalar(
            "SELECT COUNT(*)::bigint FROM offres_emploi WHERE entreprise_id = $1 AND statut = 'active' AND is_active = true"
        )
        .bind(entreprise_id)
        .fetch_one(&self.pool)
        .await
        .unwrap_or(0);

        // Total candidatures
        let total_candidatures: i64 = sqlx::query_scalar(
            r#"
            SELECT COUNT(*)::bigint FROM candidatures c
            JOIN offres_emploi o ON o.id = c.offre_id
            WHERE o.entreprise_id = $1
            "#,
        )
        .bind(entreprise_id)
        .fetch_one(&self.pool)
        .await
        .unwrap_or(0);

        // Candidatures en attente
        let candidatures_attente: i64 = sqlx::query_scalar(
            r#"
            SELECT COUNT(*)::bigint FROM candidatures c
            JOIN offres_emploi o ON o.id = c.offre_id
            WHERE o.entreprise_id = $1 AND c.statut = 'en_attente'
            "#,
        )
        .bind(entreprise_id)
        .fetch_one(&self.pool)
        .await
        .unwrap_or(0);

        // Top offres par candidatures
        let top_offres: Vec<Value> = sqlx::query(
            r#"
            SELECT o.id, o.titre_poste, COUNT(c.id)::bigint as nb_candidatures
            FROM offres_emploi o
            LEFT JOIN candidatures c ON c.offre_id = o.id
            WHERE o.entreprise_id = $1
            GROUP BY o.id, o.titre_poste
            ORDER BY nb_candidatures DESC
            LIMIT 5
            "#,
        )
        .bind(entreprise_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| {
            error!("[get_dashboard_employeur] Erreur: {}", e);
            AppError::Internal(format!("Erreur dashboard: {}", e))
        })?
        .iter()
        .map(|row| {
            json!({
                "id": row.get::<i32, _>("id"),
                "titre_poste": row.get::<String, _>("titre_poste"),
                "nb_candidatures": row.get::<i64, _>("nb_candidatures")
            })
        })
        .collect();

        let dashboard = json!({
            "total_offres": total_offres,
            "offres_actives": offres_actives,
            "total_candidatures": total_candidatures,
            "candidatures_attente": candidatures_attente,
            "top_offres": top_offres
        });

        // Mettre en cache
        if let Some(redis) = &self.redis_client {
            let cache_data = serde_json::to_string(&dashboard).unwrap_or_default();
            let _ = redis_helper::set_with_retry(redis, &cache_key, &cache_data, Some(900)).await;
            // TTL 15 min
        }

        Ok(dashboard)
    }

    /// Tableau de bord candidat
    pub async fn get_dashboard_candidat(&self, candidat_id: i32) -> AppResult<Value> {
        info!(
            "[get_dashboard_candidat] Dashboard pour candidat_id={}",
            candidat_id
        );

        // Vérifier le cache
        let cache_key = format!("emploi:dashboard:candidat:{}", candidat_id);
        if let Some(redis) = &self.redis_client {
            if let Ok(Some(cached)) = redis_helper::get_with_retry(redis, &cache_key).await {
                if let Ok(dashboard) = serde_json::from_str::<Value>(&cached) {
                    return Ok(dashboard);
                }
            }
        }

        // Total candidatures
        let total_candidatures: i64 =
            sqlx::query_scalar("SELECT COUNT(*)::bigint FROM candidatures WHERE candidat_id = $1")
                .bind(candidat_id)
                .fetch_one(&self.pool)
                .await
                .unwrap_or(0);

        // Candidatures en attente
        let candidatures_attente: i64 = sqlx::query_scalar(
            "SELECT COUNT(*)::bigint FROM candidatures WHERE candidat_id = $1 AND statut = 'en_attente'"
        )
        .bind(candidat_id)
        .fetch_one(&self.pool)
        .await
        .unwrap_or(0);

        // Candidatures acceptées
        let candidatures_acceptees: i64 = sqlx::query_scalar(
            "SELECT COUNT(*)::bigint FROM candidatures WHERE candidat_id = $1 AND statut = 'acceptee'"
        )
        .bind(candidat_id)
        .fetch_one(&self.pool)
        .await
        .unwrap_or(0);

        // Meilleurs matchings (score > 70)
        let meilleurs_matchings: i64 = sqlx::query_scalar(
            "SELECT COUNT(*)::bigint FROM matching_offres_candidats WHERE candidat_id = $1 AND score_total >= 70"
        )
        .bind(candidat_id)
        .fetch_one(&self.pool)
        .await
        .unwrap_or(0);

        let dashboard = json!({
            "total_candidatures": total_candidatures,
            "candidatures_attente": candidatures_attente,
            "candidatures_acceptees": candidatures_acceptees,
            "meilleurs_matchings": meilleurs_matchings
        });

        // Mettre en cache
        if let Some(redis) = &self.redis_client {
            let cache_data = serde_json::to_string(&dashboard).unwrap_or_default();
            let _ = redis_helper::set_with_retry(redis, &cache_key, &cache_data, Some(900)).await;
            // TTL 15 min
        }

        Ok(dashboard)
    }

    /// Tendances du marché (secteurs, salaires)
    pub async fn get_tendance_marche(&self) -> AppResult<Value> {
        info!("[get_tendance_marche] Calcul tendances marché");

        // Vérifier le cache
        let cache_key = "emploi:tendances:marche";
        if let Some(redis) = &self.redis_client {
            if let Ok(Some(cached)) = redis_helper::get_with_retry(redis, cache_key).await {
                if let Ok(tendances) = serde_json::from_str::<Value>(&cached) {
                    return Ok(tendances);
                }
            }
        }

        // Top secteurs
        let top_secteurs: Vec<Value> = sqlx::query(
            r#"
            SELECT secteur, COUNT(*)::bigint as nb_offres
            FROM offres_emploi
            WHERE statut = 'active' AND is_active = true
            GROUP BY secteur
            ORDER BY nb_offres DESC
            LIMIT 10
            "#,
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| {
            error!("[get_tendance_marche] Erreur: {}", e);
            AppError::Internal(format!("Erreur tendances: {}", e))
        })?
        .iter()
        .map(|row| {
            json!({
                "secteur": row.get::<String, _>("secteur"),
                "nb_offres": row.get::<i64, _>("nb_offres")
            })
        })
        .collect();

        // Salaires moyens par secteur
        let salaires_moyens: Vec<Value> = sqlx::query(
            r#"
            SELECT secteur, AVG((salaire_min + salaire_max) / 2) as salaire_moyen
            FROM offres_emploi
            WHERE statut = 'active' AND is_active = true
            AND salaire_min IS NOT NULL AND salaire_max IS NOT NULL
            GROUP BY secteur
            ORDER BY salaire_moyen DESC
            LIMIT 10
            "#,
        )
        .fetch_all(&self.pool)
        .await
        .unwrap_or_default()
        .iter()
        .map(|row| {
            json!({
                "secteur": row.get::<String, _>("secteur"),
                "salaire_moyen": row.get::<Option<BigDecimal>, _>("salaire_moyen")
            })
        })
        .collect();

        let tendances = json!({
            "top_secteurs": top_secteurs,
            "salaires_moyens": salaires_moyens
        });

        // Mettre en cache
        if let Some(redis) = &self.redis_client {
            let cache_data = serde_json::to_string(&tendances).unwrap_or_default();
            let _ = redis_helper::set_with_retry(redis, cache_key, &cache_data, Some(3600)).await;
            // TTL 1 heure
        }

        Ok(tendances)
    }
}
