// Script pour appliquer directement la migration fix_parcel_types_ids sur Render
// Usage: cargo run --bin apply_fix_parcel_types_ids
// Ou sur Render: cargo run --bin apply_fix_parcel_types_ids

use sqlx::PgPool;
use std::env;

#[tokio::main]
async fn main() -> Result<(), sqlx::Error> {
    dotenvy::dotenv().ok();

    let mut database_url = env::var("DATABASE_URL")
        .expect("DATABASE_URL doit être définie dans les variables d'environnement");

    // ✅ Ajouter sslmode=require pour Render PostgreSQL si nécessaire
    if !database_url.contains("sslmode=") {
        let separator = if database_url.contains('?') { "&" } else { "?" };
        database_url.push_str(&format!("{}sslmode=require", separator));
        println!("🔧 Paramètre sslmode=require ajouté à DATABASE_URL");
    }

    println!("🔧 Application de la migration fix_parcel_types_ids...");
    println!("📊 Connexion à la base de données...");

    let pool = PgPool::connect(&database_url).await?;
    println!("✅ Connexion établie");

    // Lire et exécuter la migration SQL (version finale avec suppression/recréation des contraintes)
    println!(
        "🔄 Application de la migration SQL (version finale avec suppression/recréation des FK)..."
    );
    let migration_sql = include_str!("../../migrations/20260115_fix_parcel_types_ids_final.sql");

    // ✅ CORRIGÉ: Utiliser execute_multiple_sql_commands pour gérer les blocs DO $$
    // Cette fonction gère correctement les blocs PL/pgSQL avec points-virgules internes
    use yukpomnang_backend::migrations::auto_migrate::execute_multiple_sql_commands;

    execute_multiple_sql_commands(&pool, migration_sql).await?;
    println!("✅ Migration SQL appliquée avec succès");

    // Vérification finale
    println!("\n🔍 Vérification des IDs après migration...");

    #[derive(sqlx::FromRow)]
    struct ParcelType {
        id: i32,
        slug: String,
        display_name: String,
    }

    let types: Vec<ParcelType> = sqlx::query_as::<_, ParcelType>(
        "SELECT id, slug, display_name FROM parcel_types ORDER BY id",
    )
    .fetch_all(&pool)
    .await?;

    println!("\n📦 Types de colis après migration:");
    let mut all_correct = true;

    let expected_mapping = vec![
        (1, "bike", "Vélo"),
        (2, "motorcycle", "Moto"),
        (3, "tricycle", "Tricycle"),
        (4, "car", "Voiture"),
        (5, "pickup", "Pick-up"),
        (6, "van", "Camionnette"),
        (7, "truck", "Camion"),
        (8, "walking", "À pied"),
    ];

    for parcel_type in &types {
        let expected = expected_mapping.iter().find(|(_, slug, _)| slug == &parcel_type.slug);
        match expected {
            Some((expected_id, _, _expected_name)) => {
                if parcel_type.id == *expected_id {
                    println!(
                        "  ✅ ID {}: {} ({}) - CORRECT",
                        parcel_type.id, parcel_type.display_name, parcel_type.slug
                    );
                } else {
                    println!(
                        "  ❌ ID {}: {} ({}) - ATTENDU ID {}",
                        parcel_type.id, parcel_type.display_name, parcel_type.slug, expected_id
                    );
                    all_correct = false;
                }
            }
            None => {
                println!(
                    "  ⚠️ ID {}: {} ({}) - Type non attendu",
                    parcel_type.id, parcel_type.display_name, parcel_type.slug
                );
            }
        }
    }

    if all_correct && types.len() == 8 {
        println!("\n✅ Migration appliquée avec succès! Tous les IDs sont corrects.");
    } else {
        println!("\n⚠️ Migration appliquée, mais certains IDs ne correspondent pas aux attentes.");
    }

    Ok(())
}
