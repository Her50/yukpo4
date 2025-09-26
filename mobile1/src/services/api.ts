import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

// Configuration de base de l'API - Aligné avec le frontend
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://yukpomnang.onrender.com';

export const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: parseInt(process.env.EXPO_PUBLIC_API_TIMEOUT || '15000'),
    headers: {
        'Content-Type': 'application/json',
    },
});

// Intercepteur pour ajouter le token d'authentification
api.interceptors.request.use(
    async (config) => {
        try {
            const token = await AsyncStorage.getItem('authToken');
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
        } catch (error) {
            console.error('Erreur lors de la récupération du token:', error);
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Intercepteur pour gérer les réponses d'erreur
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        if (error.response?.status === 401) {
            // Token expiré ou invalide
            await AsyncStorage.removeItem('authToken');
            // Rediriger vers la page de connexion si nécessaire
        }
        return Promise.reject(error);
    }
);

// Services API
export const authService = {
    login: (email: string, password: string) =>
        api.post('/auth/login', { email, password }),

    register: (name: string, email: string, password: string) =>
        api.post('/auth/register', { name, email, password }),

    logout: () => api.post('/auth/logout'),

    refreshToken: () => api.post('/auth/refresh'),
};

export const serviceService = {
    getServices: (params?: any) => api.get('/services', { params }),

    getServiceById: (id: string) => api.get(`/services/${id}`),

    createService: (serviceData: any) => api.post('/services', serviceData),

    updateService: (id: string, serviceData: any) =>
        api.put(`/services/${id}`, serviceData),

    deleteService: (id: string) => api.delete(`/services/${id}`),

    searchServices: (query: string, location?: any) =>
        api.post('/services/search', { query, location }),

    getUserServices: () => api.get('/services/user'),
};

export const aiService = {
    processRequest: (input: any) => api.post('/ai/process', input),

    generateSuggestions: (query: string) =>
        api.post('/ai/suggestions', { query }),

    translateText: (text: string, targetLang: string) =>
        api.post('/ai/translate', { text, targetLang }),
};

export const locationService = {
    geocode: (address: string) => api.get('/geocoding', { params: { address } }),

    reverseGeocode: (lat: number, lng: number) =>
        api.post('/api/geocoding/reverse', { latitude: lat, longitude: lng }),

    searchNearby: (lat: number, lng: number, radius: number = 5000) =>
        api.get('/services/nearby', { params: { lat, lng, radius } }),
};

export const userService = {
    getProfile: () => api.get('/user/profile'),

    updateProfile: (userData: any) => api.put('/user/profile', userData),

    getTokens: () => api.get('/user/tokens'),

    rechargeTokens: (amount: number) => api.post('/user/recharge', { amount }),
};

// Service de traduction - Aligné avec le frontend
export const translationService = {
    translateText: (text: string, targetLanguage: string, sourceLanguage?: string) => {
        const apiKey = process.env.EXPO_PUBLIC_GOOGLE_TRANSLATE_API_KEY;
        if (!apiKey) {
            console.warn('Clé API Google Translate non configurée');
            return Promise.resolve({
                translatedText: text,
                detectedLanguage: 'unknown',
                confidence: 0
            });
        }

        return fetch(`https://translation.googleapis.com/language/translate/v2?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                q: text,
                target: targetLanguage,
                source: sourceLanguage,
                format: 'text'
            })
        }).then(response => response.json());
    }
};

// Service WebSocket - Aligné avec le frontend
export const websocketService = {
    connect: () => {
        const wsUrl = process.env.EXPO_PUBLIC_WS_URL || 'wss://yukpomnang.onrender.com/ws';
        return new WebSocket(wsUrl);
    }
};

// Service de géocodage avancé - Aligné avec le frontend
export const geocodingService = {
    getLocationFromCoordinates: async (lat: number, lng: number) => {
        try {
            const response = await api.post('/api/geocoding/reverse', {
                latitude: lat,
                longitude: lng
            });
            return response.data.formatted_address;
        } catch (error) {
            console.error('Erreur géocodage:', error);
            return `${lat.toFixed(3)}, ${lng.toFixed(3)}`;
        }
    }
};

export default api;
