import AsyncStorage from '@react-native-async-storage/async-storage';
import { jwtDecode } from 'jwt-decode';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { authApi } from '../services/api';

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

  console.log('[AuthProvider] État actuel:', { user: !!user, loading, userId: user?.id });

  // Vérifier l'authentification au démarrage
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      console.log('[AuthContext] Token trouvé:', !!token);

      if (token) {
        // Vérifier la validité du token
        console.log('[AuthContext] Vérification du token...');
        const response = await authApi.verifyToken();
        console.log('[AuthContext] Réponse verifyToken:', response);

        if (response.data) {
          console.log('[AuthContext] Utilisateur connecté:', response.data);
          setUser(response.data as User);
        } else {
          console.log('[AuthContext] Token invalide, déconnexion...');
          // Token invalide, supprimer
          await authApi.logout();
          setUser(null);
        }
      } else {
        console.log('[AuthContext] Aucun token trouvé');
        setUser(null);
      }
    } catch (error) {
      console.error('[AuthContext] Erreur vérification auth:', error);
      await authApi.logout();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string): Promise<void> => {
    try {
      setLoading(true);
      const response = await authApi.login(email, password);

      if (response.data?.token) {
        console.log('[AuthContext] Token reçu, décodage JWT...');

        // Décoder le JWT comme dans le frontend
        const decoded = jwtDecode<DecodedToken>(response.data.token);
        console.log('[AuthContext] Token décodé:', decoded);

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

          console.log('[AuthContext] Utilisateur créé depuis JWT:', userData);
          setUser(userData);
          console.log('[AuthContext] Utilisateur défini dans le contexte');

          // Attendre un cycle de rendu avant de mettre loading à false
          await new Promise(resolve => setTimeout(resolve, 100));
        } else {
          console.error('[AuthContext] Token expiré');
          throw new Error('Token expiré');
        }
      } else {
        console.error('[AuthContext] Aucun token dans la réponse:', response);
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

            // Attendre un cycle de rendu avant de mettre loading à false
            await new Promise(resolve => setTimeout(resolve, 100));
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
      }
    };

    initializeUser();
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














