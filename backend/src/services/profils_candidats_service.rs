use crate::core::types::{AppError, AppResult};
use crate::models::offres_emploi_model::{CreateOrUpdateProfilRequest, ProfilCandidat};
use crate::utils::redis_helper;
use bigdecimal::BigDecimal;
use log::{error, info};
use sqlx::PgPool;
use std::str::FromStr;

/// Service pour la gestion des profils candidats
pub struct ProfilsCandidatsService {
    pool: PgPool,
    redis_client: Option<redis::Client>,
}

impl ProfilsCandidatsService {
    pub fn new(pool: PgPool, redis_client: Option<redis::Client>) -> Self {
        Self { pool, redis_client }
    }

    /// Crée ou met à jour un profil candidat
    pub async fn create_or_update_profil(
        &self,
        user_id: i32,
        request: CreateOrUpdateProfilRequest,
    ) -> AppResult<ProfilCandidat> {
        info!(
            "[create_or_update_profil] Création/mise à jour profil pour user_id={}",
            user_id
        );

        // Convertir GPS en location_point si fourni
        let location_point = if let Some(gps) = &request.gps {
            if let Some((lat, lng)) = parse_gps(gps) {
                Some(format!("POINT({} {})", lng, lat))
            } else {
                None
            }
        } else {
            None
        };

        // Convertir salaires en BigDecimal
        let salaire_min = request
            .salaire_souhaite_min
            .map(|s| BigDecimal::from_str(&s.to_string()).unwrap_or_default());
        let salaire_max = request
            .salaire_souhaite_max
            .map(|s| BigDecimal::from_str(&s.to_string()).unwrap_or_default());

        // Vérifier si le profil existe déjà
        let existing = sqlx::query_as::<_, ProfilCandidat>(
            "SELECT * FROM profils_candidats WHERE user_id = $1",
        )
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| {
            error!("[create_or_update_profil] Erreur vérification: {}", e);
            AppError::Internal(format!("Erreur vérification profil: {}", e))
        })?;

        let profil = if existing.is_some() {
            // Mise à jour
            info!("[create_or_update_profil] Mise à jour profil existant");
            sqlx::query_as::<_, ProfilCandidat>(
                r#"
                UPDATE profils_candidats SET
                    nom_complet = $2,
                    date_naissance = $3,
                    telephone = $4,
                    email = $5,
                    adresse = $6,
                    ville = $7,
                    gps = $8,
                    location_point = CASE WHEN $9 IS NOT NULL THEN ST_GeogFromText($9) ELSE location_point END,
                    titre_professionnel = $10,
                    niveau_etude = $11,
                    experience_annees = COALESCE($12, experience_annees),
                    secteur_principal = $13,
                    competences = $14,
                    langues = $15,
                    permis = $16,
                    certifications = $17,
                    cv_url = $18,
                    cv_nom = $19,
                    photo_url = $20,
                    portfolio_url = $21,
                    type_contrat_souhaite = $22,
                    salaire_souhaite_min = $23,
                    salaire_souhaite_max = $24,
                    remote_souhaite = COALESCE($25, remote_souhaite),
                    secteurs_interesses = $26,
                    disponible_immediatement = COALESCE($27, disponible_immediatement),
                    date_disponibilite = $28,
                    updated_at = CURRENT_TIMESTAMP
                WHERE user_id = $1
                RETURNING *
                "#,
            )
            .bind(user_id)
            .bind(&request.nom_complet)
            .bind(request.date_naissance)
            .bind(&request.telephone)
            .bind(&request.email)
            .bind(&request.adresse)
            .bind(&request.ville)
            .bind(&request.gps)
            .bind(&location_point)
            .bind(&request.titre_professionnel)
            .bind(&request.niveau_etude)
            .bind(request.experience_annees)
            .bind(&request.secteur_principal)
            .bind(request.competences.as_deref())
            .bind(request.langues.as_ref().map(|v| serde_json::to_string(v).unwrap_or_default()))
            .bind(request.permis.as_deref())
            .bind(request.certifications.as_deref())
            .bind(&request.cv_url)
            .bind(&request.cv_nom)
            .bind(&request.photo_url)
            .bind(&request.portfolio_url)
            .bind(request.type_contrat_souhaite.as_deref())
            .bind(salaire_min)
            .bind(salaire_max)
            .bind(request.remote_souhaite)
            .bind(request.secteurs_interesses.as_deref())
            .bind(request.disponible_immediatement)
            .bind(request.date_disponibilite)
            .fetch_one(&self.pool)
            .await
            .map_err(|e| {
                error!("[create_or_update_profil] Erreur mise à jour: {}", e);
                AppError::Internal(format!("Erreur mise à jour profil: {}", e))
            })?
        } else {
            // Création
            info!("[create_or_update_profil] Création nouveau profil");
            sqlx::query_as::<_, ProfilCandidat>(
                r#"
                INSERT INTO profils_candidats (
                    user_id, nom_complet, date_naissance, telephone, email, adresse, ville,
                    gps, location_point, titre_professionnel, niveau_etude, experience_annees,
                    secteur_principal, competences, langues, permis, certifications,
                    cv_url, cv_nom, photo_url, portfolio_url,
                    type_contrat_souhaite, salaire_souhaite_min, salaire_souhaite_max,
                    remote_souhaite, secteurs_interesses, disponible_immediatement, date_disponibilite
                )
                VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8,
                    CASE WHEN $9 IS NOT NULL THEN ST_GeogFromText($9) ELSE NULL END,
                    $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21,
                    $22, $23, $24, $25, $26, $27, $28
                )
                RETURNING *
                "#,
            )
            .bind(user_id)
            .bind(&request.nom_complet)
            .bind(request.date_naissance)
            .bind(&request.telephone)
            .bind(&request.email)
            .bind(&request.adresse)
            .bind(&request.ville)
            .bind(&request.gps)
            .bind(&location_point)
            .bind(&request.titre_professionnel)
            .bind(&request.niveau_etude)
            .bind(request.experience_annees.unwrap_or(0))
            .bind(&request.secteur_principal)
            .bind(request.competences.as_deref())
            .bind(request.langues.as_ref().map(|v| serde_json::to_string(v).unwrap_or_default()))
            .bind(request.permis.as_deref())
            .bind(request.certifications.as_deref())
            .bind(&request.cv_url)
            .bind(&request.cv_nom)
            .bind(&request.photo_url)
            .bind(&request.portfolio_url)
            .bind(request.type_contrat_souhaite.as_deref())
            .bind(salaire_min)
            .bind(salaire_max)
            .bind(request.remote_souhaite.unwrap_or(false))
            .bind(request.secteurs_interesses.as_deref())
            .bind(request.disponible_immediatement.unwrap_or(false))
            .bind(request.date_disponibilite)
            .fetch_one(&self.pool)
            .await
            .map_err(|e| {
                error!("[create_or_update_profil] Erreur création: {}", e);
                AppError::Internal(format!("Erreur création profil: {}", e))
            })?
        };

        // Invalider le cache
        self.invalidate_profil_cache(user_id).await;

        info!(
            "[create_or_update_profil] ✅ Profil créé/mis à jour avec id={}",
            profil.id
        );
        Ok(profil)
    }

    /// Récupère un profil candidat
    pub async fn get_profil(&self, user_id: i32) -> AppResult<ProfilCandidat> {
        // Vérifier le cache
        let cache_key = format!("emploi:profil:{}", user_id);
        if let Some(redis) = &self.redis_client {
            if let Ok(Some(cached)) = redis_helper::get_with_retry(redis, &cache_key).await {
                if let Ok(profil) = serde_json::from_str::<ProfilCandidat>(&cached) {
                    return Ok(profil);
                }
            }
        }

        let profil = sqlx::query_as::<_, ProfilCandidat>(
            "SELECT * FROM profils_candidats WHERE user_id = $1",
        )
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| {
            error!("[get_profil] Erreur: {}", e);
            AppError::Internal(format!("Erreur récupération profil: {}", e))
        })?
        .ok_or_else(|| AppError::NotFound("Profil non trouvé".to_string()))?;

        // Mettre en cache
        if let Some(redis) = &self.redis_client {
            let cache_data = serde_json::to_string(&profil).unwrap_or_default();
            let _ = redis_helper::set_with_retry(redis, &cache_key, &cache_data, Some(1800)).await;
            // TTL 30 min
        }

        Ok(profil)
    }

    /// Recherche de candidats (pour employeurs)
    pub async fn search_candidats(
        &self,
        secteur: Option<String>,
        _competences: Option<Vec<String>>,
        experience_min: Option<i32>,
        disponible: Option<bool>,
        page: Option<i64>,
        limit: Option<i64>,
    ) -> AppResult<(Vec<ProfilCandidat>, i64)> {
        info!("[search_candidats] Recherche candidats");

        let page = page.unwrap_or(1).max(1);
        let limit = limit.unwrap_or(20).clamp(1, 100);
        let offset = (page - 1) * limit;

        // Construire la requête avec filtres
        let mut query = String::from("SELECT * FROM profils_candidats WHERE is_active = true");

        if let Some(sect) = &secteur {
            query.push_str(&format!(
                " AND secteur_principal = '{}'",
                sect.replace("'", "''")
            ));
        }

        if let Some(exp_min) = experience_min {
            query.push_str(&format!(" AND experience_annees >= {}", exp_min));
        }

        if let Some(disp) = disponible {
            query.push_str(&format!(" AND disponible_immediatement = {}", disp));
        }

        query.push_str(" ORDER BY experience_annees DESC, created_at DESC");
        query.push_str(&format!(" LIMIT {} OFFSET {}", limit, offset));

        // Exécuter la requête
        let candidats = sqlx::query_as::<_, ProfilCandidat>(&query)
            .fetch_all(&self.pool)
            .await
            .map_err(|e| {
                error!("[search_candidats] Erreur: {}", e);
                AppError::Internal(format!("Erreur recherche candidats: {}", e))
            })?;

        // Compter le total
        let mut count_query =
            String::from("SELECT COUNT(*)::bigint FROM profils_candidats WHERE is_active = true");

        if let Some(sect) = &secteur {
            count_query.push_str(&format!(
                " AND secteur_principal = '{}'",
                sect.replace("'", "''")
            ));
        }

        if let Some(exp_min) = experience_min {
            count_query.push_str(&format!(" AND experience_annees >= {}", exp_min));
        }

        if let Some(disp) = disponible {
            count_query.push_str(&format!(" AND disponible_immediatement = {}", disp));
        }

        let total: i64 = sqlx::query_scalar(&count_query).fetch_one(&self.pool).await.unwrap_or(0);

        Ok((candidats, total))
    }

    /// Marque un profil comme complété
    pub async fn complete_profil(&self, user_id: i32) -> AppResult<()> {
        sqlx::query!(
            "UPDATE profils_candidats SET is_complete = true, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1",
            user_id
        )
        .execute(&self.pool)
        .await
        .map_err(|e| {
            error!("[complete_profil] Erreur: {}", e);
            AppError::Internal(format!("Erreur complétion profil: {}", e))
        })?;

        self.invalidate_profil_cache(user_id).await;
        Ok(())
    }

    /// Invalide le cache d'un profil
    async fn invalidate_profil_cache(&self, user_id: i32) {
        if let Some(redis) = &self.redis_client {
            let _ =
                redis_helper::delete_with_retry(redis, &format!("emploi:profil:{}", user_id)).await;
            // Invalider aussi le cache de matching
            let _ = redis_helper::delete_pattern(redis, &format!("emploi:matching:*:{}", user_id))
                .await;
        }
    }
}

/// Parse GPS string "lat,lng" en tuple (lat, lng)
fn parse_gps(gps: &str) -> Option<(f64, f64)> {
    let parts: Vec<&str> = gps.split(',').collect();
    if parts.len() == 2 {
        if let (Ok(lat), Ok(lng)) = (
            parts[0].trim().parse::<f64>(),
            parts[1].trim().parse::<f64>(),
        ) {
            return Some((lat, lng));
        }
    }
    None
}
