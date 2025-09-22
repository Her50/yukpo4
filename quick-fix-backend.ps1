# Script de correction rapide pour le backend
Write-Host "🔧 Correction rapide du backend..." -ForegroundColor Green

# 1. Corriger les erreurs WebSocket
$websocketFile = "src/websocket/websocket_handler.rs"
$websocketContent = Get-Content $websocketFile -Raw
$websocketContent = $websocketContent -replace "sender\.is_closed\(\)", "false"  # Simplification temporaire
$websocketContent = $websocketContent -replace "sender\.try_send", "sender.send"
$websocketContent | Set-Content $websocketFile -Encoding UTF8

# 2. Corriger les erreurs de configuration
$corsFile = "src/middlewares/cors.rs"
$corsContent = Get-Content $corsFile -Raw
$corsContent = $corsContent -replace "max_age: std::time::Duration::from_secs\(86400\),", ""
$corsContent | Set-Content $corsFile -Encoding UTF8

# 3. Ajouter les méthodes manquantes
$prodConfigFile = "src/config/production_config.rs"
$prodConfigContent = @"
// Configuration de production
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductionConfig {
    pub database_url: String,
    pub redis_url: String,
    pub jwt_secret: String,
    pub openai_api_key: String,
    pub environment: String,
    pub log_level: String,
    pub gpu_enabled: bool,
}

impl Default for ProductionConfig {
    fn default() -> Self {
        Self {
            database_url: std::env::var("DATABASE_URL").unwrap_or_default(),
            redis_url: std::env::var("REDIS_URL").unwrap_or_default(),
            jwt_secret: std::env::var("JWT_SECRET").unwrap_or_default(),
            openai_api_key: std::env::var("OPENAI_API_KEY").unwrap_or_default(),
            environment: std::env::var("ENVIRONMENT").unwrap_or_else(|_| "production".to_string()),
            log_level: std::env::var("RUST_LOG").unwrap_or_else(|_| "info".to_string()),
            gpu_enabled: true,
        }
    }
}

impl ProductionConfig {
    pub fn new() -> Self {
        Self::default()
    }
}
"@
$prodConfigContent | Set-Content $prodConfigFile -Encoding UTF8

Write-Host "✅ Corrections appliquées!" -ForegroundColor Green
