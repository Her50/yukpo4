/// Taxi Ride Controller — Estimation tarifaire, flow accept/refuse chauffeur, paiement + commission
///
/// Modèle économique Yukpo (taxis) :
///   - Commission plateforme : YUKPO_COMMISSION_TAXI_PCT (défaut 15 %)
///   - Reversement chauffeur : 85 % du tarif net
///   - Frais de base      : TARIF_BASE_FCFA  (défaut 500 FCFA)
///   - Prix/km            : TARIF_KM_FCFA    (défaut 350 FCFA/km)
///   - Supplément nuit    : +20 % entre 22h et 6h
///   - Supplément rush    : +15 % 7h-9h et 17h-20h
use crate::core::errors::AppError;
use crate::core::types::AppResult;
use crate::middlewares::jwt::AuthenticatedUser;
use crate::state::AppState;
use axum::{
    extract::{Extension, Path, Query, State},
    response::IntoResponse,
    Json,
};
use log::{error, info};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;

// ─── Constantes tarifaires ────────────────────────────────────────────────────

/// Commission Yukpo sur chaque course (15 %)
fn commission_pct() -> f64 {
    std::env::var("YUKPO_COMMISSION_TAXI_PCT")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(0.15)
}

/// Tarif de base (FCFA)
fn tarif_base() -> f64 {
    std::env::var("TARIF_BASE_FCFA")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(500.0)
}

/// Prix par kilomètre (FCFA)
fn tarif_km() -> f64 {
    std::env::var("TARIF_KM_FCFA")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(350.0)
}

/// Prix par minute d'attente (FCFA)
fn tarif_attente_min() -> f64 {
    std::env::var("TARIF_ATTENTE_MIN_FCFA")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(50.0)
}

// ─── Haversine ────────────────────────────────────────────────────────────────

fn haversine_km(lat1: f64, lon1: f64, lat2: f64, lon2: f64) -> f64 {
    let r = 6371.0_f64;
    let dlat = (lat2 - lat1).to_radians();
    let dlon = (lon2 - lon1).to_radians();
    let a = (dlat / 2.0).sin().powi(2)
        + lat1.to_radians().cos() * lat2.to_radians().cos() * (dlon / 2.0).sin().powi(2);
    r * 2.0 * a.sqrt().asin()
}

/// Calcule le supplément selon l'heure (nuit / rush)
fn supplement_heure() -> f64 {
    let h = chrono::Local::now().hour();
    if h >= 22 || h < 6 {
        0.20 // +20% nuit
    } else if (7..=9).contains(&h) || (17..=20).contains(&h) {
        0.15 // +15% rush
    } else {
        0.0
    }
}

/// Estimation de durée (vitesse moyenne 30 km/h en ville)
fn estimate_duration_min(distance_km: f64) -> f64 {
    (distance_km / 30.0) * 60.0
}

// ─── Estimate Fare ────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct EstimateFareQuery {
    pub lat1: f64,
    pub lon1: f64,
    pub lat2: f64,
    pub lon2: f64,
    pub vehicle_type: Option<String>, // standard | confort | van
}

#[derive(Debug, Serialize)]
pub struct FareEstimate {
    pub distance_km: f64,
    pub duree_min: f64,
    pub tarif_base: f64,
    pub frais_km: f64,
    pub supplement_heure: f64,
    pub supplement_label: Option<String>,
    pub total_passager: f64,        // ce que paie le passager
    pub commission_yukpo: f64,      // prélevé par la plateforme
    pub reversement_chauffeur: f64, // ce que touche le chauffeur
    pub devise: String,
}

/// GET /api/taxis/estimate-fare
pub async fn estimate_fare(Query(q): Query<EstimateFareQuery>) -> AppResult<impl IntoResponse> {
    let distance_km = haversine_km(q.lat1, q.lon1, q.lat2, q.lon2);
    let duree_min = estimate_duration_min(distance_km);

    // Multiplicateur véhicule
    let vehicle_mult = match q.vehicle_type.as_deref().unwrap_or("standard") {
        "confort" => 1.3,
        "van" => 1.6,
        "moto" => 0.7,
        _ => 1.0,
    };

    let base = tarif_base() * vehicle_mult;
    let frais_km = distance_km * tarif_km() * vehicle_mult;
    let supp_pct = supplement_heure();
    let supp_amount = (base + frais_km) * supp_pct;
    let sous_total = base + frais_km + supp_amount;

    // Arrondir au 50 FCFA supérieur
    let total = (sous_total / 50.0).ceil() * 50.0;
    let commission = total * commission_pct();
    let reversement = total - commission;

    let supp_label = if supp_pct == 0.20 {
        Some("Supplément nuit (+20%)".to_string())
    } else if supp_pct == 0.15 {
        Some("Supplément heure de pointe (+15%)".to_string())
    } else {
        None
    };

    Ok(Json(json!({
        "success": true,
        "data": FareEstimate {
            distance_km: (distance_km * 10.0).round() / 10.0,
            duree_min: duree_min.round(),
            tarif_base: base,
            frais_km,
            supplement_heure: supp_amount,
            supplement_label: supp_label,
            total_passager: total,
            commission_yukpo: commission,
            reversement_chauffeur: reversement,
            devise: "FCFA".to_string(),
        }
    })))
}

// ─── Request Ride ─────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct RequestRidePayload {
    pub taxi_id: i32,
    pub pickup_lat: f64,
    pub pickup_lon: f64,
    pub dest_lat: f64,
    pub dest_lon: f64,
    pub pickup_address: String,
    pub dest_address: String,
    pub vehicle_type: Option<String>,
    pub notes: Option<String>,
}

/// POST /api/taxis/rides/request
/// Crée une demande de course et notifie le chauffeur.
pub async fn request_ride(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(payload): Json<RequestRidePayload>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[request_ride] user_id={} → taxi_id={}",
        user_id, payload.taxi_id
    );

    // Calculer le tarif estimé
    let distance_km = haversine_km(
        payload.pickup_lat,
        payload.pickup_lon,
        payload.dest_lat,
        payload.dest_lon,
    );
    let vehicle_mult = match payload.vehicle_type.as_deref().unwrap_or("standard") {
        "confort" => 1.3,
        "van" => 1.6,
        "moto" => 0.7,
        _ => 1.0,
    };
    let supp_pct = supplement_heure();
    let base = tarif_base() * vehicle_mult;
    let frais_km = distance_km * tarif_km() * vehicle_mult;
    let total = ((base + frais_km) * (1.0 + supp_pct) / 50.0).ceil() * 50.0;
    let duree_min = estimate_duration_min(distance_km);

    // Insérer la demande de course
    let ride_id: i32 = sqlx::query_scalar(
        r#"
        INSERT INTO taxi_rides (
            user_id, taxi_id,
            pickup_address, pickup_lat, pickup_lon,
            dest_address, dest_lat, dest_lon,
            vehicle_type, tarif_estime, distance_km, duree_estimee_min,
            commission_pct, statut, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'pending', NOW())
        RETURNING id
    "#,
    )
    .bind(user_id)
    .bind(payload.taxi_id)
    .bind(&payload.pickup_address)
    .bind(payload.pickup_lat)
    .bind(payload.pickup_lon)
    .bind(&payload.dest_address)
    .bind(payload.dest_lat)
    .bind(payload.dest_lon)
    .bind(payload.vehicle_type.as_deref().unwrap_or("standard"))
    .bind(total)
    .bind(distance_km)
    .bind(duree_min)
    .bind(commission_pct())
    .fetch_one(&state.pg)
    .await
    .map_err(|e| {
        error!("[request_ride] DB error: {}", e);
        AppError::Internal("Impossible de créer la course".to_string())
    })?;

    // TODO: envoyer push notification au chauffeur via FCM/OneSignal
    // push_to_driver(taxi_id, ride_id, pickup_address, estimated_fare).await;

    info!(
        "[request_ride] ✅ ride_id={} created, tarif={}FCFA dist={:.1}km",
        ride_id, total, distance_km
    );

    Ok(Json(json!({
        "success": true,
        "data": {
            "ride_id": ride_id,
            "tarif_estime": total,
            "distance_km": (distance_km * 10.0).round() / 10.0,
            "duree_estimee_min": duree_min.round(),
            "statut": "pending",
            "message": "Demande envoyée au chauffeur. En attente d'acceptation."
        }
    })))
}

// ─── Driver Accept / Refuse ───────────────────────────────────────────────────

/// POST /api/taxis/rides/:id/accept  (chauffeur connecté requis)
pub async fn accept_ride(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser {
        id: driver_user_id, ..
    }): Extension<AuthenticatedUser>,
    Path(ride_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[accept_ride] driver_user_id={} accepte ride_id={}",
        driver_user_id, ride_id
    );

    // Vérifier que ce chauffeur est bien associé au taxi de cette course
    let updated = sqlx::query_scalar::<_, i32>(
        r#"
        UPDATE taxi_rides r
        SET statut = 'accepted', accepted_at = NOW()
        FROM taxis_ville t
        WHERE r.id = $1
          AND r.taxi_id = t.id
          AND t.user_id = $2
          AND r.statut = 'pending'
        RETURNING r.id
    "#,
    )
    .bind(ride_id)
    .bind(driver_user_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| {
        error!("[accept_ride] DB error: {}", e);
        AppError::Internal("Erreur mise à jour course".to_string())
    })?;

    if updated.is_none() {
        return Err(AppError::NotFound(
            "Course introuvable, déjà traitée, ou vous n'êtes pas le chauffeur associé."
                .to_string(),
        ));
    }

    // TODO: notifier le passager que le chauffeur est en route

    Ok(Json(json!({
        "success": true,
        "data": { "ride_id": ride_id, "statut": "accepted" }
    })))
}

/// POST /api/taxis/rides/:id/refuse  (chauffeur connecté requis)
#[derive(Debug, Deserialize)]
pub struct RefuseRidePayload {
    pub raison: Option<String>, // "occupé" | "zone trop loin" | "autre"
}

pub async fn refuse_ride(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser {
        id: driver_user_id, ..
    }): Extension<AuthenticatedUser>,
    Path(ride_id): Path<i32>,
    Json(payload): Json<RefuseRidePayload>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[refuse_ride] driver_user_id={} refuse ride_id={}",
        driver_user_id, ride_id
    );

    let updated = sqlx::query_scalar::<_, i32>(
        r#"
        UPDATE taxi_rides r
        SET statut = 'refused',
            refused_at = NOW(),
            refusal_reason = $3
        FROM taxis_ville t
        WHERE r.id = $1
          AND r.taxi_id = t.id
          AND t.user_id = $2
          AND r.statut = 'pending'
        RETURNING r.id
    "#,
    )
    .bind(ride_id)
    .bind(driver_user_id)
    .bind(payload.raison.as_deref().unwrap_or("non précisée"))
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| {
        error!("[refuse_ride] DB error: {}", e);
        AppError::Internal("Erreur mise à jour course".to_string())
    })?;

    if updated.is_none() {
        return Err(AppError::NotFound(
            "Course introuvable ou déjà traitée.".to_string(),
        ));
    }

    // TODO: notifier le passager du refus et proposer un autre taxi

    Ok(Json(json!({
        "success": true,
        "data": { "ride_id": ride_id, "statut": "refused" }
    })))
}

// ─── Ride Status (polling passager) ──────────────────────────────────────────

/// GET /api/taxis/rides/:id/status
pub async fn get_ride_status(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(ride_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    let row = sqlx::query(
        r#"
        SELECT r.id, r.statut, r.tarif_estime, r.tarif_final,
               r.distance_km, r.duree_estimee_min,
               r.pickup_address, r.dest_address,
               r.accepted_at, r.refused_at, r.refusal_reason,
               r.completed_at,
               t.nom_etablissement as driver_name,
               t.telephone as driver_phone,
               t.whatsapp as driver_whatsapp,
               t.gps_actuel as driver_gps
        FROM taxi_rides r
        JOIN taxis_ville t ON t.id = r.taxi_id
        WHERE r.id = $1 AND r.user_id = $2
    "#,
    )
    .bind(ride_id)
    .bind(user_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| AppError::Internal(e.to_string()))?;

    let row = row.ok_or_else(|| AppError::NotFound("Course introuvable".to_string()))?;

    use sqlx::Row;
    Ok(Json(json!({
        "success": true,
        "data": {
            "ride_id": row.get::<i32, _>("id"),
            "statut": row.get::<String, _>("statut"),
            "tarif_estime": row.get::<Option<f64>, _>("tarif_estime"),
            "tarif_final": row.get::<Option<f64>, _>("tarif_final"),
            "distance_km": row.get::<Option<f64>, _>("distance_km"),
            "duree_estimee_min": row.get::<Option<f64>, _>("duree_estimee_min"),
            "pickup_address": row.get::<Option<String>, _>("pickup_address"),
            "dest_address": row.get::<Option<String>, _>("dest_address"),
            "accepted_at": row.get::<Option<chrono::DateTime<chrono::Utc>>, _>("accepted_at"),
            "refused_at": row.get::<Option<chrono::DateTime<chrono::Utc>>, _>("refused_at"),
            "refusal_reason": row.get::<Option<String>, _>("refusal_reason"),
            "driver_name": row.get::<Option<String>, _>("driver_name"),
            "driver_phone": row.get::<Option<String>, _>("driver_phone"),
            "driver_whatsapp": row.get::<Option<String>, _>("driver_whatsapp"),
            "driver_gps": row.get::<Option<String>, _>("driver_gps"),
        }
    })))
}

// ─── Pay Ride ─────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct PayRidePayload {
    pub methode: String, // "mtn_money" | "orange_money" | "carte" | "especes"
    pub numero: Option<String>,
    pub montant: Option<f64>,
}

/// POST /api/taxis/rides/:id/pay
/// Enregistre le paiement, calcule et trace la commission Yukpo.
pub async fn pay_ride(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(ride_id): Path<i32>,
    Json(payload): Json<PayRidePayload>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[pay_ride] ride_id={} user_id={} methode={}",
        ride_id, user_id, payload.methode
    );

    // Récupérer la course et le tarif estimé
    let ride = sqlx::query(
        r#"
        SELECT r.tarif_estime, r.tarif_final, r.taxi_id, r.commission_pct, r.statut
        FROM taxi_rides r
        WHERE r.id = $1 AND r.user_id = $2
    "#,
    )
    .bind(ride_id)
    .bind(user_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| AppError::Internal(e.to_string()))?
    .ok_or_else(|| AppError::NotFound("Course introuvable".to_string()))?;

    use sqlx::Row;
    let tarif_estime: Option<f64> = ride.get("tarif_estime");
    let tarif_final_db: Option<f64> = ride.get("tarif_final");
    let taxi_id: i32 = ride.get("taxi_id");
    let commission_rate: Option<f64> = ride.get("commission_pct");

    // Le tarif final = ce qui est payé (peut être légèrement différent de l'estimé)
    let montant_paye = payload.montant.or(tarif_final_db).or(tarif_estime).unwrap_or(0.0);

    let taux = commission_rate.unwrap_or_else(commission_pct);
    let commission_yukpo = (montant_paye * taux * 100.0).round() / 100.0;
    let reversement_chauffeur = montant_paye - commission_yukpo;

    // Transaction : marquer course payée + enregistrer commission
    let tx_id = format!("YK-{:X}", chrono::Utc::now().timestamp_millis());

    sqlx::query(
        r#"
        UPDATE taxi_rides
        SET statut = 'completed',
            tarif_final = $1,
            methode_paiement = $2,
            transaction_id = $3,
            commission_yukpo = $4,
            reversement_chauffeur = $5,
            completed_at = NOW()
        WHERE id = $6 AND user_id = $7
    "#,
    )
    .bind(montant_paye)
    .bind(&payload.methode)
    .bind(&tx_id)
    .bind(commission_yukpo)
    .bind(reversement_chauffeur)
    .bind(ride_id)
    .bind(user_id)
    .execute(&state.pg)
    .await
    .map_err(|e| {
        error!("[pay_ride] DB error: {}", e);
        AppError::Internal("Erreur enregistrement paiement".to_string())
    })?;

    // Enregistrer dans la table commissions_yukpo (même pattern que les livres)
    let _ = sqlx::query(
        r#"
        INSERT INTO commissions_yukpo (
            service_type, reference_id, montant_total,
            commission_pct, montant_commission, reversement_prestataire,
            methode_paiement, transaction_id, statut, created_at
        )
        VALUES ('taxi', $1, $2, $3, $4, $5, $6, $7, 'paid', NOW())
        ON CONFLICT DO NOTHING
    "#,
    )
    .bind(ride_id)
    .bind(montant_paye)
    .bind(taux)
    .bind(commission_yukpo)
    .bind(reversement_chauffeur)
    .bind(&payload.methode)
    .bind(&tx_id)
    .execute(&state.pg)
    .await;

    // Marquer le taxi comme disponible à nouveau
    let _ = sqlx::query("UPDATE taxis_ville SET is_available_now = true WHERE id = $1")
        .bind(taxi_id)
        .execute(&state.pg)
        .await;

    info!(
        "[pay_ride] ✅ ride_id={} payé {}FCFA | commission={}FCFA | reversement={}FCFA",
        ride_id, montant_paye, commission_yukpo, reversement_chauffeur
    );

    Ok(Json(json!({
        "success": true,
        "data": {
            "transaction_id": tx_id,
            "montant_paye": montant_paye,
            "commission_yukpo": commission_yukpo,
            "reversement_chauffeur": reversement_chauffeur,
            "methode": payload.methode,
            "statut": "completed"
        }
    })))
}

// ─── Driver: courses en attente ───────────────────────────────────────────────

/// GET /api/taxis/driver/pending-rides
/// Retourne les courses en statut 'pending' assignées aux taxis de ce chauffeur.
/// Polling côté mobile chauffeur toutes les 5 secondes.
pub async fn driver_pending_rides(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser {
        id: driver_user_id, ..
    }): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    use sqlx::Row;

    let rows = sqlx::query(
        r#"
        SELECT r.id          AS ride_id,
               r.statut,
               r.tarif_estime,
               r.distance_km,
               r.duree_estimee_min,
               r.pickup_address,
               r.dest_address,
               r.pickup_lat,
               r.pickup_lon,
               r.dest_lat,
               r.dest_lon,
               r.vehicle_type,
               r.notes,
               r.created_at,
               r.taxi_id,
               u.phone       AS passenger_phone
        FROM taxi_rides r
        JOIN taxis_ville t ON t.id = r.taxi_id
        LEFT JOIN users u  ON u.id = r.user_id
        WHERE t.user_id = $1
          AND r.statut  = 'pending'
        ORDER BY r.created_at ASC
        LIMIT 10
    "#,
    )
    .bind(driver_user_id)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| AppError::Internal(e.to_string()))?;

    let rides: Vec<serde_json::Value> = rows
        .iter()
        .map(|r| {
            json!({
                "ride_id":          r.get::<i32, _>("ride_id"),
                "statut":           r.get::<String, _>("statut"),
                "tarif_estime":     r.get::<Option<f64>, _>("tarif_estime"),
                "distance_km":      r.get::<Option<f64>, _>("distance_km"),
                "duree_estimee_min":r.get::<Option<f64>, _>("duree_estimee_min"),
                "pickup_address":   r.get::<Option<String>, _>("pickup_address"),
                "dest_address":     r.get::<Option<String>, _>("dest_address"),
                "pickup_lat":       r.get::<Option<f64>, _>("pickup_lat"),
                "pickup_lon":       r.get::<Option<f64>, _>("pickup_lon"),
                "dest_lat":         r.get::<Option<f64>, _>("dest_lat"),
                "dest_lon":         r.get::<Option<f64>, _>("dest_lon"),
                "vehicle_type":     r.get::<Option<String>, _>("vehicle_type"),
                "notes":            r.get::<Option<String>, _>("notes"),
                "taxi_id":          r.get::<i32, _>("taxi_id"),
                "passenger_phone":  r.get::<Option<String>, _>("passenger_phone"),
                "created_at":       r.get::<chrono::DateTime<chrono::Utc>, _>("created_at"),
            })
        })
        .collect();

    Ok(Json(json!({
        "success": true,
        "data": rides,
        "count": rides.len()
    })))
}
