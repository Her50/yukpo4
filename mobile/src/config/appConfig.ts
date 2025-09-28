// Configuration de l'application mobile Yukpomnang
// Pour résoudre les problèmes de navigation et d'authentification

export const APP_CONFIG = {
  // Configuration API
  API_BASE_URL: process.env.EXPO_PUBLIC_API_URL || 'https://yukpomnang.onrender.com',
  
  // Timeouts et délais
  AUTH_TIMEOUT: 10000, // 10 secondes pour l'authentification
  API_TIMEOUT: 15000,  // 15 secondes pour les appels API
  LOADING_TIMEOUT: 5000, // 5 secondes maximum pour le loading
  
  // Configuration de navigation
  NAVIGATION: {
    // Délai avant de considérer qu'une navigation a échoué
    NAVIGATION_TIMEOUT: 3000,
    // Nombre de tentatives de navigation
    MAX_NAVIGATION_RETRIES: 3,
  },
  
  // Configuration d'authentification
  AUTH: {
    // Délai avant de vérifier l'état d'authentification
    AUTH_CHECK_DELAY: 100,
    // Délai avant de forcer la fin du loading
    FORCE_LOADING_END_DELAY: 5000,
  },
  
  // Configuration de débogage
  DEBUG: {
    // Activer les logs détaillés
    ENABLE_DETAILED_LOGS: true,
    // Activer les logs de navigation
    ENABLE_NAVIGATION_LOGS: true,
    // Activer les logs d'authentification
    ENABLE_AUTH_LOGS: true,
  },
  
  // Configuration des erreurs
  ERROR_HANDLING: {
    // Afficher les erreurs en mode développement
    SHOW_ERRORS_IN_DEV: true,
    // Délai avant de réessayer une opération échouée
    RETRY_DELAY: 2000,
  },
  
  // Configuration WebSocket
  WEBSOCKET: {
    // Activer les WebSockets
    ENABLED: true,
    // Timeout de connexion
    CONNECTION_TIMEOUT: 10000,
    // Délai de reconnexion
    RECONNECT_DELAY: 1000,
    // Nombre maximum de tentatives de reconnexion
    MAX_RECONNECT_ATTEMPTS: 5,
    // Délai maximum de reconnexion
    MAX_RECONNECT_DELAY: 30000,
  },
};

// Fonctions utilitaires
export const log = (category: string, message: string, data?: any) => {
  if (APP_CONFIG.DEBUG.ENABLE_DETAILED_LOGS) {
    console.log(`[${category.toUpperCase()}] ${message}`, data || '');
  }
};

export const logNavigation = (message: string, data?: any) => {
  if (APP_CONFIG.DEBUG.ENABLE_NAVIGATION_LOGS) {
    console.log(`[NAVIGATION] ${message}`, data || '');
  }
};

export const logAuth = (message: string, data?: any) => {
  if (APP_CONFIG.DEBUG.ENABLE_AUTH_LOGS) {
    console.log(`[AUTH] ${message}`, data || '');
  }
};

export const logGeneral = (message: string, data?: any) => {
  if (APP_CONFIG.DEBUG.ENABLE_DETAILED_LOGS) {
    console.log(`[GENERAL] ${message}`, data || '');
  }
};

// Fonction pour créer un timeout avec gestion d'erreur
export const createTimeout = (ms: number, message: string): Promise<never> => {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Timeout: ${message} (${ms}ms)`));
    }, ms);
  });
};

// Fonction pour retry avec délai
export const retryWithDelay = async <T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = APP_CONFIG.ERROR_HANDLING.RETRY_DELAY
): Promise<T> => {
  let lastError: Error;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      log('RETRY', `Tentative ${i + 1}/${maxRetries} échouée:`, error);
      
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError!;
};

export default APP_CONFIG;
