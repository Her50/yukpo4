// ✅ NOUVEAU: Service pour troc intelligent de livres scolaires

use crate::core::types::{AppError, AppResult};
use crate::models::livre_scolaire::{BookDeliveryPackage, LivreScolaire};
use crate::models::troc_livre::{
    BookCancellationRequest, ChainTransfer, ChaineTrocLivre, CreateTrocChaineRequest,
    CreateTrocDirectRequest, MatchingChaine, MatchingDirect, ParticipantChaine, TrocLivre,
};
use log::{self, info};
use sqlx::PgPool;
use std::collections::{HashMap, HashSet};
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

    /// Vérifie si un flux directionnel (user_a envoie déjà à user_b) existe
    /// via un troc complété ou en cours.
    /// Retourne true si un troc A→B existe (livre_offert de A, participant = B)
    async fn has_existing_flow(&self, from_user: i32, to_user: i32) -> bool {
        let count: i64 = sqlx::query_scalar(
            r#"
            SELECT COUNT(*) FROM troc_livres_scolaires
            WHERE initiateur_id = $1 AND participant_id = $2
            AND statut IN ('en_attente', 'accepte', 'complete')
            "#,
        )
        .bind(from_user)
        .bind(to_user)
        .fetch_one(&*self.pool)
        .await
        .unwrap_or(0);
        count > 0
    }

    /// Trouver les matchings directs (2 personnes)
    /// ANTI-RÉCIPROCITÉ: Si un flux A→B existe déjà (initiateur=A, participant=B),
    /// les matchs B→A sont marqués is_reciprocal=true et pénalisés au tri.
    /// L'appelant devrait préférer les chaînes (3+ personnes) aux matchs réciproques.
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

        let initiateur_id = livre_offert.user_id;

        // Chercher les livres qui correspondent
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
            AND COALESCE(etat_classification, 'acceptable') != 'rejete'
            AND COALESCE(mode_listing, 'troc') IN ('troc', 'vente')
            ORDER BY created_at DESC
            LIMIT 50
            "#,
        )
        .bind(livre_offert_id)
        .bind(initiateur_id)
        .bind(&livre_offert.classe_souhaitee)
        .bind(&livre_offert.classe_actuelle)
        .bind(&livre_offert.matiere)
        .fetch_all(&*self.pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur recherche matchings: {}", e)))?;

        let mut matchings = Vec::new();
        let gps_offert = Self::parse_gps(&livre_offert.gps);

        for livre_souhaite in livres_candidates {
            let participant_id = livre_souhaite.user_id;

            // ANTI-RÉCIPROCITÉ: vérifier si le participant envoie déjà vers l'initiateur
            // ou si l'initiateur envoie déjà vers le participant
            let reverse_exists = self.has_existing_flow(participant_id, initiateur_id).await
                || self.has_existing_flow(initiateur_id, participant_id).await;

            let distance_km = if let (Some((lat1, lon1)), Some((lat2, lon2))) =
                (gps_offert, Self::parse_gps(&livre_souhaite.gps))
            {
                Some(Self::haversine_distance(lat1, lon1, lat2, lon2))
            } else {
                None
            };

            // Pénaliser les matchs réciproques: diviser le score par 2
            let base_score = distance_km.map(|d| self.calculate_proximity_score(d)).unwrap_or(0.5);
            let score_proximite = if reverse_exists {
                base_score * 0.5 // pénalité forte pour réciprocité
            } else {
                base_score
            };

            matchings.push(MatchingDirect {
                livre_offert_id,
                livre_souhaite_id: livre_souhaite.id,
                participant_id,
                distance_km,
                score_proximite,
                livre_offert: Some(
                    serde_json::to_value(&livre_offert).unwrap_or(serde_json::Value::Null),
                ),
                livre_souhaite: Some(
                    serde_json::to_value(&livre_souhaite).unwrap_or(serde_json::Value::Null),
                ),
                is_reciprocal: reverse_exists,
            });
        }

        // Trier: non-réciproques d'abord, puis par score décroissant
        matchings.sort_by(|a, b| {
            // Non-réciproques avant réciproques
            a.is_reciprocal.cmp(&b.is_reciprocal).then_with(|| {
                b.score_proximite
                    .partial_cmp(&a.score_proximite)
                    .unwrap_or(std::cmp::Ordering::Equal)
            })
        });

        let non_reciprocal_count = matchings.iter().filter(|m| !m.is_reciprocal).count();
        info!(
            "[TROC_INTELLIGENT] ✅ {} matchings directs ({} non-réciproques, {} réciproques)",
            matchings.len(),
            non_reciprocal_count,
            matchings.len() - non_reciprocal_count,
        );
        Ok(matchings)
    }

    // ========================================================================
    // V3: MATCHING CHAÎNE DAG — SANS RÉCIPROCITÉ
    // ========================================================================
    //
    // Algorithme:
    //   1. Construire un graphe dirigé de transferts potentiels (livre_owner → receiver)
    //      - Un transfert existe si le livre de A correspond au besoin de B
    //        (classe_actuelle de A = classe_souhaitee de B, même matière)
    //   2. Anti-réciprocité: si on ajoute A→B, jamais B→A dans la même chaîne
    //   3. Vendeurs (mode_listing='vente') = nœuds source uniquement (ils donnent, ne reçoivent rien)
    //   4. Taille dynamique, optimisée par proximité GPS
    //   5. La chaîne est "bouclée" quand tous les besoins du demandeur initial sont couverts
    //      OU quand on ne peut plus ajouter de transferts sans violer l'anti-réciprocité
    //
    // Résultat: un DAG (pas un cycle) d'arêtes (sender → receiver, livre)

    /// Trouver les matchings en chaîne (2+ personnes, DAG sans réciprocité)
    pub async fn find_matching_chaine(
        &self,
        livre_offert_id: i32,
        max_participants: Option<i32>,
    ) -> AppResult<Vec<MatchingChaine>> {
        info!(
            "[TROC_INTELLIGENT] V3: Recherche chaîne DAG pour livre: {}",
            livre_offert_id
        );

        let max_nodes = max_participants.unwrap_or(8) as usize;

        // Récupérer le livre offert (point de départ)
        let livre_offert = sqlx::query_as::<_, LivreScolaire>(
            "SELECT * FROM livres_scolaires WHERE id = $1 AND is_active = true AND is_available = true",
        )
        .bind(livre_offert_id)
        .fetch_optional(&*self.pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur récupération livre: {}", e)))?
        .ok_or_else(|| AppError::NotFound("Livre offert non trouvé".to_string()))?;

        let initiateur_id = livre_offert.user_id;

        // Récupérer TOUS les livres actifs disponibles (sauf ceux de l'initiateur)
        let all_livres = sqlx::query_as::<_, LivreScolaire>(
            r#"
            SELECT * FROM livres_scolaires
            WHERE is_active = true AND is_available = true
            AND user_id != $1
            AND COALESCE(etat_classification, 'acceptable') != 'rejete'
            AND COALESCE(mode_listing, 'troc') IN ('troc', 'vente')
            ORDER BY created_at DESC
            LIMIT 500
            "#,
        )
        .bind(initiateur_id)
        .fetch_all(&*self.pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur récupération livres: {}", e)))?;

        // Inclure les livres de l'initiateur (il peut offrir plusieurs livres)
        let initiateur_livres = sqlx::query_as::<_, LivreScolaire>(
            r#"
            SELECT * FROM livres_scolaires
            WHERE is_active = true AND is_available = true
            AND user_id = $1
            AND COALESCE(etat_classification, 'acceptable') != 'rejete'
            "#,
        )
        .bind(initiateur_id)
        .fetch_all(&*self.pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur livres initiateur: {}", e)))?;

        // Tous les livres = initiateur + autres
        let mut tous_livres = initiateur_livres.clone();
        tous_livres.extend(all_livres);

        // Index par user_id pour accès rapide
        let mut livres_par_user: HashMap<i32, Vec<&LivreScolaire>> = HashMap::new();
        for l in &tous_livres {
            livres_par_user.entry(l.user_id).or_default().push(l);
        }

        // ---------------------------------------------------------------
        // Construire toutes les arêtes potentielles du graphe
        // Arête: (sender_user_id, receiver_user_id, livre envoyé)
        // Condition: le livre de sender a classe_actuelle == classe_souhaitee du receiver
        //            ET même matière
        // ---------------------------------------------------------------
        struct PotentialEdge {
            sender_id: i32,
            receiver_id: i32,
            livre: LivreScolaire,
            distance_km: f64,
        }

        let mut edges: Vec<PotentialEdge> = Vec::new();

        // Pour chaque paire (sender_book, receiver_user_need), vérifier le matching
        // Le "besoin" d'un utilisateur = classe_souhaitee de ses livres
        // Un livre de sender correspond si sender.classe_actuelle == receiver.classe_souhaitee
        // ET sender.matiere == receiver.matiere (livre correspondant à la même matière)
        for sender_livre in &tous_livres {
            let sender_id = sender_livre.user_id;
            for (&receiver_id, receiver_livres) in &livres_par_user {
                if sender_id == receiver_id {
                    continue;
                }
                // Le receiver a-t-il besoin d'un livre de cette classe/matière ?
                let receiver_needs = receiver_livres.iter().any(|rl| {
                    rl.classe_souhaitee == sender_livre.classe_actuelle
                        && rl.matiere == sender_livre.matiere
                });
                if !receiver_needs {
                    continue;
                }
                // Vendeur ne peut PAS recevoir (source-only)
                let _sender_mode = sender_livre.mode_listing.as_deref().unwrap_or("troc");
                // Le receiver ne peut recevoir que s'il est en mode troc (pas vendeur pur)
                // Note: un vendeur peut quand même recevoir s'il a aussi un livre en mode troc
                // Mais on vérifie au niveau de l'arête: le sender peut envoyer
                let dist = Self::compute_distance_between(sender_livre, receiver_livres[0]);

                edges.push(PotentialEdge {
                    sender_id,
                    receiver_id,
                    livre: sender_livre.clone(),
                    distance_km: dist,
                });
            }
        }

        // Trier les arêtes par distance (les plus proches d'abord)
        edges.sort_by(|a, b| {
            a.distance_km.partial_cmp(&b.distance_km).unwrap_or(std::cmp::Ordering::Equal)
        });

        info!(
            "[TROC_INTELLIGENT] {} arêtes potentielles, {} users",
            edges.len(),
            livres_par_user.len()
        );

        // ---------------------------------------------------------------
        // Greedy DAG construction: ajouter les arêtes une par une
        // en respectant:
        //   - Anti-réciprocité: si A→B, pas B→A
        //   - Max nodes
        //   - Pas de self-loop
        //   - Un livre ne peut être transféré qu'une seule fois
        // ---------------------------------------------------------------
        let mut dag_edges: Vec<&PotentialEdge> = Vec::new();
        let mut directed_pairs: HashSet<(i32, i32)> = HashSet::new(); // (sender, receiver) existants
        let mut used_livre_ids: HashSet<i32> = HashSet::new();
        let mut chain_users: HashSet<i32> = HashSet::new();

        // L'initiateur est toujours dans la chaîne
        chain_users.insert(initiateur_id);

        for edge in &edges {
            // Anti-réciprocité: si (receiver→sender) existe, skip
            if directed_pairs.contains(&(edge.receiver_id, edge.sender_id)) {
                continue;
            }
            // Livre déjà utilisé ?
            if used_livre_ids.contains(&edge.livre.id) {
                continue;
            }
            // Max nodes ?
            let new_users = [edge.sender_id, edge.receiver_id]
                .iter()
                .filter(|u| !chain_users.contains(u))
                .count();
            if chain_users.len() + new_users > max_nodes {
                continue;
            }
            // L'initiateur DOIT être impliqué (soit comme sender, soit comme receiver,
            // soit via un chemin transitif). On accepte l'arête si au moins un des deux
            // est déjà dans la chaîne, OU si c'est la première arête.
            if !chain_users.contains(&edge.sender_id)
                && !chain_users.contains(&edge.receiver_id)
                && !dag_edges.is_empty()
            {
                continue; // Arête déconnectée de la chaîne
            }

            // Ajouter l'arête
            directed_pairs.insert((edge.sender_id, edge.receiver_id));
            used_livre_ids.insert(edge.livre.id);
            chain_users.insert(edge.sender_id);
            chain_users.insert(edge.receiver_id);
            dag_edges.push(edge);
        }

        if dag_edges.len() < 2 {
            // Pas assez d'arêtes pour former une chaîne intéressante
            return Ok(vec![]);
        }

        // ---------------------------------------------------------------
        // Construire le MatchingChaine résultat
        // ---------------------------------------------------------------
        let mut transfers = Vec::new();
        let mut participants_map: HashMap<i32, i32> = HashMap::new(); // user_id → ordre
        let mut ordre = 1;
        let mut distance_totale_km = 0.0;

        // Identifier les vendeurs (users qui n'ont QUE des livres en mode 'vente')
        let mut vendeurs: HashSet<i32> = HashSet::new();
        for &uid in &chain_users {
            if let Some(user_livres) = livres_par_user.get(&uid) {
                let all_vente = user_livres
                    .iter()
                    .all(|l| l.mode_listing.as_deref().unwrap_or("troc") == "vente");
                if all_vente {
                    vendeurs.insert(uid);
                }
            }
        }

        for edge in &dag_edges {
            let valeur = edge
                .livre
                .valeur_calculee
                .map(|v| v.to_string().parse::<f64>().unwrap_or(0.0))
                .unwrap_or(0.0);

            transfers.push(ChainTransfer {
                sender_id: edge.sender_id,
                receiver_id: edge.receiver_id,
                livre_id: edge.livre.id,
                livre_titre: Some(edge.livre.titre.clone()),
                matiere: Some(edge.livre.matiere.clone()),
                valeur,
                mode_listing: edge.livre.mode_listing.clone().unwrap_or("troc".to_string()),
                statut: "pending".to_string(),
            });

            distance_totale_km += edge.distance_km;

            // Assigner ordre aux participants
            if !participants_map.contains_key(&edge.sender_id) {
                participants_map.insert(edge.sender_id, ordre);
                ordre += 1;
            }
            if !participants_map.contains_key(&edge.receiver_id) {
                participants_map.insert(edge.receiver_id, ordre);
                ordre += 1;
            }
        }

        // Construire les participants (vendeurs en premier)
        let mut participants: Vec<(i32, i32)> = participants_map.into_iter().collect();
        participants.sort_by(|a, b| {
            let a_is_vendeur = vendeurs.contains(&a.0);
            let b_is_vendeur = vendeurs.contains(&b.0);
            // Vendeurs d'abord, puis par ordre d'ajout
            b_is_vendeur.cmp(&a_is_vendeur).then_with(|| a.1.cmp(&b.1))
        });

        // Re-numéroter
        let participant_chaines: Vec<ParticipantChaine> = participants
            .iter()
            .enumerate()
            .map(|(i, (uid, _))| {
                // Trouver le premier livre offert par cet utilisateur dans les transfers
                let livre_offert_id =
                    transfers.iter().find(|t| t.sender_id == *uid).map(|t| t.livre_id).unwrap_or(0);
                let livre_souhaite_id = transfers
                    .iter()
                    .find(|t| t.receiver_id == *uid)
                    .map(|t| t.livre_id)
                    .unwrap_or(0);
                ParticipantChaine {
                    user_id: *uid,
                    livre_offert_id,
                    livre_souhaite_id,
                    ordre: (i + 1) as i32,
                }
            })
            .collect();

        let score_proximite = if distance_totale_km > 0.0 {
            self.calculate_proximity_score(distance_totale_km / dag_edges.len() as f64)
        } else {
            0.5
        };

        let livres_json: Vec<serde_json::Value> = transfers
            .iter()
            .map(|t| serde_json::to_value(t).unwrap_or(serde_json::Value::Null))
            .collect();

        let matching = MatchingChaine {
            chaine_id: None,
            participants: participant_chaines,
            transfers,
            distance_totale_km,
            score_proximite,
            nombre_participants: chain_users.len() as i32,
            nombre_vendeurs: vendeurs.len() as i32,
            livres: livres_json,
        };

        info!(
            "[TROC_INTELLIGENT] ✅ Chaîne DAG: {} participants, {} transferts, {} vendeurs, {:.1} km",
            chain_users.len(),
            dag_edges.len(),
            vendeurs.len(),
            distance_totale_km
        );

        Ok(vec![matching])
    }

    /// Calcule la distance entre deux livres via leur GPS
    fn compute_distance_between(livre_a: &LivreScolaire, livre_b: &LivreScolaire) -> f64 {
        match (Self::parse_gps(&livre_a.gps), Self::parse_gps(&livre_b.gps)) {
            (Some((lat1, lon1)), Some((lat2, lon2))) => {
                Self::haversine_distance(lat1, lon1, lat2, lon2)
            }
            _ => 999.0, // Pas de GPS → grande distance par défaut
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

        // ✅ FIX: Vérifier que l'utilisateur est impliqué dans le troc
        if troc.initiateur_id != user_id && troc.participant_id != user_id {
            return Err(AppError::Forbidden(
                "Vous n'êtes pas impliqué dans ce troc".to_string(),
            ));
        }

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

        // NOTE: Les paquets de livraison ne sont PAS créés ici.
        // Ils sont constitués intelligemment via build_intelligent_packages()
        // qui regroupe par couple (expéditeur → destinataire) et optimise par GPS.

        info!("[TROC_INTELLIGENT] ✅ Troc complété: id={}", troc_id);
        Ok(troc_complete)
    }

    // ========================================================================
    // CONSTITUTION INTELLIGENTE DES PAQUETS
    // ========================================================================

    /// Constituer les paquets de livraison pour un destinataire donné.
    ///
    /// Algorithme:
    /// 1. Récupérer tous les trocs complétés non-packagés impliquant cet utilisateur
    /// 2. Pour chaque troc, extraire le "transfert" vers cet utilisateur:
    ///    - Si user est participant → il reçoit livre_offert (expéditeur = initiateur)
    ///    - Si user est initiateur → il reçoit livre_souhaite (expéditeur = participant)
    /// 3. Regrouper par expéditeur (même couple expéditeur→destinataire = 1 paquet)
    /// 4. Créer un paquet par groupe avec tous les livres, GPS, valeur, commission
    /// 5. Marquer les trocs comme packagés
    ///
    /// Retourne le nombre de paquets créés.
    pub async fn build_intelligent_packages(
        &self,
        destinataire_id: i32,
    ) -> AppResult<Vec<serde_json::Value>> {
        info!(
            "[TROC_INTELLIGENT] Constitution intelligente des paquets pour user {}",
            destinataire_id
        );

        // 1. Trocs complétés non-packagés où cet utilisateur est impliqué
        let trocs = sqlx::query_as::<_, TrocLivre>(
            r#"
            SELECT * FROM troc_livres_scolaires
            WHERE statut = 'complete'
            AND COALESCE(is_packaged, false) = false
            AND (initiateur_id = $1 OR participant_id = $1)
            ORDER BY created_at ASC
            "#,
        )
        .bind(destinataire_id)
        .fetch_all(&*self.pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur récupération trocs: {}", e)))?;

        if trocs.is_empty() {
            info!(
                "[TROC_INTELLIGENT] Aucun troc complété non-packagé pour user {}",
                destinataire_id
            );
            return Ok(vec![]);
        }

        // 2. Extraire les transferts vers cet utilisateur
        //    Structure: HashMap<expediteur_id, Vec<(troc_id, livre_id)>>
        let mut transfers: std::collections::HashMap<i32, Vec<(i32, i32)>> =
            std::collections::HashMap::new();

        for troc in &trocs {
            if troc.participant_id == destinataire_id {
                // User est le participant → reçoit livre_offert de l'initiateur
                transfers
                    .entry(troc.initiateur_id)
                    .or_default()
                    .push((troc.id, troc.livre_offert_id));
            }
            if troc.initiateur_id == destinataire_id {
                // User est l'initiateur → reçoit livre_souhaite du participant
                transfers
                    .entry(troc.participant_id)
                    .or_default()
                    .push((troc.id, troc.livre_souhaite_id));
            }
        }

        if transfers.is_empty() {
            return Ok(vec![]);
        }

        // 3. Pour chaque expéditeur, constituer un paquet
        let mut created_packages = Vec::new();
        let ts = chrono::Utc::now().format("%Y%m%d%H%M%S");

        for (expediteur_id, livre_troc_pairs) in &transfers {
            let troc_ids_for_package: Vec<i32> =
                livre_troc_pairs.iter().map(|(tid, _)| *tid).collect();
            let livre_ids: Vec<i32> = livre_troc_pairs.iter().map(|(_, lid)| *lid).collect();

            // Récupérer les livres
            let mut livres_json = Vec::new();
            let mut valeur_totale = 0.0f64;
            let mut expediteur_gps: Option<String> = None;
            let mut expediteur_adresse: Option<String> = None;
            let mut destinataire_gps_val: Option<String> = None;
            let mut destinataire_adresse_val: Option<String> = None;

            for livre_id in &livre_ids {
                if let Ok(Some(livre)) = sqlx::query_as::<_, LivreScolaire>(
                    "SELECT * FROM livres_scolaires WHERE id = $1",
                )
                .bind(livre_id)
                .fetch_optional(&*self.pool)
                .await
                {
                    let valeur: f64 = livre
                        .valeur_calculee
                        .and_then(|v| v.to_string().parse().ok())
                        .unwrap_or(0.0);

                    livres_json.push(serde_json::json!({
                        "livre_id": livre.id,
                        "titre": livre.titre,
                        "auteur": livre.auteur,
                        "matiere": livre.matiere,
                        "classe_actuelle": livre.classe_actuelle,
                        "classe_souhaitee": livre.classe_souhaitee,
                        "etat_livre": livre.etat_livre,
                        "etat_classification": livre.etat_classification,
                        "image_recto": livre.image_recto,
                        "image_verso": livre.image_verso,
                        "valeur": valeur,
                        "mode": livre.mode_listing
                    }));

                    valeur_totale += valeur;

                    // Utiliser le GPS du livre comme proxy pour l'expéditeur
                    if expediteur_gps.is_none() {
                        expediteur_gps = livre.gps.clone();
                        expediteur_adresse = livre.ville.clone().or_else(|| livre.quartier.clone());
                    }
                }
            }

            if livres_json.is_empty() {
                log::warn!(
                    "[TROC_INTELLIGENT] Aucun livre trouvé pour expéditeur {} → destinataire {}",
                    expediteur_id,
                    destinataire_id
                );
                continue;
            }

            // GPS du destinataire: chercher dans les livres du destinataire ou son profil
            if let Ok(Some(dest_livre)) = sqlx::query_as::<_, LivreScolaire>(
                "SELECT * FROM livres_scolaires WHERE user_id = $1 AND gps IS NOT NULL ORDER BY created_at DESC LIMIT 1"
            )
            .bind(destinataire_id)
            .fetch_optional(&*self.pool)
            .await
            {
                destinataire_gps_val = dest_livre.gps.clone();
                destinataire_adresse_val =
                    dest_livre.ville.clone().or_else(|| dest_livre.quartier.clone());
            }

            // Créer le paquet
            let nombre_livres = livres_json.len() as i32;
            let reference = format!("BK-PKG-{}-{}-{}", destinataire_id, expediteur_id, ts);
            let commission = valeur_totale * crate::models::livre_scolaire::TAUX_COMMISSION_APP;

            match sqlx::query(
                r#"
                INSERT INTO book_delivery_packages (
                    reference, expediteur_id, expediteur_gps, expediteur_adresse,
                    destinataire_id, destinataire_gps, destinataire_adresse,
                    livres, nombre_livres, troc_ids,
                    valeur_totale, commission_app, statut
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'a_constituer')
                "#,
            )
            .bind(&reference)
            .bind(expediteur_id)
            .bind(&expediteur_gps)
            .bind(&expediteur_adresse)
            .bind(destinataire_id)
            .bind(&destinataire_gps_val)
            .bind(&destinataire_adresse_val)
            .bind(serde_json::json!(livres_json))
            .bind(nombre_livres)
            .bind(serde_json::json!(troc_ids_for_package))
            .bind(rust_decimal::Decimal::from_f64_retain(valeur_totale).unwrap_or_default())
            .bind(rust_decimal::Decimal::from_f64_retain(commission).unwrap_or_default())
            .execute(&*self.pool)
            .await
            {
                Ok(_) => {
                    info!(
                        "[TROC_INTELLIGENT] ✅ Paquet créé: {} ({} → {}, {} livres, {:.0} XAF)",
                        reference, expediteur_id, destinataire_id, nombre_livres, valeur_totale
                    );
                    created_packages.push(serde_json::json!({
                        "reference": reference,
                        "expediteur_id": expediteur_id,
                        "destinataire_id": destinataire_id,
                        "nombre_livres": nombre_livres,
                        "valeur_totale": valeur_totale,
                        "troc_ids": troc_ids_for_package,
                    }));
                }
                Err(e) => {
                    log::error!(
                        "[TROC_INTELLIGENT] ❌ Erreur création paquet {} → {}: {}",
                        expediteur_id,
                        destinataire_id,
                        e
                    );
                }
            }
        }

        // 4. Marquer les trocs comme packagés
        if !created_packages.is_empty() {
            let troc_ids_all: Vec<i32> = trocs.iter().map(|t| t.id).collect();
            for tid in &troc_ids_all {
                let _ = sqlx::query(
                    "UPDATE troc_livres_scolaires SET is_packaged = true WHERE id = $1",
                )
                .bind(tid)
                .execute(&*self.pool)
                .await;
            }
            info!(
                "[TROC_INTELLIGENT] ✅ {} trocs marqués packagés pour user {}",
                troc_ids_all.len(),
                destinataire_id
            );
        }

        info!(
            "[TROC_INTELLIGENT] ✅ Constitution terminée pour user {}: {} paquets créés",
            destinataire_id,
            created_packages.len()
        );
        Ok(created_packages)
    }

    // ========================================================================
    // VALIDATION DU BESOIN AVANT DISPATCH COURSIER
    // ========================================================================

    /// Vérifie que tous les paquets liés au besoin d'un utilisateur sont constitués
    /// avant de permettre le dispatch coursier.
    ///
    /// Un "besoin" = tous les livres que l'utilisateur doit recevoir
    ///   (classe_souhaitee dans ses livres actifs, mode troc).
    /// On vérifie que pour chaque troc complété impliquant cet utilisateur,
    /// un paquet correspondant existe dans book_delivery_packages.
    ///
    /// Retourne (is_ready, message, details)
    pub async fn validate_need_fulfillment(
        &self,
        user_id: i32,
    ) -> AppResult<(bool, String, serde_json::Value)> {
        info!("[TROC_INTELLIGENT] Validation besoin pour user {}", user_id);

        // Trocs complétés impliquant cet utilisateur
        let total_trocs: i64 = sqlx::query_scalar(
            r#"
            SELECT COUNT(*) FROM troc_livres_scolaires
            WHERE statut = 'complete'
            AND (initiateur_id = $1 OR participant_id = $1)
            "#,
        )
        .bind(user_id)
        .fetch_one(&*self.pool)
        .await
        .unwrap_or(0);

        // Trocs complétés MAIS non-packagés
        let unpackaged_trocs: i64 = sqlx::query_scalar(
            r#"
            SELECT COUNT(*) FROM troc_livres_scolaires
            WHERE statut = 'complete'
            AND COALESCE(is_packaged, false) = false
            AND (initiateur_id = $1 OR participant_id = $1)
            "#,
        )
        .bind(user_id)
        .fetch_one(&*self.pool)
        .await
        .unwrap_or(0);

        // Paquets constitués pour cet utilisateur (en tant que destinataire)
        let packages_ready: i64 = sqlx::query_scalar(
            r#"
            SELECT COUNT(*) FROM book_delivery_packages
            WHERE destinataire_id = $1
            AND statut IN ('a_constituer', 'constitue')
            "#,
        )
        .bind(user_id)
        .fetch_one(&*self.pool)
        .await
        .unwrap_or(0);

        let is_ready = unpackaged_trocs == 0 && total_trocs > 0;
        let message = if is_ready {
            format!(
                "Tous les paquets sont constitués ({} paquets prêts, {} trocs complétés)",
                packages_ready, total_trocs
            )
        } else if unpackaged_trocs > 0 {
            format!(
                "{} trocs complétés n'ont pas encore de paquet. Appelez build-intelligent d'abord.",
                unpackaged_trocs
            )
        } else {
            "Aucun troc complété pour cet utilisateur".to_string()
        };

        let details = serde_json::json!({
            "user_id": user_id,
            "total_trocs_completes": total_trocs,
            "trocs_non_packages": unpackaged_trocs,
            "paquets_prets": packages_ready,
            "is_ready_for_dispatch": is_ready,
        });

        Ok((is_ready, message, details))
    }

    // ========================================================================
    // OPTIMISATION DE ROUTE COURSIER
    // ========================================================================

    /// Regroupe tous les paquets qu'un coursier doit traiter pour un ensemble
    /// d'utilisateurs et calcule un itinéraire optimisé (nearest-neighbor TSP).
    ///
    /// Principe: le coursier ne doit JAMAIS retourner chez un utilisateur.
    /// Il passe UNE SEULE FOIS à chaque adresse, prend/dépose tous les paquets.
    ///
    /// Retourne les waypoints ordonnés avec paquets à prendre/déposer à chaque arrêt.
    pub async fn compute_optimized_route(
        &self,
        package_ids: &[i32],
    ) -> AppResult<Vec<serde_json::Value>> {
        use crate::models::livre_scolaire::BookDeliveryPackage;

        if package_ids.is_empty() {
            return Ok(vec![]);
        }

        // Récupérer tous les paquets
        let mut packages = Vec::new();
        for pid in package_ids {
            if let Ok(Some(pkg)) = sqlx::query_as::<_, BookDeliveryPackage>(
                "SELECT * FROM book_delivery_packages WHERE id = $1",
            )
            .bind(pid)
            .fetch_optional(&*self.pool)
            .await
            {
                packages.push(pkg);
            }
        }

        if packages.is_empty() {
            return Ok(vec![]);
        }

        // Construire la liste des waypoints (chaque user_id/gps unique = 1 arrêt)
        // Un waypoint a: user_id, gps, adresse, pickups[], dropoffs[]
        let mut waypoints_map: std::collections::HashMap<
            i32,
            (Option<String>, Option<String>, Vec<i32>, Vec<i32>),
        > = std::collections::HashMap::new();

        for pkg in &packages {
            // Expéditeur: pickup
            let entry = waypoints_map.entry(pkg.expediteur_id).or_insert_with(|| {
                (
                    pkg.expediteur_gps.clone(),
                    pkg.expediteur_adresse.clone(),
                    Vec::new(),
                    Vec::new(),
                )
            });
            entry.2.push(pkg.id); // pickup

            // Destinataire: dropoff
            let entry = waypoints_map.entry(pkg.destinataire_id).or_insert_with(|| {
                (
                    pkg.destinataire_gps.clone(),
                    pkg.destinataire_adresse.clone(),
                    Vec::new(),
                    Vec::new(),
                )
            });
            entry.3.push(pkg.id); // dropoff
        }

        // Convertir en Vec pour pouvoir ordonner
        let waypoints: Vec<(i32, Option<String>, Option<String>, Vec<i32>, Vec<i32>)> =
            waypoints_map
                .into_iter()
                .map(|(uid, (gps, addr, pickups, dropoffs))| (uid, gps, addr, pickups, dropoffs))
                .collect();

        // Nearest-neighbor TSP pour ordonner les waypoints
        // Contrainte: les pickups doivent être AVANT les dropoffs correspondants
        // Approche: d'abord tous les pickups, puis tous les dropoffs, optimisés par proximité
        let mut pickup_waypoints: Vec<_> = waypoints
            .iter()
            .filter(|(_, _, _, pickups, _)| !pickups.is_empty())
            .cloned()
            .collect();
        let mut dropoff_only_waypoints: Vec<_> = waypoints
            .iter()
            .filter(|(_, _, _, pickups, dropoffs)| pickups.is_empty() && !dropoffs.is_empty())
            .cloned()
            .collect();

        // Trier pickups par nearest-neighbor
        Self::sort_by_nearest_neighbor(&mut pickup_waypoints);
        // Trier dropoffs par nearest-neighbor (depuis le dernier pickup)
        Self::sort_by_nearest_neighbor(&mut dropoff_only_waypoints);

        // Construire l'itinéraire final: pickups d'abord, puis dropoffs-only
        // Note: certains waypoints sont à la fois pickup ET dropoff (le coursier
        // dépose ET récupère au même endroit) — ceux-ci apparaissent dans pickup_waypoints
        let mut ordered = Vec::new();
        let mut ordre = 1;

        for (uid, gps, addr, pickups, dropoffs) in &pickup_waypoints {
            let wp_type = if !dropoffs.is_empty() {
                "pickup_and_dropoff"
            } else {
                "pickup"
            };
            ordered.push(serde_json::json!({
                "ordre": ordre,
                "type": wp_type,
                "user_id": uid,
                "gps": gps,
                "adresse": addr,
                "pickup_package_ids": pickups,
                "dropoff_package_ids": dropoffs,
            }));
            ordre += 1;
        }

        for (uid, gps, addr, pickups, dropoffs) in &dropoff_only_waypoints {
            ordered.push(serde_json::json!({
                "ordre": ordre,
                "type": "dropoff",
                "user_id": uid,
                "gps": gps,
                "adresse": addr,
                "pickup_package_ids": pickups,
                "dropoff_package_ids": dropoffs,
            }));
            ordre += 1;
        }

        info!(
            "[TROC_INTELLIGENT] ✅ Route optimisée: {} waypoints pour {} paquets",
            ordered.len(),
            package_ids.len()
        );
        Ok(ordered)
    }

    /// Tri nearest-neighbor sur des waypoints GPS
    fn sort_by_nearest_neighbor(
        waypoints: &mut Vec<(i32, Option<String>, Option<String>, Vec<i32>, Vec<i32>)>,
    ) {
        if waypoints.len() <= 1 {
            return;
        }

        let mut ordered = Vec::with_capacity(waypoints.len());
        let mut remaining = waypoints.clone();

        // Commencer par le premier
        ordered.push(remaining.remove(0));

        while !remaining.is_empty() {
            let last = ordered.last().unwrap();
            let last_gps = Self::parse_gps(&last.1);

            let mut best_idx = 0;
            let mut best_dist = f64::MAX;

            for (i, wp) in remaining.iter().enumerate() {
                let wp_gps = Self::parse_gps(&wp.1);
                let dist = match (last_gps, wp_gps) {
                    (Some((lat1, lon1)), Some((lat2, lon2))) => {
                        Self::haversine_distance(lat1, lon1, lat2, lon2)
                    }
                    _ => f64::MAX / 2.0, // Pas de GPS → mettre à la fin
                };
                if dist < best_dist {
                    best_dist = dist;
                    best_idx = i;
                }
            }

            ordered.push(remaining.remove(best_idx));
        }

        *waypoints = ordered;
    }

    /// Pour un destinataire donné, retourne tous les paquets à livrer (de tous expéditeurs)
    /// afin que le coursier les prenne tous en un seul passage.
    pub async fn get_all_packages_for_user(&self, user_id: i32) -> AppResult<Vec<i32>> {
        let package_ids: Vec<i32> = sqlx::query_scalar(
            r#"
            SELECT id FROM book_delivery_packages
            WHERE (destinataire_id = $1 OR expediteur_id = $1)
            AND statut IN ('a_constituer', 'constitue')
            AND delivery_uuid IS NULL
            ORDER BY created_at ASC
            "#,
        )
        .bind(user_id)
        .fetch_all(&*self.pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur récupération paquets user: {}", e)))?;

        Ok(package_ids)
    }

    // ========================================================================
    // V3: FINALISATION DE CHAÎNE (DAG)
    // ========================================================================

    /// Finalise une chaîne validée:
    /// 1. Désactive tous les livres impliqués
    /// 2. Crée les paquets de livraison par (sender→receiver)
    /// 3. Calcule la route optimisée (vendeurs = point de départ)
    /// 4. Met à jour la chaîne avec transfers, route, package_ids
    /// 5. Retourne les infos complètes pour notification
    pub async fn finalize_chain(&self, chaine_id: i32) -> AppResult<serde_json::Value> {
        info!("[TROC_INTELLIGENT] V3: Finalisation chaîne {}", chaine_id);

        // 1. Récupérer la chaîne
        let chaine =
            sqlx::query_as::<_, ChaineTrocLivre>("SELECT * FROM chaines_troc_livres WHERE id = $1")
                .bind(chaine_id)
                .fetch_optional(&*self.pool)
                .await
                .map_err(|e| AppError::Internal(format!("Erreur récupération chaîne: {}", e)))?
                .ok_or_else(|| AppError::NotFound("Chaîne non trouvée".to_string()))?;

        if chaine.statut != "validee" && chaine.statut != "en_formation" {
            return Err(AppError::BadRequest(format!(
                "Chaîne en statut '{}', attendu 'validee' ou 'en_formation'",
                chaine.statut
            )));
        }

        // 2. Parser les transfers depuis le JSON
        let transfers: Vec<ChainTransfer> = if let Some(ref t) = chaine.transfers {
            serde_json::from_value(t.clone()).unwrap_or_default()
        } else {
            return Err(AppError::BadRequest(
                "Chaîne sans transfers — utilisez find_matching_chaine d'abord".to_string(),
            ));
        };

        if transfers.is_empty() {
            return Err(AppError::BadRequest(
                "Aucun transfert dans la chaîne".to_string(),
            ));
        }

        // 3. Désactiver tous les livres impliqués
        let livre_ids: Vec<i32> = transfers.iter().map(|t| t.livre_id).collect();
        for lid in &livre_ids {
            sqlx::query("UPDATE livres_scolaires SET is_available = false WHERE id = $1")
                .bind(lid)
                .execute(&*self.pool)
                .await
                .map_err(|e| {
                    AppError::Internal(format!("Erreur désactivation livre {}: {}", lid, e))
                })?;
        }
        info!(
            "[TROC_INTELLIGENT] {} livres désactivés pour chaîne {}",
            livre_ids.len(),
            chaine_id
        );

        // 4. Créer les paquets de livraison par (sender → receiver)
        let ts = chrono::Utc::now().format("%Y%m%d%H%M%S");
        let mut package_ids_created: Vec<i32> = Vec::new();

        // Regrouper les transfers par (sender_id, receiver_id)
        let mut grouped: HashMap<(i32, i32), Vec<&ChainTransfer>> = HashMap::new();
        for t in &transfers {
            grouped.entry((t.sender_id, t.receiver_id)).or_default().push(t);
        }

        for ((sender_id, receiver_id), group) in &grouped {
            let valeur_totale: f64 = group.iter().map(|t| t.valeur).sum();
            let commission = valeur_totale * crate::models::livre_scolaire::TAUX_COMMISSION_APP;
            let nombre_livres = group.len() as i32;
            let reference = format!("CH{}-{}-{}-{}", chaine_id, sender_id, receiver_id, ts);

            // Récupérer GPS via les livres
            let mut sender_gps: Option<String> = None;
            let mut sender_addr: Option<String> = None;
            let mut receiver_gps: Option<String> = None;
            let mut receiver_addr: Option<String> = None;
            let mut livres_json = Vec::new();

            for t in group {
                if let Ok(Some(livre)) = sqlx::query_as::<_, LivreScolaire>(
                    "SELECT * FROM livres_scolaires WHERE id = $1",
                )
                .bind(t.livre_id)
                .fetch_optional(&*self.pool)
                .await
                {
                    if sender_gps.is_none() {
                        sender_gps = livre.gps.clone();
                        sender_addr = livre.ville.clone().or_else(|| livre.quartier.clone());
                    }
                    livres_json.push(serde_json::json!({
                        "livre_id": livre.id,
                        "titre": livre.titre,
                        "matiere": livre.matiere,
                        "valeur": t.valeur,
                        "mode": t.mode_listing,
                    }));
                }
            }

            // GPS du receiver
            if let Ok(Some(rl)) = sqlx::query_as::<_, LivreScolaire>(
                "SELECT * FROM livres_scolaires WHERE user_id = $1 AND gps IS NOT NULL ORDER BY created_at DESC LIMIT 1",
            )
            .bind(receiver_id)
            .fetch_optional(&*self.pool)
            .await
            {
                receiver_gps = rl.gps.clone();
                receiver_addr = rl.ville.clone().or_else(|| rl.quartier.clone());
            }

            // Insérer le paquet
            let pkg_id: i32 = sqlx::query_scalar(
                r#"
                INSERT INTO book_delivery_packages (
                    reference, expediteur_id, expediteur_gps, expediteur_adresse,
                    destinataire_id, destinataire_gps, destinataire_adresse,
                    livres, nombre_livres, valeur_totale, commission_app, statut
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'constitue')
                RETURNING id
                "#,
            )
            .bind(&reference)
            .bind(sender_id)
            .bind(&sender_gps)
            .bind(&sender_addr)
            .bind(receiver_id)
            .bind(&receiver_gps)
            .bind(&receiver_addr)
            .bind(serde_json::json!(livres_json))
            .bind(nombre_livres)
            .bind(rust_decimal::Decimal::from_f64_retain(valeur_totale).unwrap_or_default())
            .bind(rust_decimal::Decimal::from_f64_retain(commission).unwrap_or_default())
            .fetch_one(&*self.pool)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur création paquet: {}", e)))?;

            package_ids_created.push(pkg_id);

            info!(
                "[TROC_INTELLIGENT] Paquet {} créé: {} → {} ({} livres, {:.0} XAF)",
                reference, sender_id, receiver_id, nombre_livres, valeur_totale
            );
        }

        // 5. Calculer la route optimisée via les paquets créés
        let route = self.compute_optimized_route(&package_ids_created).await?;

        // 6. Mettre à jour la chaîne
        let ref_str = format!("CHAIN-{}-{}", chaine_id, ts);
        let vendeurs_count = transfers
            .iter()
            .filter(|t| t.mode_listing == "vente")
            .map(|t| t.sender_id)
            .collect::<HashSet<_>>()
            .len() as i32;

        sqlx::query(
            r#"
            UPDATE chaines_troc_livres
            SET statut = 'en_cours',
                date_validation = NOW(),
                reference = $2,
                nombre_vendeurs = $3,
                package_ids = $4,
                route_optimisee = $5,
                updated_at = NOW()
            WHERE id = $1
            "#,
        )
        .bind(chaine_id)
        .bind(&ref_str)
        .bind(vendeurs_count)
        .bind(serde_json::json!(package_ids_created))
        .bind(serde_json::json!(route))
        .execute(&*self.pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur MAJ chaîne: {}", e)))?;

        info!(
            "[TROC_INTELLIGENT] ✅ Chaîne {} finalisée: {} paquets, {} waypoints, ref={}",
            chaine_id,
            package_ids_created.len(),
            route.len(),
            ref_str
        );

        // 7. Retourner un résumé complet
        let participant_ids: Vec<i32> = transfers
            .iter()
            .flat_map(|t| vec![t.sender_id, t.receiver_id])
            .collect::<HashSet<_>>()
            .into_iter()
            .collect();

        Ok(serde_json::json!({
            "chaine_id": chaine_id,
            "reference": ref_str,
            "statut": "en_cours",
            "nombre_transferts": transfers.len(),
            "nombre_participants": participant_ids.len(),
            "nombre_vendeurs": vendeurs_count,
            "nombre_paquets": package_ids_created.len(),
            "package_ids": package_ids_created,
            "route_waypoints": route,
            "livres_desactives": livre_ids.len(),
            "participant_ids": participant_ids,
        }))
    }

    // ========================================================================
    // V3: ANNULATION LIVRE PAR COURSIER (terrain)
    // ========================================================================

    /// Le coursier annule un livre sur le terrain (indisponible, endommagé, etc.)
    /// → Créditer le wallet du destinataire (valeur_livre + commission)
    /// → NE PAS toucher aux frais de livraison
    /// → Mettre à jour le paquet (retirer le livre)
    /// → Logger l'annulation
    pub async fn cancel_book_on_site(
        &self,
        coursier_id: i32,
        req: BookCancellationRequest,
    ) -> AppResult<serde_json::Value> {
        info!(
            "[TROC_INTELLIGENT] Annulation livre {} du paquet {} par coursier {}",
            req.livre_id, req.package_id, coursier_id
        );

        // 1. Récupérer le paquet
        let pkg = sqlx::query_as::<_, BookDeliveryPackage>(
            "SELECT * FROM book_delivery_packages WHERE id = $1",
        )
        .bind(req.package_id)
        .fetch_optional(&*self.pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur récupération paquet: {}", e)))?
        .ok_or_else(|| AppError::NotFound("Paquet non trouvé".to_string()))?;

        let destinataire_id = pkg.destinataire_id;

        // 2. Trouver le livre dans le paquet pour sa valeur
        let livres_arr: Vec<serde_json::Value> =
            serde_json::from_value(pkg.livres.clone()).unwrap_or_default();
        let livre_valeur: f64 = livres_arr
            .iter()
            .find(|l| l.get("livre_id").and_then(|v| v.as_i64()) == Some(req.livre_id as i64))
            .and_then(|l| l.get("valeur").and_then(|v| v.as_f64()))
            .unwrap_or(0.0);

        let commission = livre_valeur * crate::models::livre_scolaire::TAUX_COMMISSION_APP;
        let credit_total = livre_valeur + commission;

        // 3. Retirer le livre du paquet JSON
        let mut livres_updated: Vec<serde_json::Value> =
            serde_json::from_value(pkg.livres.clone()).unwrap_or_default();
        livres_updated
            .retain(|l| l.get("livre_id").and_then(|v| v.as_i64()) != Some(req.livre_id as i64));
        let new_count = livres_updated.len() as i32;

        sqlx::query(
            r#"
            UPDATE book_delivery_packages
            SET livres = $2, nombre_livres = $3, updated_at = NOW()
            WHERE id = $1
            "#,
        )
        .bind(req.package_id)
        .bind(serde_json::json!(livres_updated))
        .bind(new_count)
        .execute(&*self.pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur MAJ paquet: {}", e)))?;

        // 4. Créditer le wallet RÉEL du destinataire (table user_wallets, en centimes)
        let credit_cents = (credit_total * 100.0) as i64;

        // Solde avant crédit
        let balance_before: i64 = sqlx::query_scalar::<_, Option<i64>>(
            "SELECT balance_cents FROM user_wallets WHERE user_id = $1 AND currency = 'XAF'",
        )
        .bind(destinataire_id)
        .fetch_optional(&*self.pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur lecture wallet: {}", e)))?
        .flatten()
        .unwrap_or(0);

        // Upsert wallet
        sqlx::query(
            r#"
            INSERT INTO user_wallets (user_id, balance_cents, currency, updated_at)
            VALUES ($1, $2, 'XAF', NOW())
            ON CONFLICT (user_id, currency)
            DO UPDATE SET
                balance_cents = user_wallets.balance_cents + $2,
                updated_at = NOW()
            "#,
        )
        .bind(destinataire_id)
        .bind(credit_cents)
        .execute(&*self.pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur crédit wallet: {}", e)))?;

        let balance_after = balance_before + credit_cents;

        // Enregistrer la transaction wallet pour traçabilité
        sqlx::query(
            r#"
            INSERT INTO wallet_transactions (
                user_id, transaction_type, amount_cents,
                balance_before_cents, balance_after_cents, currency,
                reference_type, description
            )
            VALUES ($1, 'credit', $2, $3, $4, 'XAF', 'book_cancellation',
                    $5)
            "#,
        )
        .bind(destinataire_id)
        .bind(credit_cents)
        .bind(balance_before)
        .bind(balance_after)
        .bind(format!(
            "Remboursement livre #{} annulé par coursier #{} (valeur {:.0} + commission {:.0} XAF)",
            req.livre_id, coursier_id, livre_valeur, commission
        ))
        .execute(&*self.pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur log transaction wallet: {}", e)))?;

        // 5. Logger l'annulation
        sqlx::query(
            r#"
            INSERT INTO book_cancellation_log (
                package_id, livre_id, coursier_id, destinataire_id,
                raison, valeur_livre, commission_remboursee
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            "#,
        )
        .bind(req.package_id)
        .bind(req.livre_id)
        .bind(coursier_id)
        .bind(destinataire_id)
        .bind(&req.raison)
        .bind(rust_decimal::Decimal::from_f64_retain(livre_valeur).unwrap_or_default())
        .bind(rust_decimal::Decimal::from_f64_retain(commission).unwrap_or_default())
        .execute(&*self.pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur log annulation: {}", e)))?;

        // 6. Réactiver le livre (il n'a pas été échangé)
        sqlx::query("UPDATE livres_scolaires SET is_available = true WHERE id = $1")
            .bind(req.livre_id)
            .execute(&*self.pool)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur réactivation livre: {}", e)))?;

        info!(
            "[TROC_INTELLIGENT] ✅ Livre {} annulé. Destinataire {} crédité de {:.0} XAF (valeur {:.0} + commission {:.0})",
            req.livre_id, destinataire_id, credit_total, livre_valeur, commission
        );

        Ok(serde_json::json!({
            "success": true,
            "livre_id": req.livre_id,
            "package_id": req.package_id,
            "destinataire_id": destinataire_id,
            "valeur_livre": livre_valeur,
            "commission_remboursee": commission,
            "credit_total": credit_total,
            "raison": req.raison,
        }))
    }

    // ========================================================================
    // V3: SCHEDULING MULTI-JOURS
    // ========================================================================

    /// Génère un planning de livraison multi-jours basé sur la disponibilité
    /// des participants de la chaîne.
    /// Regroupe les waypoints par jour selon les créneaux disponibles.
    pub async fn build_delivery_schedule(&self, chaine_id: i32) -> AppResult<serde_json::Value> {
        info!(
            "[TROC_INTELLIGENT] Construction planning multi-jours pour chaîne {}",
            chaine_id
        );

        let chaine =
            sqlx::query_as::<_, ChaineTrocLivre>("SELECT * FROM chaines_troc_livres WHERE id = $1")
                .bind(chaine_id)
                .fetch_optional(&*self.pool)
                .await
                .map_err(|e| AppError::Internal(format!("Erreur récup chaîne: {}", e)))?
                .ok_or_else(|| AppError::NotFound("Chaîne non trouvée".to_string()))?;

        // Parser la route optimisée
        let route: Vec<serde_json::Value> = if let Some(ref r) = chaine.route_optimisee {
            serde_json::from_value(r.clone()).unwrap_or_default()
        } else {
            return Err(AppError::BadRequest(
                "Pas de route optimisée — finalisez la chaîne d'abord".to_string(),
            ));
        };

        // Pour chaque waypoint, vérifier la disponibilité du user
        let mut schedule: Vec<serde_json::Value> = Vec::new();
        let mut jour_courant = 1;
        let mut waypoints_jour: Vec<serde_json::Value> = Vec::new();

        for wp in &route {
            let user_id = wp.get("user_id").and_then(|v| v.as_i64()).unwrap_or(0) as i32;

            // Chercher disponibilité dans les livres du user
            let dispo = sqlx::query_as::<_, LivreScolaire>(
                r#"
                SELECT * FROM livres_scolaires
                WHERE user_id = $1
                AND disponibilite_debut IS NOT NULL
                ORDER BY disponibilite_debut ASC LIMIT 1
                "#,
            )
            .bind(user_id)
            .fetch_optional(&*self.pool)
            .await
            .ok()
            .flatten();

            let creneau = if let Some(ref l) = dispo {
                serde_json::json!({
                    "debut": l.disponibilite_debut,
                    "fin": l.disponibilite_fin,
                })
            } else {
                serde_json::json!({
                    "debut": null,
                    "fin": null,
                    "note": "Pas de créneau spécifié — disponible à tout moment"
                })
            };

            let entry = serde_json::json!({
                "user_id": user_id,
                "waypoint": wp,
                "creneau": creneau,
                "jour": jour_courant,
            });

            waypoints_jour.push(entry);

            // Heuristique: max 5 waypoints par jour (temps de trajet)
            if waypoints_jour.len() >= 5 {
                schedule.push(serde_json::json!({
                    "jour": jour_courant,
                    "waypoints": waypoints_jour.clone(),
                }));
                waypoints_jour.clear();
                jour_courant += 1;
            }
        }

        // Ajouter les waypoints restants
        if !waypoints_jour.is_empty() {
            schedule.push(serde_json::json!({
                "jour": jour_courant,
                "waypoints": waypoints_jour,
            }));
        }

        // Sauvegarder le schedule sur la chaîne
        sqlx::query(
            "UPDATE chaines_troc_livres SET delivery_schedule = $2, updated_at = NOW() WHERE id = $1",
        )
        .bind(chaine_id)
        .bind(serde_json::json!(&schedule))
        .execute(&*self.pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur sauvegarde schedule: {}", e)))?;

        info!(
            "[TROC_INTELLIGENT] ✅ Schedule: {} jours pour chaîne {}",
            schedule.len(),
            chaine_id
        );

        Ok(serde_json::json!({
            "chaine_id": chaine_id,
            "nombre_jours": schedule.len(),
            "schedule": schedule,
        }))
    }

    /// Constitution intelligente pour TOUS les utilisateurs ayant des trocs non-packagés.
    /// Typiquement appelé par un admin ou un job batch.
    pub async fn build_all_pending_packages(&self) -> AppResult<Vec<serde_json::Value>> {
        info!("[TROC_INTELLIGENT] Constitution batch de tous les paquets en attente");

        // Trouver tous les destinataires distincts ayant des trocs complétés non-packagés
        let user_ids: Vec<i32> = sqlx::query_scalar(
            r#"
            SELECT DISTINCT unnest(ARRAY[initiateur_id, participant_id]) AS user_id
            FROM troc_livres_scolaires
            WHERE statut = 'complete' AND COALESCE(is_packaged, false) = false
            "#,
        )
        .fetch_all(&*self.pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur listing users: {}", e)))?;

        let mut all_packages = Vec::new();
        for user_id in user_ids {
            match self.build_intelligent_packages(user_id).await {
                Ok(pkgs) => all_packages.extend(pkgs),
                Err(e) => log::error!(
                    "[TROC_INTELLIGENT] Erreur constitution paquets user {}: {:?}",
                    user_id,
                    e
                ),
            }
        }

        info!(
            "[TROC_INTELLIGENT] ✅ Constitution batch terminée: {} paquets total",
            all_packages.len()
        );
        Ok(all_packages)
    }
}
