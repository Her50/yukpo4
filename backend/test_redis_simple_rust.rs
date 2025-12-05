// Test Redis minimal et indépendant - peut être compilé seul
// Usage: rustc --edition 2021 --extern redis test_redis_simple_rust.rs

use std::env;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("🔍 Test de connexion Redis simple");
    println!("==================================\n");

    // URL Redis par défaut
    let redis_url = env::var("REDIS_URL").unwrap_or_else(|_| {
        "rediss://default:AR5SAAImcDI1MzFkNWU5NWMwNzE0ZTVlOWUyNWNmNWFlNjlmZjU3ZnAyNzc2Mg@superb-sole-7762.upstash.io:6379".to_string()
    });

    println!("📋 URL Redis:");
    let display_url = if redis_url.contains("@") {
        let parts: Vec<&str> = redis_url.split("@").collect();
        if parts.len() == 2 {
            format!("rediss://***@{}", parts[1])
        } else {
            redis_url.chars().take(50).collect::<String>()
        }
    } else {
        redis_url.chars().take(50).collect::<String>()
    };
    println!("   {}\n", display_url);

    // Normaliser l'URL
    let mut normalized_url = redis_url.clone();
    if !normalized_url.contains("/") || (!normalized_url.ends_with("/0") && !normalized_url.ends_with("/1")) {
        if normalized_url.matches(':').count() >= 2 && !normalized_url.contains("/") {
            normalized_url.push_str("/0");
        }
    }

    println!("🧪 Test 1: Création du client Redis...");
    let client = match redis::Client::open(normalized_url.clone()) {
        Ok(c) => {
            println!("   ✅ Client créé avec succès\n");
            c
        }
        Err(e) => {
            println!("   ❌ Erreur création client: {}\n", e);
            println!("   💡 Détails: {:?}\n", e);
            return Err(e.into());
        }
    };

    println!("🧪 Test 2: Connexion au serveur Redis...");
    match client.get_multiplexed_async_connection().await {
        Ok(mut conn) => {
            println!("   ✅ Connexion établie avec succès\n");

            println!("🧪 Test 3: Commande PING...");
            match conn.ping::<String>().await {
                Ok(result) => {
                    println!("   ✅ PING réussi: {}\n", result);
                    println!("✅ Tous les tests Redis ont réussi!");
                    println!("\n💡 Conclusion: La connexion Redis fonctionne correctement.");
                    println!("   Le problème est probablement ailleurs dans le code.");
                }
                Err(e) => {
                    println!("   ❌ PING échoué: {}\n", e);
                    println!("   💡 Détails: {:?}\n", e);
                    return Err(e.into());
                }
            }
        }
        Err(e) => {
            println!("   ❌ Erreur de connexion: {}\n", e);
            println!("   💡 Détails complets: {:?}\n", e);
            
            // Analyser l'erreur
            let err_str = e.to_string();
            if err_str.contains("TLS") || err_str.contains("tls") || err_str.contains("certificate") {
                println!("   🔍 Type d'erreur: TLS/Certificat");
                println!("   💡 Solutions:");
                println!("      - Vérifiez que l'URL utilise 'rediss://' (avec double 's')");
                println!("      - Vérifiez que la feature 'tokio-native-tls-comp' est activée");
            } else if err_str.contains("connection") || err_str.contains("refused") || err_str.contains("timeout") {
                println!("   🔍 Type d'erreur: Connexion réseau");
                println!("   💡 Solutions:");
                println!("      - Vérifiez que le serveur Redis est accessible");
                println!("      - Vérifiez les credentials (username/password)");
                println!("      - Vérifiez les paramètres de firewall");
                println!("      - Vérifiez la latence réseau");
            } else if err_str.contains("auth") || err_str.contains("password") {
                println!("   🔍 Type d'erreur: Authentification");
                println!("   💡 Solutions:");
                println!("      - Vérifiez le username et password dans l'URL");
                println!("      - Vérifiez les credentials dans le dashboard Upstash");
            }
            
            return Err(e.into());
        }
    }

    Ok(())
}

