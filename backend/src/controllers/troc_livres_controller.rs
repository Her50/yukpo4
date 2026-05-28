// ✅ NOUVEAU: Contrôleur pour trocs de livres scolaires

use crate::core::types::{AppError, AppResult};
use crate::middlewares::jwt::AuthenticatedUser;
use crate::models::livre_scolaire::LivreScolaire;
use crate::models::troc_livre::{ChaineTrocLivre, TrocLivre};
use crate::models::troc_livre::{CreateTrocChaineRequest, CreateTrocDirectRequest, MatchingResult};
use crate::services::troc_intelligent_service::TrocIntelligentService as Service;
use crate::state::AppState;
use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use log::info;
use serde::Deserialize;
use serde_json::json;
use std::sync::Arc;

/// POST /api/troc-livres/match
/// Trouver des matchings (direct + chaînes) pour un livre
pub async fn find_matchings(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(payload): Json<FindMatchingsRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[find_matchings] User ID: {}, Livre ID: {}",
        user_id, payload.livre_id
    );

    // Vérifier que le livre appartient à l'utilisateur authentifié
    let livre_owner: Option<i32> =
        sqlx::query_scalar("SELECT user_id FROM livres_scolaires WHERE id = $1")
            .bind(payload.livre_id)
            .fetch_optional(&state.pg)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur vérification livre: {}", e)))?;

    match livre_owner {
        Some(owner_id) if owner_id != user_id => {
            return Err(AppError::Forbidden(
                "Vous ne pouvez rechercher des matchings que pour vos propres livres".to_string(),
            ));
        }
        None => {
            return Err(AppError::NotFound("Livre non trouvé".to_string()));
        }
        _ => {}
    }

    let service = Service::new(Arc::new(state.pg.clone()));

    // ✅ 2026-05-19 DEBUG — Log les erreurs réelles au lieu de unwrap_or_default
    let matchings_direct = match service.find_matching_direct(payload.livre_id).await {
        Ok(v) => v,
        Err(e) => {
            log::warn!("[find_matchings] find_matching_direct({}) err: {:?}", payload.livre_id, e);
            Vec::new()
        }
    };

    let matchings_chaine = if payload.include_chaines.unwrap_or(true) {
        match service
            .find_matching_chaine(payload.livre_id, payload.max_participants)
            .await
        {
            Ok(v) => v,
            Err(e) => {
                log::warn!("[find_matchings] find_matching_chaine({}) err: {:?}", payload.livre_id, e);
                Vec::new()
            }
        }
    } else {
        Vec::new()
    };

    let result = MatchingResult {
        matching_type: "direct_et_chaine".to_string(),
        matches: matchings_direct,
        chaines: matchings_chaine,
    };

    Ok(Json(json!({ "success": true, "matchings": result })))
}

#[derive(Debug, Deserialize)]
pub struct FindMatchingsRequest {
    pub livre_id: i32,
    pub include_chaines: Option<bool>,
    pub max_participants: Option<i32>,
}

/// GET /api/v2/admin/troc/consignation-pool
/// Liste les livres en `troc_status='expired'` (60j sans match), à valoriser
/// par l'admin Yukpo via canaux secondaires (vente boutique partenaire,
/// don, retrait définitif). Réservé aux admins.
pub async fn list_consignation_pool(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { role, .. }): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    let r = role.to_lowercase();
    if r != "admin" && r != "super_admin" {
        return Err(AppError::Forbidden(
            "Réservé aux administrateurs Yukpo".into(),
        ));
    }
    use sqlx::Row;
    let rows = sqlx::query(
        r#"
        SELECT l.id, l.titre, l.auteur, l.editeur, l.classe_actuelle, l.classe_souhaitee,
               l.matiere, l.etat_classification,
               l.valeur_calculee::float8 AS valeur_calculee,
               l.prix_detecte::float8 AS prix_detecte,
               l.gps, l.ville, l.quartier,
               l.user_id, l.created_at, l.updated_at,
               u.email AS owner_email
        FROM livres_scolaires l
        LEFT JOIN users u ON u.id = l.user_id
        WHERE l.troc_status = 'expired'
        ORDER BY l.updated_at DESC
        LIMIT 200
        "#,
    )
    .fetch_all(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur listing pool: {}", e)))?;

    let items: Vec<serde_json::Value> = rows
        .iter()
        .map(|r| {
            json!({
                "id": r.try_get::<i32, _>("id").unwrap_or(0),
                "titre": r.try_get::<Option<String>, _>("titre").unwrap_or(None),
                "auteur": r.try_get::<Option<String>, _>("auteur").unwrap_or(None),
                "editeur": r.try_get::<Option<String>, _>("editeur").unwrap_or(None),
                "classe_actuelle": r.try_get::<Option<String>, _>("classe_actuelle").unwrap_or(None),
                "classe_souhaitee": r.try_get::<Option<String>, _>("classe_souhaitee").unwrap_or(None),
                "matiere": r.try_get::<Option<String>, _>("matiere").unwrap_or(None),
                "etat_classification": r.try_get::<Option<String>, _>("etat_classification").unwrap_or(None),
                "valeur_calculee": r.try_get::<Option<f64>, _>("valeur_calculee").unwrap_or(None),
                "prix_detecte": r.try_get::<Option<f64>, _>("prix_detecte").unwrap_or(None),
                "gps": r.try_get::<Option<String>, _>("gps").unwrap_or(None),
                "ville": r.try_get::<Option<String>, _>("ville").unwrap_or(None),
                "quartier": r.try_get::<Option<String>, _>("quartier").unwrap_or(None),
                "user_id": r.try_get::<i32, _>("user_id").unwrap_or(0),
                "owner_email": r.try_get::<Option<String>, _>("owner_email").unwrap_or(None),
                "created_at": r.try_get::<chrono::DateTime<chrono::Utc>, _>("created_at").ok().map(|t| t.to_rfc3339()),
                "expired_since": r.try_get::<chrono::DateTime<chrono::Utc>, _>("updated_at").ok().map(|t| t.to_rfc3339()),
            })
        })
        .collect();

    Ok(Json(
        json!({ "success": true, "items": items, "count": items.len() }),
    ))
}

#[derive(Debug, Deserialize)]
pub struct ConsignationRecoveryPayload {
    /// Montant XAF effectivement récupéré via canal secondaire (vente boutique,
    /// don avec déduction fiscale, etc.). Sera crédité sur le wallet du parent
    /// si ratio négocié — sinon 0 et on marque le livre comme "récupéré sans
    /// rétribution parent".
    pub amount_recovered_xaf: f64,
    pub channel: String, // 'boutique_sale', 'donation', 'pulled', etc.
    pub note: Option<String>,
}

/// POST /api/v2/admin/troc/consignation/{livre_id}/recover
/// Marque un livre `expired` comme "récupéré" via un canal secondaire.
/// Optionnellement crédite le wallet du parent si une partie de la valeur
/// a été récupérée. Le livre passe en statut `delivered` (pour le sortir
/// du pool d'expirés).
pub async fn recover_consignation(
    State(state): State<Arc<AppState>>,
    user: Extension<AuthenticatedUser>,
    Path(livre_id): Path<i32>,
    Json(payload): Json<ConsignationRecoveryPayload>,
) -> AppResult<impl IntoResponse> {
    // Patch H3 (2026-05-12) : autoriser super_admin/admin Yukpo + admins de
    // la librairie Yukpo officielle (env YUKPO_OFFICIAL_LIBRAIRIE_USER_IDS).
    crate::utils::role_helpers::ensure_bourse_admin(&user)?;

    // Récupère l'owner pour le crédit éventuel
    let owner_id: Option<i32> = sqlx::query_scalar(
        "SELECT user_id FROM livres_scolaires WHERE id = $1 AND troc_status = 'expired'",
    )
    .bind(livre_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur lookup livre: {}", e)))?;

    let owner_id = owner_id.ok_or_else(|| {
        AppError::NotFound(format!(
            "Livre {} introuvable ou pas en troc_status='expired'",
            livre_id
        ))
    })?;

    // Crédit wallet parent si le canal a généré une rentrée
    if payload.amount_recovered_xaf > 0.0 {
        use crate::services::wallet_credit_bourse_service as wallet;
        let dec = rust_decimal::Decimal::from_f64_retain(payload.amount_recovered_xaf)
            .unwrap_or_default();
        wallet::apply_credit(
            &state.pg,
            owner_id,
            dec,
            wallet::CreditSource::ConsignationRecovery,
            wallet::CreditMovementContext {
                livre_id: Some(livre_id),
                note: Some(format!(
                    "Récupération via {} : {}",
                    payload.channel,
                    payload.note.as_deref().unwrap_or("(aucune note)")
                )),
                ..Default::default()
            },
        )
        .await
        .map_err(|e| AppError::Internal(format!("Erreur crédit récupération: {}", e)))?;
    }

    // Marque le livre comme "delivered" (sorti du pool)
    sqlx::query(
        r#"UPDATE livres_scolaires
           SET troc_status = 'delivered', is_active = false, updated_at = NOW()
           WHERE id = $1"#,
    )
    .bind(livre_id)
    .execute(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur update livre: {}", e)))?;

    Ok(Json(json!({
        "success": true,
        "livre_id": livre_id,
        "owner_id": owner_id,
        "amount_credited": payload.amount_recovered_xaf,
        "channel": payload.channel,
    })))
}

/// POST /api/troc-livres/match-all-pending
/// Trouve le DAG global pour TOUS les livres en `troc_status='pending'` du
/// user authentifié, et calcule le crédit prévisionnel total.
///
/// Utilisé par le checkout (RecapAchatPage) pour appliquer un crédit immédiat
/// sur la commande en cours, avant même l'engagement de la chaîne troc.
///
/// Réponse :
///   {
///     "livres_pending": [{ id, titre, valeur_calculee, credit_provisionnel,
///                          a_un_match, distance_match_km, ... }],
///     "credit_total_disponible": <decimal>,
///     "credit_engageable_max": <decimal>,  // après application du cap commande
///     "match_count": <int>
///   }
pub async fn match_all_pending(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(params): Json<MatchAllPendingParams>,
) -> AppResult<impl IntoResponse> {
    use crate::services::wallet_credit_bourse_service as wallet;

    info!(
        "[match_all_pending] user_id={}, target_amount={:?}",
        user_id, params.target_amount
    );

    // 1. Récupère les livres en pending du user — modes 'troc' et 'vente'.
    // ✅ FIX 2026-05-16 — Élargi aux livres en VENTE (pas au DON).
    // Décision user : les livres en vente font partie intégrante du système
    // de matching ; ils peuvent même être en première position d'une chaîne
    // (pas de réciprocité requise, le vendeur reçoit cash). C'est en partie
    // grâce aux ventes qu'on parvient à boucler certaines chaînes.
    // Le DON est EXCLU du matching (livre offert gratuitement, ne participe
    // pas à la mécanique de troc/vente).
    use sqlx::Row;
    let rows = sqlx::query(
        r#"
        SELECT id, titre, classe_actuelle, classe_souhaitee, matiere, valeur_calculee::float8 as valeur,
               etat_classification, gps, mode_listing
        FROM livres_scolaires
        WHERE user_id = $1
          AND troc_status = 'pending'
          AND is_active = true
          AND COALESCE(etat_classification, 'acceptable') != 'rejete'
          AND COALESCE(mode_listing, 'troc') IN ('troc', 'vente')
        ORDER BY valeur_calculee DESC NULLS LAST
        "#,
    )
    .bind(user_id)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur listing pending: {}", e)))?;

    let mut livres_pending: Vec<serde_json::Value> = Vec::new();
    let mut credit_total: f64 = 0.0;
    let mut match_count: i32 = 0;

    let service = Service::new(Arc::new(state.pg.clone()));

    for row in &rows {
        let livre_id: i32 = row.try_get("id").unwrap_or(0);
        let valeur: f64 = row.try_get("valeur").ok().unwrap_or(0.0);
        let credit = wallet::compute_credit_for_book(valeur);

        // Tentative de matching pour ce livre — on vérifie juste s'il y a
        // un candidat (direct OU chaîne avec max=10 — le DAG cherche le minimum
        // et stoppe dès qu'une chaîne valide est trouvée, donc augmenter la
        // borne supérieure n'augmente pas le coût de calcul tant qu'on trouve
        // tôt ; ça élargit juste l'espace pour les chaînes longues utiles).
        // ✅ 2026-05-19 DEBUG — Logue les erreurs au lieu de les avaler.
        let direct = match service.find_matching_direct(livre_id).await {
            Ok(v) => v,
            Err(e) => {
                log::warn!("[match_all_pending] find_matching_direct({}) err: {:?}", livre_id, e);
                Vec::new()
            }
        };
        let chain = if direct.is_empty() {
            match service.find_matching_chaine(livre_id, Some(10)).await {
                Ok(v) => v,
                Err(e) => {
                    log::warn!("[match_all_pending] find_matching_chaine({}) err: {:?}", livre_id, e);
                    Vec::new()
                }
            }
        } else {
            Vec::new()
        };
        let a_un_match = !direct.is_empty() || !chain.is_empty();
        let distance_min =
            direct.iter().filter_map(|m| m.distance_km).fold(f64::INFINITY, f64::min);
        let distance_match_km = if distance_min.is_finite() {
            Some(distance_min)
        } else {
            None
        };

        if a_un_match {
            match_count += 1;
            credit_total += credit;
        }

        livres_pending.push(serde_json::json!({
            "id": livre_id,
            "titre": row.try_get::<Option<String>, _>("titre").unwrap_or(None),
            "classe_actuelle": row.try_get::<Option<String>, _>("classe_actuelle").unwrap_or(None),
            "classe_souhaitee": row.try_get::<Option<String>, _>("classe_souhaitee").unwrap_or(None),
            "matiere": row.try_get::<Option<String>, _>("matiere").unwrap_or(None),
            "valeur_calculee": valeur,
            "credit_provisionnel": credit,
            "a_un_match": a_un_match,
            "distance_match_km": distance_match_km,
            "n_matchings_directs": direct.len(),
            "n_matchings_chaines": chain.len(),
        }));
    }

    // Cap selon la commande en cours (si fournie en query param)
    let credit_engageable_max = match params.target_amount {
        Some(montant) if montant > 0.0 => wallet::cap_credit_for_order(credit_total, montant),
        _ => credit_total.min(wallet::CAP_CREDIT_PAR_PARENT_XAF),
    };

    Ok(Json(serde_json::json!({
        "success": true,
        "livres_pending": livres_pending,
        "credit_total_disponible": credit_total,
        "credit_engageable_max": credit_engageable_max,
        "match_count": match_count,
        "ratio_credit_vs_valeur": wallet::RATIO_CREDIT_VS_VALEUR_IA,
        "cap_par_parent": wallet::CAP_CREDIT_PAR_PARENT_XAF,
        "ratio_max_dans_commande": wallet::RATIO_MAX_CREDIT_DANS_COMMANDE,
    })))
}

#[derive(Debug, Deserialize)]
pub struct MatchAllPendingParams {
    /// Montant total de la commande en cours (XAF). Sert à plafonner le
    /// crédit utilisable selon `RATIO_MAX_CREDIT_DANS_COMMANDE`.
    pub target_amount: Option<f64>,
}

/// POST /api/troc-livres/direct
/// Créer un troc direct
pub async fn create_troc_direct(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(payload): Json<CreateTrocDirectRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[create_troc_direct] User ID: {}, Livre offert: {}, Livre souhaité: {}",
        user_id, payload.livre_offert_id, payload.livre_souhaite_id
    );

    // ✅ 2026-05-28 — Anti-squat : créer un troc engage à expédier un livre
    // physique à un inconnu. Un fraudeur ayant squatté un numéro pourrait
    // organiser des trocs frauduleux. Gate sur phone_verified.
    crate::utils::phone_verified::require_phone_verified(&state.pg, user_id).await?;

    let participant_id = payload.participant_id;
    let service = Service::new(Arc::new(state.pg.clone()));
    let troc = service.create_troc_direct(user_id, payload).await?;

    tokio::spawn({
        let pool = state.pg.clone();
        let troc_id = troc.id;
        async move {
            let _ = sqlx::query(
                r#"INSERT INTO notifications (user_id, type, title, body, data, created_at)
                   VALUES ($1, 'troc_proposed', 'notification.troc_proposed.title',
                           'notification.troc_proposed.body',
                           $2, NOW())"#,
            )
            .bind(participant_id)
            .bind(json!({"troc_id": troc_id, "i18n_key": "troc_proposed"}).to_string())
            .execute(&pool)
            .await;
        }
    });

    Ok((
        StatusCode::CREATED,
        Json(json!({ "success": true, "troc": troc })),
    ))
}

/// POST /api/troc-livres/chaine
/// Créer un troc en chaîne
pub async fn create_troc_chaine(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(payload): Json<CreateTrocChaineRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[create_troc_chaine] User ID: {}, Nombre de participants: {}",
        user_id,
        payload.participants.len()
    );

    // ✅ 2026-05-28 — Anti-squat (cf. create_troc_direct).
    crate::utils::phone_verified::require_phone_verified(&state.pg, user_id).await?;

    // Vérifier que l'utilisateur authentifié est participant de la chaîne
    let is_participant = payload.participants.iter().any(|p| p.user_id == user_id);
    if !is_participant {
        return Err(AppError::Forbidden(
            "Vous devez être participant de la chaîne pour la créer".to_string(),
        ));
    }

    let service = Service::new(Arc::new(state.pg.clone()));
    let chaine = service.create_troc_chaine(payload).await?;

    Ok((
        StatusCode::CREATED,
        Json(json!({ "success": true, "chaine": chaine })),
    ))
}

/// GET /api/troc-livres/my-trocs
/// Obtenir mes trocs (en attente, acceptés, complétés)
pub async fn get_my_trocs(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Query(params): Query<MyTrocsQuery>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[get_my_trocs] User ID: {}, Statut: {:?}",
        user_id, params.statut
    );

    let statut_filter = params.statut.as_deref();

    let trocs = if let Some(statut) = statut_filter {
        sqlx::query_as::<_, TrocLivre>(
            r#"
            SELECT * FROM troc_livres_scolaires
            WHERE (initiateur_id = $1 OR participant_id = $1)
            AND statut = $2
            ORDER BY created_at DESC
            LIMIT 50
            "#,
        )
        .bind(user_id)
        .bind(statut)
        .fetch_all(&state.pg)
        .await
    } else {
        sqlx::query_as::<_, TrocLivre>(
            r#"
            SELECT * FROM troc_livres_scolaires
            WHERE (initiateur_id = $1 OR participant_id = $1)
            ORDER BY created_at DESC
            LIMIT 50
            "#,
        )
        .bind(user_id)
        .fetch_all(&state.pg)
        .await
    }
    .map_err(|e| AppError::Internal(format!("Erreur récupération trocs: {}", e)))?;

    Ok(Json(json!({ "success": true, "trocs": trocs })))
}

#[derive(Debug, Deserialize)]
pub struct MyTrocsQuery {
    pub statut: Option<String>, // "en_attente", "accepte", "refuse", "complete"
}

/// POST /api/troc-livres/:id/accept
/// Accepter un troc
pub async fn accept_troc(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(troc_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    info!("[accept_troc] User ID: {}, Troc ID: {}", user_id, troc_id);

    let service = Service::new(Arc::new(state.pg.clone()));
    let troc = service.accept_troc(troc_id, user_id).await?;

    tokio::spawn({
        let pool = state.pg.clone();
        let initiateur_id = troc.initiateur_id;
        let tid = troc.id;
        async move {
            let _ = sqlx::query(
                r#"INSERT INTO notifications (user_id, type, title, body, data, created_at)
                   VALUES ($1, 'troc_accepted', 'notification.troc_accepted.title',
                           'notification.troc_accepted.body',
                           $2, NOW())"#,
            )
            .bind(initiateur_id)
            .bind(json!({"troc_id": tid, "i18n_key": "troc_accepted"}).to_string())
            .execute(&pool)
            .await;
        }
    });

    Ok(Json(json!({ "success": true, "troc": troc })))
}

/// POST /api/troc-livres/:id/refuse
/// Refuser un troc
pub async fn refuse_troc(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(troc_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    info!("[refuse_troc] User ID: {}, Troc ID: {}", user_id, troc_id);

    let service = Service::new(Arc::new(state.pg.clone()));
    let troc = service.refuse_troc(troc_id, user_id).await?;

    let notify_user_id = if troc.initiateur_id == user_id {
        troc.participant_id
    } else {
        troc.initiateur_id
    };
    tokio::spawn({
        let pool = state.pg.clone();
        let tid = troc.id;
        async move {
            let _ = sqlx::query(
                r#"INSERT INTO notifications (user_id, type, title, body, data, created_at)
                   VALUES ($1, 'troc_refused', 'notification.troc_refused.title',
                           'notification.troc_refused.body',
                           $2, NOW())"#,
            )
            .bind(notify_user_id)
            .bind(json!({"troc_id": tid, "i18n_key": "troc_refused"}).to_string())
            .execute(&pool)
            .await;
        }
    });

    Ok(Json(json!({ "success": true, "troc": troc })))
}

/// POST /api/troc-livres/:id/complete
/// Finaliser un échange (troc complété)
pub async fn complete_troc(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(troc_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    info!("[complete_troc] User ID: {}, Troc ID: {}", user_id, troc_id);

    let service = Service::new(Arc::new(state.pg.clone()));
    let troc = service.complete_troc(troc_id, user_id).await?;

    tokio::spawn({
        let pool = state.pg.clone();
        let initiateur_id = troc.initiateur_id;
        let participant_id = troc.participant_id;
        let tid = troc.id;
        async move {
            for uid in [initiateur_id, participant_id] {
                let _ = sqlx::query(
                    r#"INSERT INTO notifications (user_id, type, title, body, data, created_at)
                       VALUES ($1, 'troc_completed', 'notification.troc_completed.title',
                               'notification.troc_completed.body',
                               $2, NOW())"#,
                )
                .bind(uid)
                .bind(json!({"troc_id": tid, "i18n_key": "troc_completed"}).to_string())
                .execute(&pool)
                .await;
            }
        }
    });

    Ok(Json(json!({ "success": true, "troc": troc })))
}

/// GET /api/troc-livres/:id
/// Obtenir les détails d'un troc
pub async fn get_troc_details(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(troc_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[get_troc_details] User ID: {}, Troc ID: {}",
        user_id, troc_id
    );

    // Récupérer le troc
    let troc = sqlx::query_as::<_, TrocLivre>("SELECT * FROM troc_livres_scolaires WHERE id = $1")
        .bind(troc_id)
        .fetch_optional(&state.pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur récupération troc: {}", e)))?
        .ok_or_else(|| AppError::NotFound("Troc non trouvé".to_string()))?;

    // Vérifier que l'utilisateur est impliqué dans le troc
    if troc.initiateur_id != user_id && troc.participant_id != user_id {
        return Err(AppError::Forbidden(
            "Vous n'êtes pas impliqué dans ce troc".to_string(),
        ));
    }

    // Récupérer les détails des livres
    let livre_offert =
        sqlx::query_as::<_, LivreScolaire>("SELECT * FROM livres_scolaires WHERE id = $1")
            .bind(troc.livre_offert_id)
            .fetch_optional(&state.pg)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur récupération livre offert: {}", e)))?;

    let livre_souhaite =
        sqlx::query_as::<_, LivreScolaire>("SELECT * FROM livres_scolaires WHERE id = $1")
            .bind(troc.livre_souhaite_id)
            .fetch_optional(&state.pg)
            .await
            .map_err(|e| {
                AppError::Internal(format!("Erreur récupération livre souhaité: {}", e))
            })?;

    Ok(Json(json!({
        "success": true,
        "troc": troc,
        "livre_offert": livre_offert,
        "livre_souhaite": livre_souhaite
    })))
}

/// GET /api/troc-livres/chaines/:id
/// Obtenir les détails d'une chaîne de troc
pub async fn get_chaine_details(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(chaine_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[get_chaine_details] User ID: {}, Chaine ID: {}",
        user_id, chaine_id
    );

    let chaine = sqlx::query_as::<_, ChaineTrocLivre>(
        r#"
        SELECT * FROM chaines_troc_livres WHERE id = $1
        "#,
    )
    .bind(chaine_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur récupération chaîne: {}", e)))?
    .ok_or_else(|| AppError::NotFound("Chaîne non trouvée".to_string()))?;

    // Vérifier que l'utilisateur est participant de la chaîne
    let participants: Vec<serde_json::Value> =
        serde_json::from_value(chaine.participants.clone()).unwrap_or_default();
    let is_participant = participants
        .iter()
        .any(|p| p.get("user_id").and_then(|v| v.as_i64()) == Some(user_id as i64));

    let is_in_transfers = chaine
        .transfers
        .as_ref()
        .map(|t| {
            let transfers: Vec<serde_json::Value> =
                serde_json::from_value(t.clone()).unwrap_or_default();
            transfers.iter().any(|tr| {
                tr.get("sender_id").and_then(|v| v.as_i64()) == Some(user_id as i64)
                    || tr.get("receiver_id").and_then(|v| v.as_i64()) == Some(user_id as i64)
            })
        })
        .unwrap_or(false);

    if !is_participant && !is_in_transfers {
        return Err(AppError::Forbidden(
            "Vous n'êtes pas participant de cette chaîne".to_string(),
        ));
    }

    Ok(Json(json!({ "success": true, "chaine": chaine })))
}

// ============================================================================
// Pool troc/vente du parent — pour cross-flow intelligence
// ============================================================================

/// GET /api/troc-livres/my-pool
/// Retourne la liste des livres que le parent a déjà déposés (troc/vente/don)
/// et qui ne sont pas encore conclus (status pending/matched/chained).
/// Utilisé côté frontend pour :
///   1. Marquer les items d'une liste scolaire (scan ou partenaire) comme
///      "déjà couverts par votre échange" et éviter le double-achat.
///   2. Lier automatiquement la valeur du troc au prix de la commande
///      (l'utilisateur n'a pas à scanner deux fois le même livre).
pub async fn my_troc_pool(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    use sqlx::Row;
    let rows = sqlx::query(
        r#"
        SELECT
            id,
            COALESCE(titre, '') AS titre,
            COALESCE(auteur, '') AS auteur,
            COALESCE(classe_actuelle, '') AS classe_actuelle,
            COALESCE(classe_souhaitee, '') AS classe_souhaitee,
            COALESCE(matiere, '') AS matiere,
            COALESCE(mode_listing, 'troc') AS mode_listing,
            COALESCE(troc_status, 'pending') AS troc_status,
            valeur_calculee::float8 AS valeur,
            created_at
        FROM livres_scolaires
        WHERE user_id = $1
          AND is_active = true
          AND COALESCE(troc_status, 'pending') IN ('pending', 'matched', 'chained')
        ORDER BY created_at DESC
        LIMIT 100
        "#,
    )
    .bind(user_id)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| AppError::Database(format!("my_pool: {}", e)))?;

    let items: Vec<serde_json::Value> = rows
        .iter()
        .map(|r| {
            json!({
                "id": r.try_get::<i32, _>("id").unwrap_or(0),
                "titre": r.try_get::<String, _>("titre").unwrap_or_default(),
                "auteur": r.try_get::<String, _>("auteur").unwrap_or_default(),
                "classe_actuelle": r.try_get::<String, _>("classe_actuelle").unwrap_or_default(),
                "classe_souhaitee": r.try_get::<String, _>("classe_souhaitee").unwrap_or_default(),
                "matiere": r.try_get::<String, _>("matiere").unwrap_or_default(),
                "mode_listing": r.try_get::<String, _>("mode_listing").unwrap_or_default(),
                "troc_status": r.try_get::<String, _>("troc_status").unwrap_or_default(),
                "valeur": r.try_get::<Option<f64>, _>("valeur").ok().flatten(),
            })
        })
        .collect();

    Ok(Json(json!({
        "success": true,
        "count": items.len(),
        "items": items,
    })))
}

// ============================================================================
// Retrait volontaire d'un livre par son propriétaire
// ============================================================================

/// POST /api/troc-livres/{livre_id}/withdraw
/// Permet au parent propriétaire de retirer son livre du troc/vente à tout
/// moment, tant que la collecte n'est pas effective. Règles :
///   • status 'pending' ou 'matched' → autorisé, rollback crédit si avancé
///   • status 'chained' → refusé (coursier déjà en route), redirige vers support
///   • status 'delivered' / 'returned' / 'expired' → no-op (déjà clos)
pub async fn withdraw_livre(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(livre_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    // 1. Récupère le livre + status + propriétaire
    use sqlx::Row;
    let row = sqlx::query(
        "SELECT user_id, troc_status, titre FROM livres_scolaires WHERE id = $1 AND is_active = true",
    )
    .bind(livre_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| AppError::Database(format!("withdraw lookup: {}", e)))?;

    let row = row.ok_or_else(|| AppError::NotFound(format!("Livre {} introuvable", livre_id)))?;
    let owner_id: i32 = row.try_get("user_id").unwrap_or(0);
    let status: String = row
        .try_get::<Option<String>, _>("troc_status")
        .ok()
        .flatten()
        .unwrap_or_else(|| "pending".to_string());
    let titre: String = row
        .try_get::<Option<String>, _>("titre")
        .ok()
        .flatten()
        .unwrap_or_else(|| "Livre".to_string());

    if owner_id != user_id {
        return Err(AppError::Forbidden(
            "Vous n'êtes pas propriétaire de ce livre".into(),
        ));
    }

    match status.as_str() {
        "chained" => {
            return Err(AppError::BadRequest(
                "Coursier déjà engagé sur cette transaction. Contactez le support Yukpo.".into(),
            ));
        }
        "delivered" | "returned" | "expired" => {
            return Ok(Json(json!({
                "success": true,
                "noop": true,
                "message": "Livre déjà clos, aucune action requise.",
                "status": status,
            })));
        }
        _ => { /* pending / matched : on procède au retrait */ }
    }

    // 2. Rollback du crédit s'il avait été avancé (status 'matched' = crédit
    // provisional déjà appliqué). Pour 'pending', le crédit n'est pas encore
    // sur le wallet — on skip le rollback.
    let mut credit_restitue_xaf: f64 = 0.0;
    if status == "matched" {
        // Cherche le dernier crédit provisional pour ce livre dans le ledger
        let ledger_row = sqlx::query(
            r#"
            SELECT amount::float8 AS amount FROM wallet_credit_bourse_ledger
            WHERE livre_id = $1 AND direction = 'credit'
              AND source IN ('troc_credit_provisional', 'troc_credit_engaged')
              AND NOT EXISTS (
                  -- Patch C2 (2026-05-12) : inclure les deux chemins de rollback
                  SELECT 1 FROM wallet_credit_bourse_ledger ll
                  WHERE ll.livre_id = $1
                    AND ll.source IN ('troc_credit_rolled_back', 'troc_rollback_debt')
                    AND ll.created_at > wallet_credit_bourse_ledger.created_at
              )
            ORDER BY created_at DESC
            LIMIT 1
            "#,
        )
        .bind(livre_id)
        .fetch_optional(&state.pg)
        .await
        .map_err(|e| AppError::Database(format!("withdraw ledger: {}", e)))?;

        if let Some(lr) = ledger_row {
            let amount: f64 = lr.try_get::<f64, _>("amount").unwrap_or(0.0);
            if amount > 0.0 {
                use crate::services::wallet_credit_bourse_service as wallet;
                let dec = rust_decimal::Decimal::from_f64_retain(amount).unwrap_or_default();
                wallet::consume_credit(
                    &state.pg,
                    user_id,
                    dec,
                    wallet::CreditSource::TrocCreditRolledBack,
                    wallet::CreditMovementContext {
                        livre_id: Some(livre_id),
                        note: Some("Retrait volontaire par le propriétaire".into()),
                        ..Default::default()
                    },
                )
                .await
                .map_err(|e| {
                    AppError::Internal(format!("Erreur rollback crédit retrait: {}", e))
                })?;
                credit_restitue_xaf = amount;
            }
        }
    }

    // 3. Marque le livre comme retiré (status 'returned' + is_active=false)
    //    Patch C3 (2026-05-12) : défense en profondeur — la garde user_id
    //    en WHERE empêche tout IDOR même si le check ligne 793 disparaissait
    //    lors d'un futur refactor.
    sqlx::query(
        r#"UPDATE livres_scolaires
           SET troc_status = 'returned', is_available = false, is_active = false,
               updated_at = NOW()
           WHERE id = $1 AND user_id = $2"#,
    )
    .bind(livre_id)
    .bind(user_id)
    .execute(&state.pg)
    .await
    .map_err(|e| AppError::Database(format!("withdraw update: {}", e)))?;

    Ok(Json(json!({
        "success": true,
        "livre_id": livre_id,
        "titre": titre,
        "previous_status": status,
        "credit_restitue_xaf": credit_restitue_xaf,
        "message": if credit_restitue_xaf > 0.0 {
            format!(
                "Livre retiré. Crédit de {} XAF restitué à votre wallet.",
                credit_restitue_xaf as i64
            )
        } else {
            "Livre retiré du troc/vente.".into()
        },
    })))
}

// ============================================================================
// WhatsApp notifications queue — admin endpoints
// ============================================================================

/// GET /api/v2/admin/wa-queue/pending — liste les notifs WA en attente.
/// Le dashboard Librairie/Admin peut afficher chaque deeplink wa.me dans une
/// liste cliquable ; chaque clic ouvre WhatsApp avec le message pré-rempli.
pub async fn wa_queue_pending(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { role, .. }): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    let r = role.to_lowercase();
    if r != "admin" && r != "super_admin" && r != "super_libraire" {
        return Err(AppError::Forbidden("Accès réservé".into()));
    }
    use crate::services::whatsapp_notification_service as wa;
    let pending = wa::list_pending(&state.pg, 100)
        .await
        .map_err(|e| AppError::Database(format!("wa-queue: {}", e)))?;
    Ok(Json(json!({
        "success": true,
        "count": pending.len(),
        "items": pending,
    })))
}

/// POST /api/v2/admin/wa-queue/:id/mark-sent — marque comme envoyée après
/// que l'admin a cliqué sur le deeplink et envoyé manuellement.
pub async fn wa_queue_mark_sent(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { role, .. }): Extension<AuthenticatedUser>,
    Path(id): Path<i64>,
) -> AppResult<impl IntoResponse> {
    let r = role.to_lowercase();
    if r != "admin" && r != "super_admin" && r != "super_libraire" {
        return Err(AppError::Forbidden("Accès réservé".into()));
    }
    use crate::services::whatsapp_notification_service as wa;
    wa::mark_sent(&state.pg, id)
        .await
        .map_err(|e| AppError::Database(format!("wa-mark-sent: {}", e)))?;
    Ok(Json(json!({ "success": true, "id": id })))
}
