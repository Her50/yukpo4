// Script pour vérifier que les index d'optimisation sont bien créés
// Usage: cargo run --bin verify_indexes

use sqlx::PgPool;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgresql://yukpo_db_user:88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4@dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com/yukpo_db".to_string());

    println!("🔍 Vérification des index d'optimisation...\n");

    let pool = PgPool::connect(&database_url).await?;

    let indexes = vec![
        "idx_video_generation_jobs_status_updated_at",
        "idx_global_promo_entries_event_id_status",
        "idx_global_promo_events_status_dates",
        "idx_live_flash_sales_status_dates",
        "idx_live_sessions_id_host_user",
    ];

    for index_name in indexes.iter() {
        let query = format!(
            "SELECT COUNT(*) as count FROM pg_indexes WHERE indexname = '{}'",
            index_name
        );

        let row: (i64,) = sqlx::query_as(&query).fetch_one(&pool).await?;

        if row.0 > 0 {
            println!("✅ Index {} existe", index_name);
        } else {
            println!("❌ Index {} n'existe pas", index_name);
        }
    }

    println!("\n📊 Test de performance sur video_generation_jobs...");
    let start = std::time::Instant::now();
    let _result: Vec<(String, i64)> = sqlx::query_as(
        "SELECT status, COUNT(*)::bigint AS count FROM video_generation_jobs GROUP BY status",
    )
    .fetch_all(&pool)
    .await?;
    let elapsed = start.elapsed();
    println!("⏱️ Temps d'exécution: {:?}", elapsed);

    if elapsed.as_millis() < 100 {
        println!("✅ Performance excellente (< 100ms)");
    } else if elapsed.as_millis() < 300 {
        println!("⚠️ Performance acceptable (< 300ms)");
    } else {
        println!("❌ Performance à améliorer (> 300ms)");
    }

    println!("\n✨ Vérification terminée!");
    Ok(())
}
