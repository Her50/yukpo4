use crate::core::types::{AppError, AppResult};
use crate::models::offres_emploi_model::{
    AlerteEmploi, Candidature, CreateAlerteEmploiRequest, CreateCandidatureRequest,
    CreateOffreEmploiRequest, CreateOrUpdateProfilRequest, OffreEmploi, ProfilCandidat,
    SearchOffresRequest, StatistiquesOffre, UpdateStatutCandidatureRequest,
};
use crate::utils::redis_helper;
use bigdecimal::BigDecimal;
use chrono::{NaiveDate, Utc};
use log::{error, info, warn};
use serde_json::{json, Value};
use sqlx::{PgPool, Row};
use std::str::FromStr;

/// Service pour la gestion des offres d'emploi
pub struct OffresEmploiService {
    pool: PgPool,
    redis_client: Option<redis::Client>,
}

impl OffresEmploiService {
    pub fn new(pool: PgPool, redis_client: Option<redis::Client>) -> Self {
        Self { pool, redis_client }
    }

    /// Crée une nouvelle offre d'emploi
    pub async fn create_offre(
        &self,
        entreprise_id: i32,
        request: CreateOffreEmploiRequest,
    ) -> AppResult<OffreEmploi> {
        info!(
            "[create_offre] Création offre pour entreprise_id={}",
            entreprise_id
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
            .salaire_min
            .map(|s| BigDecimal::from_str(&s.to_string()).unwrap_or_default());
        let salaire_max = request
            .salaire_max
            .map(|s| BigDecimal::from_str(&s.to_string()).unwrap_or_default());

        // Préparer langues_requises comme JSONB
        let langues_requises_json = request.langues_requises.as_ref()
            .map(|v| serde_json::to_value(v).unwrap_or(Value::Null));
        
        let offre_row = sqlx::query(
            r#"
            INSERT INTO offres_emploi (
                entreprise_id, titre_poste, description, type_contrat, duree_contrat,
                lieu_travail, adresse, gps, location_point, remote, remote_partiel,
                salaire_min, salaire_max, devise, salaire_negociable,
                niveau_etude, experience_min, competences_requises, langues_requises, permis_requis,
                secteur, domaine, tags, date_limite_candidature, date_debut_poste, statut
            )
            VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8,
                CASE WHEN $9::TEXT IS NOT NULL THEN ST_GeogFromText($9::TEXT) ELSE NULL END,
                $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26
            )
            RETURNING 
                id, entreprise_id, titre_poste, description, type_contrat, duree_contrat,
                lieu_travail, adresse, gps, remote, remote_partiel,
                salaire_min, salaire_max, devise, salaire_negociable,
                niveau_etude, experience_min, competences_requises, langues_requises, permis_requis,
                secteur, domaine, tags, date_limite_candidature, date_debut_poste, statut,
                date_publication, nombre_vues, nombre_candidatures, is_active, is_verified, created_at, updated_at
            "#
        )
        .bind(entreprise_id)
        .bind(&request.titre_poste)
        .bind(&request.description)
        .bind(&request.type_contrat)
        .bind(request.duree_contrat)
        .bind(&request.lieu_travail)
        .bind(request.adresse.as_deref())
        .bind(request.gps.as_deref())
        .bind(location_point.as_deref())
        .bind(request.remote.unwrap_or(false))
        .bind(request.remote_partiel.unwrap_or(false))
        .bind(salaire_min.as_ref())
        .bind(salaire_max.as_ref())
        .bind(&request.devise.unwrap_or_else(|| "XAF".to_string()))
        .bind(request.salaire_negociable.unwrap_or(false))
        .bind(request.niveau_etude.as_deref())
        .bind(request.experience_min)
        .bind(request.competences_requises.as_deref())
        .bind(langues_requises_json.as_ref())
        .bind(request.permis_requis.as_deref())
        .bind(&request.secteur)
        .bind(request.domaine.as_deref())
        .bind(request.tags.as_deref())
        .bind(request.date_limite_candidature)
        .bind(request.date_debut_poste)
        .bind("active")
        .fetch_one(&self.pool)
        .await
        .map_err(|e| {
            error!("[create_offre] Erreur: {}", e);
            AppError::Internal(format!("Erreur création offre: {}", e))
        })?;

        let offre = OffreEmploi {
            id: offre_row.get::<i32, _>("id"),
            entreprise_id: offre_row.get::<i32, _>("entreprise_id"),
            titre_poste: offre_row.get::<String, _>("titre_poste"),
            description: offre_row.get::<String, _>("description"),
            type_contrat: offre_row.get::<String, _>("type_contrat"),
            duree_contrat: offre_row.get::<Option<i32>, _>("duree_contrat"),
            lieu_travail: offre_row.get::<String, _>("lieu_travail"),
            adresse: offre_row.get::<Option<String>, _>("adresse"),
            gps: offre_row.get::<Option<String>, _>("gps"),
            remote: offre_row.get::<bool, _>("remote"),
            remote_partiel: offre_row.get::<bool, _>("remote_partiel"),
            salaire_min: offre_row.get::<Option<BigDecimal>, _>("salaire_min"),
            salaire_max: offre_row.get::<Option<BigDecimal>, _>("salaire_max"),
            devise: offre_row.get::<String, _>("devise"),
            salaire_negociable: offre_row.get::<bool, _>("salaire_negociable"),
            niveau_etude: offre_row.get::<Option<String>, _>("niveau_etude"),
            experience_min: offre_row.get::<Option<i32>, _>("experience_min"),
            competences_requises: offre_row.get::<Option<Vec<String>>, _>("competences_requises"),
            langues_requises: offre_row.get::<Option<Value>, _>("langues_requises"),
            permis_requis: offre_row.get::<Option<Vec<String>>, _>("permis_requis"),
            secteur: offre_row.get::<String, _>("secteur"),
            domaine: offre_row.get::<Option<String>, _>("domaine"),
            tags: offre_row.get::<Option<Vec<String>>, _>("tags"),
            date_publication: offre_row.get::<chrono::DateTime<chrono::Utc>, _>("date_publication"),
            date_limite_candidature: offre_row.get::<Option<NaiveDate>, _>("date_limite_candidature"),
            date_debut_poste: offre_row.get::<Option<NaiveDate>, _>("date_debut_poste"),
            statut: offre_row.get::<String, _>("statut"),
            nombre_candidatures: offre_row.get::<i32, _>("nombre_candidatures"),
            nombre_vues: offre_row.get::<i32, _>("nombre_vues"),
            is_active: offre_row.get::<bool, _>("is_active"),
            is_verified: offre_row.get::<bool, _>("is_verified"),
            created_at: offre_row.get::<chrono::DateTime<chrono::Utc>, _>("created_at"),
            updated_at: offre_row.get::<chrono::DateTime<chrono::Utc>, _>("updated_at"),
        };

        // Invalider le cache de recherche
        self.invalidate_search_cache().await;

        info!("[create_offre] ✅ Offre créée avec id={}", offre.id);
        Ok(offre)
    }

    /// Recherche d'offres avec filtres avancés
    pub async fn search_offres(
        &self,
        request: SearchOffresRequest,
    ) -> AppResult<(Vec<OffreEmploi>, i64)> {
        info!("[search_offres] Recherche avec filtres: {:?}", request);

        // Vérifier le cache Redis
        let cache_key = self.build_search_cache_key(&request);
        if let Some(redis) = &self.redis_client {
            if let Ok(Some(cached)) = redis_helper::get_with_retry(redis, &cache_key).await {
                if let Ok((offres, total)) =
                    serde_json::from_str::<(Vec<OffreEmploi>, i64)>(&cached)
                {
                    info!("[search_offres] ✅ Cache hit");
                    return Ok((offres, total));
                }
            }
        }

        let page = request.page.unwrap_or(1).max(1);
        let limit = request.limit.unwrap_or(20).min(100).max(1);
        let offset = (page - 1) * limit;

        // Construire la requête SQL dynamiquement
        let mut query = String::from(
            "SELECT * FROM offres_emploi WHERE statut = 'active' AND is_active = true",
        );
        let mut params: Vec<String> = vec![];
        let mut param_count = 0;

        if let Some(secteur) = &request.secteur {
            param_count += 1;
            query.push_str(&format!(" AND secteur = ${}", param_count));
            params.push(secteur.clone());
        }

        if let Some(ref types) = request.type_contrat {
            if !types.is_empty() {
                param_count += 1;
                query.push_str(&format!(
                    " AND type_contrat = ANY(${}::text[])",
                    param_count
                ));
                params.push(serde_json::to_string(types).unwrap_or_default());
            }
        }

        if let Some(remote) = request.remote {
            param_count += 1;
            query.push_str(&format!(" AND remote = ${}", param_count));
            params.push(remote.to_string());
        }

        // Recherche géographique si GPS fourni
        if let Some(gps) = &request.gps {
            if let Some((lat, lng)) = parse_gps(gps) {
                let distance_km = request.distance_max_km.unwrap_or(50.0);
                param_count += 1;
                query.push_str(&format!(
                    " AND ST_DWithin(location_point, ST_GeogFromText('POINT({} {})'), {})",
                    lng,
                    lat,
                    distance_km * 1000.0
                ));
            }
        }

        query.push_str(" ORDER BY date_publication DESC LIMIT $");
        param_count += 1;
        query.push_str(&param_count.to_string());
        query.push_str(" OFFSET $");
        param_count += 1;
        query.push_str(&param_count.to_string());

        // Exécuter la requête (version simplifiée - à améliorer avec filtres dynamiques)
        let offres = sqlx::query_as::<_, OffreEmploi>(
            r#"
            SELECT * FROM offres_emploi
            WHERE statut = 'active' AND is_active = true
            ORDER BY date_publication DESC
            LIMIT $1 OFFSET $2
            "#,
        )
        .bind(limit)
        .bind(offset)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| {
            error!("[search_offres] Erreur: {}", e);
            AppError::Internal(format!("Erreur recherche offres: {}", e))
        })?;

        // Compter le total
        let total: i64 = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*)::bigint FROM offres_emploi WHERE statut = 'active' AND is_active = true"
        )
        .fetch_one(&self.pool)
        .await
        .unwrap_or(0);

        // Mettre en cache
        if let Some(redis) = &self.redis_client {
            let cache_data = serde_json::to_string(&(&offres, total)).unwrap_or_default();
            let _ = redis_helper::set_with_retry(redis, &cache_key, &cache_data, Some(600)).await;
            // TTL 10 min
        }

        Ok((offres, total))
    }

    /// Récupère les détails d'une offre
    pub async fn get_offre_details(&self, offre_id: i32) -> AppResult<OffreEmploi> {
        // Vérifier le cache
        let cache_key = format!("emploi:details:{}", offre_id);
        if let Some(redis) = &self.redis_client {
            if let Ok(Some(cached)) = redis_helper::get_with_retry(redis, &cache_key).await {
                if let Ok(offre) = serde_json::from_str::<OffreEmploi>(&cached) {
                    return Ok(offre);
                }
            }
        }

        let offre = sqlx::query_as::<_, OffreEmploi>("SELECT * FROM offres_emploi WHERE id = $1")
            .bind(offre_id)
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| {
                error!("[get_offre_details] Erreur: {}", e);
                AppError::Internal(format!("Erreur récupération offre: {}", e))
            })?
            .ok_or_else(|| AppError::NotFound("Offre non trouvée".to_string()))?;

        // Mettre en cache
        if let Some(redis) = &self.redis_client {
            let cache_data = serde_json::to_string(&offre).unwrap_or_default();
            let _ = redis_helper::set_with_retry(redis, &cache_key, &cache_data, Some(900)).await;
            // TTL 15 min
        }

        Ok(offre)
    }

    /// Incrémente le compteur de vues
    pub async fn increment_vues(&self, offre_id: i32) -> AppResult<()> {
        sqlx::query!(
            "UPDATE offres_emploi SET nombre_vues = nombre_vues + 1 WHERE id = $1",
            offre_id
        )
        .execute(&self.pool)
        .await
        .map_err(|e| {
            error!("[increment_vues] Erreur: {}", e);
            AppError::Internal(format!("Erreur incrément vues: {}", e))
        })?;

        // Invalider le cache des détails
        if let Some(redis) = &self.redis_client {
            let _ = redis_helper::delete_with_retry(redis, &format!("emploi:details:{}", offre_id))
                .await;
        }

        Ok(())
    }

    /// Ferme une offre (statut 'pourvue' ou 'fermee')
    pub async fn close_offre(&self, offre_id: i32, statut: String) -> AppResult<()> {
        if statut != "pourvue" && statut != "fermee" {
            return Err(AppError::BadRequest(
                "Statut invalide. Utiliser 'pourvue' ou 'fermee'".to_string(),
            ));
        }

        sqlx::query!(
            "UPDATE offres_emploi SET statut = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
            statut,
            offre_id
        )
        .execute(&self.pool)
        .await
        .map_err(|e| {
            error!("[close_offre] Erreur: {}", e);
            AppError::Internal(format!("Erreur fermeture offre: {}", e))
        })?;

        self.invalidate_search_cache().await;
        Ok(())
    }

    /// Construit une clé de cache pour la recherche
    fn build_search_cache_key(&self, request: &SearchOffresRequest) -> String {
        format!(
            "emploi:search:{}:{}:{}:{}:{}:{}:{}",
            request.secteur.as_deref().unwrap_or("all"),
            serde_json::to_string(&request.type_contrat).unwrap_or_default(),
            request
                .salaire_min
                .map(|s| s.to_string())
                .unwrap_or_default(),
            request.lieu_travail.as_deref().unwrap_or("all"),
            request.gps.as_deref().unwrap_or("all"),
            request.page.unwrap_or(1),
            request.limit.unwrap_or(20)
        )
    }

    /// Invalide le cache de recherche
    async fn invalidate_search_cache(&self) {
        if let Some(redis) = &self.redis_client {
            // Pattern matching pour supprimer toutes les clés de recherche
            let _ = redis_helper::delete_pattern(redis, "emploi:search:*").await;
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
