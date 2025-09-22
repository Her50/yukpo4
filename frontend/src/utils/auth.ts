// Utilitaires d'authentification pour gérer les tokens JWT
// Correction du problème "Bearer null" dans les logs Render

/**
 * Récupère le token JWT depuis le localStorage avec validation
 * @returns Le token JWT valide ou null si invalide/absent
 */
export const getValidToken = (): string | null => {
  try {
    const token = localStorage.getItem('token');
    
    // Vérifier que le token existe et n'est pas null/undefined
    if (!token || token === 'null' || token === 'undefined' || token.trim() === '') {
      console.warn('Token JWT invalide ou manquant:', token);
      return null;
    }
    
    // Vérifier que le token a un format JWT basique (3 parties séparées par des points)
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.warn('Token JWT malformé:', token);
      return null;
    }
    
    return token;
  } catch (error) {
    console.error('Erreur lors de la récupération du token:', error);
    return null;
  }
};

/**
 * Génère les headers d'autorisation avec validation du token
 * @returns Headers d'autorisation ou headers vides si token invalide
 */
export const getAuthHeaders = (): Record<string, string> => {
  const token = getValidToken();
  
  if (!token) {
    console.warn('Aucun token valide disponible, requête non authentifiée');
    return {};
  }
  
  return {
    'Authorization': `Bearer ${token}`
  };
};

/**
 * Vérifie si l'utilisateur est authentifié
 * @returns true si un token valide existe
 */
export const isAuthenticated = (): boolean => {
  return getValidToken() !== null;
};

/**
 * Nettoie le token invalide du localStorage
 */
export const clearInvalidToken = (): void => {
  try {
    const token = localStorage.getItem('token');
    if (token === 'null' || token === 'undefined' || !token || token.trim() === '') {
      localStorage.removeItem('token');
      console.info('Token invalide supprimé du localStorage');
    }
  } catch (error) {
    console.error('Erreur lors du nettoyage du token:', error);
  }
};

/**
 * Sauvegarde un token JWT valide
 * @param token Le token JWT à sauvegarder
 */
export const setValidToken = (token: string): void => {
  try {
    if (!token || token === 'null' || token === 'undefined' || token.trim() === '') {
      console.warn('Tentative de sauvegarde d\'un token invalide:', token);
      return;
    }
    
    localStorage.setItem('token', token);
    console.info('Token JWT sauvegardé avec succès');
  } catch (error) {
    console.error('Erreur lors de la sauvegarde du token:', error);
  }
};

/**
 * Déconnecte l'utilisateur en supprimant le token
 */
export const logout = (): void => {
  try {
    localStorage.removeItem('token');
    console.info('Utilisateur déconnecté, token supprimé');
  } catch (error) {
    console.error('Erreur lors de la déconnexion:', error);
  }
};
