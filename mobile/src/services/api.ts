import AsyncStorage from '@react-native-async-storage/async-storage';

// Configuration de base - Valeurs par défaut
import { config } from '../config/environment';

// Utilise la configuration centralisée

// Gestionnaire d'erreurs - Fallback
const errorHandler = {
  handleApiError: (error: any, context?: string) => ({
    message: error?.message || 'Une erreur inattendue s\'est produite',
    status: 500,
    code: 'UNKNOWN_ERROR'
  })
};

const API_BASE_URL = config.API_BASE_URL;

// Types pour les réponses API
interface ApiResponse<T = any> {
  data?: T;
  success?: boolean;
  message?: string;
  error?: string;
}

// Fonction pour récupérer le token d'authentification
const getAuthToken = async (): Promise<string | null> => {
  try {
    if (AsyncStorage && typeof AsyncStorage.getItem === 'function') {
      return await AsyncStorage.getItem('auth_token');
    }
    return null;
  } catch (error) {
    console.error('Erreur récupération token:', error);
    return null;
  }
};

// Fonction pour sauvegarder le token d'authentification
const saveAuthToken = async (token: string): Promise<void> => {
  try {
    if (AsyncStorage && typeof AsyncStorage.setItem === 'function') {
      await AsyncStorage.setItem('auth_token', token);
    }
  } catch (error) {
    console.error('Erreur sauvegarde token:', error);
  }
};

// Fonction pour supprimer le token
const removeAuthToken = async (): Promise<void> => {
  try {
    if (AsyncStorage && typeof AsyncStorage.removeItem === 'function') {
      await AsyncStorage.removeItem('auth_token');
    }
  } catch (error) {
    console.error('Erreur suppression token:', error);
  }
};

// Fonction générique pour les appels API
const apiCall = async <T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> => {
  const token = await getAuthToken();

  const config: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'Yukpomnang-Mobile/1.0.0',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
    ...options,
  };

  try {
    // Vérifier si fetch est disponible
    if (typeof fetch !== 'function') {
      throw new Error('Fetch API non disponible');
    }

    // Debug: Log the URL being used
    console.log(`[Mobile API] Making request to: ${API_BASE_URL}${endpoint}`);
    console.log(`[Mobile API] Request headers:`, config.headers);

    // ✅ CORRECTION: Timeout adaptatif selon l'endpoint
    const controller = new AbortController();
    // Timeout adapté pour création service (upload médias + vectorisation + IA)
    // 180s (3 min) nécessaire pour :
    // - Upload 60-100 MB en 3G : 96-160s
    // - Traitement backend : 20-50s
    const timeoutDuration = endpoint.includes('/services/create') ? 180000 : 15000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutDuration);

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...config,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Vérifier si le token a été mis à jour
    const newToken = response.headers.get('x-new-jwt');
    if (newToken) {
      await saveAuthToken(newToken);
    }

    // Vérifier le solde de tokens
    const tokensRemaining = response.headers.get('x-tokens-remaining');
    if (tokensRemaining) {
      await AsyncStorage.setItem('tokens_balance', tokensRemaining);
    }

    let data;
    try {
      data = await response.json();
    } catch (jsonError) {
      console.error(`[Mobile API] Erreur parsing JSON pour ${endpoint}:`, jsonError);
      console.error(`[Mobile API] Response status: ${response.status}`);
      console.error(`[Mobile API] Response headers:`, Object.fromEntries(response.headers.entries()));

      // Essayer de récupérer le texte brut
      try {
        const textData = await response.text();
        console.error(`[Mobile API] Response text:`, textData);
        data = { error: 'Invalid JSON response', raw: textData };
      } catch (textError) {
        console.error(`[Mobile API] Impossible de lire la réponse:`, textError);
        data = { error: 'Unable to read response' };
      }
    }

    if (!response.ok) {
      return {
        success: false,
        error: data?.message || `Erreur ${response.status}`,
        data: data,
      };
    }

    return {
      success: true,
      data: data,
    };
  } catch (error: any) {
    console.error(`[Mobile API] Erreur pour ${endpoint}:`, error);

    // Gérer les erreurs de timeout
    if (error.name === 'AbortError') {
      console.error(`[Mobile API] Timeout pour ${endpoint}`);
      return {
        success: false,
        error: 'La requête a expiré. Vérifiez votre connexion internet.',
        data: null,
      };
    }

    // Gérer les erreurs de réseau
    if (error.message === 'Failed to fetch' || error.message.includes('NetworkError')) {
      console.error(`[Mobile API] Erreur réseau pour ${endpoint}`);
      return {
        success: false,
        error: 'Impossible de se connecter au serveur. Vérifiez votre connexion internet.',
        data: null,
      };
    }

    // Gérer les autres erreurs
    const apiError = errorHandler.handleApiError(error, 'API Call');
    return {
      success: false,
      error: apiError.message || 'Une erreur inattendue s\'est produite',
      data: null,
    };
  }
};

// ===== AUTHENTIFICATION =====

export const authApi = {
  // Connexion
  login: async (email: string, password: string) => {
    const response = await apiCall<{ token: string; tokens_balance: number }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (response.data?.token) {
      await saveAuthToken(response.data.token);
      if (response.data.tokens_balance !== undefined) {
        await AsyncStorage.setItem('tokens_balance', response.data.tokens_balance.toString());
      }
    }

    return response;
  },

  // Inscription (identique au frontend)
  register: async (userData: {
    name: string;
    email: string;
    password: string;
    phone?: string;
  }) => {
    // Payload identique au frontend
    const payload = {
      nom: userData.name,
      prenom: userData.name,
      name: userData.name,
      email: userData.email,
      password: userData.password,
      lang: 'fr',
    };

    const response = await apiCall<{ success?: boolean; token?: string; tokens_balance?: number; message?: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    console.log('[API] Réponse inscription:', response);

    // Si le backend retourne directement un token (comme le frontend), le traiter
    if (response.data?.token) {
      await saveAuthToken(response.data.token);
      if (response.data.tokens_balance !== undefined) {
        await AsyncStorage.setItem('tokens_balance', response.data.tokens_balance.toString());
      }
      return { success: true, data: response.data };
    }

    return response;
  },

  // Déconnexion
  logout: async () => {
    await removeAuthToken();
    await AsyncStorage.removeItem('tokens_balance');
  },

  // Vérifier le token et récupérer les infos utilisateur
  verifyToken: async () => {
    return apiCall('/api/user/me');
  },
};

// ===== SERVICES =====

export const servicesApi = {
  // Recherche directe de services
  searchDirect: async (searchData: any) => {
    return apiCall('/api/search/direct', {
      method: 'POST',
      body: JSON.stringify(searchData),
    });
  },

  // Créer un service
  createService: async (serviceData: any) => {
    // ✅ CORRECTION : Le backend attend { user_id, data }
    // Extraire user_id si présent dans serviceData, sinon le récupérer du token
    let userId = serviceData.user_id;

    if (!userId) {
      // Récupérer user_id depuis le token
      const token = await getAuthToken();
      if (token) {
        try {
          const tokenData = JSON.parse(atob(token.split('.')[1]));
          userId = tokenData.sub || tokenData.user_id || tokenData.id;
        } catch (e) {
          console.error('[API] Impossible de récupérer user_id du token');
        }
      }
    }

    // Retirer user_id de serviceData s'il existe pour éviter de le dupliquer
    const { user_id, ...dataOnly } = serviceData;

    // ✅ CORRECTION: Timeout de 60s automatique pour /services/create
    return apiCall('/api/services/create', {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        data: dataOnly // ✅ Encapsuler les données dans 'data'
      })
    });
  },

  // Obtenir les services de l'utilisateur (prestataire)
  getUserServices: async () => {
    return apiCall('/api/prestataire/services');
  },

  // Obtenir un service par ID
  getServiceById: async (serviceId: string) => {
    return apiCall(`/api/services/${serviceId}`);
  },

  // Mettre à jour un service
  updateService: async (serviceId: string, serviceData: any) => {
    return apiCall(`/api/services/${serviceId}`, {
      method: 'PUT',
      body: JSON.stringify(serviceData),
    });
  },

  // Supprimer un service
  deleteService: async (serviceId: string) => {
    return apiCall(`/api/services/${serviceId}/delete`, {
      method: 'DELETE',
    });
  },

  // Obtenir les services avec lesquels l'utilisateur a interagi
  getInteractedServices: async () => {
    return apiCall('/api/services/interacted');
  },

  // Obtenir les services d'un prestataire
  getPrestataireServices: async (prestataireId: string) => {
    return apiCall(`/api/services/prestataire/${prestataireId}`);
  },
};

// ===== IA =====

export const iaApi = {
  // Chat avec l'IA
  chat: async (message: string) => {
    return apiCall('/api/ia/chat', {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  },

  // Créer un service avec l'IA (vectorisation)
  createServiceWithIA: async (serviceData: any) => {
    return apiCall('/api/services/vectorize', {
      method: 'POST',
      body: JSON.stringify(serviceData),
    });
  },

  // Créer un service avec l'IA (génération de formulaire)
  generateServiceForm: async (serviceData: any) => {
    return apiCall('/api/ia/creation-service', {
      method: 'POST',
      body: JSON.stringify(serviceData),
    });
  },

  // Générer des suggestions de service
  generateServiceSuggestions: async (prompt: string) => {
    return apiCall('/api/ia/suggestions', {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    });
  },

  // Créer un brouillon de service
  createServiceDraft: async (donnees: any) => {
    return apiCall('/api/services/draft', {
      method: 'POST',
      body: JSON.stringify(donnees),
    });
  },

  // Récupérer les médias d'un service
  getServiceMedia: async (serviceId: string | number) => {
    return apiCall(`/api/services/${serviceId}/media`);
  },

  // Récupérer les statistiques d'un service
  getServiceStats: async (serviceId: string | number) => {
    return apiCall(`/api/services/${serviceId}/stats`);
  },

  // Suggérer des mots-clés
  suggestKeywords: async (text: string) => {
    return apiCall('/api/ia/keywords', {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
  },

  // Transcrire de l'audio
  transcribeAudio: async (audioData: string) => {
    return apiCall('/api/ia/transcribe', {
      method: 'POST',
      body: JSON.stringify({ audio: audioData }),
    });
  },
};

// ===== UTILISATEUR =====

export const userApi = {
  // Obtenir le profil utilisateur
  getUserProfile: async () => {
    return apiCall('/api/user/me');
  },

  // Mettre à jour le profil utilisateur
  updateUserProfile: async (profileData: any) => {
    return apiCall('/api/user/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData),
    });
  },

  // Obtenir le solde de tokens
  getTokensBalance: async () => {
    return apiCall('/api/users/balance');
  },

  // Recharger des tokens
  rechargeTokens: async (amount: number) => {
    return apiCall('/api/users/recharge', {
      method: 'POST',
      body: JSON.stringify({ amount }),
    });
  },

  // Déduire du solde
  deductBalance: async (amount: number, reason: string) => {
    return apiCall('/api/users/deduct-balance', {
      method: 'POST',
      body: JSON.stringify({ amount, reason }),
    });
  },

  // Obtenir le dashboard prestataire
  getDashboardPrestataire: async (period: string = '30d') => {
    return apiCall(`/api/dashboard/prestataire?period=${period}`);
  },
  getPreviousContacts: async () => {
    return apiCall('/api/user/previous-contacts');
  },
  saveContact: async (contact: any) => {
    return apiCall('/api/user/contacts', 'POST', contact);
  },
  getCreditHistory: async (userId: string, period: string = '30d') => {
    return apiCall(`/api/users/consumption-history?period=${period}`);
  },
  getPaymentsHistory: async (userId: string, period: string = '30d') => {
    return apiCall(`/api/users/payment-history?period=${period}`);
  },
  toggleServiceStatus: async (serviceId: number, isActive: boolean) => {
    return apiCall(`/api/services/${serviceId}/toggle-status`, 'PATCH', { actif: isActive });
  },
  deleteService: async (serviceId: number) => {
    return apiCall(`/api/services/${serviceId}/delete`, 'DELETE');
  },
  updateServicePromotion: async (serviceId: number, promotionData: any) => {
    return apiCall(`/api/services/${serviceId}/promotion`, 'PATCH', promotionData);
  },

  // Obtenir les services de l'utilisateur (prestataire)
  getUserServices: async () => {
    return apiCall('/api/prestataire/services');
  },

  // Obtenir le budget utilisateur
  getUserBudget: async () => {
    return apiCall('/api/users/budget');
  },

  // Obtenir l'historique de consommation
  getConsumptionHistory: async (userId: string, period: string = 'month') => {
    return apiCall(`/api/user/credit/history/${userId}?period=${period}`);
  },

  // Gestion des favoris
  getUserFavorites: async (userId: string) => {
    return apiCall(`/api/users/${userId}/favorites`);
  },

  addFavorite: async (serviceId: string) => {
    return apiCall('/api/favorites', {
      method: 'POST',
      body: JSON.stringify({ service_id: serviceId }),
    });
  },

  removeFavorite: async (favoriteId: string) => {
    return apiCall(`/api/favorites/${favoriteId}`, {
      method: 'DELETE',
    });
  },
};

// ===== LOCALISATION =====

export const locationApi = {
  // Mettre à jour la position GPS - CORRIGÉ pour correspondre au backend
  updateLocation: async (latitude: number, longitude: number) => {
    return apiCall('/api/user/me/gps_location', {
      method: 'PATCH',
      body: JSON.stringify({ latitude, longitude }),
    });
  },

  // Obtenir la position GPS - CORRIGÉ pour correspondre au backend
  getLocation: async () => {
    return apiCall('/api/user/me/gps_location');
  },
};

// ===== NOTIFICATIONS =====

export const notificationsApi = {
  // Obtenir l'historique des notifications
  getNotificationHistory: async () => {
    return apiCall('/api/notifications/history');
  },

  // Obtenir les notifications (alias pour compatibilité)
  getNotifications: async () => {
    return apiCall('/api/notifications/history');
  },

  // Marquer une notification comme lue
  markAsRead: async (notificationId: string) => {
    return apiCall(`/api/notifications/${notificationId}/read`, {
      method: 'POST',
    });
  },

  // Marquer toutes les notifications comme lues
  markAllAsRead: async () => {
    return apiCall('/api/notifications/mark-all-read', {
      method: 'POST',
    });
  },

  // Supprimer une notification
  deleteNotification: async (notificationId: string) => {
    return apiCall(`/api/notifications/${notificationId}`, {
      method: 'DELETE',
    });
  },

  // Obtenir l'historique des chats
  getChatHistory: async (clientId: string, prestataireId: string) => {
    return apiCall(`/api/chat/history/${clientId}/${prestataireId}`);
  },

  // Envoyer un message audio
  sendAudioMessage: async (audioData: string, recipientId: string) => {
    return apiCall('/api/chat/audio', {
      method: 'POST',
      body: JSON.stringify({ audio: audioData, recipientId }),
    });
  },
};

// Export pour compatibilité avec les anciens imports
export const aiService = {
  chat: async (message: string) => {
    return apiCall('/api/ia/chat', {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  },
};

// Export pour compatibilité avec les anciens imports
export const apiPost = async <T>(endpoint: string, data: any): Promise<ApiResponse<T>> => {
  return apiCall<T>(endpoint, {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

// Export pour compatibilité avec les anciens imports  
export const apiGet = async <T>(endpoint: string): Promise<ApiResponse<T>> => {
  return apiCall<T>(endpoint, {
    method: 'GET',
  });
};

// ✅ AJOUT: apiPatch pour les mises à jour partielles
export const apiPatch = async <T>(endpoint: string, data?: any): Promise<ApiResponse<T>> => {
  return apiCall<T>(endpoint, {
    method: 'PATCH',
    body: data ? JSON.stringify(data) : undefined,
  });
};

// ✅ AJOUT: apiPut pour les mises à jour complètes
export const apiPut = async <T>(endpoint: string, data: any): Promise<ApiResponse<T>> => {
  return apiCall<T>(endpoint, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
};

// ✅ AJOUT: apiDelete pour les suppressions
export const apiDelete = async <T>(endpoint: string): Promise<ApiResponse<T>> => {
  return apiCall<T>(endpoint, {
    method: 'DELETE',
  });
};

// Export pour compatibilité avec les anciens imports
export const serviceService = servicesApi;

export default {
  authApi,
  servicesApi,
  iaApi,
  userApi,
  locationApi,
  notificationsApi,
  aiService,
  serviceService,
};













