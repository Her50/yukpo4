// Configuration GPS pour éviter les crashes
export const GPS_CONFIG = {
    // ✅ CRITIQUE: Désactiver temporairement le GPS automatique si crashes persistants
    AUTO_GPS_ENABLED: false, // Changez à true quand stable

    // Timeouts optimisés
    PERMISSION_TIMEOUT: 10000, // 10 secondes
    LOCATION_TIMEOUT: 15000,   // 15 secondes
    GEOCODING_TIMEOUT: 8000,   // 8 secondes

    // Précision équilibrée
    ACCURACY: 'Balanced', // 'High' | 'Balanced' | 'Low'

    // Intervalles de mise à jour
    UPDATE_INTERVAL: 5 * 60 * 1000, // 5 minutes
    DISTANCE_INTERVAL: 50, // 50 mètres
};

// Configuration générale pour éviter les crashes
export const CRASH_PREVENTION_CONFIG = {
    // Désactiver les fonctionnalités problématiques
    DISABLE_AUTO_GPS: true,        // GPS automatique au démarrage
    DISABLE_WEBSOCKET_AUTO_CONNECT: false, // WebSocket automatique
    DISABLE_IMAGE_PICKER_AUTO_PERMISSIONS: false, // Permissions images automatiques
    DISABLE_HOME_AUTOSCROLL: true, // Scroll automatique HomeScreen
    DISABLE_MIXED_CONTENT_AUTOSCROLL: false, // ✅ CORRIGÉ: Réactiver le scroll horizontal automatique du carousel mixte

    // Timeouts globaux
    API_TIMEOUT: 15000,            // 15 secondes pour les API
    GPS_TIMEOUT: 15000,            // 15 secondes pour GPS
    PERMISSION_TIMEOUT: 10000,     // 10 secondes pour permissions

    // Limites de performance
    MAX_PRODUCT_CARDS_RENDER: 20,  // Limiter le nombre de cartes produits
    MAX_FORM_FIELDS_RENDER: 50,    // Limiter les champs de formulaire
    ENABLE_PERFORMANCE_MONITORING: true, // Monitoring des performances
};

// Fonction pour vérifier si GPS est activé
export const isGPSEnabled = async (): Promise<boolean> => {
    try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        const gpsEnabled = await SafeStorage.getItem('gpsEnabled');
        return gpsEnabled !== null ? JSON.parse(gpsEnabled) : GPS_CONFIG.AUTO_GPS_ENABLED;
    } catch (error) {
        console.error('Erreur vérification GPS:', error);
        return GPS_CONFIG.AUTO_GPS_ENABLED;
    }
};
