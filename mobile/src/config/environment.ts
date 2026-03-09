import { Platform } from 'react-native';

// Configuration de l'environnement pour l'application mobile
export const ENVIRONMENT = {
    // Clé API Google Translate
    GOOGLE_TRANSLATE_API_KEY: process.env.EXPO_PUBLIC_GOOGLE_TRANSLATE_API_KEY || '',

    // Clés API Google Maps (Places, Geocoding, etc.)
    // ✅ 2026-02-25: Clés séparées Android/iOS (restreintes par package/bundle ID)
    // Les clés Maps côté client sont publiques par nature — protégées par restrictions plateforme
    // ✅ CORRIGÉ 2026-03-01: Détecter les placeholders 'SET_VIA_EAS_SECRET_OR_ENV' qui ne sont pas de vraies clés
    GOOGLE_MAPS_API_KEY: (() => {
        const ANDROID_KEY = 'AIzaSyDqlMAysWsGzv1jQtR6WJn8LZXpH75SwFo';
        const IOS_KEY = 'AIzaSyBHGQavkIvn0pgj52WuTEapSkdKUmljqs8';
        const fallbackKey = Platform.OS === 'ios' ? IOS_KEY : ANDROID_KEY;
        const envKey = Platform.OS === 'ios'
            ? process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_API_KEY
            : process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
        // Si la clé env est absente, vide, ou un placeholder → utiliser le fallback
        if (!envKey || envKey === 'SET_VIA_EAS_SECRET_OR_ENV' || !envKey.startsWith('AIza')) {
            return fallbackKey;
        }
        return envKey;
    })(),

    // URL de l'API backend - Configurable via .env
    // ✅ 2026-02-14: Migration vers GCP Cloud Run
    // Backend GCP: https://yukpo-backend-yukpo-project.a.run.app
    // ⚠️ AWS (ancien backend, commenté pour utilisation future):
    // - https://api.yukpomnang.com (Cloudflare → AWS ECS)
    // - https://yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com (AWS ALB direct)
    // Pour développement local: http://localhost:3000
    // Pour autre serveur: définir EXPO_PUBLIC_API_BASE_URL dans .env
    API_URL: process.env.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_BASE_URL || 'https://yukpo-backend-mkzqhoqhaq-ew.a.run.app',
    // API_URL: process.env.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_BASE_URL || 'https://api.yukpomnang.com',  // ⚠️ AWS (ancien)
    UPLOAD_BASE_URL: process.env.EXPO_PUBLIC_UPLOAD_BASE_URL || 'https://storage.googleapis.com/yukpo-project-yukpo-backend-media',  // GCP Cloud Storage HTTPS
    // UPLOAD_BASE_URL: process.env.EXPO_PUBLIC_UPLOAD_BASE_URL || 'https://cdn.yukpomnang.com',  // ⚠️ AWS CDN (ancien)

    // Environnement (development, production, staging)
    ENVIRONMENT: process.env.EXPO_PUBLIC_ENVIRONMENT || 'production',

    // CDN Configuration
    // ✅ 2026-02-14: Migration vers GCP Cloud CDN
    // GCP Cloud CDN: http://34.54.117.97 (Load Balancer → Cloud Storage)
    // ⚠️ AWS/Wasabi (ancien, commenté pour utilisation future):
    // - Cloudflare CDN: https://cdn.yukpomnang.com (Cloudflare → Wasabi)
    // - Wasabi Direct: https://yukpo-video-prod.s3.eu-central-1.wasabisys.com
    // - AWS S3 Direct: https://yukpo-backend-media.s3.eu-west-1.amazonaws.com
    CDN_GCP_URL: process.env.EXPO_PUBLIC_CDN_GCP_URL || 'https://storage.googleapis.com/yukpo-project-yukpo-backend-media',
    // ✅ GCP Cloud Storage Direct (remplace WASABI_DIRECT_URL)
    GCP_STORAGE_DIRECT_URL: process.env.EXPO_PUBLIC_GCP_STORAGE_DIRECT_URL || process.env.EXPO_PUBLIC_WASABI_DIRECT_URL || 'https://storage.googleapis.com/yukpo-project-yukpo-backend-media',
    // ⚠️ AWS/Wasabi (ancien, commenté pour utilisation future)
    // CDN_CLOUDFLARE_URL: process.env.EXPO_PUBLIC_CDN_CLOUDFLARE_URL || 'https://cdn.yukpomnang.com',
    // WASABI_DIRECT_URL: process.env.EXPO_PUBLIC_WASABI_DIRECT_URL || 'https://yukpo-video-prod.s3.eu-central-1.wasabisys.com',
    // AWS_S3_DIRECT_URL: process.env.EXPO_PUBLIC_AWS_S3_DIRECT_URL || 'https://yukpo-backend-media.s3.eu-west-1.amazonaws.com',

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

