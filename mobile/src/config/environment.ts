// Configuration des variables d'environnement pour Yukpo Mobile
// Inspiré du frontend Vite

interface EnvironmentConfig {
    // URLs de base
    API_BASE_URL: string;

    // Endpoints d'authentification
    AUTH_LOGIN_URL: string;
    AUTH_REGISTER_URL: string;
    AUTH_VERIFY_URL: string;

    // Endpoints de recherche et IA
    SEARCH_DIRECT_URL: string;
    IA_CREATION_URL: string;
    IA_AUTO_URL: string;
    IA_ANALYZE_URL: string;

    // Configuration de débogage
    DEBUG: boolean;
    LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error';

    // Configuration de l'environnement
    ENVIRONMENT: 'development' | 'preview' | 'production';

    // Variables d'environnement Expo (équivalentes aux VITE_ du frontend)
    EXPO_PUBLIC_API_BASE_URL?: string;
    EXPO_PUBLIC_DEV_MODE?: string;
    EXPO_PUBLIC_DEBUG_TRANSLATION?: string;
}

// Configuration par défaut (production) - basée sur le frontend .env
const defaultConfig: EnvironmentConfig = {
    API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL || 'https://yukpomnang.onrender.com',
    AUTH_LOGIN_URL: '/auth/login',
    AUTH_REGISTER_URL: '/auth/register',
    AUTH_VERIFY_URL: '/api/user/me',
    SEARCH_DIRECT_URL: '/api/search/direct',
    IA_CREATION_URL: '/api/ia/creation-service',
    IA_AUTO_URL: '/api/ia/auto',
    IA_ANALYZE_URL: '/api/ia/analyze',
    DEBUG: process.env.EXPO_PUBLIC_DEV_MODE === 'true' || false,
    LOG_LEVEL: process.env.EXPO_PUBLIC_DEBUG_TRANSLATION === 'true' ? 'debug' : 'info',
    ENVIRONMENT: 'production',
    EXPO_PUBLIC_API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL,
    EXPO_PUBLIC_DEV_MODE: process.env.EXPO_PUBLIC_DEV_MODE,
    EXPO_PUBLIC_DEBUG_TRANSLATION: process.env.EXPO_PUBLIC_DEBUG_TRANSLATION,
};

// Configuration pour le développement
const developmentConfig: EnvironmentConfig = {
    ...defaultConfig,
    DEBUG: true,
    LOG_LEVEL: 'debug',
    ENVIRONMENT: 'development',
};

// Configuration pour preview
const previewConfig: EnvironmentConfig = {
    ...defaultConfig,
    DEBUG: true,
    LOG_LEVEL: 'info',
    ENVIRONMENT: 'preview',
};

// Fonction pour obtenir la configuration selon l'environnement
export const getEnvironmentConfig = (): EnvironmentConfig => {
    const environment = process.env.EXPO_PUBLIC_ENVIRONMENT || 'production';

    switch (environment) {
        case 'development':
            return developmentConfig;
        case 'preview':
            return previewConfig;
        case 'production':
        default:
            return defaultConfig;
    }
};

// Configuration exportée
export const config = getEnvironmentConfig();

// Fonctions utilitaires
export const getApiUrl = (endpoint: string): string => {
    const baseUrl = config.API_BASE_URL;
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${baseUrl}${cleanEndpoint}`;
};

export const log = (level: string, message: string, data?: any) => {
    if (config.DEBUG || config.LOG_LEVEL === 'debug') {
        console.log(`[${level.toUpperCase()}] ${message}`, data || '');
    }
};

export default config;
