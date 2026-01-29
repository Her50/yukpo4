// Script pour analyser les plans d'exécution des requêtes lentes
// Usage: cargo run --bin analyze_slow_queries

use sqlx::PgPool;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgresql://yukpo_db_user:88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4@dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com/yukpo_db".to_string());

    println!("🔍 Analyse des plans d'exécution des requêtes lentes...\n");

    let pool = PgPool::connect(&database_url).await?;

    // Requête 1: GROUP BY status sur video_generation_jobs
    println!("📊 1. Analyse: GROUP BY status sur video_generation_jobs");
    let explain_result: Vec<(String,)> = sqlx::query_as(
        "EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) 
         SELECT status, COUNT(*)::bigint AS count 
         FROM video_generation_jobs 
         GROUP BY status",
    )
    .fetch_all(&pool)
    .await?;

    println!("Plan d'exécution:");
    for row in explain_result {
        println!("{}", row.0);
    }

    // Requête 2: COUNT avec updated_at
    println!("\n📊 2. Analyse: COUNT avec updated_at sur video_generation_jobs");
    let explain_result: Vec<(String,)> = sqlx::query_as(
        "EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) 
         SELECT COUNT(*)::bigint AS count 
         FROM video_generation_jobs 
         WHERE status = 'completed' 
         AND updated_at >= NOW() - INTERVAL '24 hours'",
    )
    .fetch_all(&pool)
    .await?;

    println!("Plan d'exécution:");
    for row in explain_result {
        println!("{}", row.0);
    }

    // Requête 3: Recherche principale
    println!("\n📊 3. Analyse: Requête de recherche principale");
    let explain_result: Vec<(String,)> = sqlx::query_as(
        "EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) 
         WITH matched_services AS (
             SELECT DISTINCT s.id as service_id
             FROM autocomplete_characteristics ac
             INNER JOIN services s ON s.id = ac.service_id
             WHERE s.is_active = true
             AND ac.identifiant_base = 'produits'
             AND ac.is_real_product = TRUE
             AND (
                 to_tsvector('french', ac.valeur) @@ plainto_tsquery('french', 'Mèches')
                 OR full_vector_to_tsvector(ac.full_vector) @@ plainto_tsquery('french', 'Mèches')
                 OR characteristic_vector_to_tsvector(ac.characteristic_vector) @@ plainto_tsquery('french', 'Mèches')
             )
             UNION
             SELECT DISTINCT s.id as service_id
             FROM services s
             WHERE s.is_active = true
             AND (
                 to_tsvector('french', COALESCE(s.data->'titre_service'->>'valeur', '')) @@ plainto_tsquery('french', 'Mèches')
                 OR to_tsvector('french', COALESCE(s.data->'description'->>'valeur', '')) @@ plainto_tsquery('french', 'Mèches')
             )
             LIMIT 20
         )
         SELECT DISTINCT ON (s.id) s.id, s.data, s.created_at, s.user_id, s.gps, s.category
         FROM matched_services ms
         INNER JOIN services s ON s.id = ms.service_id
         LIMIT 100"
    )
    .fetch_all(&pool)
    .await?;

    println!("Plan d'exécution:");
    for row in explain_result {
        println!("{}", row.0);
    }

    println!("\n✨ Analyse terminée!");
    Ok(())
}
