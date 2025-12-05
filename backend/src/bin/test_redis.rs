// Script de test pour diagnostiquer les problèmes de connexion Redis
// Binaire indépendant - n'importe pas la lib du projet

use dotenvy::dotenv;
use redis::AsyncCommands;
use redis::Client as RedisClient;
use std::env;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenv().ok();
    env_logger::init();

    println!("🔍 Test de connexion Redis");
    println!("==========================\n");

    // Récupérer l'URL Redis depuis l'environnement
    let redis_url = env::var("REDIS_URL").unwrap_or_else(|_| {
        println!("❌ REDIS_URL non définie dans l'environnement");
        std::process::exit(1);
    });

    println!("📋 URL Redis (masquée):");
    let display_url = if redis_url.contains("@") {
        let parts: Vec<&str> = redis_url.split("@").collect();
        if parts.len() == 2 {
            let auth_part = parts[0].replace("redis://", "").replace("rediss://", "");
            let protocol = if redis_url.starts_with("rediss://") {
                "rediss://"
            } else {
                "redis://"
            };
            if auth_part.contains(":") {
                let user_pass: Vec<&str> = auth_part.split(":").collect();
                if user_pass.len() == 2 {
                    format!("{}{}:***@{}", protocol, user_pass[0], parts[1])
                } else {
                    format!("{}***@{}", protocol, parts[1])
                }
            } else {
                format!("{}***@{}", protocol, parts[1])
            }
        } else {
            redis_url.chars().take(50).collect::<String>()
        }
    } else {
        redis_url.chars().take(50).collect::<String>()
    };
    println!("   {}", display_url);
    println!();

    // Vérifier le protocole
    let uses_tls = redis_url.starts_with("rediss://");
    println!("🔐 Protocole:");
    if uses_tls {
        println!("   ✅ Utilise TLS (rediss://)");
    } else {
        println!("   ⚠️  N'utilise PAS TLS (redis://)");
        if redis_url.contains("upstash.io") {
            println!("   ⚠️  ATTENTION: Upstash nécessite TLS (rediss://)");
        }
    }
    println!();

    // Normaliser l'URL si nécessaire
    let mut normalized_url = redis_url.clone();

    // Convertir redis:// en rediss:// pour Upstash
    if redis_url.contains("upstash.io") && redis_url.starts_with("redis://") {
        normalized_url = redis_url.replace("redis://", "rediss://");
        println!("✅ Conversion automatique: redis:// → rediss://");
        println!();
    }

    // Ajouter le numéro de base de données si absent
    if !normalized_url.contains("/")
        || (!normalized_url.ends_with("/0")
            && !normalized_url.ends_with("/1")
            && !normalized_url.ends_with("/2")
            && !normalized_url.ends_with("/3")
            && !normalized_url.ends_with("/4")
            && !normalized_url.ends_with("/5")
            && !normalized_url.ends_with("/6")
            && !normalized_url.ends_with("/7")
            && !normalized_url.ends_with("/8")
            && !normalized_url.ends_with("/9"))
    {
        if normalized_url.matches(':').count() >= 2 && !normalized_url.contains("/") {
            normalized_url.push_str("/0");
            println!("✅ Ajout du numéro de base de données: /0");
            println!();
        } else if normalized_url.ends_with('/') {
            normalized_url.push_str("0");
            println!("✅ Ajout du numéro de base de données: 0");
            println!();
        }
    }

    // Test 1: Création du client
    println!("🧪 Test 1: Création du client Redis...");
    let client = match RedisClient::open(normalized_url.clone()) {
        Ok(c) => {
            println!("   ✅ Client créé avec succès");
            c
        }
        Err(e) => {
            println!("   ❌ Erreur lors de la création du client: {}", e);
            if e.to_string().contains("TLS") || e.to_string().contains("tls") {
                println!("   💡 Suggestion: Vérifiez que la feature 'tokio-native-tls-comp' est activée dans Cargo.toml");
            }
            return Err(e.into());
        }
    };
    println!();

    // Test 2: Connexion
    println!("🧪 Test 2: Connexion au serveur Redis...");
    match client.get_multiplexed_async_connection().await {
        Ok(mut conn) => {
            println!("   ✅ Connexion établie avec succès");
            println!();

            // Test 3: Opération PING
            println!("🧪 Test 3: Commande PING...");
            match conn.ping::<String>().await {
                Ok(result) => {
                    println!("   ✅ PING réussi: {}", result);
                }
                Err(e) => {
                    println!("   ❌ PING échoué: {}", e);
                    return Err(e.into());
                }
            }
            println!();

            // Test 4: SET/GET
            println!("🧪 Test 4: Opération SET/GET...");
            let test_key = "__test_connection__";
            let test_value = "test_value_12345";

            match conn.set::<&str, &str, ()>(test_key, test_value).await {
                Ok(_) => {
                    println!("   ✅ SET réussi");
                }
                Err(e) => {
                    println!("   ❌ SET échoué: {}", e);
                    return Err(e.into());
                }
            }

            match conn.get::<&str, Option<String>>(test_key).await {
                Ok(Some(value)) => {
                    if value == test_value {
                        println!("   ✅ GET réussi: valeur correcte");
                    } else {
                        println!(
                            "   ⚠️  GET réussi mais valeur incorrecte: attendu '{}', obtenu '{}'",
                            test_value, value
                        );
                    }
                }
                Ok(None) => {
                    println!("   ⚠️  GET réussi mais clé non trouvée");
                }
                Err(e) => {
                    println!("   ❌ GET échoué: {}", e);
                    return Err(e.into());
                }
            }

            // Nettoyer
            let _ = conn.del::<&str, ()>(test_key).await;
            println!();

            // Test 5: Pool deadpool-redis
            println!("🧪 Test 5: Création du pool deadpool-redis...");
            // deadpool_redis::Config::from_url retourne directement un Config, pas un Result
            let mut cfg = deadpool_redis::Config::from_url(normalized_url.clone());
            if cfg.pool.is_none() {
                cfg.pool = Some(deadpool_redis::PoolConfig::default());
            }
            if let Some(ref mut pool_cfg) = cfg.pool {
                pool_cfg.max_size = Some(4);
                pool_cfg.min_idle = Some(1);
            }
            match cfg.create_pool(Some(deadpool_redis::Runtime::Tokio1)) {
                Ok(pool) => {
                    println!("   ✅ Pool créé avec succès");

                    // Tester une opération avec le pool
                    match pool.get().await {
                        Ok(mut conn) => {
                            // Utiliser AsyncCommands pour ping
                            use redis::AsyncCommands;
                            match conn.ping::<String>().await {
                                Ok(_) => {
                                    println!("   ✅ Test d'opération avec le pool réussi");
                                }
                                Err(e) => {
                                    println!("   ⚠️  Pool créé mais opération échouée: {}", e);
                                }
                            }
                        }
                        Err(e) => {
                            println!(
                                "   ⚠️  Pool créé mais impossible d'obtenir une connexion: {}",
                                e
                            );
                        }
                    }
                }
                Err(e) => {
                    println!("   ❌ Erreur lors de la création du pool: {}", e);
                }
            }
            println!();

            println!("✅ Tous les tests Redis ont réussi !");
            println!();
            println!("💡 Si le backend ne fonctionne toujours pas, vérifiez:");
            println!("   1. Que REDIS_URL est bien définie dans l'environnement du backend");
            println!("   2. Que la feature 'tokio-native-tls-comp' est activée dans Cargo.toml");
            println!("   3. Les logs du backend au démarrage");
        }
        Err(e) => {
            println!("   ❌ Erreur lors de la connexion: {}", e);
            println!();
            println!("💡 Suggestions:");
            if e.to_string().contains("TLS") || e.to_string().contains("tls") {
                println!("   - Vérifiez que la feature 'tokio-native-tls-comp' est activée dans Cargo.toml");
                println!("   - Vérifiez que l'URL utilise 'rediss://' (avec double 's') pour TLS");
            }
            if e.to_string().contains("connection") || e.to_string().contains("Connection") {
                println!("   - Vérifiez que le serveur Redis est accessible depuis votre machine");
                println!("   - Vérifiez les paramètres de firewall");
                println!("   - Vérifiez les credentials (username/password)");
            }
            return Err(e.into());
        }
    }

    Ok(())
}
