use crate::core::types::{AppError, AppResult};
use crate::models::offres_emploi_model::{MatchingOffreCandidat, OffreEmploi, ProfilCandidat};
use crate::utils::redis_helper;
use bigdecimal::BigDecimal;
use log::{error, info};
use serde_json::json;
use sqlx::PgPool;
use std::str::FromStr;

/// Service pour le matching intelligent offre/candidat
pub struct MatchingEmploiService {
    pool: PgPool,
    redis_client: Option<redis::Client>,
}

impl MatchingEmploiService {
    pub fn new(pool: PgPool, redis_client: Option<redis::Client>) -> Self {
        Self { pool, redis_client }
    }

    /// Calcule le score de matching entre une offre et un candidat
    pub async fn calculate_matching_score(
        &self,
        offre: &OffreEmploi,
        profil: &ProfilCandidat,
    ) -> AppResult<MatchingOffreCandidat> {
        info!(
            "[calculate_matching_score] Calcul matching offre_id={}, candidat_id={}",
            offre.id, profil.user_id
        );

        // Score compétences (40%)
        let (score_competences, competences_match, competences_manquantes) =
            self.calculate_competences_score(offre, profil);

        // Score expérience (25%)
        let score_experience = self.calculate_experience_score(offre, profil);

        // Score localisation (20%)
        let score_localisation = self.calculate_localisation_score(offre, profil).await?;

        // Score salaire (10%)
        let score_salaire = self.calculate_salaire_score(offre, profil);

        // Score autres (5%) : type contrat, remote, etc.
        let score_autres = self.calculate_autres_score(offre, profil);

        // Score total pondéré
        let score_total = (score_competences * 0.40)
            + (score_experience * 0.25)
            + (score_localisation * 0.20)
            + (score_salaire * 0.10)
            + (score_autres * 0.05);

        // Construire les critères de matching
        let criteres_match = json!({
            "competences": {
                "score": score_competences,
                "match": competences_match,
                "manquantes": competences_manquantes
            },
            "experience": score_experience,
            "localisation": score_localisation,
            "salaire": score_salaire,
            "autres": score_autres
        });

        // Créer ou mettre à jour le matching dans la table de cache
        let matching = sqlx::query_as::<_, MatchingOffreCandidat>(
            r#"
            INSERT INTO matching_offres_candidats (
                offre_id, candidat_id, score_total, score_competences,
                score_experience, score_localisation, score_salaire,
                competences_match, competences_manquantes, criteres_match
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (offre_id, candidat_id)
            DO UPDATE SET
                score_total = EXCLUDED.score_total,
                score_competences = EXCLUDED.score_competences,
                score_experience = EXCLUDED.score_experience,
                score_localisation = EXCLUDED.score_localisation,
                score_salaire = EXCLUDED.score_salaire,
                competences_match = EXCLUDED.competences_match,
                competences_manquantes = EXCLUDED.competences_manquantes,
                criteres_match = EXCLUDED.criteres_match,
                date_calcul = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *
            "#,
        )
        .bind(offre.id)
        .bind(profil.user_id)
        .bind(BigDecimal::from_str(&score_total.to_string()).unwrap_or_default())
        .bind(BigDecimal::from_str(&score_competences.to_string()).unwrap_or_default())
        .bind(BigDecimal::from_str(&score_experience.to_string()).unwrap_or_default())
        .bind(BigDecimal::from_str(&score_localisation.to_string()).unwrap_or_default())
        .bind(BigDecimal::from_str(&score_salaire.to_string()).unwrap_or_default())
        .bind(competences_match.as_deref())
        .bind(competences_manquantes.as_deref())
        .bind(serde_json::to_string(&criteres_match).unwrap_or_default())
        .fetch_one(&self.pool)
        .await
        .map_err(|e| {
            error!("[calculate_matching_score] Erreur: {}", e);
            AppError::Internal(format!("Erreur calcul matching: {}", e))
        })?;

        // Mettre en cache
        let cache_key = format!("emploi:matching:{}:{}", offre.id, profil.user_id);
        if let Some(redis) = &self.redis_client {
            let cache_data = serde_json::to_string(&matching).unwrap_or_default();
            let _ = redis_helper::set_with_retry(redis, &cache_key, &cache_data, Some(1800)).await;
            // TTL 30 min
        }

        info!(
            "[calculate_matching_score] ✅ Score calculé: {:.2}%",
            score_total
        );

        // Envoyer notification push si score >= 70%
        if score_total >= 70.0 {
            let _ = crate::services::notifications_matching_emploi::notify_new_matching(
                &self.pool,
                profil.user_id,
                offre.id,
                score_total,
                offre.titre_poste.clone(),
            )
            .await;
        }

        Ok(matching)
    }

    /// Calcule le score de compétences (40% du total)
    fn calculate_competences_score(
        &self,
        offre: &OffreEmploi,
        profil: &ProfilCandidat,
    ) -> (f64, Option<Vec<String>>, Option<Vec<String>>) {
        let empty_vec = vec![];
        let competences_requises = offre.competences_requises.as_ref().unwrap_or(&empty_vec);
        let competences_candidat = profil.competences.as_ref().unwrap_or(&empty_vec);

        if competences_requises.is_empty() {
            return (100.0, Some(vec![]), None);
        }

        let mut match_count = 0;
        let mut competences_match = Vec::new();
        let mut competences_manquantes = Vec::new();

        for comp_requise in competences_requises {
            let comp_lower = comp_requise.to_lowercase();
            let found = competences_candidat.iter().any(|comp| {
                comp.to_lowercase().contains(&comp_lower)
                    || comp_lower.contains(&comp.to_lowercase())
            });

            if found {
                match_count += 1;
                competences_match.push(comp_requise.clone());
            } else {
                competences_manquantes.push(comp_requise.clone());
            }
        }

        let score = (match_count as f64 / competences_requises.len() as f64) * 100.0;

        (
            score,
            Some(competences_match),
            if competences_manquantes.is_empty() {
                None
            } else {
                Some(competences_manquantes)
            },
        )
    }

    /// Calcule le score d'expérience (25% du total)
    fn calculate_experience_score(&self, offre: &OffreEmploi, profil: &ProfilCandidat) -> f64 {
        let experience_requise = offre.experience_min.unwrap_or(0);
        let experience_candidat = profil.experience_annees;

        if experience_requise == 0 {
            return 100.0;
        }

        if experience_candidat >= experience_requise {
            // Candidat a plus ou égal : score 100%
            100.0
        } else {
            // Candidat a moins : score proportionnel (minimum 0%)
            let ratio = experience_candidat as f64 / experience_requise as f64;
            (ratio * 100.0).max(0.0)
        }
    }

    /// Calcule le score de localisation (20% du total)
    async fn calculate_localisation_score(
        &self,
        offre: &OffreEmploi,
        profil: &ProfilCandidat,
    ) -> AppResult<f64> {
        // Si remote possible et candidat souhaite remote : score 100%
        if offre.remote && profil.remote_souhaite {
            return Ok(100.0);
        }

        // Si pas de GPS pour l'offre ou le profil : score 50% (neutre)
        let offre_gps = if let Some(gps) = &offre.gps {
            parse_gps(gps)
        } else {
            None
        };

        let profil_gps = if let Some(gps) = &profil.gps {
            parse_gps(gps)
        } else {
            None
        };

        if offre_gps.is_none() || profil_gps.is_none() {
            return Ok(50.0);
        }

        // Calculer la distance
        let (lat1, lon1) = offre_gps.unwrap();
        let (lat2, lon2) = profil_gps.unwrap();
        let distance_km = haversine_distance_km((lat1, lon1), (lat2, lon2));

        // Score basé sur la distance (100% à 0km, 0% à 100km+)
        let score = if distance_km <= 5.0 {
            100.0
        } else if distance_km <= 20.0 {
            100.0 - ((distance_km - 5.0) / 15.0 * 40.0) // 100% à 5km, 60% à 20km
        } else if distance_km <= 50.0 {
            60.0 - ((distance_km - 20.0) / 30.0 * 40.0) // 60% à 20km, 20% à 50km
        } else {
            20.0 - ((distance_km - 50.0) / 50.0 * 20.0).max(0.0) // 20% à 50km, 0% à 100km+
        };

        Ok(score.max(0.0))
    }

    /// Calcule le score de salaire (10% du total)
    fn calculate_salaire_score(&self, offre: &OffreEmploi, profil: &ProfilCandidat) -> f64 {
        // Convertir BigDecimal en f64 via string
        let salaire_min_offre =
            offre.salaire_min.as_ref().and_then(|s| s.to_string().parse::<f64>().ok());
        let salaire_max_offre =
            offre.salaire_max.as_ref().and_then(|s| s.to_string().parse::<f64>().ok());
        let salaire_souhaite_min = profil
            .salaire_souhaite_min
            .as_ref()
            .and_then(|s| s.to_string().parse::<f64>().ok());
        let salaire_souhaite_max = profil
            .salaire_souhaite_max
            .as_ref()
            .and_then(|s| s.to_string().parse::<f64>().ok());

        // Si pas de salaire côté offre ou candidat : score neutre 50%
        if salaire_min_offre.is_none() && salaire_max_offre.is_none() {
            return 50.0;
        }

        if salaire_souhaite_min.is_none() && salaire_souhaite_max.is_none() {
            return 50.0;
        }

        // Si salaire négociable : score 100%
        if offre.salaire_negociable {
            return 100.0;
        }

        // Calculer l'intersection des fourchettes
        let offre_min = salaire_min_offre.unwrap_or(0.0);
        let offre_max = salaire_max_offre.unwrap_or(f64::MAX);
        let souhait_min = salaire_souhaite_min.unwrap_or(0.0);
        let souhait_max = salaire_souhaite_max.unwrap_or(f64::MAX);

        if souhait_max < offre_min {
            // Candidat demande moins que le minimum offert : score 0%
            0.0
        } else if souhait_min > offre_max {
            // Candidat demande plus que le maximum offert : score 0%
            0.0
        } else {
            // Il y a une intersection : score proportionnel
            let intersection_min = souhait_min.max(offre_min);
            let intersection_max = souhait_max.min(offre_max);
            let intersection_range = intersection_max - intersection_min;
            let offre_range = offre_max - offre_min;

            if offre_range > 0.0 {
                (intersection_range / offre_range * 100.0).min(100.0)
            } else {
                100.0
            }
        }
    }

    /// Calcule le score autres critères (5% du total)
    fn calculate_autres_score(&self, offre: &OffreEmploi, profil: &ProfilCandidat) -> f64 {
        let mut score = 0.0;
        let mut count = 0;

        // Type de contrat
        if let Some(types_souhaites) = &profil.type_contrat_souhaite {
            if types_souhaites.contains(&offre.type_contrat) {
                score += 50.0;
            }
            count += 1;
        }

        // Remote
        if offre.remote && profil.remote_souhaite {
            score += 50.0;
        }
        count += 1;

        // Secteur
        if let Some(secteur_profil) = &profil.secteur_principal {
            if secteur_profil == &offre.secteur {
                score += 50.0;
            }
            count += 1;
        }

        if count > 0 {
            score / count as f64
        } else {
            50.0 // Score neutre si pas de critères
        }
    }

    /// Trouve les offres correspondantes pour un candidat
    pub async fn find_matching_offres(
        &self,
        candidat_id: i32,
        min_score: Option<f64>,
        limit: Option<i64>,
    ) -> AppResult<Vec<MatchingOffreCandidat>> {
        let min = min_score.unwrap_or(70.0);
        let limit_val = limit.unwrap_or(20).min(100);

        // Vérifier le cache
        let cache_key = format!("emploi:matching:candidat:{}:{}", candidat_id, min);
        if let Some(redis) = &self.redis_client {
            if let Ok(Some(cached)) = redis_helper::get_with_retry(redis, &cache_key).await {
                if let Ok(matchings) = serde_json::from_str::<Vec<MatchingOffreCandidat>>(&cached) {
                    return Ok(matchings);
                }
            }
        }

        let matchings = sqlx::query_as::<_, MatchingOffreCandidat>(
            r#"
            SELECT * FROM matching_offres_candidats
            WHERE candidat_id = $1 AND score_total >= $2
            ORDER BY score_total DESC
            LIMIT $3
            "#,
        )
        .bind(candidat_id)
        .bind(BigDecimal::from_str(&min.to_string()).unwrap_or_default())
        .bind(limit_val)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| {
            error!("[find_matching_offres] Erreur: {}", e);
            AppError::Internal(format!("Erreur recherche matchings: {}", e))
        })?;

        // Mettre en cache
        if let Some(redis) = &self.redis_client {
            let cache_data = serde_json::to_string(&matchings).unwrap_or_default();
            let _ = redis_helper::set_with_retry(redis, &cache_key, &cache_data, Some(1800)).await;
            // TTL 30 min
        }

        Ok(matchings)
    }

    /// Trouve les candidats correspondants pour une offre
    pub async fn find_matching_candidats(
        &self,
        offre_id: i32,
        min_score: Option<f64>,
        limit: Option<i64>,
    ) -> AppResult<Vec<MatchingOffreCandidat>> {
        let min = min_score.unwrap_or(70.0);
        let limit_val = limit.unwrap_or(20).min(100);

        // Vérifier le cache
        let cache_key = format!("emploi:matching:offre:{}:{}", offre_id, min);
        if let Some(redis) = &self.redis_client {
            if let Ok(Some(cached)) = redis_helper::get_with_retry(redis, &cache_key).await {
                if let Ok(matchings) = serde_json::from_str::<Vec<MatchingOffreCandidat>>(&cached) {
                    return Ok(matchings);
                }
            }
        }

        let matchings = sqlx::query_as::<_, MatchingOffreCandidat>(
            r#"
            SELECT * FROM matching_offres_candidats
            WHERE offre_id = $1 AND score_total >= $2
            ORDER BY score_total DESC
            LIMIT $3
            "#,
        )
        .bind(offre_id)
        .bind(BigDecimal::from_str(&min.to_string()).unwrap_or_default())
        .bind(limit_val)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| {
            error!("[find_matching_candidats] Erreur: {}", e);
            AppError::Internal(format!("Erreur recherche matchings: {}", e))
        })?;

        // Mettre en cache
        if let Some(redis) = &self.redis_client {
            let cache_data = serde_json::to_string(&matchings).unwrap_or_default();
            let _ = redis_helper::set_with_retry(redis, &cache_key, &cache_data, Some(1800)).await;
            // TTL 30 min
        }

        Ok(matchings)
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

/// Calcule la distance entre deux points GPS (formule de Haversine) en km
fn haversine_distance_km(pos1: (f64, f64), pos2: (f64, f64)) -> f64 {
    const EARTH_RADIUS_KM: f64 = 6371.0;
    let (lat1, lon1) = (pos1.0.to_radians(), pos1.1.to_radians());
    let (lat2, lon2) = (pos2.0.to_radians(), pos2.1.to_radians());

    let dlat = lat2 - lat1;
    let dlon = lon2 - lon1;

    let a = (dlat / 2.0).sin().powi(2) + lat1.cos() * lat2.cos() * (dlon / 2.0).sin().powi(2);
    let c = 2.0 * a.sqrt().asin();

    EARTH_RADIUS_KM * c
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::offres_emploi_model::{OffreEmploi, ProfilCandidat};
    use chrono::Utc;
    use std::str::FromStr;

    fn make_service() -> MatchingEmploiService {
        let pool = sqlx::postgres::PgPoolOptions::new()
            .connect_lazy("postgres://test@localhost/test")
            .expect("pool lazy");
        MatchingEmploiService::new(pool, None)
    }

    fn base_offre() -> OffreEmploi {
        OffreEmploi {
            id: 1,
            entreprise_id: 10,
            titre_poste: "Développeur Rust".to_string(),
            description: "Poste de développeur".to_string(),
            type_contrat: "CDI".to_string(),
            duree_contrat: None,
            lieu_travail: "Douala".to_string(),
            adresse: None,
            gps: None,
            remote: false,
            remote_partiel: false,
            salaire_min: Some(BigDecimal::from_str("300000").unwrap()),
            salaire_max: Some(BigDecimal::from_str("600000").unwrap()),
            devise: "XAF".to_string(),
            salaire_negociable: false,
            niveau_etude: Some("licence".to_string()),
            experience_min: Some(2),
            competences_requises: Some(vec![
                "Rust".to_string(),
                "PostgreSQL".to_string(),
                "Docker".to_string(),
            ]),
            langues_requises: None,
            permis_requis: None,
            secteur: "Informatique".to_string(),
            domaine: None,
            tags: None,
            date_publication: Utc::now(),
            date_limite_candidature: None,
            date_debut_poste: None,
            statut: "active".to_string(),
            nombre_candidatures: 0,
            nombre_vues: 0,
            is_active: true,
            is_verified: true,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }
    }

    fn base_profil() -> ProfilCandidat {
        ProfilCandidat {
            id: 1,
            user_id: 100,
            nom_complet: "Alice Dupont".to_string(),
            date_naissance: None,
            telephone: None,
            email: "alice@example.com".to_string(),
            adresse: None,
            ville: Some("Douala".to_string()),
            gps: None,
            titre_professionnel: Some("Développeuse".to_string()),
            niveau_etude: Some("licence".to_string()),
            experience_annees: 3,
            secteur_principal: Some("Informatique".to_string()),
            competences: Some(vec!["Rust".to_string(), "PostgreSQL".to_string()]),
            langues: None,
            permis: None,
            certifications: None,
            cv_url: None,
            cv_nom: None,
            photo_url: None,
            portfolio_url: None,
            type_contrat_souhaite: None,
            salaire_souhaite_min: Some(BigDecimal::from_str("350000").unwrap()),
            salaire_souhaite_max: Some(BigDecimal::from_str("550000").unwrap()),
            remote_souhaite: false,
            secteurs_interesses: None,
            disponible_immediatement: true,
            date_disponibilite: None,
            is_active: true,
            is_complete: true,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }
    }

    // ── Tests compétences ────────────────────────────────────────────────────

    #[test]
    fn test_competences_score_match_partiel() {
        let svc = make_service();
        let offre = base_offre(); // requiert Rust, PostgreSQL, Docker
        let profil = base_profil(); // a Rust, PostgreSQL (pas Docker)
        let (score, matched, manquantes) = svc.calculate_competences_score(&offre, &profil);
        // 2/3 compétences matchent → ~66.7%
        assert!((score - 66.666).abs() < 0.1, "score={}", score);
        assert_eq!(matched.unwrap().len(), 2);
        assert_eq!(manquantes.unwrap().len(), 1);
    }

    #[test]
    fn test_competences_score_match_total() {
        let svc = make_service();
        let offre = base_offre();
        let mut profil = base_profil();
        profil.competences = Some(vec![
            "Rust".to_string(),
            "PostgreSQL".to_string(),
            "Docker".to_string(),
        ]);
        let (score, matched, manquantes) = svc.calculate_competences_score(&offre, &profil);
        assert_eq!(score, 100.0);
        assert_eq!(matched.unwrap().len(), 3);
        assert!(manquantes.is_none());
    }

    #[test]
    fn test_competences_score_aucun_match() {
        let svc = make_service();
        let offre = base_offre();
        let mut profil = base_profil();
        profil.competences = Some(vec!["Java".to_string(), "Spring".to_string()]);
        let (score, _, manquantes) = svc.calculate_competences_score(&offre, &profil);
        assert_eq!(score, 0.0);
        assert_eq!(manquantes.unwrap().len(), 3);
    }

    #[test]
    fn test_competences_score_offre_sans_exigences() {
        let svc = make_service();
        let mut offre = base_offre();
        offre.competences_requises = None;
        let profil = base_profil();
        let (score, _, _) = svc.calculate_competences_score(&offre, &profil);
        // Pas d'exigences → score 100%
        assert_eq!(score, 100.0);
    }

    // ── Tests expérience ─────────────────────────────────────────────────────

    #[test]
    fn test_experience_score_suffisant() {
        let svc = make_service();
        let offre = base_offre(); // requiert 2 ans
        let profil = base_profil(); // a 3 ans
        let score = svc.calculate_experience_score(&offre, &profil);
        assert_eq!(score, 100.0);
    }

    #[test]
    fn test_experience_score_insuffisant() {
        let svc = make_service();
        let offre = base_offre(); // requiert 2 ans
        let mut profil = base_profil();
        profil.experience_annees = 1; // seulement 1 an
        let score = svc.calculate_experience_score(&offre, &profil);
        // 1/2 = 50%
        assert_eq!(score, 50.0);
    }

    #[test]
    fn test_experience_score_zero_requis() {
        let svc = make_service();
        let mut offre = base_offre();
        offre.experience_min = Some(0);
        let mut profil = base_profil();
        profil.experience_annees = 0;
        let score = svc.calculate_experience_score(&offre, &profil);
        assert_eq!(score, 100.0);
    }

    #[test]
    fn test_experience_score_aucune_exigence() {
        let svc = make_service();
        let mut offre = base_offre();
        offre.experience_min = None;
        let profil = base_profil();
        let score = svc.calculate_experience_score(&offre, &profil);
        assert_eq!(score, 100.0);
    }

    // ── Tests salaire ────────────────────────────────────────────────────────

    #[test]
    fn test_salaire_score_dans_fourchette() {
        let svc = make_service();
        let offre = base_offre(); // 300k–600k XAF
        let profil = base_profil(); // souhaite 350k–550k
        let score = svc.calculate_salaire_score(&offre, &profil);
        // Le salaire candidat est dans la fourchette → score élevé
        assert!(score >= 70.0, "score={}", score);
    }

    #[test]
    fn test_salaire_score_offre_sans_salaire() {
        let svc = make_service();
        let mut offre = base_offre();
        offre.salaire_min = None;
        offre.salaire_max = None;
        let profil = base_profil();
        let score = svc.calculate_salaire_score(&offre, &profil);
        // Pas de salaire indiqué → score neutre (50%)
        assert_eq!(score, 50.0);
    }

    // ── Tests haversine ──────────────────────────────────────────────────────

    #[test]
    fn test_haversine_meme_point() {
        let d = haversine_distance_km((4.0512, 9.7679), (4.0512, 9.7679));
        assert!(d < 0.001, "distance={}", d);
    }

    #[test]
    fn test_haversine_douala_yaounde() {
        // Douala ~(4.05, 9.77) — Yaoundé ~(3.87, 11.52) → ~240 km
        let d = haversine_distance_km((4.05, 9.77), (3.87, 11.52));
        assert!(d > 200.0 && d < 280.0, "distance={}", d);
    }

    // ── Tests parsing GPS ────────────────────────────────────────────────────

    #[test]
    fn test_parse_gps_valide() {
        let result = parse_gps("4.0512,9.7679");
        assert!(result.is_some());
        let (lat, lng) = result.unwrap();
        assert!((lat - 4.0512).abs() < 0.0001);
        assert!((lng - 9.7679).abs() < 0.0001);
    }

    #[test]
    fn test_parse_gps_invalide() {
        assert!(parse_gps("invalid").is_none());
        assert!(parse_gps("").is_none());
        assert!(parse_gps("4.05").is_none());
    }
}
