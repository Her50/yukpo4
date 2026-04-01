// Tâche cron : génération automatique de produits ticket_voyage depuis les horaires
// Date: 2026-04-01
// Fréquence : toutes les 6 heures + au démarrage
// Problème résolu: La génération était 100% manuelle (POST par l'agence).
//   Si une agence oubliait de déclencher la génération, aucun ticket n'apparaissait
//   dans la recherche Home.

use crate::state::AppState;
use chrono::Datelike;
use log::{error, info, warn};
use sqlx::Row;
use std::sync::Arc;

/// Durée entre deux exécutions automatiques (6 heures)
const GENERATION_INTERVAL_SECS: u64 = 6 * 3600;
/// Nombre de jours générés à l'avance par le cron
const DAYS_AHEAD: u32 = 14;

/// Démarre la tâche cron en arrière-plan.
/// Non bloquant : s'exécute dans un tokio::spawn.
pub fn start_bus_schedule_product_generator(state: Arc<AppState>) {
    if std::env::var("BUS_SCHEDULE_GENERATOR_DISABLED")
        .map(|v| v == "1" || v.eq_ignore_ascii_case("true"))
        .unwrap_or(false)
    {
        info!("[BusScheduleGen] Désactivé (BUS_SCHEDULE_GENERATOR_DISABLED=1)");
        return;
    }

    tokio::spawn(async move {
        info!(
            "[BusScheduleGen] Démarrage — génération automatique toutes les {} heures, {} jours à l'avance",
            GENERATION_INTERVAL_SECS / 3600,
            DAYS_AHEAD
        );

        // Exécuter immédiatement au démarrage
        run_generation(&state).await;

        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(
            GENERATION_INTERVAL_SECS,
        ));
        interval.tick().await; // consommer le premier tick immédiat

        loop {
            interval.tick().await;
            run_generation(&state).await;
        }
    });
}

/// Exécute une passe de génération pour toutes les agences actives.
async fn run_generation(state: &Arc<AppState>) {
    info!("[BusScheduleGen] Lancement génération produits ({} jours)", DAYS_AHEAD);

    // Récupérer toutes les agences actives ayant des horaires
    let agencies = match sqlx::query(
        r#"
        SELECT DISTINCT
            av.id       AS agency_id,
            av.user_id  AS agency_user_id,
            av.service_id
        FROM agences_voyage av
        JOIN agency_departure_schedules ads
            ON ads.agency_user_id = av.user_id
           AND ads.is_active = TRUE
        WHERE av.is_active = TRUE
        "#,
    )
    .fetch_all(&state.pg)
    .await
    {
        Ok(rows) => rows,
        Err(e) => {
            error!("[BusScheduleGen] Erreur récupération agences: {}", e);
            return;
        }
    };

    if agencies.is_empty() {
        info!("[BusScheduleGen] Aucune agence avec horaires actifs.");
        return;
    }

    let mut total_generated: i32 = 0;
    let mut total_skipped: i32 = 0;
    let mut errors: u32 = 0;

    for row in &agencies {
        let agency_user_id: i32 = row.get("agency_user_id");

        match generate_for_agency(state, agency_user_id).await {
            Ok((generated, skipped)) => {
                total_generated += generated;
                total_skipped += skipped;
            }
            Err(e) => {
                errors += 1;
                warn!(
                    "[BusScheduleGen] Erreur agence user_id={}: {}",
                    agency_user_id, e
                );
            }
        }
    }

    info!(
        "[BusScheduleGen] Terminé — {} agences traitées, {} produits créés, {} ignorés (déjà existants), {} erreurs",
        agencies.len(),
        total_generated,
        total_skipped,
        errors
    );
}

/// Génère les produits datés pour une agence spécifique.
/// Réutilise la logique de bus_ticket_controller::generate_products_from_schedules
/// mais directement en SQL pour éviter la dépendance circulaire.
async fn generate_for_agency(
    state: &Arc<AppState>,
    agency_user_id: i32,
) -> Result<(i32, i32), String> {
    // Récupérer l'agence et son premier produit modèle
    let agency_info = sqlx::query(
        r#"
        SELECT
            av.id          AS agency_id,
            av.service_id,
            (
                SELECT p.id::text
                FROM products p
                WHERE p.service_id = av.service_id
                  AND p.type = 'ticket_voyage'
                  AND p.seat_map IS NOT NULL
                  AND p.total_seats IS NOT NULL
                ORDER BY p.created_at DESC
                LIMIT 1
            ) AS template_product_id
        FROM agences_voyage av
        WHERE av.user_id = $1 AND av.is_active = TRUE
        LIMIT 1
        "#,
    )
    .bind(agency_user_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| format!("Erreur récupération agence: {}", e))?;

    let agency_info = match agency_info {
        Some(r) => r,
        None => return Ok((0, 0)),
    };

    let template_id: Option<String> = agency_info.get("template_product_id");
    let template_id = match template_id {
        Some(id) => id,
        None => {
            // Pas de produit modèle → rien à générer pour cette agence
            return Ok((0, 0));
        }
    };

    // Récupérer les infos du produit modèle
    let template = sqlx::query(
        r#"
        SELECT
            p.id::text,
            p.service_id,
            p.seat_map,
            p.bus_configuration,
            p.total_seats,
            p.price_cents,
            p.currency,
            p.metadata,
            p.numero_bus,
            p.caution_reservation
        FROM products p
        WHERE p.id::text = $1 AND p.type = 'ticket_voyage'
        "#,
    )
    .bind(&template_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| format!("Erreur template: {}", e))?;

    let template = match template {
        Some(t) => t,
        None => return Ok((0, 0)),
    };

    let service_id: i32 = template.get("service_id");

    // Récupérer les horaires actifs de cette agence
    let schedules = sqlx::query(
        r#"
        SELECT
            ads.id::text AS sid,
            ads.departure_city,
            ads.arrival_city,
            ads.day_of_week,
            (SELECT string_agg(to_char(x, 'HH24:MI'), ',' ORDER BY x)
             FROM unnest(ads.departure_times) AS x) AS times_str
        FROM agency_departure_schedules ads
        WHERE ads.agency_user_id = $1 AND ads.is_active = TRUE
        ORDER BY ads.departure_city, ads.arrival_city, ads.day_of_week NULLS FIRST
        "#,
    )
    .bind(agency_user_id)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| format!("Erreur horaires: {}", e))?;

    let today = chrono::Utc::now().date_naive();
    let mut generated: i32 = 0;
    let mut skipped: i32 = 0;

    let tpl_seat_map: Option<serde_json::Value> = template.get("seat_map");
    let tpl_bus_config: Option<serde_json::Value> = template.get("bus_configuration");
    let tpl_total_seats: Option<i32> = template.get("total_seats");
    let tpl_price_cents: Option<i64> = template.get("price_cents");
    let tpl_currency: Option<String> = template.get("currency");
    let tpl_numero_bus: Option<String> = template.get("numero_bus");
    let tpl_caution: Option<i32> = template.get("caution_reservation");
    let tpl_metadata: Option<serde_json::Value> = template.get("metadata");

    for sched in &schedules {
        let schedule_id: String = sched.get("sid");
        let dep_city: String = sched.get("departure_city");
        let arr_city: String = sched.get("arrival_city");
        let day_filter: Option<i32> = sched.get("day_of_week");
        let times_str: Option<String> = sched.get("times_str");

        let times_str = times_str.unwrap_or_default();
        if times_str.is_empty() {
            continue;
        }

        // Itérer sur les N prochains jours
        for day_offset in 0..DAYS_AHEAD {
            let date = today + chrono::Duration::days(day_offset as i64);
            let pg_dow = naive_date_to_pg_dow(date);

            // Filtrer par jour de la semaine si spécifié
            if let Some(filter) = day_filter {
                if filter != pg_dow {
                    continue;
                }
            }

            // Pour chaque horaire de départ ce jour-là
            for time_str in times_str.split(',') {
                let time_str = time_str.trim();
                let Ok(naive_time) = chrono::NaiveTime::parse_from_str(time_str, "%H:%M") else {
                    continue;
                };

                let naive_dt = date.and_time(naive_time);
                let departure_dt = chrono::DateTime::<chrono::Utc>::from_naive_utc_and_offset(
                    naive_dt,
                    chrono::Utc,
                );

                // Ne pas créer de produit dans le passé (ni dans les 2h)
                if departure_dt <= chrono::Utc::now() + chrono::Duration::hours(2) {
                    continue;
                }

                // Insérer le produit daté (ON CONFLICT = ignorer si déjà existant)
                let result = sqlx::query_scalar::<_, Option<String>>(
                    r#"
                    INSERT INTO products (
                        service_id,
                        name,
                        type,
                        seat_map,
                        bus_configuration,
                        total_seats,
                        price_cents,
                        currency,
                        metadata,
                        numero_bus,
                        caution_reservation,
                        depart,
                        destination,
                        date_depart,
                        source_schedule_id,
                        is_active,
                        created_at,
                        updated_at
                    )
                    VALUES (
                        $1, $2, 'ticket_voyage', $3, $4, $5, $6, $7,
                        $8, $9, $10, $11, $12, $13, $14, TRUE, NOW(), NOW()
                    )
                    ON CONFLICT (source_schedule_id, date_depart) DO NOTHING
                    RETURNING id::text
                    "#,
                )
                .bind(service_id)
                .bind(format!("{} → {} {}", dep_city, arr_city, date.format("%d/%m/%Y")))
                .bind(&tpl_seat_map)
                .bind(&tpl_bus_config)
                .bind(tpl_total_seats)
                .bind(tpl_price_cents)
                .bind(tpl_currency.as_deref().unwrap_or("XAF"))
                .bind(&tpl_metadata)
                .bind(&tpl_numero_bus)
                .bind(tpl_caution)
                .bind(&dep_city)
                .bind(&arr_city)
                .bind(departure_dt)
                .bind(&schedule_id)
                .fetch_optional(&state.pg)
                .await
                .map_err(|e| format!("Erreur INSERT produit: {}", e))?;

                match result {
                    Some(_) => generated += 1,
                    None    => skipped += 1,
                }
            }
        }
    }

    Ok((generated, skipped))
}

/// Convertit une NaiveDate en numéro de jour PostgreSQL (0=Dimanche ... 6=Samedi)
fn naive_date_to_pg_dow(d: chrono::NaiveDate) -> i32 {
    match d.weekday() {
        chrono::Weekday::Sun => 0,
        chrono::Weekday::Mon => 1,
        chrono::Weekday::Tue => 2,
        chrono::Weekday::Wed => 3,
        chrono::Weekday::Thu => 4,
        chrono::Weekday::Fri => 5,
        chrono::Weekday::Sat => 6,
    }
}
