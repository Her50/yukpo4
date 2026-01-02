// Script pour créer les index MongoDB directement
// Usage: cargo run --bin ensure_mongodb_indexes

use mongodb::Client as MongoClient;
use std::env;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();
    
    let mongo_url = env::var("MONGODB_URL")
        .unwrap_or_else(|_| "mongodb://localhost:27017".to_string());
    
    println!("🔌 Connexion à MongoDB: {}...", mongo_url.split('@').last().unwrap_or("***"));
    
    let mongo_client = MongoClient::with_uri_str(&mongo_url).await?;
    println!("✅ Client MongoDB connecté");
    
    let database_name = env::var("MONGODB_DATABASE")
        .unwrap_or_else(|_| "yukpomnang".to_string());
    
    let mongo_history = yukpomnang_backend::services::mongo_history_service::MongoHistoryService::new(
        std::sync::Arc::new(mongo_client),
        database_name.clone(),
    );
    
    println!("🔍 Création des index MongoDB sur la base '{}'...", database_name);
    
    match mongo_history.ensure_indexes().await {
        Ok(_) => {
            println!("✅ Index MongoDB créés avec succès!");
            println!("   - idx_service_id: sur service_id");
            println!("   - idx_service_event_interaction: composé (service_id, event_type, data.interaction_type)");
            println!("   - idx_timestamp: sur timestamp");
        }
        Err(e) => {
            eprintln!("❌ Erreur création index MongoDB: {}", e);
            return Err(e.into());
        }
    }
    
    Ok(())
}


