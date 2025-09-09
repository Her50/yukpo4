// Exemple de client Rust pour consommer le microservice d'embedding Yukpo
// D?pendance : reqwest = { version = "0.11", features = ["json"] }
// Place ce fichier dans src/utils/embedding_client.rs

use crate::services::creer_service;
use serde::{Deserialize, Serialize};
use reqwest::Client;
use std::env;

#[derive(Serialize, Deserialize, Debug)]
pub struct EmbeddingConfig {
    pub api_url: String,
    pub api_key: String,
    pub timeout_seconds: u64,
    pub max_retries: u32,
    pub retry_delay_ms: u64,
    pub batch_size: usize,
    pub batch_timeout_seconds: u64,
    pub log_level: String,
    pub log_embedding_calls: bool,
    pub log_performance_metrics: bool,
}

impl Default for EmbeddingConfig {
    fn default() -> Self {
        Self {
            api_url: "http://localhost:8000".to_string(),
            api_key: "yukpo_embedding_key_2024".to_string(),
            timeout_seconds: 60, // Augment? de 30 ? 60
            max_retries: 3,
            retry_delay_ms: 1000,
            batch_size: 10,
            batch_timeout_seconds: 60,
            log_level: "info".to_string(),
            log_embedding_calls: true,
            log_performance_metrics: true,
        }
    }
}

#[derive(Serialize, Deserialize, Debug)]
pub struct EmbeddingRequest {
    pub value: String,
    pub type_donnee: String, // "texte" ou "image"
}

#[derive(Serialize, Deserialize, Debug)]
pub struct AddEmbeddingPineconeRequest {
    pub value: String,
    pub type_donnee: String, // "texte"
    pub service_id: i32,
    pub gps_lat: Option<f64>,
    pub gps_lon: Option<f64>,
    pub langue: Option<String>, // Ajout langue d'origine
    pub unite: Option<String>,  // Ajout unit? (pour num?riques)
    pub devise: Option<String>, // Ajout devise (pour prix)
    pub active: Option<bool>,   // Statut actif (synchronis? avec Pinecone)
    pub type_metier: Option<String>, // Tag m?tier: "service" ou "echange"
}

#[derive(Serialize, Deserialize, Debug)]
pub struct SearchEmbeddingPineconeRequest {
    pub query: String,
    pub type_donnee: String, // "texte"
    pub top_k: Option<u32>,
    pub gps_lat: Option<f64>,
    pub gps_lon: Option<f64>,
    pub gps_radius_km: Option<f64>,
    pub active: Option<bool>, // Ajout du filtre actif pour la recherche
}

#[derive(Serialize, Deserialize, Debug)]
pub struct UpdateEmbeddingStatusRequest {
    pub service_id: i32,
    pub type_donnee: String,
    pub active: bool,
}

#[derive(Clone)]
pub struct EmbeddingClient {
    pub base_url: String,
    pub client: Client,
    pub api_key: String, // cl? d'API pour x-api-key
}

impl EmbeddingClient {
    pub fn new(base_url: &str, api_key: &str) -> Self {
        // Charger la configuration depuis le fichier TOML
        let config = Self::load_config();
        
        let url = if !base_url.is_empty() {
            base_url.to_string()
        } else if !config.api_url.is_empty() {
            config.api_url.clone()
        } else if let Ok(env_url) = env::var("EMBEDDING_API_URL") {
            env_url
        } else {
            "http://localhost:8000".to_string()
        };
        
        let key = if !api_key.is_empty() {
            api_key.to_string()
        } else if !config.api_key.is_empty() {
            config.api_key.clone()
        } else if let Ok(env_key) = env::var("YUKPO_API_KEY") {
            env_key
        } else {
            "yukpo_embedding_key_2024".to_string()
        };
        
        let key_preview = if key.len() > 8 {
            format!("{}... (len={})", &key[..8], key.len())
        } else {
            format!("{} (len={})", key, key.len())
        };
        
        log::info!("[EMBEDDING_CLIENT] Configuration charg?e:");
        log::info!("[EMBEDDING_CLIENT] - URL: {}", url);
        log::info!("[EMBEDDING_CLIENT] - API Key: {}", key_preview);
        log::info!("[EMBEDDING_CLIENT] - Timeout: {}s", config.timeout_seconds);
        log::info!("[EMBEDDING_CLIENT] - Max retries: {}", config.max_retries);
        
        Self {
            base_url: url,
            client: Client::new(),
            api_key: key,
        }
    }
    
    /// Charge la configuration depuis les variables d'environnement ou utilise les valeurs par d?faut
    fn load_config() -> EmbeddingConfig {
        let api_url = env::var("EMBEDDING_API_URL")
            .unwrap_or_else(|_| "http://localhost:8000".to_string());
        
        let api_key = env::var("YUKPO_API_KEY")
            .unwrap_or_else(|_| "yukpo_embedding_key_2024".to_string());
        
        let timeout_seconds = env::var("EMBEDDING_TIMEOUT_SECONDS")
            .unwrap_or_else(|_| "60".to_string()) // Augment? de 30 ? 60
            .parse()
            .unwrap_or(60); // Augment? de 30 ? 60
        
        let max_retries = env::var("EMBEDDING_MAX_RETRIES")
            .unwrap_or_else(|_| "3".to_string())
            .parse()
            .unwrap_or(3);
        
        log::info!("[EMBEDDING_CLIENT] Configuration charg?e depuis les variables d'environnement");
        
        EmbeddingConfig {
            api_url,
            api_key,
            timeout_seconds,
            max_retries,
            retry_delay_ms: 1000,
            batch_size: 10,
            batch_timeout_seconds: 60,
            log_level: "info".to_string(),
            log_embedding_calls: true,
            log_performance_metrics: true,
        }
    }

    pub async fn get_embedding(&self, req: &EmbeddingRequest) -> Result<serde_json::Value, reqwest::Error> {
        let url = format!("{}/embedding", self.base_url);
        let resp = self.client.post(&url)
            .header("x-api-key", &self.api_key)
            .json(req).send().await?;
        resp.json().await
    }

    pub async fn add_embedding_pinecone(&self, req: &AddEmbeddingPineconeRequest) -> Result<serde_json::Value, reqwest::Error> {
        let url = format!("{}/add_embedding_pinecone", self.base_url);
        let resp = self.client.post(&url)
            .header("x-api-key", &self.api_key)
            .json(req).send().await?;
        resp.json().await
    }

    pub async fn search_embedding_pinecone(&self, req: &SearchEmbeddingPineconeRequest) -> Result<serde_json::Value, reqwest::Error> {
        let url = format!("{}/search_embedding_pinecone", self.base_url);
        let resp = self.client.post(&url)
            .header("x-api-key", &self.api_key)
            .json(req).send().await?;
        resp.json().await
    }

    pub async fn delete_embedding_pinecone(&self, service_id: i32) -> Result<serde_json::Value, reqwest::Error> {
        let url = format!("{}/delete_embedding_pinecone", self.base_url);
        let req = serde_json::json!({"service_id": service_id});
        let resp = self.client.post(&url)
            .header("x-api-key", &self.api_key)
            .json(&req).send().await?;
        resp.json().await
    }

    pub async fn update_embedding_status(&self, req: &UpdateEmbeddingStatusRequest) -> Result<serde_json::Value, reqwest::Error> {
        let url = format!("{}/update_embedding_status", self.base_url);
        let resp = self.client.post(&url)
            .header("x-api-key", &self.api_key)
            .json(req).send().await?;
        resp.json().await
    }

    /// Pr?pare les requ?tes d'embedding ? partir d'un champ m?tier (texte ou image)
    /// - Texte : traduit en anglais avant vectorisation
    /// - Image : vectorisation brute + OCR, texte OCR traduit en anglais
    /// Retourne un vecteur de AddEmbeddingPineconeRequest pr?ts ? envoyer
    pub async fn prepare_embedding_inputs(
        champ_value: &str,
        champ_type: &str,
        service_id: i32,
        gps_lat: Option<f64>,
        gps_lon: Option<f64>,
        unite: Option<String>,
        devise: Option<String>,
        active: Option<bool>,
    ) -> Vec<AddEmbeddingPineconeRequest> {
        let mut reqs = Vec::new();
        match champ_type {
            "texte" | "string" | "text" => {
                // Traduction automatique en anglais
                let detected_lang = creer_service::detect_lang(champ_value);
                let value_en = creer_service::translate_to_en(champ_value, &detected_lang).await;
                reqs.push(AddEmbeddingPineconeRequest {
                    value: value_en,
                    // On mappe toujours sur "texte" pour Pinecone, m?me si l'entr?e ?tait "string"
                    type_donnee: "texte".to_string(),
                    service_id,
                    gps_lat,
                    gps_lon,
                    langue: Some("en".to_string()),
                    unite: unite.clone(),
                    devise: devise.clone(),
                    active,
                    type_metier: Some("service".to_string()),
                });
            }
            "image" => {
                // 1. Embedding de l'image brute
                reqs.push(AddEmbeddingPineconeRequest {
                    value: champ_value.to_string(),
                    type_donnee: "image".to_string(),
                    service_id,
                    gps_lat,
                    gps_lon,
                    langue: None,
                    unite: unite.clone(),
                    devise: devise.clone(),
                    active,
                    type_metier: Some("service".to_string()),
                });
                // 2. OCR + embedding du texte extrait (traduit en anglais)
                // let ocr_text = ocr_engine::ocr_image_base64(champ_value).await.unwrap_or_default();
                let ocr_text = String::new(); // Temporairement d?sactiv?
                if !ocr_text.is_empty() {
                    let ocr_lang = creer_service::detect_lang(&ocr_text);
                    let ocr_text_en = creer_service::translate_to_en(&ocr_text, &ocr_lang).await;
                    reqs.push(AddEmbeddingPineconeRequest {
                        value: ocr_text_en,
                        type_donnee: "texte_ocr".to_string(),
                        service_id,
                        gps_lat,
                        gps_lon,
                        langue: Some("en".to_string()),
                        unite: unite.clone(),
                        devise: devise.clone(),
                        active,
                        type_metier: Some("service".to_string()),
                    });
                }
            }
            _ => {
                // Ne rien faire pour les autres types
            }
        }
        reqs
    }
}

// Exemple d'utilisation (dans un test ou un service async)
// let client = EmbeddingClient::new("http://localhost:8000");
// let emb = client.get_embedding(&EmbeddingRequest { value: "Bonjour", type_donnee: "texte".to_string() }).await.unwrap();
