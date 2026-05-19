//! 2026-05-19 MVP4 — Worker auto-suggestion clusters paquets → coursier.
//!
//! Tourne en cron (1 h par défaut). Détecte les paquets `constitue` sans
//! coursier, les regroupe par cellule géographique (bucket lat/lng), et
//! pour chaque cluster trouve le coursier `active` le plus proche du
//! centre de gravité. Envoie une notif push aux super-libraires actifs
//! avec la suggestion → YL valide en 1 click via /packages/assign-batch.
//!
//! Le clustering utilise un bucket simple (taille configurable, défaut
//! 0.05° ≈ 5 km) plutôt qu'un vrai K-means : suffisant pour la rentrée
//! 2026 (1 cluster par quartier), simple à débugger, idempotent.
//!
//! Activable via `YUKPO_LIB_OPT_ENABLED` (défaut: true).
//! Désactiver l'auto-assignation : laisse seulement la notif (mode
//! "suggestion only") — toujours validé par YL côté UI.

use crate::services::push_notification_service::send_push_notification;
use crate::state::AppState;
use log::{error, info, warn};
use serde_json::json;
use sqlx::Row;
use std::sync::Arc;
use std::time::Duration;

const DEFAULT_INTERVAL_S: u64 = 3600;
/// Taille bucket clustering en degrés (0.05° ≈ 5.5 km à l'équateur).
const DEFAULT_BUCKET_DEG: f64 = 0.05;
/// Cluster minimum pour générer une notif (1 = on suggère même pour 1 paquet).
const DEFAULT_MIN_CLUSTER_SIZE: i64 = 2;
/// Rayon max courrier ↔ cluster (km) pour proposer l'affectation.
const DEFAULT_MAX_DISTANCE_KM: f64 = 20.0;

pub fn spawn_worker(state: Arc<AppState>) {
    let interval_s = std::env::var("YUKPO_LIB_OPT_INTERVAL_S")
        .ok()
        .and_then(|v| v.parse::<u64>().ok())
        .unwrap_or(DEFAULT_INTERVAL_S);
    let enabled = std::env::var("YUKPO_LIB_OPT_ENABLED")
        .map(|v| v != "false" && v != "0")
        .unwrap_or(true);
    if !enabled {
        info!("[courier-assign-optimizer] désactivé via YUKPO_LIB_OPT_ENABLED=false");
        return;
    }

    tokio::spawn(async move {
        info!(
            "[courier-assign-optimizer] démarrage (poll {}s, bucket {}°, min cluster {}, max dist {}km)",
            interval_s, DEFAULT_BUCKET_DEG, DEFAULT_MIN_CLUSTER_SIZE, DEFAULT_MAX_DISTANCE_KM
        );
        tokio::time::sleep(Duration::from_secs(150)).await;

        let mut interval = tokio::time::interval(Duration::from_secs(interval_s));
        loop {
            interval.tick().await;
            match tick(&state).await {
                Ok(n) if n > 0 => info!("[courier-assign-optimizer] {} cluster(s) suggéré(s)", n),
                Ok(_) => {}
                Err(e) => warn!("[courier-assign-optimizer] tick error: {}", e),
            }
        }
    });
}

async fn tick(state: &Arc<AppState>) -> Result<usize, Box<dyn std::error::Error + Send + Sync>> {
    // 1. Clusterise les paquets `constitue` sans coursier par bucket GPS.
    //    On utilise floor(lat/bucket)*bucket comme identifiant cluster.
    let bucket = DEFAULT_BUCKET_DEG;
    let min_size = DEFAULT_MIN_CLUSTER_SIZE;

    let clusters_q = format!(
        r#"
        SELECT
            FLOOR(SPLIT_PART(destinataire_gps, ',', 1)::float / {bucket}) * {bucket} AS lat_bucket,
            FLOOR(SPLIT_PART(destinataire_gps, ',', 2)::float / {bucket}) * {bucket} AS lng_bucket,
            ARRAY_AGG(id ORDER BY created_at ASC) AS package_ids,
            COUNT(*) AS n,
            AVG(SPLIT_PART(destinataire_gps, ',', 1)::float) AS centre_lat,
            AVG(SPLIT_PART(destinataire_gps, ',', 2)::float) AS centre_lng,
            SUM(nombre_livres)::int AS total_livres
        FROM book_delivery_packages
        WHERE statut = 'constitue'
          AND coursier_id IS NULL
          AND destinataire_gps IS NOT NULL
          AND destinataire_gps <> ''
        GROUP BY lat_bucket, lng_bucket
        HAVING COUNT(*) >= {min_size}
        ORDER BY n DESC
        LIMIT 50
        "#,
        bucket = bucket,
        min_size = min_size,
    );
    let cluster_rows = sqlx::query(&clusters_q).fetch_all(&state.pg).await?;

    if cluster_rows.is_empty() {
        return Ok(0);
    }

    // 2. Liste des coursiers actifs avec leur dernière position connue.
    let courier_rows = sqlx::query(
        r#"
        SELECT
            c.user_id,
            c.id AS courier_id,
            u.nom_complet,
            u.gps AS user_gps
        FROM couriers c
        JOIN users u ON u.id = c.user_id
        WHERE c.status = 'active'
        "#,
    )
    .fetch_all(&state.pg)
    .await?;

    if courier_rows.is_empty() {
        info!("[courier-assign-optimizer] aucun coursier actif — skip");
        return Ok(0);
    }

    // 3. Charge la liste des super-libraires actifs pour les notifs.
    let sl_user_rows = sqlx::query(
        "SELECT DISTINCT user_id FROM librairie_partners WHERE est_super_librairie = true AND est_actif = true",
    )
    .fetch_all(&state.pg)
    .await?;
    let sl_user_ids: Vec<i32> = sl_user_rows
        .iter()
        .filter_map(|r| r.try_get::<i32, _>("user_id").ok())
        .collect();

    // 4. Pour chaque cluster, trouver le coursier le plus proche (Haversine).
    let mut suggested = 0usize;
    for cr in &cluster_rows {
        let centre_lat: f64 = cr.try_get("centre_lat").unwrap_or(0.0);
        let centre_lng: f64 = cr.try_get("centre_lng").unwrap_or(0.0);
        let package_ids: Vec<i32> = cr.try_get("package_ids").unwrap_or_default();
        let n: i64 = cr.try_get("n").unwrap_or(0);
        let total_livres: i32 = cr.try_get("total_livres").unwrap_or(0);

        let mut best: Option<(i32, String, f64)> = None;
        for ur in &courier_rows {
            let courier_user_id: i32 = match ur.try_get("user_id") {
                Ok(v) => v,
                Err(_) => continue,
            };
            let courier_gps: Option<String> = ur.try_get("user_gps").ok();
            let nom: Option<String> = ur.try_get("nom_complet").ok();
            let (cu_lat, cu_lng) = match courier_gps.as_deref().and_then(parse_gps_str) {
                Some(v) => v,
                None => continue,
            };
            let dist = haversine_km(centre_lat, centre_lng, cu_lat, cu_lng);
            if dist > DEFAULT_MAX_DISTANCE_KM {
                continue;
            }
            if best.as_ref().map(|(_, _, d)| dist < *d).unwrap_or(true) {
                best = Some((courier_user_id, nom.unwrap_or_default(), dist));
            }
        }

        let Some((cu_id, cu_nom, cu_dist)) = best else {
            // Pas de coursier dans le rayon → on note pour log mais on skip notif
            continue;
        };

        // 5. Notif aux super-libraires
        let body = format!(
            "📦 {} paquet(s) ({} livres) groupés autour de ({:.4}, {:.4}) → coursier {} à {:.1} km",
            n,
            total_livres,
            centre_lat,
            centre_lng,
            if cu_nom.is_empty() { format!("user#{}", cu_id) } else { cu_nom.clone() },
            cu_dist,
        );
        for sl_user_id in &sl_user_ids {
            let _ = send_push_notification(
                &state.pg,
                *sl_user_id,
                "Suggestion tournée coursier".to_string(),
                body.clone(),
                Some(json!({
                    "type": "yukpo_lib_courier_suggestion",
                    "cluster_centre": [centre_lat, centre_lng],
                    "package_ids": package_ids,
                    "suggested_coursier_user_id": cu_id,
                    "suggested_coursier_nom": cu_nom,
                    "distance_km": cu_dist,
                    "nb_paquets": n,
                    "total_livres": total_livres,
                })),
                None,
            )
            .await;
        }

        info!(
            "[courier-assign-optimizer] cluster ({:.4},{:.4}) — {} paquets → coursier {} à {:.1}km",
            centre_lat, centre_lng, n, cu_id, cu_dist
        );
        suggested += 1;
    }

    Ok(suggested)
}

fn parse_gps_str(s: &str) -> Option<(f64, f64)> {
    let parts: Vec<&str> = s.split(',').collect();
    if parts.len() != 2 {
        return None;
    }
    let lat = parts[0].trim().parse::<f64>().ok()?;
    let lng = parts[1].trim().parse::<f64>().ok()?;
    Some((lat, lng))
}

fn haversine_km(lat1: f64, lon1: f64, lat2: f64, lon2: f64) -> f64 {
    const R: f64 = 6371.0;
    let dlat = (lat2 - lat1).to_radians();
    let dlon = (lon2 - lon1).to_radians();
    let a = (dlat / 2.0).sin().powi(2)
        + lat1.to_radians().cos() * lat2.to_radians().cos() * (dlon / 2.0).sin().powi(2);
    let c = 2.0 * a.sqrt().atan2((1.0 - a).sqrt());
    R * c
}
