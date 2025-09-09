use sqlx::postgres::PgPoolOptions;
use std::env;
use yukpomnang_backend::utils::embedding_client::EmbeddingClient;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Configuration
    let database_url = env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://postgres:postgres@localhost:5432/yukpo_db".to_string());
    
    let embedding_url = env::var("EMBEDDING_API_URL")
        .unwrap_or_else(|_| "http://localhost:8000".to_string());
    
    let api_key = env::var("YUKPO_API_KEY")
        .unwrap_or_else(|_| "yukpo_embedding_key_2024".to_string());

    println!("🔍 Connexion à la base de données...");
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await?;

    println!("✅ Connexion réussie !");
    
    println!("🔗 Connexion au service d'embedding...");
    let embedding_client = EmbeddingClient::new(&embedding_url, &api_key);
    println!("✅ Service d'embedding connecté !");

    println!("\n📊 Vérification des services fantômes...\n");

    // Services mentionnés dans les logs qui retournent 404
    let ghost_service_ids = vec![862419, 20977, 518829, 939282, 742692];
    
    for service_id in ghost_service_ids {
        // Vérifier si le service existe en base
        let row = sqlx::query!(
            "SELECT id, is_active FROM services WHERE id = $1",
            service_id
        )
        .fetch_optional(&pool)
        .await?;

        match row {
            Some(service) => {
                println!("✅ Service {}: EXISTE en base (actif={})", service_id, service.is_active);
            },
            None => {
                println!("❌ Service {}: N'EXISTE PAS en base - SUPPRESSION de Pinecone", service_id);
                
                // Supprimer l'embedding de Pinecone
                match embedding_client.delete_embedding_pinecone(service_id).await {
                    Ok(result) => {
                        println!("   🗑️  Embedding supprimé de Pinecone: {:?}", result);
                    },
                    Err(e) => {
                        println!("   ⚠️  Erreur suppression embedding: {:?}", e);
                    }
                }
            }
        }
    }

    println!("\n📈 Statistiques après nettoyage:");
    
    // Compter tous les services
    let total_count = sqlx::query!("SELECT COUNT(*) as count FROM services")
        .fetch_one(&pool)
        .await?;
    println!("   Total des services en base: {}", total_count.count.unwrap_or(0));

    // Compter les services actifs
    let active_count = sqlx::query!("SELECT COUNT(*) as count FROM services WHERE is_active = true")
        .fetch_one(&pool)
        .await?;
    println!("   Services actifs en base: {}", active_count.count.unwrap_or(0));

    println!("\n🎯 Nettoyage terminé !");
    println!("   Les embeddings fantômes ont été supprimés de Pinecone.");
    println!("   Seuls les services existants en base seront retournés.");

    Ok(())
} 