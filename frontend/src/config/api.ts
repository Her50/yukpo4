// Configuration API pour Vite avec gestion d'erreur
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://yukpomnang.onrender.com';

// Configuration de fallback pour le développement
const FALLBACK_API_URL = 'https://jsonplaceholder.typicode.com';

// Fonction pour vérifier si le backend est accessible
export const checkBackendHealth = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/health`, {
      method: 'GET',
      timeout: 5000
    });
    return response.ok;
  } catch (error) {
    console.warn('Backend non accessible:', error);
    return false;
  }
};

// Fonction pour obtenir l'URL de l'API avec fallback
export const getApiBaseUrl = () => {
  return API_BASE_URL;
};

export { API_BASE_URL, FALLBACK_API_URL };
