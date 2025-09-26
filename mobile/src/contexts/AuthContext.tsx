import AsyncStorage from '@react-native-async-storage/async-storage';
import { jwtDecode } from 'jwt-decode';
import * as React from 'react';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { authApi } from '../services/api';
import { APP_CONFIG, logAuth, createTimeout } from '../config/appConfig';

// Fonctions de gestion du token
const getAuthToken = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem('auth_token');
  } catch (error) {
    console.error('Erreur récupération token:', error);
    return null;
  }
};

const saveAuthToken = async (token: string): Promise<void> => {
  try {
    await AsyncStorage.setItem('auth_token', token);
  } catch (error) {
    console.error('Erreur sauvegarde token:', error);
  }
};

const removeAuthToken = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem('auth_token');
  } catch (error) {
    console.error('Erreur suppression token:', error);
  }
};

interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  credits: number;
  photo?: string;
  token?: string;
}

interface DecodedToken {
  sub: string | number;
  email: string;
  role: string;
  exp: number;
  name?: string;
  tokens_balance?: number;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (userData: {
    name: string;
    email: string;
    password: string;
    phone?: string;
  }) => Promise<{ success: boolean; data: User | null; }>;
  logout: () => Promise<void>;
  updateUser: (userData: Partial<User>) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  logAuth('État actuel', { user: !!user, loading, userId: user?.id });

  // Vérifier l'authentification au démarrage
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      // Timeout de sécurité pour éviter que loading reste à true
      const timeoutPromise = createTimeout(
        APP_CONFIG.AUTH.FORCE_LOADING_END_DELAY,
        'Vérification d\'authentification'
      );

      const authCheckPromise = async () => {
        const token = await AsyncStorage.getItem('auth_token');
        logAuth('Token trouvé', !!token);

        if (token) {
          // Décoder le JWT directement comme dans le frontend
          logAuth('Décodage JWT direct...');
          const decoded = jwtDecode<DecodedToken>(token);
          logAuth('Token décodé', decoded);

          if (decoded.exp * 1000 > Date.now()) {
            const userData: User = {
              id: String(decoded.sub),
              email: decoded.email,
              role: decoded.role,
              name: decoded.name || '',
              credits: decoded.tokens_balance ?? 0,
              phone: '',
              photo: '',
              token: token
            };

            logAuth('Utilisateur connecté depuis JWT', userData);
            setUser(userData);
          } else {
            logAuth('Token expiré, déconnexion...');
            await authApi.logout();
            setUser(null);
          }
        } else {
          logAuth('Aucun token trouvé');
          setUser(null);
        }
      };

      // Exécuter avec timeout
      await Promise.race([authCheckPromise(), timeoutPromise]);
    } catch (error) {
      logAuth('Erreur vérification auth', error);
      await authApi.logout();
      setUser(null);
    } finally {
      setLoading(false);
      logAuth('Vérification auth terminée, loading = false');
    }
  };

  const login = async (email: string, password: string): Promise<void> => {
    try {
      setLoading(true);
      const response = await authApi.login(email, password);

      if (response.data?.token) {
        logAuth('Token reçu, décodage JWT...');

        // Décoder le JWT comme dans le frontend
        const decoded = jwtDecode<DecodedToken>(response.data.token);
        logAuth('Token décodé', decoded);

        if (decoded.exp * 1000 > Date.now()) {
          // Sauvegarder le token
          await saveAuthToken(response.data.token);

          const userData: User = {
            id: String(decoded.sub),
            email: decoded.email,
            role: decoded.role,
            name: decoded.name || '',
            credits: decoded.tokens_balance ?? 0,
            phone: '',
            photo: '',
            token: response.data.token
          };

          logAuth('Utilisateur créé depuis JWT', userData);
          setUser(userData);
          logAuth('Utilisateur défini dans le contexte');
        } else {
          logAuth('Token expiré');
          throw new Error('Token expiré');
        }
      } else {
        logAuth('Aucun token dans la réponse', response);
        throw new Error('Token non reçu lors de la connexion');
      }
    } catch (error) {
      console.error('Erreur connexion:', error);
      setUser(null); // S'assurer que l'utilisateur est null en cas d'erreur
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const register = async (userData: {
    name: string;
    email: string;
    password: string;
    phone?: string;
  }) => {
    try {
      setLoading(true);
      const response = await authApi.register(userData);

      console.log('[AuthContext] Réponse inscription complète:', response);

      if (response.success) {
        // Si un token est retourné directement, l'utiliser
        if (response.data?.token) {
          console.log('[AuthContext] Token reçu lors de l\'inscription, décodage JWT...');

          // Décoder le JWT comme dans le frontend
          const decoded = jwtDecode<DecodedToken>(response.data.token);
          console.log('[AuthContext] Token décodé:', decoded);

          if (decoded.exp * 1000 > Date.now()) {
            // Sauvegarder le token
            await saveAuthToken(response.data.token);

            const newUserData: User = {
              id: String(decoded.sub),
              email: decoded.email,
              role: decoded.role,
              name: decoded.name || userData.name,
              credits: decoded.tokens_balance ?? 0,
              phone: userData.phone || '',
              photo: '',
              token: response.data.token
            };

            setUser(newUserData);
            console.log('[AuthContext] Inscription réussie avec token direct, utilisateur défini:', newUserData);
            return { success: true, data: newUserData };
          } else {
            throw new Error('Token expiré');
          }
        } else {
          // Sinon, connecter automatiquement avec les identifiants
          await login(userData.email, userData.password);
          return { success: true, data: user };
        }
      } else {
        throw new Error(response.message || 'Erreur lors de l\'inscription');
      }
    } catch (error) {
      console.error('Erreur inscription:', error);
      setUser(null); // S'assurer que l'utilisateur est null en cas d'erreur
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
      await removeAuthToken();
      setUser(null);
    } catch (error) {
      console.error('Erreur déconnexion:', error);
    }
  };

  const updateUser = (userData: Partial<User>) => {
    setUser(prev => prev ? { ...prev, ...userData } : null);
  };

  const refreshUser = async () => {
    try {
      const token = await getAuthToken();
      if (token) {
        const decoded = jwtDecode<DecodedToken>(token);

        if (decoded.exp * 1000 > Date.now()) {
          const userData: User = {
            id: String(decoded.sub),
            email: decoded.email,
            role: decoded.role,
            name: decoded.name || '',
            credits: decoded.tokens_balance ?? 0,
            phone: '',
            photo: '',
            token: token
          };

          setUser(userData);
          console.log('[AuthContext] Utilisateur actualisé depuis JWT:', userData);
        } else {
          console.log('[AuthContext] Token expiré lors de l\'actualisation');
          await removeAuthToken();
          setUser(null);
        }
      }
    } catch (error) {
      console.error('Erreur actualisation utilisateur:', error);
    }
  };

  // Initialisation de l'utilisateur au démarrage (comme dans le frontend)
  useEffect(() => {
    const initializeUser = async () => {
      try {
        const token = await getAuthToken();
        if (token) {
          console.log('[AuthContext] Token trouvé au démarrage, décodage...');
          const decoded = jwtDecode<DecodedToken>(token);

          if (decoded.exp * 1000 > Date.now()) {
            const userData: User = {
              id: String(decoded.sub),
              email: decoded.email,
              role: decoded.role,
              name: decoded.name || '',
              credits: decoded.tokens_balance ?? 0,
              phone: '',
              photo: '',
              token: token
            };

            console.log('[AuthContext] Utilisateur initialisé depuis token:', userData);
            setUser(userData);
          } else {
            console.log('[AuthContext] Token expiré au démarrage, suppression');
            await removeAuthToken();
          }
        } else {
          console.log('[AuthContext] Aucun token au démarrage');
        }
      } catch (error) {
        console.error('[AuthContext] Erreur initialisation utilisateur:', error);
        await removeAuthToken();
      } finally {
        setLoading(false);
        console.log('[AuthContext] Initialisation terminée, loading = false');
      }
    };

    // Timeout de sécurité pour éviter que loading reste à true
    const timeoutId = setTimeout(() => {
      console.log('[AuthContext] Timeout de sécurité - forcer loading = false');
      setLoading(false);
    }, 5000);

    initializeUser().finally(() => {
      clearTimeout(timeoutId);
    });
  }, []);

  const value: AuthContextType = {
    user,
    loading,
    login,
    register,
    logout,
    updateUser,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth doit être utilisé dans un AuthProvider');
  }
  return context;
};

















