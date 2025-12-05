// Configuration de l'environnement pour l'application mobile
export const ENVIRONMENT = {
    // Clé API Google Translate
    GOOGLE_TRANSLATE_API_KEY: process.env.EXPO_PUBLIC_GOOGLE_TRANSLATE_API_KEY || '',

    // Clé API Google Maps (Places, Geocoding, etc.)
    GOOGLE_MAPS_API_KEY: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || 'AIzaSyDFfWEq1Umm06SNTbR-cRhRQ5Sq_taEAWQ',

    // URL de l'API backend - Configurable via .env
    // Par défaut: Render (production)
    // Pour développement local: http://localhost:3000
    // Pour autre serveur: définir EXPO_PUBLIC_API_BASE_URL dans .env
    API_URL: process.env.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_BASE_URL || 'https://yukpomnang.onrender.com',
    UPLOAD_BASE_URL: process.env.EXPO_PUBLIC_UPLOAD_BASE_URL || process.env.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_BASE_URL || 'https://yukpomnang.onrender.com',

    // Environnement (development, production, staging)
    ENVIRONMENT: process.env.EXPO_PUBLIC_ENVIRONMENT || 'production',

    // CDN Configuration
    // ⚠️ Architecture : Cloudflare (CDN) lit depuis Wasabi (Storage)
    // Cloudflare = Distribution optimale | Wasabi = Stockage source
    CDN_CLOUDFLARE_URL: process.env.EXPO_PUBLIC_CDN_CLOUDFLARE_URL || 'https://cdn.yukpomnang.com',
    WASABI_DIRECT_URL: process.env.EXPO_PUBLIC_WASABI_DIRECT_URL || 'https://yukpo-video-prod.s3.eu-central-1.wasabisys.com',

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

    // Configuration Sagaci Research (Base de données produits africains)
    SAGACI: {
        // Clé API Sagaci (à obtenir via contact commercial)
        API_KEY: process.env.EXPO_PUBLIC_SAGACI_API_KEY || '',

        // URL API Sagaci (à confirmer avec Sagaci)
        API_URL: process.env.EXPO_PUBLIC_SAGACI_API_URL || 'https://api.sagaciresearch.com/v1',

        // Activer/désactiver Sagaci
        ENABLED: process.env.EXPO_PUBLIC_SAGACI_ENABLED === 'true',

        // Pays par défaut
        DEFAULT_COUNTRY: 'CM', // Cameroun

        // Cache (durée en millisecondes)
        CACHE_TTL: 3600000, // 1 heure

        // Rayon de recherche géographique par défaut (km)
        DEFAULT_RADIUS_KM: 20,
    },
};

// Configuration pour l'API
export const config = {
    API_BASE_URL: ENVIRONMENT.API_URL,
    ENVIRONMENT: ENVIRONMENT.ENVIRONMENT,
    GOOGLE_TRANSLATE_API_KEY: ENVIRONMENT.GOOGLE_TRANSLATE_API_KEY,
    GOOGLE_MAPS_API_KEY: ENVIRONMENT.GOOGLE_MAPS_API_KEY,
    UPLOAD_BASE_URL: ENVIRONMENT.UPLOAD_BASE_URL,
};

export default ENVIRONMENT;

