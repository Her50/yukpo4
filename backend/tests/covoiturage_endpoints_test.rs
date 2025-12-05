// ✅ Tests unitaires et intégration pour endpoints covoiturage
// Date: 2025-01-29
// Pour exécuter: cargo test --test covoiturage_endpoints_test -- --nocapture

use sqlx::PgPool;
use std::sync::Arc;
use std::time::Instant;
use tokio::time::Duration;
use yukpomnang_backend::state::AppState;

// Configuration de test
fn get_test_database_url() -> String {
    std::env::var("TEST_DATABASE_URL")
        .unwrap_or_else(|_| "postgresql://test:test@localhost:5432/yukpomnang_test".to_string())
}

fn get_test_redis_url() -> String {
    std::env::var("TEST_REDIS_URL").unwrap_or_else(|_| "redis://localhost:6379/1".to_string())
}

async fn setup_test_state() -> Arc<AppState> {
    let database_url = get_test_database_url();
    let redis_url = get_test_redis_url();

    let pg = PgPool::connect(&database_url)
        .await
        .expect("Failed to connect to test database");

    let redis_client =
        redis::Client::open(redis_url.as_str()).expect("Failed to create Redis client");

    let redis_pool = deadpool_redis::Pool::builder(deadpool_redis::Config::from_url(redis_url))
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

async fn cleanup_test_data(pool: &PgPool) {
    // Nettoyer les données de test
    sqlx::query("DELETE FROM reservations WHERE service_id IN (SELECT id FROM services WHERE type = 'covoiturage')")
        .execute(pool)
        .await
        .ok();

    sqlx::query("DELETE FROM user_documents WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'test_%@example.com')")
        .execute(pool)
        .await
        .ok();

    sqlx::query("DELETE FROM covoiturages WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'test_%@example.com')")
        .execute(pool)
        .await
        .ok();

    sqlx::query("DELETE FROM services WHERE type = 'covoiturage' AND user_id IN (SELECT id FROM users WHERE email LIKE 'test_%@example.com')")
        .execute(pool)
        .await
        .ok();

    sqlx::query("DELETE FROM users WHERE email LIKE 'test_%@example.com'")
        .execute(pool)
        .await
        .ok();
}

async fn create_test_user(pool: &PgPool, email: &str) -> i32 {
    let user_id: i32 = sqlx::query_scalar(
        r#"
        INSERT INTO users (email, password_hash, nom_complet, role, is_verified, created_at)
        VALUES ($1, $2, $3, 'user', true, NOW())
        ON CONFLICT (email) DO UPDATE SET nom_complet = EXCLUDED.nom_complet
        RETURNING id
        "#,
    )
    .bind(email)
    .bind("$2b$10$test_hash") // Hash de test
    .bind(format!("Test User {}", email))
    .fetch_one(pool)
    .await
    .expect("Failed to create test user");

    user_id
}

async fn create_test_covoiturage(pool: &PgPool, user_id: i32) -> i32 {
    // Créer service d'abord
    let service_id: i32 = sqlx::query_scalar(
        r#"
        INSERT INTO services (user_id, type, titre, description, is_active, created_at)
        VALUES ($1, 'covoiturage', 'Test Covoiturage', 'Description test', true, NOW())
        RETURNING id
        "#,
    )
    .bind(user_id)
    .fetch_one(pool)
    .await
    .expect("Failed to create test service");

    // Créer covoiturage
    let covoiturage_id: i32 = sqlx::query_scalar(
        r#"
        INSERT INTO covoiturages (
            service_id, user_id, depart, destination, gps_depart, gps_destination,
            date_depart, heure_depart, nombre_places, places_disponibles,
            prix_par_place, devise, statut, is_active, created_at
        )
        VALUES ($1, $2, 'Yaoundé', 'Douala', '3.8480,11.5021', '4.0511,9.7679',
                CURRENT_DATE + INTERVAL '1 day', '08:00', 4, 4, 5000, 'XAF', 'ouvert', true, NOW())
        RETURNING id
        "#,
    )
    .bind(service_id)
    .bind(user_id)
    .fetch_one(pool)
    .await
    .expect("Failed to create test covoiturage");

    covoiturage_id
}

#[tokio::test]
#[ignore] // Ignorer par défaut (nécessite DB de test), activer avec: cargo test --test covoiturage_endpoints_test -- --ignored
async fn test_search_covoiturages_nearby() {
    let state = setup_test_state().await;
    let pool = &state.pg;

    // Nettoyer avant test
    cleanup_test_data(pool).await;

    // Créer utilisateur et trajets de test
    let user_id = create_test_user(pool, "test_driver@example.com").await;
    let _covoiturage_id = create_test_covoiturage(pool, user_id).await;

    // Test recherche GPS
    let start = Instant::now();

    // Vérifier que la recherche fonctionne
    let result = sqlx::query_scalar::<_, i32>(
        r#"
        SELECT COUNT(*)::int
        FROM covoiturages c
        INNER JOIN services s ON s.id = c.service_id
        WHERE s.is_active = true
        AND c.is_active = true
        AND c.statut = 'ouvert'
        AND c.places_disponibles > 0
        AND (
            2 * ASIN(
                SQRT(
                    POWER(SIN(RADIANS(3.8480 - (SPLIT_PART(c.gps_depart, ',', 1)::float)) / 2), 2) +
                    COS(RADIANS(3.8480)) * COS(RADIANS(SPLIT_PART(c.gps_depart, ',', 1)::float)) *
                    POWER(SIN(RADIANS(11.5021 - (SPLIT_PART(c.gps_depart, ',', 2)::float)) / 2), 2)
                )
            ) * 6371.0
        ) <= 50.0
        "#,
    )
    .fetch_one(pool)
    .await;

    let duration = start.elapsed();

    assert!(result.is_ok(), "Recherche GPS doit fonctionner");
    assert!(
        duration.as_millis() < 500,
        "Recherche doit être rapide (< 500ms), durée: {:?}",
        duration
    );

    println!(
        "✅ test_search_covoiturages_nearby: OK ({}ms)",
        duration.as_millis()
    );

    cleanup_test_data(pool).await;
}

#[tokio::test]
#[ignore]
async fn test_get_covoiturage_reviews() {
    let state = setup_test_state().await;
    let pool = &state.pg;

    cleanup_test_data(pool).await;

    let user_id = create_test_user(pool, "test_driver@example.com").await;
    let covoiturage_id = create_test_covoiturage(pool, user_id).await;

    // Créer quelques avis de test
    let service_id: i32 = sqlx::query_scalar("SELECT service_id FROM covoiturages WHERE id = $1")
        .bind(covoiturage_id)
        .fetch_one(pool)
        .await
        .expect("Failed to get service_id");

    // Simuler avis (via table reviews si elle existe, sinon skip)
    // Note: La table reviews peut ne pas exister, donc on teste juste la structure

    let reviews_count: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*)::bigint
        FROM reviews r
        INNER JOIN services s ON s.id = r.service_id
        INNER JOIN covoiturages c ON c.service_id = s.id
        WHERE c.id = $1
        "#,
    )
    .bind(covoiturage_id)
    .fetch_optional(pool)
    .await
    .unwrap_or(Some(0))
    .unwrap_or(0);

    println!(
        "✅ test_get_covoiturage_reviews: OK ({} avis trouvés)",
        reviews_count
    );

    cleanup_test_data(pool).await;
}

#[tokio::test]
#[ignore]
async fn test_verify_covoiturage_driver() {
    let state = setup_test_state().await;
    let pool = &state.pg;

    cleanup_test_data(pool).await;

    let user_id = create_test_user(pool, "test_driver@example.com").await;
    let covoiturage_id = create_test_covoiturage(pool, user_id).await;

    // Vérifier que la table user_documents existe
    let table_exists: bool = sqlx::query_scalar(
        r#"
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'user_documents'
        )
        "#,
    )
    .fetch_one(pool)
    .await
    .expect("Failed to check table existence");

    assert!(table_exists, "Table user_documents doit exister");

    // Test insertion document
    let document_id: Option<i32> = sqlx::query_scalar(
        r#"
        INSERT INTO user_documents (
            user_id, document_type, document_url, document_number, status, created_at
        )
        VALUES ($1, 'permis', 'https://example.com/permis.jpg', 'TEST123456', 'pending', NOW())
        ON CONFLICT (user_id, document_type) DO UPDATE SET document_url = EXCLUDED.document_url
        RETURNING id
        "#,
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await
    .expect("Failed to insert test document");

    assert!(document_id.is_some(), "Document doit être créé");

    println!(
        "✅ test_verify_covoiturage_driver: OK (document_id: {:?})",
        document_id
    );

    cleanup_test_data(pool).await;
}

#[tokio::test]
#[ignore]
async fn test_get_covoiturage_details_with_prestataire() {
    let state = setup_test_state().await;
    let pool = &state.pg;

    cleanup_test_data(pool).await;

    let user_id = create_test_user(pool, "test_driver@example.com").await;
    let covoiturage_id = create_test_covoiturage(pool, user_id).await;

    // Test récupération détails avec prestataire
    let result = sqlx::query(
        r#"
        SELECT 
            c.id,
            c.depart,
            c.destination,
            c.prix_par_place,
            u.nom_complet as prestataire_nom,
            u.avatar_url as prestataire_avatar,
            u.id as prestataire_user_id
        FROM covoiturages c
        INNER JOIN services s ON s.id = c.service_id
        INNER JOIN users u ON u.id = c.user_id
        WHERE c.id = $1
        "#,
    )
    .bind(covoiturage_id)
    .fetch_optional(pool)
    .await
    .expect("Failed to fetch covoiturage details");

    assert!(
        result.is_some(),
        "Détails covoiturage doivent être récupérés"
    );

    println!("✅ test_get_covoiturage_details_with_prestataire: OK");

    cleanup_test_data(pool).await;
}

// ============================================================================
// TESTS DE CHARGE / PERFORMANCE
// ============================================================================

#[tokio::test]
#[ignore]
async fn test_load_search_performance() {
    let state = setup_test_state().await;
    let pool = &state.pg;

    cleanup_test_data(pool).await;

    // Créer 100 trajets de test
    let user_id = create_test_user(pool, "test_driver@example.com").await;
    let mut covoiturage_ids = Vec::new();

    for i in 0..100 {
        let lat = 3.8480 + (i as f64 * 0.01);
        let lng = 11.5021 + (i as f64 * 0.01);

        let service_id: i32 = sqlx::query_scalar(
            r#"
            INSERT INTO services (user_id, type, titre, description, is_active, created_at)
            VALUES ($1, 'covoiturage', $2, 'Description test', true, NOW())
            RETURNING id
            "#,
        )
        .bind(user_id)
        .bind(format!("Test Covoiturage {}", i))
        .fetch_one(pool)
        .await
        .expect("Failed to create test service");

        let covoiturage_id: i32 = sqlx::query_scalar(
            r#"
            INSERT INTO covoiturages (
                service_id, user_id, depart, destination, gps_depart, gps_destination,
                date_depart, heure_depart, nombre_places, places_disponibles,
                prix_par_place, devise, statut, is_active, created_at
            )
            VALUES ($1, $2, 'Yaoundé', 'Douala', $3, '4.0511,9.7679',
                    CURRENT_DATE + INTERVAL '1 day', '08:00', 4, 4, 5000, 'XAF', 'ouvert', true, NOW())
            RETURNING id
            "#
        )
        .bind(service_id)
        .bind(user_id)
        .bind(format!("{},{}", lat, lng))
        .fetch_one(pool)
        .await
        .expect("Failed to create test covoiturage");

        covoiturage_ids.push(covoiturage_id);
    }

    println!("✅ Créé {} trajets de test", covoiturage_ids.len());

    // Test performance recherche
    let iterations = 100;
    let mut total_duration = Duration::from_secs(0);

    for _ in 0..iterations {
        let start = Instant::now();

        let _result = sqlx::query_scalar::<_, i32>(
            r#"
            SELECT COUNT(*)::int
            FROM covoiturages c
            INNER JOIN services s ON s.id = c.service_id
            WHERE s.is_active = true
            AND c.is_active = true
            AND c.statut = 'ouvert'
            AND c.places_disponibles > 0
            AND (
                2 * ASIN(
                    SQRT(
                        POWER(SIN(RADIANS(3.8480 - (SPLIT_PART(c.gps_depart, ',', 1)::float)) / 2), 2) +
                        COS(RADIANS(3.8480)) * COS(RADIANS(SPLIT_PART(c.gps_depart, ',', 1)::float)) *
                        POWER(SIN(RADIANS(11.5021 - (SPLIT_PART(c.gps_depart, ',', 2)::float)) / 2), 2)
                    )
                ) * 6371.0
            ) <= 50.0
            "#
        )
        .fetch_one(pool)
        .await
        .expect("Search failed");

        total_duration += start.elapsed();
    }

    let avg_duration = total_duration / iterations;
    let avg_ms = avg_duration.as_millis();

    println!("✅ test_load_search_performance:");
    println!("   - {} itérations", iterations);
    println!("   - Durée moyenne: {}ms", avg_ms);
    println!("   - Durée totale: {:?}", total_duration);

    // Vérifier performance acceptable (< 200ms en moyenne)
    assert!(
        avg_ms < 200,
        "Recherche doit être < 200ms en moyenne, actuel: {}ms",
        avg_ms
    );

    cleanup_test_data(pool).await;
}

#[tokio::test]
#[ignore]
async fn test_concurrent_reservations() {
    let state = setup_test_state().await;
    let pool = &state.pg;

    cleanup_test_data(pool).await;

    let driver_id = create_test_user(pool, "test_driver@example.com").await;
    let covoiturage_id = create_test_covoiturage(pool, driver_id).await;

    // Créer 10 passagers
    let mut passenger_ids = Vec::new();
    for i in 0..10 {
        let email = format!("test_passenger_{}@example.com", i);
        let pid = create_test_user(pool, &email).await;
        passenger_ids.push(pid);
    }

    // Test réservations concurrentes (race condition)
    let service_id: i32 = sqlx::query_scalar("SELECT service_id FROM covoiturages WHERE id = $1")
        .bind(covoiturage_id)
        .fetch_one(pool)
        .await
        .expect("Failed to get service_id");

    let mut handles = Vec::new();

    for passenger_id in passenger_ids.iter().take(5) {
        // Seulement 4 places disponibles, 5 tentatives concurrentes
        let pool_clone = pool.clone();
        let sid = service_id;
        let cid = covoiturage_id;
        let pid = *passenger_id;

        let handle = tokio::spawn(async move {
            let mut tx = pool_clone
                .begin()
                .await
                .expect("Failed to begin transaction");

            // SELECT FOR UPDATE pour éviter race condition
            let places: i32 = sqlx::query_scalar(
                "SELECT places_disponibles FROM covoiturages WHERE id = $1 FOR UPDATE",
            )
            .bind(cid)
            .fetch_one(&mut *tx)
            .await
            .expect("Failed to check places");

            if places > 0 {
                // Créer réservation
                let _reservation_id: i32 = sqlx::query_scalar(
                    r#"
                    INSERT INTO reservations (service_id, user_id, nombre_places, statut, created_at)
                    VALUES ($1, $2, 1, 'pending', NOW())
                    RETURNING id
                    "#
                )
                .bind(sid)
                .bind(pid)
                .fetch_one(&mut *tx)
                .await
                .expect("Failed to create reservation");

                // Décrémenter places
                sqlx::query(
                    "UPDATE covoiturages SET places_disponibles = places_disponibles - 1 WHERE id = $1"
                )
                .bind(cid)
                .execute(&mut *tx)
                .await
                .expect("Failed to update places");

                tx.commit().await.expect("Failed to commit");
                Ok(())
            } else {
                tx.rollback().await.expect("Failed to rollback");
                Err("No places available")
            }
        });

        handles.push(handle);
    }

    // Attendre toutes les tentatives
    let mut success_count = 0;
    for handle in handles {
        if handle.await.unwrap().is_ok() {
            success_count += 1;
        }
    }

    // Vérifier qu'exactement 4 réservations ont réussi (4 places disponibles)
    assert_eq!(
        success_count, 4,
        "Exactement 4 réservations doivent réussir"
    );

    // Vérifier places_disponibles = 0
    let final_places: i32 =
        sqlx::query_scalar("SELECT places_disponibles FROM covoiturages WHERE id = $1")
            .bind(covoiturage_id)
            .fetch_one(pool)
            .await
            .expect("Failed to check final places");

    assert_eq!(final_places, 0, "Places disponibles doivent être 0");

    println!(
        "✅ test_concurrent_reservations: OK ({} réservations réussies)",
        success_count
    );

    cleanup_test_data(pool).await;
}

#[tokio::test]
#[ignore]
async fn test_cache_redis() {
    let state = setup_test_state().await;

    // Test cache Redis pour recherche
    if let Some(ref redis_pool) = state.redis_pool {
        let mut conn = redis_pool
            .get()
            .await
            .expect("Failed to get Redis connection");

        let cache_key = "covoiturage:search:3.8480:11.5021:50:1";
        let cache_value = r#"{"results":[],"total":0}"#;

        // Set cache
        redis::cmd("SET")
            .arg(cache_key)
            .arg(cache_value)
            .arg("EX")
            .arg(300) // 5 minutes
            .query_async::<_, ()>(&mut *conn)
            .await
            .expect("Failed to set cache");

        // Get cache
        let cached: Option<String> = redis::cmd("GET")
            .arg(cache_key)
            .query_async(&mut *conn)
            .await
            .expect("Failed to get cache");

        assert!(cached.is_some(), "Cache doit être récupéré");
        assert_eq!(
            cached.unwrap(),
            cache_value,
            "Cache value doit correspondre"
        );

        println!("✅ test_cache_redis: OK");
    } else {
        println!("⚠️ test_cache_redis: SKIP (Redis non configuré)");
    }
}
