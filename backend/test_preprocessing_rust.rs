use yukpomnang_backend::utils::query_preprocessor::preprocess_query;

fn main() {
    println!("🧪 TEST DU PRÉTRAITEMENT RUST");
    println!("{}", "=".repeat(50));
    
    // Tests de requêtes avec mots d'intention
    let test_queries = vec![
        "je cherche un vehicule",
        "je veux une voiture",
        "aide pour trouver une voiture",
        "où acheter une voiture",
        "je souhaite avoir un service",
        "pouvez vous me donner un conseil",
        "Vente de véhicules",  // Sans intention
        "Concessionnaire automobile",  // Sans intention
    ];
    
    for query in test_queries {
        println!("\n🔍 Test avec: '{}'", query);
        
        let preprocessed = preprocess_query(query);
        preprocessed.print_summary();
        
        // Test spécifique pour le service 138
        if query.contains("vehicule") || query.contains("voiture") {
            println!("   🎯 Cette requête devrait maintenant mieux matcher le service 138 !");
        }
    }
    
    println!("\n✅ Tests terminés !");
} 