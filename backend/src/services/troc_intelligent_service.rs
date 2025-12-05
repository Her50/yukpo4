// ✅ NOUVEAU: Service pour troc intelligent de livres scolaires

use crate::core::types::{AppError, AppResult};
use crate::models::livre_scolaire::LivreScolaire;
use crate::models::troc_livre::{
    ChaineTrocLivre, CreateTrocChaineRequest, CreateTrocDirectRequest, MatchingChaine,
    MatchingDirect, MatchingResult, ParticipantChaine, TrocLivre,
};
use log::info;
use sqlx::PgPool;
use std::sync::Arc;

pub struct TrocIntelligentService {
    pool: Arc<PgPool>,
}

impl TrocIntelligentService {
    pub fn new(pool: Arc<PgPool>) -> Self {
        Self { pool }
    }

    /// Calculer la distance entre deux points GPS (formule Haversine)
    fn haversine_distance(lat1: f64, lon1: f64, lat2: f64, lon2: f64) -> f64 {
        let r = 6371.0; // Rayon de la Terre en km
        let dlat = (lat2 - lat1).to_radians();
        let dlon = (lon2 - lon1).to_radians();
        let a = (dlat / 2.0).sin().powi(2)
            + lat1.to_radians().cos() * lat2.to_radians().cos() * (dlon / 2.0).sin().powi(2);
        let c = 2.0 * a.sqrt().atan2((1.0 - a).sqrt());
        r * c
    }

    /// Parser les coordonnées GPS depuis le format "lat,lng"
    fn parse_gps(gps: &Option<String>) -> Option<(f64, f64)> {
        gps.as_ref().and_then(|g| {
            let parts: Vec<&str> = g.split(',').collect();
            if parts.len() == 2 {
                if let (Ok(lat), Ok(lon)) = (
                    parts[0].trim().parse::<f64>(),
                    parts[1].trim().parse::<f64>(),
                ) {
                    Some((lat, lon))
                } else {
                    None
                }
            } else {
                None
            }
        })
    }

    /// Calculer le score de proximité géographique
    pub fn calculate_proximity_score(&self, distance_km: f64) -> f64 {
        if distance_km < 1.0 {
            1.0
        } else if distance_km < 5.0 {
            0.8
        } else if distance_km < 10.0 {
            0.6
        } else if distance_km < 20.0 {
            0.4
        } else {
            0.2
        }
    }

    /// Trouver les matchings directs (2 personnes)
    pub async fn find_matching_direct(
        &self,
        livre_offert_id: i32,
    ) -> AppResult<Vec<MatchingDirect>> {
        info!(
            "[TROC_INTELLIGENT] Recherche matching direct pour livre: {}",
            livre_offert_id
        );

        // Récupérer le livre offert
        let livre_offert = sqlx::query_as::<_, LivreScolaire>(
            "SELECT * FROM livres_scolaires WHERE id = $1 AND is_active = true AND is_available = true"
        )
        .bind(livre_offert_id)
        .fetch_optional(&*self.pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur récupération livre offert: {}", e)))?
        .ok_or_else(|| AppError::NotFound("Livre offert non trouvé".to_string()))?;

        // Chercher les livres qui correspondent: classe_souhaitee du livre offert = classe_actuelle du livre souhaité
        // ET classe_actuelle du livre offert = classe_souhaitee du livre souhaité
        // ET même matière
        let livres_candidates = sqlx::query_as::<_, LivreScolaire>(
            r#"
            SELECT * FROM livres_scolaires
            WHERE is_active = true
            AND is_available = true
            AND id != $1
            AND user_id != $2
            AND classe_actuelle = $3
            AND classe_souhaitee = $4
            AND matiere = $5
            ORDER BY created_at DESC
            LIMIT 50
            "#,
        )
        .bind(livre_offert_id)
        .bind(livre_offert.user_id)
        .bind(&livre_offert.classe_souhaitee)
        .bind(&livre_offert.classe_actuelle)
        .bind(&livre_offert.matiere)
        .fetch_all(&*self.pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur recherche matchings: {}", e)))?;

        let mut matchings = Vec::new();

        // Parser GPS du livre offert
        let gps_offert = Self::parse_gps(&livre_offert.gps);

        for livre_souhaite in livres_candidates {
            // Calculer la distance si GPS disponibles
            let distance_km = if let (Some((lat1, lon1)), Some((lat2, lon2))) =
                (gps_offert, Self::parse_gps(&livre_souhaite.gps))
            {
                Some(Self::haversine_distance(lat1, lon1, lat2, lon2))
            } else {
                None
            };

            let score_proximite = distance_km
                .map(|d| self.calculate_proximity_score(d))
                .unwrap_or(0.5);

            matchings.push(MatchingDirect {
                livre_offert_id,
                livre_souhaite_id: livre_souhaite.id,
                participant_id: livre_souhaite.user_id,
                distance_km,
                score_proximite,
                livre_offert: Some(
                    serde_json::to_value(&livre_offert).unwrap_or(serde_json::Value::Null),
                ),
                livre_souhaite: Some(
                    serde_json::to_value(&livre_souhaite).unwrap_or(serde_json::Value::Null),
                ),
            });
        }

        // Trier par score de proximité décroissant
        matchings.sort_by(|a, b| {
            b.score_proximite
                .partial_cmp(&a.score_proximite)
                .unwrap_or(std::cmp::Ordering::Equal)
        });

        info!(
            "[TROC_INTELLIGENT] ✅ {} matchings directs trouvés",
            matchings.len()
        );
        Ok(matchings)
    }

    /// Trouver les matchings en chaîne (3+ personnes)
    /// Algorithme: construire un graphe de dépendances et trouver des cycles
    pub async fn find_matching_chaine(
        &self,
        livre_offert_id: i32,
        max_participants: Option<i32>,
    ) -> AppResult<Vec<MatchingChaine>> {
        info!(
            "[TROC_INTELLIGENT] Recherche matching chaîne pour livre: {}",
            livre_offert_id
        );

        let max_participants = max_participants.unwrap_or(5);

        // Récupérer le livre offert
        let livre_offert = sqlx::query_as::<_, LivreScolaire>(
            "SELECT * FROM livres_scolaires WHERE id = $1 AND is_active = true AND is_available = true"
        )
        .bind(livre_offert_id)
        .fetch_optional(&*self.pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur récupération livre offert: {}", e)))?
        .ok_or_else(|| AppError::NotFound("Livre offert non trouvé".to_string()))?;

        // Récupérer tous les livres disponibles (sauf celui de l'initiateur)
        let all_livres = sqlx::query_as::<_, LivreScolaire>(
            r#"
            SELECT * FROM livres_scolaires
            WHERE is_active = true
            AND is_available = true
            AND id != $1
            AND user_id != $2
            ORDER BY created_at DESC
            LIMIT 200
            "#,
        )
        .bind(livre_offert_id)
        .bind(livre_offert.user_id)
        .fetch_all(&*self.pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur récupération livres: {}", e)))?;

        // Construire le graphe de dépendances
        // Un livre A peut être échangé avec un livre B si:
        // - classe_actuelle de A = classe_souhaitee de B
        // - classe_souhaitee de A = classe_actuelle de B
        // - même matière

        // Algorithme simplifié: recherche en profondeur limitée pour trouver des cycles
        let mut chaines_trouvees = Vec::new();

        // Commencer par le livre offert
        self.find_cycles_recursive(
            &all_livres,
            &livre_offert,
            &vec![livre_offert.clone()],
            max_participants as usize,
            &mut chaines_trouvees,
        );

        // Convertir les chaînes trouvées en MatchingChaine
        let mut matching_chaines = Vec::new();

        for chaine in chaines_trouvees {
            if chaine.len() < 3 {
                continue; // Au moins 3 participants pour une chaîne
            }

            // Vérifier que le cycle est fermé (le dernier livre correspond au premier)
            let premier = &chaine[0];
            let dernier = &chaine[chaine.len() - 1];

            if dernier.classe_souhaitee == premier.classe_actuelle
                && dernier.classe_actuelle == premier.classe_souhaitee
                && dernier.matiere == premier.matiere
            {
                // Construire la liste des participants
                let mut participants = Vec::new();
                for (i, livre) in chaine.iter().enumerate() {
                    let livre_souhaite = if i < chaine.len() - 1 {
                        &chaine[i + 1]
                    } else {
                        &chaine[0]
                    };

                    participants.push(ParticipantChaine {
                        user_id: livre.user_id,
                        livre_offert_id: livre.id,
                        livre_souhaite_id: livre_souhaite.id,
                        ordre: (i + 1) as i32,
                    });
                }

                // Calculer la distance totale de la chaîne
                let mut distance_totale_km = 0.0;
                for i in 0..chaine.len() {
                    let livre1 = &chaine[i];
                    let livre2 = if i < chaine.len() - 1 {
                        &chaine[i + 1]
                    } else {
                        &chaine[0]
                    };

                    if let (Some((lat1, lon1)), Some((lat2, lon2))) =
                        (Self::parse_gps(&livre1.gps), Self::parse_gps(&livre2.gps))
                    {
                        distance_totale_km += Self::haversine_distance(lat1, lon1, lat2, lon2);
                    }
                }

                let score_proximite = if distance_totale_km > 0.0 {
                    self.calculate_proximity_score(distance_totale_km / chaine.len() as f64)
                } else {
                    0.5
                };

                let livres_json: Vec<serde_json::Value> = chaine
                    .iter()
                    .map(|l| serde_json::to_value(l).unwrap_or(serde_json::Value::Null))
                    .collect();

                matching_chaines.push(MatchingChaine {
                    chaine_id: None,
                    participants,
                    distance_totale_km,
                    score_proximite,
                    nombre_participants: chaine.len() as i32,
                    livres: livres_json,
                });
            }
        }

        // Trier par score de proximité décroissant
        matching_chaines.sort_by(|a, b| {
            b.score_proximite
                .partial_cmp(&a.score_proximite)
                .unwrap_or(std::cmp::Ordering::Equal)
        });

        info!(
            "[TROC_INTELLIGENT] ✅ {} chaînes trouvées",
            matching_chaines.len()
        );
        Ok(matching_chaines)
    }

    /// Fonction récursive pour trouver des cycles dans le graphe
    fn find_cycles_recursive(
        &self,
        all_livres: &[LivreScolaire],
        livre_actuel: &LivreScolaire,
        chemin: &[LivreScolaire],
        max_depth: usize,
        chaines: &mut Vec<Vec<LivreScolaire>>,
    ) {
        if chemin.len() >= max_depth {
            return;
        }

        // Chercher les livres qui peuvent être échangés avec le livre actuel
        for livre in all_livres {
            // Vérifier si le livre n'est pas déjà dans le chemin
            if chemin.iter().any(|l| l.id == livre.id) {
                continue;
            }

            // Vérifier la compatibilité
            if livre.classe_actuelle == livre_actuel.classe_souhaitee
                && livre.classe_souhaitee == livre_actuel.classe_actuelle
                && livre.matiere == livre_actuel.matiere
            {
                let mut nouveau_chemin = chemin.to_vec();
                nouveau_chemin.push(livre.clone());

                // Vérifier si on peut fermer le cycle (retour au premier livre)
                let premier = &chemin[0];
                if livre.classe_souhaitee == premier.classe_actuelle
                    && livre.classe_actuelle == premier.classe_souhaitee
                    && livre.matiere == premier.matiere
                {
                    // Cycle trouvé!
                    chaines.push(nouveau_chemin);
                } else {
                    // Continuer la recherche
                    self.find_cycles_recursive(
                        all_livres,
                        livre,
                        &nouveau_chemin,
                        max_depth,
                        chaines,
                    );
                }
            }
        }
    }

    /// Créer un troc direct
    pub async fn create_troc_direct(
        &self,
        initiateur_id: i32,
        request: CreateTrocDirectRequest,
    ) -> AppResult<TrocLivre> {
        info!(
            "[TROC_INTELLIGENT] Création troc direct: initiateur={}, livre_offert={}, livre_souhaite={}",
            initiateur_id, request.livre_offert_id, request.livre_souhaite_id
        );

        // Vérifier que le livre offert appartient à l'initiateur
        let livre_offert = sqlx::query_as::<_, LivreScolaire>(
            "SELECT * FROM livres_scolaires WHERE id = $1 AND user_id = $2",
        )
        .bind(request.livre_offert_id)
        .bind(initiateur_id)
        .fetch_optional(&*self.pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur vérification livre offert: {}", e)))?
        .ok_or_else(|| {
            AppError::NotFound("Livre offert non trouvé ou ne vous appartient pas".to_string())
        })?;

        // Vérifier que le livre souhaité existe
        let livre_souhaite = sqlx::query_as::<_, LivreScolaire>(
            "SELECT * FROM livres_scolaires WHERE id = $1 AND is_active = true AND is_available = true"
        )
        .bind(request.livre_souhaite_id)
        .fetch_optional(&*self.pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur vérification livre souhaité: {}", e)))?
        .ok_or_else(|| AppError::NotFound("Livre souhaité non trouvé".to_string()))?;

        // Calculer la distance
        let distance_km = if let (Some((lat1, lon1)), Some((lat2, lon2))) = (
            Self::parse_gps(&livre_offert.gps),
            Self::parse_gps(&livre_souhaite.gps),
        ) {
            Some(Self::haversine_distance(lat1, lon1, lat2, lon2))
        } else {
            None
        };

        // Créer le troc
        let troc = sqlx::query_as::<_, TrocLivre>(
            r#"
            INSERT INTO troc_livres_scolaires (
                initiateur_id, participant_id,
                livre_offert_id, livre_souhaite_id,
                type_troc, statut, distance_km, date_echange
            )
            VALUES ($1, $2, $3, $4, 'direct', 'en_attente', $5, $6)
            RETURNING *
            "#,
        )
        .bind(initiateur_id)
        .bind(livre_souhaite.user_id)
        .bind(request.livre_offert_id)
        .bind(request.livre_souhaite_id)
        .bind(distance_km)
        .bind(request.date_echange)
        .fetch_one(&*self.pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur création troc direct: {}", e)))?;

        info!("[TROC_INTELLIGENT] ✅ Troc direct créé: id={}", troc.id);
        Ok(troc)
    }

    /// Créer un troc en chaîne
    pub async fn create_troc_chaine(
        &self,
        request: CreateTrocChaineRequest,
    ) -> AppResult<ChaineTrocLivre> {
        info!(
            "[TROC_INTELLIGENT] Création troc chaîne avec {} participants",
            request.participants.len()
        );

        // Valider la chaîne
        self.validate_chaine_troc(&request.participants).await?;

        // Calculer la distance totale et le score de proximité
        let mut distance_totale_km = 0.0;
        let mut scores_proximite = Vec::new();

        for i in 0..request.participants.len() {
            let participant = &request.participants[i];
            let participant_suivant = &request.participants[(i + 1) % request.participants.len()];

            // Récupérer les livres pour calculer la distance
            let livre1 =
                sqlx::query_as::<_, LivreScolaire>("SELECT * FROM livres_scolaires WHERE id = $1")
                    .bind(participant.livre_offert_id)
                    .fetch_optional(&*self.pool)
                    .await
                    .map_err(|e| AppError::Internal(format!("Erreur récupération livre: {}", e)))?
                    .ok_or_else(|| AppError::NotFound("Livre non trouvé".to_string()))?;

            let livre2 =
                sqlx::query_as::<_, LivreScolaire>("SELECT * FROM livres_scolaires WHERE id = $1")
                    .bind(participant_suivant.livre_offert_id)
                    .fetch_optional(&*self.pool)
                    .await
                    .map_err(|e| AppError::Internal(format!("Erreur récupération livre: {}", e)))?
                    .ok_or_else(|| AppError::NotFound("Livre non trouvé".to_string()))?;

            if let (Some((lat1, lon1)), Some((lat2, lon2))) =
                (Self::parse_gps(&livre1.gps), Self::parse_gps(&livre2.gps))
            {
                let distance = Self::haversine_distance(lat1, lon1, lat2, lon2);
                distance_totale_km += distance;
                scores_proximite.push(self.calculate_proximity_score(distance));
            }
        }

        let score_proximite = if !scores_proximite.is_empty() {
            Some(scores_proximite.iter().sum::<f64>() / scores_proximite.len() as f64)
        } else {
            None
        };

        // Créer la chaîne
        let participants_json = serde_json::to_value(&request.participants)
            .map_err(|e| AppError::Internal(format!("Erreur sérialisation participants: {}", e)))?;

        let chaine = sqlx::query_as::<_, ChaineTrocLivre>(
            r#"
            INSERT INTO chaines_troc_livres (
                participants, statut, score_proximite, distance_totale_km
            )
            VALUES ($1, 'en_formation', $2, $3)
            RETURNING *
            "#,
        )
        .bind(participants_json)
        .bind(score_proximite)
        .bind(Some(distance_totale_km))
        .fetch_one(&*self.pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur création chaîne troc: {}", e)))?;

        info!("[TROC_INTELLIGENT] ✅ Chaîne troc créée: id={}", chaine.id);
        Ok(chaine)
    }

    /// Valider une chaîne de troc
    pub async fn validate_chaine_troc(&self, participants: &[ParticipantChaine]) -> AppResult<()> {
        if participants.len() < 3 {
            return Err(AppError::BadRequest(
                "Une chaîne de troc doit avoir au moins 3 participants".to_string(),
            ));
        }

        // Vérifier que chaque participant a un livre valide et que les correspondances sont correctes
        for i in 0..participants.len() {
            let participant = &participants[i];
            let participant_suivant = &participants[(i + 1) % participants.len()];

            // Récupérer les livres
            let livre_offert = sqlx::query_as::<_, LivreScolaire>(
                "SELECT * FROM livres_scolaires WHERE id = $1 AND is_active = true AND is_available = true"
            )
            .bind(participant.livre_offert_id)
            .fetch_optional(&*self.pool)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur validation chaîne: {}", e)))?
            .ok_or_else(|| AppError::BadRequest(format!("Livre offert {} non trouvé", participant.livre_offert_id)))?;

            let livre_souhaite = sqlx::query_as::<_, LivreScolaire>(
                "SELECT * FROM livres_scolaires WHERE id = $1 AND is_active = true AND is_available = true"
            )
            .bind(participant.livre_souhaite_id)
            .fetch_optional(&*self.pool)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur validation chaîne: {}", e)))?
            .ok_or_else(|| AppError::BadRequest(format!("Livre souhaité {} non trouvé", participant.livre_souhaite_id)))?;

            // Vérifier la correspondance
            if livre_offert.classe_souhaitee != livre_souhaite.classe_actuelle
                || livre_offert.classe_actuelle != livre_souhaite.classe_souhaitee
                || livre_offert.matiere != livre_souhaite.matiere
            {
                return Err(AppError::BadRequest(format!(
                    "Correspondance incorrecte entre livre offert {} et livre souhaité {}",
                    participant.livre_offert_id, participant.livre_souhaite_id
                )));
            }

            // Vérifier que le livre souhaité correspond au livre offert du participant suivant
            let livre_offert_suivant =
                sqlx::query_as::<_, LivreScolaire>("SELECT * FROM livres_scolaires WHERE id = $1")
                    .bind(participant_suivant.livre_offert_id)
                    .fetch_optional(&*self.pool)
                    .await
                    .map_err(|e| AppError::Internal(format!("Erreur validation chaîne: {}", e)))?
                    .ok_or_else(|| {
                        AppError::BadRequest(format!(
                            "Livre suivant {} non trouvé",
                            participant_suivant.livre_offert_id
                        ))
                    })?;

            if livre_souhaite.id != livre_offert_suivant.id {
                return Err(AppError::BadRequest(
                    format!(
                        "Le livre souhaité {} doit correspondre au livre offert du participant suivant {}",
                        participant.livre_souhaite_id, participant_suivant.livre_offert_id
                    )
                ));
            }
        }

        Ok(())
    }

    /// Accepter un troc
    pub async fn accept_troc(&self, troc_id: i32, user_id: i32) -> AppResult<TrocLivre> {
        info!(
            "[TROC_INTELLIGENT] Acceptation troc: id={}, user_id={}",
            troc_id, user_id
        );

        // Récupérer le troc
        let troc =
            sqlx::query_as::<_, TrocLivre>("SELECT * FROM troc_livres_scolaires WHERE id = $1")
                .bind(troc_id)
                .fetch_optional(&*self.pool)
                .await
                .map_err(|e| AppError::Internal(format!("Erreur récupération troc: {}", e)))?
                .ok_or_else(|| AppError::NotFound("Troc non trouvé".to_string()))?;

        // Vérifier que l'utilisateur est le participant
        if troc.participant_id != user_id {
            return Err(AppError::Forbidden(
                "Vous n'êtes pas le participant de ce troc".to_string(),
            ));
        }

        // Mettre à jour le statut
        let troc_accepte = sqlx::query_as::<_, TrocLivre>(
            r#"
            UPDATE troc_livres_scolaires
            SET statut = 'accepte', validation_participant = true
            WHERE id = $1
            RETURNING *
            "#,
        )
        .bind(troc_id)
        .fetch_one(&*self.pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur acceptation troc: {}", e)))?;

        info!("[TROC_INTELLIGENT] ✅ Troc accepté: id={}", troc_id);
        Ok(troc_accepte)
    }

    /// Refuser un troc
    pub async fn refuse_troc(&self, troc_id: i32, user_id: i32) -> AppResult<TrocLivre> {
        info!(
            "[TROC_INTELLIGENT] Refus troc: id={}, user_id={}",
            troc_id, user_id
        );

        let troc = sqlx::query_as::<_, TrocLivre>(
            r#"
            UPDATE troc_livres_scolaires
            SET statut = 'refuse'
            WHERE id = $1 AND (initiateur_id = $2 OR participant_id = $2)
            RETURNING *
            "#,
        )
        .bind(troc_id)
        .bind(user_id)
        .fetch_optional(&*self.pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur refus troc: {}", e)))?
        .ok_or_else(|| {
            AppError::NotFound("Troc non trouvé ou vous n'êtes pas autorisé".to_string())
        })?;

        info!("[TROC_INTELLIGENT] ✅ Troc refusé: id={}", troc_id);
        Ok(troc)
    }

    /// Finaliser un troc (échange complété)
    pub async fn complete_troc(&self, troc_id: i32, user_id: i32) -> AppResult<TrocLivre> {
        info!(
            "[TROC_INTELLIGENT] Finalisation troc: id={}, user_id={}",
            troc_id, user_id
        );

        // Vérifier que le troc est accepté
        let troc =
            sqlx::query_as::<_, TrocLivre>("SELECT * FROM troc_livres_scolaires WHERE id = $1")
                .bind(troc_id)
                .fetch_optional(&*self.pool)
                .await
                .map_err(|e| AppError::Internal(format!("Erreur récupération troc: {}", e)))?
                .ok_or_else(|| AppError::NotFound("Troc non trouvé".to_string()))?;

        if troc.statut != "accepte" {
            return Err(AppError::BadRequest(
                "Le troc doit être accepté avant d'être complété".to_string(),
            ));
        }

        // Mettre à jour le statut et désactiver les livres
        let troc_complete = sqlx::query_as::<_, TrocLivre>(
            r#"
            UPDATE troc_livres_scolaires
            SET statut = 'complete', date_complete = NOW()
            WHERE id = $1
            RETURNING *
            "#,
        )
        .bind(troc_id)
        .fetch_one(&*self.pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur finalisation troc: {}", e)))?;

        // Désactiver les livres échangés
        sqlx::query("UPDATE livres_scolaires SET is_available = false WHERE id = $1 OR id = $2")
            .bind(troc_complete.livre_offert_id)
            .bind(troc_complete.livre_souhaite_id)
            .execute(&*self.pool)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur désactivation livres: {}", e)))?;

        info!("[TROC_INTELLIGENT] ✅ Troc complété: id={}", troc_id);
        Ok(troc_complete)
    }
}
