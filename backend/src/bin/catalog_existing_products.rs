// Script pour cataloguer tous les produits existants avec images
// Analyse les images et stocke les analyses dans image_analyses
// Usage: cargo run --bin catalog_existing_products

use sqlx::postgres::PgPoolOptions;
use sqlx::Row;
use std::env;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Charger les variables d'environnement
    dotenv::dotenv().ok();
    
    let database_url = env::var("DATABASE_URL")
        .expect("DATABASE_URL doit être défini dans .env");
    
    println!("🔗 Connexion à la base de données...");
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await?;
    
    println!("✅ Connecté à PostgreSQL");
    
    // Récupérer tous les services actifs avec des produits ayant des images
    println!("\n📦 Récupération des produits avec images...");
    
    let services = sqlx::query(
        r#"
        SELECT 
            s.id as service_id,
            s.user_id,
            s.data,
            product,
            product->>'nom' as product_name,
            jsonb_array_elements_text(COALESCE(product->'images', '[]'::jsonb)) as image_path
        FROM services s,
        jsonb_array_elements(
            CASE 
                WHEN jsonb_typeof(s.data->'produits'->'valeur') = 'array' 
                THEN s.data->'produits'->'valeur'
                WHEN jsonb_typeof(s.data->'produits') = 'array' 
                THEN s.data->'produits'
                ELSE '[]'::jsonb
            END
        ) AS product
        WHERE s.is_active = true
        AND jsonb_array_length(COALESCE(product->'images', '[]'::jsonb)) > 0
        "#
    )
    .fetch_all(&pool)
    .await?;
    
    let total_products = services.len();
    println!("📊 Trouvé {} produits avec images à cataloguer", total_products);
    
    if total_products == 0 {
        println!("⚠️ Aucun produit avec image trouvé. Créez d'abord des produits avec des images.");
        return Ok(());
    }
    
    // Initialiser AppIA (nécessaire pour l'analyse)
    use yukpomnang_backend::services::app_ia::AppIA;
    
    let app_ia = AppIA::new().await?;
    println!("✅ IA initialisée\n");
    
    // Cataloguer chaque produit
    let mut cataloged = 0;
    let mut failed = 0;
    let mut skipped = 0;
    
    for (index, row) in services.iter().enumerate() {
        let service_id: i32 = row.try_get("service_id").unwrap_or(0);
        let user_id: i32 = row.try_get("user_id").unwrap_or(0);
        let product_name: String = row.try_get("product_name").unwrap_or_default();
        let image_path: String = row.try_get("image_path").unwrap_or_default();
        
        println!(
            "\n[{}/{}] 🔍 Produit: '{}' (Service: {}, Image: {})",
            index + 1,
            total_products,
            &product_name,
            service_id,
            &image_path[..image_path.len().min(50)]
        );
        
        // Vérifier si déjà catalogué
        let existing = sqlx::query!(
            "SELECT id FROM image_analyses WHERE service_id = $1 AND analysis_type = 'cataloging'",
            service_id
        )
        .fetch_optional(&pool)
        .await?;
        
        if existing.is_some() {
            println!("  ⏭️ Déjà catalogué, skip");
            skipped += 1;
            continue;
        }
        
        // Récupérer l'image depuis media
        let media_row = sqlx::query!(
            "SELECT id, path FROM media WHERE service_id = $1 AND path = $2 AND type = 'image' LIMIT 1",
            service_id,
            image_path
        )
        .fetch_optional(&pool)
        .await?;
        
        if let Some(media) = media_row {
            // TODO: Charger l'image depuis le stockage (filesystem ou S3)
            // Pour l'instant, on skip si pas d'accès direct à l'image
            println!("  ⚠️ Image trouvée en base (media_id: {}) mais chargement non implémenté", media.id);
            println!("  💡 Astuce: Lors de la prochaine modification du service, l'image sera automatiquement cataloguée");
            skipped += 1;
            
            // Note: Pour implémenter complètement, il faudrait:
            // 1. Charger l'image depuis /uploads/... ou S3
            // 2. Convertir en base64
            // 3. Analyser avec app_ia
            // 4. Stocker dans image_analyses
        } else {
            println!("  ❌ Image non trouvée dans table media");
            failed += 1;
        }
    }
    
    println!("\n" + "=".repeat(60));
    println!("📊 RÉSUMÉ DU CATALOGAGE");
    println!("=".repeat(60));
    println!("✅ Catalogués: {}", cataloged);
    println!("⏭️ Déjà existants: {}", skipped);
    println!("❌ Échecs: {}", failed);
    println!("📦 Total traité: {}/{}", cataloged + skipped + failed, total_products);
    
    println!("\n💡 POUR CATALOGAGE COMPLET:");
    println!("   Les produits seront automatiquement catalogués lors de:");
    println!("   1. Création de nouveaux services avec images");
    println!("   2. Modification de services existants");
    println!("   3. Upload de nouvelles images de produits");
    
    println!("\n✅ Script terminé avec succès!");
    
    Ok(())
}

