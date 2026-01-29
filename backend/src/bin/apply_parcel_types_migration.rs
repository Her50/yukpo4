// Script pour appliquer la migration des types de colis directement
// Usage: cargo run --bin apply_parcel_types_migration

use sqlx::PgPool;
use std::env;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();

    let database_url = env::var("DATABASE_URL")
        .expect("DATABASE_URL doit être définie dans les variables d'environnement");

    println!("🔧 Application de la migration des types de colis...");
    println!("📊 Connexion à la base de données...");

    let pool = PgPool::connect(&database_url).await?;

    // 1. Supprimer les anciens types
    println!("🔄 Suppression des anciens types de colis...");
    sqlx::query(
        r#"
        DELETE FROM parcel_types WHERE slug NOT IN (
            'bike', 'motorcycle', 'tricycle', 'car', 'pickup', 'van', 'truck', 'walking'
        )
        "#,
    )
    .execute(&pool)
    .await?;

    // 2. Insérer les nouveaux types
    println!("🔄 Insertion des types de colis alignés avec véhicules...");
    sqlx::query(
        r#"
        INSERT INTO parcel_types (slug, display_name, description, max_weight_kg, max_volume_cm3, requires_fragile_handling, requires_isothermal, requires_secure_box, requires_document_protection, metadata)
        VALUES
            ('bike', 'Vélo', 'Livraison par vélo - Idéal pour petits colis légers et distances courtes', 5, 10000, FALSE, FALSE, FALSE, FALSE, '{"vehicle_type": "bike", "speed": "slow", "range_km": 10}'::jsonb),
            ('motorcycle', 'Moto', 'Livraison par moto - Rapide pour colis moyens en ville', 15, 30000, FALSE, FALSE, FALSE, FALSE, '{"vehicle_type": "motorcycle", "speed": "fast", "range_km": 50}'::jsonb),
            ('tricycle', 'Tricycle', 'Livraison par tricycle - Équilibre capacité/vitesse pour colis moyens', 30, 60000, FALSE, FALSE, FALSE, FALSE, '{"vehicle_type": "tricycle", "speed": "medium", "range_km": 30}'::jsonb),
            ('car', 'Voiture', 'Livraison par voiture - Polyvalent pour tous types de colis', 50, 150000, FALSE, FALSE, FALSE, FALSE, '{"vehicle_type": "car", "speed": "fast", "range_km": 100}'::jsonb),
            ('pickup', 'Pick-up', 'Livraison par pick-up - Idéal pour colis volumineux et lourds', 80, 250000, FALSE, FALSE, FALSE, FALSE, '{"vehicle_type": "pickup", "speed": "medium", "range_km": 80}'::jsonb),
            ('van', 'Camionnette', 'Livraison par camionnette - Grande capacité pour colis multiples', 100, 400000, FALSE, FALSE, FALSE, FALSE, '{"vehicle_type": "van", "speed": "medium", "range_km": 100}'::jsonb),
            ('truck', 'Camion', 'Livraison par camion - Très grande capacité pour déménagements', 500, 1000000, FALSE, FALSE, FALSE, FALSE, '{"vehicle_type": "truck", "speed": "slow", "range_km": 200}'::jsonb),
            ('walking', 'À pied', 'Livraison à pied - Très petits colis, distances très courtes', 2, 5000, FALSE, FALSE, FALSE, FALSE, '{"vehicle_type": "walking", "speed": "very_slow", "range_km": 2}'::jsonb)
        ON CONFLICT (slug) DO UPDATE SET
            display_name = EXCLUDED.display_name,
            description = EXCLUDED.description,
            max_weight_kg = EXCLUDED.max_weight_kg,
            max_volume_cm3 = EXCLUDED.max_volume_cm3,
            metadata = EXCLUDED.metadata
        "#,
    )
    .execute(&pool)
    .await?;

    // 3. Afficher les types après migration
    println!("✅ Migration appliquée avec succès!");
    println!("\n📦 Types de colis disponibles:");

    #[derive(sqlx::FromRow)]
    struct ParcelType {
        id: i32,
        slug: String,
        display_name: String,
    }

    let types: Vec<ParcelType> =
        sqlx::query_as("SELECT id, slug, display_name FROM parcel_types ORDER BY id")
            .fetch_all(&pool)
            .await?;

    for parcel_type in types {
        println!(
            "  ID {}: {} ({})",
            parcel_type.id, parcel_type.display_name, parcel_type.slug
        );
    }

    Ok(())
}
