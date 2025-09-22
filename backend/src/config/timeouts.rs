// Configuration des timeouts pour optimiser les performances
// Correction des timeouts de 180 secondes observés dans les logs

use std::time::Duration;

/// Configuration des timeouts pour l'application
pub struct TimeoutConfig {
    /// Timeout pour les requêtes HTTP
    pub request_timeout: Duration,
    /// Timeout pour les connexions à la base de données
    pub database_timeout: Duration,
    /// Timeout pour les requêtes IA
    pub ai_timeout: Duration,
    /// Timeout pour les requêtes d'embedding
    pub embedding_timeout: Duration,
    /// Timeout pour les requêtes WebSocket
    pub websocket_timeout: Duration,
    /// Timeout pour les requêtes de géocodage
    pub geocoding_timeout: Duration,
}

impl Default for TimeoutConfig {
    fn default() -> Self {
        Self {
            // Timeout de requête HTTP réduit de 180s à 30s
            request_timeout: Duration::from_secs(30),
            // Timeout de base de données optimisé
            database_timeout: Duration::from_secs(10),
            // Timeout IA raisonnable
            ai_timeout: Duration::from_secs(60),
            // Timeout d'embedding optimisé
            embedding_timeout: Duration::from_secs(30),
            // Timeout WebSocket
            websocket_timeout: Duration::from_secs(15),
            // Timeout géocodage
            geocoding_timeout: Duration::from_secs(20),
        }
    }
}

impl TimeoutConfig {
    /// Crée une nouvelle configuration avec des timeouts personnalisés
    pub fn new(
        request_timeout: Option<u64>,
        database_timeout: Option<u64>,
        ai_timeout: Option<u64>,
        embedding_timeout: Option<u64>,
        websocket_timeout: Option<u64>,
        geocoding_timeout: Option<u64>,
    ) -> Self {
        Self {
            request_timeout: Duration::from_secs(request_timeout.unwrap_or(30)),
            database_timeout: Duration::from_secs(database_timeout.unwrap_or(10)),
            ai_timeout: Duration::from_secs(ai_timeout.unwrap_or(60)),
            embedding_timeout: Duration::from_secs(embedding_timeout.unwrap_or(30)),
            websocket_timeout: Duration::from_secs(websocket_timeout.unwrap_or(15)),
            geocoding_timeout: Duration::from_secs(geocoding_timeout.unwrap_or(20)),
        }
    }

    /// Charge la configuration depuis les variables d'environnement
    pub fn from_env() -> Self {
        let request_timeout = std::env::var("REQUEST_TIMEOUT")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(30);

        let database_timeout = std::env::var("DATABASE_TIMEOUT")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(10);

        let ai_timeout = std::env::var("AI_TIMEOUT")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(60);

        let embedding_timeout = std::env::var("EMBEDDING_TIMEOUT_SECONDS")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(30);

        let websocket_timeout = std::env::var("WEBSOCKET_TIMEOUT")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(15);

        let geocoding_timeout = std::env::var("GEOCODING_TIMEOUT")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(20);

        Self::new(
            Some(request_timeout),
            Some(database_timeout),
            Some(ai_timeout),
            Some(embedding_timeout),
            Some(websocket_timeout),
            Some(geocoding_timeout),
        )
    }

    /// Obtient le timeout pour les requêtes HTTP
    pub fn get_request_timeout(&self) -> Duration {
        self.request_timeout
    }

    /// Obtient le timeout pour la base de données
    pub fn get_database_timeout(&self) -> Duration {
        self.database_timeout
    }

    /// Obtient le timeout pour les requêtes IA
    pub fn get_ai_timeout(&self) -> Duration {
        self.ai_timeout
    }

    /// Obtient le timeout pour les requêtes d'embedding
    pub fn get_embedding_timeout(&self) -> Duration {
        self.embedding_timeout
    }

    /// Obtient le timeout pour les WebSockets
    pub fn get_websocket_timeout(&self) -> Duration {
        self.websocket_timeout
    }

    /// Obtient le timeout pour le géocodage
    pub fn get_geocoding_timeout(&self) -> Duration {
        self.geocoding_timeout
    }
}

/// Instance globale de configuration des timeouts
lazy_static::lazy_static! {
    pub static ref TIMEOUT_CONFIG: TimeoutConfig = TimeoutConfig::from_env();
}

/// Fonction utilitaire pour obtenir le timeout de requête
pub fn get_request_timeout() -> Duration {
    TIMEOUT_CONFIG.get_request_timeout()
}

/// Fonction utilitaire pour obtenir le timeout de base de données
pub fn get_database_timeout() -> Duration {
    TIMEOUT_CONFIG.get_database_timeout()
}

/// Fonction utilitaire pour obtenir le timeout IA
pub fn get_ai_timeout() -> Duration {
    TIMEOUT_CONFIG.get_ai_timeout()
}

/// Fonction utilitaire pour obtenir le timeout d'embedding
pub fn get_embedding_timeout() -> Duration {
    TIMEOUT_CONFIG.get_embedding_timeout()
}

/// Fonction utilitaire pour obtenir le timeout WebSocket
pub fn get_websocket_timeout() -> Duration {
    TIMEOUT_CONFIG.get_websocket_timeout()
}

/// Fonction utilitaire pour obtenir le timeout de géocodage
pub fn get_geocoding_timeout() -> Duration {
    TIMEOUT_CONFIG.get_geocoding_timeout()
}
