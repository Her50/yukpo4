// Script de diagnostic LiveKit pour tester la connexion et l'authentification
// Usage: cargo run --bin test_livekit

use anyhow::Result;
use reqwest::Client;
use serde_json::json;

use yukpomnang_backend::{
    config::live_streaming::LiveStreamingConfig, utils::livekit::generate_server_access_token,
};

#[tokio::main]
async fn main() -> Result<()> {
    dotenvy::dotenv().ok();
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();

    println!("🔍 DIAGNOSTIC SERVEUR LIVEKIT");
    println!("================================\n");

    let config = LiveStreamingConfig::from_env();

    // 1. Vérifier la configuration
    println!("1️⃣ Vérification de la configuration...");

    if !config.is_livekit_enabled() {
        println!("   ❌ LiveKit n'est pas configuré");
        println!("   Variables requises:");
        println!("     - LIVEKIT_API_URL");
        println!("     - LIVEKIT_API_KEY");
        println!("     - LIVEKIT_API_SECRET");
        return Ok(());
    }

    println!("   ✅ Configuration détectée:");
    if let Some(ref url) = config.livekit_api_url {
        println!("     LIVEKIT_API_URL: {}", url);
    }
    if let Some(ref key) = config.livekit_api_key {
        let preview = if key.len() > 10 {
            format!("{}...", &key[..10])
        } else {
            key.clone()
        };
        println!("     LIVEKIT_API_KEY: {}", preview);
    }
    if config.livekit_api_secret.is_some() {
        println!("     LIVEKIT_API_SECRET: [présent]");
    }

    // Valider la configuration
    if let Err(e) = config.validate() {
        println!("   ❌ Erreur de configuration: {}", e);
        return Ok(());
    }
    println!("   ✅ Configuration valide\n");

    // 2. Tester l'endpoint de santé
    println!("2️⃣ Test de l'endpoint de santé...");
    let base_url = config.livekit_api_url.as_ref().unwrap();
    let health_url = format!("{}/health", base_url.trim_end_matches('/'));
    println!("   GET {}", health_url);

    let client = Client::new();
    match client.get(&health_url).timeout(std::time::Duration::from_secs(10)).send().await {
        Ok(response) => {
            let status = response.status();
            if status.is_success() {
                println!("   ✅ Serveur LiveKit accessible (Status: {})", status);
                if let Ok(text) = response.text().await {
                    println!("   Réponse: {}", text);
                }
            } else {
                println!("   ⚠️ Statut inattendu: {}", status);
            }
        }
        Err(e) => {
            println!("   ❌ Erreur: {}", e);
            if e.to_string().contains("Connection refused")
                || e.to_string().contains("tcp connect error")
            {
                println!("   💡 Le serveur LiveKit n'est pas accessible à cette URL");
                println!("   💡 Vérifiez que le serveur est démarré et que l'URL est correcte");
            } else if e.to_string().contains("Name or service not known") {
                println!("   💡 Problème DNS - l'URL n'est pas résolvable");
            }
        }
    }
    println!();

    // 3. Tester l'authentification avec ListRooms
    println!("3️⃣ Test d'authentification API (ListRooms)...");
    let api_key = config.livekit_api_key.as_ref().unwrap();
    let api_secret = config.livekit_api_secret.as_ref().unwrap();

    let list_rooms_url = format!(
        "{}/twirp/livekit.RoomService/ListRooms",
        base_url.trim_end_matches('/')
    );
    println!("   POST {}", list_rooms_url);

    // Générer un token d'accès serveur
    let token = match generate_server_access_token(api_key, api_secret) {
        Ok(t) => {
            println!("   ✅ Token généré avec succès");
            t
        }
        Err(e) => {
            println!("   ❌ Erreur lors de la génération du token: {}", e);
            return Ok(());
        }
    };

    // Tester l'appel API
    match client
        .post(&list_rooms_url)
        .bearer_auth(&token)
        .json(&json!({}))
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
    {
        Ok(response) => {
            let status = response.status();
            if status.is_success() {
                println!("   ✅ Authentification réussie (Status: {})", status);
                match response.json::<serde_json::Value>().await {
                    Ok(data) => {
                        if let Some(rooms) = data.get("rooms").and_then(|v| v.as_array()) {
                            println!("   📊 Nombre de rooms actives: {}", rooms.len());
                            if !rooms.is_empty() {
                                println!("   Rooms:");
                                for room in rooms.iter().take(5) {
                                    if let Some(name) = room.get("name").and_then(|v| v.as_str()) {
                                        let participants = room
                                            .get("num_participants")
                                            .and_then(|v| v.as_i64())
                                            .unwrap_or(0);
                                        println!("     - {} ({} participants)", name, participants);
                                    }
                                }
                            }
                        }
                    }
                    Err(e) => {
                        println!("   ⚠️ Erreur lors du parsing de la réponse: {}", e);
                    }
                }
            } else if status == reqwest::StatusCode::UNAUTHORIZED {
                println!("   ❌ Authentification échouée (401 Unauthorized)");
                println!("   💡 Vérifiez que LIVEKIT_API_KEY et LIVEKIT_API_SECRET sont corrects");
            } else {
                println!("   ⚠️ Statut inattendu: {}", status);
            }
        }
        Err(e) => {
            println!("   ❌ Erreur lors de l'appel API: {}", e);
        }
    }
    println!();

    // 4. Tester ListIngress
    println!("4️⃣ Test API ListIngress...");
    let list_ingress_url = format!(
        "{}/twirp/livekit.Ingress/ListIngress",
        base_url.trim_end_matches('/')
    );
    println!("   POST {}", list_ingress_url);

    match client
        .post(&list_ingress_url)
        .bearer_auth(&token)
        .json(&json!({}))
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
    {
        Ok(response) => {
            let status = response.status();
            if status.is_success() {
                println!("   ✅ ListIngress accessible (Status: {})", status);
                match response.json::<serde_json::Value>().await {
                    Ok(data) => {
                        if let Some(items) = data
                            .get("items")
                            .or_else(|| data.get("ingress"))
                            .and_then(|v| v.as_array())
                        {
                            println!("   📊 Nombre d'ingress actifs: {}", items.len());
                        }
                    }
                    Err(_) => {}
                }
            } else {
                println!("   ⚠️ Statut: {}", status);
            }
        }
        Err(e) => {
            println!("   ❌ Erreur: {}", e);
        }
    }
    println!();

    // Résumé
    println!("📊 RÉSUMÉ");
    println!("================================\n");
    println!("✅ Diagnostic terminé");
    println!("\n💡 Si tous les tests passent, votre serveur LiveKit est opérationnel !");
    println!("💡 Si des erreurs persistent, vérifiez:");
    println!("   1. Que le serveur LiveKit est démarré");
    println!("   2. Que l'URL est correcte et accessible");
    println!("   3. Que les credentials (API_KEY/API_SECRET) sont valides");

    Ok(())
}
