// Configuration de l'environnement pour l'application mobile
export const ENVIRONMENT = {
    // Clé API Google Translate
    GOOGLE_TRANSLATE_API_KEY: process.env.EXPO_PUBLIC_GOOGLE_TRANSLATE_API_KEY || '',

    // URL de l'API backend
    API_URL: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000',

    // Environnement (development, production, staging)
    ENVIRONMENT: process.env.EXPO_PUBLIC_ENVIRONMENT || 'development',

    // Configuration de traduction
    TRANSLATION: {
        // Langue par défaut
        DEFAULT_LANGUAGE: 'fr',

        // Langues supportées
        SUPPORTED_LANGUAGES: ['fr', 'en', 'es', 'de', 'it', 'pt', 'ar', 'zh', 'ja', 'ko', 'ru', 'hi'],

        // Cache de traduction (en millisecondes)
        CACHE_DURATION: 24 * 60 * 60 * 1000, // 24 heures

        // Taille maximale du cache
        MAX_CACHE_SIZE: 1000,
    },

    // Configuration GPS
    GPS: {
        // Timeout pour la détection GPS (en millisecondes)
        TIMEOUT: 10000,

        // Précision maximale
        MAXIMUM_AGE: 300000, // 5 minutes

        // Rayon de recherche par défaut (en kilomètres)
        DEFAULT_SEARCH_RADIUS: 50,
    },

    // Configuration de l'API
    API: {
        // Timeout des requêtes (en millisecondes)
        TIMEOUT: 30000,

        // Nombre de tentatives en cas d'échec
        MAX_RETRIES: 3,

        // Délai entre les tentatives (en millisecondes)
        RETRY_DELAY: 1000,
    },
};

export default ENVIRONMENT;

