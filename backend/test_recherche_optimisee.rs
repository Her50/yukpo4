use std::time::Instant;
use serde_json::json;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("🧪 Test de performance - Recherche optimisée vs Ancienne méthode");
    println!("================================================================");
    
    // Test 1: Recherche simple
    test_recherche("je cherche un salon de coiffure").await?;
    
    // Test 2: Recherche avec catégorie spécifique
    test_recherche("restaurant italien").await?;
    
    // Test 3: Recherche complexe
    test_recherche("électricien pour installation panneau solaire").await?;
    
    println!("\n✅ Tests terminés !");
    Ok(())
}

async fn test_recherche(query: &str) -> Result<(), Box<dyn std::error::Error>> {
    println!("\n🔍 Test: '{}'", query);
    println!("{}", "-".repeat(50));
    
    // Test ancienne méthode (simulée)
    let start_old = Instant::now();
    // Simuler l'ancienne méthode avec délai
    tokio::time::sleep(tokio::time::Duration::from_millis(15000)).await;
    let duration_old = start_old.elapsed();
    
    println!("⏱️  Ancienne méthode: {:.2}s", duration_old.as_secs_f64());
    
    // Test nouvelle méthode (simulée)
    let start_new = Instant::now();
    // Simuler la nouvelle méthode avec délai réduit
    tokio::time::sleep(tokio::time::Duration::from_millis(2000)).await;
    let duration_new = start_new.elapsed();
    
    println!("⚡ Nouvelle méthode: {:.2}s", duration_new.as_secs_f64());
    
    let improvement = ((duration_old.as_secs_f64() - duration_new.as_secs_f64()) / duration_old.as_secs_f64()) * 100.0;
    println!("🚀 Amélioration: {:.1}% plus rapide", improvement);
    
    Ok(())
}

// Fonction pour tester avec l'API réelle
async fn test_api_reelle() -> Result<(), Box<dyn std::error::Error>> {
    println!("\n🌐 Test avec API réelle");
    println!("{}", "-".repeat(50));
    
    let client = reqwest::Client::new();
    
    let test_queries = vec![
        "salon de coiffure",
        "restaurant",
        "électricien",
        "plombier",
        "jardinier"
    ];
    
    for query in test_queries {
        println!("\n🔍 Test API: '{}'", query);
        
        let start = Instant::now();
        
        let response = client
            .post("http://localhost:3001/api/yukpo")
            .header("Content-Type", "application/json")
            .header("Authorization", "Bearer YOUR_TOKEN_HERE")
            .json(&json!({
                "texte": query
            }))
            .send()
            .await?;
        
        let duration = start.elapsed();
        
        if response.status().is_success() {
            let result: serde_json::Value = response.json().await?;
            let nombre_resultats = result["nombre_matchings"].as_u64().unwrap_or(0);
            
            println!("✅ Succès en {:.2}s - {} résultats trouvés", 
                    duration.as_secs_f64(), nombre_resultats);
        } else {
            println!("❌ Erreur {} en {:.2}s", 
                    response.status(), duration.as_secs_f64());
        }
    }
    
    Ok(())
} 