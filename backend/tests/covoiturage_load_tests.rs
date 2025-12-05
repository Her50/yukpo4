// ✅ Tests de charge pour endpoints covoiturage
// Date: 2025-01-29
// Pour exécuter: cargo test --test covoiturage_load_tests --release -- --ignored

use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::time::sleep;

use yukpomnang_backend::state::AppState;

// Configuration
const CONCURRENT_USERS: usize = 100;
const REQUESTS_PER_USER: usize = 10;
const TARGET_RPS: usize = 1000; // Requêtes par seconde

async fn setup_test_state() -> Arc<AppState> {
    let database_url = std::env::var("TEST_DATABASE_URL")
        .unwrap_or_else(|_| "postgresql://test:test@localhost:5432/yukpomnang_test".to_string());
    let redis_url =
        std::env::var("TEST_REDIS_URL").unwrap_or_else(|_| "redis://localhost:6379/1".to_string());

    let pg = sqlx::PgPool::connect(&database_url)
        .await
        .expect("Failed to connect to test database");

    let redis_client =
        redis::Client::open(redis_url.as_str()).expect("Failed to create Redis client");

    let redis_pool =
        deadpool_redis::Pool::builder(deadpool_redis::Config::from_url(redis_url.clone()))
            .build()
            .expect("Failed to create Redis pool");

    Arc::new(AppState {
        pg,
        redis_client,
        redis_pool: Some(redis_pool),
        mongodb: None,
        database_url,
        redis_url: Some(redis_url),
    })
}

#[tokio::test]
#[ignore]
async fn test_load_search_endpoint() {
    let state = setup_test_state().await;
    let pool = &state.pg;

    println!("🚀 Test de charge: Recherche covoiturages");
    println!("   - Utilisateurs concurrents: {}", CONCURRENT_USERS);
    println!("   - Requêtes par utilisateur: {}", REQUESTS_PER_USER);
    println!(
        "   - Total requêtes: {}",
        CONCURRENT_USERS * REQUESTS_PER_USER
    );

    let start = Instant::now();
    let mut handles = Vec::new();
    let mut success_count = 0u64;
    let mut error_count = 0u64;
    let mut durations = Vec::new();

    // Simuler requêtes concurrentes
    for user_id in 0..CONCURRENT_USERS {
        let pool_clone = pool.clone();

        let handle = tokio::spawn(async move {
            let mut user_success = 0u64;
            let mut user_errors = 0u64;
            let mut user_durations = Vec::new();

            for _req in 0..REQUESTS_PER_USER {
                let req_start = Instant::now();

                let result = sqlx::query_scalar::<_, i32>(
                    r#"
                    SELECT COUNT(*)::int
                    FROM covoiturages c
                    INNER JOIN services s ON s.id = c.service_id
                    WHERE s.is_active = true
                    AND c.is_active = true
                    AND c.statut = 'ouvert'
                    AND c.places_disponibles > 0
                    LIMIT 100
                    "#,
                )
                .fetch_one(&pool_clone)
                .await;

                let duration = req_start.elapsed();
                user_durations.push(duration);

                if result.is_ok() {
                    user_success += 1;
                } else {
                    user_errors += 1;
                }

                // Petit délai pour simuler comportement réel
                sleep(Duration::from_millis(10)).await;
            }

            (user_success, user_errors, user_durations)
        });

        handles.push(handle);
    }

    // Collecter résultats
    for handle in handles {
        let (success, errors, durations_user) = handle.await.unwrap();
        success_count += success;
        error_count += errors;
        durations.extend(durations_user);
    }

    let total_duration = start.elapsed();
    let total_requests = success_count + error_count;
    let rps = total_requests as f64 / total_duration.as_secs_f64();

    // Calculer statistiques
    durations.sort();
    let p50 = durations[durations.len() / 2];
    let p95 = durations[durations.len() * 95 / 100];
    let p99 = durations[durations.len() * 99 / 100];
    let avg = durations.iter().sum::<Duration>() / durations.len() as u32;
    let min = durations.first().copied().unwrap_or_default();
    let max = durations.last().copied().unwrap_or_default();

    println!("\n📊 Résultats:");
    println!(
        "   ✅ Succès: {} ({:.2}%)",
        success_count,
        (success_count as f64 / total_requests as f64) * 100.0
    );
    println!(
        "   ❌ Erreurs: {} ({:.2}%)",
        error_count,
        (error_count as f64 / total_requests as f64) * 100.0
    );
    println!("   ⏱️  Durée totale: {:?}", total_duration);
    println!("   📈 RPS: {:.2}", rps);
    println!("\n📈 Latence:");
    println!("   - Min: {:?}", min);
    println!("   - P50: {:?}", p50);
    println!("   - P95: {:?}", p95);
    println!("   - P99: {:?}", p99);
    println!("   - Max: {:?}", max);
    println!("   - Moyenne: {:?}", avg);

    // Vérifications
    let success_rate = (success_count as f64 / total_requests as f64) * 100.0;
    assert!(
        success_rate >= 99.0,
        "Taux de succès doit être >= 99%, actuel: {:.2}%",
        success_rate
    );

    assert!(
        p95.as_millis() < 500,
        "P95 doit être < 500ms, actuel: {:?}",
        p95
    );

    assert!(
        rps >= TARGET_RPS as f64 * 0.8,
        "RPS doit être >= {} (80% de {}), actuel: {:.2}",
        TARGET_RPS * 80 / 100,
        TARGET_RPS,
        rps
    );

    println!("\n✅ Test de charge: PASSÉ");
}

#[tokio::test]
#[ignore]
async fn test_stress_reservations() {
    let state = setup_test_state().await;
    let pool = &state.pg;

    println!("🚀 Test de stress: Réservations concurrentes");

    // Créer trajet de test
    let user_id: i32 = sqlx::query_scalar(
        r#"
        INSERT INTO users (email, password_hash, nom_complet, role, is_verified, created_at)
        VALUES ('stress_test@example.com', '$2b$10$test', 'Stress Test', 'user', true, NOW())
        ON CONFLICT (email) DO UPDATE SET nom_complet = EXCLUDED.nom_complet
        RETURNING id
        "#,
    )
    .fetch_one(pool)
    .await
    .expect("Failed to create test user");

    let service_id: i32 = sqlx::query_scalar(
        r#"
        INSERT INTO services (user_id, type, titre, description, is_active, created_at)
        VALUES ($1, 'covoiturage', 'Stress Test', 'Description', true, NOW())
        RETURNING id
        "#,
    )
    .bind(user_id)
    .fetch_one(pool)
    .await
    .expect("Failed to create service");

    let covoiturage_id: i32 = sqlx::query_scalar(
        r#"
        INSERT INTO covoiturages (
            service_id, user_id, depart, destination, gps_depart, gps_destination,
            date_depart, heure_depart, nombre_places, places_disponibles,
            prix_par_place, devise, statut, is_active, created_at
        )
        VALUES ($1, $2, 'Yaoundé', 'Douala', '3.8480,11.5021', '4.0511,9.7679',
                CURRENT_DATE + INTERVAL '1 day', '08:00', 10, 10, 5000, 'XAF', 'ouvert', true, NOW())
        RETURNING id
        "#
    )
    .bind(service_id)
    .bind(user_id)
    .fetch_one(pool)
    .await
    .expect("Failed to create covoiturage");

    // Créer 20 passagers pour 10 places (test race condition)
    let mut passenger_ids = Vec::new();
    for i in 0..20 {
        let email = format!("stress_passenger_{}@example.com", i);
        let pid: i32 = sqlx::query_scalar(
            r#"
            INSERT INTO users (email, password_hash, nom_complet, role, is_verified, created_at)
            VALUES ($1, '$2b$10$test', $2, 'user', true, NOW())
            ON CONFLICT (email) DO UPDATE SET nom_complet = EXCLUDED.nom_complet
            RETURNING id
            "#,
        )
        .bind(&email)
        .bind(format!("Passenger {}", i))
        .fetch_one(pool)
        .await
        .expect("Failed to create passenger");

        passenger_ids.push(pid);
    }

    println!("   - Trajet ID: {}", covoiturage_id);
    println!("   - Places disponibles: 10");
    println!("   - Tentatives concurrentes: 20");

    let start = Instant::now();
    let mut handles = Vec::new();

    // Tentatives concurrentes
    for passenger_id in passenger_ids {
        let pool_clone = pool.clone();
        let sid = service_id;
        let cid = covoiturage_id;
        let pid = passenger_id;

        let handle = tokio::spawn(async move {
            let mut tx = pool_clone
                .begin()
                .await
                .expect("Failed to begin transaction");

            // SELECT FOR UPDATE
            let places: Option<i32> = sqlx::query_scalar(
                "SELECT places_disponibles FROM covoiturages WHERE id = $1 FOR UPDATE",
            )
            .bind(cid)
            .fetch_optional(&mut *tx)
            .await
            .ok()
            .flatten();

            if let Some(places_avail) = places {
                if places_avail > 0 {
                    // Créer réservation
                    let _reservation_id: Option<i32> = sqlx::query_scalar(
                        r#"
                        INSERT INTO reservations (service_id, user_id, nombre_places, statut, created_at)
                        VALUES ($1, $2, 1, 'pending', NOW())
                        RETURNING id
                        "#
                    )
                    .bind(sid)
                    .bind(pid)
                    .fetch_optional(&mut *tx)
                    .await
                    .ok()
                    .flatten();

                    // Décrémenter
                    sqlx::query(
                        "UPDATE covoiturages SET places_disponibles = places_disponibles - 1 WHERE id = $1"
                    )
                    .bind(cid)
                    .execute(&mut *tx)
                    .await
                    .ok();

                    tx.commit().await.ok();
                    Ok(())
                } else {
                    tx.rollback().await.ok();
                    Err("No places")
                }
            } else {
                tx.rollback().await.ok();
                Err("Covoiturage not found")
            }
        });

        handles.push(handle);
    }

    let mut success = 0;
    let mut failed = 0;

    for handle in handles {
        match handle.await {
            Ok(Ok(_)) => success += 1,
            _ => failed += 1,
        }
    }

    let duration = start.elapsed();

    // Vérifier places finales
    let final_places: i32 =
        sqlx::query_scalar("SELECT places_disponibles FROM covoiturages WHERE id = $1")
            .bind(covoiturage_id)
            .fetch_one(pool)
            .await
            .expect("Failed to check final places");

    println!("\n📊 Résultats:");
    println!("   ✅ Réservations réussies: {}", success);
    println!("   ❌ Réservations échouées: {}", failed);
    println!("   📍 Places finales: {}", final_places);
    println!("   ⏱️  Durée: {:?}", duration);

    // Vérifications
    assert_eq!(success, 10, "Exactement 10 réservations doivent réussir");
    assert_eq!(final_places, 0, "Places disponibles doivent être 0");
    assert_eq!(failed, 10, "10 tentatives doivent échouer (pas de places)");

    // Nettoyage
    sqlx::query("DELETE FROM reservations WHERE service_id = $1")
        .bind(service_id)
        .execute(pool)
        .await
        .ok();

    sqlx::query("DELETE FROM covoiturages WHERE id = $1")
        .bind(covoiturage_id)
        .execute(pool)
        .await
        .ok();

    sqlx::query("DELETE FROM services WHERE id = $1")
        .bind(service_id)
        .execute(pool)
        .await
        .ok();

    sqlx::query("DELETE FROM users WHERE email LIKE 'stress_%@example.com'")
        .execute(pool)
        .await
        .ok();

    println!("\n✅ Test de stress: PASSÉ");
}

#[tokio::test]
#[ignore]
async fn test_cache_performance() {
    let state = setup_test_state().await;

    if let Some(ref redis_pool) = state.redis_pool {
        println!("🚀 Test performance cache Redis");

        let mut conn = redis_pool
            .get()
            .await
            .expect("Failed to get Redis connection");

        let cache_key = "covoiturage:search:test";
        let cache_value = r#"{"results":[],"total":0}"#;

        // Test SET
        let start = Instant::now();
        for i in 0..1000 {
            let key = format!("{}:{}", cache_key, i);
            redis::cmd("SET")
                .arg(&key)
                .arg(cache_value)
                .arg("EX")
                .arg(300)
                .query_async::<_, ()>(&mut *conn)
                .await
                .expect("Failed to set cache");
        }
        let set_duration = start.elapsed();

        // Test GET
        let start = Instant::now();
        for i in 0..1000 {
            let key = format!("{}:{}", cache_key, i);
            let _: Option<String> = redis::cmd("GET")
                .arg(&key)
                .query_async(&mut *conn)
                .await
                .expect("Failed to get cache");
        }
        let get_duration = start.elapsed();

        println!("\n📊 Résultats:");
        println!(
            "   - 1000 SET: {:?} ({} ops/s)",
            set_duration,
            1000.0 / set_duration.as_secs_f64()
        );
        println!(
            "   - 1000 GET: {:?} ({} ops/s)",
            get_duration,
            1000.0 / get_duration.as_secs_f64()
        );

        // Nettoyer
        for i in 0..1000 {
            let key = format!("{}:{}", cache_key, i);
            redis::cmd("DEL")
                .arg(&key)
                .query_async::<_, ()>(&mut *conn)
                .await
                .ok();
        }

        assert!(set_duration.as_millis() < 5000, "SET doit être rapide");
        assert!(get_duration.as_millis() < 5000, "GET doit être rapide");

        println!("\n✅ Test cache: PASSÉ");
    } else {
        println!("⚠️ Test cache: SKIP (Redis non configuré)");
    }
}
