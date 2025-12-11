// ✅ Service pour gestion orientation scolaire et établissements

use crate::core::types::{AppError, AppResult};
use crate::models::orientation_scolaire::{
    CreateEtablissementRequest, EtablissementScolaire, SearchEtablissementsRequest,
    SuggestEtablissementsRequest, UpdateStatistiquesExamensRequest,
};
use crate::state::AppState;
use crate::utils::redis_helper;
use log::{error, info};
use redis::AsyncCommands;
use serde_json::json;
use sqlx::PgPool;
use std::sync::Arc;

pub struct OrientationScolaireService {
    pool: Arc<PgPool>,
    state: Arc<AppState>,
}

impl OrientationScolaireService {
    pub fn new(pool: Arc<PgPool>, state: Arc<AppState>) -> Self {
        Self { pool, state }
    }

    /// Créer un établissement scolaire
    pub async fn create_etablissement(
        &self,
        user_id: i32,
        service_id: i32,
        request: CreateEtablissementRequest,
    ) -> AppResult<EtablissementScolaire> {
        info!(
            "[ORIENTATION_SCOLAIRE] Création établissement: user_id={}, nom={}",
            user_id, request.nom_etablissement
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

        let etablissement = sqlx::query_as::<_, EtablissementScolaire>(
            r#"
            INSERT INTO etablissements_scolaires (
                service_id, user_id, nom_etablissement, type_etablissement, sous_type,
                niveau_min, niveau_max, adresse, quartier, ville, region, gps,
                location_point, telephone, email, site_web, filieres, specialites,
                langues_enseignement, is_active, is_verified
            )
            VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
                CASE WHEN $13 IS NOT NULL THEN ST_GeogFromText($13) ELSE NULL END,
                $14, $15, $16, $17, $18, $19, $20, $21
            )
            RETURNING *
            "#,
        )
        .bind(service_id)
        .bind(user_id)
        .bind(request.nom_etablissement)
        .bind(request.type_etablissement)
        .bind(request.sous_type)
        .bind(request.niveau_min)
        .bind(request.niveau_max)
        .bind(request.adresse)
        .bind(request.quartier)
        .bind(request.ville)
        .bind(request.region)
        .bind(request.gps)
        .bind(location_point)
        .bind(request.telephone)
        .bind(request.email)
        .bind(request.site_web)
        .bind(request.filieres.unwrap_or_default())
        .bind(request.specialites.unwrap_or_default())
        .bind(request.langues_enseignement.unwrap_or_default())
        .bind(true) // is_active
        .bind(false) // is_verified
        .fetch_one(&*self.pool)
        .await
        .map_err(|e| {
            error!("[ORIENTATION_SCOLAIRE] Erreur création: {}", e);
            AppError::Internal(format!("Erreur création établissement: {}", e))
        })?;

        // Invalider le cache
        self.invalidate_cache_search().await;

        info!(
            "[ORIENTATION_SCOLAIRE] ✅ Établissement créé: id={}",
            etablissement.id
        );
        Ok(etablissement)
    }

    /// Rechercher des établissements avec filtres
    pub async fn search_etablissements(
        &self,
        request: SearchEtablissementsRequest,
    ) -> AppResult<(Vec<EtablissementScolaire>, i64)> {
        info!(
            "[ORIENTATION_SCOLAIRE] Recherche avec filtres: {:?}",
            request
        );

        // Vérifier le cache Redis
        let cache_key = self.cache_key_search(&request);
        if let Ok(Some(cached)) =
            redis_helper::get_with_retry(&self.state.redis_client, &cache_key).await
        {
            if let Ok(cached_data) =
                serde_json::from_str::<(Vec<EtablissementScolaire>, i64)>(&cached)
            {
                info!("[ORIENTATION_SCOLAIRE] ✅ Cache hit: {}", cache_key);
                return Ok(cached_data);
            }
        }

        let page = request.page.unwrap_or(1).max(1);
        let limit = request.limit.unwrap_or(20).min(100).max(1);
        let offset = (page - 1) * limit;
        let rayon_km = request.rayon_km.unwrap_or(10.0);

        // Construire la requête SQL dynamiquement avec QueryBuilder
        let mut query = sqlx::QueryBuilder::new(
            "SELECT e.* FROM etablissements_scolaires e WHERE e.is_active = true AND e.is_verified = true"
        );

        if let Some(type_etablissement) = &request.type_etablissement {
            query.push(" AND e.type_etablissement = ");
            query.push_bind(type_etablissement);
        }

        if let Some(ville) = &request.ville {
            query.push(" AND e.ville = ");
            query.push_bind(ville);
        }

        if let Some(region) = &request.region {
            query.push(" AND e.region = ");
            query.push_bind(region);
        }

        if let Some(filiere) = &request.filiere {
            query.push(" AND ");
            query.push_bind(filiere);
            query.push(" = ANY(e.filieres)");
        }

        if let Some(specialite) = &request.specialite {
            query.push(" AND ");
            query.push_bind(specialite);
            query.push(" = ANY(e.specialites)");
        }

        // Gestion de la distance GPS
        let point_wkt_opt = if let (Some(lat), Some(lng)) = (request.gps_lat, request.gps_lon) {
            let point_wkt = format!("POINT({} {})", lng, lat);
            query.push(" AND ST_DWithin(e.location_point, ST_GeogFromText(");
            query.push_bind(point_wkt.clone());
            query.push("), ");
            query.push_bind(rayon_km * 1000.0);
            query.push(")");
            Some(point_wkt)
        } else {
            None
        };

        // Order by
        if let Some(point_wkt) = point_wkt_opt {
            query.push(" ORDER BY ST_Distance(e.location_point, ST_GeogFromText(");
            query.push_bind(point_wkt);
            query.push(")) ASC");
        } else {
            query.push(" ORDER BY e.created_at DESC");
        }

        query.push(" LIMIT ");
        query.push_bind(limit);
        query.push(" OFFSET ");
        query.push_bind(offset);

        let etablissements = query
            .build_query_as::<EtablissementScolaire>()
            .fetch_all(&*self.pool)
            .await
            .map_err(|e| {
                error!("[ORIENTATION_SCOLAIRE] Erreur recherche: {}", e);
                AppError::Internal(format!("Erreur recherche établissements: {}", e))
            })?;

        // Compter le total avec la même logique
        let mut count_query = sqlx::QueryBuilder::new(
            "SELECT COUNT(*)::bigint FROM etablissements_scolaires e WHERE e.is_active = true AND e.is_verified = true"
        );

        if let Some(type_etablissement) = &request.type_etablissement {
            count_query.push(" AND e.type_etablissement = ");
            count_query.push_bind(type_etablissement);
        }

        if let Some(ville) = &request.ville {
            count_query.push(" AND e.ville = ");
            count_query.push_bind(ville);
        }

        if let Some(region) = &request.region {
            count_query.push(" AND e.region = ");
            count_query.push_bind(region);
        }

        if let Some(filiere) = &request.filiere {
            count_query.push(" AND ");
            count_query.push_bind(filiere);
            count_query.push(" = ANY(e.filieres)");
        }

        if let Some(specialite) = &request.specialite {
            count_query.push(" AND ");
            count_query.push_bind(specialite);
            count_query.push(" = ANY(e.specialites)");
        }

        if let (Some(lat), Some(lng)) = (request.gps_lat, request.gps_lon) {
            let point_wkt = format!("POINT({} {})", lng, lat);
            count_query.push(" AND ST_DWithin(e.location_point, ST_GeogFromText(");
            count_query.push_bind(point_wkt);
            count_query.push("), ");
            count_query.push_bind(rayon_km * 1000.0);
            count_query.push(")");
        }

        let total: i64 = count_query
            .build_query_scalar()
            .fetch_one(&*self.pool)
            .await
            .map_err(|e| {
                error!("[ORIENTATION_SCOLAIRE] Erreur count: {}", e);
                AppError::Internal(format!("Erreur count établissements: {}", e))
            })?;

        let result = (etablissements, total);

        // Mettre en cache (TTL 10 minutes)
        if let Ok(json_str) = serde_json::to_string(&result) {
            let _ = redis_helper::set_with_retry(
                &self.state.redis_client,
                &cache_key,
                &json_str,
                Some(600u64), // 10 minutes
            )
            .await;
        }

        Ok(result)
    }

    /// Obtenir les détails d'un établissement
    pub async fn get_etablissement_details(
        &self,
        etablissement_id: i32,
    ) -> AppResult<EtablissementScolaire> {
        // Vérifier le cache
        let cache_key = format!("orientation:details:{}", etablissement_id);
        if let Ok(Some(cached)) =
            redis_helper::get_with_retry(&self.state.redis_client, &cache_key).await
        {
            if let Ok(etablissement) = serde_json::from_str::<EtablissementScolaire>(&cached) {
                return Ok(etablissement);
            }
        }

        let etablissement = sqlx::query_as::<_, EtablissementScolaire>(
            "SELECT * FROM etablissements_scolaires WHERE id = $1 AND is_active = true",
        )
        .bind(etablissement_id)
        .fetch_optional(&*self.pool)
        .await
        .map_err(|e| {
            error!("[ORIENTATION_SCOLAIRE] Erreur get details: {}", e);
            AppError::Internal(format!("Erreur récupération établissement: {}", e))
        })?
        .ok_or_else(|| AppError::NotFound("Établissement non trouvé".to_string()))?;

        // Mettre en cache (TTL 15 minutes)
        if let Ok(json_str) = serde_json::to_string(&etablissement) {
            let _ = redis_helper::set_with_retry(
                &self.state.redis_client,
                &cache_key,
                &json_str,
                Some(900u64), // 15 minutes
            )
            .await;
        }

        Ok(etablissement)
    }

    /// Mettre à jour les statistiques d'examens
    pub async fn update_statistiques_examens(
        &self,
        etablissement_id: i32,
        request: UpdateStatistiquesExamensRequest,
    ) -> AppResult<EtablissementScolaire> {
        info!(
            "[ORIENTATION_SCOLAIRE] Mise à jour stats: etablissement_id={}, annee={}",
            etablissement_id, request.annee
        );

        // Récupérer les statistiques actuelles
        let etablissement = self.get_etablissement_details(etablissement_id).await?;
        let mut stats = etablissement
            .statistiques_examens
            .as_object()
            .cloned()
            .unwrap_or_default();

        // Mettre à jour les statistiques pour l'année
        let annee_stats = json!({
            "taux_reussite": request.taux_reussite,
            "nb_candidats": request.nb_candidats,
            "nb_admis": request.nb_admis,
            "moyenne_generale": request.moyenne_generale,
            "autres_stats": request.autres_stats,
        });
        stats.insert(request.annee.clone(), annee_stats);

        let stats_json = serde_json::Value::Object(stats);

        let updated = sqlx::query_as::<_, EtablissementScolaire>(
            r#"
            UPDATE etablissements_scolaires
            SET statistiques_examens = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING *
            "#,
        )
        .bind(stats_json)
        .bind(etablissement_id)
        .fetch_one(&*self.pool)
        .await
        .map_err(|e| {
            error!("[ORIENTATION_SCOLAIRE] Erreur update stats: {}", e);
            AppError::Internal(format!("Erreur mise à jour statistiques: {}", e))
        })?;

        // Invalider le cache
        self.invalidate_cache_stats(etablissement_id).await;

        Ok(updated)
    }

    /// Suggestions intelligentes d'établissements
    pub async fn suggest_etablissements(
        &self,
        request: SuggestEtablissementsRequest,
    ) -> AppResult<Vec<(EtablissementScolaire, f64)>> {
        info!("[ORIENTATION_SCOLAIRE] Suggestions: {:?}", request);

        // Vérifier le cache
        let cache_key = format!(
            "orientation:suggestions:{}:{}:{}:{}",
            request.type_etablissement,
            request.domaine.as_deref().unwrap_or(""),
            request.filiere.as_deref().unwrap_or(""),
            request.ville.as_deref().unwrap_or("")
        );

        if let Ok(Some(cached)) =
            redis_helper::get_with_retry(&self.state.redis_client, &cache_key).await
        {
            if let Ok(suggestions) =
                serde_json::from_str::<Vec<(EtablissementScolaire, f64)>>(&cached)
            {
                return Ok(suggestions);
            }
        }

        let limit = request.limit.unwrap_or(10);

        // Recherche de base
        let search_request = SearchEtablissementsRequest {
            type_etablissement: Some(request.type_etablissement.clone()),
            ville: request.ville.clone(),
            region: request.region.clone(),
            filiere: request.filiere.clone(),
            specialite: None,
            gps_lat: request.gps_lat,
            gps_lon: request.gps_lon,
            rayon_km: Some(50.0), // Rayon plus large pour suggestions
            page: Some(1),
            limit: Some((limit * 2) as i64), // Récupérer plus pour scoring
        };

        let (etablissements, _) = self.search_etablissements(search_request).await?;

        // Calculer les scores pour chaque établissement
        let mut scored: Vec<(EtablissementScolaire, f64)> = etablissements
            .into_iter()
            .map(|etab| {
                let mut score = 0.0;

                // 40% statistiques (taux de réussite moyen)
                if let Some(stats_obj) = etab.statistiques_examens.as_object() {
                    let mut taux_total = 0.0;
                    let mut count = 0;
                    for (_, annee_stats) in stats_obj {
                        if let Some(taux) =
                            annee_stats.get("taux_reussite").and_then(|v| v.as_f64())
                        {
                            taux_total += taux;
                            count += 1;
                        }
                    }
                    if count > 0 {
                        score += (taux_total / count as f64) * 0.4;
                    }
                }

                // 30% proximité géographique (si GPS fourni)
                if request.gps_lat.is_some() && request.gps_lon.is_some() {
                    // Score de proximité (plus proche = meilleur score)
                    score += 30.0 * 0.3; // Approximation
                } else {
                    score += 20.0 * 0.3; // Score par défaut
                }

                // 20% filières disponibles
                if let Some(ref filiere) = request.filiere {
                    if etab.filieres.contains(filiere) {
                        score += 20.0;
                    }
                }

                // 10% autres critères (vérification, activité)
                if etab.is_verified {
                    score += 5.0;
                }
                if etab.is_active {
                    score += 5.0;
                }

                (etab, score)
            })
            .collect();

        // Trier par score décroissant
        scored.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
        scored.truncate(limit as usize);

        // Mettre en cache (TTL 1 heure)
        if let Ok(json_str) = serde_json::to_string(&scored) {
            let _ = redis_helper::set_with_retry(
                &self.state.redis_client,
                &cache_key,
                &json_str,
                Some(3600u64), // 1 heure
            )
            .await;
        }

        Ok(scored)
    }

    /// Clé de cache pour recherche
    fn cache_key_search(&self, request: &SearchEtablissementsRequest) -> String {
        format!(
            "orientation:search:{}:{}:{}:{}:{}:{}",
            request.type_etablissement.as_deref().unwrap_or("all"),
            request.ville.as_deref().unwrap_or("all"),
            request.region.as_deref().unwrap_or("all"),
            request.filiere.as_deref().unwrap_or("all"),
            request.page.unwrap_or(1),
            request.limit.unwrap_or(20)
        )
    }

    /// Invalider le cache de recherche
    async fn invalidate_cache_search(&self) {
        let pattern = "orientation:search:*";
        if let Ok(mut conn) = self
            .state
            .redis_client
            .get_multiplexed_async_connection()
            .await
        {
            let _: Result<(), _> = conn.del(pattern).await;
        }
    }

    /// Invalider le cache de statistiques
    async fn invalidate_cache_stats(&self, etablissement_id: i32) {
        let key = format!("orientation:stats:{}", etablissement_id);
        let _ = redis_helper::del_with_retry(&self.state.redis_client, &key).await;
    }
}

/// Parser GPS depuis format "lat,lng"
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
