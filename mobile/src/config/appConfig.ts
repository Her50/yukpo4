// Configuration de l'application mobile
export const appConfig = {
  // Version de l'application
  version: '1.0.0',

  // Configuration de l'API
  api: {
    baseUrl: process.env.EXPO_PUBLIC_API_URL || 'https://yukpomnang.onrender.com',
    timeout: 30000,
    retries: 3
  },

  // Configuration de l'authentification
  auth: {
    tokenKey: 'auth_token',
    refreshTokenKey: 'refresh_token'
  },

  // Configuration du cache
  cache: {
    maxSize: 1000,
    defaultTTL: 24 * 60 * 60 * 1000 // 24 heures
  }
};

// Fonction de log sécurisée
export const logGeneral = (message: string, data?: any) => {
  if (__DEV__) {
    console.log(`[AppConfig] ${message}`, data);
  }
};

// Fonction de log d'erreur
export const logError = (message: string, error?: any) => {
  if (__DEV__) {
    console.error(`[AppConfig] ${message}`, error);
  }
};

// Fonction de log de debug
export const logDebug = (message: string, data?: any) => {
  if (__DEV__) {
    console.debug(`[AppConfig] ${message}`, data);
  }
};

export default appConfig;