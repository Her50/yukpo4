// Rust: Fonction utilitaire pour appeler le microservice Python d'embedding
use reqwest::Client;
use serde_json::json;

pub async fn get_embedding(value: &str, type_donnee: &str) -> anyhow::Result<Vec<f32>> {
    let client = Client::new();
    let resp = client.post("http://localhost:8000/embedding")
        .json(&json!({"value": value, "type_donnee": type_donnee}))
        .send().await?;
    let resp_json: serde_json::Value = resp.json().await?;
    let embedding = resp_json["embedding"].as_array()
        .ok_or_else(|| anyhow::anyhow!("No embedding in response"))?
        .iter().map(|v| v.as_f64().unwrap() as f32).collect();
    Ok(embedding)
}
