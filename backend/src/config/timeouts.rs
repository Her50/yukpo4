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
            // ✅ CORRIGÉ 2026-01-12: Timeout HTTP augmenté pour gérer les requêtes longues (produits, services)
            request_timeout: Duration::from_secs(60),
            // ✅ CORRIGÉ: Timeout DB augmenté pour requêtes complexes
            database_timeout: Duration::from_secs(30),
            // ✅ CORRIGÉ: Timeout IA augmenté pour requêtes complexes
            ai_timeout: Duration::from_secs(120),
            // ✅ CORRIGÉ: Timeout embedding augmenté
            embedding_timeout: Duration::from_secs(60),
            // ✅ CORRIGÉ: Timeout WebSocket augmenté
            websocket_timeout: Duration::from_secs(30),
            // ✅ CORRIGÉ: Timeout géocodage augmenté
            geocoding_timeout: Duration::from_secs(30),
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
            // ✅ CORRIGÉ 2026-01-12: Utiliser les nouvelles valeurs par défaut augmentées
            request_timeout: Duration::from_secs(request_timeout.unwrap_or(60)),
            database_timeout: Duration::from_secs(database_timeout.unwrap_or(30)),
            ai_timeout: Duration::from_secs(ai_timeout.unwrap_or(120)),
            embedding_timeout: Duration::from_secs(embedding_timeout.unwrap_or(60)),
            websocket_timeout: Duration::from_secs(websocket_timeout.unwrap_or(30)),
            geocoding_timeout: Duration::from_secs(geocoding_timeout.unwrap_or(30)),
        }
    }

    /// Charge la configuration depuis les variables d'environnement
    pub fn from_env() -> Self {
        // ✅ CORRIGÉ 2026-01-12: Valeurs par défaut augmentées pour gérer les requêtes longues
        let request_timeout =
            std::env::var("REQUEST_TIMEOUT").ok().and_then(|v| v.parse().ok()).unwrap_or(60);

        let database_timeout = std::env::var("DATABASE_TIMEOUT")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(30);

        let ai_timeout =
            std::env::var("AI_TIMEOUT").ok().and_then(|v| v.parse().ok()).unwrap_or(120);

        let embedding_timeout = std::env::var("EMBEDDING_TIMEOUT_SECONDS")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(60);

        let websocket_timeout = std::env::var("WEBSOCKET_TIMEOUT")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(30);

        let geocoding_timeout = std::env::var("GEOCODING_TIMEOUT")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(30);

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

// Instance globale de configuration des timeouts
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
