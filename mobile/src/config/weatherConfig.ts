// Configuration pour l'API météo OpenWeatherMap

// URL de votre backend (ajustez selon votre configuration)
// ✅ HARMONISÉ: Utiliser la même variable que eas.json
// ✅ 2026-02-14: Migration vers GCP Cloud Run
// ⚠️ AWS (ancien backend, commenté pour utilisation future): 'https://api.yukpomnang.com'
const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL || 'https://yukpo-backend-yukpo-project.a.run.app';

// Fonction pour récupérer la clé API depuis le backend
export const getWeatherApiKey = async (): Promise<string> => {
    try {
        // ✅ CORRECTION : L'endpoint backend est /weather/config (pas /api/weather/config)
        const response = await fetch(`${BACKEND_URL}/weather/config`);

        if (!response.ok) {
            console.warn('[Weather] Erreur récupération config:', response.status);
            return 'YOUR_OPENWEATHER_API_KEY';
        }

        const data = await response.json();
        console.log('[Weather] Clé API récupérée depuis le backend:', data.apiKey ? 'Oui' : 'Non');

        return data.apiKey || 'YOUR_OPENWEATHER_API_KEY';
    } catch (error) {
        console.warn('[Weather] Impossible de récupérer la clé API depuis le backend:', error);
        return 'YOUR_OPENWEATHER_API_KEY';
    }
};

export const WEATHER_CONFIG = {
    // Clé API OpenWeatherMap - Récupérée depuis le backend
    // La clé sera récupérée dynamiquement via getWeatherApiKey()
    API_KEY: 'YOUR_OPENWEATHER_API_KEY', // Sera remplacée dynamiquement

    // URLs des APIs
    ENDPOINTS: {
        // API gratuite - 5 jours maximum
        FORECAST_5_DAYS: 'https://api.openweathermap.org/data/2.5/forecast',

        // API One Call 3.0 - 16 jours (payante)
        ONE_CALL_16_DAYS: 'https://api.openweathermap.org/data/3.0/onecall',

        // Géocodage inverse
        REVERSE_GEOCODING: 'https://api.openweathermap.org/geo/1.0/reverse'
    },

    // Paramètres par défaut
    DEFAULT_PARAMS: {
        units: 'metric', // Celsius
        lang: 'fr', // Français
        exclude: 'minutely,alerts' // Pour One Call API
    },

    // Limites selon le type d'API
    LIMITS: {
        FREE_API: 5, // Jours maximum pour l'API gratuite
        PAID_API: 16 // Jours maximum pour l'API payante
    },

    // Options de période disponibles
    AVAILABLE_PERIODS: [5, 7, 10, 16],

    // Configuration des données mockées (fallback)
    MOCK_DATA: {
        descriptions: [
            'Ensoleillé',
            'Nuageux',
            'Pluvieux',
            'Orageux',
            'Partiellement nuageux',
            'Brouillard',
            'Neige',
            'Vent fort'
        ],
        icons: ['☀️', '☁️', '\uD83C\uDF27️', '⛈️', '⛅', '\uD83C\uDF2B️', '❄️', '\uD83D\uDCA8'],
        temperatureRange: {
            min: 18,
            max: 35
        },
        humidityRange: {
            min: 40,
            max: 90
        },
        windSpeedRange: {
            min: 5,
            max: 25
        }
    }
};

// Fonction utilitaire pour obtenir l'URL complète
export const getWeatherApiUrl = (endpoint: string, params: Record<string, any>): string => {
    const baseUrl = WEATHER_CONFIG.ENDPOINTS[endpoint as keyof typeof WEATHER_CONFIG.ENDPOINTS];
    const allParams = { ...WEATHER_CONFIG.DEFAULT_PARAMS, ...params };

    const queryString = Object.entries(allParams)
        .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
        .join('&');

    return `${baseUrl}?${queryString}`;
};

// Fonction pour vérifier si l'API est configurée
export const isWeatherApiConfigured = (): boolean => {
    return WEATHER_CONFIG.API_KEY !== 'YOUR_OPENWEATHER_API_KEY' && WEATHER_CONFIG.API_KEY.length > 0;
};

// Fonction pour obtenir la période maximale selon l'API disponible
export const getMaxPeriod = (): number => {
    if (isWeatherApiConfigured()) {
        // En production, vous pourriez vérifier le type d'abonnement
        return WEATHER_CONFIG.LIMITS.PAID_API;
    }
    return WEATHER_CONFIG.LIMITS.FREE_API;
};
