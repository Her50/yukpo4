/**
 * Configuration de démarrage SÉCURISÉE pour éviter les crashes
 * Version minimale pour assurer la stabilité
 */

export const STARTUP_CONFIG = {
    // TOUTES LES FONCTIONNALITÉS RÉACTIVÉES
    ENABLE_GPS_DETECTION: true,         // ✅ Détection GPS réactivée
    ENABLE_WEBSOCKET_AUTO_CONNECT: true, // ✅ Connexion WebSocket automatique réactivée
    ENABLE_GPS_TRACKING_AUTO: true,     // ✅ Tracking GPS automatique réactivé
    ENABLE_PHOSPHOR_ICONS: true,        // ✅ Icônes Phosphor réactivées

    // Délais de démarrage (en millisecondes) - OPTIMISÉS
    WEBSOCKET_CONNECT_DELAY: 2000,      // Délai avant connexion WebSocket
    GPS_TRACKING_DELAY: 5000,           // Délai avant démarrage GPS
    LANGUAGE_DETECTION_DELAY: 1000,     // Délai pour détection langue

    // Timeouts - OPTIMISÉS
    GPS_TIMEOUT: 10000,                 // Timeout pour les requêtes GPS
    WEBSOCKET_TIMEOUT: 5000,            // Timeout pour WebSocket

    // Logs - ACTIVÉS
    ENABLE_DEBUG_LOGS: true,            // Logs de debug activés
    LOG_STARTUP_SEQUENCE: true,         // Logger la séquence de démarrage activé
};

export default STARTUP_CONFIG;
