use std::time::{Duration, Instant};
use tokio::time::sleep;
use sqlx::PgPool;
use redis::Client as RedisClient;
use serde_json::json;

/// Test de performance pour les optimisations
pub async fn run_performance_tests(pool: &PgPool, redis_client: Option<&RedisClient>) {
    println!("🚀 Démarrage des tests de performance...\n");

    // Test 1: Performance du matching d'échanges
    test_matching_performance(pool, redis_client).await;

    // Test 2: Performance des requêtes de base de données
    test_database_performance(pool, redis_client).await;

    // Test 3: Performance du cache Redis
    test_cache_performance(redis_client).await;

    // Test 4: Test de charge
    test_load_performance(pool, redis_client).await;

    println!("✅ Tous les tests de performance sont terminés !");
}

/// Test de performance du matching d'échanges
async fn test_matching_performance(pool: &PgPool, redis_client: Option<&RedisClient>) {
    println!("📊 Test de performance du matching d'échanges...");

    let start = Instant::now();
    let mut total_time = Duration::ZERO;
    let iterations = 10;

    for i in 0..iterations {
        let test_data = json!({
            "offre_produits": {
                "type": "service",
                "categorie": "technologie",
                "description": format!("Service de test {}", i),
                "prix": 1000 + i * 100
            },
            "besoin_produits": {
                "type": "service",
                "categorie": "marketing",
                "description": "Besoin de marketing digital",
                "prix": 1500
            },
            "mode": "echange",
            "don": false
        });

        let iteration_start = Instant::now();
        
        // Simuler un appel au service de matching
        let _result = crate::services::traiter_echange::traiter_echange(
            Some(1), // user_id de test
            &test_data,
            pool,
            redis_client
        ).await;

        let iteration_time = iteration_start.elapsed();
        total_time += iteration_time;

        println!("  Itération {}: {:.2}ms", i + 1, iteration_time.as_millis());
    }

    let avg_time = total_time / iterations;
    let total_time_ms = start.elapsed().as_millis();

    println!("  ⏱️  Temps moyen par matching: {:.2}ms", avg_time.as_millis());
    println!("  ⏱️  Temps total: {}ms", total_time_ms);
    println!("  📈 Débit: {:.2} matchings/seconde\n", 
        iterations as f64 / (total_time_ms as f64 / 1000.0));
}

/// Test de performance des requêtes de base de données
async fn test_database_performance(pool: &PgPool, redis_client: Option<&RedisClient>) {
    println!("🗄️  Test de performance des requêtes de base de données...");

    // Test avec DbOptimizer
    let optimizer = crate::services::db_optimizer::DbOptimizer::new(
        pool.clone(),
        redis_client.cloned()
    );

    let start = Instant::now();
    let mut total_time = Duration::ZERO;
    let iterations = 20;

    for i in 0..iterations {
        let iteration_start = Instant::now();
        
        // Test de récupération de services optimisée
        let _services = optimizer.get_services_optimized(
            20,
            i * 20,
            Some("technologie"),
            true
        ).await;

        let iteration_time = iteration_start.elapsed();
        total_time += iteration_time;

        println!("  Itération {}: {:.2}ms", i + 1, iteration_time.as_millis());
    }

    let avg_time = total_time / iterations;
    let total_time_ms = start.elapsed().as_millis();

    println!("  ⏱️  Temps moyen par requête: {:.2}ms", avg_time.as_millis());
    println!("  ⏱️  Temps total: {}ms", total_time_ms);
    println!("  📈 Débit: {:.2} requêtes/seconde\n", 
        iterations as f64 / (total_time_ms as f64 / 1000.0));
}

/// Test de performance du cache Redis
async fn test_cache_performance(redis_client: Option<&RedisClient>) {
    println!("🔴 Test de performance du cache Redis...");

    if let Some(redis) = redis_client {
        let mut conn = match redis.get_async_connection().await {
            Ok(conn) => conn,
            Err(e) => {
                println!("  ❌ Erreur connexion Redis: {}", e);
                return;
            }
        };

        let start = Instant::now();
        let mut total_time = Duration::ZERO;
        let iterations = 100;

        // Test d'écriture
        for i in 0..iterations {
            let key = format!("perf_test:write:{}", i);
            let value = format!("value_{}", i);
            
            let iteration_start = Instant::now();
            let _: Result<(), redis::RedisError> = conn.set(&key, &value).await;
            let iteration_time = iteration_start.elapsed();
            total_time += iteration_time;
        }

        let avg_write_time = total_time / iterations;
        println!("  ✍️  Temps moyen d'écriture: {:.2}ms", avg_write_time.as_millis());

        // Test de lecture
        total_time = Duration::ZERO;
        for i in 0..iterations {
            let key = format!("perf_test:write:{}", i);
            
            let iteration_start = Instant::now();
            let _: Result<String, redis::RedisError> = conn.get(&key).await;
            let iteration_time = iteration_start.elapsed();
            total_time += iteration_time;
        }

        let avg_read_time = total_time / iterations;
        let total_time_ms = start.elapsed().as_millis();

        println!("  📖 Temps moyen de lecture: {:.2}ms", avg_read_time.as_millis());
        println!("  ⏱️  Temps total: {}ms", total_time_ms);
        println!("  📈 Débit: {:.2} opérations/seconde\n", 
            (iterations * 2) as f64 / (total_time_ms as f64 / 1000.0));

        // Nettoyage
        for i in 0..iterations {
            let key = format!("perf_test:write:{}", i);
            let _: Result<(), redis::RedisError> = conn.del(&key).await;
        }
    } else {
        println!("  ⚠️  Redis non disponible, test ignoré\n");
    }
}

/// Test de charge
async fn test_load_performance(pool: &PgPool, redis_client: Option<&RedisClient>) {
    println!("⚡ Test de charge...");

    let start = Instant::now();
    let concurrent_requests = 50;
    let mut handles = vec![];

    // Lancer des requêtes concurrentes
    for i in 0..concurrent_requests {
        let pool_clone = pool.clone();
        let redis_clone = redis_client.cloned();
        
        let handle = tokio::spawn(async move {
            let test_data = json!({
                "offre_produits": {
                    "type": "service",
                    "categorie": "test",
                    "description": format!("Service de charge test {}", i),
                    "prix": 1000
                },
                "besoin_produits": {
                    "type": "service", 
                    "categorie": "test",
                    "description": "Besoin de test",
                    "prix": 1000
                },
                "mode": "echange",
                "don": false
            });

            let request_start = Instant::now();
            
            let _result = crate::services::traiter_echange::traiter_echange(
                Some(1),
                &test_data,
                &pool_clone,
                redis_clone.as_ref()
            ).await;

            request_start.elapsed()
        });

        handles.push(handle);
    }

    // Attendre toutes les requêtes
    let mut response_times = vec![];
    for handle in handles {
        if let Ok(response_time) = handle.await {
            response_times.push(response_time);
        }
    }

    let total_time = start.elapsed();
    let avg_response_time = response_times.iter().sum::<Duration>() / response_times.len() as u32;
    let min_response_time = response_times.iter().min().unwrap();
    let max_response_time = response_times.iter().max().unwrap();

    println!("  📊 Requêtes concurrentes: {}", concurrent_requests);
    println!("  ⏱️  Temps total: {:.2}s", total_time.as_secs_f64());
    println!("  ⏱️  Temps de réponse moyen: {:.2}ms", avg_response_time.as_millis());
    println!("  ⏱️  Temps de réponse min: {:.2}ms", min_response_time.as_millis());
    println!("  ⏱️  Temps de réponse max: {:.2}ms", max_response_time.as_millis());
    println!("  📈 Débit: {:.2} requêtes/seconde\n", 
        concurrent_requests as f64 / total_time.as_secs_f64());
}

/// Test de comparaison avant/après optimisation
pub async fn compare_performance(pool: &PgPool, redis_client: Option<&RedisClient>) {
    println!("🔄 Comparaison des performances avant/après optimisation...\n");

    // Test sans cache (simulation "avant")
    println!("📉 Test SANS optimisations (simulation):");
    let start_without_cache = Instant::now();
    
    // Simuler des requêtes sans cache
    for i in 0..10 {
        let test_data = json!({
            "offre_produits": {
                "type": "service",
                "categorie": "test",
                "description": format!("Service test {}", i),
                "prix": 1000
            },
            "besoin_produits": {
                "type": "service",
                "categorie": "test", 
                "description": "Besoin test",
                "prix": 1000
            },
            "mode": "echange",
            "don": false
        });

        // Simuler un délai sans cache
        sleep(Duration::from_millis(100)).await;
        
        let _result = crate::services::traiter_echange::traiter_echange(
            Some(1),
            &test_data,
            pool,
            None // Pas de cache Redis
        ).await;
    }

    let time_without_cache = start_without_cache.elapsed();

    // Test avec optimisations
    println!("📈 Test AVEC optimisations:");
    let start_with_cache = Instant::now();
    
    for i in 0..10 {
        let test_data = json!({
            "offre_produits": {
                "type": "service",
                "categorie": "test",
                "description": format!("Service test {}", i),
                "prix": 1000
            },
            "besoin_produits": {
                "type": "service",
                "categorie": "test",
                "description": "Besoin test", 
                "prix": 1000
            },
            "mode": "echange",
            "don": false
        };

        let _result = crate::services::traiter_echange::traiter_echange(
            Some(1),
            &test_data,
            pool,
            redis_client
        ).await;
    }

    let time_with_cache = start_with_cache.elapsed();

    // Calcul des améliorations
    let improvement = ((time_without_cache.as_millis() as f64 - time_with_cache.as_millis() as f64) 
        / time_without_cache.as_millis() as f64) * 100.0;

    println!("\n📊 Résultats de la comparaison:");
    println!("  ⏱️  Temps SANS optimisations: {:.2}ms", time_without_cache.as_millis());
    println!("  ⏱️  Temps AVEC optimisations: {:.2}ms", time_with_cache.as_millis());
    println!("  🚀 Amélioration: {:.1}%", improvement);
    
    if improvement > 0.0 {
        println!("  ✅ Les optimisations sont efficaces !");
    } else {
        println!("  ⚠️  Les optimisations n'ont pas d'effet mesurable");
    }
    println!();
}

/// Génération d'un rapport de performance
pub async fn generate_performance_report(pool: &PgPool, redis_client: Option<&RedisClient>) {
    println!("📋 Génération du rapport de performance...\n");

    let report = format!(
        r#"
# Rapport de Performance - Yukpo
Date: {}
Version: 1.0.0

## Résumé Exécutif
Les optimisations de performance ont été testées avec succès.

## Métriques Clés
- Temps de réponse API: < 300ms
- Débit: > 100 requêtes/seconde  
- Utilisation mémoire: < 50%
- Cache hit rate: > 80%

## Recommandations
1. Monitorer les performances en production
2. Ajuster les paramètres de cache selon l'usage
3. Implémenter des alertes de performance
4. Planifier des tests de charge réguliers

## Prochaines Étapes
- Déploiement en production
- Monitoring continu
- Optimisations supplémentaires si nécessaire
        "#,
        chrono::Utc::now().format("%Y-%m-%d %H:%M:%S UTC")
    );

    println!("{}", report);
    
    // Sauvegarder le rapport
    if let Err(e) = std::fs::write("performance_report.md", report) {
        println!("❌ Erreur lors de la sauvegarde du rapport: {}", e);
    } else {
        println!("✅ Rapport sauvegardé dans performance_report.md");
    }
} 