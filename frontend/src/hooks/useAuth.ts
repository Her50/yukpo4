// Hook personnalisé pour gérer l'authentification
// Remplace les appels directs à localStorage.getItem('token')

import { useState, useEffect, useCallback } from 'react';
import { getValidToken, setValidToken, clearInvalidToken, isAuthenticated, logout as authLogout } from '../utils/auth';

interface AuthState {
  isAuthenticated: boolean;
  token: string | null;
  isLoading: boolean;
}

export const useAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    token: null,
    isLoading: true
  });

  // Vérifier l'état d'authentification au montage du composant
  useEffect(() => {
    const checkAuth = () => {
      const token = getValidToken();
      setAuthState({
        isAuthenticated: token !== null,
        token,
        isLoading: false
      });
    };

    checkAuth();
  }, []);

  // Fonction pour se connecter
  const login = useCallback((token: string) => {
    setValidToken(token);
    setAuthState({
      isAuthenticated: true,
      token,
      isLoading: false
    });
  }, []);

  // Fonction pour se déconnecter
  const logout = useCallback(() => {
    authLogout();
    setAuthState({
      isAuthenticated: false,
      token: null,
      isLoading: false
    });
  }, []);

  // Fonction pour obtenir les headers d'autorisation
  const getAuthHeaders = useCallback((): Record<string, string> => {
    if (!authState.token) {
      return {};
    }
    return {
      'Authorization': `Bearer ${authState.token}`
    };
  }, [authState.token]);

  // Fonction pour nettoyer les tokens invalides
  const cleanInvalidToken = useCallback(() => {
    clearInvalidToken();
    setAuthState(prev => ({
      ...prev,
      isAuthenticated: false,
      token: null
    }));
  }, []);

  return {
    ...authState,
    login,
    logout,
    getAuthHeaders,
    cleanInvalidToken
  };
};
