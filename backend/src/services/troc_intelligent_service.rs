// ✅ NOUVEAU: Service pour troc intelligent de livres scolaires

use crate::core::types::{AppError, AppResult};
use crate::models::livre_scolaire::{BookDeliveryPackage, LivreScolaire};
use crate::models::livre_scolaire_demande::LivreScolaireDemande;
use crate::models::troc_livre::{
    BookCancellationRequest, ChainTransfer, ChaineTrocLivre, CreateTrocChaineRequest,
    CreateTrocDirectRequest, MatchingChaine, MatchingDirect, ParticipantChaine, TrocLivre,
};
use crate::utils::classe_normalization::{canonical, classe_match_variants};
use log::{self, info};
#[allow(unused_imports)]
use sqlx::{PgPool, Row};
use std::collections::{HashMap, HashSet};
use std::sync::Arc;

/// Rayon géographique maximal d'une chaîne de troc (en km).
/// Au-delà de cette distance, une arête est rejetée pour éviter
/// les chaînes inter-villes impraticables pour un seul coursier.
const MAX_CHAIN_RADIUS_KM: f64 = 30.0;

/// Distance maximale entre deux nœuds consécutifs (arête) dans une chaîne.
const MAX_EDGE_DISTANCE_KM: f64 = 20.0;

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

        // ✅ FIX 2026-05-16 — Matching tolérant aux variantes de libellés :
        // "6e" / "6ème" / "Sixième" / "6E " étaient 4 valeurs distinctes en
        // base. On compare désormais sur les variantes pré-calculées par
        // `classe_match_variants` + ANY(...). Pour la matière, on lowercase
        // les deux côtés via `canonical()`.
        let classe_act_variants = classe_match_variants(&livre_offert.classe_souhaitee);
        let classe_souh_variants = classe_match_variants(&livre_offert.classe_actuelle);
        let matiere_canon = canonical(&livre_offert.matiere);
        let livres_candidates = sqlx::query_as::<_, LivreScolaire>(
            r#"
            SELECT * FROM livres_scolaires
            WHERE is_active = true
            AND is_available = true
            AND id != $1
            AND user_id != $2
            AND classe_actuelle = ANY($3)
            AND classe_souhaitee = ANY($4)
            AND LOWER(BTRIM(matiere)) = $5
            AND COALESCE(etat_classification, 'acceptable') != 'rejete'
            AND COALESCE(mode_listing, 'troc') IN ('troc', 'vente')
            ORDER BY created_at DESC
            LIMIT 50
            "#,
        )
        .bind(livre_offert_id)
        .bind(initiateur_id)
        .bind(&classe_act_variants)
        .bind(&classe_souh_variants)
        .bind(&matiere_canon)
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
    //      - Le matching s'adapte à TOUTES les classes/matières de chaque utilisateur
    //   2. Anti-réciprocité: si on ajoute A→B, jamais B→A dans la même chaîne
    //   3. Vendeurs optionnels: si présents, ils sont nœuds source (donnent, ne reçoivent rien)
    //      La chaîne fonctionne aussi sans aucun vendeur.
    //   4. Taille dynamique (max 10 par défaut), optimisée par proximité GPS
    //   5. Multi-chaîne: un user peut participer à plusieurs chaînes MAIS il ne peut
    //      être non-source (receiver-only = pas au point de départ) dans AU PLUS 1 chaîne
    //      active. Cela évite les allers-retours coursier au même domicile.
    //   6. Coursier unique par participant: un seul coursier assure toutes les livraisons
    //      d'un participant sur l'ensemble de ses chaînes.
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

        let max_nodes = max_participants.unwrap_or(10) as usize;

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

        // ✅ 2026-05-16 — Charger les demandes d'achat d'occasion actives.
        // Les acheteurs sont représentés ici comme nœuds-sinks potentiels du
        // DAG : un sender (vente ou trocer) peut leur livrer un livre
        // contre cash. L'acheteur n'a pas de livre offert et ne peut donc
        // jamais être sender, juste receiver final de la chaîne.
        // ⚠️ Doit être chargé AVANT la construction de `livres_par_user`
        // (qui prend des références) pour éviter une réallocation du Vec.
        let demandes_ouvertes = sqlx::query_as::<_, LivreScolaireDemande>(
            r#"
            SELECT * FROM livres_scolaires_demandes
            WHERE is_active = true
              AND is_satisfied = false
              AND matched_chaine_id IS NULL
              AND expires_at > NOW()
              AND user_id != $1
            ORDER BY created_at ASC
            LIMIT 500
            "#,
        )
        .bind(initiateur_id)
        .fetch_all(&*self.pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur récupération demandes: {}", e)))?;
        info!(
            "[TROC_INTELLIGENT] {} demande(s) d'achat actives chargées comme sinks potentiels",
            demandes_ouvertes.len()
        );

        // Tous les livres = initiateur + autres + demandes synthétiques (sinks)
        let mut tous_livres = initiateur_livres.clone();
        tous_livres.extend(all_livres);
        // Conversion des demandes en `LivreScolaire` synthétiques (id négatif,
        // classe_actuelle vide, mode_listing='demande'). Elles s'agrègent
        // naturellement dans `bundles_par_user` ci-dessous et sont exclues
        // comme senders par le filtre `sender_classe.is_empty()` dans la
        // boucle de génération d'arêtes — donc elles ne peuvent être que
        // receivers (= bouts de chaîne).
        for d in &demandes_ouvertes {
            tous_livres.push(d.into_synthetic_livre());
        }

        // Index par user_id pour accès rapide (construit APRÈS l'injection
        // des demandes pour éviter d'invalider les références)
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
            #[allow(dead_code)]
            matieres_bundle: Vec<String>, // ✅ MULTI-MATIÈRE : toutes les matières du lot
        }

        // Structure pour représenter un lot de matières (multi-matière)
        struct Bundle<'a> {
            livres: Vec<&'a LivreScolaire>,
            matieres: HashSet<String>,
            classe_actuelle: String,
            classe_souhaitee: String,
            #[allow(dead_code)]
            user_id: i32,
        }

        impl<'a> Bundle<'a> {
            fn new(livres: Vec<&'a LivreScolaire>) -> Option<Self> {
                if livres.is_empty() {
                    return None;
                }

                let user_id = livres[0].user_id;
                let classe_actuelle = livres[0].classe_actuelle.clone();
                let classe_souhaitee = livres[0].classe_souhaitee.clone();

                // ✅ FIX 2026-05-16 — Comparer sur forme canonique pour tolérer
                // les variantes "6e"/"6ème"/"Sixième" dans le même bundle.
                let classe_canon_ref = canonical(&classe_actuelle);
                if !livres
                    .iter()
                    .all(|l| l.user_id == user_id && canonical(&l.classe_actuelle) == classe_canon_ref)
                {
                    return None;
                }

                // Stocker les matières sous forme canonique : évite que
                // "Mathématiques" et "mathematiques" soient considérées comme
                // 2 matières distinctes.
                let matieres: HashSet<String> =
                    livres.iter().map(|l| canonical(&l.matiere)).collect();

                Some(Bundle {
                    livres,
                    matieres,
                    classe_actuelle,
                    classe_souhaitee,
                    user_id,
                })
            }

            fn contient_matiere(&self, matiere: &str) -> bool {
                // Compare sur forme canonique (cf. construction du HashSet ci-dessus).
                self.matieres.contains(&canonical(matiere))
            }
        }

        let mut edges: Vec<PotentialEdge> = Vec::new();

        // ✅ MULTI-MATIÈRE : Regrouper les livres par utilisateur et classe en bundles.
        // Clé = (user_id, canonical(classe_actuelle)) pour fusionner les livres
        // saisis avec des variantes différentes du même libellé de classe.
        let mut bundles_par_user: HashMap<(i32, String), Bundle> = HashMap::new();
        for l in &tous_livres {
            let key = (l.user_id, canonical(&l.classe_actuelle));
            match bundles_par_user.entry(key) {
                std::collections::hash_map::Entry::Occupied(mut e) => {
                    e.get_mut().livres.push(l);
                }
                std::collections::hash_map::Entry::Vacant(e) => {
                    e.insert(Bundle::new(vec![l]).unwrap());
                }
            }
        }

        // Finaliser les bundles (matières sous forme canonique)
        for bundle in bundles_par_user.values_mut() {
            bundle.matieres = bundle
                .livres
                .iter()
                .map(|l| canonical(&l.matiere))
                .collect();
        }

        // Pour chaque paire (sender_bundle, receiver_bundle), vérifier le matching multi-matières
        // Le matching existe si : sender.classe_actuelle == receiver.classe_souhaitee
        // ET sender.bundle contient AU MOINS UNE matière que receiver.bundle demande
        for (sender_key, sender_bundle) in &bundles_par_user {
            let (sender_id, _) = sender_key;
            for (receiver_key, receiver_bundle) in &bundles_par_user {
                let (receiver_id, _) = receiver_key;
                if sender_id == receiver_id {
                    continue;
                }

                // ✅ FIX 2026-05-16 — Comparaison sur forme canonique (lower
                // + trim + accents) pour ne pas rater "6e" vs "Sixième" etc.
                let sender_classe = canonical(&sender_bundle.classe_actuelle);
                let receiver_souh = canonical(&receiver_bundle.classe_souhaitee);
                // ✅ Bundles "demande" (acheteurs sans livre offert) :
                //   - classe_actuelle = "" → ne peuvent PAS être senders
                //   - classe_souhaitee renseignée → PEUVENT être receivers
                // Bundles "vente" purs (vendeurs cash, pas d'échange souhaité) :
                //   - classe_souhaitee = "" → ne peuvent PAS être receivers
                //   - classe_actuelle renseignée → PEUVENT être senders
                if sender_classe.is_empty()
                    || receiver_souh.is_empty()
                    || sender_classe != receiver_souh
                {
                    continue;
                }

                // ✅ MULTI-MATIÈRE : Le receiver a-t-il besoin d'AU MOINS UNE matière du sender ?
                // Comparaison canonique aussi sur la matière.
                let sender_matieres_canon: HashSet<String> = sender_bundle
                    .matieres
                    .iter()
                    .map(|m| canonical(m))
                    .collect();
                let matiere_match = receiver_bundle
                    .livres
                    .iter()
                    .any(|rl| sender_matieres_canon.contains(&canonical(&rl.matiere)));

                if !matiere_match {
                    continue;
                }

                // Trouver la meilleure paire de livres pour le calcul GPS
                // (comparaison canonique de la matière).
                let (best_sender_livre, best_receiver_livre) = {
                    let mut best_pair = (&sender_bundle.livres[0], &receiver_bundle.livres[0]);
                    for sl in &sender_bundle.livres {
                        for rl in &receiver_bundle.livres {
                            if canonical(&sl.matiere) == canonical(&rl.matiere) {
                                best_pair = (sl, rl);
                                break;
                            }
                        }
                    }
                    best_pair
                };

                let dist = Self::compute_distance_between(best_sender_livre, best_receiver_livre);

                // ✅ Contrainte géographique DURE: rejeter les arêtes trop longues
                if dist > MAX_EDGE_DISTANCE_KM {
                    continue;
                }

                edges.push(PotentialEdge {
                    sender_id: *sender_id,
                    receiver_id: *receiver_id,
                    livre: (*best_sender_livre).clone(),
                    distance_km: dist,
                    matieres_bundle: sender_bundle.matieres.iter().cloned().collect(),
                });
            }
        }

        // ✅ 2026-05-16 — Edges sender → demande (acheteur d'occasion).
        // Pour chaque bundle vendeur SB et chaque demande D : on crée une arête
        // si SB a un livre dans la classe et matière demandées par D. Le buyer
        // (D.user_id) devient ainsi un sink possible de la chaîne.
        for demande in &demandes_ouvertes {
            let demande_classe_canon = canonical(&demande.classe_souhaitee);
            let demande_matiere_canon = canonical(&demande.matiere);
            if demande_classe_canon.is_empty() || demande_matiere_canon.is_empty() {
                continue;
            }
            for (sender_key, sender_bundle) in &bundles_par_user {
                let (sender_id, _) = sender_key;
                if *sender_id == demande.user_id {
                    continue;
                }
                if canonical(&sender_bundle.classe_actuelle) != demande_classe_canon {
                    continue;
                }
                if !sender_bundle.contient_matiere(&demande.matiere) {
                    continue;
                }
                let best_book = sender_bundle
                    .livres
                    .iter()
                    .find(|l| canonical(&l.matiere) == demande_matiere_canon)
                    .copied()
                    .unwrap_or(sender_bundle.livres[0]);
                let sender_gps = Self::parse_gps(&best_book.gps);
                let demande_gps = Self::parse_gps(&demande.gps);
                let dist = match (sender_gps, demande_gps) {
                    (Some(a), Some(b)) => Self::haversine_distance(a.0, a.1, b.0, b.1),
                    _ => 0.0,
                };
                if dist > MAX_EDGE_DISTANCE_KM {
                    continue;
                }
                edges.push(PotentialEdge {
                    sender_id: *sender_id,
                    receiver_id: demande.user_id,
                    livre: (*best_book).clone(),
                    distance_km: dist,
                    matieres_bundle: vec![demande_matiere_canon.clone()],
                });
            }
        }

        // Tri des arêtes :
        //   1. Les livres d'OCCASION (mode_listing='vente') passent en PREMIER
        //      → ils ancrent le début de la chaîne car ils sont tangibles et
        //        immédiatement disponibles (pas dépendants d'une cascade troc).
        //   2. À mode égal, les arêtes les plus proches géographiquement.
        //
        // Conséquence : la construction greedy du DAG positionne les vendeurs
        // d'occasion comme sources de la chaîne, et les pures-troc ensuite.
        edges.sort_by(|a, b| {
            let a_is_vente = a.livre.mode_listing.as_deref() == Some("vente");
            let b_is_vente = b.livre.mode_listing.as_deref() == Some("vente");
            // true (vente) avant false (troc) → reverse cmp sur bool
            b_is_vente.cmp(&a_is_vente).then_with(|| {
                a.distance_km.partial_cmp(&b.distance_km).unwrap_or(std::cmp::Ordering::Equal)
            })
        });

        info!(
            "[TROC_INTELLIGENT] {} arêtes potentielles après filtre géo (max {:.0} km/arête), {} users",
            edges.len(),
            MAX_EDGE_DISTANCE_KM,
            livres_par_user.len()
        );

        // Pré-calculer le GPS de l'initiateur (centroïde initial de la chaîne)
        let initiateur_gps = Self::parse_gps(&livre_offert.gps);

        // Index GPS par user_id pour les contraintes de rayon
        let mut user_gps_cache: HashMap<i32, Option<(f64, f64)>> = HashMap::new();
        for l in &tous_livres {
            user_gps_cache.entry(l.user_id).or_insert_with(|| Self::parse_gps(&l.gps));
        }
        // ✅ 2026-05-16 — Ajouter les acheteurs (demandes) au cache GPS pour
        // que la contrainte de rayon MAX_CHAIN_RADIUS_KM s'applique aussi à eux.
        for d in &demandes_ouvertes {
            user_gps_cache
                .entry(d.user_id)
                .or_insert_with(|| Self::parse_gps(&d.gps));
        }
        if let Some(gps) = initiateur_gps {
            user_gps_cache.insert(initiateur_id, Some(gps));
        }

        // ---------------------------------------------------------------
        // Contrainte multi-chaîne: identifier les users déjà "non-source"
        // (receiver-only = pas au point de départ) dans une chaîne active.
        // Règle stricte: un user ne peut être non-source dans AU PLUS 1 chaîne.
        // ---------------------------------------------------------------
        let users_already_non_source = self.get_users_non_source_in_active_chains().await?;
        info!(
            "[TROC_INTELLIGENT] {} users déjà non-source dans une chaîne active",
            users_already_non_source.len()
        );

        // ---------------------------------------------------------------
        // Greedy DAG construction: ajouter les arêtes une par une
        // en respectant:
        //   - Anti-réciprocité: si A→B, pas B→A
        //   - Max nodes
        //   - Pas de self-loop
        //   - Un livre ne peut être transféré qu'une seule fois
        //   - Multi-chaîne: un user déjà non-source ailleurs ne peut pas
        //     être non-source (receiver-only) dans cette chaîne aussi
        //   - ✅ Contrainte rayon: tout nœud doit être à ≤ MAX_CHAIN_RADIUS_KM
        //     de l'initiateur (ancrage géographique)
        // ---------------------------------------------------------------
        let mut dag_edges: Vec<&PotentialEdge> = Vec::new();
        let mut directed_pairs: HashSet<(i32, i32)> = HashSet::new(); // (sender, receiver) existants
        let mut used_livre_ids: HashSet<i32> = HashSet::new();
        let mut chain_users: HashSet<i32> = HashSet::new();
        let mut senders_in_chain: HashSet<i32> = HashSet::new(); // Users qui envoient dans cette chaîne

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

            // ✅ Contrainte rayon géographique: tout nouveau nœud doit être
            // à ≤ MAX_CHAIN_RADIUS_KM de l'initiateur (ancrage).
            // Cela garantit que toute la chaîne reste dans une zone livrable par un seul coursier.
            if let Some(init_gps) = initiateur_gps {
                for &uid in &[edge.sender_id, edge.receiver_id] {
                    if !chain_users.contains(&uid) {
                        if let Some(Some((ulat, ulng))) = user_gps_cache.get(&uid) {
                            let d = Self::haversine_distance(init_gps.0, init_gps.1, *ulat, *ulng);
                            if d > MAX_CHAIN_RADIUS_KM {
                                info!(
                                    "[TROC_INTELLIGENT] Skip arête {}->{}: user {} à {:.1} km > rayon max {:.0} km",
                                    edge.sender_id, edge.receiver_id, uid, d, MAX_CHAIN_RADIUS_KM
                                );
                                continue; // Note: ce continue sort du for, pas du for externe
                            }
                        }
                    }
                }
                // Revérifier: si un des users a été rejeté par le rayon, skip l'arête
                let radius_ok = [edge.sender_id, edge.receiver_id].iter().all(|&uid| {
                    if chain_users.contains(&uid) {
                        return true; // Déjà dans la chaîne
                    }
                    match user_gps_cache.get(&uid) {
                        Some(Some((ulat, ulng))) => {
                            Self::haversine_distance(init_gps.0, init_gps.1, *ulat, *ulng)
                                <= MAX_CHAIN_RADIUS_KM
                        }
                        _ => true, // Pas de GPS → on accepte (distance par défaut 999 filtrée par MAX_EDGE_DISTANCE_KM)
                    }
                });
                if !radius_ok {
                    continue;
                }
            }

            // Contrainte multi-chaîne: si le receiver est déjà non-source dans
            // une autre chaîne active ET n'est pas déjà sender dans cette chaîne,
            // on ne peut pas le rendre non-source ici aussi (règle stricte: max 1).
            if users_already_non_source.contains(&edge.receiver_id)
                && !senders_in_chain.contains(&edge.receiver_id)
            {
                info!(
                    "[TROC_INTELLIGENT] Skip arête {}->{}: user {} déjà non-source dans une autre chaîne",
                    edge.sender_id, edge.receiver_id, edge.receiver_id
                );
                continue;
            }

            // Ajouter l'arête
            directed_pairs.insert((edge.sender_id, edge.receiver_id));
            used_livre_ids.insert(edge.livre.id);
            chain_users.insert(edge.sender_id);
            chain_users.insert(edge.receiver_id);
            senders_in_chain.insert(edge.sender_id);
            dag_edges.push(edge);
        }

        // ---------------------------------------------------------------
        // ✅ OPTIMISATION: Élaguer le DAG pour ne garder que le sous-graphe
        // minimal qui satisfait le besoin de l'initiateur.
        // On fait un parcours inverse (BFS) depuis les nœuds qui reçoivent
        // le livre demandé par l'initiateur, et on ne garde que les arêtes
        // sur les chemins utiles. Cela minimise le nombre de nœuds.
        // ---------------------------------------------------------------
        if dag_edges.len() > 2 {
            // Trouver les nœuds "terminaux utiles": ceux qui envoient un livre
            // correspondant au besoin de l'initiateur (classe_souhaitee de l'initiateur)
            let _initiateur_besoins: HashSet<(String, String)> =
                if let Some(init_livres) = livres_par_user.get(&initiateur_id) {
                    init_livres
                        .iter()
                        .filter(|l| !l.classe_souhaitee.is_empty())
                        .map(|l| (l.classe_souhaitee.clone(), l.matiere.clone()))
                        .collect()
                } else {
                    HashSet::new()
                };

            // BFS inverse: partir des arêtes qui envoient à l'initiateur,
            // puis remonter les dépendances
            let mut essential_edges: HashSet<usize> = HashSet::new();
            let mut needed_users: HashSet<i32> = HashSet::new();
            needed_users.insert(initiateur_id);

            // D'abord marquer les arêtes qui livrent directement à l'initiateur
            for (i, edge) in dag_edges.iter().enumerate() {
                if edge.receiver_id == initiateur_id {
                    essential_edges.insert(i);
                    needed_users.insert(edge.sender_id);
                }
            }

            // Ensuite, remonter: pour chaque sender nécessaire qui reçoit aussi
            // un livre (il a besoin d'un livre pour participer au troc),
            // marquer les arêtes qui lui envoient un livre
            let mut changed = true;
            while changed {
                changed = false;
                for (i, edge) in dag_edges.iter().enumerate() {
                    if !essential_edges.contains(&i) && needed_users.contains(&edge.receiver_id) {
                        essential_edges.insert(i);
                        if needed_users.insert(edge.sender_id) {
                            changed = true;
                        }
                    }
                }
            }

            // Si l'élagage réduit le nombre d'arêtes, utiliser le sous-graphe minimal
            if essential_edges.len() >= 2 && essential_edges.len() < dag_edges.len() {
                let pruned_count = dag_edges.len() - essential_edges.len();
                dag_edges = dag_edges
                    .into_iter()
                    .enumerate()
                    .filter(|(i, _)| essential_edges.contains(i))
                    .map(|(_, e)| e)
                    .collect();
                // Recalculer chain_users
                chain_users.clear();
                chain_users.insert(initiateur_id);
                for edge in &dag_edges {
                    chain_users.insert(edge.sender_id);
                    chain_users.insert(edge.receiver_id);
                }
                info!(
                    "[TROC_INTELLIGENT] ✅ Élagage: {} arêtes supprimées, {} nœuds restants (minimum)",
                    pruned_count, chain_users.len()
                );
            }
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

        // ✅ 2026-05-16 — Map user_id → demande_id pour les acheteurs sinks.
        // Si un user reçoit dans la chaîne sans jamais envoyer (= buyer), on
        // encode l'identifiant de sa demande dans `livre_offert_id` (négatif)
        // pour que validate_chaine_troc puisse le retrouver.
        let demande_for_user: HashMap<i32, i32> = demandes_ouvertes
            .iter()
            .map(|d| (d.user_id, d.id))
            .collect();

        // Re-numéroter
        let participant_chaines: Vec<ParticipantChaine> = participants
            .iter()
            .enumerate()
            .map(|(i, (uid, _))| {
                // Trouver le premier livre offert par cet utilisateur dans les transfers
                let livre_offert_id = transfers
                    .iter()
                    .find(|t| t.sender_id == *uid)
                    .map(|t| t.livre_id)
                    .unwrap_or_else(|| {
                        // Cet utilisateur n'envoie rien : c'est un buyer/sink.
                        // S'il a une demande active, on encode -demande_id.
                        demande_for_user.get(uid).map(|d_id| -*d_id).unwrap_or(0)
                    });
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

    /// Identifier les users déjà "non-source" (receiver-only, pas au point de départ)
    /// dans une chaîne active. Un user ne peut être non-source dans AU PLUS 1 chaîne.
    /// Retourne un HashSet des user_ids qui sont DÉJÀ non-source dans au moins 1 chaîne active.
    #[allow(dead_code)]
    async fn get_users_non_source_in_active_chains(&self) -> AppResult<HashSet<i32>> {
        let chains = sqlx::query_as::<_, ChaineTrocLivre>(
            "SELECT * FROM chaines_troc_livres WHERE statut IN ('en_formation', 'validee', 'en_cours')",
        )
        .fetch_all(&*self.pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur lecture chaînes actives: {}", e)))?;

        let mut non_source_users: HashSet<i32> = HashSet::new();

        for chain in &chains {
            if let Some(ref transfers_json) = chain.transfers {
                let transfers: Vec<ChainTransfer> =
                    serde_json::from_value(transfers_json.clone()).unwrap_or_default();
                let senders: HashSet<i32> = transfers.iter().map(|t| t.sender_id).collect();
                let receivers: HashSet<i32> = transfers.iter().map(|t| t.receiver_id).collect();

                // Non-source = users qui reçoivent mais n'envoient rien dans cette chaîne
                for &r in &receivers {
                    if !senders.contains(&r) {
                        non_source_users.insert(r);
                    }
                }
            }
        }

        Ok(non_source_users)
    }

    /// Identifier le coursier assigné à un user dans ses chaînes actives.
    /// Retourne un HashMap user_id → coursier_id (si un coursier a déjà été assigné).
    #[allow(dead_code)]
    async fn get_assigned_couriers_for_users(&self) -> AppResult<HashMap<i32, i32>> {
        // Chercher dans les paquets de livraison actifs quel coursier est assigné à quel user
        let rows = sqlx::query(
            r#"
            SELECT DISTINCT destinataire_id, coursier_id
            FROM book_delivery_packages
            WHERE coursier_id IS NOT NULL
            AND statut IN ('constitue', 'en_route', 'a_constituer')
            "#,
        )
        .fetch_all(&*self.pool)
        .await
        .unwrap_or_default();

        let mut map: HashMap<i32, i32> = HashMap::new();
        for row in &rows {
            let dest_id: i32 = Row::get(row, "destinataire_id");
            let cour_id: i32 = Row::get(row, "coursier_id");
            map.insert(dest_id, cour_id);
        }
        Ok(map)
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

        if livre_souhaite.user_id == initiateur_id {
            return Err(AppError::BadRequest(
                "Vous ne pouvez pas troquer un livre avec vous-même".to_string(),
            ));
        }

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

        // Calculer la distance totale et le score de proximité.
        // ✅ FIX 2026-05-16 — La chaîne est un DAG linéaire (cf. commentaire
        // validate_chaine_troc:1008 "pas d'anneau"), donc on calcule la
        // distance sur n-1 segments (i → i+1), pas n segments avec un
        // segment de fermeture fantôme (i → (i+1) % n). Le bug précédent
        // surestimait la distance d'un segment, faussant le score de
        // proximité et le ranking des chaînes.
        let mut distance_totale_km = 0.0;
        let mut scores_proximite = Vec::new();

        // Helper local : récupère le GPS d'un participant, qu'il soit un vrai
        // livre (id ≥ 0) ou une demande synthétique (id < 0).
        async fn resolve_participant_gps(
            pool: &PgPool,
            livre_offert_id: i32,
        ) -> AppResult<Option<String>> {
            if livre_offert_id >= 0 {
                let row: Option<(Option<String>,)> =
                    sqlx::query_as("SELECT gps FROM livres_scolaires WHERE id = $1")
                        .bind(livre_offert_id)
                        .fetch_optional(pool)
                        .await
                        .map_err(|e| AppError::Internal(format!("Erreur GPS livre: {}", e)))?;
                Ok(row.and_then(|r| r.0))
            } else {
                let demande_id = -livre_offert_id;
                let row: Option<(Option<String>,)> = sqlx::query_as(
                    "SELECT gps FROM livres_scolaires_demandes WHERE id = $1",
                )
                .bind(demande_id)
                .fetch_optional(pool)
                .await
                .map_err(|e| AppError::Internal(format!("Erreur GPS demande: {}", e)))?;
                Ok(row.and_then(|r| r.0))
            }
        }

        for i in 0..request.participants.len().saturating_sub(1) {
            let participant = &request.participants[i];
            let participant_suivant = &request.participants[i + 1];

            let gps1 = resolve_participant_gps(&self.pool, participant.livre_offert_id).await?;
            let gps2 =
                resolve_participant_gps(&self.pool, participant_suivant.livre_offert_id).await?;

            if let (Some((lat1, lon1)), Some((lat2, lon2))) =
                (Self::parse_gps(&gps1), Self::parse_gps(&gps2))
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

    /// Valider une chaîne de troc (V3 DAG-compatible)
    /// Les participants sont ordonnés: chaque participant[i] envoie à participant[i+1] (pas de cycle).
    /// Le dernier participant n'a PAS de suivant — c'est un DAG, pas un anneau.
    pub async fn validate_chaine_troc(&self, participants: &[ParticipantChaine]) -> AppResult<()> {
        if participants.len() < 2 {
            return Err(AppError::BadRequest(
                "Une chaîne de troc doit avoir au moins 2 participants".to_string(),
            ));
        }

        // ✅ 2026-05-16 — Convention pour les acheteurs/demandes :
        // un `livre_offert_id` NÉGATIF signifie « cette entrée est une demande
        // d'achat (livres_scolaires_demandes.id = -livre_offert_id) », pas un
        // vrai livre offert. Les demandes ne peuvent occuper QUE la dernière
        // position de la chaîne (= sink / buyer terminal).
        for (idx, participant) in participants.iter().enumerate() {
            if participant.livre_offert_id >= 0 {
                // Cas régulier : livre offert physique
                let livre_offert = sqlx::query_as::<_, LivreScolaire>(
                    "SELECT * FROM livres_scolaires WHERE id = $1 AND is_active = true AND is_available = true"
                )
                .bind(participant.livre_offert_id)
                .fetch_optional(&*self.pool)
                .await
                .map_err(|e| AppError::Internal(format!("Erreur validation chaîne: {}", e)))?
                .ok_or_else(|| AppError::BadRequest(format!("Livre offert {} non trouvé ou indisponible", participant.livre_offert_id)))?;

                if livre_offert.user_id != participant.user_id {
                    return Err(AppError::BadRequest(format!(
                        "Le livre {} n'appartient pas à l'utilisateur {}",
                        participant.livre_offert_id, participant.user_id
                    )));
                }
            } else {
                // Cas demande : ne peut occuper QUE la dernière position
                if idx + 1 != participants.len() {
                    return Err(AppError::BadRequest(format!(
                        "Demande d'achat (livre_offert_id={}) doit être en dernière position, trouvée à l'index {}",
                        participant.livre_offert_id, idx
                    )));
                }
                let demande_id = -participant.livre_offert_id;
                let demande = sqlx::query_as::<_, LivreScolaireDemande>(
                    "SELECT * FROM livres_scolaires_demandes WHERE id = $1 AND is_active = true AND is_satisfied = false"
                )
                .bind(demande_id)
                .fetch_optional(&*self.pool)
                .await
                .map_err(|e| AppError::Internal(format!("Erreur validation demande: {}", e)))?
                .ok_or_else(|| AppError::BadRequest(format!("Demande {} introuvable ou déjà satisfaite", demande_id)))?;
                if demande.user_id != participant.user_id {
                    return Err(AppError::BadRequest(format!(
                        "La demande {} n'appartient pas à l'utilisateur {}",
                        demande_id, participant.user_id
                    )));
                }
            }
        }

        // Pour chaque arête DAG (i → i+1), vérifier la correspondance classe/matière
        for i in 0..participants.len().saturating_sub(1) {
            let sender = &participants[i];
            let receiver = &participants[i + 1];

            // Sender DOIT être un vrai livre (les demandes ne peuvent jamais être sender)
            if sender.livre_offert_id < 0 {
                return Err(AppError::BadRequest(format!(
                    "Une demande (id={}) ne peut pas être expéditrice dans la chaîne",
                    -sender.livre_offert_id
                )));
            }

            let livre_envoye =
                sqlx::query_as::<_, LivreScolaire>("SELECT * FROM livres_scolaires WHERE id = $1")
                    .bind(sender.livre_offert_id)
                    .fetch_optional(&*self.pool)
                    .await
                    .map_err(|e| AppError::Internal(format!("Erreur validation chaîne: {}", e)))?
                    .ok_or_else(|| {
                        AppError::BadRequest(format!("Livre {} non trouvé", sender.livre_offert_id))
                    })?;

            // Le receiver peut être soit un livre régulier, soit une demande.
            // On résout les champs (classe_souhaitee, matiere) selon le cas.
            let (receiver_classe_souhaitee, receiver_matiere, receiver_label) =
                if receiver.livre_offert_id >= 0 {
                    let l = sqlx::query_as::<_, LivreScolaire>(
                        "SELECT * FROM livres_scolaires WHERE id = $1",
                    )
                    .bind(receiver.livre_offert_id)
                    .fetch_optional(&*self.pool)
                    .await
                    .map_err(|e| AppError::Internal(format!("Erreur validation chaîne: {}", e)))?
                    .ok_or_else(|| {
                        AppError::BadRequest(format!("Livre {} non trouvé", receiver.livre_offert_id))
                    })?;
                    (l.classe_souhaitee.clone(), l.matiere.clone(), format!("livre {}", l.id))
                } else {
                    let demande_id = -receiver.livre_offert_id;
                    let d = sqlx::query_as::<_, LivreScolaireDemande>(
                        "SELECT * FROM livres_scolaires_demandes WHERE id = $1",
                    )
                    .bind(demande_id)
                    .fetch_optional(&*self.pool)
                    .await
                    .map_err(|e| AppError::Internal(format!("Erreur validation demande: {}", e)))?
                    .ok_or_else(|| {
                        AppError::BadRequest(format!("Demande {} non trouvée", demande_id))
                    })?;
                    (d.classe_souhaitee.clone(), d.matiere.clone(), format!("demande {}", d.id))
                };

            // Le matching DAG: le livre envoyé a la classe que le receiver cherche.
            // ✅ FIX 2026-05-16 — Comparaison canonique (lower+trim+accents)
            // pour tolérer "6e" vs "6ème", "MATHS" vs "maths", etc.
            if canonical(&livre_envoye.classe_actuelle) != canonical(&receiver_classe_souhaitee)
                || canonical(&livre_envoye.matiere) != canonical(&receiver_matiere)
            {
                return Err(AppError::BadRequest(format!(
                    "Correspondance DAG incorrecte: livre {} (classe={}, matière={}) ne correspond pas au besoin du participant {} ({} — classe_souhaitee={}, matière={})",
                    sender.livre_offert_id, livre_envoye.classe_actuelle, livre_envoye.matiere,
                    receiver.user_id, receiver_label, receiver_classe_souhaitee, receiver_matiere
                )));
            }

            // Anti-réciprocité: vérifier que receiver → sender n'existe PAS dans la même chaîne
            let reverse_exists = participants.iter().enumerate().any(|(j, p)| {
                j > i
                    && p.user_id == receiver.user_id
                    && participants.get(j + 1).map(|next| next.user_id) == Some(sender.user_id)
            });
            if reverse_exists {
                return Err(AppError::BadRequest(format!(
                    "Anti-réciprocité violée: transferts {} → {} et {} → {} dans la même chaîne",
                    sender.user_id, receiver.user_id, receiver.user_id, sender.user_id
                )));
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

        let mut tx = self
            .pool
            .begin()
            .await
            .map_err(|e| AppError::Internal(format!("Erreur début transaction: {}", e)))?;

        // Récupérer le troc avec verrou FOR UPDATE pour éviter les race conditions
        let troc = sqlx::query_as::<_, TrocLivre>(
            "SELECT * FROM troc_livres_scolaires WHERE id = $1 FOR UPDATE",
        )
        .bind(troc_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur récupération troc: {}", e)))?
        .ok_or_else(|| AppError::NotFound("Troc non trouvé".to_string()))?;

        // Vérifier que l'utilisateur est le participant
        if troc.participant_id != user_id {
            return Err(AppError::Forbidden(
                "Vous n'êtes pas le participant de ce troc".to_string(),
            ));
        }

        // Vérifier que le troc est en attente
        if troc.statut != "en_attente" {
            return Err(AppError::BadRequest(format!(
                "Ce troc ne peut pas être accepté (statut actuel: '{}')",
                troc.statut
            )));
        }

        // Vérifier que les livres sont toujours disponibles
        let livres_disponibles: i64 = sqlx::query_scalar(
            r#"
            SELECT COUNT(*) FROM livres_scolaires
            WHERE id IN ($1, $2) AND is_available = true AND is_active = true
            "#,
        )
        .bind(troc.livre_offert_id)
        .bind(troc.livre_souhaite_id)
        .fetch_one(&mut *tx)
        .await
        .unwrap_or(0);

        if livres_disponibles < 2 {
            // Refuser automatiquement ce troc car un livre n'est plus disponible
            sqlx::query("UPDATE troc_livres_scolaires SET statut = 'annule' WHERE id = $1")
                .bind(troc_id)
                .execute(&mut *tx)
                .await
                .ok();
            tx.commit().await.ok();
            return Err(AppError::BadRequest(
                "Un des livres n'est plus disponible. Le troc a été annulé.".to_string(),
            ));
        }

        // Annuler tous les autres trocs en attente impliquant ces mêmes livres
        sqlx::query(
            r#"
            UPDATE troc_livres_scolaires
            SET statut = 'annule'
            WHERE id != $1
            AND statut = 'en_attente'
            AND (livre_offert_id IN ($2, $3) OR livre_souhaite_id IN ($2, $3))
            "#,
        )
        .bind(troc_id)
        .bind(troc.livre_offert_id)
        .bind(troc.livre_souhaite_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur annulation trocs concurrents: {}", e)))?;

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
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur acceptation troc: {}", e)))?;

        tx.commit()
            .await
            .map_err(|e| AppError::Internal(format!("Erreur commit acceptation: {}", e)))?;

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
              AND statut IN ('en_attente', 'accepte')
            RETURNING *
            "#,
        )
        .bind(troc_id)
        .bind(user_id)
        .fetch_optional(&*self.pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur refus troc: {}", e)))?
        .ok_or_else(|| {
            AppError::NotFound(
                "Troc non trouvé, déjà finalisé ou vous n'êtes pas autorisé".to_string(),
            )
        })?;

        info!("[TROC_INTELLIGENT] ✅ Troc refusé: id={}", troc_id);
        Ok(troc)
    }

    /// Finaliser un troc (échange complété) — atomique via transaction SQL
    /// ✅ Inclut le paiement réel de la soulte (différence de valeur) + commissions Yukpo
    ///
    /// Formule par participant:
    ///   commission = valeur_reçue × 5%  (commission Yukpo sur ce qu'on reçoit)
    ///   soulte     = valeur_reçue - valeur_donnée  (différence de valeur entre livres)
    ///   total_dû   = soulte + commission  (si > 0 → on paie, si < 0 l'autre paie)
    ///
    /// Les frais de livraison sont gérés séparément par le système de paquets.
    pub async fn complete_troc(&self, troc_id: i32, user_id: i32) -> AppResult<TrocLivre> {
        info!(
            "[TROC_INTELLIGENT] Finalisation troc: id={}, user_id={}",
            troc_id, user_id
        );

        // Vérifier que le troc est accepté (FOR UPDATE pour éviter race condition)
        let mut tx = self
            .pool
            .begin()
            .await
            .map_err(|e| AppError::Internal(format!("Erreur début transaction: {}", e)))?;

        let troc = sqlx::query_as::<_, TrocLivre>(
            "SELECT * FROM troc_livres_scolaires WHERE id = $1 FOR UPDATE",
        )
        .bind(troc_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur récupération troc: {}", e)))?
        .ok_or_else(|| AppError::NotFound("Troc non trouvé".to_string()))?;

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

        // Récupérer les valeurs des livres pour calculer la soulte (dans la même tx)
        let livre_offert =
            sqlx::query_as::<_, LivreScolaire>("SELECT * FROM livres_scolaires WHERE id = $1")
                .bind(troc.livre_offert_id)
                .fetch_optional(&mut *tx)
                .await
                .map_err(|e| {
                    AppError::Internal(format!("Erreur récupération livre offert: {}", e))
                })?;

        let livre_souhaite =
            sqlx::query_as::<_, LivreScolaire>("SELECT * FROM livres_scolaires WHERE id = $1")
                .bind(troc.livre_souhaite_id)
                .fetch_optional(&mut *tx)
                .await
                .map_err(|e| {
                    AppError::Internal(format!("Erreur récupération livre souhaité: {}", e))
                })?;

        let valeur_offert: f64 = livre_offert
            .as_ref()
            .and_then(|l| l.valeur_calculee)
            .and_then(|v| v.to_string().parse().ok())
            .unwrap_or(0.0);
        let valeur_souhaite: f64 = livre_souhaite
            .as_ref()
            .and_then(|l| l.valeur_calculee)
            .and_then(|v| v.to_string().parse().ok())
            .unwrap_or(0.0);

        let taux = crate::models::livre_scolaire::TAUX_COMMISSION_APP; // 5%

        // Initiateur : donne livre_offert (valeur_offert), reçoit livre_souhaite (valeur_souhaite)
        // Participant: donne livre_souhaite (valeur_souhaite), reçoit livre_offert (valeur_offert)
        let commission_initiateur = valeur_souhaite * taux; // 5% de ce que l'initiateur REÇOIT
        let commission_participant = valeur_offert * taux; // 5% de ce que le participant REÇOIT
        let soulte = valeur_souhaite - valeur_offert; // >0 → initiateur reçoit plus → il paie

        let troc_complete = sqlx::query_as::<_, TrocLivre>(
            r#"
            UPDATE troc_livres_scolaires
            SET statut = 'complete', date_complete = NOW()
            WHERE id = $1
            RETURNING *
            "#,
        )
        .bind(troc_id)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur finalisation troc: {}", e)))?;

        sqlx::query("UPDATE livres_scolaires SET is_available = false WHERE id = $1 OR id = $2")
            .bind(troc_complete.livre_offert_id)
            .bind(troc_complete.livre_souhaite_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur désactivation livres: {}", e)))?;

        // ✅ PAIEMENT SOULTE — débiter celui qui reçoit plus, créditer l'autre
        // + Commission Yukpo prélevée sur chaque partie
        if valeur_offert > 0.0 || valeur_souhaite > 0.0 {
            // Débiter la commission de l'initiateur (5% de ce qu'il reçoit)
            if commission_initiateur > 0.0 {
                let cents = (commission_initiateur * 100.0).round() as i64;
                sqlx::query(
                    "UPDATE users SET tokens_balance = GREATEST(COALESCE(tokens_balance, 0) - $2, 0) WHERE id = $1",
                )
                .bind(troc.initiateur_id)
                .bind(cents)
                .execute(&mut *tx)
                .await
                .map_err(|e| AppError::Internal(format!("Erreur débit commission initiateur: {}", e)))?;
                info!(
                    "[TROC_SOULTE] Commission initiateur {}: -{} XAF (5% de {} reçu)",
                    troc.initiateur_id, commission_initiateur as i64, valeur_souhaite as i64
                );
            }

            // Débiter la commission du participant (5% de ce qu'il reçoit)
            if commission_participant > 0.0 {
                let cents = (commission_participant * 100.0).round() as i64;
                sqlx::query(
                    "UPDATE users SET tokens_balance = GREATEST(COALESCE(tokens_balance, 0) - $2, 0) WHERE id = $1",
                )
                .bind(troc.participant_id)
                .bind(cents)
                .execute(&mut *tx)
                .await
                .map_err(|e| AppError::Internal(format!("Erreur débit commission participant: {}", e)))?;
                info!(
                    "[TROC_SOULTE] Commission participant {}: -{} XAF (5% de {} reçu)",
                    troc.participant_id, commission_participant as i64, valeur_offert as i64
                );
            }

            // Paiement de la soulte (différence de valeur entre livres)
            if soulte.abs() > 0.0 {
                let soulte_cents = (soulte.abs() * 100.0).round() as i64;
                let (payeur_id, receveur_id) = if soulte > 0.0 {
                    (troc.initiateur_id, troc.participant_id)
                } else {
                    (troc.participant_id, troc.initiateur_id)
                };

                sqlx::query(
                    "UPDATE users SET tokens_balance = GREATEST(COALESCE(tokens_balance, 0) - $2, 0) WHERE id = $1",
                )
                .bind(payeur_id)
                .bind(soulte_cents)
                .execute(&mut *tx)
                .await
                .map_err(|e| AppError::Internal(format!("Erreur débit soulte payeur: {}", e)))?;

                sqlx::query(
                    "UPDATE users SET tokens_balance = COALESCE(tokens_balance, 0) + $2 WHERE id = $1",
                )
                .bind(receveur_id)
                .bind(soulte_cents)
                .execute(&mut *tx)
                .await
                .map_err(|e| AppError::Internal(format!("Erreur crédit soulte receveur: {}", e)))?;

                info!(
                    "[TROC_SOULTE] Soulte {} XAF: user {} → user {} (troc #{})",
                    soulte.abs() as i64,
                    payeur_id,
                    receveur_id,
                    troc_id
                );
            }

            // Enregistrer les commissions dans book_exchange_commissions
            let total_commission = commission_initiateur + commission_participant;
            if total_commission > 0.0 {
                sqlx::query(
                    r#"
                    INSERT INTO book_exchange_commissions (
                        livre_id, troc_id, vendeur_id, acheteur_id,
                        type_transaction, valeur_livre, taux_commission,
                        montant_commission, montant_reversement_vendeur, devise,
                        reversement_statut
                    )
                    VALUES ($1, $2, $3, $4, 'troc_soulte', $5, $6, $7, $8, 'XAF', 'paye')
                    "#,
                )
                .bind(troc.livre_offert_id)
                .bind(troc_id)
                .bind(troc.initiateur_id)
                .bind(troc.participant_id)
                .bind(
                    rust_decimal::Decimal::from_f64_retain(valeur_offert + valeur_souhaite)
                        .unwrap_or_default(),
                )
                .bind(rust_decimal::Decimal::from_f64_retain(taux).unwrap_or_default())
                .bind(rust_decimal::Decimal::from_f64_retain(total_commission).unwrap_or_default())
                .bind(rust_decimal::Decimal::from_f64_retain(soulte.abs()).unwrap_or_default())
                .execute(&mut *tx)
                .await
                .map_err(|e| {
                    AppError::Internal(format!("Erreur enregistrement commission: {}", e))
                })?;

                info!(
                    "[TROC_SOULTE] ✅ Troc #{}: soulte={} XAF, commission_yukpo={} XAF (initiateur:{}, participant:{})",
                    troc_id, soulte.abs() as i64, total_commission as i64,
                    commission_initiateur as i64, commission_participant as i64
                );
            }
        }

        tx.commit()
            .await
            .map_err(|e| AppError::Internal(format!("Erreur commit transaction: {}", e)))?;

        info!(
            "[TROC_INTELLIGENT] ✅ Troc complété avec paiement soulte: id={}",
            troc_id
        );
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

        // 4. Marquer les trocs comme packagés (atomique)
        if !created_packages.is_empty() {
            let troc_ids_all: Vec<i32> = trocs.iter().map(|t| t.id).collect();
            let mut pkg_tx =
                self.pool.begin().await.map_err(|e| {
                    AppError::Internal(format!("Erreur tx marquage paquets: {}", e))
                })?;
            for tid in &troc_ids_all {
                sqlx::query("UPDATE troc_livres_scolaires SET is_packaged = true WHERE id = $1")
                    .bind(tid)
                    .execute(&mut *pkg_tx)
                    .await
                    .map_err(|e| {
                        AppError::Internal(format!("Erreur marquage troc {} packagé: {}", tid, e))
                    })?;
            }
            pkg_tx.commit().await.map_err(|e| {
                AppError::Internal(format!("Erreur commit marquage paquets: {}", e))
            })?;
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

    /// Version in-memory de compute_optimized_route (pour usage dans une transaction)
    fn compute_optimized_route_from_packages(
        &self,
        packages: &[BookDeliveryPackage],
    ) -> Vec<serde_json::Value> {
        if packages.is_empty() {
            return vec![];
        }

        let mut waypoints_map: std::collections::HashMap<
            i32,
            (Option<String>, Option<String>, Vec<i32>, Vec<i32>),
        > = std::collections::HashMap::new();

        for pkg in packages {
            let entry = waypoints_map.entry(pkg.expediteur_id).or_insert_with(|| {
                (
                    pkg.expediteur_gps.clone(),
                    pkg.expediteur_adresse.clone(),
                    Vec::new(),
                    Vec::new(),
                )
            });
            entry.2.push(pkg.id);

            let entry = waypoints_map.entry(pkg.destinataire_id).or_insert_with(|| {
                (
                    pkg.destinataire_gps.clone(),
                    pkg.destinataire_adresse.clone(),
                    Vec::new(),
                    Vec::new(),
                )
            });
            entry.3.push(pkg.id);
        }

        let waypoints: Vec<(i32, Option<String>, Option<String>, Vec<i32>, Vec<i32>)> =
            waypoints_map
                .into_iter()
                .map(|(uid, (gps, addr, pickups, dropoffs))| (uid, gps, addr, pickups, dropoffs))
                .collect();

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

        Self::sort_by_nearest_neighbor(&mut pickup_waypoints);
        Self::sort_by_nearest_neighbor(&mut dropoff_only_waypoints);

        let mut ordered = Vec::new();
        let mut ordre = 1;

        for (uid, gps, addr, pickups, dropoffs) in &pickup_waypoints {
            let wp_type = if !dropoffs.is_empty() {
                "pickup_and_dropoff"
            } else {
                "pickup"
            };
            ordered.push(serde_json::json!({
                "ordre": ordre, "type": wp_type, "user_id": uid,
                "gps": gps, "adresse": addr,
                "pickup_package_ids": pickups, "dropoff_package_ids": dropoffs,
            }));
            ordre += 1;
        }

        for (uid, gps, addr, pickups, dropoffs) in &dropoff_only_waypoints {
            ordered.push(serde_json::json!({
                "ordre": ordre, "type": "dropoff", "user_id": uid,
                "gps": gps, "adresse": addr,
                "pickup_package_ids": pickups, "dropoff_package_ids": dropoffs,
            }));
            ordre += 1;
        }

        ordered
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

        // 3. Désactiver tous les livres impliqués (dans une transaction)
        let livre_ids: Vec<i32> = transfers.iter().map(|t| t.livre_id).collect();

        let mut tx =
            self.pool.begin().await.map_err(|e| {
                AppError::Internal(format!("Erreur début transaction finalize: {}", e))
            })?;

        for lid in &livre_ids {
            sqlx::query("UPDATE livres_scolaires SET is_available = false WHERE id = $1")
                .bind(lid)
                .execute(&mut *tx)
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
                .fetch_optional(&mut *tx)
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

            if let Ok(Some(rl)) = sqlx::query_as::<_, LivreScolaire>(
                "SELECT * FROM livres_scolaires WHERE user_id = $1 AND gps IS NOT NULL ORDER BY created_at DESC LIMIT 1",
            )
            .bind(receiver_id)
            .fetch_optional(&mut *tx)
            .await
            {
                receiver_gps = rl.gps.clone();
                receiver_addr = rl.ville.clone().or_else(|| rl.quartier.clone());
            }

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
            .fetch_one(&mut *tx)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur création paquet: {}", e)))?;

            package_ids_created.push(pkg_id);

            info!(
                "[TROC_INTELLIGENT] Paquet {} créé: {} → {} ({} livres, {:.0} XAF)",
                reference, sender_id, receiver_id, nombre_livres, valeur_totale
            );
        }

        // 4b. Contrainte coursier unique (dans la transaction)
        let existing_courier_rows = sqlx::query(
            r#"
            SELECT DISTINCT destinataire_id, coursier_id
            FROM book_delivery_packages
            WHERE coursier_id IS NOT NULL
            AND statut IN ('constitue', 'en_route', 'a_constituer')
            "#,
        )
        .fetch_all(&mut *tx)
        .await
        .unwrap_or_default();

        let mut existing_couriers: HashMap<i32, i32> = HashMap::new();
        for row in &existing_courier_rows {
            let dest_id: i32 = Row::get(row, "destinataire_id");
            let cour_id: i32 = Row::get(row, "coursier_id");
            existing_couriers.insert(dest_id, cour_id);
        }

        for ((sender_id, receiver_id), _) in &grouped {
            let coursier_id =
                existing_couriers.get(receiver_id).or_else(|| existing_couriers.get(sender_id));

            if let Some(&cid) = coursier_id {
                sqlx::query(
                    r#"UPDATE book_delivery_packages
                    SET coursier_id = $2
                    WHERE expediteur_id = $3 AND destinataire_id = $4
                    AND coursier_id IS NULL AND statut = 'constitue'"#,
                )
                .bind(cid)
                .bind(cid)
                .bind(sender_id)
                .bind(receiver_id)
                .execute(&mut *tx)
                .await
                .ok();

                info!(
                    "[TROC_INTELLIGENT] Paquets {}→{} → coursier {} (réutilisé)",
                    sender_id, receiver_id, cid
                );
            }
        }

        // 5. Calculer la route optimisée (via les paquets dans la transaction)
        let route = {
            let pkgs = sqlx::query_as::<_, BookDeliveryPackage>(
                "SELECT * FROM book_delivery_packages WHERE id = ANY($1)",
            )
            .bind(&package_ids_created)
            .fetch_all(&mut *tx)
            .await
            .unwrap_or_default();

            self.compute_optimized_route_from_packages(&pkgs)
        };

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
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur MAJ chaîne: {}", e)))?;

        tx.commit().await.map_err(|e| {
            AppError::Internal(format!("Erreur commit transaction finalize: {}", e))
        })?;

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

        let mut tx = self.pool.begin().await.map_err(|e| {
            AppError::Internal(format!("Erreur début transaction annulation: {}", e))
        })?;

        // 1. Récupérer le paquet
        let pkg = sqlx::query_as::<_, BookDeliveryPackage>(
            "SELECT * FROM book_delivery_packages WHERE id = $1 FOR UPDATE",
        )
        .bind(req.package_id)
        .fetch_optional(&mut *tx)
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
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur MAJ paquet: {}", e)))?;

        // 4. Créditer le wallet RÉEL du destinataire (table user_wallets, en centimes)
        let credit_cents = (credit_total * 100.0).round() as i64;

        // Solde avant crédit
        let balance_before: i64 = sqlx::query_scalar::<_, Option<i64>>(
            "SELECT balance_cents FROM user_wallets WHERE user_id = $1 AND currency = 'XAF'",
        )
        .bind(destinataire_id)
        .fetch_optional(&mut *tx)
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
        .execute(&mut *tx)
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
        .execute(&mut *tx)
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
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur log annulation: {}", e)))?;

        // 6. Réactiver le livre (il n'a pas été échangé)
        sqlx::query("UPDATE livres_scolaires SET is_available = true WHERE id = $1")
            .bind(req.livre_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur réactivation livre: {}", e)))?;

        tx.commit()
            .await
            .map_err(|e| AppError::Internal(format!("Erreur commit annulation livre: {}", e)))?;

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
