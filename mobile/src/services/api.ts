import AsyncStorage from '@react-native-async-storage/async-storage';

// Configuration de base
import { config } from '../config/environment';

// Gestionnaire d'erreurs
import { errorHandler } from './errorHandler';

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
    return await AsyncStorage.getItem('auth_token');
  } catch (error) {
    console.error('Erreur récupération token:', error);
    return null;
  }
};

// Fonction pour sauvegarder le token d'authentification
const saveAuthToken = async (token: string): Promise<void> => {
  try {
    await AsyncStorage.setItem('auth_token', token);
  } catch (error) {
    console.error('Erreur sauvegarde token:', error);
  }
};

// Fonction pour supprimer le token
const removeAuthToken = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem('auth_token');
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
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
    ...options,
  };

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

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
    } catch {
      data = null;
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
    // Gérer les erreurs de timeout
    if (error.name === 'AbortError') {
      const timeoutError = errorHandler.handleApiError({
        code: 'TIMEOUT',
        message: 'Request timeout'
      }, 'API Call');

      return {
        success: false,
        error: timeoutError.message,
        data: null,
      };
    }

    // Gérer les autres erreurs
    const apiError = errorHandler.handleApiError(error, 'API Call');
    return {
      success: false,
      error: apiError.message,
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
    return apiCall('/api/services/create', {
      method: 'POST',
      body: JSON.stringify(serviceData),
    });
  },

  // Obtenir les services de l'utilisateur
  getUserServices: async () => {
    return apiCall('/api/services/user');
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

  // Créer un service avec l'IA
  createServiceWithIA: async (serviceData: any) => {
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
  getDashboardPrestataire: async (period: string = 'month') => {
    return apiCall(`/api/dashboard/prestataire?period=${period}`);
  },

  // Obtenir le budget utilisateur
  getUserBudget: async () => {
    return apiCall('/api/users/budget');
  },

  // Obtenir l'historique de consommation
  getConsumptionHistory: async (userId: string, period: string = 'month') => {
    return apiCall(`/api/user/credit/history/${userId}?period=${period}`);
  },

  // Obtenir l'historique des paiements
  getPaymentsHistory: async (userId: string, period: string = 'month') => {
    return apiCall(`/api/user/payments/history/${userId}?period=${period}`);
  },
};

// ===== LOCALISATION =====

export const locationApi = {
  // Mettre à jour la position GPS
  updateLocation: async (latitude: number, longitude: number) => {
    return apiCall('/api/user/location', {
      method: 'POST',
      body: JSON.stringify({ latitude, longitude }),
    });
  },

  // Obtenir la position GPS
  getLocation: async () => {
    return apiCall('/api/user/location');
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












