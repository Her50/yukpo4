// Configuration API pour Vite avec gestion d'erreur
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (
  // En production (Vercel ou Netlify), utiliser des URLs relatives pour profiter des rewrites
  typeof window !== 'undefined' && (
    window.location.hostname.includes('vercel.app') || 
    window.location.hostname.includes('netlify.app')
  ) 
    ? '' 
    : 'https://yukpomnang.onrender.com'
);

// Configuration de fallback pour le d�veloppement
const FALLBACK_API_URL = 'https://jsonplaceholder.typicode.com';

// Fonction pour v�rifier si le backend est accessible
export const checkBackendHealth = async () => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`${API_BASE_URL}/healthz`, {
      method: 'GET',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
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
